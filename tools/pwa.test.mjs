/**
 * Acceptance tests for the offline install. Plain Node, no framework, exits
 * non-zero on the first failure.
 *
 *   node tools/pwa.test.mjs
 *
 * Here rather than in `test/` and run from `npm test` alongside
 * `tools/citygen.test.mjs`, for the reason that file gives: what these check is
 * *files* — the markup, the generated stylesheet, the manifest, the icon bytes
 * — and vitest is configured `environment: 'node'` with `types: ["vite/client"]`
 * and no `@types/node`, so a case in `test/` could not read one without adding
 * a dependency and widening every source file's type surface to include Node's
 * globals. This repo already has the pattern for exactly this.
 *
 * What it cannot check is the part that needs a browser: that the worker
 * actually registers at the right scope, that a hard reload offline comes back
 * with the city, and that a new deploy leaves an open tab alone. That was
 * measured in headless Chromium against a server mounted at a `/idle-city/`
 * subpath — see the commit that added this — and the results are in NOTES.md.
 */
import { readFileSync, existsSync } from 'node:fs';
import { charset } from './charset.mjs';

let failures = 0;
let checks = 0;

function check(name, run) {
  try {
    const note = run();
    checks++;
    console.log(`  ok   ${name}${note ? ` — ${note}` : ''}`);
  } catch (error) {
    failures++;
    console.error(`  FAIL ${name}\n       ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const read = (path) => readFileSync(path, 'utf8');
const html = read('index.html');

console.log('\nThe offline install\n');

// ------------------------------------------------------------- other origins

check('fetches no fonts from another origin', () => {
  // The one real blocker to genuine offline play, and the whole of the font
  // work. Offline, a first cold load used to have no typography at all and the
  // HUD reflowed as the fallback stack took over.
  assert(!html.includes('fonts.googleapis.com'), 'index.html still links Google Fonts');
  assert(!html.includes('fonts.gstatic.com'), 'index.html still points at fonts.gstatic.com');
  // The attribute rather than the word, so the comment explaining their absence
  // is not itself a failure.
  assert(!html.includes('rel="preconnect"'), 'a preconnect hint survives');
  return 'and no preconnect hints either';
});

check('fetches nothing from another origin at all', () => {
  const urls = [...html.matchAll(/https?:\/\/[^"'\s)]+/g)].map((m) => m[0]);
  for (const url of urls) {
    assert(
      /^http:\/\/www\.w3\.org\/2000\/svg/.test(url),
      `index.html reaches for ${url}`,
    );
  }
  return `${urls.length} absolute URLs, all of them the SVG namespace`;
});

// -------------------------------------------------------------------- fonts

check('declares the four faces the stylesheet asks for', () => {
  const css = read('src/fonts.css');
  assert(read('src/style.css').includes("@import './fonts.css'"), 'style.css does not import them');
  for (const [family, weight] of [
    ['Archivo', 600],
    ['Archivo', 800],
    ['IBM Plex Mono', 400],
    ['IBM Plex Mono', 500],
  ]) {
    assert(css.includes(`font-family: '${family}'`), `no @font-face for ${family}`);
    assert(css.includes(`font-weight: ${weight};`), `no weight ${weight}`);
  }
  const faces = [...css.matchAll(/@font-face/g)].length;
  // `--display` is used at 600 and 800 and `--mono` at 400 and 500; a fifth
  // face would be bytes for a rule nobody wrote.
  assert(faces === 4, `${faces} @font-face rules, expected 4`);
  return '4 faces, 2 families';
});

check('points at font files that exist, by a relative URL', () => {
  const css = read('src/fonts.css');
  const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
  assert(urls.length === 4, `${urls.length} font URLs, expected 4`);
  let bytes = 0;
  for (const url of urls) {
    // Relative, and it has to be: this is the only form Vite can rewrite to
    // something correct at the dev server, at a repository root and at a GitHub
    // project subpath all three. A leading slash would go looking at the domain
    // root on Pages, which is the classic project-page failure.
    assert(!url.startsWith('/'), `${url} is root-relative and would break on a project page`);
    assert(!url.startsWith('http'), `${url} is remote`);
    const path = `src/${url.replace('./', '')}`;
    assert(existsSync(path), `${path} does not exist`);
    bytes += readFileSync(path).length;
  }
  return `${bytes.toLocaleString('en-GB')} B of woff2`;
});

check('was cut to the character set the sources produce today', () => {
  // The check that stops the subset drifting behind the HUD. Adding a
  // typographic mark to a panel and not re-running `npm run fonts` leaves one
  // character rendering in the fallback stack, which looks like a rendering
  // glitch and is never filed.
  const recorded = read('src/fonts/charset.txt');
  const now = charset();
  assert(
    recorded === now,
    'the fonts are subset to a different character set than the sources now produce — ' +
      'run `npm run fonts`',
  );
  return `${now.length} characters`;
});

check('carries the licence the fonts are under', () => {
  // Both families are SIL Open Font License 1.1, which permits subsetting and
  // self-hosting outright and asks that the notice travel with the files.
  const ofl = read('src/fonts/OFL.txt');
  for (const want of ['SIL Open Font License', 'Archivo', 'IBM Plex Mono']) {
    assert(ofl.includes(want), `OFL.txt does not mention ${want}`);
  }
  return 'OFL 1.1, both families';
});

// ----------------------------------------------------------------- manifest

const manifest = JSON.parse(read('public/manifest.webmanifest'));

check('links the manifest relatively', () => {
  assert(
    html.includes('rel="manifest" href="./manifest.webmanifest"'),
    'index.html does not link the manifest, or does not link it relatively',
  );
});

check('starts and scopes relatively, which is the project-page answer', () => {
  // The classic PWA failure, and it only ever shows up on the deployed site:
  // GitHub Pages serves this from `/idle-city/`, and a manifest claiming
  // `start_url: "/"` would install an app that opens the domain root. A
  // manifest's relative URLs resolve against the manifest's own URL, so `./` is
  // right at the root and at a subpath alike.
  assert(manifest.start_url === './', `start_url is ${manifest.start_url}`);
  assert(manifest.scope === './', `scope is ${manifest.scope}`);
  return "start_url and scope are both './'";
});

check('names icons that exist, including a maskable one', () => {
  const icons = manifest.icons ?? [];
  assert(icons.length >= 3, `${icons.length} icons`);
  for (const icon of icons) {
    assert(icon.src.startsWith('./'), `${icon.src} is not relative`);
    assert(existsSync(`public/${icon.src.slice(2)}`), `public/${icon.src.slice(2)} does not exist`);
  }
  // A launcher crops a maskable icon to whatever shape it likes and guarantees
  // only the middle 80%. Without one, an installed icon on Android is three
  // towers with their feet cut off.
  assert(icons.some((i) => i.purpose === 'maskable'), 'no maskable icon');
  for (const size of ['192x192', '512x512']) {
    assert(icons.some((i) => i.sizes === size), `no ${size} icon`);
  }
  return `${icons.length}, one of them maskable`;
});

check('agrees with the page about the name and the colour', () => {
  assert(manifest.theme_color === '#0B111B', `theme_color is ${manifest.theme_color}`);
  assert(html.includes('content="#0B111B"'), 'index.html has a different theme-color');
  assert(String(manifest.name).includes('District'), 'the manifest names a different game');
  assert(manifest.display === 'standalone', `display is ${manifest.display}`);
});

// -------------------------------------------------------------------- icons

check('draws the icons from the mark index.html already carries', () => {
  // Two hand-made copies of the same three rectangles is a pair of things that
  // will disagree the first time anyone adjusts one, so tools/icons.mjs holds
  // the only definition and writes both. This asserts the favicon in the page
  // is still the one that generator produces.
  const mark = read('tools/icons.mjs');
  const rects = [
    ["x='2' y='7' width='3' height='7'", '{ x: 2, y: 7, w: 3, h: 7'],
    ["x='6.5' y='3' width='3' height='11'", '{ x: 6.5, y: 3, w: 3, h: 11'],
    ["x='11' y='9' width='3' height='5'", '{ x: 11, y: 9, w: 3, h: 5'],
  ];
  for (const [inPage, inGenerator] of rects) {
    assert(html.includes(inPage), `the favicon has lost ${inPage}`);
    assert(mark.includes(inGenerator), `the generator has lost ${inGenerator}`);
  }
  return 'three rectangles, one definition';
});

check('writes real PNGs rather than an SVG with a .png on the end', () => {
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (const [file, size] of [
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-maskable-512.png', 512],
  ]) {
    const bytes = readFileSync(`public/${file}`);
    for (let i = 0; i < SIGNATURE.length; i++) {
      assert(bytes[i] === SIGNATURE[i], `${file} is not a PNG`);
    }
    // Width and height, out of the IHDR that has to be the first chunk.
    assert(bytes.readUInt32BE(16) === size, `${file} is ${bytes.readUInt32BE(16)}px wide`);
    assert(bytes.readUInt32BE(20) === size, `${file} is ${bytes.readUInt32BE(20)}px tall`);
  }
  return '192, 512 and a maskable 512';
});

// ------------------------------------------------------------------- worker

const pwa = read('src/pwa.ts');
const worker = read('tools/sw.mjs');

check('derives the worker scope from where the page is', () => {
  // A service worker can never control a path above the directory its script is
  // served from, whatever the code asks for. A literal `/sw.js` would point at
  // the domain root on Pages and silently control nothing — which only ever
  // shows up on the deployed site.
  assert(pwa.includes("new URL('.', location.href)"), 'the scope is not derived from location');
  assert(pwa.includes("new URL('sw.js', scope)"), 'the script URL is not relative to the scope');
  assert(!pwa.includes("register('/sw.js'"), 'the worker is registered at the domain root');
});

check('never takes over a tab that is already running', () => {
  // The save-integrity decision. This game migrates a save *forward* through
  // eleven legacy keys and has no path backward, so an older shell must never
  // read a save a newer build has already moved on. `skipWaiting` plus
  // `clients.claim` is exactly the mechanism that would swap the code under a
  // running tab. A *call* rather than the word, so the comments arguing the
  // point in both files are not themselves failures.
  assert(!/skipWaiting\s*\(/.test(pwa), 'src/pwa.ts calls skipWaiting');
  assert(!/skipWaiting\s*\(/.test(worker), 'the worker calls skipWaiting');
  // And the other half: the entry document is fetched network-first, so an
  // online load always gets the newest shell rather than a cached one.
  assert(worker.includes("request.mode === 'navigate'"), 'the entry document is not special-cased');
  return 'no skipWaiting, and the entry document is network-first';
});

check('registers nothing in dev, where there is no worker to register', () => {
  assert(pwa.includes('import.meta.env.DEV'), 'the dev server would get a stale precache');
});

console.log(`\n${checks} passed, ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
