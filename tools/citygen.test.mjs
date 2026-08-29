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
  FRONTAGE_TARGET,
  ROAD_GAP_MAX,
  ROAD_GAP_MIN,
  TARGET_PLOTS,
  ZONE_SHARE,
} from '../src/sim/config.ts';
import {
  BUILDABLE_PARKS_PER_DISTRICT,
  civicSites,
  districtPlan,
  planFor,
  universitySites,
} from '../src/sim/layout.ts';
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

/**
 * Courtyard plots a district leaves once every square is reserved: park land
 * first, spare land after it. Arithmetic over the budget rather than a
 * measurement — 144 less 82 for sale, 9 x 4 of 2x2 squares and 2 x 9 of 3x3.
 */
const COURTYARDS =
  TARGET_PLOTS -
  FRONTAGE_TARGET.residential -
  FRONTAGE_TARGET.commercial -
  FRONTAGE_TARGET.industrial -
  FRONTAGE_TARGET.squares * 4 -
  (FRONTAGE_TARGET.universitySites + FRONTAGE_TARGET.landmarkLargeSites) * 9;

/**
 * Wall-clock budgets for generating one on-target district, in milliseconds.
 *
 * Two of them, because one number could not do the job. A district is
 * rejection-sampled, so its cost is a long-tailed distribution over seeds: the
 * mean is what a player pays and the tail is what hitches. The old single
 * budget was a *maximum* over a thousand samples at 40ms, and a maximum over a
 * thousand wall-clock samples measures the machine as much as the code —
 * identical code came back at 24ms, 34ms and 39ms on different runs here, and
 * over 40 often enough to fail two runs in three on a busy one.
 *
 * So the two statistics are asserted where each is meaningful:
 *
 *   - the mean is the stable one (3.2ms to 5.8ms across the runs measured
 *     here, against a tail that moved by 20ms over the same runs) and is what
 *     catches an algorithmic regression: the budget is about three times the
 *     worst mean seen;
 *   - the tail is not stable, so its budget is loose enough to survive a slow
 *     shared runner and tight enough to catch a *class* of pathological seed
 *     appearing, which would move the whole distribution rather than one draw.
 *
 * A district is generated once and cached for the life of the tab, so a full
 * 49-district city is about 270ms of work spread over however long it takes to
 * annex them, and the tail is one hitch per district ever bought.
 */
const PERF_MEAN_MS = 15;
const PERF_WORST_MS = 90;

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
    // The build lists are the road-adjacent subset now, so they can only ever
    // be shorter than the zone. Their exact lengths are asserted in section 8.
    assert(layout.residential.length <= got.residential, `seed ${i}: R list exceeds the zone`);
    assert(layout.commercial.length <= got.commercial, `seed ${i}: C list exceeds the zone`);
    assert(layout.industrial.length <= got.industrial, `seed ${i}: I list exceeds the zone`);
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
    // Exactly one zone each: the three lists are disjoint, and every plot they
    // name is a plot rather than a street.
    const listed = new Set([...layout.residential, ...layout.commercial, ...layout.industrial]);
    assert(
      listed.size === layout.residential.length + layout.commercial.length + layout.industrial.length,
      `seed ${i}: a plot appears in more than one zone list`,
    );
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
  return 'interior plots are the ones the build lists drop';
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

// Four, not the three this held at DISTRICT_SPAN 12. The zoning code is frozen
// and unchanged; a wider district simply gives `cutWalk` room for one more
// street line, which splits an industrial run that used to be contiguous.
// Measured over 20,000 seeds at span 13: 1 cluster 22.5%, 2 clusters 72.4%,
// 3 clusters 1.8%, 4 clusters 3.3%, and never 5.
check('industrial coherence: at most 4 connected clusters', () => {
  let worst = 0;
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateDistrict(seedOf(i));
    const clusters = industrialClusters(layout.zone);
    worst = Math.max(worst, clusters);
    assert(clusters <= 4, `seed ${i}: industry broke into ${clusters} clusters`);
  }
  return `worst case ${worst} clusters over ${SEEDS} seeds`;
});

// -------------------------------------------------------------- 8. frontage

// The frontage rule is scoped to the three zones that are *sold*. Parks are the
// one type exempt from it, so they are checked against their own rule below
// rather than being allowed to weaken this one.
check(`frontage: every plot offered for sale touches a road, ${SEEDS} seeds`, () => {
  let offered = 0;
  let roadAdjacent = null;
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateDistrict(seedOf(i));
    for (const [zone, cells] of [
      ['residential', layout.residential],
      ['commercial', layout.commercial],
      ['industrial', layout.industrial],
    ]) {
      for (const cell of cells) {
        assert(
          layout.perimeter[cell] === 1,
          `seed ${i}: ${zone} plot ${cell} is offered but is buried inside a block`,
        );
        offered++;
      }
    }
    // The road-adjacent count is invariant across every seed at a given span —
    // 84 of 100 at span 13, 108 of 144 at span 15 — even though how the ones
    // that are neither commercial nor road split between R and I is not. Taken
    // from the first seed rather than written down, so the property under test
    // is the invariance itself and not a number that has to be re-typed every
    // time the span moves.
    const total = layout.residential.length + layout.commercial.length + layout.industrial.length;
    roadAdjacent ??= total;
    assert(total === roadAdjacent, `seed ${i}: ${total} road-adjacent plots, wanted ${roadAdjacent}`);
    // Commercial frontage is invariant for a deeper reason: `zoneBlocks` lays
    // shops along block rings and a ring *is* the frontage. It is 45 at span 15
    // and there is no seed that offers any other number.
    assert(
      layout.commercial.length === FRONTAGE_TARGET.commercial,
      `seed ${i}: ${layout.commercial.length} shop plots`,
    );
  }
  return `${offered} plots, all on a street, ${roadAdjacent} of ${TARGET_PLOTS} road-adjacent`;
});

check(`frontage: districts land on ${FRONTAGE_TARGET.residential}/${FRONTAGE_TARGET.commercial}/${FRONTAGE_TARGET.industrial} for sale, every seed`, () => {
  // The split is not there to be had straight out of the generator: commercial
  // frontage is invariant at 31 but R and I divide the other 53 road-adjacent
  // plots differently on every seed. `planFor` reseeds until a district lands on
  // the tuple the economy needs, which is the same trick generateDistrict
  // already uses for TARGET_PLOTS, one level up. Measured hit rate 3.28%.
  let worst = 0;
  for (let i = 0; i < SEEDS; i++) {
    const plan = planFor(seedOf(i));
    assert(
      plan.residential.length === FRONTAGE_TARGET.residential,
      `seed ${i}: ${plan.residential.length} residential plots for sale`,
    );
    assert(
      plan.commercial.length === FRONTAGE_TARGET.commercial,
      `seed ${i}: ${plan.commercial.length} commercial plots for sale`,
    );
    assert(
      plan.industrial.length === FRONTAGE_TARGET.industrial,
      `seed ${i}: ${plan.industrial.length} industrial plots for sale`,
    );
    assert(
      plan.sites.length === FRONTAGE_TARGET.civicSites,
      `seed ${i}: ${plan.sites.length} civic sites`,
    );
    assert(
      plan.universities.length === FRONTAGE_TARGET.universitySites,
      `seed ${i}: ${plan.universities.length} university sites`,
    );
    // Every square the district reserves, not only the ones something stands
    // on: the landmark sites, culture's own square and the spare squares are
    // land the sale lists never saw, and leaving them out of this sum is what
    // would let the budget drift without anything noticing. It is also what
    // caught the eleventh square arriving — this sum read 140 of 144 until
    // `cultures` joined it.
    const accounted =
      plan.residential.length +
      plan.commercial.length +
      plan.industrial.length +
      (plan.sites.length +
        plan.landmarksSmall.length +
        plan.cultures.length +
        plan.cityHalls.length +
        plan.powerPlants.length +
        plan.spareSquares.length) *
        4 +
      (plan.universities.length + plan.landmarksLarge.length) * 9 +
      plan.courtyards.length;
    assert(accounted === TARGET_PLOTS, `seed ${i}: ${accounted} plots accounted for, not ${TARGET_PLOTS}`);
    worst = Math.max(worst, plan.layout.attempts);
  }
  return `${SEEDS} districts on target, worst inner sampling ${worst} attempts`;
});

// ------------------------------------------------------------------ 9. parks

check(`parks: ${BUILDABLE_PARKS_PER_DISTRICT} a district of ${COURTYARDS} courtyard plots, never on a street, ${SEEDS} seeds`, () => {
  // Parks are the interior of a deep block — the land the frontage rule leaves
  // over. That makes them the one build list where `perimeter === 1` would be a
  // *failure*: a road-adjacent park would mean the frontage pass had missed a
  // plot it should have offered for sale.
  //
  // The courtyard list is longer than the park list at span 15: parks take the
  // front of it and the rest is spare land drawn as empty ground.
  let plots = 0;
  for (let i = 0; i < SEEDS; i++) {
    const plan = planFor(seedOf(i));
    assert(
      plan.courtyards.length === COURTYARDS,
      `seed ${i}: ${plan.courtyards.length} courtyard plots, wanted ${COURTYARDS}`,
    );

    const reserved = new Set(plan.sites.flatMap((site) => site.cells));
    const forSale = new Set([...plan.residential, ...plan.commercial, ...plan.industrial]);
    const seen = new Set();
    for (const cell of plan.courtyards) {
      assert(
        plan.layout.perimeter[cell] === 0,
        `seed ${i}: park plot ${cell} fronts a street and should have been for sale`,
      );
      assert(plan.layout.zone[cell] !== ZONE.road, `seed ${i}: park plot ${cell} is a road`);
      assert(!reserved.has(cell), `seed ${i}: park plot ${cell} is also a civic site`);
      assert(!forSale.has(cell), `seed ${i}: park plot ${cell} is also for sale`);
      assert(!seen.has(cell), `seed ${i}: park plot ${cell} listed twice`);
      seen.add(cell);
      plots++;
    }
  }
  return `${plots} courtyard plots, none of them on a street, ${BUILDABLE_PARKS_PER_DISTRICT} a district for parks`;
});

// ------------------------------------------------------------ 10. civic sites

check(`civic sites: one zone, road-adjacent, disjoint, at least 5, ${SEEDS} seeds`, () => {
  let fewest = Infinity;
  let most = 0;
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateDistrict(seedOf(i));
    const sites = civicSites(layout);
    fewest = Math.min(fewest, sites.length);
    most = Math.max(most, sites.length);
    assert(sites.length >= 5, `seed ${i}: only ${sites.length} civic sites`);

    const taken = new Set();
    for (const site of sites) {
      assert(site.cells.length === 4, `seed ${i}: site ${site.cell} is not a quad`);
      // The quad has to be a quad on the grid, not four cells that happen to be
      // listed together: lower-left, +x, +z, +x+z.
      const [a, b, c, d] = site.cells;
      assert(
        b === a + 1 && c === a + SPAN && d === a + SPAN + 1,
        `seed ${i}: site ${site.cell} is not contiguous`,
      );
      assert(site.zone !== ZONE.commercial, `seed ${i}: site ${site.cell} is on shop frontage`);
      for (const cell of site.cells) {
        assert(layout.zone[cell] === site.zone, `seed ${i}: site ${site.cell} spans two zones`);
        assert(!taken.has(cell), `seed ${i}: sites overlap at cell ${cell}`);
        taken.add(cell);
      }
      assert(
        site.cells.some((cell) => layout.perimeter[cell] === 1),
        `seed ${i}: site ${site.cell} touches no road`,
      );
    }
  }
  return `${fewest} to ${most} sites a district`;
});

check('civic sites: nothing is ever both a civic site and for sale', () => {
  for (let i = 0; i < SEEDS; i++) {
    const plan = districtPlan(generateDistrict(seedOf(i)));
    const reserved = new Set(plan.sites.flatMap((site) => site.cells));
    const forSale = [...plan.residential, ...plan.commercial, ...plan.industrial];
    for (const cell of forSale) {
      assert(!reserved.has(cell), `seed ${i}: cell ${cell} is both a civic site and for sale`);
    }
    // And the courtyards are exactly what is left, with nothing double-counted.
    const seen = new Set([...forSale, ...reserved, ...plan.courtyards]);
    assert(
      seen.size === forSale.length + reserved.size + plan.courtyards.length,
      `seed ${i}: a plot is counted twice across sale, site and courtyard`,
    );
  }
  return `${SEEDS} seeds, sale and site sets disjoint`;
});

check('civic sites: ranked so they eat dead land before they eat frontage', () => {
  // The whole point of the scoring. If a later site swallows more interior land
  // than an earlier one, the greedy pass is picking in the wrong order and the
  // sites are coming out of housing frontage instead of out of the courtyards.
  let dead = 0;
  let frontage = 0;
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateDistrict(seedOf(i));
    const sites = civicSites(layout);
    for (let k = 1; k < sites.length; k++) {
      assert(
        sites[k - 1].dead >= sites[k].dead,
        `seed ${i}: site ${k} swallows more dead land than site ${k - 1}`,
      );
    }
    for (const site of sites) {
      dead += site.dead;
      frontage += 4 - site.dead;
    }
  }
  const perDistrict = (n) => (n / SEEDS).toFixed(1);
  assert(dead > frontage / 2, 'sites are eating more frontage than they save');
  return `${perDistrict(dead)} interior and ${perDistrict(frontage)} street plots a district`;
});

// ------------------------------------------------------- 11. university sites

check(`universities: exactly one 3x3 a district, clear of everything else, ${SEEDS} seeds`, () => {
  // The check the whole land budget turns on. A university that overlapped a
  // civic site or a plot for sale would mean two buildings on one plot, and
  // because plots are derived from counts rather than stored, nothing else in
  // the game would ever notice.
  let deadTotal = 0;
  for (let i = 0; i < SEEDS; i++) {
    const plan = planFor(seedOf(i));
    assert(plan.universities.length === 1, `seed ${i}: ${plan.universities.length} universities`);
    const uni = plan.universities[0];

    assert(uni.cells.length === 9, `seed ${i}: university is not a 3x3`);
    // A 3x3 on the grid, not nine cells that happen to be listed together.
    for (let k = 0; k < 9; k++) {
      const want = uni.cell + Math.floor(k / 3) * SPAN + (k % 3);
      assert(uni.cells[k] === want, `seed ${i}: university is not contiguous at ${k}`);
    }
    assert(uni.zone !== ZONE.commercial, `seed ${i}: university sits on shop frontage`);
    for (const cell of uni.cells) {
      assert(plan.layout.zone[cell] === uni.zone, `seed ${i}: university spans two zones`);
      assert(plan.layout.zone[cell] !== ZONE.road, `seed ${i}: university cell ${cell} is a road`);
    }
    assert(
      uni.cells.some((cell) => plan.layout.perimeter[cell] === 1),
      `seed ${i}: university touches no road`,
    );

    const civic = new Set(plan.sites.flatMap((site) => site.cells));
    const forSale = new Set([...plan.residential, ...plan.commercial, ...plan.industrial]);
    const courtyards = new Set(plan.courtyards);
    for (const cell of uni.cells) {
      assert(!civic.has(cell), `seed ${i}: university cell ${cell} is also a civic site`);
      assert(!forSale.has(cell), `seed ${i}: university cell ${cell} is also for sale`);
      assert(!courtyards.has(cell), `seed ${i}: university cell ${cell} is also a courtyard`);
    }
    deadTotal += uni.dead;
  }
  return `${SEEDS} districts, ${(deadTotal / SEEDS).toFixed(1)} interior plots swallowed each`;
});

check('universities: ranked by dead land, and reserved before the 2x2 pass', () => {
  // Two properties in one sweep. The ranking is the same greedy rule civic
  // sites use, so a later site must never swallow more dead land than an
  // earlier one. And the university has to be claimed *first*: a 3x3 is far
  // rarer than a 2x2 — the fewest candidates any district offers is 3 — so a
  // civic pass that went first would fragment the only squares big enough.
  for (let i = 0; i < SEEDS; i++) {
    const layout = generateDistrict(seedOf(i));
    const unis = universitySites(layout);
    assert(unis.length >= 1, `seed ${i}: no 3x3 site anywhere in the district`);
    for (let k = 1; k < unis.length; k++) {
      assert(
        unis[k - 1].dead >= unis[k].dead,
        `seed ${i}: university site ${k} swallows more dead land than ${k - 1}`,
      );
    }
    // The chosen site is the best-ranked one, and it survives the civic pass.
    const plan = districtPlan(layout);
    assert(plan.universities[0].cell === unis[0].cell, `seed ${i}: plan took a lesser 3x3`);
  }
  return 'best 3x3 first, then the 2x2s over what is left';
});

// ---------------------------------------------------------------------- 7. perf

/** Times one district from cold, in milliseconds. */
function timePlan(seed) {
  const start = performance.now();
  planFor(seed);
  return performance.now() - start;
}

check(`perf: a district averages under ${PERF_MEAN_MS}ms, worst under ${PERF_WORST_MS}ms`, () => {
  // Warm the JIT first: the first few hundred districts are measuring the
  // optimiser rather than the generator.
  for (let i = 0; i < 200; i++) planFor(seedOf(i));
  let worst = 0;
  let total = 0;
  const suspect = [];
  for (let i = 0; i < SEEDS; i++) {
    const took = timePlan(seedOf(i));
    worst = Math.max(worst, took);
    total += took;
    if (took > PERF_WORST_MS / 3) suspect.push(i);
  }
  const mean = total / SEEDS;

  // Anything near the tail budget is timed again and its *best* time kept.
  // Repeating takes the scheduler back out — one GC pause or one preemption is
  // not a property of the code — while leaving a genuinely slow seed as slow.
  let slowest = worst;
  let slowestSeed = -1;
  if (suspect.length > 0) {
    slowest = 0;
    for (const i of suspect) {
      let best = Infinity;
      for (let run = 0; run < 3; run++) best = Math.min(best, timePlan(seedOf(i)));
      if (best > slowest) {
        slowest = best;
        slowestSeed = i;
      }
    }
  }

  assert(mean < PERF_MEAN_MS, `districts averaged ${mean.toFixed(3)}ms`);
  assert(
    slowest < PERF_WORST_MS,
    `slowest district took ${slowest.toFixed(2)}ms, best of three, at seed ${slowestSeed}`,
  );
  return (
    `mean ${mean.toFixed(3)}ms, worst ${slowest.toFixed(2)}ms ` +
    `of ${suspect.length} re-timed (${worst.toFixed(2)}ms single-sample)`
  );
});

console.log(`\n${checks} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
