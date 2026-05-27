import { defineOrchestrator } from "@mattfletcher94/strata";
import { animationsStore, type ViewportSnapshot } from "@/internal/stores/animations";

export const animationOrch = defineOrchestrator({
  name: "animationOrch",
  responsibility: "Tracks the active viewport animation request lifecycle.",
  deps: { animations: animationsStore },
  queries: (deps) => ({
    active: () => deps.animations.active(),
    isAnimating: () => deps.animations.isAnimating(),
    activeCorrId: () => deps.animations.activeCorrId(),
  }),
  commands: (deps) => ({
    start(input: {
      corrId: string;
      from: ViewportSnapshot;
      to: ViewportSnapshot;
      duration: number;
      easingTable: readonly number[];
      startTime: number;
    }) {
      return { events: [deps.animations.animationStarted(input)] };
    },
    finish(input: { corrId: string }) {
      return { events: [deps.animations.animationFinished(input)] };
    },
    cancel() {
      const a = deps.animations.active();
      if (!a) return;
      return { events: [deps.animations.animationCancelled({ corrId: a.corrId })] };
    },
    cancelAll() {
      return { events: [deps.animations.allAnimationsCancelled({})] };
    },
  }),
});
