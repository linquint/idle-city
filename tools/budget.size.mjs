/**
 * What the build is allowed to weigh, per chunk, and what it actually weighs.
 *
 * Unlike the calibrators beside it this one **asserts**: it exits non-zero on a
 * breach, and CI runs it after `vite build`. A budget that prints a warning
 * nobody reads is not a budget.
 *
 *   npm run build && npm run budget:size
 *
 * ---
 *
 * **Why per chunk and not one total.** `vite.config.ts` splits three into a
 * chunk of its own so the game code can be re-downloaded without re-downloading
 * the renderer. A single total would let the game code grow into the headroom
 * three leaves — 484 kB of it — and the split would quietly stop meaning
 * anything while every number still looked fine. So each chunk carries its own
 * budget and its own argument for the headroom, and an asset that matches no
 * budget is itself a failure: adding a fourth chunk must be a decision someone
 * writes down, not something that slips past every existing number.
 *
 * **Why raw and gzip both.** Gzip is what the player waits for and raw is what
 * their browser then has to parse and compile, which on a phone is the larger
 * half of the wait. A change that leaves gzip alone and doubles raw — a build
 * that stopped minifying, say — is a real regression and only one of the two
 * columns can see it.
 *
 * **Why sourcemaps are excluded.** `dist/assets/*.map` is 4 MB and no player
 * ever downloads a byte of it: a browser fetches a sourcemap only when devtools
 * is open and asks for one. Budgeting it would be budgeting a debugging aid,
 * and the numbers would swamp everything the player actually waits for.
 */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';

/**
 * The budgets, measured against the build at the commit that added them and
 * then given the headroom each entry argues for.
 *
 * Measured (`vite build`, gzip level 9):
 *
 *   index.html                28,239 raw    6,744 gzip
 *   assets/index-*.css        20,373 raw    4,629 gzip
 *   assets/index-*.js        216,357 raw   70,715 gzip
 *   assets/sim.worker-*.js    60,003 raw   20,641 gzip
 *   assets/*.woff2            22,716 raw   22,808 gzip
 *   manifest + icons + sw     11,485 raw    3,711 gzip
 *   assets/three-*.js        513,831 raw  130,702 gzip
 *
 * A build is deterministic for a fixed input, so there is no measurement noise
 * for the headroom to absorb — the only thing it is for is how often the number
 * has to be argued about again. Each entry says how much and why, and a breach
 * is meant to be answered by *either* trimming the chunk or raising the number
 * in the same commit with the delta written down. The second is not cheating;
 * it is the whole mechanism.
 */
const BUDGETS = [
  {
    name: 'index.html',
    match: /^index\.html$/,
    // +10%. The HUD's markup, and it grows a panel at a time — nine tab panels
    // and their rows are all in here. 10% is about one more panel, so a feature
    // that adds one lands inside the budget and a feature that adds three does
    // not, which is the granularity worth being told about.
    //
    // Raised once, deliberately, and this is the note the mechanism asks for:
    // 25,977 -> 27,672 raw and 5,922 -> 6,593 gzip, when the display panel and
    // the PWA metadata landed. The gzip half breached by 73 B (+1.1%) and was
    // *not* trimmed to fit: what pushed it is the manifest link, four Apple
    // meta tags and the comment saying why nothing is fetched from another
    // origin any more, and this file's markup is commented at length on purpose
    // — trimming prose to fit a number would be the budget deciding the house
    // style. Re-measured and re-based at +10% of the new figures instead.
    //
    // Raised a second time, on the same terms: 30,463 raw and 7,238 gzip, which
    // breaches the raw half by 23 B (+0.1%) with the gzip half 0.2% inside.
    // What landed is two blocks — the network's two build buttons and three
    // readouts, and the two response rows under Crime and Fire — so the +10%
    // held one panel's worth and this is the second, exactly as the note above
    // says the granularity is meant to work. Re-measured at +10% again.
    raw: 33_500,
    gzip: 7_960,
  },
  {
    name: 'assets/index-*.css',
    match: /^assets\/index-[\w-]+\.css$/,
    // +15%. Small in absolute terms — 650 gzipped bytes of headroom, about a
    // panel's worth of rules — and the percentage is loose because the base is
    // small enough that a tighter one would trip on a rounded corner. It is
    // also the number self-hosted web fonts have to be checked against: an
    // @font-face block per family per weight is what would eat this.
    raw: 21_700,
    gzip: 4_970,
  },
  {
    name: 'assets/index-*.js',
    match: /^assets\/index-[\w-]+\.js$/,
    // +12%. This is the chunk that is *supposed* to move: it is the game. 12%
    // is roughly one substantial feature — so one lands inside the budget and
    // the second in a row has to be argued for. That is the right place for the
    // conversation to happen.
    //
    // Re-based on merging master, which brought the composed hospital and fire
    // station: 206,775 -> 216,357 raw and 68,048 -> 70,715 gzip, of which
    // `civicModels.ts` and `model.ts` are 11.2 kB of source. The raw half
    // breached by 757 B (+0.4%) with the gzip half still inside, which is the
    // budget reporting a feature landing rather than a regression — so it is
    // re-measured and re-based rather than argued with.
    //
    // Re-based again on the rail and tram network: 244,885 raw and 76,460 gzip,
    // so the raw half breached by 2,585 B (+1.1%) with the gzip half still
    // 3.5% inside. Same reading as last time and the same answer. What landed
    // is a table, a geometry, three economy readings, a HUD block and two more
    // fleets in `cars.ts` — one substantial feature, which is exactly what this
    // budget's +12% was sized to hold once. The next one in a row has to be
    // argued for rather than re-based, which is the point of writing this down.
    //
    // And that argument is now owed, so here it is. This cycle landed *four*
    // features rather than one — the network, the generalised emergency
    // response, the eleventh square with its density re-solve, and the culture
    // tier — and the chunk is 251,124 raw and 78,118 gzip, which is 16% over
    // the figure the network was re-based from and 1.4% under the gzip ceiling
    // that has not moved since. The gzip half is the one that reaches a player
    // over a wire and it has held inside every re-base, which is the honest
    // reading of a chunk that is mostly prose and tables. Re-based to +12% of
    // the four-feature figure; a fifth still has to be argued for.

    // Re-based in parallel on modelling every zone's first rung: fifteen
    // building models and the four modules that draw them. `houseModels.ts`,
    // `shopModels.ts`, `industryModels.ts` and `modelled.ts` are 55 kB of
    // source between them, and three quarters of that is generated part table —
    // fifteen models at 15 to 31 boxes each.
    //
    // The same shape a part table always makes, and the same reading the two
    // notes above reach: raw breaches while gzip stays inside. A table of
    // `{ shape: 'box', at: [...], size: [...], mtl: '...', colour: PALETTE.x }`
    // repeated three hundred times is the most compressible thing this codebase
    // produces, so raw is the honest measure of the source and gzip is the
    // honest measure of what a player downloads. Trimming to fit would mean
    // hand-shortening generated output, which is the one thing every one of
    // those files says never to do.
    //
    // Measured on the merge of the two, which is the only figure that means
    // anything now: 284,825 raw and 83,749 gzip. The raw half breached the
    // 281,000 above by 3,825 B (+1.4%); the gzip half came in 4.3% *under* the
    // 87,500 the network set and has not been moved. That is the whole argument
    // for re-basing raw alone rather than both: a ceiling with headroom under
    // it is a ceiling that is still doing its job, and raising it because a
    // sibling number moved would be the drift this file exists to stop. Raw is
    // +12% of the merged figure; gzip stays where it was and the next thing
    // that breaches it owes an argument of its own.
    raw: 319_000,
    gzip: 87_500,
  },
  {
    name: 'assets/sim.worker-*.js',
    match: /^assets\/sim\.worker-[\w-]+\.js$/,
    // +12%, the same headroom the game chunk gets and for the same reason: this
    // *is* the game, compiled a second time for the thread that runs it.
    //
    // Measured at 60,003 B raw / 20,641 B gzip, and the duplication is the
    // point rather than an accident. The renderer calls pure functions over
    // `GameState` — `congestion`, `landmarkCoverage`, `residents`, `covered`,
    // `levelAt` — and the HUD imports 113 named things from `economy.ts`, so
    // that module is in both threads. The alternative is the worker
    // precomputing every derived number the two of them want and shipping it
    // in the state message: a payload that grows with the *readouts* rather
    // than with the city, regenerated ten times a second, and one more thing
    // to remember whenever anyone adds a row to a panel. Twenty kilobytes of
    // duplicated pure functions, fetched once and precached forever, is the
    // cheaper half of that trade by a wide margin.
    raw: 67_200,
    gzip: 23_100,
  },
  {
    name: 'assets/*.woff2',
    match: /^assets\/[\w-]+\.woff2$/,
    // +10%, and the number is the whole four-face set rather than one face,
    // because they are bought and precached together. Measured at 22,716 B for
    // Archivo 600/800 and IBM Plex Mono 400/500, subset to the 106 characters
    // the game can put on screen — against 57,832 for the same four at Google's
    // own full Latin subset, which is what a `<link>` to fonts.googleapis.com
    // was fetching. 10% is about six more characters' worth of outlines across
    // four faces, so an added glyph lands inside it and a fifth face does not.
    //
    // No gzip headroom worth the name: woff2 is Brotli-compressed already, so
    // the gzip column is a couple of dozen bytes *larger* than the raw one and
    // is here only to make that visible rather than to be argued with.
    raw: 25_000,
    gzip: 25_100,
  },
  {
    name: 'manifest + icons + sw',
    match: /^(manifest\.webmanifest|icon-[\w-]+\.png|sw\.js)$/,
    // +25%, and loose on purpose: this is five small files that move for
    // structural reasons rather than incremental ones — a fourth icon size, a
    // third rule in the worker. Measured at 11,450 B raw / 3,702 B gzip: three
    // PNGs drawn from the favicon's own mark (6,423), the worker (4,380) and
    // the manifest (647). 25% of a base this small is 2.9 kB, which is one more
    // icon and change, and there is no useful tighter number.
    raw: 14_400,
    gzip: 4_700,
  },
  {
    name: 'assets/three-*.js',
    match: /^assets\/three-[\w-]+\.js$/,
    // +5%, and it is deliberately the tightest number here. The whole reason
    // this chunk exists is that it does *not* move: it changes when three's
    // version changes, or when the game reaches into a part of three it was not
    // using. 5% absorbs a minor release and trips on a new subsystem — a
    // loader, a controls module, BufferGeometryUtils — which is exactly the
    // change that should require someone to say out loud that it is worth it.
    //
    // And on the first real change it met, it tripped on precisely that: master
    // merged the composed civic models, `src/render/model.ts` imports
    // `mergeGeometries` from three/examples/jsm/utils/BufferGeometryUtils.js,
    // and the chunk went 484,553 -> 513,831 raw and 121,164 -> 130,702 gzip.
    // +5,031 B raw and +3,502 B gzip for one addon, which is a fair price for
    // geometry composed from a modelling tool rather than hand-written — and
    // the point of the number is that somebody had to look at it and say so.
    // Re-based on the new measurement, at the same 5%.
    raw: 539_500,
    gzip: 137_200,
  },
];

/** Everything the build put in `dist`, bar the sourcemaps. See the header. */
function assets(dir = DIST, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      assets(path, out);
      continue;
    }
    if (path.endsWith('.map')) continue;
    const bytes = readFileSync(path);
    out.push({
      path: relative(DIST, path).split('\\').join('/'),
      raw: bytes.length,
      gzip: gzipSync(bytes, { level: 9 }).length,
    });
  }
  return out;
}

const pad = (v, w) => String(v).padStart(w);
const thou = (v, w) => pad(Number(v).toLocaleString('en-GB'), w);
const pct = (actual, budget) => `${actual > budget ? '+' : ''}${(((actual - budget) / budget) * 100).toFixed(1)}%`;

let built;
try {
  built = assets();
} catch {
  console.error(`\n  No ${DIST}/ to measure. Run \`npm run build\` first.\n`);
  process.exit(2);
}

const failures = [];
const rows = [];
const claimed = new Set();

for (const budget of BUDGETS) {
  const found = built.filter((asset) => budget.match.test(asset.path));
  if (found.length === 0) {
    failures.push(`${budget.name}: no asset in ${DIST}/ matches it — did the build output change?`);
    continue;
  }
  for (const asset of found) claimed.add(asset.path);
  // Summed rather than "the first one": a budget that matched two chunks and
  // measured one would be a budget with a hole in it.
  const raw = found.reduce((n, a) => n + a.raw, 0);
  const gzip = found.reduce((n, a) => n + a.gzip, 0);
  rows.push({ name: budget.name, raw, gzip, budget });
  for (const [what, actual, allowed] of [
    ['raw', raw, budget.raw],
    ['gzip', gzip, budget.gzip],
  ]) {
    if (actual <= allowed) continue;
    failures.push(
      `${budget.name} (${what}): budget ${allowed.toLocaleString('en-GB')} B, ` +
        `actual ${actual.toLocaleString('en-GB')} B, ` +
        `over by ${(actual - allowed).toLocaleString('en-GB')} B (${pct(actual, allowed)})`,
    );
  }
}

// An asset nobody budgeted is a hole in the whole scheme, so it is a breach in
// its own right: a fourth chunk would otherwise arrive weighing anything at all
// and every existing number would still read green.
for (const asset of built) {
  if (claimed.has(asset.path)) continue;
  failures.push(
    `${asset.path}: no budget covers it (${asset.raw.toLocaleString('en-GB')} B raw, ` +
      `${asset.gzip.toLocaleString('en-GB')} B gzip). Add one to tools/budget.size.mjs.`,
  );
}

console.log('\nBundle budgets\n');
console.log('  chunk                        raw     budget      gzip     budget    headroom');
console.log('  ---------------------------------------------------------------------------');
for (const row of rows) {
  const worst = Math.max(row.raw / row.budget.raw, row.gzip / row.budget.gzip);
  console.log(
    `  ${row.name.padEnd(22)} ${thou(row.raw, 9)} ${thou(row.budget.raw, 10)}` +
      ` ${thou(row.gzip, 9)} ${thou(row.budget.gzip, 10)} ${pad(`${((1 - worst) * 100).toFixed(1)}%`, 11)}`,
  );
}

if (failures.length === 0) {
  console.log('\n  Every chunk inside its budget.\n');
  process.exit(0);
}

console.error('\n  Over budget:\n');
for (const line of failures) console.error(`    ${line}`);
console.error(
  '\n  Either trim the chunk or raise the number in tools/budget.size.mjs — in the\n' +
    '  same commit, with the delta and the reason written down. The budget exists\n' +
    '  to make growth deliberate, not to make it impossible.\n',
);
process.exit(1);
