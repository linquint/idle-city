/**
 * Raster app icons, drawn from the same mark as the favicon.
 *
 *   npm run icons
 *
 * ---
 *
 * A manifest needs real PNGs — an inline SVG data URI is fine for a `<link
 * rel=icon>` and is not what an installed app's launcher, splash screen or task
 * switcher reads. So they have to exist as files, and the one thing that must
 * not happen is that they *diverge* from the mark in `index.html`: two hand-made
 * copies of the same three rectangles is a pair of things that will disagree
 * the first time anyone adjusts one.
 *
 * So MARK below is the single definition of the icon, in the same 16-unit box
 * the favicon's `viewBox` uses, and both the favicon and the PNGs are written
 * from it. What comes out is byte-for-byte the same shapes at every size.
 *
 * **Why a PNG encoder and not a rasteriser.** The mark is a background and three
 * axis-aligned rectangles. Rendering that is a nested loop; encoding it is
 * `zlib.deflateSync` and three CRCs. Bringing in `sharp`, `resvg` or a headless
 * browser to draw four rectangles would be a build dependency an order of
 * magnitude larger than the thing it draws — and this file has no dependencies
 * at all, so `npm run icons` works on any machine that can run the tests.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where the icons land, and it is `public/` rather than `src/` — the opposite
 * of where `tools/fonts.mjs` puts the fonts, for a reason worth stating.
 *
 * A font is referenced from *CSS*, and a CSS asset URL has to be rewritten by
 * Vite against `base` to be right at a subpath. A manifest icon is referenced
 * from the *manifest*, and a manifest's relative URLs resolve against the
 * manifest's own URL — so `./icon-192.png` beside a manifest at
 * `/idle-city/manifest.webmanifest` is already correct with nobody rewriting
 * anything. Copying them verbatim is therefore both simpler and right, and it
 * keeps the filenames stable, which a manifest wants and a fingerprint would
 * take away.
 */
const OUT = 'public';

/**
 * The mark, in the favicon's own 16-unit box.
 *
 * Three towers of different heights against the ink of the night sky, the
 * tallest pale and the shortest lit sodium — which is the game's whole palette
 * in three rectangles, and reads at 16px as well as at 512.
 */
const BACKGROUND = [0x0b, 0x11, 0x1b];
const MARK = [
  { x: 2, y: 7, w: 3, h: 7, fill: [0xc9, 0xd1, 0xda] },
  { x: 6.5, y: 3, w: 3, h: 11, fill: [0xc9, 0xd1, 0xda] },
  { x: 11, y: 9, w: 3, h: 5, fill: [0xf0, 0xa6, 0x4b] },
];
const BOX = 16;

/**
 * How much of a maskable icon is safe from the launcher's crop.
 *
 * A maskable icon is cropped to whatever shape the platform likes — a circle, a
 * squircle, a rounded square — and the specification guarantees only the middle
 * 80% by width. So the mark is drawn into that circle rather than into the
 * square, and the corners are the background colour they were going to be
 * anyway. Without this, an installed icon on Android is three towers with their
 * feet cut off.
 */
const SAFE = 0.8;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = (crcTable[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** One PNG chunk: length, type, payload, CRC. */
function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

/**
 * An opaque 8-bit RGB PNG from a raw pixel buffer.
 *
 * Filter type 0 on every scanline — "none". Filters exist to make the deflate
 * stream compress better on photographic data; on four flat colours they buy
 * nothing and cost a pass over every pixel.
 */
function png(size, rgb) {
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * The mark, drawn at `size`, optionally inside the maskable safe area.
 *
 * Supersampled 4x4 per pixel, so an edge that lands mid-pixel — and at 192 and
 * 512 they all do, since the box is 16 units and the rectangles start at 6.5 —
 * comes out as a blend rather than as a stair. Sixteen samples on 512x512 is a
 * quarter of a million tests and takes a few milliseconds.
 */
function draw(size, maskable) {
  const rgb = Buffer.alloc(size * size * 3);
  const inset = maskable ? (1 - SAFE) / 2 : 0;
  const scale = (maskable ? SAFE : 1) * (size / BOX);
  const origin = inset * size;
  const SUB = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const ux = (x + (sx + 0.5) / SUB - origin) / scale;
          const uy = (y + (sy + 0.5) / SUB - origin) / scale;
          let hit = BACKGROUND;
          for (const rect of MARK) {
            if (ux >= rect.x && ux < rect.x + rect.w && uy >= rect.y && uy < rect.y + rect.h) {
              hit = rect.fill;
            }
          }
          r += hit[0];
          g += hit[1];
          b += hit[2];
        }
      }
      const at = (y * size + x) * 3;
      const n = SUB * SUB;
      rgb[at] = Math.round(r / n);
      rgb[at + 1] = Math.round(g / n);
      rgb[at + 2] = Math.round(b / n);
    }
  }
  return png(size, rgb);
}

/** The favicon, from the same MARK, so the two can never drift apart. */
function favicon() {
  const rects = MARK.map(
    (rect) =>
      `%3Crect x='${rect.x}' y='${rect.y}' width='${rect.w}' height='${rect.h}' fill='%23${rect.fill
        .map((c) => c.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()}'/%3E`,
  ).join('');
  const bg = `%23${BACKGROUND.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  return (
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${BOX} ${BOX}'%3E` +
    `%3Crect width='${BOX}' height='${BOX}' fill='${bg}'/%3E${rects}%3C/svg%3E`
  );
}

const ICONS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
];

mkdirSync(OUT, { recursive: true });
console.log("\nApp icons, from the favicon's own mark\n");
for (const icon of ICONS) {
  const bytes = draw(icon.size, icon.maskable);
  writeFileSync(join(OUT, icon.file), bytes);
  console.log(
    `  ${icon.file.padEnd(24)} ${String(icon.size).padStart(4)}px` +
      ` ${String(bytes.length).padStart(7)} B${icon.maskable ? '  maskable, drawn inside the 80% safe circle' : ''}`,
  );
}
console.log(`\n  The favicon this is drawn from, for index.html:\n\n${favicon()}\n`);
