<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import { createCanvas } from "@mattfletcher94/strata-canvas";
import {
  avoidSiblings,
  compose,
  restrictToParent,
  withPadding,
} from "@mattfletcher94/strata-canvas/constraints";

const Canvas = createCanvas();

const canvasRef = useTemplateRef<{ canvas: ReturnType<typeof Canvas.useCanvas> }>("canvasRef");

const viewport = ref({ x: 0, y: 0, zoom: 1 });

const parent = ref({ x: 100, y: 100, width: 400, height: 300 });
const childA = ref({ x: 20, y: 40, width: 120, height: 80 });
// Anchored to parent's bottom-left so growing content demos the auto-clamp.
const childB = ref({ x: 10, y: 230, width: 180, height: 60 });

const editableEl = useTemplateRef<HTMLElement>("editableEl");
let editableObserver: ResizeObserver | null = null;

onMounted(() => {
  editableObserver = new ResizeObserver(() => {
    const el = editableEl.value;
    if (!el) return;
    // Title bar (24) + content scrollHeight + 8px breathing room
    const next = Math.ceil(el.scrollHeight) + 24 + 8;
    if (next !== childB.value.height) {
      childB.value = { ...childB.value, height: next };
    }
  });
  if (editableEl.value) editableObserver.observe(editableEl.value);
});

onBeforeUnmount(() => {
  editableObserver?.disconnect();
});
const childC = ref({ x: 270, y: 40, width: 110, height: 70 });
const standalone = ref({ x: 600, y: 200, width: 180, height: 120 });

// Fixed panel — lives in screen coords, draggable, doesn't pan/zoom with canvas
const pinned = ref({ x: 24, y: 80, width: 200, height: 110 });

const paddedInsideParent = compose(restrictToParent, withPadding(10));
const paddedNoOverlap = compose(restrictToParent, withPadding(10), avoidSiblings);

function roundAll<T extends Record<string, number>>(obj: T): T {
  const out = {} as Record<string, number>;
  for (const k in obj) out[k] = Math.round(obj[k]);
  return out as T;
}

function fitAll() {
  // Per-side padding to clear the overlay chrome: top hint, bottom buttons,
  // bottom debug. Uniform padding would put content under the overlays.
  canvasRef.value?.canvas.fitTo("all", {
    duration: 400,
    padding: { top: 80, right: 60, bottom: 80, left: 60 },
  });
}
function resetView() {
  canvasRef.value?.canvas.animateViewport({ x: 0, y: 0, zoom: 1 }, { duration: 350 });
}
</script>

<template>
  <div class="shell">
    <Canvas.Root
      ref="canvasRef"
      v-model:viewport="viewport"
      class="canvas"
    >
      <Canvas.Panel
        v-model="parent"
        :style="{ background: '#3a3a3a', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }"
      >
        <Canvas.DragHandle class="title-bar">parent — drag me</Canvas.DragHandle>

        <Canvas.ResizeHandleSE />
        <Canvas.ResizeHandleE />
        <Canvas.ResizeHandleS />

        <Canvas.Panel
          v-model="childA"
          :resolve="paddedInsideParent"
          :style="{ background: '#5a8aff', borderRadius: '4px' }"
        >
          <Canvas.DragHandle class="content-pad">A (10px padding inside parent)</Canvas.DragHandle>
          <Canvas.ResizeHandleSE />
        </Canvas.Panel>

        <Canvas.Panel
          v-model="childB"
          :resolve="paddedInsideParent"
          :style="{ background: '#ff8a5a', borderRadius: '4px', overflow: 'hidden' }"
        >
          <Canvas.DragHandle class="mini-title">B — type below to grow</Canvas.DragHandle>
          <div
            ref="editableEl"
            contenteditable
            class="editable canvas-nokey"
            spellcheck="false"
          >Type or paste more text here. The panel grows in height and sticks to parent's bottom-left.</div>
          <Canvas.ResizeHandleSE />
        </Canvas.Panel>

        <Canvas.Panel
          v-model="childC"
          :resolve="paddedNoOverlap"
          :style="{ background: '#c97aff', borderRadius: '4px' }"
        >
          <Canvas.DragHandle class="content-pad">C (won't overlap A or B)</Canvas.DragHandle>
          <Canvas.ResizeHandleSE />
        </Canvas.Panel>
      </Canvas.Panel>

      <Canvas.Panel
        v-model="pinned"
        fixed
        :style="{ background: '#2a4a6a', color: '#eee', borderRadius: '6px', border: '1px solid #4a6a8a' }"
      >
        <Canvas.DragHandle class="mini-title">PINNED — screen space, drag me</Canvas.DragHandle>
        <div style="padding: 32px 10px 10px; font-size: 12px; line-height: 1.5;">
          I don't pan or zoom with the canvas. Try Ctrl+wheel or middle-drag — I stay put.
        </div>
        <Canvas.ResizeHandleSE />
      </Canvas.Panel>

      <Canvas.Panel
        v-model="standalone"
        :style="{ background: '#7eff7e', color: '#1a1a1a', borderRadius: '6px' }"
      >
        <Canvas.DragHandle class="content-pad-lg">standalone — no parent constraints</Canvas.DragHandle>
        <Canvas.ResizeHandleSE />
        <Canvas.ResizeHandleSW />
        <Canvas.ResizeHandleNE />
        <Canvas.ResizeHandleNW />
      </Canvas.Panel>
    </Canvas.Root>

    <div class="overlay overlay-bottom-left">
      <button class="btn" @click="fitAll">Fit all</button>
      <button class="btn" @click="resetView">Reset view (0,0,1)</button>
    </div>

    <pre class="overlay overlay-bottom-right debug">viewport:   {{ roundAll(viewport) }}
parent:     {{ roundAll(parent) }}
childA:     {{ roundAll(childA) }}
childB:     {{ roundAll(childB) }}
childC:     {{ roundAll(childC) }}
standalone: {{ roundAll(standalone) }}</pre>

    <div class="overlay overlay-top-left hint">
      <strong>Controls:</strong><br />
      Ctrl+wheel: zoom &nbsp;·&nbsp; Middle drag: pan<br />
      Space+drag: pan &nbsp;·&nbsp; Drag corners: resize
    </div>
  </div>
</template>

<style>
.shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.canvas {
  position: absolute;
  inset: 0;
  background: #222;
}
.overlay {
  position: absolute;
  z-index: 100;
}
.overlay-bottom-left { bottom: 12px; left: 12px; display: flex; gap: 8px; }
.overlay-bottom-right { bottom: 12px; right: 12px; pointer-events: none; }
.overlay-top-left { top: 12px; left: 12px; pointer-events: none; }
.btn {
  padding: 6px 12px;
  background: #3a3a3a;
  color: #eee;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}
.btn:hover { background: #4a4a4a; }
.debug {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 11px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #ddd;
  border-radius: 4px;
  margin: 0;
}
.hint {
  font-size: 11px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.6);
  color: #ddd;
  border-radius: 4px;
  line-height: 1.5;
}
.title-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 28px;
  background: #4a4a4a;
  border-radius: 6px 6px 0 0;
  padding: 0 8px;
  display: flex;
  align-items: center;
  font-size: 12px;
}
.content-pad { position: absolute; inset: 0; padding: 8px; }
.mini-title {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 24px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  color: #1a1a1a;
  background: rgba(0, 0, 0, 0.12);
  cursor: grab;
}
.editable {
  position: absolute;
  top: 24px; left: 0; right: 0;
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.4;
  color: #1a1a1a;
  outline: none;
  cursor: text;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.editable:focus { background: rgba(255, 255, 255, 0.15); }
.content-pad-lg { position: absolute; inset: 0; padding: 12px; }
</style>
