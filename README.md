# @mattfletcher94/strata-canvas

An infinite, declarative canvas for Vue 3 — **draggable, resizable, infinitely nestable panels**. No edges, no node-graph baggage: just panels you position with your own state.

Think Figma/Miro-style surface primitives, not a flowchart library. You compose behaviour from small pieces: drop in a drag handle to make a panel movable, a resize handle to make it sizable, a constraint function to keep it in bounds, a control to wire up pan/zoom/select.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { createCanvas } from "@mattfletcher94/strata-canvas";

const Canvas = createCanvas();
const panel = ref({ x: 120, y: 80, width: 220, height: 140 });
</script>

<template>
  <Canvas.Root style="width: 100%; height: 100vh; background: #1e1e1e">
    <Canvas.Panel v-model="panel" style="background: #2d2d2d; border-radius: 8px; color: #eee">
      <Canvas.DragHandle style="padding: 8px; cursor: grab">Drag me</Canvas.DragHandle>
      <div style="padding: 8px">x: {{ panel.x }}, y: {{ panel.y }}</div>
      <Canvas.ResizeHandleSE style="position: absolute; right: 0; bottom: 0; width: 12px; height: 12px; cursor: nwse-resize" />
    </Canvas.Panel>
  </Canvas.Root>
</template>
```

That's the whole model: a `<Canvas.Root>` viewport, a `<Canvas.Panel>` bound to your own `ref` via `v-model`, and child handles that opt the panel into dragging and resizing.

## Features

- **Your state, always.** Panel geometry lives in your `ref` and flows through `v-model`. The library has no internal copy and no controlled/uncontrolled split — your `ref` is the single source of truth.
- **Compound components.** Behaviour is declared by structure: a `<Canvas.DragHandle>` makes a panel draggable, a `<Canvas.ResizeHandleN>` enables resizing from the north edge. Reka-style `as` / `as-child` on every primitive.
- **Composable constraints.** Shape gestures with pure functions — `compose(restrictToParent, withPadding(10), snapToGrid(8))`. No grab-bag of boolean props.
- **Composable controls.** Pan, zoom, and select are configurable controls with a real modifier vocabulary (`ctrl`/`meta`/`alt`/`shift`, keys, mouse buttons) — not hard-coded gestures.
- **Infinite nesting.** Panels nest to any depth; child coordinates are parent-relative, read straight from the component tree.
- **Multi-select & group drag.** Click, shift-click, drag the whole selection — built in.
- **Fixed (screen-space) panels** for minimaps, toolbars, and HUD overlays that don't pan or zoom.
- **Passthrough** for embedding third-party widgets (yFiles, Monaco, a video player) that need their own pointer/wheel/keyboard.
- **No edges. Ever.** This is a panel surface, not a graph editor.

## Install

```sh
pnpm add @mattfletcher94/strata-canvas
```

Vue 3.5+ is a peer dependency. [Strata](https://www.npmjs.com/package/@mattfletcher94/strata) (the internal state engine) comes along as a regular dependency from public npm — nothing private to configure.

## How it fits together

A few ideas carry the whole API:

- **`createCanvas()` returns a namespace** of components (`Root`, `Panel`, `DragHandle`, `ResizeHandle*`, `PassThrough`, `Background`) and composables (`useCanvas`, `usePanel`). Call it once per canvas component.
- **Panels own their geometry.** Each `<Canvas.Panel>` binds a `{ x, y, width, height }` box via `v-model`. You mutate it; the canvas renders it. Drag/resize gestures write back through the same `v-model`.
- **Two coordinate spaces.** Normal panels live in **world** coordinates (they pan and zoom with the canvas). `:fixed` panels live in **screen** coordinates (they stay put). `useCanvas()` gives you `screenToWorld` / `worldToScreen` to convert.
- **Constraints shape per-panel gestures** (where *this* panel is allowed to move/resize). **Controls handle canvas-wide input** (pan, zoom, select). Both are just functions/objects you compose.

> Internally the canvas is a [Strata](https://github.com/mattfletcher94/strata) graph (stores, services, orchestrators), but you never touch that — the public surface is purely Vue components and composables. See [`docs/INTERNALS.md`](./docs/INTERNALS.md) if you're curious.

## Panels

A panel is your box plus opt-in behaviour. Nothing is draggable or resizable until you add a handle.

```vue
<Canvas.Panel v-model="box" :z="2" :disabled="locked">
  <Canvas.DragHandle>title bar</Canvas.DragHandle>
  <div>content</div>
  <Canvas.ResizeHandleSE />
</Canvas.Panel>
```

| Prop          | Type                              | Notes                                                            |
| ------------- | --------------------------------- | ---------------------------------------------------------------- |
| `v-model`     | `{ x, y, width, height }`         | Required. Your state; gestures write back here.                  |
| `:resolve`    | `ResolveFn`                       | Constraint applied to every gesture frame (see below).           |
| `:bounds`     | `Rect \| () => Rect`              | Optional explicit bounds for constraints to clamp against.       |
| `:disabled`   | `boolean`                         | Freezes the panel — no drag, resize, select, or re-clamp.        |
| `:selectable` | `boolean` (default `true`)        | Whether the `select()` control can select it.                    |
| `:z`          | `number`                          | `z-index`.                                                       |
| `:fixed`      | `boolean`                         | Pins to screen space (see [Fixed panels](#fixed-panels)).        |
| `:as` / `:as-child` | element / merge             | Reka-style rendering control.                                    |

Each panel's default slot exposes live state you can render against:

```vue
<Canvas.Panel v-model="box" v-slot="{ isSelected, isDragging, isResizing, state }">
  <Canvas.DragHandle>{{ isDragging ? "moving…" : "drag" }}</Canvas.DragHandle>
</Canvas.Panel>
```

### Handles

Handles are regions that initiate gestures. Place as many as you like, anywhere in the panel:

```vue
<Canvas.Panel v-model="box">
  <Canvas.DragHandle>move</Canvas.DragHandle>

  <!-- enable resize from any edge/corner you want -->
  <Canvas.ResizeHandleE />
  <Canvas.ResizeHandleS />
  <Canvas.ResizeHandleSE />
</Canvas.Panel>
```

There are eight: `ResizeHandleN`, `E`, `S`, `W`, `NE`, `NW`, `SE`, `SW`. With `as-child` you can make any element the handle:

```vue
<Canvas.DragHandle as-child>
  <header class="my-title-bar">My Panel</header>
</Canvas.DragHandle>
```

### Recursive nesting

Panels nest in the template; child coordinates are relative to the parent. The library reads the parent/child relationship from the rendered tree — there are no `parentId` fields to manage.

```vue
<Canvas.Panel v-model="parent">
  <Canvas.DragHandle>parent</Canvas.DragHandle>

  <Canvas.Panel v-model="child" :resolve="restrictToParent">
    <Canvas.DragHandle>child — stays inside parent</Canvas.DragHandle>
  </Canvas.Panel>
</Canvas.Panel>
```

For data-driven trees, a recursive component is the natural fit:

```vue
<!-- PanelNode.vue -->
<script setup lang="ts">
defineProps<{ node: PanelData }>();
</script>

<template>
  <Canvas.Panel v-model="node.box" :resolve="node.resolve">
    <Canvas.DragHandle />
    <PanelNode v-for="child in node.children" :key="child.id" :node="child" />
  </Canvas.Panel>
</template>
```

## Constraints — `@mattfletcher94/strata-canvas/constraints`

A constraint decides *where a panel is allowed to go*. It runs on every frame of a drag or resize, takes the box the gesture **wants**, and returns the box to actually commit.

```ts
type ResolveFn = (proposed: Box, ctx: ResolveCtx) => Box | { box: Box; bounds?: Rect };
```

- **`proposed`** — the box the gesture is asking for this frame (unconstrained).
- **`ctx`** — everything you need to decide:

  | Field | Meaning |
  | --- | --- |
  | `ctx.current` | the panel's box at the start of this frame |
  | `ctx.parent` | nearest ancestor panel's live geometry (or `null`) |
  | `ctx.siblings` | sibling panels' live geometry |
  | `ctx.viewport` | the visible viewport rect, in world coords |
  | `ctx.pointer` | pointer position, world coords |
  | `ctx.modifiers` | `{ ctrl, shift, alt, meta }` held this frame |
  | `ctx.gesture` | `"drag"` or `"resize"` |
  | `ctx.handle` | which resize handle (`"se"`, `"n"`, …); `undefined` for drag |
  | `ctx.bounds` | the allowed region established so far in the chain |

- **Return** the box to commit. Return `ctx.current` to reject the move entirely (the panel won't budge this frame).

Attach one with `:resolve`:

```vue
<Canvas.Panel v-model="box" :resolve="restrictToParent" />
```

### Composing constraints

The point of constraints is that they **compose**. `compose(...)` runs them left to right, feeding each function the output of the last:

```ts
import { compose, restrictToParent, withPadding, snapToGrid } from "@mattfletcher94/strata-canvas/constraints";

const sticky = compose(restrictToParent, withPadding(10), snapToGrid(8));
```

```vue
<Canvas.Panel v-model="box" :resolve="sticky" />
```

**Order matters, and `bounds` threads through the chain.** Some constraints don't just clamp the box — they also publish the region they clamped to as `ctx.bounds`, so the next function can build on it:

1. `restrictToParent` clamps the box inside the parent **and sets `bounds` to the parent's interior**.
2. `withPadding(10)` reads that `bounds`, shrinks it by 10px on every side, and re-clamps — so the panel ends up 10px inside the parent.
3. `snapToGrid(8)` rounds the result to an 8px grid.

This is why `withPadding` has to come **after** a container constraint: on its own it has no bounds to shrink and quietly does nothing. Read `compose(restrictToParent, withPadding(10))` as "stay inside the parent, with 10px of breathing room."

### Drag vs resize

A constraint sees `ctx.gesture` and `ctx.handle`, so it can behave differently — or only act for one kind of gesture. `lockAxis` only affects drags; `withAspectRatio` only affects resizes. Everything else is fair game.

### Built-in constraints

| Group | Functions |
| --- | --- |
| **Containment** | `restrictToParent`, `restrictToViewport`, `restrictToRect(rect)`, `restrictSizeToParent` |
| **Axis / size** | `lockAxis('x' \| 'y')`, `withMinSize({ width, height })`, `withMaxSize({ width, height })`, `withAspectRatio(ratio \| 'lock')` |
| **Grid** | `snapToGrid(n \| { x, y })` |
| **Padding** | `withPadding(n \| { top, right, bottom, left })` |
| **Exclusion** | `avoidRect(rect)`, `pushOutOfRect(rect)`, `avoidSiblings` |

`restrictToRect` and the exclusion helpers accept a static `Rect`, a `() => Rect` getter, or a `{ value: Rect }` ref, so they can track moving regions reactively.

### Writing your own

A constraint is just a function — compose it right alongside the built-ins. Because `ctx.modifiers` is available, constraints can respond to held keys. For example, snap to a grid *unless* Alt is held:

```ts
import { snapToGrid, type ResolveFn } from "@mattfletcher94/strata-canvas/constraints";

const grid = snapToGrid(20);
const snapUnlessAlt: ResolveFn = (proposed, ctx) =>
  ctx.modifiers.alt ? proposed : grid(proposed, ctx);
```

Or keep a panel out of the top-right quadrant of its parent:

```ts
const noTopRight: ResolveFn = (proposed, ctx) => {
  if (!ctx.parent) return proposed;
  const inTopRight = proposed.x > ctx.parent.width / 2 && proposed.y < ctx.parent.height / 2;
  return inTopRight ? ctx.current : proposed; // reject moves into the quadrant
};

<Canvas.Panel v-model="box" :resolve="compose(restrictToParent, noTopRight)" />
```

## Controls & modifiers — `@mattfletcher94/strata-canvas/controls`

Controls handle **canvas-wide input** — panning, zooming, selecting, and anything else you wire up. A control is an object that can hook `onWheel`, `onPointerDown`, and `onKeyDown` / `onKeyUp`. You pass an array to `<Canvas.Root :controls>`; they're sorted by `priority` (highest first), and the first control to claim a pointer or wheel event owns it exclusively until release.

`defaultControls()` wires the conventions most apps want:

```ts
import { defaultControls } from "@mattfletcher94/strata-canvas/controls";

// Equivalent to:
[
  passthroughRegions(),                       // let <Canvas.PassThrough> regions opt out
  passthroughClassNames(),                    // ...and the canvas-no* escape-hatch classes
  select(),                                   // click to select, shift-click to multi-select
  wheelZoom({ modifiers: ["ctrl"] }),         // Ctrl/⌘ + wheel zooms (anchored on the cursor)
  pan({ button: "middle" }),                  // middle-drag pans
  pan({ button: "left", keys: ["Space"] }),   // Space + left-drag pans
];

<Canvas.Root :controls="defaultControls()">
```

To customise, build your own array — usually by spreading the defaults and adding or swapping pieces:

```ts
import { defaultControls, wheelZoom, pan, clearSelectionOnBackground }
  from "@mattfletcher94/strata-canvas/controls";

const controls = [
  ...defaultControls(),
  clearSelectionOnBackground(),               // click empty space to deselect
];
```

### The modifier vocabulary

Controls speak a small, shared vocabulary, so customising a gesture is the same everywhere:

- **`ModifierKey`** — `'ctrl' | 'meta' | 'alt' | 'shift'`. `'ctrl'` matches **Ctrl _or_ ⌘** so shortcuts work cross-platform out of the box; use `'meta'` when you specifically want ⌘ only.
- **keys** — any held key by name, e.g. `'Space'`, `'a'`.
- **buttons** — `'left' | 'middle' | 'right'`.

```ts
wheelZoom({ modifiers: [] });                       // bare wheel zooms (no modifier needed)
wheelZoom({ modifiers: ["ctrl"], sensitivity: 0.01 });

pan({ button: "left", onlyBackground: true });      // left-drag empty canvas pans;
                                                    // over a panel it yields to dragging
pan({ button: "middle" });

select({ additive: ["meta"] });                     // ⌘-click to multi-select instead of Shift
select({ additive: ["shift"], button: "left" });    // the default, spelled out
```

### Writing a control

Use `defineControl` and reach into the `ControlContext` it hands you (`screenToWorld` / `worldToScreen`, `isKeyHeld`, `panelAt(e)` / `isOnPanel(e)`, `markHandled` / `isHandled`, and the underlying `graph`). Return `true` from a key/wheel hook to claim the event and stop lower-priority controls; return a session object from `onPointerDown` to own the drag.

```ts
import { defineControl } from "@mattfletcher94/strata-canvas/controls";

export function arrowPan({ step = 20 } = {}) {
  return defineControl({
    id: "arrowPan",
    onKeyDown(e, ctx) {
      if (e.key === "ArrowUp") ctx.graph.viewportOrch.pan({ dx: 0, dy: step });
      else if (e.key === "ArrowDown") ctx.graph.viewportOrch.pan({ dx: 0, dy: -step });
      else return; // don't claim other keys
      return true;
    },
  });
}

<Canvas.Root :controls="[...defaultControls(), arrowPan()]">
```

## Selection

Selection is an ordered array of panel ids, bindable with `v-model:selection`:

```vue
<Canvas.Root v-model:selection="selectedIds">…</Canvas.Root>

<script setup>
const selectedIds = ref<readonly string[]>([]);
</script>
```

Because `select()` ships in `defaultControls()`, **click-to-select works out of the box**: click a panel to select it, hold the additive modifier (default <kbd>Shift</kbd>) to toggle it in or out of a multi-selection. The modifier is configured like any other control — `select({ additive: ['meta'] })`.

Grabbing a panel selects it before the drag begins. Grab one panel of a multi-selection and the **whole group drags together** (a selected panel nested inside another selected panel rides along rather than double-moving). Resizing stays single-panel.

A panel always knows whether it's selected — via the `data-selected` attribute, the `isSelected` slot prop, or `usePanel().isSelected`. A common pattern is showing resize handles only when selected:

```vue
<Canvas.Panel v-model="box" v-slot="{ isSelected }">
  <Canvas.DragHandle>drag</Canvas.DragHandle>
  <template v-if="isSelected">
    <Canvas.ResizeHandleSE />
  </template>
</Canvas.Panel>
```

Selected panels get a default outline you can restyle or remove via CSS variables:

```css
.my-canvas {
  --strata-selection-outline: 2px solid #3b82f6; /* default */
  --strata-selection-outline-offset: 2px; /* default */
}
/* opt out entirely and style [data-selected] yourself */
.my-canvas {
  --strata-selection-outline: none;
}
```

Imperatively: `canvas.select(id, { additive })`, `deselect(id)`, `clearSelection()`, `setSelection([...])`. For custom "click empty space" behaviour beyond clearing, use the `onBackgroundPointerDown(cb)` control — it fires `{ screen, world, originalEvent }` only when the pointer misses every panel.

## Fixed panels

`:fixed` pins a panel to **screen space** — it stops moving with pan/zoom but stays fully interactive (drag, resize, select all still work). Perfect for minimaps, toolbars, and HUD overlays.

```vue
<Canvas.Panel v-model="toolbar" fixed :resolve="restrictToViewport">
  <Canvas.DragHandle>⋮⋮</Canvas.DragHandle>
  <Toolbar />
</Canvas.Panel>
```

When `fixed`:

- the panel renders into a screen-space overlay layer (the pan/zoom transform doesn't apply);
- its `{ x, y, width, height }` are screen pixels relative to the canvas root;
- drag tracks the cursor 1:1 at any zoom level;
- it's treated as a root in the registry (no logical parent), regardless of where it sits in the template.

Toggle `:fixed` at runtime to dock/undock. Numbers don't auto-convert across the toggle — use `canvas.worldToScreen()` / `canvas.screenToWorld()` if you want positional continuity.

## Passthrough for third-party content

Embedded widgets (yFiles, Monaco, a video player) bring their own pointer/wheel/keyboard semantics. Wrap them so the canvas backs off:

```vue
<Canvas.Panel v-model="editor">
  <Canvas.DragHandle>title</Canvas.DragHandle>
  <Canvas.PassThrough>
    <MonacoEditor />
  </Canvas.PassThrough>
</Canvas.Panel>
```

By default `<Canvas.PassThrough>` blocks pointer, wheel, **and** keyboard inside its region. Opt back in per event kind:

```vue
<!-- still let the canvas pan over this region, but keep its own wheel + keys -->
<Canvas.PassThrough :pointer="false">
  <ZoomyComponent />
</Canvas.PassThrough>
```

For content you can't wrap, the same escape hatch is available as inline class names:

```vue
<YFilesView class="canvas-nopointer canvas-nowheel canvas-nokey" />
```

## Viewport: fit, center, animate

`useCanvas()` exposes animated viewport operations:

```ts
const canvas = useCanvas();

await canvas.fitTo("all", { duration: 400, padding: 40 });          // frame everything
await canvas.fitTo(panelCtx, { maxZoom: 1, easing: "easeOutCubic" }); // frame one panel
await canvas.centerOn(panelCtx, { duration: 250 });
await canvas.animateViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
canvas.stopAnimation();
```

`fitTo("all")` frames every panel; pass a `PanelContext`, an array of them, a `Rect`, or a `() => Rect`. `padding` accepts per-side values (`{ top, right, bottom, left }`) for overlay-aware fits. Easings live in the `/easing` subpath:

```ts
import { easings, cubicBezier } from "@mattfletcher94/strata-canvas/easing";
// built-ins: linear, easeIn, easeOut, easeInOut, easeOutCubic, easeInOutCubic, easeOutExpo
// custom:    cubicBezier(0.4, 0, 0.2, 1)
```

## Composables

```ts
import { useCanvas, usePanel } from "@mattfletcher94/strata-canvas";

const canvas = useCanvas(); // anywhere under <Canvas.Root>
const panel = usePanel(); // anywhere under <Canvas.Panel> (nearest ancestor)
```

`useCanvas()` gives you `viewport`, `zoom`, `selection`, the viewport ops above, `screenToWorld` / `worldToScreen`, and the selection commands. `usePanel()` gives you `state`, `worldPosition`, `isSelected` / `isDragging` / `isResizing`, `select()`, `update(patch)`, and `recalc()`.

You can also reach the canvas context from outside via a template ref:

```vue
<Canvas.Root ref="canvasRef">…</Canvas.Root>

<script setup lang="ts">
import { useTemplateRef } from "vue";
const canvasRef = useTemplateRef<{ canvas: ReturnType<typeof Canvas.useCanvas> }>("canvasRef");
canvasRef.value?.canvas.fitTo("all", { duration: 400 });
</script>
```

### Reactivity & re-clamping

Any change to the inputs a constraint depends on — `v-model`, parent geometry, the viewport, the constraint props themselves — automatically re-runs the constraint pipeline. A panel pinned to a parent's bottom-left that grows in height naturally slides *up* to stay inside. No sync code.

The one thing the library can't observe is content it doesn't drive. If a constraint depends on data Vue can't see (a `:resolve` closure over a plain `let`, or DOM you measure yourself), trigger a re-check manually:

```ts
const panel = usePanel();
panel.recalc();
```

The library never measures the DOM — content sizing is yours (reach for a `ResizeObserver` if you want panels to auto-fit their content).

## Persistence

Your `ref` is the source of truth, so persistence is just watching it:

```ts
watchDebounced(() => panels.value, save, { debounce: 500, deep: true });
```

There's no `exportJSON` or hidden internal state to extract — what you bind is what you save.

## Subpath exports

```ts
import { createCanvas, useCanvas, usePanel } from "@mattfletcher94/strata-canvas";
import { compose, restrictToParent /* … */ } from "@mattfletcher94/strata-canvas/constraints";
import { defaultControls, pan, wheelZoom, select /* … */ } from "@mattfletcher94/strata-canvas/controls";
import { easings, cubicBezier } from "@mattfletcher94/strata-canvas/easing";
import { clampBox, insetRect /* … */ } from "@mattfletcher94/strata-canvas/utils"; // pure geometry helpers
```

## Development

```sh
pnpm install
pnpm run dev        # playground at http://localhost:5173
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run lint
```

The playground (`playground/`) lives in-repo and aliases the package to `src/`, so you can edit library code and hot-reload against a real canvas.

## Attribution

- Core primitive plumbing (`Primitive`, `Slot`, `createContext`) is adapted from [Reka UI](https://github.com/unovue/reka-ui) (MIT). Originals under [`licenses/reka-ui-LICENSE`](./licenses/reka-ui-LICENSE).
- Internal state management is powered by [Strata](https://github.com/mattfletcher94/strata).
