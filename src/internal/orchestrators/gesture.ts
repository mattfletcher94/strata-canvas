import {
  defineOrchestrator,
  defineLiveQuery,
  type EventDescriptor,
  type Resolved,
} from "@mattfletcher94/strata";
import type { Box, HandlePosition, KeyboardModifiers, Point } from "@/types";
import type { DragMember } from "@/internal/stores/gestures";
import { gesturesStore } from "@/internal/stores/gestures";
import { registryStore } from "@/internal/stores/registry";
import { selectionStore } from "@/internal/stores/selection";
import { viewportStore } from "@/internal/stores/viewport";
import { pointerService } from "@/internal/services/pointer";

function newCorrId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface GestureServices {
  readonly pointer: Resolved<typeof pointerService>;
}

export const gestureOrch = defineOrchestrator({
  name: "gestureOrch",
  responsibility: "Active drag/resize/pan gesture state machines.",
  deps: {
    gestures: gesturesStore,
    registry: registryStore,
    selection: selectionStore,
    viewport: viewportStore,
  },
  services: { pointer: pointerService },
  queries: (deps) => ({
    activeDrag: () => deps.gestures.activeDrag(),
    activeResize: () => deps.gestures.activeResize(),
    activePan: () => deps.gestures.activePan(),
    dragFor: (id: string) => deps.gestures.dragFor(id),
    resizeFor: (id: string) => deps.gestures.resizeFor(id),
    isPanelDragging: (id: string) => deps.gestures.isPanelDragging(id),
    isPanelResizing: (id: string) => deps.gestures.isPanelResizing(id),
    isAnyGestureActive: () => deps.gestures.isAnyGestureActive(),
    rawProposedFor: (id: string) => deps.gestures.rawProposedFor(id),
  }),
  commands: (deps) => ({
    beginDrag(input: { panelId: string; pointer: Point; modifiers: KeyboardModifiers }) {
      const panel = deps.registry.byId(input.panelId)();
      if (!panel) return;

      // Group drag: if the grabbed panel is part of a multi-selection, every
      // selected panel moves. Otherwise just the grabbed one.
      const selected = deps.selection.selectedIds();
      const baseIds =
        selected.includes(input.panelId) && selected.length > 1 ? selected : [input.panelId];
      const selectedSet = new Set(baseIds);

      // Exclude panels that have a selected ancestor — they ride along via the
      // ancestor's move, so moving them too would double their displacement.
      const members: Record<string, DragMember> = {};
      for (const gid of baseIds) {
        let pid = deps.registry.byId(gid)()?.parentId ?? null;
        let ridesAncestor = false;
        while (pid !== null) {
          if (selectedSet.has(pid)) {
            ridesAncestor = true;
            break;
          }
          pid = deps.registry.byId(pid)()?.parentId ?? null;
        }
        if (ridesAncestor) continue;
        const r = deps.registry.byId(gid)();
        if (!r) continue;
        const box: Box = { x: r.x, y: r.y, width: r.width, height: r.height };
        members[gid] = { startBox: box, rawProposed: box };
      }
      // Fallback: ensure the grabbed panel always moves even if it wasn't
      // selectable / not in the selection set.
      if (Object.keys(members).length === 0) {
        const box: Box = { x: panel.x, y: panel.y, width: panel.width, height: panel.height };
        members[input.panelId] = { startBox: box, rawProposed: box };
      }

      return {
        events: [
          deps.gestures.dragBegun({
            corrId: newCorrId(),
            panelId: input.panelId,
            startPointer: input.pointer,
            currentPointer: input.pointer,
            modifiers: input.modifiers,
            members,
          }),
        ],
      };
    },
    beginResize(input: {
      panelId: string;
      handle: HandlePosition;
      pointer: Point;
      modifiers: KeyboardModifiers;
    }) {
      const panel = deps.registry.byId(input.panelId)();
      if (!panel) return;
      const startBox: Box = { x: panel.x, y: panel.y, width: panel.width, height: panel.height };
      return {
        events: [
          deps.gestures.resizeBegun({
            corrId: newCorrId(),
            panelId: input.panelId,
            handle: input.handle,
            startPointer: input.pointer,
            currentPointer: input.pointer,
            modifiers: input.modifiers,
            startBox,
            rawProposed: startBox,
          }),
        ],
      };
    },
    beginPan(input: { screenPointer: Point }) {
      return {
        events: [
          deps.gestures.panBegun({
            corrId: newCorrId(),
            startScreenPointer: input.screenPointer,
            currentScreenPointer: input.screenPointer,
            startViewport: { x: deps.viewport.x(), y: deps.viewport.y() },
          }),
        ],
      };
    },
    cancelActive() {
      const events: EventDescriptor[] = [];
      const drag = deps.gestures.activeDrag();
      if (drag) events.push(deps.gestures.dragCancelled({ corrId: drag.corrId }));
      const resize = deps.gestures.activeResize();
      if (resize) events.push(deps.gestures.resizeCancelled({ corrId: resize.corrId }));
      const pan = deps.gestures.activePan();
      if (pan) events.push(deps.gestures.panEnded({ corrId: pan.corrId }));
      return { events };
    },
  }),
  liveQueries: (deps, services: GestureServices) => ({
    pointerStream: defineLiveQuery({
      query: () => deps.gestures.activeDrag,
      source: (_args, { on }) => {
        const onMove = on((e: { screenPointer: Point; modifiers: KeyboardModifiers }) => {
          const events: EventDescriptor[] = [];

          const drag = deps.gestures.activeDrag();
          if (drag) {
            const zoom = deps.viewport.zoom();
            const dx = (e.screenPointer.x - drag.startPointer.x) / zoom;
            const dy = (e.screenPointer.y - drag.startPointer.y) / zoom;
            const proposals: Record<string, Box> = {};
            for (const id in drag.members) {
              const startBox = drag.members[id].startBox;
              proposals[id] = {
                x: startBox.x + dx,
                y: startBox.y + dy,
                width: startBox.width,
                height: startBox.height,
              };
            }
            events.push(
              deps.gestures.dragAdvanced({
                corrId: drag.corrId,
                currentPointer: e.screenPointer,
                modifiers: e.modifiers,
                proposals,
              }),
            );
          }

          const resize = deps.gestures.activeResize();
          if (resize) {
            const zoom = deps.viewport.zoom();
            const dx = (e.screenPointer.x - resize.startPointer.x) / zoom;
            const dy = (e.screenPointer.y - resize.startPointer.y) / zoom;
            const handle = resize.handle;
            let x = resize.startBox.x;
            let y = resize.startBox.y;
            let width = resize.startBox.width;
            let height = resize.startBox.height;
            if (handle.includes("e")) width = resize.startBox.width + dx;
            if (handle.includes("w")) {
              x = resize.startBox.x + dx;
              width = resize.startBox.width - dx;
            }
            if (handle.includes("s")) height = resize.startBox.height + dy;
            if (handle.includes("n")) {
              y = resize.startBox.y + dy;
              height = resize.startBox.height - dy;
            }
            if (width < 1) width = 1;
            if (height < 1) height = 1;
            events.push(
              deps.gestures.resizeAdvanced({
                corrId: resize.corrId,
                currentPointer: e.screenPointer,
                modifiers: e.modifiers,
                rawProposed: { x, y, width, height },
              }),
            );
          }

          const pan = deps.gestures.activePan();
          if (pan) {
            const zoom = deps.viewport.zoom();
            const dx = (e.screenPointer.x - pan.currentScreenPointer.x) / zoom;
            const dy = (e.screenPointer.y - pan.currentScreenPointer.y) / zoom;
            events.push(
              deps.gestures.panAdvanced({
                corrId: pan.corrId,
                currentScreenPointer: e.screenPointer,
              }),
            );
            if (dx !== 0 || dy !== 0) events.push(deps.viewport.viewportPanned({ dx, dy }));
          }

          return events;
        });

        const onUp = on(() => {
          const events: EventDescriptor[] = [];
          const drag = deps.gestures.activeDrag();
          if (drag) events.push(deps.gestures.dragEnded({ corrId: drag.corrId }));
          const resize = deps.gestures.activeResize();
          if (resize) events.push(deps.gestures.resizeEnded({ corrId: resize.corrId }));
          const pan = deps.gestures.activePan();
          if (pan) events.push(deps.gestures.panEnded({ corrId: pan.corrId }));
          return events;
        });

        const onCancel = on(() => {
          const events: EventDescriptor[] = [];
          const drag = deps.gestures.activeDrag();
          if (drag) events.push(deps.gestures.dragCancelled({ corrId: drag.corrId }));
          const resize = deps.gestures.activeResize();
          if (resize) events.push(deps.gestures.resizeCancelled({ corrId: resize.corrId }));
          const pan = deps.gestures.activePan();
          if (pan) events.push(deps.gestures.panEnded({ corrId: pan.corrId }));
          return events;
        });

        return services.pointer.subscribe({ onMove, onUp, onCancel });
      },
    }),
  }),
});
