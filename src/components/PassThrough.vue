<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";
import { Primitive } from "@/primitives";
import { injectCanvasContext } from "@/internal/contexts";

interface PassThroughProps {
  /** Block pointer events whose target is inside this region. Default true. */
  pointer?: boolean;
  /** Block wheel events whose target is inside this region. Default true. */
  wheel?: boolean;
  /** Block keyboard events when document focus is inside this region. Default true. */
  keyboard?: boolean;
  as?: string | object;
  asChild?: boolean;
}

const props = withDefaults(defineProps<PassThroughProps>(), {
  pointer: true,
  wheel: true,
  keyboard: true,
  as: "div",
  asChild: false,
});

const canvas = injectCanvasContext();

const id = (() => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `pt-${crypto.randomUUID()}`;
  }
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
})();

onMounted(() => {
  canvas._handle.graph.passthroughOrch.register({
    id,
    config: { pointer: props.pointer, wheel: props.wheel, keyboard: props.keyboard },
  });
});

// Reactive re-register on prop changes
watch(
  () => [props.pointer, props.wheel, props.keyboard],
  () => {
    canvas._handle.graph.passthroughOrch.register({
      id,
      config: { pointer: props.pointer, wheel: props.wheel, keyboard: props.keyboard },
    });
  },
);

onBeforeUnmount(() => {
  canvas._handle.graph.passthroughOrch.unregister({ id });
});
</script>

<template>
  <Primitive
    :as="props.as"
    :as-child="props.asChild"
    data-canvas-passthrough
    :data-passthrough-id="id"
  >
    <slot />
  </Primitive>
</template>
