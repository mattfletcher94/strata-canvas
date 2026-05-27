import { defineOrchestrator } from "@mattfletcher94/strata";
import {
  passthroughsStore,
  type PassthroughKind,
  type PassthroughConfig,
} from "@/internal/stores/passthroughs";

export const passthroughOrch = defineOrchestrator({
  name: "passthroughOrch",
  responsibility: "Register/unregister passthrough regions and answer hit-tests.",
  deps: { passthroughs: passthroughsStore },
  queries: (deps) => ({
    byId: (id: string) => deps.passthroughs.byId(id),
    all: () => deps.passthroughs.all(),
    blocks: (id: string, kind: PassthroughKind) => deps.passthroughs.blocks(id, kind),
  }),
  commands: (deps) => ({
    register(input: { id: string; config: PassthroughConfig }) {
      return { events: [deps.passthroughs.passthroughRegistered(input)] };
    },
    unregister(input: { id: string }) {
      return { events: [deps.passthroughs.passthroughUnregistered(input)] };
    },
  }),
});
