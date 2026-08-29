/**
 * Self-hosts the two web fonts, subset to the glyphs this game can produce.
 *
 * Run once when the character set moves, not on every build:
 *
 *   npm run fonts
 *
 * ---
 *
 * **Why this exists.** `index.html` used to pull Archivo and IBM Plex Mono from
 * fonts.googleapis.com at load. Every other part of "playable offline" was
 * already true — there is no server, the save is `localStorage`, offline
 * progress is `catchUp`, and the site is static files on GitHub Pages — and
 * that one `<link>` was the whole of what stopped an install from being a
 * promise the app could keep. Offline, a first cold load had no typography at
 * all and the HUD reflowed as the fallback stack took over.
 *
 * **Why subset, and how the set is decided.** The brief said the HUD is "ASCII
 * plus a handful of typographic marks — measure rather than assume", and
 * `tools/charset.mjs` is that measurement: the set is swept out of index.html
 * and every file under src/ rather than typed out, which is what turns up the
 * handful nobody would have guessed — the multiplication sign in `x1.00`, the
 * em dashes and middots in the hint line, the arrows in the away report, the
 * degree sign, the en dash the fps readout opens on.
 *
 * Whether to subset at all is a measurement rather than an assumption, and the
 * printed table is it: 57,832 B for Google's own full-Latin cut of the four
 * faces against 22,716 for these, a 61% saving on something every player
 * downloads once and every install carries forever. What it costs is this
 * script and the discipline of re-running it — which `src/fonts/charset.txt`
 * and test/fonts.test.ts between them make impossible to forget.
 *
 * **Licensing.** Archivo and IBM Plex Mono are both under the SIL Open Font
 * License 1.1, which permits self-hosting and subsetting outright and requires
 * the notice to travel with the font, which is what `OFL.txt` beside the files
 * is for.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { charset } from './charset.mjs';

/**
 * Where the files land, and it is `src/` rather than `public/` on purpose.
 *
 * `public/` is copied verbatim and its URLs have to be written as `/fonts/x`,
 * which is *wrong on a project page*: GitHub Pages serves this from
 * `/idle-city/` and a root-relative URL would go looking at the domain root.
 * A file under `src/` referenced relatively from a stylesheet is resolved by
 * Vite at build time, fingerprinted, and rewritten relative to the emitted CSS
 * — which is exactly what `base: './'` is for and the only form that is right
 * at the dev server, at the repository root and at a subpath all three.
 */
const OUT = 'src/fonts';
const CSS = 'src/fonts.css';

/**
 * The families, weights and CSS names, exactly as `index.html` asked Google for
 * them.
 *
 * Two weights each, and no more: `--display` is used at 600 and 800 and
 * `--mono` at 400 and 500, and a third weight of either would be bytes for a
 * rule nobody wrote.
 */
const FACES = [
  { family: 'Archivo', weight: 600, file: 'archivo-600' },
  { family: 'Archivo', weight: 800, file: 'archivo-800' },
  { family: 'IBM Plex Mono', weight: 400, file: 'plex-mono-400' },
  { family: 'IBM Plex Mono', weight: 500, file: 'plex-mono-500' },
];

/** Google's own CSS for a face, which is where the .woff2 URLs live. */
function faceCss(family, weight) {
  const name = family.replace(/ /g, '+');
  return execFileSync(
    'curl',
    [
      '-sS',
      '-A',
      // Without a modern UA Google serves the .ttf fallback sheet, which is
      // four times the size and a different set of URLs.
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      `https://fonts.googleapis.com/css2?family=${name}:wght@${weight}&display=swap`,
    ],
    { encoding: 'utf8', maxBuffer: 1 << 24 },
  );
}

/**
 * The `latin` .woff2 for a face.
 *
 * Google splits a family into unicode-range blocks — latin, latin-ext,
 * cyrillic, vietnamese and more — and the last block in the sheet is `latin`.
 * Taking that one and subsetting it again is what keeps this to the characters
 * the game can actually produce.
 */
function latinUrl(css) {
  const blocks = css.split('@font-face');
  const latin = blocks.reverse().find((block) => /U\+0000-00FF/.test(block));
  const url = /url\((https:[^)]+\.woff2)\)/.exec(latin ?? '');
  if (!url) throw new Error('no latin woff2 in the sheet');
  return url[1];
}

const bytes = (n) => `${n.toLocaleString('en-GB')} B`;

mkdirSync(OUT, { recursive: true });
const set = charset();
// Written out beside the fonts and kept, rather than used and deleted: it is
// the record of what the four faces were actually cut to, and
// test/fonts.test.ts recomputes the set and refuses a build where the two have
// come apart. A subset that is one glyph behind the HUD is one character
// rendering in the fallback stack, which is a bug nobody ever files.
const setFile = join(OUT, 'charset.txt');
writeFileSync(setFile, set);

console.log(`\nSelf-hosting the two families, subset to ${set.length} characters\n`);
console.log('  face                 full latin      subset      saved');
console.log('  ----------------------------------------------------------');

const rows = [];
for (const face of FACES) {
  const url = latinUrl(faceCss(face.family, face.weight));
  const raw = join(OUT, `${face.file}.full.woff2`);
  execFileSync('curl', ['-sS', '-o', raw, url]);
  const out = join(OUT, `${face.file}.woff2`);
  execFileSync('python3', [
    '-m',
    'fontTools.subset',
    raw,
    `--text-file=${setFile}`,
    '--flavor=woff2',
    '--layout-features=kern,liga,calt,tnum',
    // The name table is most of a small subset's weight and none of it is
    // rendered. The OFL notice travels in OFL.txt beside the files instead,
    // which is what the licence actually asks for.
    '--no-hinting',
    '--desubroutinize',
    '--drop-tables+=DSIG',
    `--output-file=${out}`,
  ]);
  const before = statSync(raw).size;
  const after = statSync(out).size;
  execFileSync('rm', ['-f', raw]);
  rows.push({ ...face, before, after });
  console.log(
    `  ${`${face.family} ${face.weight}`.padEnd(20)} ${String(before).padStart(10)}` +
      ` ${String(after).padStart(11)} ${String(`${Math.round((1 - after / before) * 100)}%`).padStart(10)}`,
  );
}

const totalBefore = rows.reduce((n, r) => n + r.before, 0);
const totalAfter = rows.reduce((n, r) => n + r.after, 0);
console.log('  ----------------------------------------------------------');
console.log(
  `  ${'four faces'.padEnd(20)} ${String(totalBefore).padStart(10)} ${String(totalAfter).padStart(11)}` +
    ` ${String(`${Math.round((1 - totalAfter / totalBefore) * 100)}%`).padStart(10)}`,
);
console.log(`\n  ${bytes(totalAfter)} of font, precached, and nothing fetched at load.\n`);

const face = (entry) => `@font-face {
  font-family: '${entry.family}';
  font-style: normal;
  font-weight: ${entry.weight};
  /* \`swap\` is kept from the sheet this replaces, and it now means something
     different and better: the file is same-origin and precached, so the
     fallback it swaps from is on screen for a frame rather than for a network
     round trip — and offline it is on screen for a frame rather than forever. */
  font-display: swap;
  src: url('./fonts/${entry.file}.woff2') format('woff2');
}`;

writeFileSync(
  CSS,
  `/*
 * The two families, self-hosted and subset. Generated by tools/fonts.mjs —
 * edit that rather than this.
 *
 * Subset to the ${set.length} characters the game can actually put on screen, swept out
 * of index.html and every file under src/. Adding a character the HUD has never
 * shown before means running \`npm run fonts\` again; test/fonts.test.ts is what
 * notices if nobody did.
 *
 * Archivo and IBM Plex Mono are both SIL Open Font License 1.1. The notice
 * travels with the files, in src/fonts/OFL.txt.
 *
 * The URLs are relative, which is the only form that is right at the dev
 * server, at a repository root and at a GitHub project subpath all three: Vite
 * resolves them at build time, fingerprints the files and rewrites the URL
 * relative to the emitted stylesheet. See \`base: './'\` in vite.config.ts.
 */
${FACES.map(face).join('\n\n')}
`,
);

writeFileSync(
  join(OUT, 'OFL.txt'),
  `Archivo — Copyright 2019 The Archivo Project Authors
  https://github.com/Omnibus-Type/Archivo

IBM Plex Mono — Copyright 2017 IBM Corp.
  https://github.com/IBM/plex

Both are licensed under the SIL Open Font License, Version 1.1.
  https://openfontlicense.org

These copies have been subset to the characters this application renders, which
the licence permits. They remain under the same licence.
`,
);
console.log(`  Wrote ${CSS}, ${OUT}/*.woff2, ${OUT}/charset.txt and ${OUT}/OFL.txt\n`);
