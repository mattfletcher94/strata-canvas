import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCanvasGraph, type CanvasGraphHandle } from "@/internal/createCanvasGraph";

let handle: CanvasGraphHandle;
beforeEach(() => {
  handle = createCanvasGraph();
});
afterEach(async () => {
  await handle.dispose();
});

describe("selection", () => {
  it("plain select replaces the current selection", () => {
    const sel = handle.graph.selectionOrch;
    sel.select({ id: "a" });
    sel.select({ id: "b" });
    expect(sel.selectedIds()).toEqual(["b"]);
  });

  it("additive select adds, then toggles the same id off", () => {
    const sel = handle.graph.selectionOrch;
    sel.select({ id: "a" });
    sel.select({ id: "b", additive: true });
    expect(sel.selectedIds()).toEqual(["a", "b"]);
    sel.select({ id: "a", additive: true });
    expect(sel.selectedIds()).toEqual(["b"]);
  });

  it("selectOnPointerDown collapses a multi-selection to one when not additive", () => {
    const sel = handle.graph.selectionOrch;
    sel.set({ ids: ["a", "b", "c"] });
    sel.selectOnPointerDown({ id: "b", additive: false });
    expect(sel.selectedIds()).toEqual(["b"]);
  });

  it("selectOnPointerDown keepExisting preserves the selection when the panel is already selected", () => {
    const sel = handle.graph.selectionOrch;
    sel.set({ ids: ["a", "b", "c"] });
    sel.selectOnPointerDown({ id: "b", additive: false, keepExisting: true });
    expect(sel.selectedIds()).toEqual(["a", "b", "c"]);
  });

  it("selectOnPointerDown keepExisting still selects solely when the panel is not selected", () => {
    const sel = handle.graph.selectionOrch;
    sel.set({ ids: ["a", "b"] });
    sel.selectOnPointerDown({ id: "x", additive: false, keepExisting: true });
    expect(sel.selectedIds()).toEqual(["x"]);
  });

  it("additive selectOnPointerDown toggles membership", () => {
    const sel = handle.graph.selectionOrch;
    sel.set({ ids: ["a"] });
    sel.selectOnPointerDown({ id: "a", additive: true });
    expect(sel.selectedIds()).toEqual([]);
  });

  it("clear empties the selection", () => {
    const sel = handle.graph.selectionOrch;
    sel.set({ ids: ["a", "b"] });
    sel.clear();
    expect(sel.selectedIds()).toEqual([]);
  });

  it("primarySelection tracks the most recently added id", () => {
    const sel = handle.graph.selectionOrch;
    sel.select({ id: "a" });
    sel.select({ id: "b", additive: true });
    expect(sel.primarySelection()).toBe("b");
  });
});
