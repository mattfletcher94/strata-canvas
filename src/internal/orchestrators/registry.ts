import { defineOrchestrator } from "@mattfletcher94/strata";
import { registryStore } from "@/internal/stores/registry";

export const registryOrch = defineOrchestrator({
  name: "registryOrch",
  responsibility: "Mount/unmount/update/reparent panels in the registry.",
  deps: { registry: registryStore },
  queries: (deps) => ({
    byId: (id: string) => deps.registry.byId(id),
    parentOf: (id: string) => deps.registry.parentOf(id),
    childrenOf: (id: string) => deps.registry.childrenOf(id),
    siblingsOf: (id: string) => deps.registry.siblingsOf(id),
    rootPanels: () => deps.registry.rootPanels(),
    panelsList: () => deps.registry.panelsList(),
    exists: (id: string) => deps.registry.exists(id),
    mountOrder: () => deps.registry.mountOrder(),
    worldRect: (id: string) => deps.registry.worldRect(id),
    worldBoundsAll: () => deps.registry.worldBoundsAll(),
  }),
  commands: (deps) => ({
    mountPanel(input: {
      id: string;
      parentId: string | null;
      x: number;
      y: number;
      width: number;
      height: number;
    }) {
      if (deps.registry.exists(input.id)()) return;
      return { events: [deps.registry.panelMounted(input)] };
    },
    unmountPanel(input: { id: string }) {
      if (!deps.registry.exists(input.id)()) return;
      return { events: [deps.registry.panelUnmounted(input)] };
    },
    commitPanelState(input: {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }) {
      if (!deps.registry.exists(input.id)()) return;
      return { events: [deps.registry.panelStateUpdated(input)] };
    },
    reparent(input: { id: string; newParentId: string | null }) {
      if (!deps.registry.exists(input.id)()) return;
      return { events: [deps.registry.panelReparented(input)] };
    },
  }),
});
