import { defineStore } from "@mattfletcher94/strata";
import type { Box, HandlePosition, KeyboardModifiers, Point } from "@/types";

export interface DragMember {
  readonly startBox: Box;
  readonly rawProposed: Box;
}

export interface DragGesture {
  readonly corrId: string;
  /** The grabbed panel. Always a member unless it rides a selected ancestor. */
  readonly panelId: string;
  readonly startPointer: Point;
  readonly currentPointer: Point;
  readonly modifiers: KeyboardModifiers;
  /** Every panel moving in this drag, keyed by id — one entry for a single
   *  drag, many for a group drag of a multi-selection. */
  readonly members: Record<string, DragMember>;
}

export interface ResizeGesture {
  readonly corrId: string;
  readonly panelId: string;
  readonly handle: HandlePosition;
  readonly startPointer: Point;
  readonly currentPointer: Point;
  readonly modifiers: KeyboardModifiers;
  readonly startBox: Box;
  readonly rawProposed: Box;
}

export interface PanGesture {
  readonly corrId: string;
  readonly startScreenPointer: Point;
  readonly currentScreenPointer: Point;
  readonly startViewport: { readonly x: number; readonly y: number };
}

interface GesturesState {
  drag: DragGesture | null;
  resize: ResizeGesture | null;
  pan: PanGesture | null;
}

export const gesturesStore = defineStore({
  name: "gestures",
  responsibility: "Active drag/resize/pan gesture state.",
  state: {
    drag: null,
    resize: null,
    pan: null,
  } as GesturesState,
  projections: {
    dragBegun: (state, gesture: DragGesture) => ({ ...state, drag: gesture }),
    dragAdvanced: (
      state,
      {
        corrId,
        currentPointer,
        modifiers,
        proposals,
      }: {
        corrId: string;
        currentPointer: Point;
        modifiers: KeyboardModifiers;
        proposals: Record<string, Box>;
      },
    ) => {
      if (!state.drag || state.drag.corrId !== corrId) return state;
      const members: Record<string, DragMember> = {};
      for (const id in state.drag.members) {
        const member = state.drag.members[id];
        members[id] = {
          startBox: member.startBox,
          rawProposed: proposals[id] ?? member.rawProposed,
        };
      }
      return { ...state, drag: { ...state.drag, currentPointer, modifiers, members } };
    },
    dragEnded: (state, { corrId }: { corrId: string }) => {
      if (!state.drag || state.drag.corrId !== corrId) return state;
      return { ...state, drag: null };
    },
    dragCancelled: (state, { corrId }: { corrId: string }) => {
      if (!state.drag || state.drag.corrId !== corrId) return state;
      return { ...state, drag: null };
    },

    resizeBegun: (state, gesture: ResizeGesture) => ({ ...state, resize: gesture }),
    resizeAdvanced: (
      state,
      {
        corrId,
        currentPointer,
        modifiers,
        rawProposed,
      }: { corrId: string; currentPointer: Point; modifiers: KeyboardModifiers; rawProposed: Box },
    ) => {
      if (!state.resize || state.resize.corrId !== corrId) return state;
      return { ...state, resize: { ...state.resize, currentPointer, modifiers, rawProposed } };
    },
    resizeEnded: (state, { corrId }: { corrId: string }) => {
      if (!state.resize || state.resize.corrId !== corrId) return state;
      return { ...state, resize: null };
    },
    resizeCancelled: (state, { corrId }: { corrId: string }) => {
      if (!state.resize || state.resize.corrId !== corrId) return state;
      return { ...state, resize: null };
    },

    panBegun: (state, gesture: PanGesture) => ({ ...state, pan: gesture }),
    panAdvanced: (
      state,
      { corrId, currentScreenPointer }: { corrId: string; currentScreenPointer: Point },
    ) => {
      if (!state.pan || state.pan.corrId !== corrId) return state;
      return { ...state, pan: { ...state.pan, currentScreenPointer } };
    },
    panEnded: (state, { corrId }: { corrId: string }) => {
      if (!state.pan || state.pan.corrId !== corrId) return state;
      return { ...state, pan: null };
    },
  },
  queries: (state) => ({
    activeDrag: () => state.drag,
    activeResize: () => state.resize,
    activePan: () => state.pan,
    dragFor: (id: string) => () => (state.drag && state.drag.members[id] ? state.drag : null),
    resizeFor: (id: string) => () =>
      state.resize && state.resize.panelId === id ? state.resize : null,
    isPanelDragging: (id: string) => () =>
      state.drag !== null && state.drag.members[id] !== undefined,
    isPanelResizing: (id: string) => () => state.resize?.panelId === id,
    isAnyGestureActive: () => state.drag !== null || state.resize !== null || state.pan !== null,
    rawProposedFor: (id: string) => () => {
      if (state.drag && state.drag.members[id]) {
        return { gesture: "drag" as const, raw: state.drag.members[id].rawProposed };
      }
      if (state.resize && state.resize.panelId === id) {
        return {
          gesture: "resize" as const,
          raw: state.resize.rawProposed,
          handle: state.resize.handle,
        };
      }
      return null;
    },
  }),
});
