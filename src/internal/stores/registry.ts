import { defineStore } from "@mattfletcher94/strata";

export interface PanelRow {
  readonly id: string;
  readonly parentId: string | null;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface RegistryState {
  panels: Record<string, PanelRow>;
  rootIds: readonly string[];
  childrenByParent: Record<string, readonly string[]>;
  mountOrder: readonly string[];
}

function addToParent(
  childrenByParent: Record<string, readonly string[]>,
  parentId: string | null,
  childId: string,
): Record<string, readonly string[]> {
  if (parentId === null) return childrenByParent;
  const existing = childrenByParent[parentId] ?? [];
  if (existing.includes(childId)) return childrenByParent;
  return { ...childrenByParent, [parentId]: [...existing, childId] };
}

function removeFromParent(
  childrenByParent: Record<string, readonly string[]>,
  parentId: string | null,
  childId: string,
): Record<string, readonly string[]> {
  if (parentId === null) return childrenByParent;
  const existing = childrenByParent[parentId];
  if (!existing) return childrenByParent;
  const next = existing.filter((id) => id !== childId);
  if (next.length === 0) {
    const copy = { ...childrenByParent };
    delete copy[parentId];
    return copy;
  }
  return { ...childrenByParent, [parentId]: next };
}

export const registryStore = defineStore({
  name: "registry",
  responsibility: "Mounted panel tree: geometric state + parent/child indexes.",
  state: {
    panels: {} as Record<string, PanelRow>,
    rootIds: [] as readonly string[],
    childrenByParent: {} as Record<string, readonly string[]>,
    mountOrder: [] as readonly string[],
  } as RegistryState,
  projections: {
    panelMounted: (
      state,
      payload: {
        id: string;
        parentId: string | null;
        x: number;
        y: number;
        width: number;
        height: number;
      },
    ) => {
      if (state.panels[payload.id]) return state;
      const row: PanelRow = {
        id: payload.id,
        parentId: payload.parentId,
        x: payload.x,
        y: payload.y,
        width: payload.width,
        height: payload.height,
      };
      return {
        ...state,
        panels: { ...state.panels, [payload.id]: row },
        rootIds:
          payload.parentId === null && !state.rootIds.includes(payload.id)
            ? [...state.rootIds, payload.id]
            : state.rootIds,
        childrenByParent: addToParent(state.childrenByParent, payload.parentId, payload.id),
        mountOrder: state.mountOrder.includes(payload.id)
          ? state.mountOrder
          : [...state.mountOrder, payload.id],
      };
    },
    panelUnmounted: (state, { id }: { id: string }) => {
      const row = state.panels[id];
      if (!row) return state;
      const panels = { ...state.panels };
      delete panels[id];
      return {
        ...state,
        panels,
        rootIds: row.parentId === null ? state.rootIds.filter((x) => x !== id) : state.rootIds,
        childrenByParent: removeFromParent(state.childrenByParent, row.parentId, id),
        mountOrder: state.mountOrder.filter((x) => x !== id),
      };
    },
    panelStateUpdated: (
      state,
      {
        id,
        x,
        y,
        width,
        height,
      }: { id: string; x: number; y: number; width: number; height: number },
    ) => {
      const row = state.panels[id];
      if (!row) return state;
      if (row.x === x && row.y === y && row.width === width && row.height === height) return state;
      return {
        ...state,
        panels: { ...state.panels, [id]: { ...row, x, y, width, height } },
      };
    },
    panelReparented: (
      state,
      { id, newParentId }: { id: string; newParentId: string | null },
    ) => {
      const row = state.panels[id];
      if (!row || row.parentId === newParentId) return state;
      const cleared = removeFromParent(state.childrenByParent, row.parentId, id);
      const added = addToParent(cleared, newParentId, id);
      const wasRoot = row.parentId === null;
      const willBeRoot = newParentId === null;
      let rootIds = state.rootIds;
      if (wasRoot && !willBeRoot) rootIds = rootIds.filter((x) => x !== id);
      if (!wasRoot && willBeRoot && !rootIds.includes(id)) rootIds = [...rootIds, id];
      return {
        ...state,
        panels: { ...state.panels, [id]: { ...row, parentId: newParentId } },
        childrenByParent: added,
        rootIds,
      };
    },
  },
  queries: (state) => ({
    byId: (id: string) => () => state.panels[id] ?? null,
    parentOf: (id: string) => () => {
      const row = state.panels[id];
      if (!row || row.parentId === null) return null;
      return state.panels[row.parentId] ?? null;
    },
    childrenOf: (id: string) => () => {
      const ids = state.childrenByParent[id] ?? [];
      const out: PanelRow[] = [];
      for (const cid of ids) {
        const row = state.panels[cid];
        if (row) out.push(row);
      }
      return out as readonly PanelRow[];
    },
    siblingsOf: (id: string) => () => {
      const row = state.panels[id];
      if (!row) return [] as readonly PanelRow[];
      const siblingIds =
        row.parentId === null ? state.rootIds : (state.childrenByParent[row.parentId] ?? []);
      const out: PanelRow[] = [];
      for (const sid of siblingIds) {
        if (sid === id) continue;
        const r = state.panels[sid];
        if (r) out.push(r);
      }
      return out as readonly PanelRow[];
    },
    rootPanels: () => {
      const out: PanelRow[] = [];
      for (const rid of state.rootIds) {
        const r = state.panels[rid];
        if (r) out.push(r);
      }
      return out as readonly PanelRow[];
    },
    panelsList: () => {
      const out: PanelRow[] = [];
      for (const mid of state.mountOrder) {
        const r = state.panels[mid];
        if (r) out.push(r);
      }
      return out as readonly PanelRow[];
    },
    exists: (id: string) => () => state.panels[id] !== undefined,
    mountOrder: () => state.mountOrder,
    /** World-coord rect for a single panel — walks the parent chain. */
    worldRect: (id: string) => () => {
      const row = state.panels[id];
      if (!row) return null;
      let x = row.x;
      let y = row.y;
      let pid = row.parentId;
      while (pid !== null) {
        const parent = state.panels[pid];
        if (!parent) break;
        x += parent.x;
        y += parent.y;
        pid = parent.parentId;
      }
      return { minX: x, minY: y, maxX: x + row.width, maxY: y + row.height };
    },
    /** Union world-coord rect spanning every mounted panel. Null if empty. */
    worldBoundsAll: () => {
      const ids = state.mountOrder;
      if (ids.length === 0) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const id of ids) {
        const row = state.panels[id];
        if (!row) continue;
        let x = row.x;
        let y = row.y;
        let pid = row.parentId;
        while (pid !== null) {
          const parent = state.panels[pid];
          if (!parent) break;
          x += parent.x;
          y += parent.y;
          pid = parent.parentId;
        }
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + row.width > maxX) maxX = x + row.width;
        if (y + row.height > maxY) maxY = y + row.height;
      }
      if (minX === Infinity) return null;
      return { minX, minY, maxX, maxY };
    },
  }),
});
