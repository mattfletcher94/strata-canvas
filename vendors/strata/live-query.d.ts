import { LiveQueryHandler } from './types';
/**
 * Type-safe helper for defining a live query — a query whose data is kept
 * fresh by a long-lived I/O source (websocket, server-sent events, observer,
 * watcher, event-store cursor).
 *
 * Infers `TArgs` from `query`'s parameter list and `TValue` from its return
 * type; enforces the same args type on `source`, `onError`, and `onClose`.
 * Zero runtime cost — identity function for type inference only.
 *
 * Identity is `(name, stableJson(args))`. Concurrent acquirers of the same
 * args share one underlying source via an internal refcount; the source is
 * torn down only when the last release arrives.
 *
 * @example
 * ```ts
 * liveQueries: (deps, services: { readonly ws: Resolved<typeof wsService> }) => ({
 *   byTopic: defineLiveQuery({
 *     query:  (topic: string) => deps.messages.byTopic(topic),
 *     source: (topic, { on, fail }) =>
 *       services.ws.subscribe(topic, {
 *         onMessage: on((m) => [deps.messages.received({ topic, m })]),
 *         onError:   (e) => fail(e),
 *       }),
 *     onError: (topic, error) => [deps.messages.streamFailed({ topic, error: error.message })],
 *     onClose: (topic) => [deps.messages.streamClosed({ topic })],
 *   }),
 * })
 * ```
 */
export declare function defineLiveQuery<TArgs extends unknown[], TValue>(handler: LiveQueryHandler<TArgs, TValue>): LiveQueryHandler<TArgs, TValue>;
