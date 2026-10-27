#!/usr/bin/env node
/**
 * Scores the rendered video: a 120 BPM track plus interface sounds, all
 * synthesized here from oscillators and noise. No samples, nothing licensed.
 *
 *   node video/render-source/sound.mjs [--in video/hide-for-me-silent.mp4] [--out video/hide-for-me.mp4] [--cues …/cues.json]
 *
 * The music follows the take's sections (the drop lands when Max is hidden,
 * it rests while Max's phone comes in, and resolves on the title). Interface
 * sounds come from cues.json, written by the renderer from the events of the
 * actual take, so every pop and tap sits on the frame it belongs to.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

const input = resolve(root, option('in', 'video/hide-for-me-silent.mp4'));
const output = resolve(root, option('out', 'video/hide-for-me.mp4'));
const { duration, cues } = JSON.parse(readFileSync(resolve(root, option('cues', 'video/render-source/cues.json')), 'utf8'));

// The take's sections, in seconds (see src/stage/Stage.tsx).
const BEAT = 0.5;
const GRID = 0.5; // first downbeat
const DROP = 6.5;
const BACK = 22.5;
const TITLE = 24.5;
const END = duration;

const RATE = 48_000;
const LENGTH = Math.ceil((END + 0.2) * RATE);
const TAU = Math.PI * 2;

const bus = () => ({ l: new Float32Array(LENGTH), r: new Float32Array(LENGTH) });
const music = bus();
const sfx = bus();
const verb = bus();
const echo = bus();

let seed = 20261024;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

/** Mixes a mono voice into a bus, with equal-power pan and optional sends. */
function add(target, at, seconds, pan, voice, { reverb = 0, delay = 0 } = {}) {
  const start = Math.round(at * RATE);
  const count = Math.round(seconds * RATE);
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) / 2) * (Math.PI / 2);
  const gl = Math.cos(angle);
  const gr = Math.sin(angle);
  for (let i = 0; i < count; i++) {
    const n = start + i;
    if (n < 0) continue;
    if (n >= LENGTH) break;
    const s = voice(i / RATE, i / count);
    target.l[n] += s * gl;
    target.r[n] += s * gr;
    if (reverb) {
      verb.l[n] += s * gl * reverb;
      verb.r[n] += s * gr * reverb;
    }
    if (delay) {
      echo.l[n] += s * gl * delay;
      echo.r[n] += s * gr * delay;
    }
  }
}

// ---------------------------------------------------------------- the track
//
// 120 BPM, between A minor and C major. Bars are 2 s from the first downbeat:
//   bars 0–1  the flood: a muffled kick drives under busy plucks and hats
//   bar 2     the build: snare roll, riser, the filter opens; the last beat drops out
//   bars 3–8  the drop, as Max is hidden: four on the floor, claps, rolling bass,
//             syncopated supersaw stabs and a hook
//   bars 9–10 the rest, while Max's phone comes in: no kick, chords and hook, a roll back
//   bar 11    the return, the hook climbing
//   bar 12    the title: one wide chord

const BAR = 2;
const barAt = (i) => GRID + i * BAR;
const PROGRESSION = ['Am', 'F', 'G', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'C'];
const VOICINGS = {
  Am: { root: 33, notes: [57, 60, 64, 69] },
  F: { root: 29, notes: [57, 60, 65, 69] },
  C: { root: 36, notes: [55, 60, 64, 67] },
  G: { root: 31, notes: [55, 59, 62, 67] },
};
const chordOf = (bar) => VOICINGS[PROGRESSION[Math.min(bar, PROGRESSION.length - 1)]];
const isGroove = (bar) => (bar >= 3 && bar <= 8) || bar === 11;

/** Band-limited sawtooth tables: fewer harmonics for higher notes, so nothing aliases. */
const TABLE = 2048;
const SAWS = [256, 128, 64, 32, 16, 8, 4].map((harmonics) => {
  const table = new Float32Array(TABLE + 1);
  for (let i = 0; i <= TABLE; i++) {
    let s = 0;
    for (let h = 1; h <= harmonics; h++) s += Math.sin((TAU * h * i) / TABLE) / h;
    table[i] = s * 0.55;
  }
  return { harmonics, table };
});
const sawFor = (f) => (SAWS.find((s) => s.harmonics * f < 19_000) ?? SAWS[SAWS.length - 1]).table;
function osc(table, phase) {
  const x = (phase - Math.floor(phase)) * TABLE;
  const i = x | 0;
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

/** An RBJ biquad (low-, high- or band-pass) whose cutoff may move per sample. */
function biquad(type) {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let a1 = 0;
  let a2 = 0;
  let lastF = -1;
  let lastQ = -1;
  return (x, fc, q = Math.SQRT1_2) => {
    if (fc !== lastF || q !== lastQ) {
      const w = (TAU * Math.min(fc, RATE * 0.45)) / RATE;
      const c = Math.cos(w);
      const alpha = Math.sin(w) / (2 * q);
      const a0 = 1 + alpha;
      if (type === 'lp') [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
      else if (type === 'hp') [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
      else [b0, b1, b2] = [alpha, 0, -alpha];
      b0 /= a0;
      b1 /= a0;
      b2 /= a0;
      a1 = (-2 * c) / a0;
      a2 = (1 - alpha) / a0;
      lastF = fc;
      lastQ = q;
    }
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

// The kicks, and the sidechain pump they put on everything else.
const kicks = [];
for (let bar = 0; bar <= 11; bar++) {
  for (let beat = 0; beat < 4; beat++) {
    const t = barAt(bar) + beat * BEAT;
    if (bar <= 2 && t < DROP - BEAT - 0.01) kicks.push({ t, muffled: true });
    else if (isGroove(bar) && !(bar === 11 && beat === 3)) kicks.push({ t, muffled: false });
  }
}
const duck = new Float32Array(LENGTH).fill(1);
for (const k of kicks) {
  const start = Math.round(k.t * RATE);
  const depth = k.muffled ? 0.3 : 0.68;
  for (let i = 0; i < 0.35 * RATE && start + i < LENGTH; i++) duck[start + i] = Math.min(duck[start + i], 1 - depth * Math.exp(-i / RATE / 0.075));
}
const ducked = (at, t, amount = 1) => {
  const n = Math.round((at + t) * RATE);
  return n < LENGTH ? 1 - amount * (1 - duck[n]) : 1;
};

function kick(at, muffled, open = 0) {
  const lp = biquad('lp');
  add(music, at, 0.5, 0, (t) => {
    // Pitch falls 178 → 48 Hz; the phase is its integral.
    const phase = TAU * (48 * t + (130 * (1 - Math.exp(-t * 35))) / 35);
    let s = Math.tanh(2.4 * Math.sin(phase) * Math.exp(-t * 6.5));
    if (!muffled) s += (random() * 2 - 1) * Math.exp(-t * 700) * 0.45 + Math.sin(TAU * 1700 * t) * Math.exp(-t * 380) * 0.22;
    // Under the flood the kick is held back, so the drop lands with everything.
    return muffled ? (0.2 + 0.12 * open) * lp(s, 180 + 900 * open) : 0.56 * s;
  });
}

function clap(at, level = 1) {
  const bp = biquad('bp');
  add(
    music,
    at,
    0.4,
    0.02,
    (t) => {
      // Three quick slaps, then the body.
      let slaps = 0;
      for (const d of [0, 0.009, 0.019]) if (t >= d) slaps += Math.exp(-(t - d) * 170);
      const n = bp(random() * 2 - 1, 1450, 0.85);
      return level * (0.5 * n * (0.7 * slaps + Math.exp(-t * 13)) + 0.13 * Math.sin(TAU * 190 * t) * Math.exp(-t * 32));
    },
    { reverb: 0.32 },
  );
}

function hat(at, level, open = false) {
  const hp = biquad('hp');
  add(music, at, open ? 0.26 : 0.06, open ? -0.2 : 0.2, (t) => level * hp(random() * 2 - 1, 7800, 0.8) * Math.exp(-t * (open ? 15 : 80)));
}

function crash(at, level) {
  const hp = biquad('hp');
  add(music, at, 2.4, 0, (t) => level * hp(random() * 2 - 1, 4800, 0.7) * Math.exp(-t * 2.1), { reverb: 0.45 });
}

/** Noise swept up through a resonant band, with a rising tone: the build. */
function riser(at, seconds, level) {
  const bp = biquad('bp');
  add(
    music,
    at,
    seconds,
    0,
    (t, p) => {
      const fc = 400 * (7000 / 400) ** (p * p);
      return level * p * p * (1.6 * bp(random() * 2 - 1, fc, 2.2) + 0.25 * Math.sin(TAU * (220 * t + 700 * t * p)));
    },
    { reverb: 0.4 },
  );
}

/** Reversed-cymbal swell that sucks the air in right before a hit. */
function swell(at, seconds, level) {
  const hp = biquad('hp');
  add(music, at - seconds, seconds, 0, (t, p) => level * p ** 3 * hp(random() * 2 - 1, 3000, 0.7), { reverb: 0.2 });
}

function impact(at, level) {
  add(music, at, 2.2, 0, (t) => level * Math.sin(TAU * (32 * t + (70 * (1 - Math.exp(-t * 9))) / 9)) * Math.exp(-t * 2.4));
}

/** A kalimba-like pluck for the flood: harmonics that die off fast. */
function pluck(at, note, level, brightness, pan) {
  const f = mtof(note);
  add(
    music,
    at,
    0.6,
    pan,
    (t) => {
      const s = Math.sin(TAU * f * t) * Math.exp(-t * 6) + brightness * 0.5 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 14) + brightness * 0.25 * Math.sin(TAU * 3 * f * t) * Math.exp(-t * 26);
      return level * Math.min(1, t / 0.003) * s * ducked(at, t);
    },
    { reverb: 0.2, delay: 0.28 },
  );
}

/** Supersaw: four detuned saws per note per side, through a closing filter. */
function supersaw(at, seconds, notes, level, { attack = 0.003, decay = 7, from = 6000, to = 900, close = 12, pump = 0.6, reverb = 0.22, delay = 0.1 } = {}) {
  for (const [side, pan] of [
    [-1, -0.6],
    [1, 0.6],
  ]) {
    const voices = [];
    for (const note of notes) {
      const f = mtof(note);
      for (const cents of [-12, -5, 4, 11]) voices.push({ f: f * 2 ** ((cents * side) / 1200), phase: random(), table: sawFor(f) });
    }
    const lp = biquad('lp');
    const norm = 2.4 / voices.length;
    add(
      music,
      at,
      seconds + 0.08,
      pan,
      (t) => {
        let s = 0;
        for (const v of voices) {
          v.phase += v.f / RATE;
          s += osc(v.table, v.phase);
        }
        const env = Math.min(1, t / attack) * Math.exp(-t * decay) * (t > seconds ? Math.exp(-(t - seconds) * 50) : 1);
        return level * env * lp(s * norm, to + (from - to) * Math.exp(-t * close), 0.9) * ducked(at, t, pump);
      },
      { reverb, delay },
    );
  }
}

/** The rolling bass: a filtered saw over a sub, three sixteenths to a beat. */
function bassNote(at, seconds, note, level) {
  const f = mtof(note);
  const table = sawFor(f);
  const lp = biquad('lp');
  let phase = 0;
  let sub = 0;
  add(music, at, seconds, 0, (t) => {
    phase += f / RATE;
    sub += f / 2 / RATE;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 5) * Math.min(1, Math.max(0, (seconds - t) / 0.012));
    const s = 0.62 * Math.sin(TAU * sub) + 0.55 * lp(osc(table, phase), 350 + 2400 * Math.exp(-t * 20), 1.2);
    return level * env * Math.tanh(1.4 * s) * ducked(at, t);
  });
}

/** The hook's voice: two slightly detuned saws with a plucked filter, plus a bell an octave up. */
function lead(at, note, level) {
  const f = mtof(note);
  const table = sawFor(f);
  const lp = biquad('lp');
  let p1 = random();
  let p2 = random();
  add(
    music,
    at,
    0.5,
    0.08,
    (t) => {
      p1 += f / RATE;
      p2 += (f * 1.006) / RATE;
      const env = Math.min(1, t / 0.004) * Math.exp(-t * 5);
      const body = lp(osc(table, p1) + osc(table, p2), 800 + 4500 * Math.exp(-t * 9), 1.5);
      return level * env * (0.5 * body + 0.3 * Math.sin(TAU * 2 * f * t) * Math.exp(-t * 11)) * ducked(at, t, 0.4);
    },
    { reverb: 0.25, delay: 0.38 },
  );
}

const HOOK = {
  C: [76, null, 79, null, 76, 74, 72, null],
  G: [74, null, 79, null, 74, 71, 67, null],
  Am: [72, null, 76, null, 72, 71, 69, null],
  F: [69, null, 72, null, 77, null, 76, 72],
};
const CLIMB = [74, null, 79, null, 74, 76, 77, 79];
/** Syncopated 3-3-2 stabs, in sixteenths. */
const STABS = [0, 3, 6, 10, 13];

for (const k of kicks) {
  const bar = Math.floor((k.t - GRID) / BAR);
  kick(k.t, k.muffled, k.muffled ? Math.min(1, (k.t - GRID) / (DROP - GRID)) ** 2 * (bar >= 2 ? 1 : 0.4) : 0);
}

// The flood (bars 0–2): plucks and hats on sixteenths, getting brighter.
for (let bar = 0; bar <= 2; bar++) {
  const start = barAt(bar);
  const chord = chordOf(bar);
  supersaw(start, BAR, chord.notes, 0.035 + bar * 0.01, { attack: 0.4, decay: 0.2, from: 700 + bar * 700, to: 500 + bar * 500, close: 1, pump: 0.3, reverb: 0.3, delay: 0 });
  for (let step = 0; step < 16; step++) {
    const t = start + step * 0.125;
    if (t >= DROP - BEAT) break;
    const note = chord.notes[[0, 2, 1, 3, 2, 3, 1, 2][step % 8]] + 12;
    pluck(t, note, 0.07 + 0.015 * bar, 0.45 + bar * 0.25, step % 2 ? 0.32 : -0.32);
    hat(t, (step % 2 ? 0.045 : 0.025) * (0.6 + 0.2 * bar));
  }
  if (bar >= 1) bassNote(start, BAR - 0.05, chord.root + 12, 0.1);
}
// The build: a snare roll that tightens, a riser, then a breath before the drop.
for (let t = barAt(2); t < DROP - BEAT - 0.01; t += t < barAt(2) + 1 ? 0.25 : 0.125) {
  clap(t, 0.25 + 0.7 * ((t - barAt(2)) / 1.5) ** 2);
}
riser(barAt(2), BAR, 0.1);
swell(DROP, 0.5, 0.09);
impact(DROP, 0.5);
crash(DROP, 0.12);

// The groove.
for (let bar = 3; bar <= 11; bar++) {
  const start = barAt(bar);
  const chord = chordOf(bar);
  const groove = isGroove(bar);
  const rest = bar === 9 || bar === 10;
  const name = PROGRESSION[bar];

  if (groove) {
    for (let beat = 0; beat < 4; beat++) {
      const t = start + beat * BEAT;
      if (beat % 2 === 1) clap(t, 1);
      if (!(bar === 11 && beat === 3)) {
        hat(t + BEAT / 2, 0.075, true);
        for (let s = 1; s < 4; s++) bassNote(t + s * 0.125, 0.11, chord.root + 12, 0.2);
      }
      for (let s = 0; s < 4; s++) hat(t + s * 0.125, s % 2 ? 0.055 : 0.035);
    }
    for (const step of STABS) supersaw(start + step * 0.125, 0.11, chord.notes, 0.085);
    supersaw(start, BAR, chord.notes, 0.02, { attack: 0.08, decay: 0.3, from: 1600, to: 1200, close: 1, pump: 0.8, reverb: 0.3, delay: 0 });
  }
  if (rest) {
    // No kick: wide held chords, a soft sub, the hook on its own.
    supersaw(start, BAR, chord.notes, 0.07, { attack: 0.25, decay: 0.35, from: 2600, to: 1500, close: 1.5, pump: 0, reverb: 0.4, delay: 0.05 });
    bassNote(start, BAR - 0.05, chord.root + 12, 0.12);
    for (let beat = 0; beat < 4; beat++) hat(start + beat * BEAT + BEAT / 2, 0.03);
  }
  const hook = bar === 11 ? CLIMB : HOOK[name];
  const hookLevel = bar <= 4 ? 0.055 : rest ? 0.06 : 0.075;
  hook.forEach((note, i) => note !== null && lead(start + i * 0.25, note, hookLevel));
}
// The roll back in after the rest, and the last build into the title.
for (let t = BACK - 1; t < BACK - 0.01; t += t < BACK - 0.5 ? 0.125 : 0.0625) clap(t, 0.2 + 0.6 * ((t - (BACK - 1)) / 1) ** 2);
riser(BACK - 1.5, 1.5, 0.08);
crash(BACK, 0.1);
riser(TITLE - 1.5, 1.5, 0.1);
swell(TITLE, 0.5, 0.1);

// The title: an impact, a crash and one wide chord left to ring.
impact(TITLE, 0.5);
crash(TITLE, 0.13);
const FINAL = [48, 55, 60, 64, 67, 74];
supersaw(TITLE, END - TITLE - 0.6, FINAL, 0.11, { attack: 0.004, decay: 0.55, from: 5200, to: 1100, close: 1.6, pump: 0, reverb: 0.5, delay: 0.1 });
bassNote(TITLE, 2.6, 36 + 12, 0.2);
[72, 76, 79, 84].forEach((note, i) => lead(TITLE + i * 0.125, note, 0.07));

// --------------------------------------------------------- interface sounds

/**
 * A message arriving in the open chat: a soft, round water drop with a quiet
 * woody knock under it. The drop's pitch rises as it rings, the way a real one does.
 */
function pop(at, pan) {
  const f0 = 520 * (0.94 + random() * 0.12);
  const T = 0.06;
  add(
    sfx,
    at,
    0.2,
    pan,
    (t) => {
      // Pitch climbs to 2.4 × f0 over the first 60 ms, then holds; the phase is its integral.
      const k = Math.min(t, T);
      const cycles = f0 * (t + (1.4 * k * k) / (2 * T) + (t > T ? 1.4 * (t - T) : 0));
      const drop = Math.sin(TAU * cycles) * Math.exp(-t * 36);
      const knock = 0.35 * Math.sin(TAU * 180 * t) * Math.exp(-t * 90);
      return 0.3 * Math.min(1, t / 0.0025) * (drop + knock);
    },
    { reverb: 0.12 },
  );
}

/** A hidden message: barely there. That silence is the point. */
function muted(at, pan) {
  let lp = 0;
  add(sfx, at, 0.05, pan, (t) => {
    lp += 0.2 * (random() * 2 - 1 - lp);
    return 0.05 * lp * Math.exp(-t * 90) + 0.018 * Math.sin(TAU * 420 * t) * Math.exp(-t * 60);
  });
}

function tap(at, pan) {
  add(sfx, at, 0.05, pan, (t) => 0.17 * Math.exp(-t * 220) * Math.sin(TAU * 2300 * t) + 0.1 * (random() * 2 - 1) * Math.exp(-t * 1200));
}

/** The long press: a haptic thump and an airy swell into the menu. */
function hold(at, pan) {
  add(sfx, at, 0.14, pan, (t) => 0.3 * Math.sin(TAU * 72 * t) * Math.exp(-t * 26));
  let lp = 0;
  add(
    sfx,
    at,
    0.5,
    pan,
    (t, p) => {
      lp += (0.02 + 0.1 * p) * (random() * 2 - 1 - lp);
      return 0.06 * p * p * lp;
    },
    { reverb: 0.3 },
  );
}

function menu(at, pan) {
  add(sfx, at, 0.18, pan, (t) => 0.12 * Math.exp(-t * 26) * Math.sin(TAU * (540 * t + 900 * t * t)) + 0.05 * Math.exp(-t * 300) * (random() * 2 - 1), { reverb: 0.2 });
}

function swipe(at, pan, seconds = 0.16, level = 0.05) {
  let low = 0;
  let band = 0;
  add(
    sfx,
    at,
    seconds,
    pan,
    (t, p) => {
      const fc = 900 + 2600 * p;
      const g = 2 * Math.sin((Math.PI * fc) / RATE);
      low += g * band;
      const high = random() * 2 - 1 - low - 0.7 * band;
      band += g * high;
      return level * Math.sin(Math.PI * p) * band;
    },
    { reverb: 0.15 },
  );
}

/** Spoiler dust: a shower of tiny glassy grains over a soft falling breath. */
function sparkle(at, seconds, rising) {
  const grains = 70;
  for (let i = 0; i < grains; i++) {
    const p = i / grains;
    const when = at + (rising ? p * p : Math.sqrt(p)) * seconds * (0.85 + random() * 0.15);
    const f = (rising ? 3000 + 5000 * p : 8000 - 4500 * p) * (0.85 + random() * 0.3);
    const level = 0.05 * (0.5 + random() * 0.5);
    add(sfx, when, 0.06, random() * 1.6 - 0.8, (t) => level * Math.sin(TAU * f * t) * Math.exp(-t * 70), { reverb: 0.5 });
  }
  let lp = 0;
  add(
    sfx,
    at,
    seconds + 0.2,
    0,
    (t, p) => {
      lp += (rising ? 0.03 + 0.12 * p : 0.15 - 0.12 * p) * (random() * 2 - 1 - lp);
      return 0.07 * Math.sin(Math.PI * p) * lp;
    },
    { reverb: 0.3 },
  );
}

/** The toast: two soft marimba notes. */
function chime(at) {
  [784, 1175].forEach((f, i) =>
    add(
      sfx,
      at + i * 0.08,
      0.5,
      0,
      (t) => 0.05 * Math.min(1, t / 0.004) * (Math.sin(TAU * f * t) * Math.exp(-t * 9) + 0.2 * Math.sin(TAU * 3.99 * f * t) * Math.exp(-t * 40)),
      { reverb: 0.35 },
    ),
  );
}

function key(at, pan) {
  const f = 1700 + random() * 500;
  add(sfx, at, 0.03, pan, (t) => 0.045 * (0.6 + random() * 0.4) * Math.exp(-t * 260) * (Math.sin(TAU * f * t) * 0.7 + (random() * 2 - 1) * 0.3));
}

/** Sending: a quick rising swoosh that lands in a pop. */
function send(at, pan) {
  swipe(at, pan, 0.14, 0.07);
  add(sfx, at + 0.02, 0.18, pan, (t, p) => 0.09 * Math.sin(Math.PI * Math.min(1, p * 1.4)) * Math.sin(TAU * (380 * t + 2400 * t * t)), { reverb: 0.15 });
  pop(at + 0.16, pan);
}

for (const cue of cues) {
  const { t, kind, pan } = cue;
  if (kind === 'pop') pop(t, pan);
  else if (kind === 'muted') muted(t, pan);
  else if (kind === 'hold') hold(t, pan);
  else if (kind === 'menu') menu(t, pan);
  else if (kind === 'page') {
    tap(t - 0.08, pan);
    swipe(t + 0.04, pan);
  } else if (kind === 'dust') {
    // The tap on Until Tomorrow came a beat before the dust.
    tap(t - 0.3, pan);
    sparkle(t, 0.75, false);
  } else if (kind === 'fold') {
    tap(t - 0.08, pan);
    sparkle(t + 0.05, 0.6, false);
  } else if (kind === 'reveal') {
    tap(t - 0.08, pan);
    sparkle(t + 0.05, 0.6, true);
  } else if (kind === 'toast') chime(t + 0.12);
  else if (kind === 'whoosh') swipe(t, pan, 0.55, 0.035);
  else if (kind === 'key') key(t, pan);
  else if (kind === 'send') {
    tap(t - 0.08, pan);
    send(t, pan);
  } else if (kind === 'title') sparkle(t, 1.2, true);
  else if (kind === 'caption') swipe(t, 0, 0.3, 0.012);
}

// -------------------------------------------------------------------- mix

/** A small Freeverb: eight damped combs and four allpasses per side. */
function reverb(source, roomSize = 0.86, damp = 0.25, spread = 23) {
  const out = bus();
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((n) => Math.round((n * RATE) / 44100));
  const passes = [556, 441, 341, 225].map((n) => Math.round((n * RATE) / 44100));
  for (const [input, output, offset] of [
    [source.l, out.l, 0],
    [source.r, out.r, spread],
  ]) {
    const cb = combs.map((n) => ({ buf: new Float32Array(n + offset), i: 0, store: 0 }));
    const ap = passes.map((n) => ({ buf: new Float32Array(n + offset), i: 0 }));
    for (let n = 0; n < LENGTH; n++) {
      const x = input[n] * 0.015;
      let y = 0;
      for (const c of cb) {
        const v = c.buf[c.i];
        c.store = v * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * roomSize;
        c.i = (c.i + 1) % c.buf.length;
        y += v;
      }
      for (const a of ap) {
        const v = a.buf[a.i];
        a.buf[a.i] = y + v * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        y = v - y;
      }
      output[n] = y * 3;
    }
  }
  return out;
}

/** Ping-pong delay at a dotted eighth. */
function pingPong(source, seconds = 0.375, feedback = 0.32) {
  const out = bus();
  const d = Math.round(seconds * RATE);
  for (let n = 0; n < LENGTH; n++) {
    const fromL = n >= d ? out.r[n - d] * feedback : 0;
    const fromR = n >= d ? out.l[n - d] * feedback : 0;
    out.l[n] = (n >= d ? source.r[n - d] : 0) + fromL;
    out.r[n] = (n >= d ? source.l[n - d] : 0) + fromR;
  }
  return out;
}

const wet = reverb(verb);
const echoes = pingPong(echo);

const left = new Float32Array(LENGTH);
const right = new Float32Array(LENGTH);
const MUSIC = 0.8;
const fadeOut = (n) => {
  const t = n / RATE;
  return t > END - 0.6 ? Math.max(0, (END - t) / 0.6) : 1;
};
for (let n = 0; n < LENGTH; n++) {
  const f = fadeOut(n);
  left[n] = f * (MUSIC * (music.l[n] + echoes.l[n] * 0.35) + sfx.l[n] + wet.l[n]);
  right[n] = f * (MUSIC * (music.r[n] + echoes.r[n] * 0.35) + sfx.r[n] + wet.r[n]);
}

// A gentle bus limiter: soft-knee saturation above -6 dBFS after normalising.
let peak = 0;
for (let n = 0; n < LENGTH; n++) peak = Math.max(peak, Math.abs(left[n]), Math.abs(right[n]));
if (!Number.isFinite(peak) || peak === 0) throw new Error(`The mix is broken (peak ${peak}).`);
const gain = 0.98 / peak;
const soft = (x) => {
  const a = Math.abs(x);
  return a < 0.5 ? x : Math.sign(x) * (0.5 + 0.5 * Math.tanh((a - 0.5) / 0.5));
};

const wav = Buffer.alloc(44 + LENGTH * 4);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + LENGTH * 4, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(RATE, 24);
wav.writeUInt32LE(RATE * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(LENGTH * 4, 40);
for (let n = 0; n < LENGTH; n++) {
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, soft(left[n] * gain * 1.4))) * 32767), 44 + n * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, soft(right[n] * gain * 1.4))) * 32767), 46 + n * 4);
}
const wavPath = resolve(here, 'soundtrack.wav');
writeFileSync(wavPath, wav);

// Loudness for the web: about -15 LUFS, peaks under -1 dBTP. Two passes, so
// the correction is one linear gain rather than a pumping compressor.
const target = 'I=-15:TP=-1.2:LRA=11';
const measure = spawnSync(ffmpegPath, ['-hide_banner', '-i', wavPath, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const stats = JSON.parse(measure.stderr.slice(measure.stderr.lastIndexOf('{'), measure.stderr.lastIndexOf('}') + 1));
const second = `loudnorm=${target}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
const result = spawnSync(
  ffmpegPath,
  [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', input, '-i', wavPath,
    '-map', '0:v:0', '-map', '1:a:0',
    '-af', second,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-shortest', '-movflags', '+faststart',
    output,
  ],
  { stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Wrote ${output} (${cues.length} cues; source ${stats.input_i} LUFS, ${stats.input_tp} dBTP)`);
