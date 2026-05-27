// Public type surface for @mattfletcher94/strata-canvas.
// See docs/PROPOSAL.md for full design rationale.

/** Position-only point. */
export interface Point {
  x: number;
  y: number;
}

/** Positioned, sized box. The primary state shape consumers bind via v-model. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Rectangular region described by edges (used for bounds + clamping). */
export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Eight resize handle positions. */
export type HandlePosition = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

/** A panel's identity + geometry, as exposed via ResolveCtx. */
export interface PanelInfo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KeyboardModifiers {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/** Context passed to a `:resolve` function on every gesture frame. */
export interface ResolveCtx {
  /** Panel's box at the start of this frame. */
  current: Box;
  /** Resolved bounds rect from the `:bounds` prop, if any. */
  bounds: Rect | null;
  /** Nearest ancestor panel (live state). Null at the top level. */
  parent: PanelInfo | null;
  /** Immediate sibling panels (live state). */
  siblings: PanelInfo[];
  /** Current viewport rect, world coords. */
  viewport: Rect;
  /** Current pointer position, world coords. */
  pointer: Point;
  /** Keyboard modifier state. */
  modifiers: KeyboardModifiers;
  /** Which gesture produced the proposed box. */
  gesture: "drag" | "resize";
  /** Which handle initiated the resize. Undefined for drag. */
  handle?: HandlePosition;
}

/**
 * The result of a resolve function. Most functions just return a `Box`.
 * Functions that establish or tighten the allowed region (e.g. `restrictToParent`,
 * `restrictToRect`) return `{ box, bounds }` so downstream functions in a
 * `compose(...)` chain can see the updated bounds via `ctx.bounds`.
 */
export type ResolveResult = Box | { readonly box: Box; readonly bounds?: Rect | null };

/** A pure function that maps a proposed box to the box to commit. */
export type ResolveFn = (proposed: Box, ctx: ResolveCtx) => ResolveResult;

/** A function returning the bounds rect for a panel at gesture time. */
export type BoundsFn = (ctx: ResolveCtx) => Rect;
