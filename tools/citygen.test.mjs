/**
 * Acceptance tests for district generation. Plain Node, no framework, exits
 * non-zero on the first failure.
 *
 *   node tools/citygen.test.mjs
 *
 * The generator is imported straight from src/sim/citygen.ts rather than being
 * scraped out of a bundle: this repo already has a build step, and Node strips
 * the type annotations itself, so there is nothing to extract. citygen.ts is
 * kept free of DOM and three.js imports precisely so this stays possible, and
 * its own imports carry explicit .ts extensions so Node's resolver can follow
 * them without a loader.
 */
import {
  cutWalk,
  generateAttempt,
  generateDistrict,
  MAX_ATTEMPTS,
  ZONE,
  zoneBudget,
} from '../src/sim/citygen.ts';
import {
  DISTRICT_SPAN as SPAN,
  ROAD_GAP_MAX,
  ROAD_GAP_MIN,
  TARGET_PLOTS,
  ZONE_SHARE,
} from '../src/sim/config.ts';
import { rng } from '../src/core/rng.ts';

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

/** A spread of seeds that does not correlate with the generator's own mixing. */
const seedOf = (i) => (0x9e3779b9 + i * 2654435761) | 0;
const SEEDS = 1000;

// ---------------------------------------------------------------- 1. determinism

check('determinism: one seed, 100 runs, byte-identical zoning', () => {
  const first = generateDistrict(seedOf(7));
  const reference = Buffer.from(first.zone).toString('base64');
  for (let i = 0; i < 100; i++) {
    const again = generateDistrict(seedOf(7));
    assert(
      Buffer.from(again.zone).toString('base64') === reference,
      `run ${i} produced a different zone array`,
    );
    assert(again.railSide === first.railSide, `run ${i} moved the rail side`);
    assert(
      again.residential.join(',') === first.residential.join(',') &&
        again.commercial.join(',') === first.commercial.join(',') &&
        again.industrial.join(',') === first.industrial.join(','),
      `run ${i} produced a different build order`,
    );
  }
  return '100 runs identical';
});

// ------------------------------------------------------------- 2. gap invariant

/** Rebuilds the line positions from a mask so the test never trusts the walk. */
function linesOf(mask) {
  const lines = [];
  for (let i = 0; i < mask.length; i++) if (mask[i] === 1) lines.push(i);
  return lines;
}

function assertGaps(lines, label) {
  assert(lines[0] === 0, `${label}: first line is ${lines[0]}, not 0`);
  assert(
    lines[lines.length - 1] === SPAN,
    `${label}: last line is ${lines[lines.length - 1]}, not ${SPAN}`,
  );
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i] - lines[i - 1];
    assert(
      gap >= ROAD_GAP_MIN && gap <= ROAD_GAP_MAX,
      `${label}: gap ${gap} outside [${ROAD_GAP_MIN}, ${ROAD_GAP_MAX}] in ${lines.join(',')}`,
    );
  }
}

check(`gap invariant: every row and column gap in [${ROAD_GAP_MIN}, ${ROAD_GAP_MAX}], ${SEEDS} seeds`, () => {
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateDistrict(seedOf(i));
    assertGaps(linesOf(layout.rowRoad), `seed ${i} rows`);
    assertGaps(linesOf(layout.colRoad), `seed ${i} cols`);
  }
  return `${SEEDS} accepted layouts`;
});

check('gap invariant: holds on rejected attempts too, including the tail', () => {
  // Rejection sampling only filters on plot count, so a bad tail would sail
  // straight through it. The walk itself has to be sound.
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateAttempt(seedOf(i) ^ 0x5bf03635);
    assertGaps(linesOf(layout.rowRoad), `attempt ${i} rows`);
    assertGaps(linesOf(layout.colRoad), `attempt ${i} cols`);
  }
  // And directly against the walk, over spans where the naive version leaves a
  // sliver or an over-wide leftover.
  for (let span = ROAD_GAP_MIN; span <= 64; span++) {
    for (let i = 0; i < 200; i++) {
      const lines = cutWalk(rng(seedOf(i) ^ span), span, ROAD_GAP_MIN, ROAD_GAP_MAX);
      assert(lines[lines.length - 1] === span, `span ${span}: walk did not close`);
      for (let k = 1; k < lines.length; k++) {
        const gap = lines[k] - lines[k - 1];
        assert(
          gap >= ROAD_GAP_MIN && gap <= ROAD_GAP_MAX,
          `span ${span} seed ${i}: gap ${gap} outside range in ${lines.join(',')}`,
        );
      }
    }
  }
  return `${SEEDS} attempts, plus 200 walks at every span from ${ROAD_GAP_MIN} to 64`;
});

// -------------------------------------------------------------------- 3. budget

check(`budget: every district lands on exactly ${TARGET_PLOTS} plots, ${SEEDS} seeds`, () => {
  let worst = 0;
  let firstTry = 0;
  let withinEight = 0;
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateDistrict(seedOf(i));
    let buildable = 0;
    for (const zone of layout.zone) if (zone !== ZONE.road) buildable++;
    assert(
      buildable === TARGET_PLOTS,
      `seed ${i}: ${buildable} buildable plots, wanted ${TARGET_PLOTS}`,
    );
    assert(layout.buildable === buildable, `seed ${i}: reported count disagrees with the map`);
    worst = Math.max(worst, layout.attempts);
    if (layout.attempts === 1) firstTry++;
    if (layout.attempts <= 8) withinEight++;
  }
  assert(worst < MAX_ATTEMPTS, `worst case ${worst} attempts hit the cap ${MAX_ATTEMPTS}`);
  return (
    `tolerance 0, worst case ${worst} attempts, ` +
    `${((firstTry / SEEDS) * 100).toFixed(1)}% first try, ` +
    `${((withinEight / SEEDS) * 100).toFixed(1)}% within 8`
  );
});

// ---------------------------------------------------------------- 4. zone split

check('zone split: R/C/I within 2 plots of the target fractions', () => {
  const want = {
    residential: TARGET_PLOTS * ZONE_SHARE.residential,
    commercial: TARGET_PLOTS * ZONE_SHARE.commercial,
    industrial: TARGET_PLOTS * ZONE_SHARE.industrial,
  };
  let drift = 0;
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateDistrict(seedOf(i));
    const got = { residential: 0, commercial: 0, industrial: 0 };
    for (const zone of layout.zone) {
      if (zone === ZONE.residential) got.residential++;
      else if (zone === ZONE.commercial) got.commercial++;
      else if (zone === ZONE.industrial) got.industrial++;
    }
    for (const key of Object.keys(want)) {
      const off = Math.abs(got[key] - want[key]);
      drift = Math.max(drift, off);
      assert(off <= 2, `seed ${i}: ${key} ${got[key]}, wanted ~${want[key].toFixed(1)}`);
    }
    // The three lists the renderer draws from must agree with the map itself.
    assert(layout.residential.length === got.residential, `seed ${i}: R list disagrees`);
    assert(layout.commercial.length === got.commercial, `seed ${i}: C list disagrees`);
    assert(layout.industrial.length === got.industrial, `seed ${i}: I list disagrees`);
  }
  const budget = zoneBudget(TARGET_PLOTS);
  return `R ${budget.residential} / C ${budget.commercial} / I ${budget.industrial}, worst drift ${drift.toFixed(1)}`;
});

// ------------------------------------------------------------------ 5. coverage

check('coverage: one zone per buildable plot, none on a road, none empty', () => {
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateDistrict(seedOf(i));
    const counts = [0, 0, 0, 0];
    for (let z = 0; z < SPAN; z++) {
      for (let x = 0; x < SPAN; x++) {
        const cell = z * SPAN + x;
        const zone = layout.zone[cell];
        const road = layout.rowRoad[z] === 1 || layout.colRoad[x] === 1;
        assert(zone >= 0 && zone <= 3, `seed ${i}: cell ${cell} has zone ${zone}`);
        assert(
          road === (zone === ZONE.road),
          `seed ${i}: cell ${x},${z} is ${road ? 'road' : 'plot'} but zoned ${zone}`,
        );
        assert(
          road === (layout.block[cell] === -1),
          `seed ${i}: cell ${x},${z} block label disagrees with the road mask`,
        );
        counts[zone]++;
      }
    }
    for (const zone of [ZONE.residential, ZONE.commercial, ZONE.industrial]) {
      assert(counts[zone] > 0, `seed ${i}: zone ${zone} is empty`);
    }
    // Exactly one zone each: the three lists partition the buildable plots.
    const listed = new Set([...layout.residential, ...layout.commercial, ...layout.industrial]);
    assert(
      listed.size === layout.residential.length + layout.commercial.length + layout.industrial.length,
      `seed ${i}: a plot appears in more than one zone list`,
    );
    assert(listed.size === TARGET_PLOTS, `seed ${i}: ${listed.size} plots listed, wanted ${TARGET_PLOTS}`);
    for (const cell of listed) {
      assert(layout.zone[cell] !== ZONE.road, `seed ${i}: cell ${cell} is listed but is a road`);
    }
  }
  return `${SEEDS} seeds, ${TARGET_PLOTS} plots each`;
});

check('coverage: perimeter flag matches touching a road', () => {
  for (let i = 0; i < 200; i++) {
    const layout = generateDistrict(seedOf(i));
    const road = (x, z) =>
      x < 0 || z < 0 || x >= SPAN || z >= SPAN
        ? true
        : layout.rowRoad[z] === 1 || layout.colRoad[x] === 1;
    for (let z = 0; z < SPAN; z++) {
      for (let x = 0; x < SPAN; x++) {
        if (road(x, z)) continue;
        const touching = road(x - 1, z) || road(x + 1, z) || road(x, z - 1) || road(x, z + 1);
        assert(
          layout.perimeter[z * SPAN + x] === (touching ? 1 : 0),
          `seed ${i}: perimeter flag wrong at ${x},${z}`,
        );
      }
    }
  }
  return 'interior plots are the ones a later height cap will need';
});

// -------------------------------------------------------- 6. industrial coherence

/**
 * Connected components over industrial plots, strict 4-adjacency — a street
 * between two industrial blocks splits them. That is the harshest reading of
 * the rule, and it is the one asserted.
 */
function industrialClusters(zone) {
  const seen = new Uint8Array(zone.length);
  const isIndustrial = (x, z) =>
    x >= 0 && z >= 0 && x < SPAN && z < SPAN && zone[z * SPAN + x] === ZONE.industrial;
  let clusters = 0;
  for (let z = 0; z < SPAN; z++) {
    for (let x = 0; x < SPAN; x++) {
      if (!isIndustrial(x, z) || seen[z * SPAN + x]) continue;
      clusters++;
      const stack = [[x, z]];
      seen[z * SPAN + x] = 1;
      while (stack.length > 0) {
        const [cx, cz] = stack.pop();
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (isIndustrial(nx, nz) && !seen[nz * SPAN + nx]) {
            seen[nz * SPAN + nx] = 1;
            stack.push([nx, nz]);
          }
        }
      }
    }
  }
  return clusters;
}

check('industrial coherence: at most 3 connected clusters', () => {
  let worst = 0;
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateDistrict(seedOf(i));
    const clusters = industrialClusters(layout.zone);
    worst = Math.max(worst, clusters);
    assert(clusters <= 3, `seed ${i}: industry broke into ${clusters} clusters`);
  }
  return `worst case ${worst} clusters over ${SEEDS} seeds`;
});

// ---------------------------------------------------------------------- 7. perf

check('perf: a full generation including rejection sampling under 20ms', () => {
  // Warm the JIT, then take the worst single district rather than the mean —
  // one district over budget is one visible hitch when land is annexed.
  for (let i = 0; i < 200; i++) generateDistrict(seedOf(i));
  let worst = 0;
  let total = 0;
  for (let i = 0; i < SEEDS; i++) {
    const start = performance.now();
    generateDistrict(seedOf(i));
    const took = performance.now() - start;
    worst = Math.max(worst, took);
    total += took;
  }
  assert(worst < 20, `slowest district took ${worst.toFixed(2)}ms`);
  return `worst ${worst.toFixed(2)}ms, mean ${(total / SEEDS).toFixed(3)}ms`;
});

console.log(`\n${checks} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
