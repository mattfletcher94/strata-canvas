import type { BoundsFn, Box, HandlePosition, KeyboardModifiers, Point, Rect, ResolveCtx, ResolveFn } from "@/types";
import { boxToRect, clampBox } from "@/utils";
import type { PanelRow } from "@/internal/stores/registry";

export type BoundsValue = Rect | { value: Rect } | BoundsFn;

export function resolveBoundsValue(value: BoundsValue | undefined, ctx: ResolveCtx): Rect | null {
  if (value === undefined) return null;
  if (typeof value === "function") return (value as BoundsFn)(ctx);
  if ("minX" in value) return value;
  return value.value;
}

export interface BuildCtxInput {
  readonly currentBox: Box;
  readonly parent: PanelRow | null;
  readonly siblings: readonly PanelRow[];
  readonly viewport: Rect;
  readonly pointer: Point;
  readonly modifiers: KeyboardModifiers;
  readonly gesture: "drag" | "resize" | "reflow";
  readonly handle?: HandlePosition;
}

export function buildResolveCtx(input: BuildCtxInput): ResolveCtx {
  return {
    current: input.currentBox,
    bounds: null,
    parent: input.parent
      ? {
          id: input.parent.id,
          x: input.parent.x,
          y: input.parent.y,
          width: input.parent.width,
          height: input.parent.height,
        }
      : null,
    siblings: input.siblings.map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
    })),
    viewport: input.viewport,
    pointer: input.pointer,
    modifiers: input.modifiers,
    gesture: input.gesture === "reflow" ? "drag" : input.gesture,
    handle: input.handle,
  };
}

export interface RunPipelineInput extends BuildCtxInput {
  readonly proposed: Box;
  readonly bounds?: BoundsValue;
  readonly resolve?: ResolveFn;
}

/**
 * Apply bounds + resolve to a proposed Box, returning the final Box to commit.
 * Pure function. Called by the Vue panel component every gesture frame and
 * whenever reactive inputs change.
 *
 * Unwraps the resolve fn's `ResolveResult` (which can be `Box` or
 * `{ box, bounds }`) — the bounds field is only meaningful inside a `compose`
 * chain; at the panel boundary we just take the box.
 */
export function runPipeline(input: RunPipelineInput): Box {
  const ctx = buildResolveCtx(input);
  const bounds = resolveBoundsValue(input.bounds, ctx);
  let box = bounds ? clampBox(input.proposed, bounds) : input.proposed;
  if (input.resolve) {
    const ctxWithBounds: ResolveCtx = { ...ctx, bounds };
    const result = input.resolve(box, ctxWithBounds);
    box = typeof result === "object" && "box" in result ? result.box : result;
  }
  return box;
}

/** Convert a panel row to a Box. */
export function panelToBox(row: PanelRow): Box {
  return { x: row.x, y: row.y, width: row.width, height: row.height };
}

/** Compute the viewport rect in world coords given a screen size and the viewport state. */
export function viewportToRect(viewport: {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}, screen: { readonly width: number; readonly height: number }): Rect {
  return {
    minX: -viewport.x / viewport.zoom,
    minY: -viewport.y / viewport.zoom,
    maxX: (screen.width - viewport.x) / viewport.zoom,
    maxY: (screen.height - viewport.y) / viewport.zoom,
  };
}

export { boxToRect };
