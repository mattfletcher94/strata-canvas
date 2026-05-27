import { defineStore } from "@mattfletcher94/strata";

export const selectionStore = defineStore({
  name: "selection",
  responsibility: "Selected panel ids in selection order (most recent last).",
  state: {
    selected: [] as readonly string[],
  },
  projections: {
    panelSelected: (
      state,
      { id, additive }: { id: string; additive: boolean },
    ) => {
      if (additive) {
        if (state.selected.includes(id)) return state;
        return { ...state, selected: [...state.selected, id] };
      }
      if (state.selected.length === 1 && state.selected[0] === id) return state;
      return { ...state, selected: [id] };
    },
    panelDeselected: (state, { id }: { id: string }) => {
      if (!state.selected.includes(id)) return state;
      return { ...state, selected: state.selected.filter((x) => x !== id) };
    },
    selectionSet: (state, { ids }: { ids: readonly string[] }) => ({
      ...state,
      selected: [...ids],
    }),
    selectionCleared: (state) =>
      state.selected.length === 0 ? state : { ...state, selected: [] },
  },
  queries: (state) => ({
    selectedIds: () => state.selected,
    isSelected: (id: string) => () => state.selected.includes(id),
    selectionSize: () => state.selected.length,
    primarySelection: () =>
      state.selected.length > 0 ? state.selected[state.selected.length - 1] : null,
  }),
});
