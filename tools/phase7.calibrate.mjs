/**
 * Phase 7's measurement gate, run before any of its eight features is designed.
 *
 * Same contract as every other calibrator in this directory: it prints, it does
 * not assert. Nothing here changes the build — the whole point is to find out
 * what the eight features would cost before one of them is written.
 *
 * Two parts, matching the brief:
 *
 *   0a. the civic land budget. Four of the eight want a new 2x2 civic type, and
 *       `siteCapacity` divides by `CIVIC_SERVICES.length` — so the question is
 *       not "is there a square" but "what does moving the divisor do". Sites per
 *       type, the re-derived `Service.plots` column, whether schools still land
 *       inside LEVEL_EDUCATION's window, whether the >= 0.95 happiness ceiling
 *       survives, and how many already-built buildings move or lose their site;
 *   0b. what is already built. Three of the eight are amendments to working
 *       systems rather than new systems, and the brief's stated numbers are
 *       reproduced here rather than taken on trust.
 *
 *   node tools/phase7.calibrate.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  BURN_OUT_SECONDS,
  NETWORK_EXPORT_LIFT,
  NETWORK_ROAD_SHARE,
  NETWORK_WORKFORCE,
  RANKS,
  RANK_GATES,
  TRANSIT_LINES,
  TRANSIT_MAX_SHARE,
  CIVIC_SERVICES,
  CONGESTION_DENSITY_EXPONENT,
  CONGESTION_MOOD,
  CONGESTION_SCALE,
  DEMAND_TERMS,
  EXTINGUISH_MAX,
  EXTINGUISH_MIN,
  FIRE_UNHAPPINESS,
  FREE_TRANSPORT_MOOD,
  FREE_TRANSPORT_RIDERSHIP,
  FRONTAGE_TARGET,
  GARBAGE_MOOD,
  GARBAGE_PER_RESIDENT,
  GARBAGE_PER_SHOP,
  GARBAGE_PER_WORKS,
  GARBAGE_SATURATION,
  LANDMARK_MOOD,
  LEVELS,
  LEVEL_EDUCATION,
  LEVEL_FOOTPRINT,
  MAX_DISTRICTS,
  OCCUPANCY_FULL,
  RECREATION_WEIGHT,
  ROAD_CELLS_PER_DISTRICT,
  SERVICES,
  TRANSIT_LABOUR_DRAW,
  TRANSIT_ROAD_SHARE,
  TRANSIT_WORKFORCE,
} from '../src/sim/config.ts';
import {
  activeOf,
  cityRank,
  lineAllowed,
  lineCost,
  lineRoute,
  networkCapacity,
  networkReach,
  networkService,
  cityScale,
  congestion,
  coverage,
  covered as coveredPlots,
  crimePressure,
  demandScale,
  demandTargets,
  effectiveOf,
  faresWaived,
  garbageLoad,
  garbageRate,
  housingPlots,
  jobs,
  landmarkCoverage,
  parkCapacity,
  recreationCoverage,
  residents,
  serviceAllowed,
  shortfallShare,
  taxStep,
  transitCoverage,
  trips,
  workers,
} from '../src/sim/economy.ts';
import { createState } from '../src/sim/state.ts';

const SIZES = [1, 4, 12, MAX_DISTRICTS];
const TYPE_COUNTS = [5, 6, 7, 8, 9];

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 2) => pad(Number(v).toFixed(d), w);
const pct = (v, w, d = 1) => pad(`${(v * 100).toFixed(d)}%`, w);

/** A city of `districts` districts built out at `level`, served to `serve`. */
function city(districts, level, serve = 0) {
  const s = createState(0);
  s.districts = districts;
  const foot = LEVEL_FOOTPRINT[level] ?? 1;
  const fit = (per) => Math.floor((districts * per) / foot);
  const cohort = (n) => {
    const levels = new Array(LEVELS).fill(0);
    levels[level] = n;
    return levels;
  };
  const homes = fit(FRONTAGE_TARGET.residential);
  const shops = fit(FRONTAGE_TARGET.commercial);
  const works = fit(FRONTAGE_TARGET.industrial);
  Object.assign(s, {
    homes,
    shops,
    industry: works,
    homeLevels: cohort(homes),
    shopLevels: cohort(shops),
    industryLevels: cohort(works),
    mergedR: foot > 1 ? homes : 0,
    mergedC: foot > 1 ? shops : 0,
    mergedI: foot > 1 ? works : 0,
    occupancyR: OCCUPANCY_FULL,
    occupancyC: OCCUPANCY_FULL,
    occupancyI: OCCUPANCY_FULL,
    happiness: 1,
    plants: districts,
    plantStaff: 1,
  });
  if (serve > 0) {
    s.parks = Math.round(parkCapacity(s) * serve);
    for (const service of SERVICES) {
      const n = Math.round(serviceAllowed(s, service) * serve);
      setCount(s, service.key, n);
    }
    s.hospitalStaff = 1;
    s.policeStaff = 1;
    s.fireStaff = 1;
    s.schoolStaff = 1;
    s.universityStaff = 1;
    s.depotStaff = 1;
  }
  return s;
}

function setCount(s, key, n) {
  if (key === 'hospital') s.hospitals = n;
  else if (key === 'police') s.police = n;
  else if (key === 'fire') s.fire = n;
  else if (key === 'school') s.schools = n;
  else if (key === 'transit') s.depots = n;
  else s.universities = n;
}

// ==================================================================== 0a

/**
 * Sites the `offset`-th of `n` interleaved 2x2 types gets at `districts`.
 *
 * `siteCapacity`'s own arithmetic with the divisor lifted out, so the table
 * below is the real interleave rather than a model of it.
 */
const sitesFor = (districts, offset, n) =>
  Math.max(0, Math.ceil((districts * FRONTAGE_TARGET.civicSites - offset) / n));

/**
 * The `plots` column re-derived for a table of `n` 2x2 types.
 *
 * The rule is the one SERVICES states: the hospital is the anchor and is exactly
 * full coverage when every allowed building of its type is standing, so
 * `sites/district/type x plots / 24 = 1`, and with `civicSites/n` sites a
 * district that is `plots = 24n / civicSites`. The other 2x2 rows keep their
 * ratio to the anchor, which is what preserves the weight ordering the current
 * column encodes. The university is untouched: it stands on its own 3x3 list,
 * one to a district, and the interleave never reaches it.
 */
function derivedPlots(n) {
  const anchor = (FRONTAGE_TARGET.residential * n) / FRONTAGE_TARGET.civicSites;
  const base = Object.fromEntries(SERVICES.map((x) => [x.key, x.plots]));
  const scale = anchor / base['hospital'];
  const out = {};
  for (const service of SERVICES) {
    out[service.key] =
      service.span === 3 ? service.plots : Math.round(service.plots * scale);
  }
  return { anchor, plots: out };
}

/** Schools alone, at every district count, for a candidate `plots` and divisor. */
function schoolWindow(n, plots, offset) {
  let lo = 1;
  let hi = 0;
  for (let d = 1; d <= MAX_DISTRICTS; d++) {
    const land = FRONTAGE_TARGET.residential * d;
    const allowed = Math.min(Math.floor(land / plots) + 1, sitesFor(d, offset, n));
    const cov = Math.min(1, (allowed * plots) / land);
    lo = Math.min(lo, cov);
    hi = Math.max(hi, cov);
  }
  return { lo, hi };
}

/** Every integer `plots` that keeps schools inside LEVEL_EDUCATION's window. */
function schoolCandidates(n, offset) {
  const floor = LEVEL_EDUCATION[2] ?? 0.6;
  const ceil = LEVEL_EDUCATION[3] ?? 0.85;
  const ok = [];
  for (let plots = 1; plots <= 80; plots++) {
    const { lo, hi } = schoolWindow(n, plots, offset);
    if (lo >= floor && hi < ceil) ok.push({ plots, lo, hi });
  }
  return ok;
}

/**
 * The happiness target with a re-derived civic table, in the shape
 * `happinessTarget` computes it.
 *
 * Written out here rather than imported for the reason `ceilingBefore` in
 * garbage.calibrate.mjs is: the constants it needs do not exist in the build.
 * Everything that does not depend on the civic table — the pressure behind
 * crime, the load behind rubbish, the trips behind congestion — is imported, so
 * only the coverages are modelled.
 */
function ceilingWith(s, table, n) {
  const plots = housingPlots(s);
  const cov = (key) => {
    const row = table.find((x) => x.key === key);
    if (!row) return 1;
    if (plots <= 0) return 1;
    return Math.min(1, coveredPlots(s, row) / plots);
  };
  let short = RECREATION_WEIGHT * (1 - recreationCoverage(s));
  for (const row of table) if (row.weight > 0) short += row.weight * (1 - cov(row.key));
  const earned = 1 - shortfallShare(s) * short;

  const crime = Math.max(0, crimePressure(s) * (1 - cov('police')));
  const bins = Math.max(0, garbageLoad(s) * (1 - cov('transit')));
  const carried = Math.min(
    1,
    TRANSIT_ROAD_SHARE * cov('transit') * (faresWaived(s) ? 1 + FREE_TRANSPORT_RIDERSHIP : 1),
  );
  const road = ROAD_CELLS_PER_DISTRICT * Math.max(1, s.districts);
  const density = cityScale(s) ** CONGESTION_DENSITY_EXPONENT;
  const jam = Math.max(
    0,
    Math.min(1, (trips(s) * (1 - carried)) / road / Math.max(1e-9, density) / CONGESTION_SCALE),
  );

  const policy =
    taxStep(s).mood +
    (faresWaived(s) ? FREE_TRANSPORT_MOOD : 0) +
    LANDMARK_MOOD * landmarkCoverage(s) -
    CONGESTION_MOOD * jam -
    0.26 * crime -
    GARBAGE_MOOD * bins;
  return {
    target: Math.max(0, Math.min(1, earned + policy) - FIRE_UNHAPPINESS * s.fires.length),
    cov,
    n,
  };
}

/** A city built out to the top with every 2x2 type at its allowance under `n`. */
function maxedUnder(districts, table, n) {
  const s = city(districts, LEVELS - 1, 0);
  s.parks = parkCapacity(s);
  const land = housingPlots(s);
  for (const row of table) {
    const allowed =
      row.span === 3
        ? Math.min(Math.floor(land / row.plots) + 1, districts * FRONTAGE_TARGET.universitySites)
        : Math.min(Math.floor(land / row.plots) + 1, sitesFor(districts, row.offset, n));
    setCount(s, row.key, allowed);
  }
  s.hospitalStaff = 1;
  s.policeStaff = 1;
  s.fireStaff = 1;
  s.schoolStaff = 1;
  s.universityStaff = 1;
  s.depotStaff = 1;
  return s;
}

console.log('='.repeat(78));
console.log('0a  the civic land budget');
console.log('='.repeat(78));
console.log('');
console.log(`  FRONTAGE_TARGET.squares ${FRONTAGE_TARGET.squares}: ${FRONTAGE_TARGET.civicSites} civic,` +
  ` ${FRONTAGE_TARGET.landmarkSmallSites} small landmark,` +
  ` ${FRONTAGE_TARGET.cityHallSites} city hall, ${FRONTAGE_TARGET.powerSites} power.`);
console.log(`  CIVIC_SERVICES.length ${CIVIC_SERVICES.length}:` +
  ` ${CIVIC_SERVICES.map((x) => x.key).join(', ')}`);
console.log('');

console.log('sites per district per type, and the anchor the plots column derives from\n');
console.log('  types   sites/district/type   Service.plots anchor');
for (const n of TYPE_COUNTS) {
  const { anchor } = derivedPlots(n);
  console.log(
    `  ${pad(n, 5)}${fixed(FRONTAGE_TARGET.civicSites / n, 21, 2)}${fixed(anchor, 23, 0)}`,
  );
}
console.log('');

console.log('sites each type actually receives, by district count\n');
for (const n of TYPE_COUNTS) {
  const rows = SIZES.map((d) =>
    Array.from({ length: n }, (_, offset) => sitesFor(d, offset, n)),
  );
  console.log(`  ${n} types`);
  SIZES.forEach((d, i) => {
    const row = rows[i];
    console.log(
      `    ${pad(`${d}d`, 4)}  ${pad(row.join(','), 30)}` +
        `  ${row.filter((v) => v === 0).length} type(s) with no site at all`,
    );
  });
  console.log('');
}

console.log('the re-derived plots column\n');
{
  const keys = SERVICES.map((x) => x.key);
  console.log('  types' + keys.map((k) => pad(k, 13)).join(''));
  for (const n of TYPE_COUNTS) {
    const { plots } = derivedPlots(n);
    console.log(`  ${pad(n, 5)}` + keys.map((k) => pad(plots[k], 13)).join(''));
  }
  console.log('');
  console.log('  The university column does not move: a 3x3 site, one to a district, never on');
  console.log('  the interleave. Every 2x2 row does, and each of them is a constant with its');
  console.log('  own measurement in SERVICES.');
  console.log('');
}

console.log("schools against LEVEL_EDUCATION's window: clear 0.60, miss 0.85, everywhere\n");
{
  const offset = CIVIC_SERVICES.findIndex((x) => x.key === 'school');
  console.log(`  school offset in the interleave: ${offset}`);
  console.log(`  window: [${LEVEL_EDUCATION[2]}, ${LEVEL_EDUCATION[3]})`);
  console.log('');
  console.log('  types   derived plots   in window?   every integer that works   schools alone');
  for (const n of TYPE_COUNTS) {
    const { plots } = derivedPlots(n);
    const p = plots['school'];
    const { lo, hi } = schoolWindow(n, p, offset);
    const ok = lo >= (LEVEL_EDUCATION[2] ?? 0.6) && hi < (LEVEL_EDUCATION[3] ?? 0.85);
    const cands = schoolCandidates(n, offset);
    const list = cands.length > 0 ? cands.map((c) => c.plots).join(',') : 'none';
    console.log(
      `  ${pad(n, 5)}${pad(p, 16)}${pad(ok ? 'yes' : 'NO', 13)}${pad(list, 27)}` +
        `   ${pct(lo, 6)} - ${pct(hi, 6)}`,
    );
  }
  console.log('');
}

console.log('the guard: the >= 0.95 happiness ceiling, re-run under each divisor\n');
{
  console.log('  types   worst service coverage   worst target   worst education   where');
  for (const n of TYPE_COUNTS) {
    const { plots } = derivedPlots(n);
    const offset = CIVIC_SERVICES.findIndex((x) => x.key === 'school');
    const cands = schoolCandidates(n, offset);
    const schoolPlots = cands.length > 0 ? cands[cands.length - 1].plots : plots['school'];
    const table = SERVICES.map((service, i) => ({
      ...service,
      plots: service.key === 'school' ? schoolPlots : plots[service.key],
      offset: service.span === 2 ? CIVIC_SERVICES.findIndex((x) => x.key === service.key) : -1,
    }));
    let worstCov = 1;
    let worstTarget = 1;
    let worstEdu = 1;
    let where = '';
    for (let d = 1; d <= MAX_DISTRICTS; d++) {
      const s = maxedUnder(d, table, n);
      const { target, cov } = ceilingWith(s, table, n);
      if (target < worstTarget) {
        const short = table
          .filter((row) => row.span === 2 && cov(row.key) < 0.999)
          .map((row) => `${row.key} ${(cov(row.key) * 100).toFixed(0)}%`);
        where = `${d}d` + (short.length > 0 ? `, ${short.join(' ')}` : '');
      }
      for (const row of table) {
        if (row.weight > 0 && cov(row.key) < worstCov) worstCov = cov(row.key);
      }
      const land = housingPlots(s);
      const edu =
        land > 0
          ? Math.min(
              1,
              (coveredPlots(s, table.find((x) => x.key === 'school')) +
                coveredPlots(s, table.find((x) => x.key === 'university'))) /
                land,
            )
          : 1;
      worstEdu = Math.min(worstEdu, edu);
      worstTarget = Math.min(worstTarget, target);
    }
    console.log(
      `  ${pad(n, 5)}${fixed(worstCov, 25, 4)}${fixed(worstTarget, 15, 4)}` +
        `${fixed(worstEdu, 18, 4)}   ${where}`,
    );
  }
  console.log('');
  console.log(`  test/services.test.ts asserts >= 0.95 on the first two columns and` +
    ` >= ${LEVEL_EDUCATION[LEVELS - 1]} on the third.`);
  console.log('');
}

console.log('what a divisor change does to a save that already exists\n');
{
  console.log('  A 12-district city with every 2x2 type at its current allowance, re-read');
  console.log('  under each divisor. "moves" is buildings whose square changes; "homeless"');
  console.log('  is buildings the new interleave has no site for at all.\n');
  const districts = 12;
  const s = city(districts, 2, 1);
  console.log('  types   civic buildings   moves   homeless   share moved');
  for (const n of TYPE_COUNTS) {
    let total = 0;
    let moved = 0;
    let homeless = 0;
    CIVIC_SERVICES.forEach((service, offset) => {
      const built =
        service.key === 'hospital' ? s.hospitals
        : service.key === 'police' ? s.police
        : service.key === 'fire' ? s.fire
        : service.key === 'school' ? s.schools
        : s.depots;
      const room = sitesFor(districts, offset, n);
      total += built;
      for (let i = 0; i < built; i++) {
        if (i >= room) homeless++;
        else if (i * CIVIC_SERVICES.length + offset !== i * n + offset) moved++;
      }
    });
    console.log(
      `  ${pad(n, 5)}${pad(total, 18)}${pad(moved, 8)}${pad(homeless, 11)}` +
        `${pct(total > 0 ? moved / total : 0, 14)}`,
    );
  }
  console.log('');
}

// ==================================================================== 0b

console.log('='.repeat(78));
console.log('0b  what is already built');
console.log('='.repeat(78));
console.log('');

console.log('garbage: a complete system, with a placeholder collector\n');
console.log(`  GARBAGE_MOOD ${GARBAGE_MOOD}, GARBAGE_PER_RESIDENT ${GARBAGE_PER_RESIDENT},` +
  ` GARBAGE_PER_SHOP ${GARBAGE_PER_SHOP},`);
console.log(`  GARBAGE_PER_WORKS ${GARBAGE_PER_WORKS}, GARBAGE_SATURATION ${GARBAGE_SATURATION}`);
{
  const src = readFileSync('src/sim/economy.ts', 'utf8');
  const m = src.match(/GARBAGE_COLLECTORS[^=]*=\s*(\[[^\]]*\])/);
  console.log(`  GARBAGE_COLLECTORS = ${m ? m[1] : '?'}  <- the bus depot collects the rubbish`);
}
console.log('');
console.log('  load at 10 districts, up the level ladder');
console.log('  level   rate/s   per plot    load');
for (let level = 0; level < LEVELS; level++) {
  const s = city(10, level);
  const plots = housingPlots(s);
  console.log(
    `  ${pad(level, 5)}${fixed(garbageRate(s), 9, 0)}${fixed(plots > 0 ? garbageRate(s) / plots : 0, 11, 1)}` +
      `${fixed(garbageLoad(s), 8, 3)}`,
  );
}
console.log('');
console.log('  sources at 10 districts, level 2: ' +
  (() => {
    const s = city(10, 2);
    const h = residents(s) * GARBAGE_PER_RESIDENT;
    const c = effectiveOf(s, 'shop') * GARBAGE_PER_SHOP;
    const w = activeOf(s, 'industry') * GARBAGE_PER_WORKS;
    const t = h + c + w;
    return `homes ${pct(h / t, 0, 0)}, shops ${pct(c / t, 0, 0)}, works ${pct(w / t, 0, 0)}`;
  })());
console.log('');

console.log('congestion: one city-wide scalar, with very little headroom left\n');
console.log(`  CONGESTION_SCALE ${CONGESTION_SCALE}, CONGESTION_DENSITY_EXPONENT ${CONGESTION_DENSITY_EXPONENT},` +
  ` CONGESTION_MOOD ${CONGESTION_MOOD}`);
console.log(`  TRANSIT_ROAD_SHARE ${TRANSIT_ROAD_SHARE}, FREE_TRANSPORT_RIDERSHIP ${FREE_TRANSPORT_RIDERSHIP}` +
  ` -> ${pct(TRANSIT_ROAD_SHARE * (1 + FREE_TRANSPORT_RIDERSHIP), 6, 1)} of trips off the road`);
console.log('');
console.log('  12 districts        transit-free   fully covered   covered + fares waived');
for (let level = 0; level < LEVELS; level++) {
  const bare = city(12, level);
  const full = city(12, level, 1);
  const free = city(12, level, 1);
  free.cityHall = true;
  free.freeTransport = true;
  console.log(
    `    level ${level}` + fixed(congestion(bare), 20, 3) + fixed(congestion(full), 16, 3) +
      fixed(congestion(free), 25, 3),
  );
}
console.log('');
console.log('  The last twentieth is freight and the people who will drive whatever is');
console.log('  running. Rail must not spend it — see FREE_TRANSPORT_RIDERSHIP.');
console.log('');

console.log('the transit contribution to commerce, combined — the figure rail lands on\n');
{
  const footfall = DEMAND_TERMS.find((t) => t.key === 'transit' && t.zone === 'shop');
  console.log(`  TRANSIT_LABOUR_DRAW ${TRANSIT_LABOUR_DRAW} (labourReach, in demandTargets.c)`);
  console.log(`  DEMAND_TERMS transit/shop weight ${footfall ? footfall.weight : 0}, centred` +
    ` — worth ${footfall ? (footfall.weight * 0.5).toFixed(3) : 0} at full coverage`);
  console.log('');
  console.log('  districts   level   commerce, no depots   with every depot   combined lift');
  for (const d of [4, 12, 25, MAX_DISTRICTS]) {
    for (const level of [2, 4]) {
      const bare = city(d, level, 1);
      setCount(bare, 'transit', 0);
      const full = city(d, level, 1);
      const a = demandTargets(bare).c;
      const b = demandTargets(full).c;
      console.log(
        `  ${pad(d, 9)}${pad(level, 8)}${fixed(a, 22, 3)}${fixed(b, 19, 3)}${fixed(b - a, 15, 3)}`,
      );
    }
  }
  console.log('');
  console.log('  This is the number to watch when rail lands: TRANSIT_LABOUR_DRAW was cut');
  console.log('  0.35 -> 0.30 precisely because two channels were already reaching this');
  console.log('  signal through one set of buses.');
  console.log('');
  console.log('  the spare labour rail would reach, for scale');
  console.log('  districts   level      workers        jobs   spare   x TRANSIT_WORKFORCE');
  for (const d of [4, 12, 25, MAX_DISTRICTS]) {
    const s = city(d, 4, 1);
    const w = workers(s);
    const j = jobs(s);
    console.log(
      `  ${pad(d, 9)}${pad(4, 8)}${fixed(w, 13, 0)}${fixed(j, 12, 0)}` +
        `${fixed(Math.max(0, w - j) / demandScale(s), 8, 2)}${fixed(TRANSIT_WORKFORCE, 22, 2)}`,
    );
  }
  console.log('');
}

console.log('fire: the only emergency response, and the template for a second\n');
{
  const threshold = (EXTINGUISH_MAX - BURN_OUT_SECONDS) / (EXTINGUISH_MAX - EXTINGUISH_MIN);
  console.log(`  EXTINGUISH_MAX ${EXTINGUISH_MAX}s, EXTINGUISH_MIN ${EXTINGUISH_MIN}s,` +
    ` BURN_OUT_SECONDS ${BURN_OUT_SECONDS}s`);
  console.log(`  response = ${EXTINGUISH_MAX} + (${EXTINGUISH_MIN} - ${EXTINGUISH_MAX}) x coverage`);
  console.log(`  the building is saved from ${pct(threshold, 6, 1)} coverage up` +
    '   <- quoted in three comments and one test');
  console.log('');
  console.log('  coverage   response   building');
  for (const c of [0, 0.1, threshold - 0.001, threshold, 0.5, 1]) {
    const r = EXTINGUISH_MAX + (EXTINGUISH_MIN - EXTINGUISH_MAX) * c;
    console.log(`  ${pct(c, 8, 1)}${fixed(r, 11, 1)}s   ${r > BURN_OUT_SECONDS ? 'lost' : 'saved'}`);
  }
  console.log('');
}

console.log('rail: a citygen hint and nothing else\n');
{
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) files.push(p);
    }
  };
  walk('src');
  const hits = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const n = (src.match(/RAIL_SIDE|railSide/g) ?? []).length;
    if (n > 0) hits.push(`${file} (${n})`);
  }
  console.log(`  RAIL_SIDE / railSide: ${hits.join(', ')}`);
  console.log('  No network, no track, no vehicle. It says which edge industry clusters');
  console.log('  toward and stops there.');
  console.log('');
}

console.log('population: derived, with no birth, death, age or migration anywhere\n');
{
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) files.push(p);
    }
  };
  walk('src');
  let refs = 0;
  for (const file of files) {
    refs += (readFileSync(file, 'utf8').match(/\bresidents\(|\bpopulation\(/g) ?? []).length;
  }
  // Fields, not prose: "migration" in this repo means the *save* migration and
  // "birth" is the renderer's growth clock, so a text search over the tree
  // finds twenty-five hits and none of them is a person. The honest question is
  // whether GameState carries a demographic field, and it does not.
  const state = readFileSync('src/sim/state.ts', 'utf8');
  const body = state.slice(state.indexOf('export interface GameState'));
  const fields = [...body.matchAll(/^  (\w+)[?]?:/gm)].map((m) => m[1]);
  const demographic = fields.filter((f) => /age|birth|death|cohortAge|migrat/i.test(f));
  console.log(`  population(s) = sum(homeLevels x LEVEL_HOUSING);  residents = population x occupancyR`);
  console.log(`  call sites of residents()/population(): ${refs}`);
  console.log(`  GameState fields: ${fields.length}; demographic among them: ${demographic.length}`);
  console.log('');
}

console.log('happiness: three weights summing to exactly 1, and a modifier bracket\n');
{
  const weighted = SERVICES.filter((x) => x.weight > 0);
  const sum = weighted.reduce((a, b) => a + b.weight, 0) + RECREATION_WEIGHT;
  for (const service of weighted) console.log(`  ${pad(service.key, 12)}${fixed(service.weight, 8, 2)}`);
  console.log(`  ${pad('recreation', 12)}${fixed(RECREATION_WEIGHT, 8, 2)}`);
  console.log(`  ${pad('police', 12)}${fixed(0, 8, 2)}   <- crime replaced its weight`);
  console.log(`  ${pad('sum', 12)}${fixed(sum, 8, 2)}`);
  console.log('');
  console.log('  the modifier bracket, which is where everything since the police');
  console.log('  re-calibration has landed:');
  console.log(`    crime      -${0.26}`);
  console.log(`    congestion -${CONGESTION_MOOD}`);
  console.log(`    garbage    -${GARBAGE_MOOD}`);
  console.log(`    landmark   +${LANDMARK_MOOD}`);
  console.log(`    transport  +${FREE_TRANSPORT_MOOD}`);
  console.log(`    fire       -${FIRE_UNHAPPINESS} each`);
  console.log('    tax        -0.14 .. +0.08');
  console.log('');
}

// ==================================================================== 1

console.log('='.repeat(78));
console.log('1   rail and tram');
console.log('='.repeat(78));
console.log('');

/** The same city, with `tram` tram lines and `rail` rail lines laid. */
const wired = (districts, level, serve, tram, rail) => {
  const s = city(districts, level, serve);
  s.tramLines = tram;
  s.railLines = rail;
  return s;
};

console.log('the geometry: which districts the k-th line joins\n');
{
  console.log('  Ordered by the *later* district of each pair, one pair per later end, so');
  console.log('  the list only ever grows at its end — annexing appends and re-routes');
  console.log('  nothing. The k-th line is the same line at every city size:');
  console.log('');
  console.log('       k        tram at 12d / 25d / 49d        rail at 12d / 25d / 49d');
  for (const k of [0, 1, 2, 5, 9]) {
    const show = (kind, d) => {
      const p = lineRoute({ districts: d }, kind, k);
      return pad(p ? `${p.a}-${p.b}` : '—', 8);
    };
    console.log(
      `  ${pad(k, 6)}  ${show('tram', 12)}${show('tram', 25)}${show('tram', 49)}` +
        `      ${show('rail', 12)}${show('rail', 25)}${show('rail', 49)}`,
    );
  }
  console.log('');
  console.log('  pairs the land offers, and what one kind alone can reach');
  console.log('  districts   tram pairs   rail pairs   tram lines to reach all   rail lines');
  for (const d of [2, 4, 12, 25, MAX_DISTRICTS]) {
    const bare = { districts: d, tramLines: 0, railLines: 0 };
    const need = (kind) => {
      for (let n = 0; n <= d + 2; n++) {
        const s = { districts: d, tramLines: kind === 'tram' ? n : 0, railLines: kind === 'rail' ? n : 0 };
        if (networkReach(s) >= 1) return n;
      }
      return '—';
    };
    console.log(
      `  ${pad(d, 9)}${pad(lineAllowed({ ...bare }, TRANSIT_LINES[0]) >= 0 ? tramPairs(d) : 0, 13)}` +
        `${pad(railPairs(d), 13)}${pad(need('tram'), 26)}${pad(need('rail'), 13)}`,
    );
  }
  console.log('');
}

function tramPairs(d) {
  let n = 0;
  while (lineRoute({ districts: d }, 'tram', n) !== null) n++;
  return n;
}
function railPairs(d) {
  let n = 0;
  while (lineRoute({ districts: d }, 'rail', n) !== null) n++;
  return n;
}

console.log('reach against capacity: what separates the two rungs\n');
{
  console.log(`  tram carries ${TRANSIT_LINES[0].carries} districts, rail ${TRANSIT_LINES[1].carries}` +
    ' — so a tram city saturates on capacity and a rail city on reach.');
  console.log('');
  for (const d of [12, 25]) {
    console.log(`  ${d} districts        trams only                  rail only`);
    console.log('    lines     reach  capacity   service      reach  capacity   service');
    for (const n of [1, 2, 4, 8, 12, 20, 30]) {
      const t = wired(d, 2, 0, n, 0);
      const r = wired(d, 2, 0, 0, n);
      console.log(
        `  ${pad(n, 7)}` +
          fixed(networkReach(t), 10, 2) + fixed(networkCapacity(t), 10, 2) + fixed(networkService(t), 10, 2) +
          fixed(networkReach(r), 11, 2) + fixed(networkCapacity(r), 10, 2) + fixed(networkService(r), 10, 2),
      );
    }
    console.log('');
  }
}

console.log('what a line costs, against the rank it unlocks at\n');
{
  console.log(`  RANK_GATES.tram ${RANK_GATES.tram} (${RANKS[RANK_GATES.tram].name}),` +
    ` RANK_GATES.rail ${RANK_GATES.rail} (${RANKS[RANK_GATES.rail].name})`);
  console.log('');
  console.log('  line   1st       4th        8th       16th      allowed at 12d / 25d / 49d');
  for (const line of TRANSIT_LINES) {
    const at = (n) => {
      const s = city(25, 2, 0);
      if (line.key === 'tram') s.tramLines = n; else s.railLines = n;
      return lineCost(s, line);
    };
    const room = (d) => lineAllowed({ ...city(d, 2, 0), districts: d }, line);
    console.log(
      `  ${pad(line.key, 5)}${fixed(at(0), 7, 0)}${fixed(at(3), 10, 0)}${fixed(at(7), 11, 0)}` +
        `${fixed(at(15), 11, 0)}      ${pad(room(12), 4)} /${pad(room(25), 5)} /${pad(room(49), 5)}`,
    );
  }
  console.log('');
  console.log('  against what a played run is holding (tools/economy.calibrate.mjs, 24h):');
  console.log('    auto-develop 1.3e12 at 9 districts, discount-chasing 1.4e10 at 12,');
  console.log('    disciplined 1.3e12 at 9. A museum is 4,000 and a cruise berth 20,000.');
  console.log('');
}

console.log('congestion, with the network and without\n');
{
  console.log(`  NETWORK_ROAD_SHARE ${NETWORK_ROAD_SHARE}, clamped with the bus term at` +
    ` TRANSIT_MAX_SHARE ${TRANSIT_MAX_SHARE.toFixed(3)}`);
  console.log('  — which is TRANSIT_ROAD_SHARE x (1 + FREE_TRANSPORT_RIDERSHIP), so the');
  console.log('    network cannot take a trip the fares could not already take.');
  console.log('');
  console.log('  12 districts, every depot open, fares charged');
  console.log('    level   no network   half network   full network   + fares waived');
  for (let level = 0; level < LEVELS; level++) {
    const none = city(12, level, 1);
    const half = wired(12, level, 1, 0, 3);
    const full = wired(12, level, 1, 0, 12);
    const free = wired(12, level, 1, 0, 12);
    free.cityHall = true;
    free.freeTransport = true;
    console.log(
      `    ${pad(level, 5)}` + fixed(congestion(none), 13, 3) + fixed(congestion(half), 15, 3) +
        fixed(congestion(full), 15, 3) + fixed(congestion(free), 17, 3),
    );
  }
  console.log('');
  console.log('  and with no depots at all, which is what the network is worth on its own');
  console.log('    level   nothing   full network');
  for (let level = 0; level < LEVELS; level++) {
    const none = city(12, level, 0);
    const full = wired(12, level, 0, 0, 12);
    console.log(`    ${pad(level, 5)}` + fixed(congestion(none), 10, 3) + fixed(congestion(full), 15, 3));
  }
  console.log('');
}

console.log('what a network is worth to commercial and industrial demand\n');
{
  console.log(`  NETWORK_WORKFORCE ${NETWORK_WORKFORCE} (the commerce channel),` +
    ` NETWORK_EXPORT_LIFT ${NETWORK_EXPORT_LIFT} (the freight one)`);
  console.log('');
  console.log('  districts   level   depots   network      C before    C after     I before     I after');
  for (const d of [4, 12, 25, MAX_DISTRICTS]) {
    for (const level of [2, 4]) {
      const none = city(d, level, 1);
      const full = wired(d, level, 1, 0, d);
      const a = demandTargets(none);
      const b = demandTargets(full);
      console.log(
        `  ${pad(d, 9)}${pad(level, 8)}${pad('all', 9)}${fixed(networkService(full), 9, 2)}` +
          fixed(a.c, 13, 3) + fixed(b.c, 11, 3) + fixed(a.i, 13, 3) + fixed(b.i, 12, 3),
      );
    }
  }
  console.log('');
  console.log('  the same, on a city with no depots — where the freight lift is legible');
  console.log('  districts   level   network      C before    C after     I before     I after');
  for (const d of [4, 12, 25, MAX_DISTRICTS]) {
    const none = city(d, 4, 0);
    const full = wired(d, 4, 0, 0, d);
    const a = demandTargets(none);
    const b = demandTargets(full);
    console.log(
      `  ${pad(d, 9)}${pad(4, 8)}${fixed(networkService(full), 9, 2)}` +
        fixed(a.c, 13, 3) + fixed(b.c, 11, 3) + fixed(a.i, 13, 3) + fixed(b.i, 12, 3),
    );
  }
  console.log('');
}
