// Derived from Reka UI (https://github.com/unovue/reka-ui) — MIT License, Copyright (c) 2023 UnoVue.
// See licenses/reka-ui-LICENSE for the original license text.
import { cloneVNode, Comment, defineComponent, mergeProps } from "vue";
import { renderSlotFragments } from "@/shared/renderSlotFragments";

export const Slot = defineComponent({
  name: "PrimitiveSlot",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => {
      if (!slots.default) return null;

      const children = renderSlotFragments(slots.default());
      const firstNonCommentChildrenIndex = children.findIndex((child) => child.type !== Comment);
      if (firstNonCommentChildrenIndex === -1) return children;

      const firstNonCommentChildren = children[firstNonCommentChildrenIndex];

      // Remove ref from being inferred
      delete firstNonCommentChildren.props?.ref;

      // Merge so the child's own props win over attrs.
      const mergedProps = firstNonCommentChildren.props
        ? mergeProps(attrs, firstNonCommentChildren.props)
        : attrs;
      const cloned = cloneVNode({ ...firstNonCommentChildren, props: {} }, mergedProps);

      if (children.length === 1) return cloned;

      children[firstNonCommentChildrenIndex] = cloned;
      return children;
    };
  },
});
