import { defineService } from "@mattfletcher94/strata";
import type { KeyboardModifiers, Point } from "@/types";

export interface PointerMoveEvent {
  readonly screenPointer: Point;
  readonly modifiers: KeyboardModifiers;
  readonly native: PointerEvent;
}

export interface PointerUpEvent {
  readonly screenPointer: Point;
  readonly modifiers: KeyboardModifiers;
  readonly native: PointerEvent;
}

export interface PointerCancelEvent {
  readonly native: PointerEvent;
}

export interface KeyEvent {
  readonly key: string;
  readonly modifiers: KeyboardModifiers;
  readonly native: KeyboardEvent;
}

export interface WheelEventInfo {
  readonly screenPointer: Point;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly modifiers: KeyboardModifiers;
  readonly native: WheelEvent;
}

export interface PointerSubscribers {
  readonly onMove?: (e: PointerMoveEvent) => void;
  readonly onUp?: (e: PointerUpEvent) => void;
  readonly onCancel?: (e: PointerCancelEvent) => void;
  readonly onKeyDown?: (e: KeyEvent) => void;
  readonly onKeyUp?: (e: KeyEvent) => void;
  readonly onWheel?: (e: WheelEventInfo) => void;
}

export interface PointerService {
  subscribe(handlers: PointerSubscribers): () => void;
  current(): { readonly screenPointer: Point; readonly modifiers: KeyboardModifiers } | null;
}

export const pointerService = defineService({
  name: "pointer",
  responsibility: "Coalesced window pointer/keyboard/wheel events.",
  setup: (): PointerService => {
    const subscribers = new Set<PointerSubscribers>();
    let latest: { screenPointer: Point; modifiers: KeyboardModifiers } | null = null;
    let pendingMove: PointerMoveEvent | null = null;
    let frameRequested = false;
    let mounted = false;

    const readModifiers = (e: PointerEvent | KeyboardEvent | WheelEvent): KeyboardModifiers => ({
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
      meta: e.metaKey,
    });

    const shouldSkipKeyboard = (e: KeyboardEvent): boolean => {
      const target = e.target as Element | null;
      if (!target) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target instanceof HTMLElement && target.isContentEditable) return true;
      return false;
    };

    const flushMove = () => {
      frameRequested = false;
      const ev = pendingMove;
      pendingMove = null;
      if (!ev) return;
      for (const sub of subscribers) sub.onMove?.(ev);
    };

    const handleMove = (e: PointerEvent) => {
      const screenPointer: Point = { x: e.clientX, y: e.clientY };
      const modifiers = readModifiers(e);
      latest = { screenPointer, modifiers };
      pendingMove = { screenPointer, modifiers, native: e };
      if (!frameRequested) {
        frameRequested = true;
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(flushMove);
        } else {
          Promise.resolve().then(flushMove);
        }
      }
    };

    const handleUp = (e: PointerEvent) => {
      if (frameRequested) flushMove();
      const ev: PointerUpEvent = {
        screenPointer: { x: e.clientX, y: e.clientY },
        modifiers: readModifiers(e),
        native: e,
      };
      latest = { screenPointer: ev.screenPointer, modifiers: ev.modifiers };
      for (const sub of subscribers) sub.onUp?.(ev);
    };

    const handleCancel = (e: PointerEvent) => {
      if (frameRequested) flushMove();
      for (const sub of subscribers) sub.onCancel?.({ native: e });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldSkipKeyboard(e)) return;
      for (const sub of subscribers)
        sub.onKeyDown?.({ key: e.key, modifiers: readModifiers(e), native: e });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (shouldSkipKeyboard(e)) return;
      for (const sub of subscribers)
        sub.onKeyUp?.({ key: e.key, modifiers: readModifiers(e), native: e });
    };

    const handleWheel = (e: WheelEvent) => {
      const info: WheelEventInfo = {
        screenPointer: { x: e.clientX, y: e.clientY },
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        modifiers: readModifiers(e),
        native: e,
      };
      for (const sub of subscribers) sub.onWheel?.(info);
    };

    const mount = () => {
      if (mounted || typeof window === "undefined") return;
      mounted = true;
      window.addEventListener("pointermove", handleMove, { passive: true });
      window.addEventListener("pointerup", handleUp, { passive: true });
      window.addEventListener("pointercancel", handleCancel, { passive: true });
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("wheel", handleWheel, { passive: false });
    };

    const unmount = () => {
      if (!mounted) return;
      mounted = false;
      if (typeof window === "undefined") return;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("wheel", handleWheel);
    };

    return {
      subscribe(handlers: PointerSubscribers) {
        if (subscribers.size === 0) mount();
        subscribers.add(handlers);
        return () => {
          subscribers.delete(handlers);
          if (subscribers.size === 0) unmount();
        };
      },
      current() {
        return latest;
      },
    };
  },
  teardown: () => {
    // Service-level cleanup runs on $dispose. The unsubscribe path handles the
    // unmount when refcount drops to zero, so explicit teardown is a no-op
    // unless a consumer leaks a subscription past graph disposal.
  },
});
