import type { Component } from "vue";
import Root from "@/components/Root.vue";
import Panel from "@/components/Panel.vue";
import DragHandle from "@/components/DragHandle.vue";
import Background from "@/components/Background.vue";
import PassThrough from "@/components/PassThrough.vue";
import {
  ResizeHandleN,
  ResizeHandleE,
  ResizeHandleS,
  ResizeHandleW,
  ResizeHandleNE,
  ResizeHandleNW,
  ResizeHandleSE,
  ResizeHandleSW,
} from "@/components/resizeHandles";
import {
  injectCanvasContext,
  injectPanelContext,
  type CanvasContext,
  type PanelContext,
} from "@/internal/contexts";

export interface CreateCanvasOptions {
  // Reserved for future factory-level options (e.g. typed component generics).
  // Public viewport options live on `<Canvas.Root :config="...">`.
}

export interface CanvasNamespace {
  readonly Root: Component;
  readonly Background: Component;
  readonly Panel: Component;
  readonly DragHandle: Component;
  readonly ResizeHandleN: Component;
  readonly ResizeHandleE: Component;
  readonly ResizeHandleS: Component;
  readonly ResizeHandleW: Component;
  readonly ResizeHandleNE: Component;
  readonly ResizeHandleNW: Component;
  readonly ResizeHandleSE: Component;
  readonly ResizeHandleSW: Component;
  readonly PassThrough: Component;
  readonly useCanvas: () => CanvasContext;
  readonly usePanel: () => PanelContext;
}

/**
 * Create a Canvas namespace — a frozen object containing all the compound
 * components plus typed `useCanvas` / `usePanel` composables.
 *
 * Multiple calls return independent namespaces; render each namespace's
 * `Root` inside a different DOM subtree to host multiple canvases.
 */
export function createCanvas(_options: CreateCanvasOptions = {}): CanvasNamespace {
  return Object.freeze({
    Root,
    Background,
    Panel,
    DragHandle,
    ResizeHandleN,
    ResizeHandleE,
    ResizeHandleS,
    ResizeHandleW,
    ResizeHandleNE,
    ResizeHandleNW,
    ResizeHandleSE,
    ResizeHandleSW,
    PassThrough,
    useCanvas: injectCanvasContext,
    usePanel: injectPanelContext,
  });
}

export { injectCanvasContext as useCanvas, injectPanelContext as usePanel };
