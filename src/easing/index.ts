/** Easing function: maps t in [0, 1] to a value in [0, 1] (roughly). */
export type EasingFn = (t: number) => number;

export type EasingName =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeOutExpo";

/** Built-in easing curves. */
export const easings: Record<EasingName, EasingFn> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};

/** Resolve an easing input (name or function) to an EasingFn. */
export function resolveEasing(input: EasingName | EasingFn): EasingFn {
  return typeof input === "function" ? input : easings[input];
}

/**
 * CSS-style `cubic-bezier(x1, y1, x2, y2)` — produces an easing function
 * matching the same curve CSS transitions use.
 *
 * Solves x(t) = u for t via bisection, then returns y(t).
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): EasingFn {
  const sample = (a: number, b: number, t: number) =>
    3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const t = (lo + hi) / 2;
      const xt = sample(x1, x2, t);
      if (Math.abs(xt - x) < 1e-5) return sample(y1, y2, t);
      if (xt < x) lo = t;
      else hi = t;
    }
    return sample(y1, y2, (lo + hi) / 2);
  };
}
