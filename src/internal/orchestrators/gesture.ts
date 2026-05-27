import {
  defineOrchestrator,
  defineLiveQuery,
  type EventDescriptor,
  type Resolved,
} from "@mattfletcher94/strata";
import type { Box, HandlePosition, KeyboardModifiers, Point } from "@/types";
import { gesturesStore } from "@/internal/stores/gestures";
import { registryStore } from "@/internal/stores/registry";
import { viewportStore } from "@/internal/stores/viewport";
import { pointerService } from "@/internal/services/pointer";

interface GestureServices {
  readonly pointer: Resolved<typeof pointerService>;
}

export const gestureOrch = defineOrchestrator({
  name: "gestureOrch",
  responsibility: "Active drag/resize/pan gesture state machines.",
  deps: { gestures: gesturesStore, registry: registryStore, viewport: viewportStore },
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
      const startBox: Box = { x: panel.x, y: panel.y, width: panel.width, height: panel.height };
      return {
        events: [
          deps.gestures.dragBegun({
            corrId:
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            panelId: input.panelId,
            startPointer: input.pointer,
            currentPointer: input.pointer,
            modifiers: input.modifiers,
            startBox,
            rawProposed: startBox,
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
            corrId:
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
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
            corrId:
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
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
            events.push(
              deps.gestures.dragAdvanced({
                corrId: drag.corrId,
                currentPointer: e.screenPointer,
                modifiers: e.modifiers,
                rawProposed: {
                  x: drag.startBox.x + dx,
                  y: drag.startBox.y + dy,
                  width: drag.startBox.width,
                  height: drag.startBox.height,
                },
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
