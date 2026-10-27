#!/usr/bin/env node
/**
 * Renders the demo video from the working prototype.
 *
 *   npm run build
 *   node video/render-source/render.mjs [--fps 60] [--out video/hide-for-me-silent.mp4]
 *        [--stills 2,8,17.5] [--stills-only] [--from 0] [--to 29.5]
 *
 * It serves the built app, opens /stage in headless Chromium with a virtual
 * clock, starts the take and captures one screenshot per frame, piping them
 * straight into ffmpeg. Each frame shows exactly the state at its timestamp,
 * however long it took to draw.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');
const ffmpegPath = require('ffmpeg-static');

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
}

const fps = Number(option('fps', 60));
const out = resolve(root, option('out', 'video/hide-for-me-silent.mp4'));
const from = Number(option('from', 0));
const until = option('to', null);
const stills = String(option('stills', ''))
  .split(',')
  .filter(Boolean)
  .map(Number);
const stillsOnly = process.argv.includes('--stills-only');
const port = Number(option('port', 4188));
const SIZE = 1920;

if (!existsSync(resolve(root, 'dist/index.html'))) {
  console.error('The app is not built. Run "npm run build" first.');
  process.exit(1);
}

const log = (line) => process.stdout.write(`${line}\n`);

// The built app, served exactly as a visitor would get it.
const server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => (serverLog += chunk));
server.stderr.on('data', (chunk) => (serverLog += chunk));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`The preview server did not start:\n${serverLog}`);
}

let browser;
let encoder;

async function cleanup() {
  await browser?.close().catch(() => {});
  server.kill();
}

try {
  await waitForServer();

  browser = await chromium.launch({
    args: ['--disable-lcd-text', '--font-render-hinting=none', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const context = await browser.newContext({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  page.on('pageerror', (error) => log(`[page error] ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') log(`[console] ${message.text()}`);
  });
  await page.addInitScript({ path: resolve(here, 'virtual-clock.js') });
  await page.goto(`http://127.0.0.1:${port}/stage?capture=1`);

  // Time is frozen, so the stage's own readiness check needs to be stepped.
  for (let attempt = 0; ; attempt++) {
    const ready = await page.evaluate(async () => {
      await window.__clock.advance(40);
      return !!window.__stage?.ready;
    });
    if (ready) break;
    if (attempt > 400) throw new Error('The stage never became ready.');
    await new Promise((r) => setTimeout(r, 30));
  }

  const duration = await page.evaluate(() => window.__stage.duration);
  const end = until === null ? duration : Math.min(Number(until), duration);
  const totalFrames = Math.round(end * fps);
  const firstFrame = Math.round(from * fps);
  const stillFrames = new Map(stills.map((seconds) => [Math.max(1, Math.round(seconds * fps)), seconds]));
  const stillsDir = resolve(here, 'stills');
  if (stills.length) mkdirSync(stillsDir, { recursive: true });

  if (!stillsOnly) {
    mkdirSync(dirname(out), { recursive: true });
    encoder = spawn(
      ffmpegPath,
      [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
        '-an',
        '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-profile:v', 'high', '-level', '5.1',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
        '-r', String(fps), '-movflags', '+faststart',
        out,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    encoder.on('error', (error) => log(`[ffmpeg] ${error.message}`));
  }

  const cdp = await context.newCDPSession(page);
  await page.evaluate(() => window.__stage.start());
  log(`Rendering ${totalFrames - firstFrame} frames at ${fps} fps (${SIZE}×${SIZE}) …`);

  const started = Date.now();
  const frameMs = 1000 / fps;
  for (let frame = 1; frame <= totalFrames; frame++) {
    const error = await page.evaluate(async (ms) => {
      await window.__clock.advance(ms);
      await window.__clock.settle();
      window.__clock.syncAnimations();
      return window.__stage.error;
    }, frameMs);
    if (error) throw new Error(`The take failed at ${(frame / fps).toFixed(2)}s:\n${error}`);

    const wanted = frame > firstFrame;
    const still = stillFrames.get(frame);
    if (!wanted && still === undefined) continue;
    if (stillsOnly && still === undefined) continue;

    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    const png = Buffer.from(data, 'base64');
    if (still !== undefined) writeFileSync(resolve(stillsDir, `t${still.toFixed(2).padStart(5, '0')}.png`), png);
    if (encoder && wanted && !encoder.stdin.write(png)) {
      await new Promise((r) => encoder.stdin.once('drain', r));
    }
    if (frame % (fps * 2) === 0) {
      const elapsed = (Date.now() - started) / 1000;
      const done = frame / totalFrames;
      log(`  ${(frame / fps).toFixed(0).padStart(2)}s / ${end}s   ${Math.round(done * 100)}%   eta ${Math.round(elapsed / done - elapsed)}s`);
    }
  }

  const cues = await page.evaluate(() => window.__stage.cues ?? []);
  writeFileSync(resolve(here, 'cues.json'), `${JSON.stringify({ fps, duration: end, cues }, null, 2)}\n`);

  if (encoder) {
    encoder.stdin.end();
    const code = await new Promise((r) => encoder.on('close', r));
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
    log(`Wrote ${out} in ${Math.round((Date.now() - started) / 1000)}s`);
  } else {
    log(`Wrote ${stillFrames.size} stills to ${stillsDir}`);
  }
  await cleanup();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  encoder?.stdin.destroy();
  encoder?.kill();
  await cleanup();
  process.exit(1);
}
