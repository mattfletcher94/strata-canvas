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
    /**
     * Selection decision for a pointerdown on a panel (body click or gesture
     * start). `additive` toggles membership. Otherwise: when `keepExisting`
     * and the panel is already selected, the current selection is preserved
     * (so dragging one panel of a multi-selection moves the whole group);
     * else selection collapses to just this panel.
     */
    selectOnPointerDown(input: { id: string; additive: boolean; keepExisting?: boolean }) {
      if (input.additive) {
        return { events: [deps.selection.panelSelected({ id: input.id, additive: true })] };
      }
      if (input.keepExisting && deps.selection.isSelected(input.id)()) {
        return {};
      }
      return { events: [deps.selection.selectionSet({ ids: [input.id] })] };
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
