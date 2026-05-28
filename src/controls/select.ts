import { anyModifierHeld, type Control, type ModifierKey } from "./types";
import { nearestPanelEl } from "./hitTest";
import type { MouseButton } from "./pan";

const BUTTON_CODE: Record<MouseButton, number> = { left: 0, middle: 1, right: 2 };

export interface SelectOptions {
  /**
   * Modifiers that make a click *additive* — holding any one of them toggles
   * the clicked panel in/out of the selection instead of replacing it.
   * Default `["shift"]`.
   */
  readonly additive?: readonly ModifierKey[];
  /** Mouse button that selects. Default `"left"`. */
  readonly button?: MouseButton;
  readonly priority?: number;
}

/**
 * A `select` control carries its resolved additive modifiers so the panel
 * layer (drag/resize-begin) can honour the same modifier as body clicks.
 */
export interface SelectControl extends Control {
  readonly id: "select";
  readonly additiveModifiers: readonly ModifierKey[];
}

/**
 * Click a panel to select it; hold the additive modifier (default shift) to
 * toggle it in/out of a multi-selection. Body clicks route through here;
 * drag/resize-begin selection reads `additiveModifiers` so the modifier is
 * configured in exactly one place.
 *
 * Declines (returns false) when over a non-selectable panel or empty canvas,
 * and never claims the gesture — drag/resize handles drive the actual gesture.
 * Higher-priority passthrough controls block this over embedded-app regions.
 */
export function select(options: SelectOptions = {}): SelectControl {
  const additive = options.additive ?? ["shift"];
  const button = BUTTON_CODE[options.button ?? "left"];
  const control: SelectControl = {
    id: "select",
    priority: options.priority ?? 0,
    additiveModifiers: additive,
    onPointerDown(e, ctx) {
      if (e.button !== button) return false;
      const el = nearestPanelEl(e);
      if (!el || el.dataset.selectable === "false") return false;
      const id = el.dataset.panelId;
      if (!id) return false;
      ctx.graph.selectionOrch.selectOnPointerDown({
        id,
        additive: anyModifierHeld(e, additive),
      });
      return false;
    },
  };
  return control;
}
