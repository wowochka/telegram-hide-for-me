/**
 * Telegram's default dark chat background: a black screen where the doodle
 * pattern lets a soft four-colour gradient show through.
 *
 * The gradient follows Telegram's own "freeform gradient": four colours sit
 * on four of eight fixed points, the image is swirled slightly around the
 * centre, and each send moves every colour one point along, animated. The
 * colours were fitted to a screenshot of the real app.
 *
 * The pattern is Telegram's doodle tile (from Telegram Web K, GPL-3.0). It is
 * kept locally in public/telegram and not redistributed; without it a drawn
 * stand-in is used. Gradient and pattern are composited once into a bitmap,
 * so the background costs nothing to redraw while the camera moves.
 */
import { useEffect, useRef, useState } from 'react';
import { wallpaperMask } from './doodles';

const POINTS: [number, number][] = [
  [0.8, 0.1],
  [0.6, 0.2],
  [0.35, 0.25],
  [0.25, 0.6],
  [0.2, 0.9],
  [0.4, 0.8],
  [0.65, 0.75],
  [0.75, 0.4],
];

/** Line colours of the default dark wallpaper, as measured on device. */
const NIGHT: [number, number, number][] = [
  [44, 47, 60],
  [63, 48, 41],
  [59, 41, 72],
  [44, 36, 68],
];

const GRADIENT = 60;
/** Bitmap pixels per screen point: enough for the video's close-ups. */
const DENSITY = 3.5;
const WIDTH = 402;
const HEIGHT = 874;
const PATTERN_URL = '/telegram/pattern.svg';

interface Pattern {
  canvas: HTMLCanvasElement;
  real: boolean;
}

let pattern: Promise<Pattern> | null = null;

/** The pattern, rasterised once at the bitmap's size: Telegram's tile, aspect-filled. */
function loadPattern(): Promise<Pattern> {
  pattern ??= new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(WIDTH * DENSITY);
    canvas.height = Math.round(HEIGHT * DENSITY);
    const context = canvas.getContext('2d')!;
    const load = (src: string) =>
      new Promise<HTMLImageElement>((done, fail) => {
        const image = new Image();
        image.onload = () => image.decode().catch(() => undefined).then(() => done(image));
        image.onerror = fail;
        image.src = src;
      });
    load(PATTERN_URL)
      .then((image) => {
        const height = canvas.height;
        const width = (image.naturalWidth / image.naturalHeight) * height || (1440 / 2960) * height;
        context.drawImage(image, (canvas.width - width) / 2, 0, width, height);
        resolve({ canvas, real: true });
      })
      .catch(() =>
        load(wallpaperMask().replace(/^url\("?|"?\)$/g, '')).then((image) => {
          const tile = document.createElement('canvas');
          tile.width = tile.height = Math.round(300 * DENSITY);
          tile.getContext('2d')!.drawImage(image, 0, 0, tile.width, tile.height);
          context.fillStyle = context.createPattern(tile, 'repeat')!;
          context.fillRect(0, 0, canvas.width, canvas.height);
          resolve({ canvas, real: false });
        }),
      );
  });
  return pattern;
}

function positions(phase: number): [number, number][] {
  const base = Math.floor(phase);
  const f = phase - base;
  return [0, 1, 2, 3].map((i) => {
    const a = POINTS[(((base + i * 2) % 8) + 8) % 8]!;
    const b = POINTS[(((base + 1 + i * 2) % 8) + 8) % 8]!;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  });
}

function paintGradient(canvas: HTMLCanvasElement, phase: number) {
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(GRADIENT, GRADIENT);
  const points = positions(phase);
  for (let y = 0; y < GRADIENT; y++) {
    const cy = y / GRADIENT - 0.5;
    for (let x = 0; x < GRADIENT; x++) {
      const cx = x / GRADIENT - 0.5;
      const swirl = 0.35 * Math.hypot(cx, cy);
      const theta = swirl * swirl * 0.8 * 8;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      const px = Math.max(0, Math.min(1, 0.5 + cx * cos - cy * sin));
      const py = Math.max(0, Math.min(1, 0.5 + cx * sin + cy * cos));
      let sum = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < 4; i++) {
        const [qx, qy] = points[i]!;
        let d = Math.max(0, 0.9 - Math.hypot(px - qx, py - qy));
        d = d * d * d * d;
        sum += d;
        const c = NIGHT[i]!;
        r += d * c[0];
        g += d * c[1];
        b += d * c[2];
      }
      sum = Math.max(sum, 0.00001);
      const o = (y * GRADIENT + x) * 4;
      image.data[o] = r / sum;
      image.data[o + 1] = g / sum;
      image.data[o + 2] = b / sum;
      image.data[o + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

/** The gradient, stretched to the screen, kept only where the pattern draws. */
function compose(target: HTMLCanvasElement, gradient: HTMLCanvasElement, art: Pattern) {
  const context = target.getContext('2d')!;
  context.globalCompositeOperation = 'source-over';
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.clearRect(0, 0, target.width, target.height);
  context.drawImage(gradient, 0, 0, target.width, target.height);
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(art.canvas, 0, 0);
  context.globalCompositeOperation = 'source-over';
}

/** Telegram moves the gradient on a gentle ease-out over half a second. */
const ease = (p: number) => 1 - Math.pow(1 - p, 3);

export function Wallpaper({ phase = 1 }: { phase?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = useRef(phase);
  const [art, setArt] = useState<Pattern | null>(null);
  const gradient = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let alive = true;
    loadPattern().then((value) => alive && setArt(value));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !art) return;
    if (!gradient.current) {
      gradient.current = document.createElement('canvas');
      gradient.current.width = gradient.current.height = GRADIENT;
    }
    const draw = (value: number) => {
      paintGradient(gradient.current!, value);
      compose(element, gradient.current!, art);
    };
    const from = shown.current;
    if (from === phase) {
      draw(phase);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const step = () => {
      const p = Math.min(1, (performance.now() - started) / 500);
      shown.current = from + (phase - from) * ease(p);
      draw(shown.current);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [art, phase]);

  return (
    <div className="wall" data-ready={art !== null} data-pattern={art ? (art.real ? 'telegram' : 'drawn') : undefined}>
      <canvas ref={canvas} className="wall-gradient" width={Math.round(WIDTH * DENSITY)} height={Math.round(HEIGHT * DENSITY)} />
    </div>
  );
}
