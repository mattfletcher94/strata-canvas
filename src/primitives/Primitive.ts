// Derived from Reka UI (https://github.com/unovue/reka-ui) — MIT License, Copyright (c) 2023 UnoVue.
// See licenses/reka-ui-LICENSE for the original license text.
import type { Component, PropType } from "vue";
import { defineComponent, h } from "vue";
import { Slot } from "@/primitives/Slot";

export type AsTag =
  | "a"
  | "button"
  | "div"
  | "form"
  | "h2"
  | "h3"
  | "img"
  | "input"
  | "label"
  | "li"
  | "nav"
  | "ol"
  | "p"
  | "span"
  | "svg"
  | "ul"
  | "template"
  | ({} & string);

export interface PrimitiveProps {
  /**
   * Render as the single passed child element, merging props and behaviour
   * into it instead of rendering a wrapper element of our own.
   */
  asChild?: boolean;
  /**
   * The element or component this primitive should render as.
   * Overridden by `asChild`.
   * @defaultValue "div"
   */
  as?: AsTag | Component;
}

// For self-closing tags, omit default slot to avoid hydration mismatches.
const SELF_CLOSING_TAGS = ["area", "img", "input"];

export const Primitive = defineComponent({
  name: "Primitive",
  inheritAttrs: false,
  props: {
    asChild: { type: Boolean, default: false },
    as: { type: [String, Object] as PropType<AsTag | Component>, default: "div" },
  },
  setup(props, { attrs, slots }) {
    const asTag = props.asChild ? "template" : props.as;

    if (typeof asTag === "string" && SELF_CLOSING_TAGS.includes(asTag))
      return () => h(asTag, attrs);

    if (asTag !== "template") return () => h(props.as, attrs, { default: slots.default });

    return () => h(Slot, attrs, { default: slots.default });
  },
});
