import { defineOrchestrator } from "@mattfletcher94/strata";
import type { Point, Rect } from "@/types";
import { viewportStore, type ViewportConfig, type ViewportMode } from "@/internal/stores/viewport";
import { registryStore } from "@/internal/stores/registry";

export const viewportOrch = defineOrchestrator({
  name: "viewportOrch",
  responsibility: "Pan, zoom, fit, coordinate conversions.",
  deps: { viewport: viewportStore, registry: registryStore },
  queries: (deps) => ({
    x: () => deps.viewport.x(),
    y: () => deps.viewport.y(),
    zoom: () => deps.viewport.zoom(),
    mode: () => deps.viewport.mode(),
    bounds: () => deps.viewport.bounds(),
    config: () => deps.viewport.config(),
    snapshot: () => deps.viewport.snapshot(),
    screenToWorld: (p: Point) => () => {
      const zoom = deps.viewport.zoom();
      const x = deps.viewport.x();
      const y = deps.viewport.y();
      return { x: (p.x - x) / zoom, y: (p.y - y) / zoom };
    },
    worldToScreen: (p: Point) => () => {
      const zoom = deps.viewport.zoom();
      const x = deps.viewport.x();
      const y = deps.viewport.y();
      return { x: p.x * zoom + x, y: p.y * zoom + y };
    },
  }),
  commands: (deps) => ({
    pan(input: { dx: number; dy: number }) {
      return { events: [deps.viewport.viewportPanned(input)] };
    },
    zoomTo(input: { zoom: number; around?: Point }) {
      return { events: [deps.viewport.viewportZoomed(input)] };
    },
    setViewport(input: { x: number; y: number; zoom: number }) {
      return { events: [deps.viewport.viewportSet(input)] };
    },
    configure(input: { config: Partial<ViewportConfig> }) {
      return { events: [deps.viewport.viewportConfigured(input)] };
    },
    setMode(input: { mode: ViewportMode; bounds: Rect | null }) {
      return { events: [deps.viewport.viewportModeChanged(input)] };
    },
    reset() {
      return { events: [deps.viewport.viewportReset({})] };
    },
    fitTo(input: { ids?: readonly string[] | "all"; padding?: number }) {
      const ids: readonly string[] | null =
        input.ids === "all" || input.ids === undefined
          ? null
          : Array.isArray(input.ids)
            ? input.ids
            : null;
      const panels =
        ids === null
          ? deps.registry.panelsList()
          : ids
              .map((id) => deps.registry.byId(id)())
              .filter((p): p is NonNullable<typeof p> => p !== null);
      if (panels.length === 0) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of panels) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x + p.width > maxX) maxX = p.x + p.width;
        if (p.y + p.height > maxY) maxY = p.y + p.height;
      }
      const padding = input.padding ?? 0;
      const contentW = maxX - minX + padding * 2;
      const contentH = maxY - minY + padding * 2;
      if (contentW === 0 || contentH === 0) return;
      const config = deps.viewport.config();
      // Use 1 zoom unless the union is larger than 1000 units (heuristic; the
      // viewport size in screen pixels isn't known here without a service).
      const targetZoom = Math.max(
        config.zoom.min,
        Math.min(config.zoom.max, Math.min(1000 / contentW, 1000 / contentH)),
      );
      return {
        events: [
          deps.viewport.viewportSet({
            x: -(minX - padding) * targetZoom,
            y: -(minY - padding) * targetZoom,
            zoom: targetZoom,
          }),
        ],
      };
    },
  }),
});
