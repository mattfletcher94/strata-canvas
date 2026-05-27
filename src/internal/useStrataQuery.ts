import type { SubscribableQuery } from "@mattfletcher94/strata";
import { onBeforeUnmount, type Ref, shallowRef, watch } from "vue";

function isQuery<T>(x: SubscribableQuery<T> | (() => SubscribableQuery<T>)): x is SubscribableQuery<T> {
  // SubscribableQuery is callable AND has a `.subscribe` method. A getter
  // returning a query is callable but has no `.subscribe` of its own.
  return typeof (x as { subscribe?: unknown }).subscribe === "function";
}

/**
 * Bridge a Strata `SubscribableQuery<T>` into a Vue `Ref<T>`.
 *
 * Accepts either a bare query or a getter (useful for parameterised queries
 * whose args may change). The ref updates on every query change; the
 * subscription is torn down on component unmount.
 */
export function useStrataQuery<T>(
  source: SubscribableQuery<T> | (() => SubscribableQuery<T>),
): Readonly<Ref<T>> {
  const resolveQuery = (): SubscribableQuery<T> => (isQuery(source) ? source : source());

  const initial = resolveQuery();
  const out = shallowRef<T>(initial());
  let unsub: (() => void) | null = null;
  let currentQuery: SubscribableQuery<T> | null = null;

  const attach = (q: SubscribableQuery<T>) => {
    if (unsub) unsub();
    currentQuery = q;
    out.value = q();
    unsub = q.subscribe((v) => {
      out.value = v;
    });
  };

  attach(initial);

  if (!isQuery(source)) {
    watch(
      () => (source as () => SubscribableQuery<T>)(),
      (next) => {
        if (next !== currentQuery) attach(next);
      },
    );
  }

  onBeforeUnmount(() => {
    if (unsub) {
      unsub();
      unsub = null;
    }
  });

  return out;
}
