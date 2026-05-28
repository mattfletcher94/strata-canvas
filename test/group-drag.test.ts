import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCanvasGraph, type CanvasGraphHandle } from "@/internal/createCanvasGraph";
import type { KeyboardModifiers } from "@/types";

const noMods: KeyboardModifiers = { ctrl: false, shift: false, alt: false, meta: false };

let handle: CanvasGraphHandle;
beforeEach(() => {
  handle = createCanvasGraph();
});
afterEach(async () => {
  await handle.dispose();
});

function mount(id: string, parentId: string | null, x: number, y: number) {
  handle.graph.registryOrch.mountPanel({ id, parentId, x, y, width: 50, height: 50 });
}

function memberIds(): string[] {
  const drag = handle.graph.gestureOrch.activeDrag();
  return drag ? Object.keys(drag.members).sort() : [];
}

describe("group drag", () => {
  it("dragging an unselected panel moves only that panel", () => {
    mount("a", null, 0, 0);
    mount("b", null, 100, 0);
    handle.graph.selectionOrch.set({ ids: [] });
    handle.graph.gestureOrch.beginDrag({
      panelId: "a",
      pointer: { x: 0, y: 0 },
      modifiers: noMods,
    });
    expect(memberIds()).toEqual(["a"]);
  });

  it("dragging one panel of a multi-selection moves the whole group", () => {
    mount("a", null, 0, 0);
    mount("b", null, 100, 0);
    mount("c", null, 200, 0);
    handle.graph.selectionOrch.set({ ids: ["a", "b"] });
    handle.graph.gestureOrch.beginDrag({
      panelId: "a",
      pointer: { x: 0, y: 0 },
      modifiers: noMods,
    });
    expect(memberIds()).toEqual(["a", "b"]);
    expect(handle.graph.gestureOrch.isPanelDragging("b")()).toBe(true);
    expect(handle.graph.gestureOrch.isPanelDragging("c")()).toBe(false);
  });

  it("dragging a non-selected panel ignores the existing selection", () => {
    mount("a", null, 0, 0);
    mount("b", null, 100, 0);
    handle.graph.selectionOrch.set({ ids: ["b"] });
    handle.graph.gestureOrch.beginDrag({
      panelId: "a",
      pointer: { x: 0, y: 0 },
      modifiers: noMods,
    });
    expect(memberIds()).toEqual(["a"]);
  });

  it("a selected descendant rides along instead of double-moving", () => {
    mount("parent", null, 0, 0);
    mount("child", "parent", 10, 10);
    handle.graph.selectionOrch.set({ ids: ["parent", "child"] });
    handle.graph.gestureOrch.beginDrag({
      panelId: "parent",
      pointer: { x: 0, y: 0 },
      modifiers: noMods,
    });
    expect(memberIds()).toEqual(["parent"]);
  });

  it("grabbing a child whose parent is also selected drives the drag from the parent", () => {
    mount("parent", null, 0, 0);
    mount("child", "parent", 10, 10);
    handle.graph.selectionOrch.set({ ids: ["parent", "child"] });
    handle.graph.gestureOrch.beginDrag({
      panelId: "child",
      pointer: { x: 0, y: 0 },
      modifiers: noMods,
    });
    expect(memberIds()).toEqual(["parent"]);
  });

  it("each member's raw proposal starts at its current box", () => {
    mount("a", null, 5, 7);
    handle.graph.gestureOrch.beginDrag({
      panelId: "a",
      pointer: { x: 0, y: 0 },
      modifiers: noMods,
    });
    expect(handle.graph.gestureOrch.rawProposedFor("a")()).toEqual({
      gesture: "drag",
      raw: { x: 5, y: 7, width: 50, height: 50 },
    });
  });
});
