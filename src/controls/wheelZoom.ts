import { allModifiersHeld, type Control, defineControl, type ModifierKey } from "./types";

export interface WheelZoomOptions {
  /** Modifiers that must be held. `[]` = bare wheel zooms. Default `["ctrl"]`. */
  readonly modifiers?: readonly ModifierKey[];
  /**
   * Base sensitivity — higher = zooms faster. Default 0.005.
   * Applied to a *normalised* delta that amplifies small trackpad deltas and
   * dampens large mouse-wheel detents so both feel comparable.
   */
  readonly sensitivity?: number;
  readonly priority?: number;
}

/** Wheel-driven zoom anchored on the cursor position. */
export function wheelZoom(options: WheelZoomOptions = {}): Control {
  const mods = options.modifiers ?? ["ctrl"];
  const sensitivity = options.sensitivity ?? 0.005;
  return defineControl({
    id: "wheelZoom",
    priority: options.priority ?? 0,
    onWheel(e, ctx) {
      if (!allModifiersHeld(e, mods)) return false;
      e.preventDefault();
      // Normalise across input types:
      //   trackpad pinch → small deltas, many events  → amplify
      //   mouse wheel    → big discrete chunks        → dampen
      const abs = Math.abs(e.deltaY);
      const normalised = abs < 25 ? e.deltaY * 4 : e.deltaY * 0.5;
      const cur = ctx.graph.viewportOrch.zoom();
      const factor = Math.exp(-normalised * sensitivity);
      const around = ctx.screenToWorld({ x: e.clientX, y: e.clientY });
      ctx.graph.viewportOrch.zoomTo({ zoom: cur * factor, around });
      return true;
    },
  });
}
