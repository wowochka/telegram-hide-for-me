/**
 * Telegram's spoiler dust: fine specks drifting and twinkling over hidden
 * content. A message that is being hidden dissolves into it before it folds
 * away; a message that is revealed again emerges from it.
 *
 * Drawn on a canvas with a fixed seed per message, on requestAnimationFrame,
 * so the video renderer's virtual clock steps it frame by frame.
 */
import { useEffect, useRef } from 'react';

interface DustProps {
  /** `cover` fades the dust in over the content; `reveal` blows it away. */
  mode: 'cover' | 'reveal';
  /** Seconds to wait before starting. */
  delay: number;
  seed: string;
}

/** The canvas is drawn denser than CSS pixels so close-ups stay sharp. */
const DENSITY = 4;
const FADE_IN = 0.22;
const REVEAL = 0.75;

function random(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

export function Dust({ mode, delay, seed }: DustProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    element.width = Math.max(1, Math.round(width * DENSITY));
    element.height = Math.max(1, Math.round(height * DENSITY));
    context.scale(DENSITY, DENSITY);

    const next = random(seed);
    const count = Math.round((width * height) / 18);
    const specks = Array.from({ length: count }, () => {
      const angle = next() * Math.PI * 2;
      return {
        x: next() * width,
        y: next() * height,
        vx: Math.cos(angle) * (4 + next() * 9),
        vy: Math.sin(angle) * (4 + next() * 9),
        size: 0.7 + next() * 0.75,
        phase: next() * Math.PI * 2,
        rate: 2.5 + next() * 4,
        // On reveal, each speck leaves on its own beat.
        leave: next(),
      };
    });

    const started = performance.now();
    let frame = 0;
    const draw = () => {
      const t = (performance.now() - started) / 1000 - delay;
      context.clearRect(0, 0, width, height);
      let done = false;
      if (t >= 0) {
        const cover = mode === 'cover' ? Math.min(1, t / FADE_IN) : 1;
        const progress = mode === 'reveal' ? Math.min(1, t / REVEAL) : 0;
        done = mode === 'reveal' && progress >= 1;
        context.fillStyle = '#fff';
        for (const s of specks) {
          let alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase + t * s.rate));
          let x = s.x + s.vx * t;
          let y = s.y + s.vy * t;
          if (mode === 'reveal') {
            const local = Math.max(0, Math.min(1, (progress - s.leave * 0.5) / 0.5));
            alpha *= 1 - local;
            // Blown outward as they go.
            x += s.vx * local * 2.2;
            y += s.vy * local * 2.2;
          }
          x = ((x % width) + width) % width;
          y = ((y % height) + height) % height;
          context.globalAlpha = alpha * cover * 0.9;
          context.fillRect(x, y, s.size, s.size);
        }
        context.globalAlpha = 1;
      } else if (mode === 'reveal') {
        // Waiting to reveal: the content is still fully veiled.
        context.fillStyle = '#fff';
        for (const s of specks) {
          context.globalAlpha = 0.6;
          context.fillRect(s.x, s.y, s.size, s.size);
        }
        context.globalAlpha = 1;
      }
      if (!done) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [delay, mode, seed]);

  return <canvas ref={canvas} className="dust" aria-hidden />;
}
