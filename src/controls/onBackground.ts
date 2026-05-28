import { type Control, type ControlContext, defineControl } from "./types";
import type { Point } from "@/types";

export interface BackgroundPointerEvent {
  /** Pointer position in screen (client) coordinates. */
  readonly screen: Point;
  /** Pointer position in world coordinates. */
  readonly world: Point;
  readonly originalEvent: PointerEvent;
}

export interface OnBackgroundOptions {
  /**
   * Runs above the standard controls (default 100) so the callback fires even
   * when a lower-priority control (e.g. a background pan) goes on to claim the
   * gesture. Stays below the passthrough controls (999/1000).
   */
  readonly priority?: number;
}

/**
 * Fires `cb` when a pointerdown lands on empty canvas — i.e. not on any panel
 * (or its chrome / passthrough content). Never claims the gesture, so a
 * background pan can still run on the same event.
 */
export function onBackgroundPointerDown(
  cb: (e: BackgroundPointerEvent, ctx: ControlContext) => void,
  options: OnBackgroundOptions = {},
): Control {
  return defineControl({
    id: "onBackgroundPointerDown",
    priority: options.priority ?? 100,
    onPointerDown(e, ctx) {
      if (ctx.isOnPanel(e)) return false;
      const screen = { x: e.clientX, y: e.clientY };
      cb({ screen, world: ctx.screenToWorld(screen), originalEvent: e }, ctx);
      return false;
    },
  });
}

/** Clear the selection when the user clicks empty canvas. */
export function clearSelectionOnBackground(options: OnBackgroundOptions = {}): Control {
  return onBackgroundPointerDown((_e, ctx) => {
    ctx.graph.selectionOrch.clear();
  }, options);
}
