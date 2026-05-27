import { type Control, defineControl } from "./types";

export interface PassthroughRegionsOptions {
  /** Default 1000 — runs before all standard controls. */
  readonly priority?: number;
}

/**
 * Blocks canvas controls inside `<Canvas.PassThrough>` regions.
 *
 * On pointer/wheel: walks the event target's ancestor chain looking for an
 * element with `data-canvas-passthrough-id`. If the registered region blocks
 * the matching event kind, claim the event.
 *
 * On keyboard: walks `document.activeElement`'s ancestor chain (since key
 * events target the focused element, not the hovered one).
 */
export function passthroughRegions(options: PassthroughRegionsOptions = {}): Control {
  return defineControl({
    id: "passthroughRegions",
    priority: options.priority ?? 1000,
    onPointerDown(e, ctx) {
      const ptId = findPassthroughAncestor(e.target as Element | null);
      if (!ptId) return false;
      if (!ctx.graph.passthroughOrch.blocks(ptId, "pointer")()) return false;
      return {}; // claim — no session work, just block other controls
    },
    onWheel(e, ctx) {
      const ptId = findPassthroughAncestor(e.target as Element | null);
      if (!ptId) return false;
      return ctx.graph.passthroughOrch.blocks(ptId, "wheel")();
    },
    onKeyDown(_e, ctx) {
      const focus = typeof document !== "undefined" ? document.activeElement : null;
      const ptId = findPassthroughAncestor(focus);
      if (!ptId) return false;
      return ctx.graph.passthroughOrch.blocks(ptId, "keyboard")();
    },
    onKeyUp(_e, ctx) {
      const focus = typeof document !== "undefined" ? document.activeElement : null;
      const ptId = findPassthroughAncestor(focus);
      if (!ptId) return false;
      return ctx.graph.passthroughOrch.blocks(ptId, "keyboard")();
    },
  });
}

function findPassthroughAncestor(start: Element | null): string | null {
  let el: Element | null = start;
  while (el) {
    if (el.hasAttribute?.("data-canvas-passthrough-id")) {
      return el.getAttribute("data-canvas-passthrough-id");
    }
    el = el.parentElement;
  }
  return null;
}
