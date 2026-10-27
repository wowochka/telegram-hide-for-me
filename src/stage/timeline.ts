/** Small, dependency-free helpers for the video timeline. */

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

export type Ease = (p: number) => number;
export const easeOut: Ease = (p) => 1 - Math.pow(1 - p, 3);
export const easeInOut: Ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
/** Slow start, long settle: the curve of a deliberate camera move. */
export const easeCamera: Ease = (p) => (p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2);

/** 0 before `from`, 1 after `to`, eased in between. */
export function ramp(t: number, from: number, to: number, ease: Ease = easeInOut): number {
  if (to <= from) return t >= to ? 1 : 0;
  return ease(clamp01((t - from) / (to - from)));
}
