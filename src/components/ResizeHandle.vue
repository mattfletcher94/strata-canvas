<script setup lang="ts">
import { Primitive } from "@/primitives";
import type { HandlePosition } from "@/types";
import { injectPanelContext } from "@/internal/contexts";

interface ResizeHandleProps {
  position: HandlePosition;
  as?: string | object;
  asChild?: boolean;
}

const props = withDefaults(defineProps<ResizeHandleProps>(), {
  as: "div",
  asChild: false,
});

const panel = injectPanelContext();

const CURSOR: Record<HandlePosition, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

function onPointerDown(e: PointerEvent) {
  if (panel.disabled.value) return;
  e.preventDefault();
  e.stopPropagation();
  panel.beginResize(e, props.position);
}

function positionStyle(p: HandlePosition): Record<string, string> {
  const size = "10px";
  const halfNeg = "-5px";
  const map: Record<HandlePosition, Record<string, string>> = {
    n: { top: halfNeg, left: "0", right: "0", height: size },
    s: { bottom: halfNeg, left: "0", right: "0", height: size },
    e: { right: halfNeg, top: "0", bottom: "0", width: size },
    w: { left: halfNeg, top: "0", bottom: "0", width: size },
    nw: { top: halfNeg, left: halfNeg, width: size, height: size },
    ne: { top: halfNeg, right: halfNeg, width: size, height: size },
    sw: { bottom: halfNeg, left: halfNeg, width: size, height: size },
    se: { bottom: halfNeg, right: halfNeg, width: size, height: size },
  };
  return map[p];
}
</script>

<template>
  <Primitive
    :as="props.as"
    :as-child="props.asChild"
    data-canvas-resize-handle
    :data-position="props.position"
    :data-active="panel.isResizing.value || undefined"
    :style="{
      position: 'absolute',
      cursor: CURSOR[props.position],
      touchAction: 'none',
      ...positionStyle(props.position),
    }"
    @pointerdown="onPointerDown"
  >
    <slot :active="panel.isResizing.value" />
  </Primitive>
</template>
