/**
 * What the construction cages cost. Same contract as the other calibrators: it
 * prints, it does not assert.
 *
 * Three questions, and the first two are the ones the brief asked for:
 *
 *   - **draw calls added.** One mesh, and it is hidden on every frame nothing
 *     is growing — so the number that matters is what a *settled* city submits
 *     against what it submitted before, and what the worst frame adds;
 *   - **the frame cost of 320 simultaneous cages**, which is one full
 *     WAVE_BUDGET — what a twelve-hour catch-up stages into one zone. Measured
 *     twice: the cage writes on their own, and the whole of
 *     `Buildings.update` with the feature on against the same frame with it
 *     off, so neither the cage's own cost nor its share of the frame is
 *     guessed at;
 *   - **whether the bound is the budget or the city.** A cage list that grew
 *     with the map would be the whole point missed, so every row is measured at
 *     one district and at forty-nine with the same wave in flight.
 *
 * No GPU. Node has no WebGL context, so what is measured is the CPU cost of the
 * writes and the work submitted — draw calls, instances, triangles — rather
 * than frame time in the rendering sense. Those are the quantities a cage
 * moves, and it is the same claim tools/lod.calibrate.mjs makes.
 *
 *   node --experimental-transform-types tools/scaffold.calibrate.mjs
 */
import * as THREE from 'three';
import { LEVELS, MAX_DISTRICTS } from '../src/sim/config.ts';
import { CityLayout } from '../src/sim/layout.ts';
import { createState } from '../src/sim/state.ts';
import { Buildings } from '../src/render/buildings.ts';
import { Scaffold } from '../src/render/scaffold.ts';

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 3) => pad(Number(v).toFixed(d), w);
const thou = (v, w) => pad(Math.round(v).toLocaleString('en-GB'), w);

/** One wave is what `stage` caps a single arrival at. Kept in step by hand. */
const WAVE = 320;

const cohort = (n) => {
  const levels = new Array(LEVELS).fill(0);
  levels[0] = n;
  return levels;
};

const city = (districts, homes) => {
  const s = createState(0);
  s.districts = districts;
  s.homes = homes;
  s.homeLevels = cohort(homes);
  return s;
};

/**
 * A `Buildings` built as though the player had asked for reduced motion, which
 * is the build with no cages in it at all.
 *
 * The flag is read once, in the constructor, off `matchMedia` — so standing one
 * in for the length of a construction is the only way to get the two builds
 * side by side, and it is exactly the switch a real browser would throw.
 */
function withReducedMotion(make) {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  globalThis.matchMedia = () => ({ matches: true });
  try {
    return make();
  } finally {
    if (had) Object.defineProperty(globalThis, 'matchMedia', had);
    else delete globalThis.matchMedia;
  }
}

/** Every `InstancedMesh` that would actually be drawn, and what it submits. */
function submitted(root) {
  const rows = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    if (!object.visible || object.count === 0) return;
    const index = object.geometry.getIndex();
    const tris = index ? index.count / 3 : object.geometry.getAttribute('position').count / 3;
    rows.push({ name: object.name || '(unnamed)', count: object.count, tris: tris * object.count });
  });
  return rows;
}

const totals = (rows) => ({
  draws: rows.length,
  instances: rows.reduce((n, r) => n + r.count, 0),
  tris: rows.reduce((n, r) => n + r.tris, 0),
});

const cageRow = (rows) => rows.find((r) => r.name === 'part:scaffold') ?? { count: 0, tris: 0 };

/**
 * Median milliseconds a call takes, over `runs` after a warm-up.
 *
 * Median rather than mean, because the first few passes of a fresh JIT are a
 * different program from the one the frame loop actually runs, and one GC in
 * four hundred samples would move a mean and not a median.
 */
function time(fn, runs = 600) {
  for (let i = 0; i < 60; i++) fn();
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const at = performance.now();
    fn();
    samples.push(performance.now() - at);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

/**
 * A layer with `wave` buildings mid-growth on a settled city of `homes`.
 *
 * The clock is left where the wave was staged and only nudged from there, so
 * nothing retires mid-measurement and every pass writes the same list.
 */
function staged(make, districts, homes, wave) {
  const root = new THREE.Scene();
  const layer = make(root);
  layer.sync(city(districts, homes), 0);
  layer.update(1_000);
  layer.sync(city(districts, homes + wave), 1_000);
  return { root, layer };
}

const SIZES = [
  [1, 24],
  [7, 400],
  [MAX_DISTRICTS, 4_000],
];

const label = (districts, homes) => `${pad(districts, 2)}d / ${thou(homes, 5)} homes`;

console.log('\nConstruction cages — what one wave costs\n');

// --------------------------------------------------------------- draw calls

console.log('  What the layer submits, and what the cage mesh is of it');
console.log('  --------------------------------------------------------------------');
console.log('  city                        state    draws   instances       tris    cages');
for (const [districts, homes] of [SIZES[0], SIZES[2]]) {
  const root = new THREE.Scene();
  const layer = new Buildings(root, new CityLayout());
  layer.sync(city(districts, homes), 0);
  layer.update(1_000);
  const settled = totals(submitted(root));
  layer.sync(city(districts, homes + WAVE), 1_000);
  layer.update(1_000.02);
  const rows = submitted(root);
  const growing = totals(rows);
  const cage = cageRow(rows);
  console.log(
    `  ${label(districts, homes).padEnd(24)} settled ${pad(settled.draws, 8)}` +
      ` ${thou(settled.instances, 11)} ${thou(settled.tris, 10)} ${pad(0, 8)}`,
  );
  console.log(
    `  ${''.padEnd(24)} growing ${pad(growing.draws, 8)}` +
      ` ${thou(growing.instances, 11)} ${thou(growing.tris, 10)} ${pad(cage.count, 8)}`,
  );
  console.log(
    `  ${''.padEnd(24)}   cages ${pad(growing.draws - settled.draws, 8)}` +
      ` ${thou(cage.count, 11)} ${thou(cage.tris, 10)}`,
  );
}

// -------------------------------------------------------- the cage's own cost

console.log('\n  What writing the cages costs on its own, in ms a frame');
console.log('  --------------------------------------------------------------------');
console.log('  cages standing        ms      per cage (us)');
{
  const scaffold = new Scaffold(new THREE.Scene(), WAVE * 3);
  for (const n of [0, 1, 40, WAVE, WAVE * 3]) {
    const write = () => {
      scaffold.begin();
      for (let i = 0; i < n; i++) scaffold.add(i * 4, i * 2, 3.1, 3.1, 22);
      scaffold.end();
    };
    const ms = time(write);
    console.log(`  ${pad(n, 14)} ${fixed(ms, 9, 4)} ${n === 0 ? pad('—', 17) : fixed((ms * 1000) / n, 17, 3)}`);
  }
}

// ------------------------------------------------- the whole animation frame

console.log('\n  A whole `Buildings.update`, with cages and without, in ms');
console.log('  --------------------------------------------------------------------');
console.log('  city                     in flight     cages       with    without     delta');
for (const [districts, homes] of SIZES) {
  for (const wave of [1, 40, WAVE]) {
    const on = staged((root) => new Buildings(root, new CityLayout()), districts, homes, wave);
    const off = withReducedMotion(() =>
      staged((root) => new Buildings(root, new CityLayout()), districts, homes, wave),
    );
    // A step far shorter than either animation, so both builds hold the same
    // list in flight for every pass and the two are measuring the same frame.
    let clockOn = 1_000;
    let clockOff = 1_000;
    const withCages = time(() => {
      clockOn += 1e-5;
      on.layer.update(clockOn);
    });
    const without = time(() => {
      clockOff += 1e-5;
      off.layer.update(clockOff);
    });
    console.log(
      `  ${label(districts, homes).padEnd(24)} ${pad(wave, 9)} ${pad(on.layer.scaffolds, 9)}` +
        ` ${fixed(withCages, 10)} ${fixed(without, 10)} ${fixed(withCages - without, 9)}`,
    );
  }
}

console.log(
  '\n  The list is bounded by WAVE_BUDGET and not by the city: the rows at 320\n' +
    '  in flight draw the same cages at one district as at forty-nine, on top of\n' +
    '  a settled city a hundred and sixty times the size.\n',
);
