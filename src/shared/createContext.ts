// Derived from Reka UI (https://github.com/unovue/reka-ui) — MIT License, Copyright (c) 2023 UnoVue.
// See licenses/reka-ui-LICENSE for the original license text.
import type { InjectionKey } from "vue";
import { inject, provide } from "vue";

/**
 * Create a strongly-typed pair of `provide` and `inject` helpers tied to a
 * single Vue injection key. The `inject` helper throws a clear error when used
 * outside the corresponding provider, surfacing misuse at runtime instead of
 * leaking `undefined` into downstream code.
 *
 * @param providerComponentName Name (or names) of the component(s) providing this context.
 *   Used in error messages when injection fails.
 * @param contextName Optional description for the symbol key.
 */
export function createContext<ContextValue>(
  providerComponentName: string | string[],
  contextName?: string,
) {
  const symbolDescription =
    typeof providerComponentName === "string" && !contextName
      ? `${providerComponentName}Context`
      : contextName;

  const injectionKey: InjectionKey<ContextValue | null> = Symbol(symbolDescription);

  const injectContext = <T extends ContextValue | null | undefined = ContextValue>(
    fallback?: T,
  ): T extends null ? ContextValue | null : ContextValue => {
    const context = inject(injectionKey, fallback);
    if (context) return context as any;
    if (context === null) return context as any;
    throw new Error(
      `Injection \`${injectionKey.toString()}\` not found. Component must be used within ${
        Array.isArray(providerComponentName)
          ? `one of the following components: ${providerComponentName.join(", ")}`
          : `\`${providerComponentName}\``
      }`,
    );
  };

  const provideContext = (contextValue: ContextValue) => {
    provide(injectionKey, contextValue);
    return contextValue;
  };

  return [injectContext, provideContext] as const;
}
