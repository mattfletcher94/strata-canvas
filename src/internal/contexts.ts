import type { ComputedRef, Ref } from "vue";
import type { Box, HandlePosition, Point, Rect } from "@/types";
import type { EasingFn, EasingName } from "@/easing";
import { createContext } from "@/shared/createContext";
import type { CanvasGraphHandle } from "@/internal/createCanvasGraph";

export interface ViewportState {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export type Padding =
  | number
  | {
      readonly top: number;
      readonly right: number;
      readonly bottom: number;
      readonly left: number;
    };

export interface AnimateOptions {
  /** Animation duration in ms. 0 = instant (no animation). Default 0. */
  readonly duration?: number;
  /** Easing name or function. Default "easeOutCubic". */
  readonly easing?: EasingName | EasingFn;
  /** AbortSignal to cancel the animation early. */
  readonly signal?: AbortSignal;
}

export interface FitOptions extends AnimateOptions {
  /** Screen-pixel padding around the fitted content. Default 40. */
  readonly padding?: Padding;
  /**
   * Clamp final zoom to a maximum. Defaults to the viewport's configured
   * `zoom.max`. Use this to prevent fitting a small panel from zooming in
   * too far ("fit but never zoom past current": pass `canvas.zoom.value`).
   */
  readonly maxZoom?: number;
}

export type FitTarget = "all" | PanelContext | readonly PanelContext[] | Rect | (() => Rect);

export type CenterTarget = PanelContext | Point | Rect;

export interface CanvasContext {
  /** Internal handle to the underlying Strata graph. Not part of the public API. */
  readonly _handle: CanvasGraphHandle;

  // Reactive viewport state
  readonly viewport: Readonly<Ref<ViewportState>>;
  readonly zoom: ComputedRef<number>;
  readonly mode: ComputedRef<"infinite" | "finite">;
  readonly bounds: ComputedRef<Rect | null>;

  // Selection
  readonly selection: Readonly<Ref<readonly string[]>>;

  // Imperative viewport ops (instant)
  pan(dx: number, dy: number): void;
  zoomTo(zoom: number, around?: Point): void;
  setViewport(state: ViewportState): void;
  screenToWorld(p: Point): Point;
  worldToScreen(p: Point): Point;

  // Animated viewport ops
  fitTo(target?: FitTarget, options?: FitOptions): Promise<void>;
  centerOn(target: CenterTarget, options?: AnimateOptions): Promise<void>;
  animateViewport(target: Partial<ViewportState>, options?: AnimateOptions): Promise<void>;
  stopAnimation(): void;

  // Selection commands
  select(id: string, opts?: { additive?: boolean }): void;
  deselect(id: string): void;
  clearSelection(): void;
  setSelection(ids: readonly string[]): void;
  /**
   * Whether a pointer event carries the additive-selection modifier configured
   * on the `select()` control (default shift). Used internally by panels so
   * drag/resize-begin selection honours the same modifier as body clicks.
   */
  isAdditiveSelectEvent(e: {
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  }): boolean;

  // Gesture cooperation (tldraw-style)
  markEventAsHandled(e: Event): void;
  isHandled(e: Event): boolean;

  rootElement: Readonly<Ref<HTMLElement | null>>;
  /** Sibling layer rendered outside the canvas's pan/zoom transform — fixed panels teleport here. */
  overlayLayer: Readonly<Ref<HTMLElement | null>>;
}

export interface PanelContext {
  readonly id: string;
  readonly state: ComputedRef<Box>;
  readonly worldPosition: ComputedRef<Point>;
  readonly parent: PanelContext | null;
  readonly isDragging: ComputedRef<boolean>;
  readonly isResizing: ComputedRef<boolean>;
  readonly isSelected: ComputedRef<boolean>;
  readonly disabled: ComputedRef<boolean>;
  beginDrag(e: PointerEvent): void;
  beginResize(e: PointerEvent, handle: HandlePosition): void;
  select(opts?: { additive?: boolean }): void;
  update(patch: Partial<Box>): void;
  /**
   * Re-run the constraint pipeline against the panel's current box. If the
   * current state would violate any constraint (e.g. content grew past
   * parent's bounds), the panel snaps to the nearest legal position/size.
   *
   * Most consumers won't need this — Panel.vue auto-recalculates whenever
   * v-model, parent state, viewport, or constraint props change. Useful when
   * constraints depend on data Vue can't observe reactively.
   */
  recalc(): void;
}

export const [injectCanvasContext, provideCanvasContext] =
  createContext<CanvasContext>("Canvas.Root");

export const [injectPanelContext, providePanelContext] =
  createContext<PanelContext>("Canvas.Panel");
