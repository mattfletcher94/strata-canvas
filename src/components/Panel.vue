<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import type { Box, HandlePosition, KeyboardModifiers, Point, Rect } from "@/types";
import { Primitive } from "@/primitives";
import {
  injectCanvasContext,
  injectPanelContext,
  providePanelContext,
  type PanelContext,
} from "@/internal/contexts";
import { useStrataQuery } from "@/internal/useStrataQuery";
import { boxEqual } from "@/utils";
import { type BoundsValue, panelToBox, runPipeline, viewportToRect } from "@/internal/pipeline";
import type { ResolveFn } from "@/types";

// Teleport is our template root — disable Vue's auto attribute inheritance
// so consumer-passed attrs (style, class, data-*) land on the Primitive
// instead of being silently dropped on the Teleport meta-component.
defineOptions({ inheritAttrs: false });

interface PanelProps {
  bounds?: BoundsValue;
  resolve?: ResolveFn;
  disabled?: boolean;
  selectable?: boolean;
  z?: number;
  as?: string | object;
  asChild?: boolean;
  /**
   * Pin this panel to screen space — it renders outside the canvas's
   * pan/zoom transform. v-model x/y are screen pixels (relative to canvas
   * root). Still fully interactive (drag/resize/etc) — just in screen coords.
   *
   * When true, the panel is treated as registry-root (no logical parent).
   */
  fixed?: boolean;
}

const props = withDefaults(defineProps<PanelProps>(), {
  disabled: false,
  selectable: true,
  as: "div",
  asChild: false,
});

const modelValue = defineModel<Box>({ required: true });

const canvas = injectCanvasContext();
const parentCtx = (() => {
  try {
    return injectPanelContext();
  } catch {
    return null;
  }
})();
const parentId = parentCtx?.id ?? null;

const graph = canvas._handle.graph;

const id = (() => {
  // Vue 3 `useId()` would suffice but we want to be SSR-safe without importing.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `p-${crypto.randomUUID()}`;
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
})();

// Mount into graph. When fixed, registry-parent is null regardless of template.
onMounted(() => {
  graph.registryOrch.mountPanel({
    id,
    parentId: props.fixed ? null : parentId,
    x: modelValue.value.x,
    y: modelValue.value.y,
    width: modelValue.value.width,
    height: modelValue.value.height,
  });
});

// Toggle registry parent when :fixed changes at runtime.
watch(
  () => props.fixed,
  (isFixed) => {
    graph.registryOrch.reparent({ id, newParentId: isFixed ? null : parentId });
  },
);

onBeforeUnmount(() => {
  graph.registryOrch.unmountPanel({ id });
});

// Reactive bridges
const panelRow = useStrataQuery(() => graph.registryOrch.byId(id));
const dragForPanel = useStrataQuery(() => graph.gestureOrch.dragFor(id));
const resizeForPanel = useStrataQuery(() => graph.gestureOrch.resizeFor(id));
const isSelected = useStrataQuery(() => graph.selectionOrch.isSelected(id));

// Sync consumer ref → graph (when v-model changes externally). Commits the
// raw value; the bridge above + reflowToConstraints (defined below) will
// re-clamp on the next tick if the new value violates a constraint.
watch(
  () => modelValue.value,
  (next) => {
    const row = graph.registryOrch.byId(id)();
    if (!row) return;
    if (
      row.x === next.x &&
      row.y === next.y &&
      row.width === next.width &&
      row.height === next.height
    ) {
      return;
    }
    graph.registryOrch.commitPanelState({
      id,
      x: next.x,
      y: next.y,
      width: next.width,
      height: next.height,
    });
    reflowToConstraints();
  },
  { deep: true },
);

// Sync graph → consumer ref
watch(panelRow, (row) => {
  if (!row) return;
  const cur = modelValue.value;
  if (cur.x === row.x && cur.y === row.y && cur.width === row.width && cur.height === row.height) {
    return;
  }
  modelValue.value = { x: row.x, y: row.y, width: row.width, height: row.height };
});

// Compute the viewport rect (world coords) — for pipeline ctx
function currentViewportRect(): Rect {
  const el = canvas.rootElement.value;
  const v = canvas.viewport.value;
  if (!el) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return viewportToRect(v, { width: el.clientWidth, height: el.clientHeight });
}

// THE CONSTRAINT PIPELINE — runs on every gesture frame for this panel.
// Reads the raw proposed box from the gesture orchestrator, applies bounds
// + resolve using consumer's Vue props, dispatches a commit back to the graph.
const gestureFrame = useStrataQuery(() => graph.gestureOrch.rawProposedFor(id));
watch(gestureFrame, (frame) => {
  if (!frame) return;
  if (props.disabled) return;
  const row = panelRow.value;
  if (!row) return;

  // For fixed panels, parent reference is the viewport (not a panel).
  const parent = props.fixed ? null : parentId ? graph.registryOrch.byId(parentId)() : null;
  const siblings = props.fixed ? [] : graph.registryOrch.siblingsOf(id)();
  const pointer = pointerFromActiveGesture();
  const modifiers = modifiersFromActiveGesture();

  // Gesture orch computes proposed in world coords (screen-Δ / zoom) on top
  // of the panel's startBox (its box at gesture-start). For fixed panels
  // we want screen-Δ directly, so multiply the world-Δ back by zoom.
  // CRITICAL: base off `startBox` (constant for the whole gesture) NOT
  // `row` (mutates after each frame's commit, which would zero the delta).
  let proposed = frame.raw;
  if (props.fixed) {
    const drag = graph.gestureOrch.activeDrag();
    const resize = graph.gestureOrch.activeResize();
    const startBox =
      drag && drag.members[id]
        ? drag.members[id].startBox
        : resize && resize.panelId === id
          ? resize.startBox
          : null;
    if (startBox) {
      const z = canvas.zoom.value;
      proposed = {
        x: startBox.x + (frame.raw.x - startBox.x) * z,
        y: startBox.y + (frame.raw.y - startBox.y) * z,
        width:
          frame.gesture === "resize"
            ? startBox.width + (frame.raw.width - startBox.width) * z
            : startBox.width,
        height:
          frame.gesture === "resize"
            ? startBox.height + (frame.raw.height - startBox.height) * z
            : startBox.height,
      };
    }
  }

  const committed = runPipeline({
    proposed,
    currentBox: panelToBox(row),
    parent,
    siblings,
    viewport: currentViewportRect(),
    pointer,
    modifiers,
    gesture: frame.gesture,
    handle: "handle" in frame ? frame.handle : undefined,
    bounds: props.bounds,
    resolve: props.resolve,
  });

  if (!boxEqual(committed, panelToBox(row))) {
    graph.registryOrch.commitPanelState({
      id,
      x: committed.x,
      y: committed.y,
      width: committed.width,
      height: committed.height,
    });
  }
});

/**
 * Re-run the pipeline with the panel's current box. If anything would
 * violate a constraint, commits the corrected box. Called automatically by
 * reactive watchers below, and exposed on the panel context as `recalc()`
 * for consumer-driven re-validation (e.g. after content size changes).
 */
function reflowToConstraints(): void {
  if (props.disabled) return;
  if (graph.gestureOrch.isPanelDragging(id)() || graph.gestureOrch.isPanelResizing(id)()) {
    return;
  }
  const row = panelRow.value;
  if (!row) return;
  const parent = parentId ? graph.registryOrch.byId(parentId)() : null;
  const siblings = graph.registryOrch.siblingsOf(id)();
  const committed = runPipeline({
    proposed: panelToBox(row),
    currentBox: panelToBox(row),
    parent,
    siblings,
    viewport: currentViewportRect(),
    pointer: { x: 0, y: 0 },
    modifiers: { ctrl: false, shift: false, alt: false, meta: false },
    gesture: "drag",
    bounds: props.bounds,
    resolve: props.resolve,
  });
  if (!boxEqual(committed, panelToBox(row))) {
    graph.registryOrch.commitPanelState({
      id,
      x: committed.x,
      y: committed.y,
      width: committed.width,
      height: committed.height,
    });
  }
}

// REACTIVE CONSISTENCY — when parent/viewport/constraint-props change, re-clamp.
watch(
  [
    () => (parentCtx ? parentCtx.state.value : null),
    () => canvas.viewport.value,
    () => props.bounds,
    () => props.resolve,
  ],
  reflowToConstraints,
  { deep: true },
);

function pointerFromActiveGesture(): Point {
  const drag = graph.gestureOrch.activeDrag();
  if (drag) return canvas.screenToWorld(drag.currentPointer);
  const resize = graph.gestureOrch.activeResize();
  if (resize) return canvas.screenToWorld(resize.currentPointer);
  return { x: 0, y: 0 };
}

function modifiersFromActiveGesture(): KeyboardModifiers {
  const drag = graph.gestureOrch.activeDrag();
  if (drag) return drag.modifiers;
  const resize = graph.gestureOrch.activeResize();
  if (resize) return resize.modifiers;
  return { ctrl: false, shift: false, alt: false, meta: false };
}

// Panel context for descendants
const ctx: PanelContext = {
  id,
  state: computed(() =>
    panelToBox(panelRow.value ?? { id, parentId, x: 0, y: 0, width: 0, height: 0 }),
  ),
  worldPosition: computed(() => {
    // Walk ancestor chain
    let row = panelRow.value;
    let xSum = row ? row.x : 0;
    let ySum = row ? row.y : 0;
    let p = parentCtx;
    while (p) {
      const ps = p.state.value;
      xSum += ps.x;
      ySum += ps.y;
      p = p.parent;
    }
    return { x: xSum, y: ySum };
  }),
  parent: parentCtx,
  isDragging: computed(() => dragForPanel.value !== null),
  isResizing: computed(() => resizeForPanel.value !== null),
  isSelected: computed(() => isSelected.value),
  disabled: computed(() => props.disabled),
  beginDrag: (e) => {
    if (props.disabled) return;
    // Select before dragging. keepExisting=true so grabbing one panel of a
    // multi-selection drags the whole group rather than collapsing to it.
    if (props.selectable) {
      graph.selectionOrch.selectOnPointerDown({
        id,
        additive: canvas.isAdditiveSelectEvent(e),
        keepExisting: true,
      });
    }
    graph.gestureOrch.beginDrag({
      panelId: id,
      pointer: { x: e.clientX, y: e.clientY },
      modifiers: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey },
    });
  },
  beginResize: (e, handle: HandlePosition) => {
    if (props.disabled) return;
    // Resize is single-panel — collapse selection to the resized panel.
    if (props.selectable) {
      graph.selectionOrch.selectOnPointerDown({
        id,
        additive: canvas.isAdditiveSelectEvent(e),
      });
    }
    graph.gestureOrch.beginResize({
      panelId: id,
      handle,
      pointer: { x: e.clientX, y: e.clientY },
      modifiers: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey },
    });
  },
  select: (opts) => {
    if (!props.selectable) return;
    graph.selectionOrch.select({ id, additive: opts?.additive ?? false });
  },
  update: (patch) => {
    const row = graph.registryOrch.byId(id)();
    if (!row) return;
    graph.registryOrch.commitPanelState({
      id,
      x: patch.x ?? row.x,
      y: patch.y ?? row.y,
      width: patch.width ?? row.width,
      height: patch.height ?? row.height,
    });
  },
  recalc: reflowToConstraints,
};

providePanelContext(ctx);

const transform = computed(() => `translate(${modelValue.value.x}px, ${modelValue.value.y}px)`);
const size = computed(() => ({
  width: `${modelValue.value.width}px`,
  height: `${modelValue.value.height}px`,
}));
const zValue = computed(() => props.z);

// Body-click selection is handled by the `select()` control at Root, which
// hit-tests the innermost panel via DOM containment. Drag/resize handles
// stopPropagation, so they select via beginDrag/beginResize above instead.
const selectionOutline = computed(() =>
  isSelected.value ? "var(--strata-selection-outline, 2px solid #3b82f6)" : undefined,
);
const selectionOutlineOffset = computed(() =>
  isSelected.value ? "var(--strata-selection-outline-offset, 2px)" : undefined,
);
</script>

<template>
  <Teleport :to="canvas.overlayLayer.value" :disabled="!props.fixed || !canvas.overlayLayer.value">
    <Primitive
      v-bind="$attrs"
      :as="props.as"
      :as-child="props.asChild"
      data-canvas-panel
      :data-panel-id="id"
      :data-selectable="props.selectable ? undefined : 'false'"
      :data-dragging="ctx.isDragging.value || undefined"
      :data-resizing="ctx.isResizing.value || undefined"
      :data-selected="ctx.isSelected.value || undefined"
      :style="{
        position: 'absolute',
        top: 0,
        left: 0,
        transform,
        width: size.width,
        height: size.height,
        zIndex: zValue,
        touchAction: 'none',
        pointerEvents: 'auto',
        outline: selectionOutline,
        outlineOffset: selectionOutlineOffset,
      }"
    >
      <slot
        :id="id"
        :state="ctx.state.value"
        :isDragging="ctx.isDragging.value"
        :isResizing="ctx.isResizing.value"
        :isSelected="ctx.isSelected.value"
      />
    </Primitive>
  </Teleport>
</template>
