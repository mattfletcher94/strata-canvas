import { ReactionHandler } from './types';
/**
 * Type-safe helper for defining a reaction. Pure type-inference anchor;
 * zero runtime cost. Identity function (with widened return type to keep
 * the orchestrator's reaction-record constraint happy across narrow result
 * inferences).
 *
 * Reactions subscribe to events (either projection-derived event creators
 * from a store, or command refs from an orchestrator). When a subscribed
 * event is dispatched, `run` executes; on success `onSuccess` may dispatch
 * follow-up events; on failure `onFailure` may dispatch failure events.
 *
 * Concurrency policy controls how multiple triggers interact:
 * - "parallel" (default) — each trigger spawns an independent run
 * - "serial" — triggers queue, run one at a time in arrival order
 * - "switch" — new trigger aborts the in-flight run via ctx.abort
 *
 * Per-key forms allow scoping the policy by a derived key:
 * - { mode: "switch", key: payload => string } — switch within key, parallel across keys
 * - { mode: "serial", key: payload => string } — serial within key, parallel across keys
 *
 * @example
 * ```ts
 * persist: defineReaction({
 *   on:        deps.todos.todoCreated,
 *   run:       async (todo) => services.api.save(todo),
 *   onSuccess: (todo, server) => [deps.todos.todoSynced({ id: todo.id, serverId: server.id })],
 *   onFailure: (todo, err)    => [deps.todos.todoPersistFailed({ id: todo.id, error: err.message })],
 * })
 * ```
 */
export declare function defineReaction<TPayload, TResult = void>(handler: ReactionHandler<TPayload, TResult>): ReactionHandler<TPayload, any>;
