import { defineStore } from "@mattfletcher94/strata";

export interface ViewportSnapshot {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface AnimationRow {
  readonly corrId: string;
  readonly from: ViewportSnapshot;
  readonly to: ViewportSnapshot;
  readonly startTime: number;
  readonly duration: number;
  /**
   * Pre-sampled easing curve — at request time we evaluate the easing
   * function at N+1 evenly-spaced t values. The driving loop interpolates
   * linearly between samples. Storing only numbers keeps state serialisable
   * and complies with strata's "no functions in state" rule.
   */
  readonly easingTable: readonly number[];
}

interface AnimationsState {
  active: AnimationRow | null;
}

export const animationsStore = defineStore({
  name: "animations",
  responsibility: "Active viewport animation request (if any).",
  state: {
    active: null,
  } as AnimationsState,
  projections: {
    animationStarted: (state, row: AnimationRow) => ({ ...state, active: row }),
    animationFinished: (state, { corrId }: { corrId: string }) =>
      state.active?.corrId === corrId ? { ...state, active: null } : state,
    animationCancelled: (state, { corrId }: { corrId: string }) =>
      state.active?.corrId === corrId ? { ...state, active: null } : state,
    allAnimationsCancelled: (state) =>
      state.active === null ? state : { ...state, active: null },
  },
  queries: (state) => ({
    active: () => state.active,
    isAnimating: () => state.active !== null,
    activeCorrId: () => state.active?.corrId ?? null,
  }),
});
