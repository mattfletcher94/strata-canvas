import { defineOrchestrator } from "@mattfletcher94/strata";
import { selectionStore } from "@/internal/stores/selection";
import { registryStore } from "@/internal/stores/registry";

export const selectionOrch = defineOrchestrator({
  name: "selectionOrch",
  responsibility: "Selected-panel set: select, deselect, replace, clear.",
  deps: { selection: selectionStore, registry: registryStore },
  queries: (deps) => ({
    selectedIds: () => deps.selection.selectedIds(),
    selectedPanels: () => {
      const out = [];
      for (const id of deps.selection.selectedIds()) {
        const row = deps.registry.byId(id)();
        if (row) out.push(row);
      }
      return out;
    },
    isSelected: (id: string) => deps.selection.isSelected(id),
    selectionSize: () => deps.selection.selectionSize(),
    primarySelection: () => deps.selection.primarySelection(),
  }),
  commands: (deps) => ({
    select(input: { id: string; additive?: boolean }) {
      return {
        events: [deps.selection.panelSelected({ id: input.id, additive: input.additive ?? false })],
      };
    },
    deselect(input: { id: string }) {
      return { events: [deps.selection.panelDeselected(input)] };
    },
    set(input: { ids: readonly string[] }) {
      return { events: [deps.selection.selectionSet(input)] };
    },
    clear() {
      return { events: [deps.selection.selectionCleared({})] };
    },
  }),
});
