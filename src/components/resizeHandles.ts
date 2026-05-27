import { defineComponent, h } from "vue";
import type { HandlePosition } from "@/types";
import ResizeHandle from "./ResizeHandle.vue";

function makePositioned(position: HandlePosition, name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      as: { type: [String, Object], default: "div" },
      asChild: { type: Boolean, default: false },
    },
    setup(props, { attrs, slots }) {
      return () =>
        h(
          ResizeHandle,
          { ...attrs, position, as: props.as, asChild: props.asChild },
          { default: slots.default },
        );
    },
  });
}

export const ResizeHandleN = makePositioned("n", "Canvas.ResizeHandleN");
export const ResizeHandleE = makePositioned("e", "Canvas.ResizeHandleE");
export const ResizeHandleS = makePositioned("s", "Canvas.ResizeHandleS");
export const ResizeHandleW = makePositioned("w", "Canvas.ResizeHandleW");
export const ResizeHandleNE = makePositioned("ne", "Canvas.ResizeHandleNE");
export const ResizeHandleNW = makePositioned("nw", "Canvas.ResizeHandleNW");
export const ResizeHandleSE = makePositioned("se", "Canvas.ResizeHandleSE");
export const ResizeHandleSW = makePositioned("sw", "Canvas.ResizeHandleSW");
