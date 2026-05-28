import { createStrata, type ResolvedStrata } from "@mattfletcher94/strata";

import { viewportStore, type ViewportConfig } from "@/internal/stores/viewport";
import { registryStore } from "@/internal/stores/registry";
import { gesturesStore } from "@/internal/stores/gestures";
import { selectionStore } from "@/internal/stores/selection";
import { passthroughsStore } from "@/internal/stores/passthroughs";
import { animationsStore } from "@/internal/stores/animations";

import { pointerService } from "@/internal/services/pointer";

import { viewportOrch } from "@/internal/orchestrators/viewport";
import { registryOrch } from "@/internal/orchestrators/registry";
import { gestureOrch } from "@/internal/orchestrators/gesture";
import { selectionOrch } from "@/internal/orchestrators/selection";
import { passthroughOrch } from "@/internal/orchestrators/passthrough";
import { animationOrch } from "@/internal/orchestrators/animation";

export interface CanvasGraphOptions {
  readonly config?: Partial<ViewportConfig>;
}

export type CanvasGraph = ResolvedStrata<{
  stores: {
    viewport: typeof viewportStore;
    registry: typeof registryStore;
    gestures: typeof gesturesStore;
    selection: typeof selectionStore;
    passthroughs: typeof passthroughsStore;
    animations: typeof animationsStore;
  };
  orchestrators: {
    viewportOrch: typeof viewportOrch;
    registryOrch: typeof registryOrch;
    gestureOrch: typeof gestureOrch;
    selectionOrch: typeof selectionOrch;
    passthroughOrch: typeof passthroughOrch;
    animationOrch: typeof animationOrch;
  };
}>;

export interface CanvasGraphHandle {
  readonly graph: CanvasGraph;
  /** Release long-lived live queries and dispose the graph. Call on Root unmount. */
  dispose(): Promise<void>;
}

export function createCanvasGraph(opts: CanvasGraphOptions = {}): CanvasGraphHandle {
  const graph = createStrata({
    name: "strata-canvas",
    responsibility: "Internal graph for a single <Canvas.Root> instance.",
    services: { pointer: pointerService },
    stores: {
      viewport: viewportStore,
      registry: registryStore,
      gestures: gesturesStore,
      selection: selectionStore,
      passthroughs: passthroughsStore,
      animations: animationsStore,
    },
    orchestrators: {
      viewportOrch,
      registryOrch,
      gestureOrch,
      selectionOrch,
      passthroughOrch,
      animationOrch,
    },
  });

  if (opts.config) {
    graph.viewportOrch.configure({ config: opts.config });
  }

  const releasePointer = graph.gestureOrch.pointerStream.acquire();

  return {
    graph,
    async dispose() {
      releasePointer();
      await graph.$dispose({ timeout: 100 });
    },
  };
}
