declare const STORE_BRAND: unique symbol;
declare const SERVICE_BRAND: unique symbol;
declare const ORCHESTRATOR_BRAND: unique symbol;
declare const LIVE_QUERY_HANDLER_BRAND: unique symbol;
declare const LIVE_SUBSCRIBABLE_QUERY_BRAND: unique symbol;
export type { STORE_BRAND, SERVICE_BRAND, ORCHESTRATOR_BRAND };
/**
 * Brand symbols for reactions, event creators, and command refs.
 *
 * These are *runtime symbols*, not type-only declarations — the runtime
 * attaches them via `Object.defineProperty` so that branded values are
 * discriminable both as values (for routing) and as types (for inference).
 */
export declare const REACTION_HANDLER_BRAND: unique symbol;
export declare const EVENT_CREATOR_BRAND: unique symbol;
export declare const COMMAND_REF_BRAND: unique symbol;
/** Marks an internally-constructed synthetic command-invocation event so dispatch can skip projection. */
export declare const SYNTHETIC: unique symbol;
export interface StrataTypeError<Message extends string> {
    readonly _error: Message;
    readonly _brand: never;
}
/**
 * A reactive read of state.
 *
 * - Call `query()` to read the current value.
 * - Call `query.subscribe(cb)` to watch for changes; returns an unsubscribe fn.
 *
 * Subscribers are notified asynchronously via microtask, batched per change.
 */
export interface SubscribableQuery<T> {
    (): T;
    subscribe(cb: (value: T) => void): () => void;
}
/**
 * A `SubscribableQuery` whose underlying data is kept fresh by a long-lived
 * I/O source (websocket, server-sent events, observer, watcher, event-store
 * cursor). The source is opened on first `acquire()` and torn down on the
 * last `release()`.
 *
 * Acquired via `useLiveQuery(query)` in components, or `query.acquire()`
 * programmatically (tests, workers, boot-time singletons).
 *
 * Identity is `(name, stableJson(args))` — calling
 * `strata.notes.byId('abc')` twice returns the same instance, and concurrent
 * acquirers share one underlying source via an internal refcount.
 */
export interface LiveSubscribableQuery<T> extends SubscribableQuery<T> {
    readonly [LIVE_SUBSCRIBABLE_QUERY_BRAND]: true;
    /**
     * Increment the refcount. If this is the first acquirer, the underlying
     * I/O source is opened. Returns an idempotent release function for *this*
     * acquire call — calling it twice is a no-op.
     */
    acquire(): () => void;
}
/**
 * A typed event descriptor produced by an EventCreator. Carries the payload
 * and identity; the runtime additionally tags an internal corrId via Symbol.
 */
export interface EventDescriptor<TPayload = unknown> {
    readonly [EVENT_KIND]: true;
    readonly store: string;
    readonly event: string;
    readonly payload: TPayload;
}
/**
 * An event creator carries a stable identity (store + event name) and a
 * phantom payload type. The runtime uses the identity to route subscriptions;
 * the phantom carries types into reaction `on:` inference.
 *
 * Phantom convention: function-position (`(x: T) => T`) — TS treats it as
 * bivariant in inference and never widens it to `unknown`.
 */
export interface EventCreator<TPayload = any> {
    (payload: TPayload): EventDescriptor<TPayload>;
    readonly [EVENT_CREATOR_BRAND]: true;
    readonly _store: string;
    readonly _event: string;
    readonly _phantom?: (x: TPayload) => TPayload;
}
/**
 * The brand+identity record for a command. Subscribable by reactions via
 * `on: commands.X`. NOT itself callable — the resolved orchestrator surface
 * intersects this with a call signature, so `app.x.cmd(args)` invokes the
 * command and `defineReaction({ on: app.x.cmd })` subscribes to it.
 *
 * Why no call signature on the interface: TypeScript resolves call signatures
 * by picking the first one in an intersection. If both `CommandRef` AND the
 * outer call signature both declared a call shape, TS would lose inference
 * for the awaited value. Keeping the call shape ONLY on the intersection
 * (see `ResolveOrchestratorCommands` below) ensures inference flows correctly.
 */
export interface CommandRef<TArgs extends unknown[] = any[], TData = any, TOk = any, TFail = any> {
    readonly [COMMAND_REF_BRAND]: true;
    readonly _module: string;
    readonly _command: string;
    readonly _phantomArgs?: (x: TArgs) => TArgs;
    readonly _phantomData?: (x: TData) => TData;
    readonly _phantomOk?: (x: TOk) => TOk;
    readonly _phantomFail?: (x: TFail) => TFail;
}
/**
 * Anything a reaction can subscribe to. Events from store projections and
 * command refs share the same brand-driven identity protocol.
 *
 * Single-source inference: `on: deps.x.event` infers TPayload as the event's
 * payload type. `on: commands.create` infers TPayload as the command's first
 * argument type (or `void` for zero-arg commands — see
 * `ResolveCommandSubscriptions`).
 *
 * Multi-source inference: `on: [a, b]` infers TPayload as `unknown`. The
 * runtime uses `ctx.trigger.event` to discriminate; user code can narrow via
 * an equality check (`ctx.trigger.event === '...'`).
 */
export type ReactionSource<T = unknown> = EventCreator<T> | CommandRef<[T], any, any, any> | CommandRef<[], any, any, any>;
/** Helper: extract payload from any ReactionSource. */
export type SourcePayload<S> = S extends EventCreator<infer P> ? P : S extends CommandRef<infer A, any, any, any> ? A extends [infer First] ? First : void : never;
/**
 * Concurrency mode. Default "parallel".
 *
 * - "parallel" — each trigger spawns an independent run; no coordination
 * - "serial" — triggers queue, run one at a time in arrival order
 * - "switch" — new trigger aborts the in-flight run via ctx.abort
 *
 * Per-key forms (for "search per topic", "save per document"):
 * - `{ mode: "switch", key: payload => string }` — switch within key, parallel across keys
 * - `{ mode: "serial", key: payload => string }` — serial within key, parallel across keys
 */
export type ReactionConcurrency = "parallel" | "serial" | "switch" | {
    readonly mode: "switch" | "serial";
    readonly key: (payload: any) => string;
};
/**
 * Reaction context provided to the run handler. Minimal by design.
 *
 * - `abort` — signaled when the reaction is superseded (concurrency: "switch")
 *   or when the graph is disposed mid-flight. Wire into AbortSignal-aware
 *   APIs like `fetch`.
 * - `trigger` — origin metadata. Useful when a single reaction subscribes to
 *   multiple sources and needs to discriminate.
 */
export interface ReactionContext {
    readonly abort: AbortSignal;
    readonly trigger: {
        /** For projection events: the store name. For command-derived: `__command__<module>`. */
        readonly store: string;
        /** Event name for projections; command name for command-derived. */
        readonly event: string;
        readonly payload: unknown;
    };
}
/**
 * The reaction handler. `on` accepts a single ReactionSource (payload type
 * is inferred) or an array of any sources (payload type is `unknown`; the
 * user should narrow via `ctx.trigger.event`).
 */
export interface ReactionHandler<TPayload = any, TResult = any> {
    readonly [REACTION_HANDLER_BRAND]?: true;
    readonly on: ReactionSource<TPayload> | ReadonlyArray<EventCreator<any> | CommandRef<any, any, any, any>>;
    readonly run: (payload: TPayload, ctx: ReactionContext) => TResult | Promise<TResult>;
    readonly onSuccess?: (payload: TPayload, result: Awaited<TResult>) => readonly EventDescriptor[];
    readonly onFailure?: (payload: TPayload, error: Error) => readonly EventDescriptor[];
    readonly concurrency?: ReactionConcurrency;
}
/**
 * The result a command returns synchronously. `events` are dispatched through
 * stores and reaction subscribers; `data` is attached to the handle for
 * synchronous access; `result` declares the success/failure event(s) the
 * awaited handle should resolve/reject on.
 */
export interface CommandResult<TData = void, TOk = void, TFail = void> {
    readonly events?: readonly EventDescriptor[];
    readonly data?: TData;
    readonly result?: EventCreator<TOk> | {
        readonly ok: EventCreator<TOk>;
        readonly fail?: EventCreator<TFail>;
    };
}
/**
 * The consumer-facing handle returned by every command call. Thenable;
 * exposes `.data` for synchronous access. No `resolveEffects`.
 *
 * Type inference rules:
 * - No `result` declared → await resolves with `data` after all triggered reactions settle
 * - `result` is a single creator → await resolves with that event's payload, rejects with Error
 * - `result` is `{ ok, fail }` → resolves with ok payload, rejects with fail payload
 *
 * `then` is declared explicitly (not just inherited from PromiseLike) so users
 * who write `handle.then(onOk, onFail)` get the typed reject branch.
 *
 * `allSettled()` resolves when every reaction transitively triggered by this
 * command's events has settled. Used for tests and "wait for everything"
 * cleanup — the result event may have resolved the main promise long before
 * background reactions finish.
 */
export interface CommandHandle<TData = void, TOk = TData, TFail = Error> extends PromiseLike<TOk> {
    readonly data: TData;
    then<TR1 = TOk, TR2 = never>(onFulfilled?: ((value: TOk) => TR1 | PromiseLike<TR1>) | null, onRejected?: ((reason: TFail | Error) => TR2 | PromiseLike<TR2>) | null): Promise<TR1 | TR2>;
    catch<TR = never>(onRejected?: ((reason: TFail | Error) => TR | PromiseLike<TR>) | null): Promise<TOk | TR>;
    finally(onFinally?: (() => void) | null): Promise<TOk>;
    /** Resolves when all reactions transitively triggered by this command settle. */
    allSettled(): Promise<void>;
}
/**
 * Teardown returned by a live query's `source` handler. Invoked when the
 * refcount drops to zero, when `ctx.fail` is called, or when the strata
 * graph is disposed. May be sync or async.
 */
export type Teardown = () => void | Promise<void>;
/**
 * Provided to a live query's `source` handler.
 *
 * - `on(handler)` — wraps a pure `(data) => events` mapper into a
 *   `(data) => void` callback that can be handed to a source. The wrapped
 *   function projects the returned events through the same pipeline as
 *   reaction `onSuccess`-returned events. Handler may also return a Promise of
 *   events; Strata awaits and projects on resolve.
 * - `fail(error)` — abort the live query. Dispatches `onError`-returned
 *   events, then runs the teardown. Use when the source itself reports an
 *   unrecoverable error mid-stream.
 *
 * Wrapped callbacks are silent no-ops once the live query has been torn
 * down — sources that don't honour their unsubscribe synchronously cannot
 * crash projections.
 */
export interface LiveQueryContext {
    readonly on: <T>(handler: (data: T) => readonly EventDescriptor[] | Promise<readonly EventDescriptor[]>) => (data: T) => void;
    readonly fail: (error: Error) => void;
}
/**
 * Object form for defining a live query — a query whose data is kept fresh
 * by a long-lived I/O source.
 *
 * - `query` — pure derivation from store state. Same shape as a regular
 *   query: zero-arg `() => T` or parameterised `(...args) => T`. Args are
 *   the refcount key.
 * - `source` — declares the long-lived I/O source. Receives `(args, ctx)`.
 *   Wires the source via service calls, using `ctx.on(...)` to turn source
 *   callbacks into event-projecting functions. Returns a `Teardown` (sync)
 *   or `Promise<Teardown>` (async).
 * - `onError` — called when `ctx.fail` runs, when `source` rejects, or
 *   when `source` throws. Returns events to dispatch BEFORE teardown runs.
 * - `onClose` — called when teardown happens normally (refcount→0 or
 *   `$dispose`). Returns events to dispatch.
 */
export interface LiveQueryHandler<TArgs extends unknown[] = any[], TValue = any> {
    readonly [LIVE_QUERY_HANDLER_BRAND]?: true;
    readonly query: (...args: TArgs) => SubscribableQuery<TValue> | (() => TValue);
    readonly source: (args: TArgs[0], ctx: LiveQueryContext) => Teardown | Promise<Teardown>;
    readonly onError?: (args: TArgs[0], error: Error) => readonly EventDescriptor[];
    readonly onClose?: (args: TArgs[0]) => readonly EventDescriptor[];
}
type TransformQuery<T> = T extends () => SubscribableQuery<infer R> ? SubscribableQuery<R> : T extends () => infer R ? SubscribableQuery<R> : T extends (...args: infer A) => SubscribableQuery<infer R> ? (...args: A) => SubscribableQuery<R> : T extends (...args: infer A) => () => infer R ? (...args: A) => SubscribableQuery<R> : never;
export type TransformQueries<T> = {
    readonly [K in keyof T]: TransformQuery<T[K]>;
};
/**
 * Maps a record of `LiveQueryHandler`s into the resolved orchestrator
 * surface. Zero-arg live queries become a bare `LiveSubscribableQuery<T>`;
 * parameterised live queries become a function that returns one.
 */
export type ResolveLiveQueries<T> = {
    readonly [K in keyof T]: T[K] extends LiveQueryHandler<infer A, infer V> ? A extends [] ? LiveSubscribableQuery<V> : (...args: A) => LiveSubscribableQuery<V> : never;
};
/** Updated EventCreators map. Now produces branded EventCreators. */
export type EventCreators<TProjections> = {
    readonly [K in keyof TProjections]: TProjections[K] extends (state: any, payload: infer P) => any ? EventCreator<P> : never;
};
type ExtractCommandTypes<T> = T extends (...args: any[]) => CommandResult<infer D, infer Ok, infer F> ? {
    data: D;
    ok: Ok;
    fail: F;
} : {
    data: void;
    ok: void;
    fail: void;
};
type ResolveOneCommand<X extends {
    data: any;
    ok: any;
    fail: any;
}> = X["ok"] extends void ? CommandHandle<X["data"], X["data"], Error> : CommandHandle<X["data"], X["ok"], X["fail"] extends void ? Error : X["fail"]>;
/**
 * Resolves command functions into callable+subscribable refs. The
 * intersection has exactly one call signature (from the function side);
 * `CommandRef` itself carries no call signature, so TS resolves call
 * inference to the outer one and `await app.x.cmd(args)` types correctly
 * as `ResolveOneCommand`'s await target.
 */
export type ResolveOrchestratorCommands<T> = {
    readonly [K in keyof T]: T[K] extends (...args: infer A) => any ? CommandRef<A, ExtractCommandTypes<T[K]>["data"], ExtractCommandTypes<T[K]>["ok"], ExtractCommandTypes<T[K]>["fail"]> & ((...args: A) => ResolveOneCommand<ExtractCommandTypes<T[K]>>) : never;
};
/**
 * Maps a command record into the third reactions-callback parameter.
 *
 * Handles zero-arg commands: a zero-arg command's payload is `void`, and the
 * reaction subscribed via `commands.refresh` receives `undefined` at runtime.
 */
export type ResolveCommandSubscriptions<T> = {
    readonly [K in keyof T]: T[K] extends (...args: infer A) => any ? CommandRef<A extends [] ? [void] : [A[0]], any, any, any> : never;
};
export type AsyncFnKeys<T> = {
    [K in keyof T]: T[K] extends (...args: any[]) => Promise<any> ? K : never;
}[keyof T];
export type ResolveDeps<T> = {
    readonly [K in keyof T]: Resolved<T[K]>;
};
export type ResolveServices<T> = {
    readonly [K in keyof T]: Resolved<T[K]>;
};
export type StoreQueries<T> = T extends StoreBlueprint<infer R> ? {
    [K in keyof R]: R[K] extends SubscribableQuery<any> | ((...args: any[]) => SubscribableQuery<any>) ? R[K] : never;
} : never;
export type StoreEvents<T> = T extends StoreBlueprint<infer R> ? {
    [K in keyof R]: R[K] extends EventCreator<any> ? R[K] : never;
} : never;
/** Helper export type for orchestrator-level tooling. */
export type OrchestratorCommands<T> = T extends OrchestratorBlueprint<infer R> ? {
    [K in keyof R]: R[K] extends CommandRef<any, any, any, any> ? R[K] : never;
} : never;
export interface Register {
}
export interface StoreConfig<TState extends object, TQueries, TProjections extends Record<string, (state: Readonly<TState>, payload?: any) => TState>> {
    readonly name: string;
    readonly responsibility?: string;
    readonly state: TState;
    readonly queries?: (state: Readonly<TState>) => TQueries;
    readonly projections?: TProjections;
}
export interface StoreBlueprint<TResolved = any> {
    readonly [STORE_BRAND]: true;
    readonly _type: "store";
    readonly _resolved: TResolved;
    readonly _name: string;
    readonly _responsibility: string | undefined;
    readonly _initialState: () => object;
    readonly _queries: ((state: any) => any) | undefined;
    readonly _projections: Record<string, (state: any, payload: any) => any> | undefined;
}
export interface ServiceConfig<TApi, TConfig = void> {
    readonly name: string;
    readonly responsibility?: string;
    readonly setup: (config: TConfig) => TApi | Promise<TApi>;
    readonly teardown?: (api: TApi) => void;
}
export interface ServiceBlueprint<TResolved = any, TConfig = any> {
    readonly [SERVICE_BRAND]: true;
    readonly _type: "service";
    readonly _resolved: TResolved;
    readonly _name: string;
    readonly _responsibility: string | undefined;
    readonly _setup: (config: any) => any;
    readonly _teardown: ((api: any) => void) | undefined;
    readonly _config: any;
    with(config: TConfig): ServiceBlueprint<TResolved, TConfig>;
}
export interface OrchestratorBlueprint<TResolved = any> {
    readonly [ORCHESTRATOR_BRAND]: true;
    readonly _type: "orchestrator";
    readonly _resolved: TResolved;
    readonly _name: string;
    readonly _responsibility: string | undefined;
    readonly _deps: Record<string, StoreBlueprint | OrchestratorBlueprint> | undefined;
    readonly _services: Record<string, ServiceBlueprint> | undefined;
    readonly _queries: ((deps: any) => any) | undefined;
    readonly _commands: ((deps: any) => any) | undefined;
    readonly _reactions: ((deps: any, services: any, commands: any) => any) | undefined;
    readonly _liveQueries: ((deps: any, services: any) => any) | undefined;
}
export interface StrataConfig {
    readonly name: string;
    readonly responsibility: string;
    readonly services?: Record<string, ServiceBlueprint>;
    readonly stores?: Record<string, StoreBlueprint>;
    readonly orchestrators?: Record<string, OrchestratorBlueprint>;
    readonly onCommand?: (trace: CommandTrace) => void;
    readonly onEvent?: (trace: EventTrace) => void;
    readonly onReaction?: (trace: ReactionTrace) => void;
    readonly onLiveQuery?: (trace: LiveQueryTrace) => void;
}
export type ResolvedStrata<TConfig> = (TConfig extends {
    stores: infer S extends Record<string, StoreBlueprint>;
} ? {
    readonly [K in keyof S]: Resolved<S[K]>;
} : unknown) & (TConfig extends {
    orchestrators: infer O extends Record<string, OrchestratorBlueprint>;
} ? {
    readonly [K in keyof O]: Resolved<O[K]>;
} : unknown) & {
    readonly $dispose: (options?: {
        timeout?: number;
        force?: boolean;
    }) => Promise<void>;
    readonly $flush: () => Promise<void>;
    readonly $inspectLiveQueries: () => readonly LiveQuerySnapshot[];
    readonly $inspectReactions: () => readonly ReactionSnapshot[];
};
export type Resolved<T> = T extends {
    _resolved: infer R;
} ? R : never;
export interface CommandTrace {
    readonly module: string;
    readonly command: string;
    readonly args: readonly unknown[];
    readonly corrId: string;
    readonly timestamp: number;
}
export interface EventTrace {
    readonly store: string;
    readonly event: string;
    readonly payload: unknown;
    readonly corrId: string | null;
    readonly timestamp: number;
}
export interface ReactionTrace {
    readonly module: string;
    readonly reaction: string;
    readonly trigger: {
        readonly store: string;
        readonly event: string;
        readonly payload: unknown;
    };
    readonly corrId: string | null;
    readonly status: "started" | "succeeded" | "failed" | "aborted";
    readonly duration: number;
    readonly result?: unknown;
    readonly error?: unknown;
}
export interface LiveQueryTrace {
    readonly module: string;
    readonly liveQuery: string;
    readonly args: unknown;
    readonly status: "opened" | "closed" | "errored";
    readonly timestamp: number;
    readonly duration?: number;
    readonly error?: unknown;
}
/** Snapshot of a single active live-query entry, returned by `$inspectLiveQueries()`. */
export interface LiveQuerySnapshot {
    readonly module: string;
    readonly liveQuery: string;
    readonly args: unknown;
    readonly status: "opening" | "open" | "pending-close";
    readonly refcount: number;
    readonly openedAt: number;
}
/** Snapshot of a single registered reaction, returned by `$inspectReactions()`. */
export interface ReactionSnapshot {
    readonly module: string;
    readonly reaction: string;
    readonly inFlight: number;
    readonly corrIdsInFlight: number;
    readonly concurrency: ReactionConcurrency;
}
export interface NodeInfo {
    readonly key: string;
    readonly name: string;
    readonly responsibility?: string;
}
export interface OrchestratorNodeInfo extends NodeInfo {
    readonly reactions: readonly string[];
    readonly liveQueries: readonly string[];
}
export interface StoreNodeInfo extends NodeInfo {
    readonly projections: readonly string[];
}
export interface DependencyTree {
    readonly name: string;
    readonly responsibility: string;
    readonly services: readonly NodeInfo[];
    readonly stores: readonly StoreNodeInfo[];
    readonly orchestrators: readonly OrchestratorNodeInfo[];
}
export declare const INSPECT_SYMBOL: unique symbol;
export declare const INSPECT_LIVE_QUERIES_SYMBOL: unique symbol;
export declare const EVENT_KIND: unique symbol;
export declare const LIVE_QUERY_BRAND: unique symbol;
