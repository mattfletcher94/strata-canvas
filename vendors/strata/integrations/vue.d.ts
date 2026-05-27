import { Ref } from 'vue';
import { SubscribableQuery, LiveSubscribableQuery } from '../types';
/**
 * Bridges a Strata SubscribableQuery into a readonly Vue ref.
 *
 * Must be called inside a Vue effect scope (component setup, Pinia store,
 * or a manual effectScope). Disposal is handled automatically.
 *
 * Two call shapes:
 *
 *   useQuery(query)
 *     Direct form. Subscribes once; unsubscribes on scope disposal.
 *
 *   useQuery(() => query)
 *     Getter form. The getter's reactive reads are tracked via watchEffect;
 *     whenever any tracked value changes, the previous subscription is
 *     closed, the getter is re-evaluated, and the new query is subscribed.
 *     Use this for parameterised queries whose args depend on refs/props:
 *
 *     ```ts
 *     const todo = useQuery(() => strata.todos.byId(props.id));
 *     ```
 *
 * ```vue
 * <script setup>
 * import { useQuery } from '@mattfletcher94/strata/vue'
 *
 * const active = useQuery(app.todos.active)
 * const todo   = useQuery(() => app.todos.byId(props.id))
 * </script>
 * ```
 */
export declare function useQuery<T>(query: SubscribableQuery<T>): Readonly<Ref<T>>;
export declare function useQuery<T>(source: () => SubscribableQuery<T>): Readonly<Ref<T>>;
/**
 * Bridges a Strata `LiveSubscribableQuery` into a readonly Vue ref AND
 * activates its underlying I/O source for the calling scope's lifetime.
 *
 * Behaves exactly like `useQuery` for reading data, with one additional
 * responsibility: it calls `query.acquire()` to open the underlying source
 * (incrementing the live query's refcount) and releases it on scope
 * disposal (or on getter re-derivation, for the getter form).
 *
 * Two call shapes:
 *
 *   useLiveQuery(liveQuery)
 *     Direct form. Acquires once; releases on scope disposal.
 *
 *   useLiveQuery(() => liveQuery | null | undefined)
 *     Getter form. Reactive reads in the getter are tracked via
 *     `watchEffect`. When tracked values change, the previous subscription
 *     is released and the new one is acquired. Returning `null` or
 *     `undefined` from the getter skips activation entirely — the ref
 *     value becomes `undefined` and no I/O runs. This is the idiomatic
 *     way to express "subscribe only when I have an id":
 *
 *     ```ts
 *     const note = useLiveQuery(() =>
 *       props.id ? app.notes.byId(props.id) : null
 *     );
 *     ```
 *
 * Concurrent acquirers of the same `(name, args)` share one underlying
 * I/O source via the live query's internal refcount. Two components
 * mounted with `useLiveQuery(() => app.notes.byId('abc'))` open one
 * source; it closes only when the last component unmounts.
 *
 * ```vue
 * <script setup>
 * import { useLiveQuery } from '@mattfletcher94/strata/vue'
 *
 * const note   = useLiveQuery(() => app.notes.byId(props.id))
 * const pinned = useLiveQuery(app.notes.pinned)
 * </script>
 * ```
 */
export declare function useLiveQuery<T>(query: LiveSubscribableQuery<T>): Readonly<Ref<T>>;
export declare function useLiveQuery<T>(source: () => LiveSubscribableQuery<T> | null | undefined): Readonly<Ref<T | undefined>>;
