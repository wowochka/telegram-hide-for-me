#!/usr/bin/env node
/**
 * Downloads Telegram's chat background pattern into public/telegram/.
 *
 *   npm run fetch-pattern
 *
 * The pattern is the doodle tile Telegram uses for its default wallpaper, as
 * published in Telegram Web K (https://github.com/morethanwords/tweb,
 * GPL-3.0). It is not redistributed in this repository. Without it the
 * prototype draws a stand-in pattern of its own.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://raw.githubusercontent.com/morethanwords/tweb/master/public/assets/img/pattern.svg';
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../public/telegram/pattern.svg');

const response = await fetch(SOURCE);
if (!response.ok) {
  console.error(`Download failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}
const svg = await response.text();

// It is used as an image, which never runs scripts, but refuse anything that
// is not a plain drawing all the same.
if (!svg.includes('<svg') || /<script|<foreignObject|\son\w+=|javascript:/i.test(svg)) {
  console.error('The downloaded file is not a plain SVG drawing; not saving it.');
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, svg);
console.log(`Saved ${target} (${Math.round(svg.length / 1024)} KB)`);
