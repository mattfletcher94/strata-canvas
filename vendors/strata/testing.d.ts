export {};
/**
 * No dedicated test runtime is shipped with Strata. The recommended approach
 * is to build a real graph via `createStrata` with fake services, drive it
 * through commands, and assert via queries.
 *
 * See the "Testing" section of the README for full patterns:
 *
 * - Canonical real-graph + fake-service shape
 * - Asserting on service calls (hoist the spy outside `setup`, then
 *   `await handle.allSettled()` to wait for triggered reactions)
 * - Awaiting commands with declared `result:` events (resolves with the
 *   `result.ok` payload; rejects with `result.fail` payload or
 *   `CommandUnresolvedError` when no reaction emits the result)
 * - Trace hooks as test seams (`onCommand`, `onEvent`, `onReaction`,
 *   `onLiveQuery`); every trace carries a `corrId` so you can scope
 *   assertions to a single command invocation
 * - Programmatic live-query `acquire()`/`release()` (idempotent release)
 * - Programmatic reaction inspection via `app.$inspectReactions()`
 * - Disposal between tests with `await app.$dispose()` — drains in-flight
 *   reactions, tears down live queries, then services
 *
 * Strata's own test suite under `test/` exercises every pattern documented
 * in the README and is the most up-to-date reference for testing idioms.
 */
