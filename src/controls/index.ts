export type { Control, ControlContext, PointerSession, ModifierKey } from "./types";
export {
  defineControl,
  modifierHeld,
  allModifiersHeld,
  anyModifierHeld,
  noOtherModifiers,
} from "./types";

export { wheelZoom, type WheelZoomOptions } from "./wheelZoom";
export { pan, type PanOptions, type MouseButton } from "./pan";
export { select, type SelectOptions, type SelectControl } from "./select";
export {
  onBackgroundPointerDown,
  clearSelectionOnBackground,
  type BackgroundPointerEvent,
  type OnBackgroundOptions,
} from "./onBackground";
export { passthroughRegions, type PassthroughRegionsOptions } from "./passthroughRegions";
export { passthroughClassNames, type PassthroughClassNamesOptions } from "./passthroughClassNames";

import type { Control } from "./types";
import { wheelZoom } from "./wheelZoom";
import { pan } from "./pan";
import { select } from "./select";
import { passthroughRegions } from "./passthroughRegions";
import { passthroughClassNames } from "./passthroughClassNames";

/**
 * Canonical default controls — Figma/Miro convention plus passthrough
 * blockers so `<Canvas.PassThrough>` and `canvas-no*` class names work
 * out of the box.
 *
 * Spread to extend, or omit to opt out individual controls entirely.
 */
export function defaultControls(): readonly Control[] {
  return [
    passthroughRegions(),
    passthroughClassNames(),
    select(),
    wheelZoom({ modifiers: ["ctrl"] }),
    pan({ button: "middle" }),
    pan({ button: "left", keys: ["Space"] }),
  ];
}
