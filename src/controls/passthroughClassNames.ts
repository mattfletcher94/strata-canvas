import { type Control, defineControl } from "./types";

export interface PassthroughClassNamesOptions {
  /** Override the class names. Defaults match the documented escape hatches. */
  readonly classNames?: {
    readonly pointer?: string;
    readonly wheel?: string;
    readonly keyboard?: string;
  };
  /** Default 999 — runs just after `passthroughRegions`, before standard controls. */
  readonly priority?: number;
}

/**
 * Blocks canvas controls when the event target (or focused element, for keys)
 * has an inline escape-hatch class on itself or an ancestor.
 *
 * Default classes:
 *   - `canvas-nopointer` — pointer events don't reach canvas controls
 *   - `canvas-nowheel`   — wheel events don't reach canvas controls
 *   - `canvas-nokey`     — key events don't reach canvas controls
 *
 * Useful for third-party content where wrapping in `<Canvas.PassThrough>`
 * isn't practical (e.g. deeply nested DOM you don't control).
 */
export function passthroughClassNames(options: PassthroughClassNamesOptions = {}): Control {
  const pointerClass = options.classNames?.pointer ?? "canvas-nopointer";
  const wheelClass = options.classNames?.wheel ?? "canvas-nowheel";
  const keyClass = options.classNames?.keyboard ?? "canvas-nokey";

  return defineControl({
    id: "passthroughClassNames",
    priority: options.priority ?? 999,
    onPointerDown(e) {
      return hasAncestorWithClass(e.target as Element | null, pointerClass) ? {} : false;
    },
    onWheel(e) {
      return hasAncestorWithClass(e.target as Element | null, wheelClass);
    },
    onKeyDown() {
      const focus = typeof document !== "undefined" ? document.activeElement : null;
      return hasAncestorWithClass(focus, keyClass);
    },
    onKeyUp() {
      const focus = typeof document !== "undefined" ? document.activeElement : null;
      return hasAncestorWithClass(focus, keyClass);
    },
  });
}

function hasAncestorWithClass(start: Element | null, className: string): boolean {
  let el: Element | null = start;
  while (el) {
    if (el.classList?.contains(className)) return true;
    el = el.parentElement;
  }
  return false;
}
