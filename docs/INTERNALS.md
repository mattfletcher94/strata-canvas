# Internals — Strata graph + Vue integration layer

This document describes the internal architecture of `@mattfletcher94/strata-canvas`. It complements `PROPOSAL.md` (which covers the public API) by describing exactly how the library uses Strata under the hood, and where the boundary between the Strata graph and the Vue integration layer lives.

**Audience:** contributors and Claude Code agents working on the library. Consumers do not need this document.

---

## 1. The two layers

```
┌─────────────────────────────────────────────────────────────────┐
│ Vue integration layer                                           │
│                                                                 │
│  Components (Root, Panel, DragHandle, ResizeHandle*, ...)       │
│  Composables (useCanvas, usePanel)                              │
│  Constraint pipeline runner (Vue-side; holds the consumer's     │
│    bounds + resolve function refs)                              │
│                                                                 │
│  Responsibilities:                                              │
│   - v-model bindings (consumer state in/out)                    │
│   - Hold consumer's prop refs (bounds, resolve)                 │
│   - Run the constraint pipeline using those refs                │
│   - Provide/inject context (Reka pattern)                       │
│   - Dispatch commands into the graph                            │
│   - Read graph queries via @vue/reactivity bridges              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │  dispatch commands ↑   read queries ↑
                     │
┌────────────────────┴────────────────────────────────────────────┐
│ Strata graph (one per <Canvas.Root>)                            │
│                                                                 │
│  Stores (state, projections, queries):                          │
│    viewport, registry, gestures, selection, passthroughs        │
│                                                                 │
│  Services (I/O):                                                │
│    pointer                                                      │
│                                                                 │
│  Orchestrators (queries + commands + reactions):                │
│    viewportOrch, registryOrch, gestureOrch,                     │
│    selectionOrch, passthroughOrch                               │
│                                                                 │
│  Responsibilities:                                              │
│   - Pure geometric state                                        │
│   - Pointer event ingestion + rAF coalescing                    │
│   - Gesture state machine (raw, pre-constraint)                 │
│   - Cross-cutting state coordination                            │
└─────────────────────────────────────────────────────────────────┘
```

**The boundary rule:** anything involving a _consumer function_ (`bounds: (ctx) => Rect`, `resolve: (proposed, ctx) => Box`) lives in the Vue layer. The Strata graph never holds, calls, or references consumer functions.

This is non-negotiable. Strata explicitly forbids storing functions in store state (`structuredClone` on initial state). Even setting that aside, putting consumer-defined logic inside the graph would force the graph to know about Vue prop reactivity, which couples the wrong layers.

---

## 2. Where the constraint pipeline runs

The pipeline (proposed Box → bounds clamp → resolve fn → committed Box) runs **inside `<Canvas.Panel>`** as a Vue effect. The graph dispatches _raw proposed boxes_ (computed from pointer delta + current panel state); the Vue panel applies the consumer's constraints and dispatches the committed box back.

Why this is correct:

- The consumer's `bounds` and `resolve` are Vue props. They live in Vue's reactivity system.
- The constraint pipeline depends on those props plus the live state of the parent panel, siblings, viewport — all readable from Vue (via graph queries).
- Vue's reactive effect re-runs automatically when any input changes — no manual `enforceConsistency` reaction is needed.

The graph still handles the **gesture state machine**: which panel is being dragged, from which handle, current pointer position. The raw proposed box is computed by a gesture orchestrator reaction (pointer delta + panel current box, no consumer logic).

The Vue panel watches a query that yields `{ rawProposed, gesture, handle, pointer, modifiers } | null` for its own id. When non-null, it runs the constraint pipeline locally and dispatches `commitPanelState`.

---

## 3. Stores

All state lives in stores. State changes only via past-tense projections. No functions, class instances, or Promises in state.

### 3.1 `viewport`

Tracks canvas-level pan/zoom + finite-mode bounds.

```ts
state: {
  x: 0,
  y: 0,
  zoom: 1,
  mode: "infinite",                          // "infinite" | "finite"
  bounds: null as Rect | null,               // canvas bounds rect (finite mode)
  config: {
    zoom: { min: 0.1, max: 4, default: 1, wheel: "ctrl" },
    pan:  { enabled: true, activator: "space" },
  },
}

projections:
  viewportPanned       ({ dx, dy }) => translate x/y by delta
  viewportZoomed       ({ zoom, around? }) => clamp + anchor zoom
  viewportConfigured   ({ config }) => merge config
  viewportSet          ({ x, y, zoom }) => replace
  viewportReset        () => initial state

queries:
  state          : () => ({ x, y, zoom, mode, bounds, config })
  rect           : () => Rect representing the visible viewport in world coords
  zoom           : () => state.zoom
  config         : () => state.config
  bounds         : () => state.bounds   // canvas bounds for finite mode
```

### 3.2 `registry`

Holds every mounted panel's geometric state and the parent/child tree indexes.

```ts
interface PanelRow {
  readonly id: string;
  readonly parentId: string | null;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

state: {
  panels: {} as Record<string, PanelRow>,
  rootIds: [] as string[],
  childrenByParent: {} as Record<string, readonly string[]>,
  // Use document mount order as tiebreaker for z and traversal.
  mountOrder: [] as string[],
}

projections:
  panelMounted          ({ id, parentId, state }) => add row + update indexes
  panelUnmounted        ({ id })                   => remove row + clean indexes
  panelStateUpdated     ({ id, state })            => replace x/y/w/h
  panelReparented       ({ id, newParentId })      => move in tree, update indexes
  panelMountOrderChanged({ id, before? })          => reorder for z-stacking

queries:
  byId(id)            : () => PanelRow | null
  parentOf(id)        : () => PanelRow | null
  childrenOf(id)      : () => readonly PanelRow[]
  siblingsOf(id)      : () => readonly PanelRow[]   // children of same parent, excluding id
  rootPanels          : () => readonly PanelRow[]
  panelsList          : () => readonly PanelRow[]   // flat list, in mount order
  exists(id)          : () => boolean
  worldPosition(id)   : () => Point                  // walks parent chain
```

**Key constraint:** `PanelRow` is _geometric only_. No `props`, no `resolve`, no `bounds`, no functions. Those live in the Vue panel component.

### 3.3 `gestures`

Tracks the active gesture(s). At most one drag and one resize at a time globally (no multi-touch drag in v0). Pan and box-select are also single-active.

```ts
interface DragGesture {
  readonly corrId: string;          // generated at begin
  readonly panelId: string;
  readonly startPointer: Point;     // world coords
  readonly currentPointer: Point;
  readonly modifiers: KeyboardModifiers;
  readonly startBox: Box;           // panel's box at gesture start (parent-local)
  readonly rawProposed: Box;        // computed every frame, pre-constraint
}

interface ResizeGesture {
  readonly corrId: string;
  readonly panelId: string;
  readonly handle: HandlePosition;
  readonly startPointer: Point;
  readonly currentPointer: Point;
  readonly modifiers: KeyboardModifiers;
  readonly startBox: Box;
  readonly rawProposed: Box;
}

interface PanGesture {
  readonly corrId: string;
  readonly startPointer: Point;     // screen coords
  readonly currentPointer: Point;
  readonly startViewport: { x: number; y: number };
}

interface BoxSelectGesture {
  readonly corrId: string;
  readonly startPointer: Point;     // world coords
  readonly currentPointer: Point;
  readonly modifiers: KeyboardModifiers;
}

state: {
  drag:       null as DragGesture | null,
  resize:     null as ResizeGesture | null,
  pan:        null as PanGesture | null,
  boxSelect:  null as BoxSelectGesture | null,
}

projections:
  dragBegun          ({ corrId, panelId, startPointer, modifiers, startBox })
  dragAdvanced       ({ corrId, currentPointer, modifiers, rawProposed })
  dragEnded          ({ corrId, currentPointer })
  dragCancelled      ({ corrId })

  // same family for resize* (with handle), pan*, boxSelect*

queries:
  activeDrag          : () => DragGesture | null
  activeResize        : () => ResizeGesture | null
  activePan           : () => PanGesture | null
  activeBoxSelect     : () => BoxSelectGesture | null
  dragFor(panelId)    : () => DragGesture | null    // only if this panel is being dragged
  resizeFor(panelId)  : () => ResizeGesture | null
  isPanelDragging(id) : () => boolean
  isPanelResizing(id) : () => boolean
  isAnyGestureActive  : () => boolean
```

### 3.4 `selection`

```ts
state: {
  selected: [] as string[],   // panel ids, ordered by selection time
}

projections:
  panelSelected   ({ id, additive }) => add (or replace if not additive)
  panelDeselected ({ id })           => remove
  selectionSet    ({ ids })          => replace
  selectionCleared()                  => empty

queries:
  selectedIds        : () => readonly string[]
  isSelected(id)     : () => boolean
  selectionSize      : () => number
  primarySelection   : () => string | null     // most recently added
```

### 3.5 `passthroughs`

```ts
interface PassthroughRow {
  readonly id: string;
  readonly pan: boolean;
  readonly zoom: boolean;
  readonly wheel: boolean;
  readonly drag: boolean;
  readonly select: boolean;
  readonly element: WeakRef<HTMLElement>; // intentionally NOT in store state — see below
}
```

Wait — `WeakRef<HTMLElement>` is a class instance, which violates the no-functions/instances rule. So we can't store the element reference in the store.

**Resolution:** the store holds only IDs + config booleans:

```ts
state: {
  regions: {} as Record<string, {
    readonly id: string;
    readonly pan: boolean;
    readonly zoom: boolean;
    readonly wheel: boolean;
    readonly drag: boolean;
    readonly select: boolean;
  }>,
}

projections:
  passthroughRegistered   ({ id, config })
  passthroughUnregistered ({ id })

queries:
  byId(id)        : () => PassthroughRow | null
  all             : () => readonly PassthroughRow[]
```

The actual DOM element ↔ id mapping is kept Vue-side. The `<Canvas.PassThrough>` component, on mount, attaches a `data-canvas-passthrough-id="…"` attribute to its rendered element and dispatches `register`; on unmount, it dispatches `unregister`. Hit-testing in the gesture orchestrator reads `target.closest("[data-canvas-passthrough-id]")` and looks up the config by id via the query. **The DOM is the source of truth for element→id; the store is the source of truth for id→config.** Both are read together at hit-test time.

---

## 4. Services

### 4.1 `pointer`

Wraps `window` pointer/keyboard events and rAF coalescing.

```ts
interface PointerService {
  /**
   * Subscribe to pointer + keyboard events. Returns a teardown.
   * Move events are rAF-coalesced — at most one per frame.
   */
  subscribe(
    handlers: {
      onMove?: (e: { pointer: Point; modifiers: KeyboardModifiers; native: PointerEvent }) => void;
      onUp?: (e: { pointer: Point; native: PointerEvent }) => void;
      onCancel?: (e: { native: PointerEvent }) => void;
      onKeyDown?: (e: { key: string; modifiers: KeyboardModifiers }) => void;
      onKeyUp?: (e: { key: string; modifiers: KeyboardModifiers }) => void;
    },
    signal?: AbortSignal,
  ): () => void;

  /** Read the current pointer position (last known). */
  current(): { pointer: Point; modifiers: KeyboardModifiers } | null;
}
```

Implemented as `defineService({ name: "pointer", setup: () => makePointerService() })`. The service is created once per canvas instance.

The service does NOT know about Strata, panels, viewports — it's a pure event source. The gesture orchestrator reactions translate raw browser events into Strata events.

---

## 5. Orchestrators

### 5.1 `viewportOrch`

```ts
deps: { viewport: viewportStore }

queries:
  // Pass-through state reads
  state           : () => deps.viewport.state()
  zoom            : () => deps.viewport.zoom()
  rect            : () => deps.viewport.rect()
  // Coordinate conversions
  screenToWorld(p): () => screenToWorldImpl(p, deps.viewport.state())
  worldToScreen(p): () => worldToScreenImpl(p, deps.viewport.state())

commands:
  pan({ dx, dy })          => { events: [deps.viewport.viewportPanned({ dx, dy })] }
  zoomTo({ zoom, around }) => { events: [deps.viewport.viewportZoomed({ zoom, around })] }
  fitTo({ ids?, padding? })=> compute target viewport from registry, dispatch viewportSet
  configure({ config })    => { events: [deps.viewport.viewportConfigured({ config })] }
  setViewport(state)       => { events: [deps.viewport.viewportSet(state)] }

reactions: none
```

`fitTo` reads the registry to find bounds of selected (or all) panels — that's a cross-store query, so this command takes the registry orchestrator as an additional dep.

### 5.2 `registryOrch`

```ts
deps: { registry: registryStore }

queries:
  byId(id)        : pass-through
  parentOf(id)    : pass-through
  childrenOf(id)  : pass-through
  siblingsOf(id)  : pass-through
  rootPanels      : pass-through
  panelsList      : pass-through
  worldPosition(id): pass-through

commands:
  mountPanel({ id, parentId, state })       => panelMounted event
  unmountPanel({ id })                       => panelUnmounted + cascade child unmount events
  commitPanelState({ id, state })            => panelStateUpdated event (called by Vue layer post-constraint)
  reparent({ id, newParentId, newPosition }) => panelReparented + panelStateUpdated events

reactions: none
```

The registry orchestrator has **no reactions**. Reactive consistency (parent change → child re-clamp) is handled Vue-side because it requires consumer functions; see §8.

### 5.3 `gestureOrch`

The most complex. Owns the gesture lifecycle.

```ts
deps:     { gestures: gesturesStore, registry: registryStore, viewport: viewportStore, passthroughs: passthroughsStore }
services: { pointer: pointerService }

queries:
  activeDrag         : pass-through
  activeResize       : pass-through
  activePan          : pass-through
  activeBoxSelect    : pass-through
  dragFor(id)        : pass-through
  resizeFor(id)      : pass-through
  isPanelDragging(id): pass-through
  isPanelResizing(id): pass-through
  // Frame derivation — pure function readable as a query
  rawProposedFor(id) : () => Box | null
    // returns gesture.rawProposed if there's an active gesture on this panel, else null

commands:
  beginDrag({ panelId, pointer, modifiers })
    // reads deps.registry.byId(panelId) for startBox
    // returns: { events: [dragBegun({ corrId, panelId, startPointer: pointer,
    //                                  modifiers, startBox })] }
  beginResize({ panelId, handle, pointer, modifiers })
    // similar
  beginPan({ pointer })
    // reads deps.viewport.state() for startViewport
  beginBoxSelect({ pointer, modifiers })
  cancelActive()
    // dispatches *Cancelled for whichever gesture is active

reactions:
  runDrag       : on dragBegun
                  → subscribes pointer service via the run callback
                  → on each move, dispatches dragAdvanced (computed rawProposed = startBox + delta)
                  → on up, dispatches dragEnded
                  → concurrency: "switch" (only one active drag)
  runResize     : on resizeBegun → same shape, with handle-aware rawProposed math
  runPan        : on panBegun   → on move, dispatches viewport.viewportPanned + panAdvanced
  runBoxSelect  : on boxSelectBegun → on move, dispatches boxSelectAdvanced;
                  on up, dispatches selection.selectionSet with intersecting panel ids
```

The reactions are _long-lived during a gesture_. They use the pointer service's `subscribe` to listen, and they dispatch follow-up events via `onSuccess`/`onFailure` — or more idiomatically, they return events directly inside the run callback's `ctx.on()` handler (when treating pointer as a live source).

**Concurrency:** `switch` for each gesture type, so a fresh `beginDrag` aborts a stuck one. Different gesture types are independent (drag + pan can't coexist anyway because pan requires modifier-held).

### 5.4 `selectionOrch`

```ts
deps: { selection: selectionStore, registry: registryStore }

queries:
  selectedIds      : pass-through
  selectedPanels   : () => deps.selection.selectedIds().map(id => deps.registry.byId(id)()).filter(Boolean)
  isSelected(id)   : pass-through
  primarySelection : pass-through

commands:
  select({ id, additive? })   => panelSelected event
  deselect({ id })            => panelDeselected event
  clear()                     => selectionCleared event
  set({ ids })                => selectionSet event

reactions: none
```

### 5.5 `passthroughOrch`

```ts
deps: { passthroughs: passthroughsStore }

queries:
  byId(id)        : pass-through
  all             : pass-through
  // Helper query: given a DOM element id (from data-canvas-passthrough-id),
  // does the registered region block a given concern?
  blocks(id, concern: "pan" | "zoom" | "wheel" | "drag" | "select")
    : () => boolean

commands:
  register({ id, config })   => passthroughRegistered event
  unregister({ id })          => passthroughUnregistered event

reactions: none
```

---

## 6. Graph factory

A single internal factory wires it all up:

```ts
// src/internal/createCanvasGraph.ts
import { createStrata, type ResolvedStrata } from "@mattfletcher94/strata";
import type { CanvasOptions } from "@/types";

import { viewportStore } from "./stores/viewport";
import { registryStore } from "./stores/registry";
import { gesturesStore } from "./stores/gestures";
import { selectionStore } from "./stores/selection";
import { passthroughsStore } from "./stores/passthroughs";

import { pointerService } from "./services/pointer";

import { viewportOrch } from "./orchestrators/viewport";
import { registryOrch } from "./orchestrators/registry";
import { gestureOrch } from "./orchestrators/gesture";
import { selectionOrch } from "./orchestrators/selection";
import { passthroughOrch } from "./orchestrators/passthrough";

export type CanvasGraph = ResolvedStrata<{
  stores: {
    viewport: typeof viewportStore;
    registry: typeof registryStore;
    gestures: typeof gesturesStore;
    selection: typeof selectionStore;
    passthroughs: typeof passthroughsStore;
  };
  orchestrators: {
    viewportOrch: typeof viewportOrch;
    registryOrch: typeof registryOrch;
    gestureOrch: typeof gestureOrch;
    selectionOrch: typeof selectionOrch;
    passthroughOrch: typeof passthroughOrch;
  };
}>;

export function createCanvasGraph(opts: CanvasOptions): CanvasGraph {
  return createStrata({
    name: "strata-canvas",
    responsibility: "Internal graph for a single canvas instance.",
    services: { pointer: pointerService },
    stores: {
      viewport: viewportStore,
      registry: registryStore,
      gestures: gesturesStore,
      selection: selectionStore,
      passthroughs: passthroughsStore,
    },
    orchestrators: {
      viewportOrch,
      registryOrch,
      gestureOrch,
      selectionOrch,
      passthroughOrch,
    },
  });
}
```

This factory is **internal**. It's never exported from the public package. The public `createCanvas(opts)` function calls it privately and constructs the namespaced component object around it.

---

## 7. Vue integration layer

### 7.1 The boundary

| Concern                                                      | Where it lives                                 |
| ------------------------------------------------------------ | ---------------------------------------------- |
| Geometric state (position, size, parent/child tree)          | Graph (registry store)                         |
| Active gesture state machine                                 | Graph (gestures store)                         |
| Pointer event ingestion                                      | Graph (pointer service + gesture orchestrator) |
| Raw proposed-box computation (pointer delta + handle math)   | Graph (gesture orchestrator)                   |
| Viewport state + pan/zoom                                    | Graph (viewport store)                         |
| Selection state                                              | Graph (selection store)                        |
| Passthrough configs by id                                    | Graph (passthroughs store)                     |
| Consumer's `bounds` and `resolve` functions                  | Vue (panel component props)                    |
| Constraint pipeline (apply bounds + resolve to raw proposed) | Vue (panel component effect)                   |
| Reactive consistency (parent change → child re-clamp)        | Vue (panel component watcher)                  |
| DOM ↔ passthrough-id mapping                                 | Vue (passthrough component, via `data-*` attr) |
| `v-model` sync between consumer ref and graph state          | Vue (panel component watchers)                 |

### 7.2 Canvas.Root setup

```ts
const opts = props.config ?? defaultOptions()
const graph = createCanvasGraph(opts)

// Wire viewport v-model
const viewport = defineModel<ViewportState>("viewport", { default: ... })
const graphViewportRef = useStrataQuery(graph.viewportOrch.state)
watch(viewport, (next) => graph.viewportOrch.setViewport(next), { deep: true })
watch(graphViewportRef, (next) => {
  if (!shallowEqual(next, viewport.value)) viewport.value = next
})

// Wire selection v-model
const selection = defineModel<readonly string[]>("selection", { default: () => [] })
// similar

// Provide context
const canvasContext: CanvasContext = {
  _graph: graph,
  viewport: graphViewportRef,
  pan: (dx, dy) => graph.viewportOrch.pan({ dx, dy }),
  zoomTo: (z, around) => graph.viewportOrch.zoomTo({ zoom: z, around }),
  fitTo: (...) => graph.viewportOrch.fitTo(...),
  screenToWorld: (p) => graph.viewportOrch.screenToWorld(p)(),
  worldToScreen: (p) => graph.viewportOrch.worldToScreen(p)(),
  markEventAsHandled: (e) => handledEvents.add(e),
  isHandled: (e) => handledEvents.has(e),
  select: (id, opts) => graph.selectionOrch.select({ id, additive: opts?.additive }),
  clearSelection: () => graph.selectionOrch.clear(),
  selection: useStrataQuery(graph.selectionOrch.selectedIds),
}
provideCanvasContext(canvasContext)

// Dispose on unmount
onBeforeUnmount(() => graph.$dispose({ timeout: 100 }))
```

### 7.3 Canvas.Panel setup — the pipeline integration point

This is the most subtle component. Walkthrough:

```ts
const canvas = injectCanvasContext()
const parentPanel = tryPanelContext()
const props = defineProps<PanelProps>()
const modelValue = defineModel<Box>({ required: true })

const id = useId()

// 1. Mount this panel into the graph
onMounted(() => {
  canvas._graph.registryOrch.mountPanel({
    id, parentId: parentPanel?.id ?? null, state: modelValue.value,
  })
})
onBeforeUnmount(() => {
  canvas._graph.registryOrch.unmountPanel({ id })
})

// 2. Bridge consumer state → graph state (when consumer ref changes externally)
watch(modelValue, (next) => {
  const cur = canvas._graph.registryOrch.byId(id)()
  if (cur && !boxEqual(cur, next)) {
    canvas._graph.registryOrch.commitPanelState({ id, state: next })
  }
}, { deep: true })

// 3. Bridge graph state → consumer state
const graphPanelRow = useStrataQuery(() => canvas._graph.registryOrch.byId(id))
watch(graphPanelRow, (next) => {
  if (next && !boxEqual(modelValue.value, next)) {
    modelValue.value = { x: next.x, y: next.y, width: next.width, height: next.height }
  }
})

// 4. THE CONSTRAINT PIPELINE — Vue effect, runs every gesture frame
const gestureFrame = useStrataQuery(() => canvas._graph.gestureOrch.rawProposedFor(id))
watch(gestureFrame, (rawProposed) => {
  if (!rawProposed) return  // no gesture targeting this panel
  const ctx = buildResolveCtx({ panel: graphPanelRow.value!, graph: canvas._graph, gesture: ... })
  const bounds = resolveBoundsValue(props.bounds, ctx)
  let box = bounds ? clampBox(rawProposed, bounds) : rawProposed
  if (props.resolve) box = props.resolve(box, { ...ctx, bounds })
  canvas._graph.registryOrch.commitPanelState({ id, state: box })
})

// 5. REACTIVE CONSISTENCY — when parent (or siblings, viewport) change reactively,
//    re-evaluate constraints with current state and emit commit if needed
watch(
  // Sources: parent state, viewport, this panel's bounds/resolve props
  [
    () => parentPanel?.state.value,
    () => canvas.viewport.value,
    () => props.bounds,
    () => props.resolve,
  ],
  () => {
    // Skip if a gesture is active on this panel — the gesture loop handles it
    if (canvas._graph.gestureOrch.isPanelDragging(id)() ||
        canvas._graph.gestureOrch.isPanelResizing(id)()) return

    const current = graphPanelRow.value
    if (!current) return
    const ctx = buildResolveCtx({ panel: current, graph: canvas._graph, gesture: "reflow" })
    const bounds = resolveBoundsValue(props.bounds, ctx)
    let box = bounds ? clampBox(current, bounds) : current
    if (props.resolve) box = props.resolve(box, { ...ctx, bounds })
    if (!boxEqual(box, current)) {
      canvas._graph.registryOrch.commitPanelState({ id, state: box })
    }
  },
  { deep: true },
)

// 6. Provide panel context to descendants
const panelContext: PanelContext = {
  id,
  state: computed(() => graphPanelRow.value ?? { x: 0, y: 0, width: 0, height: 0 }),
  worldPosition: computed(() => canvas._graph.registryOrch.worldPosition(id)()),
  parent: parentPanel,
  // ...
  beginDrag: (e) => canvas._graph.gestureOrch.beginDrag({ panelId: id, ... }),
  beginResize: (e, handle) => canvas._graph.gestureOrch.beginResize({ panelId: id, handle, ... }),
  select: (opts) => canvas._graph.selectionOrch.select({ id, additive: opts?.additive }),
}
providePanelContext(panelContext)
```

Key points:

- The graph stores raw geometric state only
- The constraint pipeline is a _Vue effect_, parameterized by Vue props
- Reactive consistency cascades naturally: when a parent's state updates in the graph, the child panel's watcher fires (because parent state is a reactive query bridge), re-runs the pipeline, dispatches a commit if needed
- v-model bidirectional sync uses shallow-equal guards to prevent loops

### 7.4 Constraint pipeline helper

```ts
// src/internal/pipeline.ts
import type { Box, Rect, ResolveCtx, ResolveFn, BoundsFn } from "@/types";
import { clampBox } from "@/utils";

export type BoundsValue = Rect | { value: Rect } /* Ref<Rect> */ | BoundsFn;

export function resolveBoundsValue(value: BoundsValue | undefined, ctx: ResolveCtx): Rect | null {
  if (!value) return null;
  if (typeof value === "function") return value(ctx);
  if ("minX" in value) return value;
  return value.value;
}
```

Plus a `buildResolveCtx` helper that gathers parent/siblings/viewport from the graph and assembles a `ResolveCtx`. **These helpers live in the Vue layer, not the graph.** They're pure utilities consumed by the Vue panel component.

This is the one place we tolerate "floating functions" outside the three-tier system — they're integration-layer helpers, used by a single Vue component, never exported to consumers.

---

## 8. End-to-end flow for a drag

1. User pointerdowns on `<Canvas.DragHandle>` inside `<Canvas.Panel id="a">`.
2. DragHandle component calls `panel.beginDrag(e)`, which dispatches `gestureOrch.beginDrag({ panelId: "a", pointer, modifiers })`.
3. Command returns `{ events: [dragBegun({ corrId, panelId: "a", startPointer, modifiers, startBox })] }`. Projection on `gestures` store sets `gestures.drag = {...}`.
4. `runDrag` reaction fires (subscribed to `dragBegun`). It calls `services.pointer.subscribe(...)` and stays alive until pointerup.
5. On each `pointermove` (rAF-coalesced by the service): the reaction's move handler dispatches `dragAdvanced({ corrId, currentPointer, modifiers, rawProposed })`. Projection updates `gestures.drag.currentPointer` and `gestures.drag.rawProposed`.
6. The Vue `<Canvas.Panel id="a">`'s `watch(gestureFrame)` fires because the query `gestureOrch.rawProposedFor("a")` returned a new value.
7. The Vue effect runs the constraint pipeline locally:
   - Build `ResolveCtx` from graph queries (parent, siblings, viewport)
   - Resolve `props.bounds` to a Rect
   - Clamp `rawProposed` to that Rect
   - Call `props.resolve(box, ctx)` if defined
   - Dispatch `registryOrch.commitPanelState({ id: "a", state: finalBox })`
8. Projection on `registry` store updates `panels["a"]`. `panelStateUpdated` event fires.
9. Vue panel's `watch(graphPanelRow)` fires. It compares with `modelValue.value` (shallow-equal) and if different, sets `modelValue.value = ...` — which triggers the consumer's `update:modelValue` emit.
10. Concurrently, if `a` has children, each child panel's reactive-consistency watcher fires (parent state changed → re-run pipeline → maybe commit). This cascades the whole subtree in one tick of Vue's scheduler.
11. On pointerup: reaction dispatches `dragEnded({ corrId, currentPointer })`. Projection clears `gestures.drag`. Vue panel's gesture watcher fires with `null` — no action. `@drag-end` event emits to the consumer (via a Vue effect watching `isPanelDragging` falling edge).

End-to-end, the consumer sees their `ref<Box>` mutate frame-by-frame, plus discrete `@drag-start` / `@drag-end` events.

---

## 9. Reactive consistency examples

### Parent resizes smaller; child must re-clamp

1. Parent's `<Canvas.Panel v-model="parent">` gesture commits new size: `parent.width = 100`.
2. Graph dispatches `panelStateUpdated({ id: "parent" })`. Projection updates registry.
3. Child Vue panel watches `parentPanel.state` — fires.
4. Re-runs pipeline with current child box as `proposed` (gesture: "reflow").
5. `restrictToParent` clamps child to new parent bounds.
6. If clamped box differs from current, dispatch `commitPanelState({ id: "child", state: clampedBox })`.
7. Child's consumer ref updates via the bridge.

No "enforce consistency" reaction in the graph — the cascade is purely Vue-driven, because the consumer's constraint functions live there.

### Constraint props change at runtime

1. Consumer mutates `:resolve="newResolveFn"` (e.g., switching from "free" to "snap-to-grid").
2. Vue panel's `watch([..., () => props.resolve, ...])` fires.
3. Re-runs pipeline with current box; if new constraint demands a different position, commits the change.

This is automatic from Vue reactivity. The graph never knows the resolve function changed.

---

## 10. Testing strategy

Three layers, three test types:

### Layer 1: pure graph (no Vue)

Build the graph directly with `createCanvasGraph()`, drive through orchestrator commands, assert via queries.

```ts
const graph = createCanvasGraph({ /* opts */ })

graph.registryOrch.mountPanel({ id: "a", parentId: null, state: { x: 0, y: 0, width: 100, height: 100 } })
graph.gestureOrch.beginDrag({ panelId: "a", pointer: { x: 0, y: 0 }, modifiers: {...} })

// Fake the pointer service for tests — replace before createStrata in test setup
fakePointer.emitMove({ x: 50, y: 30 })
await graph.$flush()

const drag = graph.gestureOrch.activeDrag()
expect(drag?.rawProposed).toEqual({ x: 50, y: 30, width: 100, height: 100 })

await graph.$dispose()
```

The raw proposed box is the SAME as what the graph computed — no constraint pipeline run because Vue isn't in the loop here. This is correct: graph tests verify gesture mechanics, not constraints.

### Layer 2: constraint pipeline helper (pure JS)

The `runPipeline(proposed, props, ctx)` helper in the Vue layer is a pure function. Unit-test it directly:

```ts
const result = runPipeline(
  { x: 150, y: 0, width: 50, height: 50 }, // proposed
  { bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } },
  fakeCtx(),
);
expect(result.x).toBe(50);
```

No Vue, no graph.

### Layer 3: component integration via `@vue/test-utils`

Mount `<Canvas.Root>` + `<Canvas.Panel>` against happy-dom, simulate pointer events, assert v-model mutates:

```ts
const panel = ref({ x: 0, y: 0, width: 100, height: 100 });
const wrapper = mount(TestHost, { props: { panel } });
const handle = wrapper.find("[data-canvas-drag-handle]");
await handle.trigger("pointerdown", { clientX: 0, clientY: 0 });
window.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, clientY: 30 }));
window.dispatchEvent(new PointerEvent("pointerup"));
await nextTick();
expect(panel.value.x).toBe(50);
```

This verifies the entire Vue ↔ graph wiring including the pipeline.

---

## 11. Why this architecture is correct

Cross-check against the Strata protocol:

| Rule                                       | How we comply                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only events change state (via projections) | All store mutations flow through projections dispatched from commands                                                                                                           |
| Commands are pure synchronous              | All commands return `{ events }`, never await, never call services                                                                                                              |
| Services contain all I/O                   | `pointer` service is the only I/O                                                                                                                                               |
| Reactions handle async work + I/O          | `runDrag`/`runResize`/`runPan`/`runBoxSelect` are the only async logic                                                                                                          |
| Past-tense projection names                | `panelMounted`, `dragBegun`, `viewportZoomed`, etc.                                                                                                                             |
| Action-noun reaction names                 | `runDrag`, `runResize`, `runPan`, `runBoxSelect`                                                                                                                                |
| Queries are pure derivations               | All queries read state, no side effects                                                                                                                                         |
| No functions/instances/Promises in state   | `PanelRow` is geometric only; functions live Vue-side                                                                                                                           |
| Optimistic mutations use overlays          | (Not directly applicable; we don't have async server mutations)                                                                                                                 |
| Loading state as projections               | Gesture state machine (`activeDrag` etc.) is projection-driven                                                                                                                  |
| No services in commands                    | Verified — services only in reactions                                                                                                                                           |
| No state in orchestrators                  | All state in stores                                                                                                                                                             |
| Live queries for long-running streams      | Could use one for the pointer subscription per gesture; currently use a reaction with `services.pointer.subscribe(...)` inside the run handler, which is the equivalent pattern |
| `$dispose` is async                        | `<Canvas.Root>` calls `graph.$dispose({ timeout: 100 })` on unmount                                                                                                             |

The Vue integration layer:

| Concern                             | Pattern                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| Function-bearing constraint props   | Stay in Vue props; never enter the graph                      |
| Pipeline computation                | Vue effect (`watch`) reading both graph queries and Vue props |
| Reactive consistency                | Vue watcher on parent state cascades through component tree   |
| v-model bidirectional sync          | Shallow-equal-guarded watchers in both directions             |
| Compound primitives + as / as-child | Reka pattern via copied `Primitive` + `createContext`         |

This is the most "Strata-pure" partition I can construct given the hard rule against functions in state. The graph handles everything Strata is good at (state machines, event coordination, I/O orchestration); Vue handles everything that requires consumer-provided logic (constraint application).

---

## 12. Implementation order

1. Stores (`viewport`, `registry`, `gestures`, `selection`, `passthroughs`)
2. `pointer` service
3. Orchestrators (`viewport`, `registry`, `selection`, `passthrough`, then `gesture`)
4. `createCanvasGraph` factory
5. Public utilities (`/utils`: clampBox, insetRect, etc.)
6. Public constraint factories (`/constraints`: restrictToParent, etc.)
7. Vue integration: `createCanvas` factory, context types, useStrataQuery bridge
8. `<Canvas.Root>` component
9. `<Canvas.Panel>` component (with pipeline integration)
10. `<Canvas.DragHandle>`, `<Canvas.ResizeHandle*>` (×8), `<Canvas.PassThrough>`, `<Canvas.Background>` components
11. Composables (`useCanvas`, `usePanel`)
12. Smoke tests + scenario tests
