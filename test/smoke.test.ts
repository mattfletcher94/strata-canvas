import { describe, expect, it } from "vitest";
import { createCanvas } from "@/index";
import { clampBox, insetRect, rectsOverlap } from "@/utils";
import { compose, restrictToParent, withPadding } from "@/constraints";

describe("public API smoke", () => {
  it("createCanvas returns a frozen namespace with all primitives", () => {
    const c = createCanvas();
    expect(Object.isFrozen(c)).toBe(true);
    expect(c.Root).toBeDefined();
    expect(c.Panel).toBeDefined();
    expect(c.DragHandle).toBeDefined();
    expect(c.ResizeHandleN).toBeDefined();
    expect(c.ResizeHandleSE).toBeDefined();
    expect(c.PassThrough).toBeDefined();
    expect(c.useCanvas).toBeTypeOf("function");
    expect(c.usePanel).toBeTypeOf("function");
  });
});

describe("constraint utilities", () => {
  it("clampBox restricts a box to a rect", () => {
    const box = { x: 150, y: 0, width: 50, height: 50 };
    const rect = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    expect(clampBox(box, rect)).toEqual({ x: 50, y: 0, width: 50, height: 50 });
  });

  it("insetRect tightens evenly with a number", () => {
    const r = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    expect(insetRect(r, 10)).toEqual({ minX: 10, minY: 10, maxX: 90, maxY: 90 });
  });

  it("rectsOverlap returns false for non-overlapping rects", () => {
    expect(
      rectsOverlap(
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        { minX: 20, minY: 20, maxX: 30, maxY: 30 },
      ),
    ).toBe(false);
  });
});

describe("compose", () => {
  it("returns identity for no fns", () => {
    const r = compose();
    const box = { x: 1, y: 2, width: 3, height: 4 };
    expect(r(box, fakeCtx())).toEqual(box);
  });

  it("threads box through fns left-to-right", () => {
    const a = (b: { x: number; y: number; width: number; height: number }) => ({ ...b, x: b.x + 1 });
    const c = compose(a, a, a);
    const box = { x: 0, y: 0, width: 10, height: 10 };
    expect(c(box, fakeCtx()).x).toBe(3);
  });

  it("restrictToParent + withPadding works as a chain", () => {
    const ctx = fakeCtx({ parent: { id: "p", x: 0, y: 0, width: 100, height: 100 } });
    const r = compose(restrictToParent, withPadding(10));
    const box = { x: 95, y: 0, width: 20, height: 20 };
    const out = r(box, ctx);
    expect(out.x).toBe(70);
  });
});

function fakeCtx(overrides: Partial<import("@/types").ResolveCtx> = {}): import("@/types").ResolveCtx {
  return {
    current: { x: 0, y: 0, width: 10, height: 10 },
    bounds: null,
    parent: null,
    siblings: [],
    viewport: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    pointer: { x: 0, y: 0 },
    modifiers: { ctrl: false, shift: false, alt: false, meta: false },
    gesture: "drag",
    ...overrides,
  };
}
