/**
 * # @mattfletcher94/strata
 *
 * > Strata is a TypeScript state management library that enforces a three-tier DAG architecture through the type system. Event-driven state with pure projections, synchronous commands, reactions for I/O (with concurrency policies), and reactive queries. Powered by @vue/reactivity internally, framework-agnostic externally.
 *
 * - Three tiers: `defineStore`, `defineService`, `defineOrchestrator`. Composed with `createStrata`.
 * - All mutable state lives in stores. State changes only through events dispatched to pure projection reducers.
 * - All I/O lives in services. Reactions and live queries are the only callers.
 * - Orchestrators coordinate — commands are pure functions returning `{ events?, data?, result? }`. No `effects` field, no `effects` parameter.
 * - Commands are synchronous. State updates immediately. Reactions run in background.
 * - Commands return a `CommandHandle`: thenable, with sync `.data` field. Awaiting the handle resolves with the declared `result.ok` event payload (or `result.fail` rejects), with automatic correlation across concurrent invocations.
 * - Reactions are first-class subscribers defined via `defineReaction({ on, run, onSuccess?, onFailure?, concurrency? })`. They subscribe to event creators or command refs.
 * - Concurrency policies: `parallel` (default), `serial`, `switch`, plus per-key forms `{ mode, key: payload => string }` for search-per-topic and save-per-document patterns.
 * - Cycle detection: per-(reaction, corrId) invocation counter capped at 10000 throws `StrataError`.
 * - Orchestrators declare dependencies via a required `deps` field. Types flow into queries, commands, reactions, and live queries automatically.
 * - Event creators live on the resolved store: `deps.storage.todoCreated(todo)` returns a typed branded EventDescriptor. Event creators carry `_store`, `_event` identity, and `EVENT_CREATOR_BRAND`.
 * - Command refs are exposed to reactions via the `commands` parameter on the reactions callback: `on: commands.create` subscribes to a synthetic command-invocation event. Command refs carry `_module`, `_command` identity, and `COMMAND_REF_BRAND`.
 * - Live queries are `{ query, source, onError?, onClose? }` objects defined via `defineLiveQuery()`. They are queries whose data is kept fresh by a long-lived I/O source. `query` returns a SubscribableQuery (or thunk); `source(args, ctx)` wires the I/O and returns a Teardown. `ctx.on(handler)` wraps a `(data) => events` mapper into a callback the source can use; `ctx.fail(error)` aborts the stream.
 * - Live query identity is `(name, stableJson(args))` with refcounting — concurrent acquirers share one underlying source. Source tears down on last release.
 * - Live queries activate via `query.acquire()` (programmatic) or `useLiveQuery(query)` (Vue). They do NOT activate via commands. Events dispatched by live queries have `corrId === null`; reactions still fire on them.
 * - Queries are `SubscribableQuery<T>` — call `query()` to read, `query.subscribe(cb)` to watch. Parameterised queries use `(id: string) => () => state.items[id]`. Live queries are `LiveSubscribableQuery<T>` — `SubscribableQuery<T>` plus `.acquire()`.
 * - Events are batched per store — one state replacement per store per command/dispatch, regardless of how many events target it.
 * - State updates are optimistic — projections run synchronously, reactions run asynchronously. Reaction `onSuccess`/`onFailure` events flow back as events.
 * - `$dispose()` is async: drains in-flight reactions, tears down live queries, stops reactivity, then calls service teardowns in reverse order.
 *
 * ## API
 *
 * ### defineStore
 *
 * Owns reactive state. Config: `{ name, responsibility?, state, projections?, queries? }`.
 *
 * ```typescript
 * const storageStore = defineStore({
 *   name: 'todoStorage',
 *   responsibility: 'Owns todo items.',
 *   state: {
 *     items: {} as Record<string, Todo>,
 *   },
 *   projections: {
 *     todoCreated: (state, todo: Todo) => ({
 *       ...state,
 *       items: { ...state.items, [todo.id]: todo },
 *     }),
 *     todoSynced: (state, { id, serverId }: { id: string; serverId: string }) => ({
 *       ...state,
 *       items: { ...state.items, [id]: { ...state.items[id], serverId } },
 *     }),
 *     todoDeleted: (state, { id }: { id: string }) => {
 *       const next = { ...state.items }
 *       delete next[id]
 *       return { ...state, items: next }
 *     },
 *   },
 *   queries: (state) => ({
 *     list:  () => Object.values(state.items),
 *     count: () => Object.keys(state.items).length,
 *     byId:  (id: string) => () => state.items[id],
 *   }),
 * })
 * ```
 *
 * - `state` is a plain object. The library holds it via `shallowRef`.
 * - `projections` are pure reducers: `(state, payload) => newState`. Each key becomes a branded `EventCreator` on the resolved store.
 * - `queries` receive `(state)`. Zero-arg queries become `SubscribableQuery<T>`. Parameterised queries return a thunk.
 *
 * ### defineService
 *
 * Wraps external I/O. Config: `{ name, responsibility?, setup, teardown? }`. `setup(config)` returns the API, may be async. `teardown(api)` runs at `$dispose`.
 *
 * ```typescript
 * const apiService = defineService({
 *   name: 'restApi',
 *   setup: (config: { baseUrl: string }) => ({
 *     save: async (todo: Todo) => fetch(`${config.baseUrl}/todos`, { method: 'POST', body: JSON.stringify(todo) }).then(r => r.json()),
 *   }),
 * })
 * ```
 *
 * Bind config: `apiService.with({ baseUrl: '/api' })`.
 *
 * ### defineOrchestrator
 *
 * Coordinates stores and services. Config:
 *
 * ```typescript
 * const todosOrch = defineOrchestrator({
 *   name: 'todos',
 *   responsibility: 'CRUD + persistence.',
 *   deps: { storage: storageStore },
 *   queries: (deps) => ({
 *     active: () => deps.storage.list().filter(t => !t.completedAt),
 *   }),
 *   commands: (deps) => ({
 *     create(input: { title: string }) {
 *       const todo = { id: crypto.randomUUID(), title: input.title, completedAt: null }
 *       return {
 *         events: [deps.storage.todoCreated(todo)],
 *         data: todo.id,
 *       }
 *     },
 *   }),
 *   reactions: (deps, services: { readonly api: Resolved<typeof apiService> }, commands) => ({
 *     persist: defineReaction({
 *       on:        deps.storage.todoCreated,
 *       run:       (todo) => services.api.save(todo),
 *       onSuccess: (todo, server: { id: string }) => [deps.storage.todoSynced({ id: todo.id, serverId: server.id })],
 *       onFailure: (todo, error) => [deps.storage.todoPersistFailed({ id: todo.id, error: error.message })],
 *     }),
 *   }),
 *   liveQueries: (deps, services) => ({
 *     byId: defineLiveQuery({
 *       query: (id: string) => deps.storage.byId(id),
 *       source: (id, { on, fail }) =>
 *         services.ws.subscribe(id, {
 *           onMessage: on((todo) => [deps.storage.todoCreated(todo)]),
 *           onError:   (e) => fail(e),
 *         }),
 *       onError: (id, e) => [deps.storage.streamFailed({ id, error: e.message })],
 *     }),
 *   }),
 * })
 * ```
 *
 * - `deps` — required.
 * - `queries` — receive `(deps)`. Pure derivation.
 * - `commands` — receive `(deps)`. Return `{ events?, data?, result? }`. **No services.**
 * - `reactions` — receive `(deps, services, commands)`. Each reaction subscribes to events or command refs.
 * - `liveQueries` — receive `(deps, services)`.
 *
 * ### Reactions
 *
 * ```typescript
 * defineReaction({
 *   on:          deps.todos.todoCreated,                                  // EventCreator
 *   // on:       [deps.todos.todoCreated, deps.notes.noteCreated],         // multi-source: payload is union
 *   // on:       commands.create,                                          // CommandRef
 *   run:         async (payload, ctx) => { ... },                          // ctx.abort, ctx.trigger
 *   onSuccess:   (payload, result) => readonly EventDescriptor[],          // optional
 *   onFailure:   (payload, error)  => readonly EventDescriptor[],          // optional
 *   concurrency: 'parallel' | 'serial' | 'switch' | { mode, key },          // default 'parallel'
 * })
 * ```
 *
 * Concurrency:
 *
 * - `parallel` — default; each trigger runs independently.
 * - `serial` — triggers queue, run one at a time.
 * - `switch` — new trigger aborts the in-flight run via `ctx.abort`.
 * - Per-key: `{ mode: 'switch' | 'serial', key: payload => string }` scopes the policy by key.
 *
 * Reactions never mutate state directly. They dispatch events via `onSuccess`/`onFailure` callbacks; those events flow through projections normally. Events emitted by reactions inherit the triggering command's `corrId`.
 *
 * Cycle detection: a reaction whose `onSuccess` re-emits its trigger event would loop forever. Strata caps each (reaction, corrId) pair at 10000 invocations and throws `StrataError`.
 *
 * ### CommandResult
 *
 * ```typescript
 * interface CommandResult<TData, TOk, TFail> {
 *   events?:  readonly EventDescriptor[]                                  // dispatched immediately
 *   data?:    TData                                                       // attached to handle.data synchronously
 *   result?:  EventCreator<TOk> | { ok: EventCreator<TOk>; fail?: EventCreator<TFail> }
 *                                                                          // declares which event resolves the await
 * }
 * ```
 *
 * ### CommandHandle
 *
 * ```typescript
 * interface CommandHandle<TData, TOk, TFail> extends PromiseLike<TOk> {
 *   readonly data: TData
 *   then<...>(...): Promise<...>
 *   catch<...>(...): Promise<...>
 *   finally(...): Promise<...>
 *   allSettled(): Promise<void>          // resolves when every triggered reaction settles
 * }
 * ```
 *
 * - No `result` declared → `await handle` resolves with `data` after all reactions settle.
 * - `result` is a single creator → resolves with that event's payload, rejects with `Error`.
 * - `result` is `{ ok, fail }` → resolves with ok payload, rejects with fail payload.
 * - `result` declared but no reaction emits it → rejects with `CommandUnresolvedError` once reactions settle.
 *
 * ### Consumer API
 *
 * ```typescript
 * // Pattern A — optimistic (sync .data)
 * const id = app.todos.create({ id: crypto.randomUUID(), title: 'Buy milk' }).data
 * router.push(`/todos/${id}`)
 *
 * // Pattern B — authoritative (await result event)
 * try {
 *   const todo = await app.todos.create({ title: 'Buy milk' })
 *   router.push(`/todos/${todo.id}`)
 * } catch (e) {
 *   showToast('Save failed')
 * }
 *
 * // Wait for every triggered reaction to settle (e.g. for tests)
 * const handle = app.todos.create({ title: 'Buy milk' })
 * await handle
 * await handle.allSettled()
 *
 * // Queries
 * app.storage.count()
 * app.storage.count.subscribe(cb)
 * app.storage.byId('abc')()
 *
 * // Live queries
 * const release = app.notes.byId('abc').acquire()
 * // ...
 * release()  // idempotent
 *
 * // Introspection
 * app.$inspectLiveQueries()
 * app.$inspectReactions()
 *
 * // Disposal — async
 * await app.$dispose()
 * ```
 *
 * ### createStrata
 *
 * ```typescript
 * const app = createStrata({
 *   name: 'todo-app',
 *   responsibility: 'Main app graph.',
 *   services: { api: apiService.with({ baseUrl: '/api' }) },
 *   stores: { storage: storageStore },
 *   orchestrators: { todos: todosOrch },
 *   onCommand:   (t) => log('cmd', t),
 *   onEvent:     (t) => log('evt', t),
 *   onReaction:  (t) => log('rxn', t),
 *   onLiveQuery: (t) => log('lq',  t),
 * })
 * ```
 *
 * Resolution: services → stores → orchestrators (three-phase: command-ref stubs first, then reactions, then real command invokers — so cross-orchestrator command subscriptions work regardless of declaration order). Synchronous unless any service is async.
 *
 * ## Trace Hooks
 *
 * ```typescript
 * {
 *   onCommand:   ({ module, command, args, corrId, timestamp }) => void
 *   onEvent:     ({ store, event, payload, corrId, timestamp }) => void
 *   onReaction:  ({ module, reaction, trigger, corrId, status, duration, result, error }) => void
 *   onLiveQuery: ({ module, liveQuery, args, status, duration, error }) => void
 * }
 * ```
 *
 * `onReaction` fires `started` then `succeeded` / `failed` / `aborted` for each invocation. Synthetic command-invocation events (used to fire `commands.X`-subscribed reactions) do NOT appear in `onEvent` — `onCommand` already covers the invocation. `corrId` is `null` on events dispatched outside a command (live queries, manual dispatch).
 *
 * ## Common Mistakes
 *
 * - Don't put I/O in projections, queries, or commands. Use reactions or live queries.
 * - Don't put mutable state in orchestrators. All state belongs in stores.
 * - Don't access services from commands. Commands get `(deps)` only. Reactions get `(deps, services, commands)`.
 * - Don't use `this` in commands or reactions — both are wrapped, `this` is undefined.
 * - Don't store functions, class instances, or Promises in store state.
 * - Don't `await` a fire-and-forget command — the handle resolves asynchronously when reactions settle.
 * - Don't `await` a command expecting a live query to have connected. Live queries are not reactions.
 * - Don't put functions, Maps, or Sets inside live query args. They serialise to identical or empty registry keys and break refcount sharing.
 * - Use `Record<string, T>` not `Map`. Use arrays not `Set`. Projections use spread.
 * - If `await app.x.cmd()` hangs and rejects with `CommandUnresolvedError`, your command declared a `result` but no reaction emitted the success or failure event. Check the orchestrator wiring.
 * - Reaction names are arbitrary; subscription identity comes from the `on:` source. Event names must match projection keys.
 * - Reaction `onSuccess`/`onFailure` and live query `onError`/`onClose` callbacks return `readonly EventDescriptor[]` — never a single descriptor.
 *
 * ## Testing
 *
 * ```typescript
 * import { describe, it, expect, vi } from 'vitest'
 * import { defineService, createStrata, ReactionError, CommandUnresolvedError } from '@mattfletcher94/strata'
 *
 * it('creating a todo updates state synchronously', async () => {
 *   const apiService = defineService({
 *     name: 'api',
 *     setup: () => ({ save: vi.fn(async (_t: Todo) => {}) }),
 *   })
 *
 *   const app = createStrata({
 *     name: 'test',
 *     responsibility: 'Test graph.',
 *     services: { api: apiService },
 *     stores: { storage: storageStore },
 *     orchestrators: { todos: todosOrchestrator },
 *   })
 *
 *   app.todos.create({ title: 'Buy milk' })
 *   expect(app.storage.count()).toBe(1)
 *
 *   await app.$dispose()
 * })
 * ```
 *
 * Asserting on service calls — hoist the spy, then `await handle.allSettled()`:
 *
 * ```typescript
 * const saveSpy = vi.fn(async (_t: Todo) => {})
 * const apiService = defineService({ name: 'api', setup: () => ({ save: saveSpy }) })
 * // ...
 * const handle = app.todos.create({ id: 't1', title: 'Buy milk' })
 * await handle.allSettled()
 * expect(saveSpy).toHaveBeenCalledOnce()
 * ```
 *
 * Awaiting commands with declared `result`:
 *
 * ```typescript
 * const todo = await app.todos.create({ title: 'Buy milk' })
 * await expect(app.todos.create({ title: '' })).rejects.toThrow(CommandUnresolvedError)
 * ```
 *
 * Trace hooks as test seams:
 *
 * ```typescript
 * const events: EventTrace[] = []
 * const app = createStrata({ ..., onEvent: (t) => events.push(t) })
 * app.todos.create({ title: 'Buy milk' })
 * expect(events.map(e => e.event)).toEqual(['todoCreated'])
 * ```
 *
 * Programmatic live queries — `acquire()`/`release()`, no Vue:
 *
 * ```typescript
 * const release = app.notes.byId('abc').acquire()
 * // drive fake source ...
 * release()  // idempotent
 * ```
 *
 * Always `await app.$dispose()` between tests.
 *
 * @module @mattfletcher94/strata
 */
export { defineStore } from './store';
export { defineService } from './service';
export { defineOrchestrator } from './orchestrator';
export { defineReaction } from './reaction';
export { defineLiveQuery } from './live-query';
export { createStrata } from './strata';
export { inspectDAG, toMermaid } from './inspect';
export { StrataError, ReactionError, CommandUnresolvedError, strataError } from './error';
export type { ReactionResult } from './error';
export type { SubscribableQuery, LiveSubscribableQuery, EventDescriptor, EventCreator, ReactionHandler, ReactionContext, ReactionConcurrency, ReactionSource, CommandRef, CommandResult, CommandHandle, LiveQueryHandler, LiveQueryContext, Teardown, StrataTypeError, StoreBlueprint, ServiceBlueprint, OrchestratorBlueprint, StoreConfig, ServiceConfig, StrataConfig, ResolvedStrata, Resolved, ResolveDeps, ResolveServices, TransformQueries, EventCreators, ResolveLiveQueries, ResolveOrchestratorCommands, ResolveCommandSubscriptions, StoreQueries, StoreEvents, OrchestratorCommands, Register, DependencyTree, NodeInfo, StoreNodeInfo, OrchestratorNodeInfo, CommandTrace, EventTrace, ReactionTrace, LiveQueryTrace, LiveQuerySnapshot, ReactionSnapshot, } from './types';
