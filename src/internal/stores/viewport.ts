import { defineStore } from "@mattfletcher94/strata";
import type { Point, Rect } from "@/types";

export type ViewportMode = "infinite" | "finite";

/**
 * Viewport state config — bounded numeric ranges and panel-gesture thresholds.
 * Activation conditions for pan/zoom/marquee gestures live in the `controls`
 * prop on `<Canvas.Root>` and are NOT modelled here.
 */
export interface ViewportConfig {
  readonly zoom: {
    readonly min: number;
    readonly max: number;
    readonly default: number;
  };
  /** Px the pointer must travel before panel drag/resize gestures activate. */
  readonly dragActivationDistance: number;
}

const DEFAULT_CONFIG: ViewportConfig = {
  zoom: { min: 0.1, max: 4, default: 1 },
  dragActivationDistance: 4,
};

export const viewportStore = defineStore({
  name: "viewport",
  responsibility: "Canvas-wide pan, zoom, mode, bounds and configuration.",
  state: {
    x: 0,
    y: 0,
    zoom: 1,
    mode: "infinite" as ViewportMode,
    bounds: null as Rect | null,
    config: DEFAULT_CONFIG,
  },
  projections: {
    viewportPanned: (state, { dx, dy }: { dx: number; dy: number }) => ({
      ...state,
      x: state.x + dx,
      y: state.y + dy,
    }),
    viewportZoomed: (
      state,
      { zoom, around }: { zoom: number; around?: Point },
    ) => {
      const clamped = Math.max(state.config.zoom.min, Math.min(state.config.zoom.max, zoom));
      if (!around) return { ...state, zoom: clamped };
      // `around` is in WORLD coords. Keep that world point pinned to the
      // same on-screen position across the zoom change:
      //   screen = world * zoom + viewport
      // ⇒ newViewport = oldViewport + worldAround * (oldZoom - newZoom)
      return {
        ...state,
        zoom: clamped,
        x: state.x + around.x * (state.zoom - clamped),
        y: state.y + around.y * (state.zoom - clamped),
      };
    },
    viewportConfigured: (
      state,
      { config }: { config: Partial<ViewportConfig> },
    ) => ({
      ...state,
      config: {
        ...state.config,
        ...config,
        zoom: { ...state.config.zoom, ...(config.zoom ?? {}) },
      },
    }),
    viewportSet: (
      state,
      { x, y, zoom }: { x: number; y: number; zoom: number },
    ) => ({ ...state, x, y, zoom }),
    viewportModeChanged: (
      state,
      { mode, bounds }: { mode: ViewportMode; bounds: Rect | null },
    ) => ({ ...state, mode, bounds }),
    viewportReset: (state) => ({
      ...state,
      x: 0,
      y: 0,
      zoom: state.config.zoom.default,
    }),
  },
  queries: (state) => ({
    x: () => state.x,
    y: () => state.y,
    zoom: () => state.zoom,
    mode: () => state.mode,
    bounds: () => state.bounds,
    config: () => state.config,
    snapshot: () => ({ x: state.x, y: state.y, zoom: state.zoom }),
  }),
});
