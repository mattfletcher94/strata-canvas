import type { CanvasGraph } from "@/internal/createCanvasGraph";
import type { Point } from "@/types";

export interface ControlContext {
  readonly graph: CanvasGraph;
  screenToWorld(p: Point): Point;
  worldToScreen(p: Point): Point;
  readonly rootElement: HTMLElement | null;
  /** Is a particular key currently held? Tracked globally by the canvas root. */
  isKeyHeld(key: string): boolean;
  /** Cooperatively flag an event as handled so other listeners can skip it. */
  markHandled(e: Event): void;
  isHandled(e: Event): boolean;
  /** Id of the nearest (innermost) panel to the event's target, or null. */
  panelAt(e: Event): string | null;
  /** Whether the event landed on a panel (or its chrome / passthrough content). */
  isOnPanel(e: Event): boolean;
}

/**
 * Returned by a control's `onPointerDown` when it wants to claim the gesture.
 * Subsequent move/up events for this pointer are routed to this session.
 * Other controls are not invoked for the duration.
 */
export interface PointerSession {
  onMove?(e: PointerEvent, ctx: ControlContext): void;
  onUp?(e: PointerEvent, ctx: ControlContext): void;
  onCancel?(ctx: ControlContext): void;
}

/**
 * A user-interaction primitive. The canvas root dispatches every event to
 * each registered control in descending priority order, with the first
 * matching control winning exclusivity for that gesture.
 *
 * All hooks are optional — a control only listens to what it cares about.
 */
export interface Control {
  /** Descriptive identifier — useful for debugging and `data-canvas-control` */
  readonly id?: string;
  /** Higher = wins first. Default 0. */
  readonly priority?: number;
  /** Wheel event hook. Return `true` to claim and stop dispatch. */
  readonly onWheel?: (e: WheelEvent, ctx: ControlContext) => boolean;
  /** Pointerdown hook. Return a session to claim the gesture, or `false` to decline. */
  readonly onPointerDown?: (e: PointerEvent, ctx: ControlContext) => PointerSession | false;
  /**
   * Key hooks — dispatched in priority order. Return `true` to claim the
   * event and stop dispatch to lower-priority controls. Return `void`/`false`
   * to let the event continue propagating.
   */
  readonly onKeyDown?: (e: KeyboardEvent, ctx: ControlContext) => void | boolean;
  readonly onKeyUp?: (e: KeyboardEvent, ctx: ControlContext) => void | boolean;
}

/**
 * Identity function for authoring a `Control`. Mirrors strata's
 * `defineReaction` / `defineStore` pattern — zero runtime cost, exists for
 * type inference and to give the convention a name.
 *
 * Custom controls should be authored as a factory function calling this:
 *
 * ```ts
 * export function wasdPan(opts: { step?: number } = {}) {
 *   const step = opts.step ?? 20
 *   return defineControl({
 *     id: "wasdPan",
 *     onKeyDown(e, ctx) {
 *       if (e.key === "w") ctx.graph.viewportOrch.pan({ dx: 0, dy: step })
 *       // ...
 *     },
 *   })
 * }
 * ```
 */
export function defineControl<T extends Control>(control: T): T {
  return control;
}

export type ModifierKey = "ctrl" | "meta" | "alt" | "shift";

export function modifierHeld(
  e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  mod: ModifierKey,
): boolean {
  if (mod === "ctrl") return e.ctrlKey || e.metaKey;
  if (mod === "meta") return e.metaKey;
  if (mod === "alt") return e.altKey;
  if (mod === "shift") return e.shiftKey;
  return false;
}

export function allModifiersHeld(
  e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  mods: readonly ModifierKey[],
): boolean {
  for (const m of mods) if (!modifierHeld(e, m)) return false;
  return true;
}

/**
 * True when *any* of the given modifiers is held. With an empty list, returns
 * false. Used for additive-selection modifiers where holding any one of the
 * configured keys (e.g. shift) qualifies.
 */
export function anyModifierHeld(
  e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  mods: readonly ModifierKey[],
): boolean {
  for (const m of mods) if (modifierHeld(e, m)) return true;
  return false;
}

export function noOtherModifiers(
  e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  mods: readonly ModifierKey[],
): boolean {
  const allMods: readonly ModifierKey[] = ["ctrl", "meta", "alt", "shift"];
  for (const m of allMods) {
    const required = mods.includes(m);
    const held = modifierHeld(e, m);
    if (!required && held) return false;
  }
  return true;
}
