import type { BoundsFn, Box, Rect, ResolveCtx, ResolveFn, ResolveResult } from "@/types";
import {
  anchorOf,
  boxToRect,
  clampBox,
  insetRect,
  pushOutOfRect as pushOutOfRectUtil,
  rectsOverlap,
  snapPoint,
  type Grid,
  type PaddingValue,
} from "@/utils";

/**
 * Compose multiple ResolveFns into one. Left-to-right pipeline.
 *
 * Bounds threading: if any function in the chain returns `{ box, bounds }`,
 * subsequent functions see the updated bounds via `ctx.bounds`. This lets
 * e.g. `compose(restrictToParent, withPadding(10))` work without setting
 * the `:bounds` prop — `restrictToParent` establishes parent bounds and
 * `withPadding` tightens them.
 */
export function compose(...fns: ReadonlyArray<ResolveFn>): ResolveFn {
  if (fns.length === 0) return (proposed) => proposed;
  if (fns.length === 1) return fns[0];
  return (proposed, ctx) => {
    let box = proposed;
    let bounds = ctx.bounds;
    for (const fn of fns) {
      const result = fn(box, { ...ctx, bounds });
      if (typeof result === "object" && "box" in result) {
        box = result.box;
        if (result.bounds !== undefined) bounds = result.bounds;
      } else {
        box = result;
      }
    }
    return { box, bounds };
  };
}

/** Rect describing the parent panel's interior in parent-local coords. */
export function parentBox(ctx: ResolveCtx): Rect {
  if (!ctx.parent) return ctx.viewport;
  return { minX: 0, minY: 0, maxX: ctx.parent.width, maxY: ctx.parent.height };
}

/** Viewport rect (world coords). */
export function viewportBox(ctx: ResolveCtx): Rect {
  return ctx.viewport;
}

/** Clamp the proposed box to its parent's interior and set bounds = parent. */
export const restrictToParent: ResolveFn = (proposed, ctx) => {
  const bounds = parentBox(ctx);
  return { box: clampBox(proposed, bounds), bounds };
};

/**
 * Cap the panel's size to the current bounds rect (or parent's interior if
 * no bounds set). Useful when a panel should never exceed its container —
 * sidebars, dock widgets, "must fit a slot" cases.
 *
 * For canvas-style "let it overflow and clip" behaviour (Figma, tldraw,
 * vue-flow), use `restrictToParent` alone. Compose this one BEFORE
 * `restrictToParent` so position-clamping operates on the already-capped size.
 */
export const restrictSizeToParent: ResolveFn = (proposed, ctx) => {
  const bounds = ctx.bounds ?? parentBox(ctx);
  const maxW = bounds.maxX - bounds.minX;
  const maxH = bounds.maxY - bounds.minY;
  if (proposed.width <= maxW && proposed.height <= maxH) return proposed;
  return {
    x: proposed.x,
    y: proposed.y,
    width: Math.min(proposed.width, maxW),
    height: Math.min(proposed.height, maxH),
  };
};

/** Clamp the proposed box to the current viewport and set bounds = viewport. */
export const restrictToViewport: ResolveFn = (proposed, ctx) => {
  const bounds = ctx.viewport;
  return { box: clampBox(proposed, bounds), bounds };
};

/** Clamp the proposed box to an explicit rect and set bounds to that rect. */
export function restrictToRect(rect: Rect | { value: Rect } | BoundsFn): ResolveFn {
  return (proposed, ctx) => {
    const r = resolveRectInput(rect, ctx);
    if (!r) return proposed;
    return { box: clampBox(proposed, r), bounds: r };
  };
}

/** Lock motion to one axis. Drag-only; resize gestures pass through. */
export function lockAxis(axis: "x" | "y"): ResolveFn {
  return (proposed, ctx) => {
    if (ctx.gesture !== "drag") return proposed;
    return axis === "x"
      ? { ...proposed, y: ctx.current.y }
      : { ...proposed, x: ctx.current.x };
  };
}

/** Enforce a minimum size. Anchored so the handle's opposite edge stays fixed. */
export function withMinSize(opts: { width?: number; height?: number }): ResolveFn {
  return (proposed, ctx) =>
    sizeClampedBox(proposed, ctx, opts.width, opts.height, undefined, undefined);
}

/** Enforce a maximum size. Anchored so the handle's opposite edge stays fixed. */
export function withMaxSize(opts: { width?: number; height?: number }): ResolveFn {
  return (proposed, ctx) =>
    sizeClampedBox(proposed, ctx, undefined, undefined, opts.width, opts.height);
}

/** Preserve aspect ratio during resize. `'lock'` reads the ratio from the gesture's starting box. */
export function withAspectRatio(ratio: number | "lock"): ResolveFn {
  return (proposed, ctx) => {
    if (ctx.gesture !== "resize" || !ctx.handle) return proposed;
    const r = ratio === "lock" ? ctx.current.width / ctx.current.height : ratio;
    if (r <= 0 || !Number.isFinite(r)) return proposed;
    const handle = ctx.handle;
    const isEdgeNS = handle === "n" || handle === "s";
    const isEdgeEW = handle === "e" || handle === "w";
    let width = proposed.width;
    let height = proposed.height;
    if (isEdgeNS) {
      width = height * r;
    } else if (isEdgeEW) {
      height = width / r;
    } else {
      const dw = Math.abs(proposed.width - ctx.current.width) / ctx.current.width;
      const dh = Math.abs(proposed.height - ctx.current.height) / ctx.current.height;
      if (dw >= dh) height = width / r;
      else width = height * r;
    }
    const anchor = anchorOf(handle, ctx.current);
    let x = proposed.x;
    let y = proposed.y;
    if (handle.includes("w")) x = anchor.x - width;
    if (handle.includes("n")) y = anchor.y - height;
    if (handle === "n" || handle === "s") x = ctx.current.x + (ctx.current.width - width) / 2;
    if (handle === "e" || handle === "w") y = ctx.current.y + (ctx.current.height - height) / 2;
    return { x, y, width, height };
  };
}

/**
 * Tighten the current bounds rect by `padding` before clamping.
 *
 * Requires bounds to be set — either via the `:bounds` prop, or by composing
 * after a bounds-setting fn like `restrictToParent` / `restrictToViewport` /
 * `restrictToRect`. Without bounds, this fn is a no-op.
 *
 * Returns updated bounds so further chained fns see the tighter rect.
 */
export function withPadding(padding: PaddingValue): ResolveFn {
  return (proposed, ctx) => {
    if (!ctx.bounds) return proposed;
    const tightened = insetRect(ctx.bounds, padding);
    return { box: clampBox(proposed, tightened), bounds: tightened };
  };
}

/** Round the proposed box's position (and size, for resize) to a grid. */
export function snapToGrid(grid: Grid): ResolveFn {
  return (proposed, ctx) => {
    const g = typeof grid === "number" ? { x: grid, y: grid } : grid;
    const snapped = snapPoint({ x: proposed.x, y: proposed.y }, g);
    if (ctx.gesture === "drag") {
      return { x: snapped.x, y: snapped.y, width: proposed.width, height: proposed.height };
    }
    const w = Math.max(g.x, Math.round(proposed.width / g.x) * g.x);
    const h = Math.max(g.y, Math.round(proposed.height / g.y) * g.y);
    return { x: snapped.x, y: snapped.y, width: w, height: h };
  };
}

/** Reject moves whose proposed box overlaps the given rect. */
export function avoidRect(rect: Rect | { value: Rect } | ((ctx: ResolveCtx) => Rect)): ResolveFn {
  return (proposed, ctx) => {
    const r = resolveRectInput(rect, ctx);
    if (!r) return proposed;
    return rectsOverlap(boxToRect(proposed), r) ? ctx.current : proposed;
  };
}

/** Slide the proposed box to the nearest non-overlapping position around a forbidden rect. */
export function pushOutOfRect(
  rect: Rect | { value: Rect } | ((ctx: ResolveCtx) => Rect),
): ResolveFn {
  return (proposed, ctx) => {
    const r = resolveRectInput(rect, ctx);
    if (!r) return proposed;
    return rectsOverlap(boxToRect(proposed), r) ? pushOutOfRectUtil(proposed, r) : proposed;
  };
}

/**
 * Prevent overlap with any immediate sibling panel.
 *
 * Drag: axis-decomposed sliding — the panel moves along sibling edges
 * smoothly instead of locking in place when the proposed position collides.
 * Resize: simple rejection (sliding doesn't generalise to size changes).
 */
export const avoidSiblings: ResolveFn = (proposed, ctx) => {
  if (ctx.siblings.length === 0) return proposed;

  const siblingRects: Rect[] = [];
  for (const s of ctx.siblings) {
    siblingRects.push({
      minX: s.x,
      minY: s.y,
      maxX: s.x + s.width,
      maxY: s.y + s.height,
    });
  }

  if (ctx.gesture !== "drag") {
    for (const sRect of siblingRects) {
      if (rectsOverlap(boxToRect(proposed), sRect)) return ctx.current;
    }
    return proposed;
  }

  // Axis-decomposed slide: try X movement, then Y from the X result.
  let resultX = proposed.x;
  const xCandidate: Box = {
    x: proposed.x,
    y: ctx.current.y,
    width: ctx.current.width,
    height: ctx.current.height,
  };
  for (const s of siblingRects) {
    if (!rectsOverlap(boxToRect(xCandidate), s)) continue;
    if (proposed.x > ctx.current.x) {
      const limit = s.minX - ctx.current.width;
      if (limit >= ctx.current.x && limit < resultX) {
        resultX = limit;
        xCandidate.x = resultX;
      }
    } else if (proposed.x < ctx.current.x) {
      const limit = s.maxX;
      if (limit <= ctx.current.x && limit > resultX) {
        resultX = limit;
        xCandidate.x = resultX;
      }
    }
  }

  let resultY = proposed.y;
  const yCandidate: Box = {
    x: resultX,
    y: proposed.y,
    width: ctx.current.width,
    height: ctx.current.height,
  };
  for (const s of siblingRects) {
    if (!rectsOverlap(boxToRect(yCandidate), s)) continue;
    if (proposed.y > ctx.current.y) {
      const limit = s.minY - ctx.current.height;
      if (limit >= ctx.current.y && limit < resultY) {
        resultY = limit;
        yCandidate.y = resultY;
      }
    } else if (proposed.y < ctx.current.y) {
      const limit = s.maxY;
      if (limit <= ctx.current.y && limit > resultY) {
        resultY = limit;
        yCandidate.y = resultY;
      }
    }
  }

  return {
    x: resultX,
    y: resultY,
    width: ctx.current.width,
    height: ctx.current.height,
  };
};

// ─── helpers ───────────────────────────────────────────────────────────────

function resolveRectInput(
  input: Rect | { value: Rect } | ((ctx: ResolveCtx) => Rect),
  ctx: ResolveCtx,
): Rect | null {
  if (typeof input === "function") return input(ctx);
  if ("minX" in input) return input;
  return input.value;
}

function sizeClampedBox(
  proposed: Box,
  ctx: ResolveCtx,
  minW: number | undefined,
  minH: number | undefined,
  maxW: number | undefined,
  maxH: number | undefined,
): Box {
  const handle = ctx.handle;
  let width = proposed.width;
  let height = proposed.height;
  if (minW !== undefined && width < minW) width = minW;
  if (minH !== undefined && height < minH) height = minH;
  if (maxW !== undefined && width > maxW) width = maxW;
  if (maxH !== undefined && height > maxH) height = maxH;
  if (width === proposed.width && height === proposed.height) return proposed;
  if (!handle) return { x: proposed.x, y: proposed.y, width, height };
  const anchor = anchorOf(handle, ctx.current);
  let x = proposed.x;
  let y = proposed.y;
  if (handle.includes("w")) x = anchor.x - width;
  if (handle.includes("n")) y = anchor.y - height;
  return { x, y, width, height };
}

// Public type re-export for users writing custom resolve functions.
export type { ResolveResult } from "@/types";
