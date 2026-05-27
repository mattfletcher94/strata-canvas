# Canvas Library — Design Proposal

A Vue 3 library for an infinite or finite canvas with draggable, resizable, recursively nestable panels. State management is built on Strata internally; the public API is fully declarative and consumer-owned via `v-model`.

**Status:** Design proposal — ready for review before scaffolding.
**Working name:** `@mattfletcher94/<name>` (TBD)
**Date:** 2026-05-22

---

## 1. Scope & non-goals

### In scope (v0)

- Pan + zoom canvas (infinite or finite mode)
- Draggable panels
- Resizable panels with per-position handles
- Recursive parent/child nesting via template structure (zero-depth → arbitrary depth)
- Custom drag handles and resize handles per panel
- Declarative constraint composition (bounds, resolve functions)
- Selection (click, additive shift-click, drag-select on empty canvas)
- Coexistence with third-party interactive content inside panels (yFiles, Monaco, etc.)

### Explicitly NOT in scope (v0, possibly never)

- **Edges / connections between panels** — never. This is not a node editor.
- Rotation
- Sibling collision avoidance as a built-in (reachable via custom resolve function)
- Magnetic alignment guides (reachable via custom resolve function)
- Built-in animations (consumer adds CSS `transition: transform`; library exposes `panel.animateTo()` if needed)
- Serialization / `exportJSON` / `loadJSON` (not the library's job — consumer watches refs and persists)
- Data-prop hydration as the primary API (compound components are primary; data-driven rendering via `v-for` is a usage pattern, not a separate API mode)

---

## 2. Core principles

1. **Consumer owns state.** All panel and viewport state lives in the consumer's reactive refs, bound to library components via `v-model`. The library is a renderer + gesture engine. There is no library-owned state surfaced through composables.

2. **Declarative through and through.** No controlled/uncontrolled split. No "default" props that secretly seed library-owned state. State flows in via props, changes flow out via emit. Standard Vue prop-down / event-up.

3. **No sugar (v0).** Every constraint is expressed as a function. No flat-prop sugar for `axis`, `snap`, `aspectRatio`, `minWidth`, `padding`, etc. Sugar is a DX layer to revisit after the function API is locked in.

4. **Compound components, Radix-style.** Every primitive is its own component. Composition in the template *is* the configuration. Handles (drag, resize) are declared as children — presence enables behavior.

5. **Structural composition, no magic strings.** No string IDs as lookup keys. `useCanvas()` and `usePanel()` find their target via inject (nearest ancestor). Cross-panel references happen via refs or scoped slots, not by id.

6. **Strata internally, never leaked.** The library uses Strata for its own coordination (gesture engine, constraint pipeline, multi-panel layout). The public surface never exposes Strata concepts.

7. **Smart defaults for conflict resolution.** Modifier-required pan/zoom (space+drag, Ctrl+wheel) means third-party content inside a panel Just Works without consumer intervention. Class-name escape hatches (`strata-nopan` etc.) and `<Canvas.PassThrough>` for the cases defaults don't cover.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Public API (consumer-facing)                                │
│                                                             │
│  createCanvas()  →  { Root, Background, Panel,              │
│                       DragHandle, ResizeHandle{N,E,S,W,     │
│                                                NE,NW,SE,SW},│
│                       PassThrough, useCanvas, usePanel }    │
│                                                             │
│  /constraints  →  named ResolveFn factories + compose       │
│  /utils        →  pure geometry helpers                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│ Internal: Strata graph (one per Canvas instance)            │
│                                                             │
│  Stores:                                                    │
│    • viewport   — pan offset, zoom, mode, bounds            │
│    • gestures   — active drag/resize state                  │
│    • registry   — panel context tree (mounted panels)       │
│                                                             │
│  Orchestrators:                                             │
│    • viewport   — pan, zoom, fitTo                          │
│    • gestures   — dragStart/Move/End, resizeStart/Move/End  │
│                                                             │
│  Services:                                                  │
│    • pointer    — window pointermove/up subscription        │
│    • raf        — frame coalescing for high-freq events     │
└─────────────────────────────────────────────────────────────┘
```

The Strata graph is created fresh per `createCanvas()` call. Multi-canvas-per-app is supported and isolated.

---

## 4. Factory & top-level options

```ts
import { createCanvas } from '@mattfletcher94/<name>'

const Canvas = createCanvas({
  mode: 'infinite',                              // 'infinite' | 'finite'
  bounds: { width: 5000, height: 5000 },         // required if mode === 'finite'

  zoom: {
    min: 0.1,
    max: 4,
    default: 1,
    wheel: 'ctrl',                               // 'ctrl' (default) | true | false
    pinch: true,
  },

  pan: {
    enabled: true,
    activator: 'space',                          // 'space' | 'middle' | 'always' | ('space'|'middle')[]
  },

  dragActivation: { distance: 4 },               // px before drag starts (prevents accidental drag-on-click)

  selection: {
    boxSelect: true,                             // bare drag on empty canvas = box select
    bringToFrontOnSelect: true,
  },

  classNames: {                                  // optional rename for escape-hatch classes
    nodrag: 'canvas-nodrag',
    nopan:  'canvas-nopan',
    nowheel:'canvas-nowheel',
    noselect:'canvas-noselect',
  },
})
```

`Canvas` is a frozen object containing the namespaced components and the typed composables. It also internally holds the Strata graph instance.

---

## 5. Primitives (compound components)

All primitives support:
- `as` prop — render a different element (e.g. `as="section"`)
- `as-child` prop — merge listeners/refs/data-attrs into the single child element instead of rendering a wrapper
- Scoped slot exposing component state (e.g. `{ active, hover }`)
- `data-*` attributes on the rendered element for CSS targeting

### 5.1 `<Canvas.Root>`

The viewport. Provides `CanvasContext`. Owns pan/zoom gestures.

```vue
<Canvas.Root v-model:viewport="viewport" v-model:selection="selection">
  <Canvas.Background />
  <!-- panels -->
</Canvas.Root>
```

| Prop | Type | Default |
|---|---|---|
| `v-model:viewport` | `Ref<{ x, y, zoom }>` | uncontrolled OK |
| `v-model:selection` | `Ref<PanelHandle[]>` | uncontrolled OK |
| `as` / `as-child` | element/component | `<div>` |

### 5.2 `<Canvas.Background>`

Optional. Renders dots/grid/whatever via slot. Default: empty.

```vue
<Canvas.Background v-slot="{ viewport, zoom }">
  <svg>...</svg>
</Canvas.Background>
```

### 5.3 `<Canvas.Panel>`

The core primitive. Reads its state from `v-model` on `{ x, y, width, height }`. Provides `PanelContext` to descendants. Recursive — `<Canvas.Panel>` inside another panel becomes a child in the panel tree.

```vue
<Canvas.Panel v-model="panel" :bounds="boundsFn" :resolve="resolveFn">
  <!-- handles -->
  <Canvas.DragHandle />
  <Canvas.ResizeHandleSE />

  <!-- content -->
  <div>...</div>

  <!-- nested panels -->
  <Canvas.Panel v-model="child">...</Canvas.Panel>
</Canvas.Panel>
```

#### Props

| Prop | Type | Default |
|---|---|---|
| `v-model` | `Ref<Box>` | required |
| `bounds` | `Rect \| Ref<Rect> \| ((ctx) => Rect)` | none |
| `resolve` | `ResolveFn` | none |
| `selectable` | `boolean` | `true` |
| `disabled` | `boolean` | `false` (overrides all gestures) |
| `z` | `number` | document order |
| `as` / `as-child` | element/component | `<div>` |

#### Emits

| Event | Payload | When |
|---|---|---|
| `update:modelValue` | `Box` | Every gesture frame + reactive consistency re-clamps |
| `drag-start` | `{ box, pointer }` | Drag activation threshold crossed |
| `drag-end` | `{ box }` | Drag pointer released |
| `resize-start` | `{ box, handle }` | Resize gesture begins |
| `resize-end` | `{ box, handle }` | Resize gesture ends |
| `select` | `{ additive: boolean }` | Panel selected via click |
| `reparent` | `{ newParent: PanelHandle \| null }` | Drag-into-different-parent (consumer mutates their tree) |

#### Behavior is declared by children

A `<Canvas.Panel>` with no children is **inert** — no drag, no resize. Behavior is enabled by declaring handle components inside:

- `<Canvas.DragHandle>` present → panel draggable
- Any `<Canvas.ResizeHandle*>` present → panel resizable from those positions
- No props turn drag/resize on or off — only `disabled` overrides everything

### 5.4 `<Canvas.DragHandle>`

When pointerdown lands on this element, the nearest ancestor `<Canvas.Panel>` begins drag.

```vue
<Canvas.DragHandle />                            <!-- default <div>, fills nothing -->
<Canvas.DragHandle as="button" />                <!-- as a button -->
<Canvas.DragHandle as-child>
  <header class="title-bar">My Panel</header>    <!-- merges into the header -->
</Canvas.DragHandle>
```

| Prop | Type | Default |
|---|---|---|
| `as` | element/component | `<div>` |
| `as-child` | boolean | `false` |

Scoped slot exposes `{ active: boolean, hover: boolean }`. `data-canvas-drag-handle` + `data-active` attributes are emitted for CSS targeting.

### 5.5 `<Canvas.ResizeHandle{N,E,S,W,NE,NW,SE,SW}>`

Eight components, one per position. Same shape as `DragHandle`; binds to its position on the nearest ancestor `<Canvas.Panel>`. Declaring `<Canvas.ResizeHandleSE>` enables SE resize on that panel.

```vue
<Canvas.ResizeHandleN />
<Canvas.ResizeHandleE />
<Canvas.ResizeHandleS as="button" />
<Canvas.ResizeHandleNW as-child>
  <button aria-label="Resize from top-left">↖</button>
</Canvas.ResizeHandleNW>
```

| Prop | Type | Default |
|---|---|---|
| `as` | element/component | `<div>` |
| `as-child` | boolean | `false` |

Slot scope: `{ active, hover }`. Data attrs: `data-canvas-resize-handle="se"`, `data-active`.

Default styling: positioned absolutely at the relevant edge/corner with the correct CSS cursor (`cursor: nwse-resize` for `NW`/`SE`, etc.). No visual rendering by default — consumer styles the `<div>` or uses `as-child` to supply their own.

### 5.6 `<Canvas.PassThrough>`

Marks a subtree as opaque to canvas-level gestures. Used when defaults aren't enough (e.g., consumer set `zoom: { wheel: true }` globally but one panel hosts yFiles).

```vue
<Canvas.PassThrough :pan :zoom :wheel :drag :select>
  <YFilesCanvas />
</Canvas.PassThrough>
```

| Prop | Type | Default |
|---|---|---|
| `pan` | boolean | `true` |
| `zoom` | boolean | `true` |
| `wheel` | boolean | `true` |
| `drag` | boolean | `true` |
| `select` | boolean | `true` |
| `as` / `as-child` | | `<div>` |

Equivalent low-level escape: any element with `class="canvas-nopan canvas-nowheel canvas-nodrag"` (class names configurable on `createCanvas`).

---

## 6. Composables

```ts
const Canvas = createCanvas(...)
const { useCanvas, usePanel } = Canvas       // typed
// Or package-level fallback (also typed via inject):
import { useCanvas, usePanel } from '@mattfletcher94/<name>'
```

### 6.1 `useCanvas()`

Returns the nearest `<Canvas.Root>` context.

```ts
interface CanvasContext {
  // reactive viewport state (mirrors v-model on Root)
  viewport: Ref<{ x: number; y: number; zoom: number }>
  bounds: Ref<Rect | null>
  mode: 'infinite' | 'finite'
  selection: Ref<PanelHandle[]>

  // imperative ops
  pan(dx: number, dy: number): void
  zoomTo(z: number, opts?: { around?: Point }): void
  fitTo(targets?: 'all' | PanelHandle[], opts?: { padding?: number }): void
  screenToWorld(p: Point): Point
  worldToScreen(p: Point): Point

  // gesture cooperation (tldraw pattern; better than e.stopPropagation())
  markEventAsHandled(e: Event): void
  isHandled(e: Event): boolean

  // selection
  select(panel: PanelHandle, opts?: { additive?: boolean }): void
  clearSelection(): void
}
```

### 6.2 `usePanel()`

Returns the nearest ancestor `<Canvas.Panel>` context. Used by `<Canvas.DragHandle>`, `<Canvas.ResizeHandle*>`, and any descendant component that needs panel state.

```ts
interface PanelContext {
  // reactive state (sourced from the panel's v-model)
  state: Ref<Box>                 // { x, y, width, height } in parent-local coords
  worldPosition: Ref<Point>       // computed by walking parent chain
  parent: PanelContext | null     // nearest ancestor panel (null at root level)
  children: Ref<PanelContext[]>   // immediate child panels

  // gesture lifecycle
  isDragging: Ref<boolean>
  isResizing: Ref<boolean>
  isSelected: Ref<boolean>

  // imperative ops
  update(patch: Partial<Box>): void          // dispatches v-model update
  select(opts?: { additive?: boolean }): void
  bringToFront(): void
  sendToBack(): void
  animateTo(target: Partial<Box>, opts?: { duration?: number; easing?: string }): Promise<void>
}
```

**Critical:** `usePanel()` is context-only — no string-id argument. Cross-panel references happen via direct ref/handle passing (template ref on the panel, or scoped slot exposing the context).

---

## 7. State ownership & data flow

### Consumer owns state

```vue
<script setup lang="ts">
const panel = ref<Box>({ x: 100, y: 100, width: 200, height: 120 })
</script>

<template>
  <Canvas.Panel v-model="panel">...</Canvas.Panel>
</template>
```

The library reads `panel` via the `modelValue` prop and emits `update:modelValue` on:
- Every gesture frame (drag, resize)
- Reactive consistency re-clamps (e.g., parent shrinks, child must re-clamp to bounds)

The consumer's ref is the single source of truth. No internal library copy.

### Nested data → nested template → nested panels

The library reads parent/child structure from the **rendered component tree**, not from a `parentId` data field. Two natural data shapes for many-panel scenarios:

**Nested arrays (recommended):**
```ts
const tree = ref([
  { id: 'a', x: 100, y: 100, width: 300, height: 200, children: [
    { id: 'a.1', x: 10, y: 10, width: 80, height: 50, children: [] }
  ]},
])
```

Recursive component:
```vue
<!-- PanelTree.vue -->
<script setup lang="ts">
defineProps<{ panel: PanelData }>()
</script>

<template>
  <Canvas.Panel v-model="panel" :resolve="panel.resolve" :bounds="panel.bounds">
    <Canvas.DragHandle />
    <slot :panel="panel" />
    <PanelTree v-for="child in panel.children" :key="child.id" :panel="child" />
  </Canvas.Panel>
</template>
```

**Flat with `parentId` (also supported, consumer builds the tree):**
Consumer groups by `parentId` and renders the tree manually. The library doesn't read `parentId` — it only sees the rendered structure.

### Persistence pattern

```ts
// per-panel save on drop
<Canvas.Panel v-model="panel" @drag-end="(e) => save(panel)" />

// bulk derived snapshot, debounced
const snapshot = computed(() => panels.value.map(p => ({...})))
watchDebounced(snapshot, save, { debounce: 500 })

// or watch deeply
watch(panels, save, { deep: true })
```

### Reactive constraint consistency

When ancestor state changes such that a descendant's current box violates its declared `bounds` or `resolve`:
- Library emits `update:modelValue` to re-clamp the descendant
- Cascades resolved in document order within a single reactive tick
- Policy: **child-specific constraints win over inherited ones** (a child's `:min-width` holds even if parent shrinks below it; child overflows parent visually)
- Translation of parent (x/y change only) does NOT require re-emit — children's parent-relative coords stay valid; their world position updates via parent's DOM transform

---

## 8. Constraint pipeline

### Two props

```ts
interface PanelProps {
  bounds?:  Rect | Ref<Rect> | ((ctx: ResolveCtx) => Rect)
  resolve?: ResolveFn
}

type ResolveFn = (proposed: Box, ctx: ResolveCtx) => Box
```

### Pipeline order

```
gesture produces proposed Box
  → bounds (clamp Box to Rect, if `bounds` prop set)
  → resolve (consumer function, if `resolve` prop set)
  → committed Box (emitted via update:modelValue)
```

Two steps. No built-in axis/snap/aspect-ratio/size-clamp stages — all of those go through `:resolve` (using library-provided ResolveFn factories).

### `ResolveCtx`

```ts
interface ResolveCtx {
  current: Box                          // panel's box at start of this frame
  bounds: Rect | null                   // resolved from `bounds` prop, if any
  parent: PanelInfo | null              // nearest ancestor panel (live state)
  siblings: PanelInfo[]                 // immediate siblings (live state)
  viewport: Rect                        // current viewport
  pointer: { x: number; y: number }     // current pointer in world coords
  modifiers: { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean }
  gesture: 'drag' | 'resize'
  handle?: 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw'   // resize only
}

interface PanelInfo {
  id: string                            // auto or consumer-provided
  x: number; y: number
  width: number; height: number
}

interface Box { x: number; y: number; width: number; height: number }
interface Rect { minX: number; minY: number; maxX: number; maxY: number }
```

### Library exports — `/constraints`

ResolveFn factories. All are pure functions; composable via `compose`.

```ts
// containment
restrictToParent      : ResolveFn
restrictToViewport    : ResolveFn
restrictToRect(rect: Rect | Ref<Rect> | ((ctx) => Rect))  : ResolveFn

// axis / size
lockAxis(axis: 'x' | 'y')                                 : ResolveFn
withMinSize(opts: { width?: number; height?: number })    : ResolveFn
withMaxSize(opts: { width?: number; height?: number })    : ResolveFn
withAspectRatio(ratio: number | 'lock')                   : ResolveFn

// grid
snapToGrid(grid: number | { x: number; y: number })       : ResolveFn

// padding (tightens ctx.bounds before clamping)
withPadding(p: number | { top, right, bottom, left }      : ResolveFn

// exclusion
avoidRect(rect: Rect | Ref<Rect>)                         : ResolveFn
pushOutOfRect(rect: Rect | Ref<Rect>)                     : ResolveFn
avoidSiblings                                             : ResolveFn

// bounds helpers (return Rect, useful inside bounds prop or for composition)
parentBox(ctx)                                            : Rect
viewportBox(ctx)                                          : Rect

// composition
compose(...fns: ResolveFn[])                              : ResolveFn  // left-to-right
```

### Library exports — `/utils`

Pure geometry. Useful for writing custom resolve functions.

```ts
clampBox(box: Box, rect: Rect)                            : Box
insetRect(rect: Rect, padding: number | { x, y } | per-side) : Rect
expandRect(rect: Rect, padding: ...)                      : Rect
intersect(a: Rect, b: Rect)                               : Rect | null
rectsOverlap(a: Rect, b: Rect)                            : boolean
pointInRect(p: Point, rect: Rect)                         : boolean
snapPoint(p: Point, grid: number | { x, y })              : Point
anchorOf(handle: HandlePosition, currentBox: Box)         : Point
```

### Constraint examples

```ts
import {
  restrictToParent, withPadding, snapToGrid, avoidRect, compose,
} from '@mattfletcher94/<name>/constraints'

// Single rule
const stayInParent = restrictToParent

// Chain
const tight = compose(
  restrictToParent,
  withPadding(10),
  snapToGrid(8),
)

// With reactive forbidden zone
const forbidden = computed<Rect>(() => ({ ... }))
const withExclusion = compose(restrictToParent, avoidRect(forbidden))

// Custom rule
const dontCrossDiagonal: ResolveFn = (proposed, ctx) =>
  proposed.y < proposed.x ? ctx.current : proposed

// Mix
const composed = compose(restrictToParent, snapToGrid(10), dontCrossDiagonal)
```

```vue
<Canvas.Panel v-model="p" :resolve="composed" />
```

---

## 9. Gesture & event handling

### Defaults table

| Concern | Default | Effect |
|---|---|---|
| Drag activation threshold | `4px` | Click inside a panel doesn't accidentally drag it |
| Pan trigger | Space+drag (or middle-mouse) | Bare pointerdown inside content never pans |
| Zoom trigger | Ctrl/Cmd+wheel (or pinch) | Bare wheel inside content scrolls naturally |
| Box-select | Bare drag on empty canvas | Doesn't compete with panning |
| Keyboard | Active-element check on all listeners | Space inside `<input>` types a space |

### Drag

- Activates after pointer moves `dragActivation.distance` pixels (default 4)
- During drag, library reads `ctx` and runs the constraint pipeline on every frame (rAF-coalesced for smooth 60+ Hz)
- On pointerup, gesture ends; `@drag-end` fires
- `panel.isDragging` is `true` for the duration; `data-dragging` attribute on the panel element

### Resize

- Same lifecycle as drag, but activated from the specific `<Canvas.ResizeHandle*>` component
- `ctx.handle` reflects which handle started the gesture
- Anchor (opposite corner/edge) is fixed during resize; the gesture re-computes `x/y/width/height` accordingly

### Pan

- Activated by `pan.activator` modifier (space-hold or middle-mouse)
- During pan, `viewport.x/y` mutate; emits via `v-model:viewport` on `<Canvas.Root>`
- Pan does not affect any panel's state

### Zoom

- Activated by `zoom.wheel` modifier (default: Ctrl+wheel)
- Pinch gesture (touch) zooms regardless of wheel config
- Zoom is anchored on the pointer position by default

### High-frequency event handling

- All pointer events run through a rAF coalescer
- Multiple `pointermove` events per frame are merged before dispatch
- Result: stable 60+ FPS with hundreds of panels

---

## 10. Escape hatches for third-party content

Three coexisting forms, in order of reach-for:

### A. Class-name attributes (zero ceremony)

```vue
<YFilesCanvas class="canvas-nopan canvas-nowheel canvas-nodrag" />
```

Recognized class names:
- `canvas-nodrag` — pointerdown won't start panel drag
- `canvas-nopan` — won't pan canvas
- `canvas-nowheel` — won't zoom canvas
- `canvas-noselect` — won't trigger panel selection

Class names configurable on `createCanvas({ classNames: { ... } })`.

### B. `<Canvas.PassThrough>` component (declarative)

```vue
<Canvas.PassThrough>
  <YFilesCanvas />
</Canvas.PassThrough>
```

Defaults to blocking all four concerns. Props let you re-enable per concern.

### C. `useCanvas().markEventAsHandled(e)` (imperative)

For custom pointer handlers in consumer code:

```ts
function onMyClick(e: PointerEvent) {
  canvas.markEventAsHandled(e)
  // ... your logic
}
```

Better than `e.stopPropagation()` — doesn't break unrelated DOM listeners (tldraw pattern).

---

## 11. Context system

Following Reka UI's `createContext` pattern:

```ts
function createContext<T>(displayName: string): [
  provide: (value: T) => T,
  inject: () => T,                       // throws if used outside provider
  injectOptional: () => T | null,
]

const [provideCanvasContext, injectCanvasContext, tryCanvasContext] =
  createContext<CanvasContext>('CanvasContext')

const [providePanelContext, injectPanelContext, tryPanelContext] =
  createContext<PanelContext>('PanelContext')
```

- `<Canvas.Root>` provides `CanvasContext`
- `<Canvas.Panel>` provides `PanelContext` (and reads parent panel context, if nested)
- `<Canvas.DragHandle>`, `<Canvas.ResizeHandle*>`, `<Canvas.PassThrough>` inject `PanelContext` and/or `CanvasContext`
- `useCanvas()` and `usePanel()` are thin re-exports of the inject functions
- Strict variant (`inject`) throws with a clear message if used outside the provider; for example, "`<Canvas.DragHandle>` must be used inside `<Canvas.Panel>`"

---

## 12. Reka UI code reuse

Reka UI is MIT-licensed. The library copies the following pieces directly into our `src/` (with original copyright notice preserved at the top of each file):

- **`createContext` helper** — typed provide/inject with strict + optional variants
- **`<Primitive>` component** — generic wrapper supporting `as`, `as-child`, ref forwarding, attr/listener merging
- **`useForwardExpose`** — pattern for exposing a component's internal API via template ref
- Small utilities: `useId`, `useEmitAsProps`, etc., as needed

Attribution lives at the top of each copied file. No runtime dependency on Reka UI.

---

## 13. Type definitions (summary)

```ts
// Core shapes
interface Box { x: number; y: number; width: number; height: number }
interface Rect { minX: number; minY: number; maxX: number; maxY: number }
interface Point { x: number; y: number }
type HandlePosition = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

// Constraint pipeline
type ResolveFn = (proposed: Box, ctx: ResolveCtx) => Box
type BoundsFn  = (ctx: ResolveCtx) => Rect
type BoundsValue = Rect | Ref<Rect> | BoundsFn

interface ResolveCtx { /* see §8 */ }
interface PanelInfo  { /* see §8 */ }

// Public context types
interface CanvasContext { /* see §6.1 */ }
interface PanelContext  { /* see §6.2 */ }

// Panel handle (for selection arrays and cross-panel refs)
type PanelHandle = PanelContext           // alias; PanelContext is the handle

// Factory return type
interface CanvasNamespace {
  Root: Component
  Background: Component
  Panel: Component
  DragHandle: Component
  ResizeHandleN: Component
  ResizeHandleE: Component
  ResizeHandleS: Component
  ResizeHandleW: Component
  ResizeHandleNE: Component
  ResizeHandleNW: Component
  ResizeHandleSE: Component
  ResizeHandleSW: Component
  PassThrough: Component
  useCanvas: () => CanvasContext
  usePanel: () => PanelContext
}
```

---

## 14. Full usage example

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { createCanvas } from '@mattfletcher94/<name>'
import {
  restrictToParent, withPadding, snapToGrid, avoidRect, withAspectRatio,
  withMinSize, compose,
} from '@mattfletcher94/<name>/constraints'
import type { Box, Rect, ResolveFn } from '@mattfletcher94/<name>'

const Canvas = createCanvas({
  mode: 'infinite',
  zoom: { min: 0.1, max: 4, wheel: 'ctrl' },
  pan:  { activator: 'space' },
})

const viewport = ref({ x: 0, y: 0, zoom: 1 })

// Three top-level panels with different behaviors
const parent  = ref<Box>({ x: 100, y: 100, width: 400, height: 300 })
const child   = ref<Box>({ x: 20,  y: 20,  width: 80,  height: 80  })
const image   = ref<Box>({ x: 200, y: 200, width: 150, height: 100 })

const forbidden = computed<Rect>(() => ({
  minX: parent.value.width / 2, minY: 0,
  maxX: parent.value.width,     maxY: parent.value.height / 2,
}))

const childResolve = compose(
  restrictToParent,
  withPadding(10),
  avoidRect(forbidden),
)

const imageResolve = compose(
  withAspectRatio('lock'),
  withMinSize({ width: 100, height: 50 }),
  snapToGrid(8),
)

function saveAll() {
  // persist whenever state changes
}

watch([parent, child, image], saveAll, { deep: true })
</script>

<template>
  <Canvas.Root v-model:viewport="viewport">
    <Canvas.Background />

    <!-- Container panel with constrained child -->
    <Canvas.Panel v-model="parent">
      <Canvas.DragHandle as-child>
        <header class="title-bar">Parent</header>
      </Canvas.DragHandle>

      <Canvas.ResizeHandleSE />
      <Canvas.ResizeHandleE />
      <Canvas.ResizeHandleS />

      <div class="body">Parent content</div>

      <Canvas.Panel v-model="child" :resolve="childResolve">
        <Canvas.DragHandle />
        child
      </Canvas.Panel>
    </Canvas.Panel>

    <!-- Aspect-locked image panel -->
    <Canvas.Panel v-model="image" :resolve="imageResolve">
      <Canvas.DragHandle />
      <Canvas.ResizeHandleSE />
      <Canvas.ResizeHandleNW />
      <Canvas.ResizeHandleNE />
      <Canvas.ResizeHandleSW />
      <img src="..." />
    </Canvas.Panel>
  </Canvas.Root>
</template>
```

---

## 15. Things deliberately deferred (DX layer to add later)

After the function-based API is locked, revisit sugar layer in this order of value:

1. **`bounds="parent"` symbolic shortcut** — the most common case, hardest to express ergonomically as a function. Likely worth adding back.
2. **`aspect-ratio` prop** — geometry is heavy enough that the prop earns its place. Likely worth adding back.
3. **`snap`, `padding`** — borderline; one prop vs one import. Probably keep as functions.
4. **`axis`, `min/max-*`** — trivial in user code; probably never reintroduce as flat props.

The path is: ship the function API, gather real usage feedback, add sugar based on what's repeatedly verbose in real code.

---

## 16. Open questions

- **Library name.** Working name `@mattfletcher94/<name>`. Candidates to consider: `vue-strata-canvas`, `straight`, `infra`, anything else?
- **Selection model.** v-model:selection on `<Canvas.Root>` was sketched. Confirm exact shape: array of PanelContext refs, or array of panel state objects, or something else.
- **`bringToFrontOnSelect` default.** Currently `true`. Confirm.
- **Touch / pinch UX details.** Pinch zoom anchored on pinch midpoint, two-finger drag pans regardless of `pan.activator`. Confirm.
- **Accessibility.** Roving focus across selected panels, keyboard nudge (arrow keys move selected by 1px, Shift+arrow by 10px), screen-reader announcements. Not in v0 scope but should be designed-for in the primitives.
- **SSR safety.** Components should mount without DOM-access errors; pointer listeners attach in `onMounted`. Standard Vue 3 hygiene.

---

## 17. Implementation roadmap (rough)

1. Scaffold package + tooling (TypeScript, Vue 3, build, lint, vitest)
2. Copy in Reka UI primitives (`createContext`, `<Primitive>`) with attribution
3. Implement Strata internal graph: viewport store, gesture store, registry store + orchestrators
4. `<Canvas.Root>` + `useCanvas()` — viewport pan/zoom working
5. `<Canvas.Panel>` + `usePanel()` — static rendering, parent context wiring
6. `<Canvas.DragHandle>` + drag gesture pipeline (no constraints yet)
7. `bounds` prop + clamp step
8. `:resolve` prop + first few `/constraints` exports (restrictToParent, withPadding, compose)
9. `<Canvas.ResizeHandle*>` (×8) + resize gesture pipeline
10. `withAspectRatio`, `withMinSize/MaxSize`, `lockAxis`, `snapToGrid`, `avoidRect`
11. Selection model
12. `<Canvas.PassThrough>` + class-name escape hatches
13. Reactive consistency re-clamps on parent change
14. Docs + scenario test coverage

---

**End of proposal.**
