<script setup lang="ts">
import { computed } from "vue";
import { Primitive } from "@/primitives";
import { injectPanelContext } from "@/internal/contexts";

interface DragHandleProps {
  as?: string | object;
  asChild?: boolean;
}

const props = withDefaults(defineProps<DragHandleProps>(), {
  as: "div",
  asChild: false,
});

const panel = injectPanelContext();

function onPointerDown(e: PointerEvent) {
  if (panel.disabled.value) return;
  e.preventDefault();
  e.stopPropagation();
  panel.beginDrag(e);
}

const cursor = computed(() => (panel.disabled.value ? "default" : "grab"));
</script>

<template>
  <Primitive
    :as="props.as"
    :as-child="props.asChild"
    data-canvas-drag-handle
    :data-active="panel.isDragging.value || undefined"
    :style="{ cursor, touchAction: 'none' }"
    @pointerdown="onPointerDown"
  >
    <slot :active="panel.isDragging.value" />
  </Primitive>
</template>
