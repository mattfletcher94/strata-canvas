<script setup lang="ts">
import { Primitive } from "@/primitives";
import { injectCanvasContext } from "@/internal/contexts";

interface BackgroundProps {
  as?: string | object;
  asChild?: boolean;
}

const props = withDefaults(defineProps<BackgroundProps>(), {
  as: "div",
  asChild: false,
});

const canvas = injectCanvasContext();
</script>

<template>
  <Primitive
    :as="props.as"
    :as-child="props.asChild"
    data-canvas-background
    :style="{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    }"
  >
    <slot :viewport="canvas.viewport.value" :zoom="canvas.zoom.value" />
  </Primitive>
</template>
