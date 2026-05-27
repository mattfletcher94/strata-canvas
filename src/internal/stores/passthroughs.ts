import { defineStore } from "@mattfletcher94/strata";

/** Event types a passthrough region can opt out of. */
export type PassthroughKind = "pointer" | "wheel" | "keyboard";

export interface PassthroughConfig {
  readonly pointer: boolean;
  readonly wheel: boolean;
  readonly keyboard: boolean;
}

export interface PassthroughRow extends PassthroughConfig {
  readonly id: string;
}

export const passthroughsStore = defineStore({
  name: "passthroughs",
  responsibility: "Registered passthrough regions: id -> per-event-kind blocklist.",
  state: {
    regions: {} as Record<string, PassthroughRow>,
  },
  projections: {
    passthroughRegistered: (
      state,
      { id, config }: { id: string; config: PassthroughConfig },
    ) => ({
      ...state,
      regions: { ...state.regions, [id]: { id, ...config } },
    }),
    passthroughUnregistered: (state, { id }: { id: string }) => {
      if (!state.regions[id]) return state;
      const copy = { ...state.regions };
      delete copy[id];
      return { ...state, regions: copy };
    },
  },
  queries: (state) => ({
    byId: (id: string) => () => state.regions[id] ?? null,
    all: () => Object.values(state.regions) as readonly PassthroughRow[],
    blocks: (id: string, kind: PassthroughKind) => () => {
      const row = state.regions[id];
      if (!row) return false;
      return row[kind];
    },
  }),
});
