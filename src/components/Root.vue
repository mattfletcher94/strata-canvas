<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, shallowRef, watch } from "vue";
import type { Point, Rect } from "@/types";
import { createCanvasGraph } from "@/internal/createCanvasGraph";
import {
  type AnimateOptions,
  type CanvasContext,
  type CenterTarget,
  type FitOptions,
  type FitTarget,
  type Padding,
  type PanelContext,
  type ViewportState,
  provideCanvasContext,
} from "@/internal/contexts";
import { useStrataQuery } from "@/internal/useStrataQuery";
import type { ViewportConfig } from "@/internal/stores/viewport";
import type { Control, ControlContext, PointerSession } from "@/controls/types";
import { anyModifierHeld } from "@/controls/types";
import { defaultControls } from "@/controls";
import type { SelectControl } from "@/controls/select";
import { nearestPanelEl, nearestPanelId } from "@/controls/hitTest";
import { resolveEasing } from "@/easing";

interface RootProps {
  config?: Partial<ViewportConfig>;
  /** Composable user-interaction controls. Omit for `defaultControls()`. */
  controls?: readonly Control[];
}

const props = defineProps<RootProps>();

const viewport = defineModel<{ x: number; y: number; zoom: number } | undefined>("viewport");
const selection = defineModel<readonly string[]>("selection", { default: () => [] });

const handle = createCanvasGraph({ config: props.config });
const graph = handle.graph;

const rootEl = shallowRef<HTMLElement | null>(null);
const overlayEl = shallowRef<HTMLElement | null>(null);
const handledEvents = new WeakSet<Event>();
// Reactive Set so the `cursor` computed re-runs when keys are pressed/released.
const keysHeld = reactive(new Set<string>());

const viewportRef = useStrataQuery(graph.viewportOrch.snapshot);
const selectionRef = useStrataQuery(graph.selectionOrch.selectedIds);
const zoomRef = useStrataQuery(graph.viewportOrch.zoom);
const modeRef = useStrataQuery(graph.viewportOrch.mode);
const boundsRef = useStrataQuery(graph.viewportOrch.bounds);
const activePanRef = useStrataQuery(graph.gestureOrch.activePan);

if (viewport.value !== undefined) graph.viewportOrch.setViewport(viewport.value);
watch(
  () => viewport.value,
  (next) => {
    if (!next) return;
    const cur = graph.viewportOrch.snapshot();
    if (cur.x !== next.x || cur.y !== next.y || cur.zoom !== next.zoom) {
      graph.viewportOrch.setViewport(next);
    }
  },
  { deep: true },
);
watch(viewportRef, (next) => {
  if (viewport.value === undefined) return;
  const cur = viewport.value;
  if (cur.x !== next.x || cur.y !== next.y || cur.zoom !== next.zoom) {
    viewport.value = { x: next.x, y: next.y, zoom: next.zoom };
  }
});

watch(
  () => selection.value,
  (next) => {
    const cur = graph.selectionOrch.selectedIds();
    if (next.length !== cur.length || next.some((id, i) => id !== cur[i])) {
      graph.selectionOrch.set({ ids: next });
    }
  },
  { deep: true },
);
watch(selectionRef, (next) => {
  const cur = selection.value;
  if (next.length !== cur.length || next.some((id, i) => id !== cur[i])) {
    selection.value = [...next];
  }
});

function screenToContainer(p: Point): Point {
  const el = rootEl.value;
  if (!el) return p;
  const box = el.getBoundingClientRect();
  return { x: p.x - box.left, y: p.y - box.top };
}
function screenToWorld(p: Point): Point {
  return graph.viewportOrch.screenToWorld(screenToContainer(p))();
}
function worldToScreen(p: Point): Point {
  const container = graph.viewportOrch.worldToScreen(p)();
  const el = rootEl.value;
  if (!el) return container;
  const box = el.getBoundingClientRect();
  return { x: container.x + box.left, y: container.y + box.top };
}

// ─── Animation runner ────────────────────────────────────────────────────
// The graph's `animations` store holds the active request (corrId, from, to,
// duration, easingTable, startTime). Per-frame dispatch lives here because
// rAF is browser timing — naturally a UI-layer concern. State stays in strata.

function normalizePadding(p: Padding): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  return p;
}

function precomputeEasingTable(fn: (t: number) => number, samples = 100): readonly number[] {
  const out = new Array<number>(samples + 1);
  for (let i = 0; i <= samples; i++) out[i] = fn(i / samples);
  return out;
}

function evalEasingTable(table: readonly number[], t: number): number {
  if (t <= 0) return table[0];
  if (t >= 1) return table[table.length - 1];
  const pos = t * (table.length - 1);
  const i = Math.floor(pos);
  const frac = pos - i;
  return table[i] + (table[i + 1] - table[i]) * frac;
}

function freshCorrId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveCenterPoint(target: CenterTarget): Point {
  if ("worldPosition" in target) {
    const wp = target.worldPosition.value;
    const s = target.state.value;
    return { x: wp.x + s.width / 2, y: wp.y + s.height / 2 };
  }
  if ("minX" in target) {
    return { x: (target.minX + target.maxX) / 2, y: (target.minY + target.maxY) / 2 };
  }
  return target;
}

function rectFromPanel(p: PanelContext): Rect {
  const wp = p.worldPosition.value;
  const s = p.state.value;
  return { minX: wp.x, minY: wp.y, maxX: wp.x + s.width, maxY: wp.y + s.height };
}

function unionRects(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = rects[0].minX;
  let minY = rects[0].minY;
  let maxX = rects[0].maxX;
  let maxY = rects[0].maxY;
  for (let i = 1; i < rects.length; i++) {
    const r = rects[i];
    if (r.minX < minX) minX = r.minX;
    if (r.minY < minY) minY = r.minY;
    if (r.maxX > maxX) maxX = r.maxX;
    if (r.maxY > maxY) maxY = r.maxY;
  }
  return { minX, minY, maxX, maxY };
}

function resolveFitRect(target: FitTarget | undefined): Rect | null {
  const t = target ?? "all";
  if (t === "all") return graph.registryOrch.worldBoundsAll();
  if (typeof t === "function") return t();
  if ("minX" in t) return t;
  if (Array.isArray(t)) {
    return unionRects((t as readonly PanelContext[]).map(rectFromPanel));
  }
  return rectFromPanel(t as PanelContext);
}

function viewportForFit(
  rect: Rect,
  padding: Padding,
  maxZoomOverride: number | undefined,
): ViewportState | null {
  const el = rootEl.value;
  if (!el) return null;
  const p = normalizePadding(padding);
  const containerW = el.clientWidth;
  const containerH = el.clientHeight;
  const contentW = rect.maxX - rect.minX;
  const contentH = rect.maxY - rect.minY;
  const availW = containerW - p.left - p.right;
  const availH = containerH - p.top - p.bottom;
  if (contentW <= 0 || contentH <= 0 || availW <= 0 || availH <= 0) return null;
  const config = graph.viewportOrch.config();
  const fitZoom = Math.min(availW / contentW, availH / contentH);
  const maxZ = maxZoomOverride ?? config.zoom.max;
  const targetZoom = Math.max(config.zoom.min, Math.min(maxZ, fitZoom));
  const contentScreenW = contentW * targetZoom;
  const contentScreenH = contentH * targetZoom;
  const offsetX = p.left + (availW - contentScreenW) / 2;
  const offsetY = p.top + (availH - contentScreenH) / 2;
  return {
    x: offsetX - rect.minX * targetZoom,
    y: offsetY - rect.minY * targetZoom,
    zoom: targetZoom,
  };
}

function viewportForCenter(target: CenterTarget): ViewportState | null {
  const el = rootEl.value;
  if (!el) return null;
  const point = resolveCenterPoint(target);
  const zoom = graph.viewportOrch.zoom();
  return {
    x: el.clientWidth / 2 - point.x * zoom,
    y: el.clientHeight / 2 - point.y * zoom,
    zoom,
  };
}

let activeRaf: number | null = null;
let activeOnAbort: ((reason: unknown) => void) | null = null;

function stopAnimation(): void {
  if (activeRaf !== null) {
    cancelAnimationFrame(activeRaf);
    activeRaf = null;
  }
  graph.animationOrch.cancel();
  if (activeOnAbort) {
    const fn = activeOnAbort;
    activeOnAbort = null;
    fn(new DOMException("aborted", "AbortError"));
  }
}

function animateViewport(
  target: Partial<ViewportState>,
  options: AnimateOptions = {},
): Promise<void> {
  stopAnimation();

  const from = graph.viewportOrch.snapshot();
  const to: ViewportState = {
    x: target.x ?? from.x,
    y: target.y ?? from.y,
    zoom: target.zoom ?? from.zoom,
  };

  const duration = options.duration ?? 0;
  if (duration <= 0 || (from.x === to.x && from.y === to.y && from.zoom === to.zoom)) {
    graph.viewportOrch.setViewport(to);
    return Promise.resolve();
  }

  const easingFn = resolveEasing(options.easing ?? "easeOutCubic");
  const easingTable = precomputeEasingTable(easingFn);
  const corrId = freshCorrId();
  const startTime = performance.now();

  graph.animationOrch.start({ corrId, from, to, duration, easingTable, startTime });

  return new Promise<void>((resolve, reject) => {
    activeOnAbort = reject;

    const externalAbort = options.signal;
    const externalListener = externalAbort ? () => stopAnimation() : null;
    if (externalAbort && externalListener) {
      externalAbort.addEventListener("abort", externalListener);
    }

    function cleanup() {
      if (externalAbort && externalListener) {
        externalAbort.removeEventListener("abort", externalListener);
      }
      if (activeOnAbort === reject) activeOnAbort = null;
    }

    function tick(now: number) {
      const active = graph.animationOrch.active();
      if (!active || active.corrId !== corrId) {
        // Cancelled/superseded by another animation or external abort.
        activeRaf = null;
        cleanup();
        reject(new DOMException("aborted", "AbortError"));
        return;
      }
      const elapsed = now - active.startTime;
      const t = Math.min(1, elapsed / active.duration);
      const eased = evalEasingTable(active.easingTable, t);
      graph.viewportOrch.setViewport({
        x: active.from.x + (active.to.x - active.from.x) * eased,
        y: active.from.y + (active.to.y - active.from.y) * eased,
        zoom: active.from.zoom + (active.to.zoom - active.from.zoom) * eased,
      });
      if (t >= 1) {
        graph.animationOrch.finish({ corrId });
        activeRaf = null;
        cleanup();
        resolve();
        return;
      }
      activeRaf = requestAnimationFrame(tick);
    }

    activeRaf = requestAnimationFrame(tick);
  });
}

function fitTo(target?: FitTarget, options: FitOptions = {}): Promise<void> {
  const rect = resolveFitRect(target);
  if (!rect) return Promise.resolve();
  const targetVp = viewportForFit(rect, options.padding ?? 40, options.maxZoom);
  if (!targetVp) return Promise.resolve();
  return animateViewport(targetVp, options);
}

function centerOn(target: CenterTarget, options: AnimateOptions = {}): Promise<void> {
  const targetVp = viewportForCenter(target);
  if (!targetVp) return Promise.resolve();
  return animateViewport(targetVp, options);
}

const ctx: CanvasContext = {
  _handle: handle,
  viewport: viewportRef,
  zoom: computed(() => zoomRef.value),
  mode: computed(() => modeRef.value),
  bounds: computed(() => boundsRef.value as Rect | null),
  selection: selectionRef,
  pan: (dx, dy) => graph.viewportOrch.pan({ dx, dy }),
  zoomTo: (z, around) => graph.viewportOrch.zoomTo({ zoom: z, around }),
  setViewport: (s) => graph.viewportOrch.setViewport(s),
  screenToWorld,
  worldToScreen,
  fitTo,
  centerOn,
  animateViewport,
  stopAnimation,
  select: (id, opts) => graph.selectionOrch.select({ id, additive: opts?.additive ?? false }),
  deselect: (id) => graph.selectionOrch.deselect({ id }),
  clearSelection: () => graph.selectionOrch.clear(),
  setSelection: (ids) => graph.selectionOrch.set({ ids }),
  isAdditiveSelectEvent: (e) => {
    const sel = sortedControls.value.find((c) => c.id === "select") as SelectControl | undefined;
    return anyModifierHeld(e, sel?.additiveModifiers ?? []);
  },
  markEventAsHandled: (e) => handledEvents.add(e),
  isHandled: (e) => handledEvents.has(e),
  rootElement: rootEl,
  overlayLayer: overlayEl,
};

provideCanvasContext(ctx);

defineExpose({
  /** The canvas context — same value `useCanvas()` returns to descendants. */
  canvas: ctx,
});

// ─── Control dispatch ────────────────────────────────────────────────────
const controlCtx: ControlContext = {
  graph,
  screenToWorld,
  worldToScreen,
  rootElement: rootEl.value,
  isKeyHeld: (key) => keysHeld.has(key),
  markHandled: (e) => handledEvents.add(e),
  isHandled: (e) => handledEvents.has(e),
  panelAt: (e) => nearestPanelId(e),
  isOnPanel: (e) => nearestPanelEl(e) !== null,
};
// rootElement needs to be live-readable; redefine via accessor.
Object.defineProperty(controlCtx, "rootElement", { get: () => rootEl.value });

const sortedControls = computed(() => {
  const list = props.controls ?? defaultControls();
  return [...list].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
});

let activeSession: PointerSession | null = null;
let activePointerId: number | null = null;

function onWheel(e: WheelEvent) {
  for (const c of sortedControls.value) {
    if (!c.onWheel) continue;
    if (c.onWheel(e, controlCtx)) break;
  }
}

function onPointerDown(e: PointerEvent) {
  if (activeSession) return;
  for (const c of sortedControls.value) {
    if (!c.onPointerDown) continue;
    const session = c.onPointerDown(e, controlCtx);
    if (session !== false) {
      activeSession = session;
      activePointerId = e.pointerId;
      break;
    }
  }
}

function onPointerMove(e: PointerEvent) {
  if (!activeSession || e.pointerId !== activePointerId) return;
  activeSession.onMove?.(e, controlCtx);
}

function endSession(e: PointerEvent) {
  if (!activeSession || e.pointerId !== activePointerId) return;
  activeSession.onUp?.(e, controlCtx);
  activeSession = null;
  activePointerId = null;
}

function cancelSession(e: PointerEvent) {
  if (!activeSession || e.pointerId !== activePointerId) return;
  activeSession.onCancel?.(controlCtx);
  activeSession = null;
  activePointerId = null;
}

function isTextInputActive(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
}

function onKeyDown(e: KeyboardEvent) {
  if (isTextInputActive()) return;
  // Track key state for any control that gates on a held key.
  const k = e.code || e.key;
  keysHeld.add(k);
  if (k === "Space" || e.key === " ") {
    keysHeld.add("Space");
    e.preventDefault();
  }
  for (const c of sortedControls.value) {
    if (c.onKeyDown?.(e, controlCtx) === true) break;
  }
}

function onKeyUp(e: KeyboardEvent) {
  const k = e.code || e.key;
  keysHeld.delete(k);
  if (k === "Space" || e.key === " ") keysHeld.delete("Space");
  for (const c of sortedControls.value) {
    if (c.onKeyUp?.(e, controlCtx) === true) break;
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", endSession, { passive: true });
  window.addEventListener("pointercancel", cancelSession, { passive: true });
});
onBeforeUnmount(async () => {
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", endSession);
  window.removeEventListener("pointercancel", cancelSession);
  await handle.dispose();
});

// ─── Cursor ──────────────────────────────────────────────────────────────
const cursor = computed(() => {
  if (activePanRef.value) return "grabbing";
  if (keysHeld.has("Space")) return "grab";
  return "default";
});

const transform = computed(() => {
  const v = viewportRef.value;
  return `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
});
</script>

<template>
  <div
    ref="rootEl"
    data-canvas-root
    :style="{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      touchAction: 'none',
      userSelect: 'none',
      cursor,
    }"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
  >
    <div
      data-canvas-content
      :style="{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        transformOrigin: '0 0',
        transform,
        willChange: 'transform',
      }"
    >
      <slot />
    </div>
    <div
      ref="overlayEl"
      data-canvas-overlay-layer
      :style="{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }"
    />
  </div>
</template>
