/**
 * A dense doodle pattern for the dark chat wallpaper, in the spirit of the
 * hand-drawn backgrounds Telegram ships. Every doodle here is an original
 * drawing on a 32-unit grid; the tile is coloured later by a gradient mask.
 */
const DOODLES: string[] = [
  // cat face
  'M6 26c-2-4-2-9 0-13l-1-8 6 4h10l6-4-1 8c2 4 2 9 0 13-3 3-17 3-20 0ZM12 18h.1M20 18h.1M14 22c1 1 3 1 4 0',
  // ghost
  'M8 28V14a8 8 0 0 1 16 0v14l-3-2-2.5 2-2.5-2-2.5 2-2.5-2-3 2ZM13 14h.1M19 14h.1',
  // rocket
  'M16 3c5 4 7 10 5 18h-10c-2-8 0-14 5-18ZM11 17l-4 5 4 1M21 17l4 5-4 1M14 25l2 4 2-4M16 11a2 2 0 1 0 0 .1',
  // planet with ring
  'M16 9a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM4 19c3 3 21-3 24-8',
  // heart
  'M16 27C7 21 4 16 4 12a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 4-3 9-12 15Z',
  // star
  'M16 3l3.5 8.5 9 .7-7 5.8 2.3 8.8L16 22l-7.8 4.8 2.3-8.8-7-5.8 9-.7L16 3Z',
  // fish
  'M4 16c5-7 14-7 19 0-5 7-14 7-19 0ZM23 16l5-5v10l-5-5ZM10 15h.1',
  // cupcake
  'M8 18h16l-2 10H10L8 18ZM7 18c-1-6 5-6 6-9 2 3 7 1 9 5 2 1 2 3 1 4M16 9V6',
  // balloon
  'M16 3a7 8 0 0 1 0 16 7 8 0 0 1 0-16ZM16 19l-1 2h2l-1-2M16 21c-2 3 2 5 0 8',
  // music note
  'M12 24V7l12-3v16M12 24a3 3 0 1 1-3-3 3 3 0 0 1 3 3ZM24 20a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z',
  // mushroom
  'M4 16a12 9 0 0 1 24 0H4ZM12 16v9a4 4 0 0 0 8 0v-9M10 11h.1M17 9h.1M22 12h.1',
  // cloud
  'M9 24a5 5 0 0 1-.8-9.9A8 8 0 0 1 23.6 12 6 6 0 0 1 24 24H9Z',
  // crescent
  'M20 4a11 11 0 1 0 8 18A9 9 0 0 1 20 4Z',
  // leaf
  'M5 27C5 15 12 6 27 5c1 14-7 22-19 22H5Zm2-2L19 13',
  // umbrella
  'M4 15a12 10 0 0 1 24 0c-2-2-4-2-6 0-2-2-4-2-6 0-2-2-4-2-6 0-2-2-4-2-6 0ZM16 15v10a3 3 0 0 1-6 0',
  // gift box
  'M5 13h22v5H5zM7 18h18v10H7zM16 13v15M16 13c-3-6-9-5-7-1 1 1 5 1 7 1Zm0 0c3-6 9-5 7-1-1 1-5 1-7 1Z',
  // ice cream
  'M10 14l6 15 6-15M9 14a7 7 0 0 1 14 0H9Z',
  // pizza slice
  'M4 6c8-3 16-3 24 0L16 28 4 6ZM12 11h.1M18 14h.1M15 19h.1',
  // cherries
  'M10 22a4 4 0 1 0 .1 0M22 24a4 4 0 1 0 .1 0M10 18c1-7 6-12 12-13M22 20c-1-6-2-10 0-15',
  // crown
  'M5 23l-2-13 7 6 6-9 6 9 7-6-2 13H5ZM5 27h22',
  // bone
  'M9 13l10 10a3 3 0 1 0 4 2 3 3 0 1 0-2-4L11 11a3 3 0 1 0-4-2 3 3 0 1 0 2 4Z',
  // paper plane
  'M3 15 29 4 20 28l-5-9-12-4Zm12 4L29 4',
  // envelope
  'M4 8h24v17H4zM4 9l12 9 12-9',
  // camera
  'M4 11h6l2-3h8l2 3h6v15H4zM16 13a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  // cactus
  'M13 29V8a3 3 0 0 1 6 0v21M13 19H9a3 3 0 0 1-3-3v-4M19 15h4a3 3 0 0 0 3-3V9M9 29h14',
  // sun
  'M16 10a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM16 3v3M16 26v3M3 16h3M26 16h3M7 7l2 2M23 23l2 2M7 25l2-2M23 9l2-2',
  // snail
  'M4 25h20a5 5 0 0 0 5-5M8 25a8 8 0 1 1 13-6 5 5 0 0 1-9 2 3 3 0 0 1 4-3M24 20l2-7M28 20l2-6',
  // bird
  'M5 19c3-1 6-1 8 1 1-6 6-10 13-9-1 4-2 7-5 9 2 5-2 9-8 9-5 0-8-4-8-10ZM20 15h.1',
  // dice
  'M5 5h22v22H5zM11 11h.1M21 11h.1M16 16h.1M11 21h.1M21 21h.1',
  // game controller
  'M8 11h16a5 5 0 0 1 5 5l1 7a3 3 0 0 1-5 2l-3-3H10l-3 3a3 3 0 0 1-5-2l1-7a5 5 0 0 1 5-5ZM9 15v4M7 17h4M22 16h.1M25 18h.1',
  // light bulb
  'M12 22c0-3-4-5-4-10a8 8 0 0 1 16 0c0 5-4 7-4 10H12ZM12 25h8M13 28h6',
  // donut
  'M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24ZM16 12a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 9l1 1M22 9l-1 2M24 18l-2 1M8 20l2-1',
  // anchor
  'M16 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 9v19M10 14h12M5 19c0 5 5 9 11 9s11-4 11-9',
  // palm tree
  'M17 29c0-8-1-14-3-18M14 11c-4-3-9-2-11 1 4-1 7 0 11-1ZM14 11c2-5 7-7 11-5-4 1-7 2-11 5ZM14 11c4-1 9 1 11 5-4-2-7-3-11-5ZM10 29h12',
  // sailboat
  'M4 23h24l-4 5H8l-4-5ZM16 4v19M16 6l9 15h-9M15 9 7 21h8',
  // headphones
  'M5 21v-4a11 11 0 0 1 22 0v4M5 20h4v8H5zM23 20h4v8h-4z',
];

interface Placement {
  d: number;
  x: number;
  y: number;
  r: number;
  s: number;
}

function layout(tile: number, cells: number): Placement[] {
  // Deterministic, so the tile is identical on every render.
  let seed = 4211;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  const placements: Placement[] = [];
  const size = tile / cells;
  let index = 0;
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      // Offset every other row by half a cell for a hand-scattered look.
      const offset = row % 2 ? size / 2 : 0;
      placements.push({
        d: (index * 7 + row * 3) % DOODLES.length,
        x: (col * size + offset + random() * (size * 0.3)) % tile,
        y: row * size + random() * (size * 0.3),
        r: Math.round(random() * 60 - 30),
        s: 0.9 + random() * 0.35,
      });
      index++;
    }
  }
  return placements;
}

/** A black-on-transparent doodle tile, for use as a CSS mask. */
export function wallpaperMask(): string {
  const tile = 420;
  const paths = layout(tile, 7)
    .map((p) => {
      // Draw each doodle again shifted by one tile where it would cross the
      // edge, so the pattern tiles seamlessly.
      const copies: [number, number][] = [[0, 0]];
      if (p.x > tile - 48) copies.push([-tile, 0]);
      if (p.y > tile - 48) copies.push([0, -tile]);
      if (p.x > tile - 48 && p.y > tile - 48) copies.push([-tile, -tile]);
      return copies
        .map(
          ([dx, dy]) =>
            `<path transform="translate(${(p.x + dx).toFixed(1)} ${(p.y + dy).toFixed(1)}) rotate(${p.r} 16 16) scale(${p.s.toFixed(2)})" d="${DOODLES[p.d]}"/>`,
        )
        .join('');
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}" viewBox="0 0 ${tile} ${tile}" fill="none" stroke="#000" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
