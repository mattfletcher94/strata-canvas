import { allModifiersHeld, type Control, defineControl, type ModifierKey } from "./types";

export type MouseButton = "left" | "middle" | "right";

const BUTTON_CODE: Record<MouseButton, number> = { left: 0, middle: 1, right: 2 };

export interface PanOptions {
  /** Mouse button that activates this pan. Default `"middle"`. */
  readonly button?: MouseButton;
  /** Modifiers that must be held in addition to the button. Default `[]`. */
  readonly modifiers?: readonly ModifierKey[];
  /** Keys that must be held (e.g. `["Space"]`). Default `[]`. */
  readonly keys?: readonly string[];
  /**
   * Limit activation to when the pointer is NOT over any panel. Default `false`.
   * Useful for bare-left-button background pan that shouldn't compete with
   * panel drag handles.
   */
  readonly onlyBackground?: boolean;
  readonly priority?: number;
}

/** Pan the viewport while a button (+ optional modifiers / keys) is held. */
export function pan(options: PanOptions = {}): Control {
  const button = BUTTON_CODE[options.button ?? "middle"];
  const mods = options.modifiers ?? [];
  const keys = options.keys ?? [];
  const onlyBackground = options.onlyBackground ?? false;
  return defineControl({
    id: "pan",
    priority: options.priority ?? 0,
    onPointerDown(e, ctx) {
      if (e.button !== button) return false;
      if (!allModifiersHeld(e, mods)) return false;
      for (const k of keys) if (!ctx.isKeyHeld(k)) return false;
      if (onlyBackground && ctx.isOnPanel(e)) return false;
      e.preventDefault();
      ctx.markHandled(e);
      ctx.graph.gestureOrch.beginPan({ screenPointer: { x: e.clientX, y: e.clientY } });
      return {};
    },
  });
}
