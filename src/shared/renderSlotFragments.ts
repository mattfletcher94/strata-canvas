// Derived from Reka UI (https://github.com/unovue/reka-ui) — MIT License, Copyright (c) 2023 UnoVue.
// See licenses/reka-ui-LICENSE for the original license text.
import type { VNode } from "vue";
import { Fragment } from "vue";

export function renderSlotFragments(children?: VNode[]): VNode[] {
  if (!children) return [];
  return children.flatMap((child) => {
    if (child.type === Fragment) return renderSlotFragments(child.children as VNode[]);
    return [child];
  });
}
