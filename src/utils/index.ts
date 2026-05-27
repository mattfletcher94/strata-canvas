import type { Box, HandlePosition, Point, Rect } from "@/types";

/** Restrict a box's position so it sits inside a rect. Size is not modified. */
export function clampBox(box: Box, rect: Rect): Box {
  const maxX = rect.maxX - box.width;
  const maxY = rect.maxY - box.height;
  const x = Math.max(rect.minX, Math.min(box.x, maxX));
  const y = Math.max(rect.minY, Math.min(box.y, maxY));
  return { x, y, width: box.width, height: box.height };
}

export type PaddingValue =
  | number
  | { x: number; y: number }
  | { top: number; right: number; bottom: number; left: number };

function normalisePadding(value: PaddingValue): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (typeof value === "number")
    return { top: value, right: value, bottom: value, left: value };
  if ("x" in value)
    return { top: value.y, right: value.x, bottom: value.y, left: value.x };
  return value;
}

/** Tighten a rect by the given padding on each side. */
export function insetRect(rect: Rect, padding: PaddingValue): Rect {
  const p = normalisePadding(padding);
  return {
    minX: rect.minX + p.left,
    minY: rect.minY + p.top,
    maxX: rect.maxX - p.right,
    maxY: rect.maxY - p.bottom,
  };
}

/** Loosen a rect by the given padding on each side. Inverse of insetRect. */
export function expandRect(rect: Rect, padding: PaddingValue): Rect {
  const p = normalisePadding(padding);
  return {
    minX: rect.minX - p.left,
    minY: rect.minY - p.top,
    maxX: rect.maxX + p.right,
    maxY: rect.maxY + p.bottom,
  };
}

/** Intersection of two rects, or null if they don't overlap. */
export function intersect(a: Rect, b: Rect): Rect | null {
  const minX = Math.max(a.minX, b.minX);
  const minY = Math.max(a.minY, b.minY);
  const maxX = Math.min(a.maxX, b.maxX);
  const maxY = Math.min(a.maxY, b.maxY);
  if (minX >= maxX || minY >= maxY) return null;
  return { minX, minY, maxX, maxY };
}

/** Convert a Box to a Rect. */
export function boxToRect(box: Box): Rect {
  return {
    minX: box.x,
    minY: box.y,
    maxX: box.x + box.width,
    maxY: box.y + box.height,
  };
}

/** True if two rects overlap (share any interior area). Edge-touching is not overlap. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/** True if a point is inside a rect. Edges are inclusive. */
export function pointInRect(p: Point, rect: Rect): boolean {
  return p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY;
}

export type Grid = number | { x: number; y: number };

function gridFor(g: Grid): { x: number; y: number } {
  return typeof g === "number" ? { x: g, y: g } : g;
}

/** Round a point to the nearest grid intersection. */
export function snapPoint(p: Point, grid: Grid): Point {
  const g = gridFor(grid);
  return { x: Math.round(p.x / g.x) * g.x, y: Math.round(p.y / g.y) * g.y };
}

/** Round both position and size to the nearest grid intersection. */
export function snapBox(box: Box, grid: Grid): Box {
  const g = gridFor(grid);
  return {
    x: Math.round(box.x / g.x) * g.x,
    y: Math.round(box.y / g.y) * g.y,
    width: Math.max(g.x, Math.round(box.width / g.x) * g.x),
    height: Math.max(g.y, Math.round(box.height / g.y) * g.y),
  };
}

/** Point on a box that does not move during a resize from the given handle. */
export function anchorOf(handle: HandlePosition, box: Box): Point {
  const left = handle.includes("w");
  const right = handle.includes("e");
  const top = handle.includes("n");
  const bottom = handle.includes("s");
  const x = left ? box.x + box.width : right ? box.x : box.x + box.width / 2;
  const y = top ? box.y + box.height : bottom ? box.y : box.y + box.height / 2;
  return { x, y };
}

/** Slide a box to the nearest position that no longer overlaps the given rect. */
export function pushOutOfRect(box: Box, forbidden: Rect): Box {
  const r = boxToRect(box);
  if (!rectsOverlap(r, forbidden)) return box;
  const dxLeft = forbidden.minX - r.maxX;
  const dxRight = forbidden.maxX - r.minX;
  const dyUp = forbidden.minY - r.maxY;
  const dyDown = forbidden.maxY - r.minY;
  const candidates: ReadonlyArray<{ dx: number; dy: number; dist: number }> = [
    { dx: dxLeft, dy: 0, dist: Math.abs(dxLeft) },
    { dx: dxRight, dy: 0, dist: Math.abs(dxRight) },
    { dx: 0, dy: dyUp, dist: Math.abs(dyUp) },
    { dx: 0, dy: dyDown, dist: Math.abs(dyDown) },
  ];
  const best = candidates.reduce((a, b) => (b.dist < a.dist ? b : a));
  return { x: box.x + best.dx, y: box.y + best.dy, width: box.width, height: box.height };
}

/** True if two boxes are positionally + dimensionally equal. */
export function boxEqual(a: Box, b: Box): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
