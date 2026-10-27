/**
 * The video take, at /stage: a square 1920 × 1920 frame, the real chat on an
 * iPhone, a camera that moves in on each step, short captions, and at the end
 * Max's own phone beside yours. Everything on the phones is the working
 * feature; only the other people in the group are scripted.
 *
 * The take is cut to a 120 BPM grid (a beat every 0.5 s) so the soundtrack
 * made by sound.mjs lands on it. Time comes from performance.now(), so the
 * renderer's virtual clock can step it frame by frame.
 */
import { useEffect, useRef, useState } from 'react';
import { BASE_TIME, ME } from '../chat/data';
import type { GroupMessage } from '../hide/model';
import { ChatScreen, type ChatHandle } from '../phone/ChatScreen';
import { Device } from '../phone/parts';
import { clamp01, easeCamera, easeOut, lerp, ramp, type Ease } from './timeline';
import './stage.css';

declare global {
  interface Window {
    __stage?: {
      ready: boolean;
      duration: number;
      error: string | null;
      cues: Cue[];
      start(): void;
      converged(): boolean;
    };
  }
}

export interface Cue {
  t: number;
  kind: 'pop' | 'muted' | 'hold' | 'menu' | 'page' | 'dust' | 'fold' | 'reveal' | 'toast' | 'whoosh' | 'key' | 'send' | 'title' | 'caption';
  /** -1 left … 1 right, from where it happens in the frame. */
  pan: number;
}

const SIZE = 1920;
const DURATION = 28.5;
/** Where the soundtrack drops: the moment Max is hidden. */
export const DROP = 6.5;
export const TITLE = 24.5;

// ----------------------------------------------------------------- framing

/** Phone points to video pixels for the hero phone. */
const K = 1.72;
const HERO = { x: SIZE / 2 - 225 * K, y: 300, k: K };
/** The two phones side by side, then lowered under the title. */
const PAIR_K = 1.36;
const PAIR_Y = 384;
const FINAL_Y = 566;
const A_PAIR = { x: SIZE / 2 - 40 - 450 * PAIR_K, y: PAIR_Y, k: PAIR_K };
const B_PAIR = { x: SIZE / 2 + 40, y: PAIR_Y, k: PAIR_K };
const B_AWAY = { ...B_PAIR, x: SIZE + 280 };

interface Place {
  x: number;
  y: number;
  k: number;
}
interface Cam {
  x: number;
  y: number;
  z: number;
}

const WIDE: Cam = { x: SIZE / 2, y: SIZE / 2, z: 1 };
const START: Cam = { x: SIZE / 2, y: SIZE / 2 + 8, z: 0.97 };

/**
 * Frames a point on the hero phone's screen. Close-ups sit a little below
 * the middle of the frame, leaving the top for the caption, and never look
 * past the bottom of the phone into empty space.
 */
const onHero = (sx: number, sy: number, z: number): Cam => {
  const bottom = HERO.y + 920 * K + 40 - SIZE / 2 / z;
  return { x: HERO.x + (24 + sx) * K, y: Math.min(HERO.y + (23 + sy) * K - 80 / z, bottom), z };
};

interface Move {
  start: number;
  dur: number;
  to: () => Cam;
  ease?: Ease;
  /** Re-measure the target every frame (for layouts that are still moving). */
  track?: boolean;
  from?: Cam;
  target?: Cam;
}

/** Each move starts from wherever the camera is and is resolved when it begins. */
function cameraAt(moves: Move[], t: number): Cam {
  let cam = START;
  for (const move of moves) {
    if (t < move.start) break;
    if (!move.target || (move.track && t < move.start + move.dur + 0.6)) {
      move.from ??= cam;
      move.target = move.to();
    }
    const p = (move.ease ?? easeCamera)(clamp01((t - move.start) / move.dur));
    const from = move.from!;
    const to = move.target;
    cam = { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p), z: from.z * Math.pow(to.z / from.z, p) };
  }
  return cam;
}

const mixPlace = (a: Place, b: Place, p: number): Place => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), k: a.k * Math.pow(b.k / a.k, p) });

/** A quick zoom "punch" on the big beats: in fast, out slow. */
function punch(t: number, at: number, amount: number): number {
  const local = t - at;
  if (local < 0) return 0;
  return amount * Math.min(1, local / 0.06) * Math.exp(-local * 5.5);
}

// ------------------------------------------------------------------- light

/** The background glows, drawn small and scaled up: soft by nature, and cheap. */
const GLOW = 192;
interface Light {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rgb: string;
  alpha: number;
}
function drawGlow(canvas: HTMLCanvasElement, lights: Light[]) {
  const context = canvas.getContext('2d')!;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = '#000';
  context.fillRect(0, 0, GLOW, GLOW);
  for (const light of lights) {
    context.setTransform(light.rx * GLOW, 0, 0, light.ry * GLOW, light.x * GLOW, light.y * GLOW);
    const fill = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    fill.addColorStop(0, `rgba(${light.rgb}, ${light.alpha})`);
    fill.addColorStop(0.72, `rgba(${light.rgb}, 0)`);
    context.fillStyle = fill;
    context.fillRect(-1, -1, 2, 2);
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
}

/** Fine static grain, as a tile: it keeps the glows from banding in 8-bit video. */
function grainTile(): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(256, 256);
  let state = 7;
  for (let i = 0; i < image.data.length; i += 4) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const v = state >>> 24;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return `url(${canvas.toDataURL()})`;
}

/** The phone's shadow, blurred once into a bitmap rather than on every frame. */
function shadowImage(): string {
  const pad = 200;
  const canvas = document.createElement('canvas');
  canvas.width = 450 + pad * 2;
  canvas.height = 920 + pad * 2;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#000';
  for (const [blur, y, alpha] of [
    [60, 30, 0.75],
    [130, 60, 0.6],
  ] as const) {
    context.shadowColor = `rgba(0, 0, 0, ${alpha})`;
    context.shadowBlur = blur;
    context.shadowOffsetY = y;
    context.beginPath();
    context.roundRect(pad + 30, pad + 40, 390, 860, 70);
    context.fill();
  }
  return `url(${canvas.toDataURL()})`;
}

// ---------------------------------------------------------------- captions

interface Caption {
  in: number;
  out: number;
  /** Words; a leading `*` marks an accented word. */
  words: string[];
}

const CAPTIONS: Caption[] = [
  { in: -1, out: 2.45, words: ['One', 'person', '*flooding', '*the', '*group?'] },
  { in: 3.75, out: 5.9, words: ['Hide', 'them.', '*Only', '*for', '*you.'] },
  { in: 6.6, out: 8.45, words: ['Their', 'messages', '*fold', '*away.'] },
  { in: 8.75, out: 10.4, words: ['You', 'always', 'see', '*who’s', '*hidden.'] },
  { in: 11.25, out: 13.55, words: ['They', 'keep', 'typing.', '*You', '*get', '*quiet.'] },
  { in: 13.85, out: 15.7, words: ['Replies', 'to', 'you', '*still', '*get', '*through.'] },
  { in: 15.95, out: 19.55, words: ['Curious?', '*Peek', '*anytime.'] },
  { in: 20.25, out: 23.85, words: ['And', 'Max', '*never', '*knows.'] },
];

// ------------------------------------------------------------------ script

interface Touch {
  phone: 'a' | 'b';
  start: number;
  /** How long the finger stays down. */
  hold: number;
  at: () => { x: number; y: number };
  x?: number;
  y?: number;
}

interface Step {
  t: number;
  run(): void;
}

interface Take {
  steps: Step[];
  moves: Move[];
  touches: Touch[];
}

/** Where an element sits on a phone's screen, in screen points. */
function rectOn(handle: ChatHandle, element: Element | null | undefined) {
  if (!element) throw new Error('The take looked for an element that is not on screen.');
  const root = handle.root.getBoundingClientRect();
  const scale = root.width / 402;
  const r = element.getBoundingClientRect();
  return { x: (r.left - root.left) / scale, y: (r.top - root.top) / scale, w: r.width / scale, h: r.height / scale };
}

const center = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function buildTake(a: ChatHandle, b: ChatHandle, setDraft: (text: string) => void, cue: (kind: Cue['kind'], pan?: number) => void): Take {
  let count = 0;
  const message = (from: string, text: string, extra: Partial<GroupMessage> = {}): GroupMessage => ({
    id: `take${++count}`,
    from,
    sentAt: BASE_TIME,
    content: { kind: 'text', text },
    ...extra,
  });
  const both = (m: GroupMessage) => {
    a.push(m);
    b.push(m);
  };
  const $a = (selector: string) => a.root.querySelector(selector);
  const lastBubbleOf = (from: string) => {
    const rows = a.root.querySelectorAll(`[data-tid="message"][data-from="${from}"]`);
    return rows[rows.length - 1]?.querySelector('[data-tid="bubble"]') ?? null;
  };
  const hiddenRows = () => [...a.root.querySelectorAll('[data-tid="hidden-row"] button')];
  let peekRow = '';
  const peekPill = () => a.root.querySelector(`[data-tid="hidden-row"][data-key="${peekRow}"] button`);

  const steps: Step[] = [];
  const at = (t: number, run: () => void) => steps.push({ t, run });

  // 1. Max takes over the group, on eighth notes.
  const flood: [number, () => GroupMessage][] = [
    [0.5, () => message('max', 'lol')],
    [0.75, () => message('max', 'guys')],
    [1.0, () => message('max', 'GUYS')],
    [1.375, () => message('max', 'did you see this')],
    [1.75, () => ({ ...message('max', ''), content: { kind: 'voice', seconds: 12 } })],
    [2.0, () => message('max', 'which platform??')],
    [2.25, () => message('max', 'hello??')],
  ];
  for (const [t, build] of flood) {
    at(t, () => {
      both(build());
      cue('pop', 0.12);
    });
  }

  // 2. Long-press his message, Hide Max for Me, Until Tomorrow.
  let target = '';
  at(2.5, () => {
    target = a.messages().filter((m) => m.from === 'max').at(-1)!.id;
    cue('whoosh', 0);
  });
  at(3.5, () => cue('hold', -0.05));
  at(4.0, () => {
    a.longPress(target);
    cue('menu', -0.05);
  });
  at(5.08, () => {
    ($a('[data-tid="menu-hide"]') as HTMLElement).click();
    cue('page', 0);
  });
  // The tap, the menu closing, then the hide lands on the drop.
  at(6.2, () => ($a('[data-tid="menu-today"]') as HTMLElement).click());
  at(DROP, () => {
    cue('dust', 0);
    cue('toast', 0);
  });

  // 3. He keeps typing: the counter moves, nothing else does.
  ['guys??', 'hello', 'ok nvm'].forEach((text, i) =>
    at(12.0 + i * 0.5, () => {
      both(message('max', text));
      cue('muted', 0);
    }),
  );

  // 4. A reply to you still gets through.
  at(14.0, () => {
    const mine = a.messages().find((m) => m.from === ME && m.content.kind === 'text');
    both(message('max', 'Alex you’re the best', mine ? { replyTo: mine.id } : {}));
    cue('pop', 0);
  });

  // 5. Peek: his photo comes back out of the dust, then folds away again.
  at(15.9, () => {
    const rows = [...a.root.querySelectorAll('[data-tid="hidden-row"]')];
    const withPhoto = rows.find((row) => {
      let next = row.nextElementSibling;
      while (next && next.getAttribute('data-tid') !== 'message') next = next.nextElementSibling;
      return next?.getAttribute('data-from') === ME;
    });
    peekRow = (withPhoto ?? rows[2] ?? rows[0])!.getAttribute('data-key')!;
  });
  at(17.5, () => {
    (peekPill() as HTMLElement).click();
    cue('reveal', 0);
  });
  at(19.0, () => {
    (peekPill() as HTMLElement).click();
    cue('fold', 0);
  });

  // 6. Max's phone: his messages go out as usual. He never knows.
  at(19.75, () => cue('whoosh', 0));
  const typed = 'see you all at 9:40';
  const typeFrom = 21.85;
  const perKey = 0.06;
  for (let i = 1; i <= typed.length; i++) {
    at(typeFrom + i * perKey, () => {
      setDraft(typed.slice(0, i));
      cue('key', 0.45);
    });
  }
  at(23.25, () => {
    setDraft('');
    both(message('max', typed));
    cue('send', 0.45);
    cue('muted', -0.45);
  });
  at(TITLE, () => cue('title', 0));
  for (const caption of CAPTIONS) if (caption.in > 0) at(caption.in, () => cue('caption', 0));

  const moves: Move[] = [
    { start: 0, dur: 2.4, to: () => ({ x: SIZE / 2, y: SIZE / 2 + 30, z: 1.05 }), ease: easeOut },
    {
      start: 2.5,
      dur: 1.0,
      to: () => {
        const r = rectOn(a, lastBubbleOf('max'));
        return onHero(201, r.y + r.h / 2 - 30, 1.85);
      },
    },
    {
      start: 4.2,
      dur: 0.75,
      to: () => {
        const preview = rectOn(a, $a('.menu-preview'));
        const menu = $a('[data-tid="menu"]') as HTMLElement;
        return onHero(201, (preview.y + menu.offsetTop + menu.offsetHeight) / 2 + 10, 1.7);
      },
    },
    { start: 6.35, dur: 1.2, to: () => WIDE },
    {
      start: 8.5,
      dur: 0.9,
      to: () => {
        const r = rectOn(a, $a('[data-tid="nav-title"]'));
        return onHero(201, r.y + r.h / 2 + 30, 2.5);
      },
    },
    {
      start: 10.5,
      dur: 1.1,
      to: () => {
        const rows = hiddenRows();
        const r = rectOn(a, rows[rows.length - 1]);
        return onHero(201, r.y - 10, 2.0);
      },
    },
    {
      start: 14.05,
      dur: 0.8,
      track: true,
      to: () => {
        const r = rectOn(a, lastBubbleOf('max'));
        return onHero(201, r.y + r.h / 2 - 40, 2.0);
      },
    },
    {
      start: 16.0,
      dur: 1.0,
      to: () => {
        const r = rectOn(a, peekPill());
        return onHero(201, r.y, 1.9);
      },
    },
    {
      // The pill stays put and his messages unfold below it: widen to see them.
      start: 17.6,
      dur: 0.9,
      to: () => {
        const pill = rectOn(a, peekPill());
        return onHero(201, pill.y + 210, 1.5);
      },
    },
    {
      start: 19.1,
      dur: 0.6,
      to: () => {
        const pill = rectOn(a, peekPill());
        return onHero(201, pill.y + 60, 1.8);
      },
    },
    { start: 19.75, dur: 1.25, to: () => WIDE },
  ];

  const touches: Touch[] = [
    { phone: 'a', start: 3.5, hold: 0.5, at: () => center(rectOn(a, lastBubbleOf('max'))) },
    { phone: 'a', start: 4.98, hold: 0.12, at: () => center(rectOn(a, $a('[data-tid="menu-hide"]'))) },
    { phone: 'a', start: 6.1, hold: 0.12, at: () => center(rectOn(a, $a('[data-tid="menu-today"]'))) },
    { phone: 'a', start: 17.4, hold: 0.12, at: () => center(rectOn(a, peekPill())) },
    { phone: 'a', start: 18.9, hold: 0.12, at: () => center(rectOn(a, peekPill())) },
    { phone: 'b', start: 23.15, hold: 0.12, at: () => center(rectOn(b, b.root.querySelector('[data-tid="send"]'))) },
  ];

  steps.sort((x, y) => x.t - y.t);
  return { steps, moves, touches };
}

/** The finger: a soft grey disc that lands, holds and lifts. */
function touchStyle(touch: Touch, t: number): { opacity: number; scale: number } | null {
  const local = t - touch.start;
  const lift = touch.hold;
  if (local < 0 || local > lift + 0.32) return null;
  const land = easeOut(clamp01(local / 0.1));
  const press = touch.hold > 0.3 ? ramp(local, 0.1, lift, easeOut) : 0;
  const up = ramp(local, lift, lift + 0.32, easeOut);
  return { opacity: land * (1 - up), scale: lerp(1.5, 1, land) - press * 0.12 + up * 0.18 };
}

/** A caption word rises into place with a slight overshoot, then lifts away. */
function wordStyle(caption: Caption, index: number, t: number): { opacity: number; y: number; blur: number } {
  const local = t - caption.in - index * 0.055;
  const p = clamp01(local / 0.42);
  const back = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
  const rise = caption.in < 0 ? 1 : back;
  const leave = ramp(t, caption.out, caption.out + 0.28, easeOut);
  const opacity = (caption.in < 0 ? 1 : clamp01(local / 0.2)) * (1 - leave);
  return { opacity, y: (1 - rise) * 46 - leave * 24, blur: (1 - clamp01(caption.in < 0 ? 1 : local / 0.25)) * 10 + leave * 6 };
}

// ------------------------------------------------------------------- stage

export default function Stage() {
  const capture = new URLSearchParams(location.search).has('capture');
  const a = useRef<ChatHandle>(null);
  const b = useRef<ChatHandle>(null);
  const world = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLCanvasElement>(null);
  const phoneA = useRef<HTMLDivElement>(null);
  const tiltA = useRef<HTMLDivElement>(null);
  const phoneB = useRef<HTMLDivElement>(null);
  const touchA = useRef<HTMLDivElement>(null);
  const touchB = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const captions = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [art] = useState(() => ({ grain: grainTile(), shadow: shadowImage() }));

  useEffect(() => {
    const cues: Cue[] = [];
    let take: Take | null = null;
    let started: number | null = null;
    let next = 0;
    let frame = 0;
    const stage = {
      ready: false,
      duration: DURATION,
      error: null as string | null,
      cues,
      start: () => {
        started = performance.now();
      },
      converged: () => true,
    };
    window.__stage = stage;
    const now = () => (started === null ? 0 : (performance.now() - started) / 1000);
    const cue = (kind: Cue['kind'], pan = 0) => cues.push({ t: Math.round(now() * 1000) / 1000, kind, pan });

    const place = (element: HTMLDivElement | null, p: Place) => {
      if (element) element.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.k})`;
    };
    const drawTouch = (element: HTMLDivElement | null, touches: Touch[], t: number) => {
      if (!element) return;
      for (const touch of touches) {
        const style = touchStyle(touch, t);
        if (!style) continue;
        if (touch.x === undefined) {
          const point = touch.at();
          touch.x = point.x;
          touch.y = point.y;
        }
        element.style.opacity = String(style.opacity);
        element.style.transform = `translate(${touch.x}px, ${touch.y}px) scale(${style.scale})`;
        return;
      }
      element.style.opacity = '0';
    };

    const render = (t: number) => {
      // The light: teal-green and blue glows that breathe, and pulse with the beat after the drop.
      if (glow.current) {
        const drift = Math.sin(t * 0.35) * 0.04;
        // In step with the kick drum: the groove runs from the drop, rests for the reveal, returns.
        const grooving = (t >= DROP && t < 18.5) || (t >= 22.5 && t < TITLE);
        const beat = grooving ? Math.exp(-((t - DROP) % 0.5) * 7) * 0.12 : 0;
        drawGlow(glow.current, [
          { x: 0.03 + drift, y: 0.34 - drift, rx: 0.4, ry: 0.48, rgb: '24, 190, 120', alpha: 0.6 + beat },
          { x: 0.97 - drift, y: 0.72 + drift, rx: 0.46, ry: 0.52, rgb: '38, 108, 255', alpha: 0.64 + beat },
          { x: 0.86 + drift, y: 0.1, rx: 0.32, ry: 0.3, rgb: '30, 140, 230', alpha: 0.24 },
        ]);
      }

      const cam = cameraAt(take?.moves ?? [], t);
      const z = cam.z * (1 + punch(t, DROP, 0.035) + punch(t, 14.0, 0.02) + punch(t, TITLE, 0.025));
      if (world.current) world.current.style.transform = `translate(${SIZE / 2 - cam.x * z}px, ${SIZE / 2 - cam.y * z}px) scale(${z})`;

      // The hero phone settles from a slight turn, then later makes room.
      const tilt = 1 - ramp(t, 0, 2.4, easeOut);
      if (tiltA.current) tiltA.current.style.transform = tilt > 0.001 ? `perspective(2600px) rotateY(${-10 * tilt}deg) rotateX(${4 * tilt}deg)` : '';
      const pair = ramp(t, 19.95, 21.35, easeCamera);
      const lower = ramp(t, 23.9, 25.0, easeCamera);
      const aPlace = mixPlace(HERO, A_PAIR, pair);
      aPlace.y += (FINAL_Y - PAIR_Y) * lower;
      place(phoneA.current, aPlace);
      const bPlace = mixPlace(B_AWAY, B_PAIR, ramp(t, 20.15, 21.55, easeCamera));
      bPlace.y += (FINAL_Y - PAIR_Y) * lower;
      place(phoneB.current, bPlace);

      if (labels.current) {
        const shown = ramp(t, 21.1, 21.6, easeOut);
        labels.current.style.opacity = String(shown);
        labels.current.style.transform = `translateY(${(FINAL_Y - PAIR_Y) * lower + (1 - shown) * 16}px)`;
      }
      if (title.current) {
        const shown = ramp(t, TITLE, TITLE + 0.8, easeOut);
        title.current.style.opacity = String(shown);
        title.current.style.transform = `translateY(${(1 - shown) * 36}px) scale(${1.04 - 0.04 * shown})`;
        title.current.style.filter = shown < 1 ? `blur(${(1 - shown) * 12}px)` : '';
      }

      // Captions, word by word, over a soft shade at the top of the frame.
      let shading = 0;
      if (captions.current) {
        const blocks = captions.current.children;
        CAPTIONS.forEach((caption, i) => {
          const block = blocks[i] as HTMLElement | undefined;
          if (!block) return;
          const live = t > caption.in - 0.05 && t < caption.out + 0.4;
          block.style.display = live ? '' : 'none';
          if (!live) return;
          shading = Math.max(shading, (caption.in < 0 ? 1 : ramp(t, caption.in - 0.1, caption.in + 0.2)) * (1 - ramp(t, caption.out, caption.out + 0.35)));
          [...block.children].forEach((word, w) => {
            const s = wordStyle(caption, w, t);
            const el = word as HTMLElement;
            el.style.opacity = String(s.opacity);
            el.style.transform = `translateY(${s.y}px)`;
            el.style.filter = s.blur > 0.05 ? `blur(${s.blur}px)` : '';
          });
        });
      }
      if (shade.current) shade.current.style.opacity = String(shading * (1 - pair));

      if (take) {
        drawTouch(touchA.current, take.touches.filter((x) => x.phone === 'a'), t);
        drawTouch(touchB.current, take.touches.filter((x) => x.phone === 'b'), t);
      }
    };

    const tick = () => {
      try {
        if (!stage.ready) {
          const walls = document.querySelectorAll('.wall[data-ready="true"]').length;
          const images = [...document.images].every((img) => img.complete);
          if (a.current && b.current && walls >= 2 && images && document.fonts.status === 'loaded') {
            take = buildTake(a.current, b.current, setDraft, cue);
            stage.ready = true;
            if (!capture) stage.start();
          }
        }
        const t = Math.min(now(), DURATION);
        if (take && started !== null) {
          while (next < take.steps.length && take.steps[next]!.t <= t) take.steps[next++]!.run();
        }
        render(t);
      } catch (error) {
        stage.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [capture]);

  return (
    <div className="stage" data-capture={capture}>
      <canvas className="stage-glow" ref={glow} width={GLOW} height={GLOW} />
      <div className="stage-world" ref={world}>
        <div className="stage-title" ref={title} style={{ opacity: 0 }}>
          <h1>Hide for Me</h1>
          <p>Mute a person, not the group.</p>
        </div>
        <div className="stage-labels" ref={labels} style={{ opacity: 0 }}>
          <span style={{ left: A_PAIR.x + (450 * PAIR_K) / 2 }}>You</span>
          <span style={{ left: B_PAIR.x + (450 * PAIR_K) / 2 }}>What Max sees</span>
        </div>
        <div className="stage-phone" ref={phoneB}>
          <div className="stage-shadow" style={{ backgroundImage: art.shadow }} />
          <Device>
            <ChatScreen handle={b} storage={null} me="max" draft={draft} />
            <div className="stage-touch" ref={touchB} />
          </Device>
        </div>
        <div className="stage-phone" ref={phoneA}>
          <div ref={tiltA} className="stage-tilt">
            <div className="stage-shadow" style={{ backgroundImage: art.shadow }} />
            <Device>
              <ChatScreen handle={a} storage={null} />
              <div className="stage-touch" ref={touchA} />
            </Device>
          </div>
        </div>
      </div>
      <div className="stage-shade" ref={shade} />
      <div className="stage-captions" ref={captions}>
        {CAPTIONS.map((caption, i) => (
          <div className="stage-caption" key={i} style={{ display: 'none' }}>
            {caption.words.map((word, w) => (
              <span key={w} data-accent={word.startsWith('*')}>
                {word.replace(/^\*/, '')}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="stage-grain" style={{ backgroundImage: art.grain }} />
    </div>
  );
}
