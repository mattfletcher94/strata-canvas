# @mattfletcher94/strata-canvas

Declarative Vue 3 canvas with draggable, resizable, recursively nestable panels. Compound components, consumer-owned state, function-based constraints. Powered by [Strata](https://github.com/mattfletcher94/strata) under the hood.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { createCanvas } from "@mattfletcher94/strata-canvas";

const Canvas = createCanvas();
const panel = ref({ x: 100, y: 100, width: 200, height: 120 });
</script>

<template>
  <Canvas.Root>
    <Canvas.Panel v-model="panel">
      <Canvas.DragHandle />
      <Canvas.ResizeHandleSE />
      Hello canvas
    </Canvas.Panel>
  </Canvas.Root>
</template>
```

---

## Install

```sh
pnpm add @mattfletcher94/strata-canvas
# or npm / yarn
```

Vue 3.5+ is a peer dependency. Strata is vendored — no other private packages required.

---

## Philosophy

**Consumer owns state.** Panel position/size lives in your reactive `ref`, bound through `v-model`. No internal copy, no controlled/uncontrolled split. Mutate your ref → the canvas updates. The library re-clamps when constraints require it.

**Declarative through and through.** Every behavioural axis is a function or a composable primitive. Constraints compose (`compose(restrictToParent, withPadding(10))`). Gestures compose (`[wheelZoom(), pan({ button: "middle" })]`). Nothing is hidden in flags.

**Compound components, no kitchen-sink props.** Behaviour is declared by template structure: drop in a `<Canvas.DragHandle>` to make the panel draggable; declare `<Canvas.ResizeHandleSE>` to enable SE resize. Reka UI's `as` / `as-child` on every primitive.

**State management lives in Strata.** Internally the canvas is a Strata graph (stores, services, orchestrators, reactions). Consumers never see Strata concepts — the public API is purely Vue components and composables. State is queryable, reactive, deterministic.

---

## Mental model

```
┌─ Vue layer (public API) ───────────────────────────────────┐
│                                                            │
│  <Canvas.Root>           composables: useCanvas, usePanel  │
│    <Canvas.Panel>        constraints: compose, restrict*…  │
│      <Canvas.DragHandle>  controls:   wheelZoom, pan…      │
│      <Canvas.ResizeHandle*> easing:  cubicBezier, easings  │
│      <Canvas.PassThrough>                                  │
│                                                            │
└────────────────────┬───────────────────────────────────────┘
                     │  v-model in, commands + queries below
┌────────────────────┴───────────────────────────────────────┐
│ Strata graph (internal — one per <Canvas.Root> instance)   │
│                                                            │
│  stores: viewport, registry, gestures, selection,          │
│          passthroughs, animations                          │
│  services: pointer                                         │
│  orchestrators: viewport, registry, gesture, selection,    │
│                 passthrough, animation                     │
└────────────────────────────────────────────────────────────┘
```

The Vue layer is a thin adapter. All state flows through Strata; gestures, animation requests, and panel registration are all event-sourced.

---

## Core primitives

| Component                                  | Purpose                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `<Canvas.Root>`                            | Viewport. Provides context. Owns pan/zoom transform.                                         |
| `<Canvas.Panel>`                           | A node. `v-model="{x,y,width,height}"`. Recursively nestable. `:fixed` pins to screen space. |
| `<Canvas.DragHandle>`                      | Opt-in drag region. Presence enables drag.                                                   |
| `<Canvas.ResizeHandleN/E/S/W/NE/NW/SE/SW>` | Per-position resize handles. Presence enables resize from that edge/corner.                  |
| `<Canvas.PassThrough>`                     | Opaque region for third-party content (yFiles, Monaco). Canvas controls back off inside.     |
| `<Canvas.Background>`                      | Slot wrapper for grids/dots/custom backgrounds.                                              |

Every primitive supports `as` (different element) and `as-child` (merge into existing child element).

---

## Composables

```ts
import { useCanvas, usePanel } from "@mattfletcher94/strata-canvas";

const canvas = useCanvas(); // anywhere under <Canvas.Root>
const panel = usePanel(); // anywhere under <Canvas.Panel> (nearest ancestor)
```

Or capture the canvas context from outside via a template ref:

```vue
<Canvas.Root ref="canvasRef">…</Canvas.Root>

<script setup>
const canvasRef = useTemplateRef < { canvas: CanvasContext } > "canvasRef";
canvasRef.value?.canvas.fitTo("all", { duration: 400 });
</script>
```

---

## Constraints (`/constraints`)

Constraints are pure functions: `(proposed: Box, ctx: ResolveCtx) => Box`. They compose left-to-right via `compose(...)`.

```ts
import {
  compose,
  restrictToParent,
  withPadding,
  snapToGrid,
  avoidSiblings,
} from "@mattfletcher94/strata-canvas/constraints";

const sticky = compose(restrictToParent, withPadding(10), snapToGrid(8));
```

```vue
<Canvas.Panel v-model="p" :resolve="sticky" />
```

Built-ins:

- **Containment**: `restrictToParent`, `restrictToViewport`, `restrictToRect(rect)`, `restrictSizeToParent`
- **Axes / size**: `lockAxis('x'|'y')`, `withMinSize({width, height})`, `withMaxSize(…)`, `withAspectRatio(ratio | 'lock')`
- **Grid**: `snapToGrid(n | {x, y})`
- **Padding**: `withPadding(n | { top, right, bottom, left })`
- **Exclusion**: `avoidRect(rect)`, `pushOutOfRect(rect)`, `avoidSiblings`

Custom constraints are just functions:

```ts
const dontCrossDiagonal: ResolveFn = (proposed, ctx) =>
  proposed.y < proposed.x ? ctx.current : proposed;
```

---

## Controls (`/controls`)

Pan, zoom, select — all composable `Control` objects passed to `<Canvas.Root>`. Default gestures (Figma/Miro convention) ship via `defaultControls()`:

```ts
import { defaultControls, wheelZoom, pan }
  from "@mattfletcher94/strata-canvas/controls";

// Default: Ctrl+wheel zoom, middle-mouse pan, Space+drag pan, passthrough blockers
<Canvas.Root :controls="defaultControls()">

// Or build your own
<Canvas.Root :controls="[
  wheelZoom({ modifiers: ['ctrl'] }),
  pan({ button: 'left', onlyBackground: true }),  // bare-left-drag pans on empty canvas
]">
```

Custom controls — same `defineControl` shape as built-ins:

```ts
import { defineControl } from "@mattfletcher94/strata-canvas/controls";

export function wasdPan(opts: { step?: number } = {}) {
  const step = opts.step ?? 20;
  return defineControl({
    id: "wasdPan",
    onKeyDown(e, ctx) {
      if (e.key === "w") ctx.graph.viewportOrch.pan({ dx: 0, dy: step });
      if (e.key === "s") ctx.graph.viewportOrch.pan({ dx: 0, dy: -step });
      // …
    },
  });
}
```

Composed priorities: higher wins; first pointer/wheel claimer takes exclusivity until pointerup.

---

## Animated viewport ops

```ts
const canvas = useCanvas();

await canvas.fitTo("all", { duration: 400, padding: 40 });
await canvas.fitTo(panelHandle, { maxZoom: 1, easing: "easeOutCubic" });
await canvas.centerOn(panelHandle, { duration: 250 });
await canvas.animateViewport({ zoom: 1, x: 0, y: 0 }, { duration: 300 });
canvas.stopAnimation();
```

Easings live in `/easing`:

```ts
import { easings, cubicBezier } from "@mattfletcher94/strata-canvas/easing";
// built-ins: linear, easeIn/Out/InOut, easeOutCubic, easeInOutCubic, easeOutExpo
// custom: cubicBezier(x1, y1, x2, y2)
```

`fitTo("all")` walks the registry; pass a `PanelContext` or `Rect` to scope. `:padding` accepts per-side values for asymmetric overlay-aware fits.

---

## Fixed panels

`:fixed` pins a panel to screen space — it stops moving with pan/zoom but stays fully interactive.

```vue
<Canvas.Panel v-model="minimap" fixed :resolve="restrictToViewport">
  <Canvas.DragHandle>::</Canvas.DragHandle>
  <Canvas.ResizeHandleSE />
  <Minimap />
</Canvas.Panel>
```

When `fixed=true`:

- Panel teleports to a screen-coord overlay layer (no transform applies)
- `{x, y, width, height}` are screen pixels relative to the canvas root
- Drag math is 1:1 with cursor at any zoom level
- Registry treats it as root (no logical parent), regardless of template nesting

Toggle `:fixed` at runtime to dock/undock. Numbers don't auto-convert across the toggle — use `canvas.worldToScreen()` / `canvas.screenToWorld()` to bridge if you want continuity.

---

## Passthrough for third-party content

Third-party widgets (yFiles, Monaco, video players) bring their own pointer/wheel/keyboard semantics. Tell the canvas to back off:

```vue
<Canvas.Panel v-model="editor">
  <Canvas.DragHandle>title</Canvas.DragHandle>
  <Canvas.PassThrough>
    <MonacoEditor />
  </Canvas.PassThrough>
</Canvas.Panel>
```

Or inline class names on any element (great for cases you can't wrap):

```vue
<YFilesView class="canvas-nopointer canvas-nowheel canvas-nokey" />
```

Per-event-kind control:

```vue
<!-- Block only wheel — still let the canvas pan over this region -->
<Canvas.PassThrough :pointer="false" :keyboard="false">
  <ZoomyComponent />
</Canvas.PassThrough>
```

Default `<Canvas.PassThrough>` blocks pointer, wheel, AND keyboard inside its region.

---

## Recursive nesting

Panels nest naturally. Child coords are parent-relative. The library reads parent/child structure from the rendered component tree — no `parentId` data fields.

```vue
<Canvas.Panel v-model="parent">
  <Canvas.DragHandle>parent</Canvas.DragHandle>
  <Canvas.Panel v-model="child" :resolve="restrictToParent">
    <Canvas.DragHandle>child — stays inside parent</Canvas.DragHandle>
  </Canvas.Panel>
</Canvas.Panel>
```

For data-driven trees, a recursive component works cleanly:

```vue
<!-- PanelTree.vue -->
<script setup lang="ts">
defineProps<{ panel: PanelData }>();
</script>

<template>
  <Canvas.Panel v-model="panel" :resolve="panel.resolve">
    <Canvas.DragHandle />
    <PanelTree v-for="child in panel.children" :key="child.id" :panel="child" />
  </Canvas.Panel>
</template>
```

---

## Reactivity & auto re-clamp

Any change to consumer state — `v-model`, parent state, viewport, constraint props — automatically re-runs the constraint pipeline. A panel pinned to a bottom-left corner that grows in height naturally moves _up_ to stay inside parent. No manual sync code needed.

For constraints that depend on non-Vue state (e.g., a custom `:resolve` closure over a `let` variable), trigger a manual re-check:

```ts
const panelRef = useTemplateRef("panelRef");
panelRef.value?.recalc();
```

The library never measures DOM — content size is the consumer's responsibility (set up a `ResizeObserver` if you want auto-sizing).

---

## Selection

Selection is an ordered array of panel ids, bindable with `v-model:selection`:

```vue
<Canvas.Root v-model:selection="selectedIds">…</Canvas.Root>

<script setup>
const selectedIds = ref<readonly string[]>([]);
</script>
```

**Click to select** works out of the box — the `select()` control ships in `defaultControls()`. Clicking a panel selects it; holding the additive modifier (default <kbd>Shift</kbd>) toggles it in/out of a multi-selection. The modifier is configured the same way as any other control:

```ts
import { defaultControls, select, clearSelectionOnBackground }
  from "@mattfletcher94/strata-canvas/controls";

<Canvas.Root :controls="[
  ...defaultControls(),                 // includes select({ additive: ['shift'] })
  clearSelectionOnBackground(),         // click empty canvas → clear selection
]">

// override the modifier, opt out, or change button:
select({ additive: ['meta'] })
```

Grabbing a panel selects it before the drag starts. Grabbing one panel of a multi-selection keeps the whole selection — so **dragging moves the entire group** (a selected panel nested inside another selected panel rides along instead of double-moving). Resize stays single-panel.

A panel knows its own state — via the `data-selected` attribute, the `isSelected` slot prop, or `usePanel().isSelected`. A common pattern is showing resize handles only when selected:

```vue
<Canvas.Panel v-model="box" v-slot="{ isSelected }">
  <Canvas.DragHandle>drag</Canvas.DragHandle>
  <template v-if="isSelected">
    <Canvas.ResizeHandleSE />
  </template>
</Canvas.Panel>
```

Selected panels get a default outline you can restyle or remove with CSS variables:

```css
:root {
  --strata-selection-outline: 2px solid #3b82f6; /* default */
  --strata-selection-outline-offset: 2px; /* default */
}
/* opt out entirely and style [data-selected] yourself: */
.my-canvas {
  --strata-selection-outline: none;
}
```

Imperative API: `canvas.select(id, { additive })` / `deselect(id)` / `clearSelection()` / `setSelection([...])`. Need a custom "click empty space" behaviour beyond clearing selection? Use `onBackgroundPointerDown(cb)` — it fires `{ screen, world, originalEvent }` only when the pointer misses every panel.

---

## Persistence

State is the consumer's. Watch what you care about and persist however you want:

```ts
watchDebounced(() => panels.value.map((p) => ({ id: p.id, ...p })), save, {
  debounce: 500,
  deep: true,
});
```

No library-side `exportJSON` or hidden state to extract — your `ref` IS the source of truth.

---

## Subpath exports

```ts
import {} from /* core */ "@mattfletcher94/strata-canvas";
import {} from /* … */ "@mattfletcher94/strata-canvas/constraints";
import {} from /* … */ "@mattfletcher94/strata-canvas/controls";
import {} from /* … */ "@mattfletcher94/strata-canvas/easing";
import {} from /* … */ "@mattfletcher94/strata-canvas/utils"; // pure geometry helpers
```

---

## Development

```sh
pnpm install
pnpm run dev        # playground at http://localhost:5173
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run lint
```

The playground (`playground/`) lives in-repo and aliases the package to `src/` — edit library code, hot-reload in the playground.

---

## Attribution

- Core primitive plumbing (`Primitive`, `Slot`, `createContext`) is adapted from [Reka UI](https://github.com/unovue/reka-ui) (MIT). Originals under [`licenses/reka-ui-LICENSE`](./licenses/reka-ui-LICENSE).
- Internal state management uses a vendored build of [Strata](https://github.com/mattfletcher94/strata).
