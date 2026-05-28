# Strata Canvas — Claude Code Instructions

A Vue 3 canvas library: draggable, resizable, recursively nestable panels. **Built on [Strata](https://github.com/mattfletcher94/strata) internally.** The public API is fully declarative and consumer-owned via `v-model`; Strata is a strictly internal implementation detail.

**Read `docs/PROPOSAL.md` first** — it is the canonical design spec. This file is the operational manual for working on the library.

## Commands

- `pnpm run build` — build to dist/
- `pnpm run test` — vitest run
- `pnpm run test:watch` — vitest in watch mode
- `pnpm run typecheck` — vue-tsc --noEmit
- `pnpm run lint` — oxlint with auto-fix
- `pnpm run format` — oxfmt
- `pnpm run check:circular` — dpdm circular-dep check on src/index.ts

## Architecture

Two layers, strictly separated:

```
Public layer  →  Compound components + composables, consumer-owned state via v-model.
                 Zero Strata concepts exposed.
Internal layer →  One Strata graph per <Canvas.Root>. Three-tier DAG:
                  Stores (state) → Services (I/O) → Orchestrators (coordination).
```

### Internal graph layout

One graph instance per `<Canvas.Root>` mount. Disposed (with timeout) on unmount.

**Stores** (state via past-tense projections):

- `viewport` — `{ x, y, zoom, mode, bounds }`
- `registry` — `{ panels: Record<id, PanelRow>, rootIds, childrenByParent }`
- `selection` — `{ selected: string[] }`
- `gestures` — `{ drag, resize, boxSelect, pan }` (each null when inactive)
- `passthroughs` — registered escape-hatch regions

**Services** (all I/O):

- `pointer` — window pointer/keyboard event source, rAF-coalesced
- `dom` — element measurement helpers (`getBoundingClientRect`, viewport scroll, active element)

**Orchestrators**:

- `viewportOrch` — pan, zoom, fitTo, screen↔world conversions
- `registryOrch` — mountPanel, unmountPanel, syncPanelState, syncPanelProps, reparent. Reaction `enforceConsistency` cascades clamps to descendants when an ancestor changes.
- `gestureOrch` — beginDrag, beginResize, beginBoxSelect, beginPan. Reactions subscribe `pointer` and dispatch `*FrameProposed` / `*Committed` / `*Ended` events.
- `selectionOrch` — select, deselect, clear, set
- `passthroughOrch` — register, unregister, hitTest

**The constraint pipeline** (`proposed Box → bounds clamp → resolve fn → committed Box`) is a **pure function** called from the `commitFrame` reaction. NOT a Strata concept itself — just a helper. Keep it pure, deterministic, snapshot-driven.

## Strata protocol — non-negotiable rules

Strata's philosophy is **predictable state through pure derivation**. Defaulting to patterns from Redux / Zustand / TanStack Query produces code that subtly fights the library. Read this before writing any internal store/orchestrator/reaction.

### Three primitives

- **Events** are the only state-change primitive. Dispatch them; projections handle the rest.
- **Queries** are the only read primitive. They derive views from state.
- **Reactions** and **live queries** are the only side-effect primitives.

### Commands are pure synchronous functions

Commands receive `(deps)` only — never `(deps, services)`. They cannot call services. They return `{ events?, data?, result? }`. If you need to call a service to _compute_ something, dispatch a `xRequested` event and let a reaction call the service and dispatch the follow-up.

Awaitable commands declare `result: { ok, fail }`. Awaiting `app.x.cmd(args)` resolves with the matching event payload, correlated automatically by internal corrId.

### Optimistic mutations → overlays, not snapshots

Use derived overlays (`pendingRemovals: string[]`, `pendingUpdates: Record<id, T>`) that queries filter against. Server-truth state stays clean; the overlay is the optimistic view. Rollback is overlay-clear; commit is truth-mutation + overlay-clear. **Never** snapshot-and-restore — that's TanStack's shape, which works because TanStack mutates the cache directly. Strata derives.

### Loading / error state → projections, not refs

```ts
projections: {
  listFetchStarted: (state) => ({ ...state, listStatus: "fetching", listError: null }),
  listFetched: (state, { items }) => ({ ...state, items, listStatus: "idle" }),
  listFetchFailed: (state, { error }) => ({ ...state, listStatus: "error", listError: error }),
}
queries: (state) => ({
  isListLoading: () => state.listStatus === "fetching",
})
```

### Cache invalidation → re-dispatch the trigger event

There is no `invalidate` primitive. Calling the fetch command again _is_ invalidation (reactions use `switch` concurrency to abort the prior run). Expose `invalidateList()` as a command alias if you want discoverability.

### Awaitable mutations → declare `result`, not `allSettled()`

`handle.allSettled()` is the escape hatch for "wait for everything, no specific completion event." Use sparingly. Most commands have a meaningful "done" event worth declaring as `result`.

### Long-running streams → live queries

```ts
liveQueries: (deps, services) => ({
  byId: defineLiveQuery({
    query: (id) => deps.X.byId(id),
    source: (id, { on, fail }) =>
      services.ws.subscribe(id, {
        onMessage: on((row) => [deps.X.rowUpdated(row)]),
        onError: (e) => fail(e),
      }),
  }),
});
```

Identity is `(name, args)` with refcounting; concurrent `acquire()` calls share one underlying source. Source tears down on last release.

### Cross-resource coordination → cross-orchestrator command refs

Reactions can subscribe to commands via the third callback parameter:

```ts
reactions: (deps, services, commands) => ({
  trackCreate: defineReaction({
    on: commands.create,
    run: (input) => services.analytics.track("create", input),
  }),
});
```

This is how cross-cutting concerns attach without modifying the command.

### Services on orchestrator config

Declare services on the orchestrator alongside `deps` for a typed `services` parameter automatically — no `Resolved<typeof apiService>` annotation needed.

```ts
defineOrchestrator({
  deps: { registry: registryStore },
  services: { pointer: pointerService },
  reactions: (deps, services) => ({ ... }),
})
```

## Strata anti-patterns — refuse these

- **Don't snapshot state in events for rollback.** Use overlays.
- **Don't `await handle.allSettled()`** unless there's no specific completion event.
- **Don't track `isLoading` outside Strata.** Model fetch lifecycle as projections.
- **Don't call services from commands.** Commands are pure; async lives in reactions.
- **Don't add a "pending" flag to every item.** Use a separate overlay field.
- **Don't invent your own invalidation primitive.** Re-dispatch the trigger.
- **Don't share state between components via refs.** Per-instance ephemera only (hover, focus). Anything two components coordinate on goes in a graph.
- **Don't put I/O in projections, queries, or commands.** Services only, called from reactions and live queries.

## Strata Canvas — library-specific rules

Beyond Strata's protocol, this library has its own non-negotiables. They flow from the proposal (`docs/PROPOSAL.md`). Read it.

### Public API rules

- **No sugar (v0).** Constraint props are functions only: `:bounds` (`Rect | Ref<Rect> | (ctx) => Rect`) and `:resolve` (a single `ResolveFn`). Use `compose(...)` to chain. **No** flat-prop `axis`, `snap`, `aspectRatio`, `min-width`, `padding`, etc. Sugar is deferred to v1 after the function API ships.
- **State is the consumer's.** Panel position/size live in the consumer's `ref` and flow via `v-model`. The library does NOT expose `:default-*` props, controlled/uncontrolled variants, or library-owned state through composables.
- **Behaviour is declared by children.** `<Canvas.Panel>` is inert by default. Drag is enabled by declaring `<Canvas.DragHandle>` inside. Resize is enabled per-edge/per-corner by declaring `<Canvas.ResizeHandleSE>` etc. No `draggable` / `resizable` props.
- **`as` and `as-child` on every primitive.** Reka-style composition. Use the copied `Primitive` from `src/primitives/Primitive.ts`.
- **No string-id lookups.** `usePanel()` returns the nearest ancestor via inject. Cross-panel references happen via direct handle passing (template refs, scoped slots, props). `usePanel(id)` lookup is forbidden.
- **Edges are out of scope. Forever.** Don't add anything that could become an edge/connection primitive.

### Internal architecture rules

- **One Strata graph per `<Canvas.Root>`**, not per panel. Per-panel state lives in the `registry` store keyed by panel id.
- **The constraint pipeline is a pure function.** Called from inside `commitFrame` reaction with a freshly materialized `ResolveCtx` (built from the registry/viewport snapshot). Pure: no reactivity, no service calls, no Strata access. Testable in isolation.
- **rAF coalescing in the pointer service**, not in orchestrators. Orchestrators handle one frame's events per tick.
- **Reactions are named by action** (`runDrag`, `commitFrame`, `enforceConsistency`, `coalesceMoves`, `persistViewport`). Never bare nouns.
- **Projections are named in past tense** (`panelMoved`, `dragStarted`, `viewportZoomed`, `selectionCleared`). Never `set`, `add`, `update`.
- **Reactive consistency cascades** (parent shrinks → descendants re-clamp) happen via a reaction subscribed to `panelStateUpdated`, running the pipeline against affected descendants. Concurrency `serial` to avoid feedback loops.

### Vue ↔ Strata adapter rules

The Vue component layer is **thin**. Components should:

1. Call commands. Never mutate stores directly.
2. Read state via queries (`useQuery`). Never reach into the graph object.
3. Hold the graph instance privately on the canvas context (e.g. `_graph` with leading underscore) — never export it as part of the public surface.
4. Sync the consumer's `v-model` to the graph via `watch` + `syncPanelState`; sync graph back to v-model via `watch` on the query + `modelValue.value = ...` (with shallow-equal guard to avoid loops).
5. Provide context via the `createContext` helper from `src/shared/createContext.ts`. Throw clearly on use outside provider.

The graph instance, projections, event names, store names — none of these are part of the public type surface. If a consumer would need to import a Strata concept to use the library, you've leaked.

## Code Conventions

- Past-tense projection names: `panelMoved`, `dragStarted`, `viewportZoomed` — never `set`, `add`, `update`.
- Action-noun reaction names: `runDrag`, `commitFrame`, `enforceConsistency` — never bare nouns like `drag`, `consistency`.
- No `as const` casts. No banner comments. No backwards-compatibility shims.
- No destructuring for property access: `obj.prop`, not `const { prop } = obj`. Payload destructuring in projection signatures is fine (idiomatic for typed events).
- `import type { X } from 'pkg'` at top of file — never inline `import('pkg').X`.
- Component file naming: PascalCase for primitive `.ts`/`.vue` files (`Primitive.ts`, `Panel.vue`), kebab-case for utilities.
- Each component file exports its component as a named export, plus its public props/types.
- Use the `@/` alias for cross-directory imports; relative paths for sibling files only.

## Reka UI attribution

`src/primitives/Primitive.ts`, `src/primitives/Slot.ts`, `src/shared/createContext.ts`, `src/shared/renderSlotFragments.ts`, `src/shared/isValidVNodeElement.ts` are derived from [Reka UI](https://github.com/unovue/reka-ui) (MIT, Copyright (c) 2023 UnoVue). **Preserve the attribution comment at the top of each file when editing.** The original license is at `licenses/reka-ui-LICENSE`.

If you need more from Reka UI (e.g., `useForwardExpose`, `useEmitAsProps`), copy it the same way: with header attribution and the full LICENSE preserved.

## Patterns reference

For Strata patterns (optimistic mutations, loading state, cache invalidation, awaitable mutations, long-running streams) the canonical examples are in the Strata package's scenario tests:

- `node_modules/@mattfletcher94/strata/test/scenarios.data-fetching.test.ts` — TanStack-style overlay optimism, loading state, invalidation, awaitable mutations
- `node_modules/@mattfletcher94/strata/test/scenarios.chat-app.test.ts` — cross-store coordination, websocket service
- `node_modules/@mattfletcher94/strata/test/scenarios.correlation.test.ts` — request-response correlation
- `node_modules/@mattfletcher94/strata/test/scenarios.shopping-cart.test.ts` — cross-store derived queries, async setup
- `node_modules/@mattfletcher94/strata/test/scenarios.sync-protocol.test.ts` — three-phase state machine

Grep these first. Reference > prose.

## CI Pipeline

- **Lint** — oxlint runs on PRs and main pushes. Blocks merge on errors.
- **Typecheck** — `vue-tsc --noEmit`. Blocks merge.
- **Test** — vitest run. Blocks merge.
- **Autofix** — oxfmt runs automatically. If formatting changes are needed, `autofix-ci/action` commits them back to the branch. After pushing, run `git pull` to pick up autofix commits before continuing work.

## Changesets — Release Process

When making changes that affect the published package, create a changeset file:

```md
---
"@mattfletcher94/strata-canvas": patch
---

Brief consumer-facing description of what changed.
```

Semver:

- `patch` — bug fixes, doc updates, internal refactors (including internal Strata graph changes that don't affect public API)
- `minor` — new public exports, new primitives, new constraint functions
- `major` — breaking changes to the consumer API

The changeset file is committed alongside the code changes. The GitHub Action handles versioning and publishing automatically — **never bump `version` in package.json manually, never run `npm publish` manually**.

Do NOT create a changeset for test-only changes, CI config, repo tooling, or docs-only PRs.

## Testing

Three test seams. Pick the right one for each test:

### 1. Unit-test the constraint pipeline (pure function)

```ts
import { runPipeline } from "@/internal/pipeline"

it("clamps to parent bounds", () => {
  const ctx = makeCtx({ parent: { x: 0, y: 0, width: 100, height: 100 }, ... })
  const result = runPipeline({ x: 150, y: 0, width: 50, height: 50 }, ctx)
  expect(result.x).toBe(50)
})
```

No graph, no Vue. Just pure inputs and outputs.

### 2. Integration-test the graph (Strata-level)

Build a real graph with fake `pointer` / `dom` services satisfying the production interfaces. Drive through commands; assert via queries.

```ts
const pointerService = defineService({
  name: "pointer",
  setup: () => ({ stream: vi.fn(...) }),
})
const graph = createCanvasGraph({ services: { pointer: pointerService, ... } })

graph.gestures.beginDrag({ panelId: "a", pointer: { x: 0, y: 0 } })
fakePointer.emit({ type: "move", x: 50, y: 50 })
await graph.$flush()

expect(graph.registry.panels().value.a.state).toEqual({ x: 50, y: 50, ... })
await graph.$dispose()
```

- `await graph.$flush()` to wait for all in-flight reactions to settle before asserting.
- `await graph.$dispose({ timeout: 100 })` if a service ignores abort signals.

### 3. Component-test via `@vue/test-utils`

Mount `<Canvas.Root>` + `<Canvas.Panel>` against `happy-dom`, dispatch DOM pointer events, assert the consumer's ref mutates correctly. Validates the Vue ↔ Strata adapter wiring.

```ts
const panel = ref({ x: 0, y: 0, width: 100, height: 100 });
const wrapper = mount(TestHost, { props: { panel } });
const handle = wrapper.find("[data-canvas-drag-handle]");
await handle.trigger("pointerdown", { clientX: 0, clientY: 0 });
await window.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, clientY: 30 }));
await window.dispatchEvent(new PointerEvent("pointerup"));
expect(panel.value).toEqual({ x: 50, y: 30, width: 100, height: 100 });
```

### Test rules

- **Test through the public API.** Render components, drive gestures, assert via reactive state.
- **Never test internal Strata stores at the projection level** — test through orchestrator commands and queries.
- **Test names describe consumer behaviour, not implementation.**
- **Each test creates its own graph + ref state** — no shared mutable state between tests.
- **Shared fixtures live in `test/fixtures.ts`.**

## Common debugging cues

- **`await graph.x.cmd()` hangs and rejects with `CommandUnresolvedError`** — the command declared `result: { ok, fail }` but no reaction emits the result event. Check the reaction's `onSuccess` / `onFailure` returns.
- **Optimistic state appears, then briefly reverts, then re-applies** — a snapshot-pattern race. Switch to the overlay pattern.
- **`$dispose()` hangs** — a service's `run` is ignoring `ctx.abort.signal`. Fix the service, or call `$dispose({ timeout: 1000 })`.
- **v-model update loops** — the Vue adapter is missing a shallow-equal guard. Adapter should only emit `update:modelValue` when the new box differs from the consumer's current ref value.
- **Reaction never fires for a command** — check `on:` source on the reaction matches the actual event/command being dispatched.
- **Concurrent gestures of the same panel race** — set `concurrency: { mode: "switch", key: ({ panelId }) => panelId }` on the gesture reaction.

## What this file is NOT for

- **Rationalising why Strata exists vs Zustand/Redux/Pinia.** Strata is the chosen internal substrate. The library doesn't compare itself to others; it uses Strata's patterns consistently.
- **Justifying the no-sugar v0 decision.** That's locked. See `docs/PROPOSAL.md` §15 for the deferred sugar roadmap.
- **Adding edges/connections/node-editor features.** Out of scope, permanently.
- **Exposing Strata internals on the public API.** If you find yourself documenting a Strata concept in the public types, stop — you've leaked.
