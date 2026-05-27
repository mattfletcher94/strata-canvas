// Derived from Reka UI (https://github.com/unovue/reka-ui) — MIT License, Copyright (c) 2023 UnoVue.
// See licenses/reka-ui-LICENSE for the original license text.

/** Checks whether a given VNode is a render-viable element. */
export function isValidVNodeElement(input: any): boolean {
  return (
    input &&
    (typeof input.type === "string" ||
      typeof input.type === "object" ||
      typeof input.type === "function")
  );
}
