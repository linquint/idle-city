/**
 * Measures when a city actually reaches a size, so the rank thresholds can be
 * set from the clock rather than from round numbers. Same contract as the other
 * calibrators: it prints, it does not assert.
 *
 * The rule the brief states and this exists to enforce: *a rank that arrives in
 * the first ninety seconds is not a rank*. So the run is a real one — the
 * opening played the way `test/game.test.ts` plays it, and auto-development
 * from the moment the city hall is standing, which is how it is actually
 * played — and what is printed is the elapsed time at which each candidate
 * threshold falls.
 *
 * Three questions:
 *
 *   - how a city grows, minute by minute. Districts, housing plots and the
 *     population the housing is built for, sampled along one run;
 *   - when each candidate threshold falls, in elapsed game time;
 *   - what the chosen ladder gates, and when. A gate on a building nobody could
 *     afford at that point is a gate that does nothing, so the price of every
 *     gated thing is printed against the moment its rank arrives.
 *
 *   node tools/ranks.calibrate.mjs
 */
import {
  ANNEX_MIN_OCCUPANCY,
  CITY_HALL_BASE,
  FRONTAGE_TARGET,
  HIGHWAY_MIN_DISTRICTS,
  LANDMARKS,
  LEVELS,
  LEVEL_FOOTPRINT,
  MAX_DISTRICTS,
  OCCUPANCY_FULL,
  RANKS,
  SERVICES,
} from '../src/sim/config.ts';
import {
  activeDeveloped,
  canBuildCityHall,
  canBuildHome,
  canBuildIndustry,
  canBuildPark,
  canBuildPlant,
  canBuildService,
  canBuildShop,
  cityRank,
  highwayCost,
  homeCost,
  housingPlots,
  industryCost,
  landmarkCost,
  netIncome,
  parkCost,
  plantCost,
  population,
  powerRatio,
  rankAt,
  recreationCoverage,
  residents,
  serviceCost,
  capacityOf,
  demandOf,
  plotsOf,
  serviceCount,
  serviceNeeded,
  shopCost,
  upkeepReserve,
} from '../src/sim/economy.ts';
import { Game } from '../src/sim/game.ts';
import { createState } from '../src/sim/state.ts';

const LEVEL_LABELS = Array.from({ length: 5 }, (_, l) => `L${l}`);

/**
 * A city of `districts` districts built out to its own frontage at `level`.
 *
 * The same fixture the other calibrators use. Needed because the played run
 * plateaus long before the upper rungs — see part 5 — and a rung nothing can be
 * measured against is a rung nobody checked.
 */
function builtOut(districts, level) {
  const s = createState(0);
  s.districts = districts;
  const foot = LEVEL_FOOTPRINT[level] ?? 1;
  const homes = Math.floor((districts * FRONTAGE_TARGET.residential) / foot);
  const levels = new Array(LEVELS).fill(0);
  levels[level] = homes;
  Object.assign(s, {
    homes,
    homeLevels: levels,
    mergedR: foot > 1 ? homes : 0,
    occupancyR: OCCUPANCY_FULL,
  });
  return s;
}

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 2) => pad(Number(v).toFixed(d), w);
const thou = (v, w) => pad(Math.round(v).toLocaleString('en-GB'), w);

/** Elapsed seconds as m:ss, or h:mm:ss once a run runs long. */
function clock(seconds) {
  if (!Number.isFinite(seconds)) return 'never';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * One run of the game, played the way it is meant to be played.
 *
 * Before the city hall the driver *is* `autoDevelop`, written out by hand
 * because that method is private and the city has no policy to switch it on
 * with yet: a service the city is short of first, then power, then recreation,
 * then the cheapest of the three zones whose demand is not already negative,
 * and never past `upkeepReserve`. The moment the hall is affordable it is
 * bought and the real `autoDevelop` takes over, which is what a player does.
 *
 * Copying the policy rather than approximating it is the point. A driver that
 * bought a hospital whenever it could afford one measures a city being played
 * badly, and a threshold read off that is a threshold set by the driver.
 *
 * `onTick` is handed the game every tick so a caller can watch for whatever it
 * is measuring without this having to know about ranks at all.
 */
function play(seconds, dt, onTick) {
  const game = new Game(createState(0));
  let auto = false;
  for (let t = 0; t < seconds; t += dt) {
    game.advance(dt);
    const s = game.state;
    if (!auto) {
      // The hall first, because it is what hands the rest of the run over.
      if (canBuildCityHall(s) && game.buildCityHall()) {
        game.setAutoDevelop(true);
        auto = true;
      } else {
        // One purchase a tick, exactly as `autoDevelop` takes up to eight.
        for (let i = 0; i < 8; i++) if (!buyOnce(game)) break;
      }
    }
    onTick(game, t + dt);
  }
  return game;
}

/** `autoDevelop`'s pool for one purchase, hand-played. True if it bought. */
function buyOnce(game) {
  const s = game.state;
  const shortfalls = [];
  const options = [];
  if (netIncome(s) >= 0 && housingPlots(s) > 0) {
    for (const service of SERVICES) {
      if (serviceCount(s, service.key) >= serviceNeeded(s, service)) continue;
      if (!canBuildService(s, service)) continue;
      shortfalls.push([serviceCost(s, service), () => game.buildService(service)]);
    }
  }
  if (powerRatio(s) < 1 && canBuildPlant(s)) shortfalls.push([plantCost(s), () => game.buildPlant()]);
  if (s.homes > 0 && recreationCoverage(s) < 1 && canBuildPark(s)) {
    shortfalls.push([parkCost(s), () => game.buildPark()]);
  }
  if (s.demandR >= 0 && canBuildHome(s)) options.push([homeCost(s), () => game.buildHome()]);
  if (s.demandC >= 0 && canBuildShop(s)) options.push([shopCost(s), () => game.buildShop()]);
  if (s.demandI >= 0 && canBuildIndustry(s)) options.push([industryCost(s), () => game.buildIndustry()]);

  const pool = shortfalls.length > 0 ? shortfalls : options;
  let best = null;
  for (const option of pool) if (best === null || option[0] < best[0]) best = option;
  if (best === null) return false;
  // The same reserve `autoDevelop` keeps, so a city short of wages does not
  // spend its way further under.
  if (best[0] > s.cash - upkeepReserve(s)) return false;
  return best[1]() === true;
}

/** The elapsed time at which `reached(state)` first came true, or Infinity. */
function firstTime(seconds, dt, reached) {
  let at = Infinity;
  play(seconds, dt, (game, t) => {
    if (at === Infinity && reached(game.state)) at = t;
  });
  return at;
}

// A tenth of a second is the game's own tick and would be forty million steps
// over a run this long. A whole second is what `catchUp` uses for a long
// absence and is what this measures against; the difference is under a percent
// on the ledger — see test/history.test.ts.
const DT = 1;
const RUN_SECONDS = 6 * 3600;

// ------------------------------------------------------------------- part 1

console.log('how a city grows, played forward\n');
console.log('  elapsed   districts   housing plots   population   residents   rank');
{
  const marks = [60, 120, 300, 600, 1_200, 1_800, 3_600, 7_200, 10_800, 21_600];
  let next = 0;
  play(RUN_SECONDS, DT, (game, t) => {
    if (next >= marks.length || t < marks[next]) return;
    next++;
    const s = game.state;
    console.log(
      `  ${clock(t).padStart(7)}${pad(s.districts, 12)}${thou(housingPlots(s), 16)}` +
        `${thou(population(s), 13)}${thou(residents(s), 12)}   ${cityRank(s).name}`,
    );
  });
}
console.log('');

// ------------------------------------------------------------------- part 2

console.log('when each candidate threshold falls\n');
{
  const candidates = [];
  for (const people of [100, 300, 1_200, 5_000, 12_000, 60_000, 400_000]) {
    candidates.push([`population ${people.toLocaleString('en-GB')}`, (s) => population(s) >= people]);
  }
  for (const d of [2, 3, 5, 8, HIGHWAY_MIN_DISTRICTS, 28, MAX_DISTRICTS]) {
    candidates.push([`districts ${d}`, (s) => s.districts >= d]);
  }
  console.log('  threshold                reached at');
  for (const [name, reached] of candidates) {
    console.log(`  ${name.padEnd(24)}${clock(firstTime(RUN_SECONDS, DT, reached)).padStart(10)}`);
  }
}
console.log('');

// ------------------------------------------------------------------- part 3

console.log('the ladder as it stands, and when each rung arrives\n');
console.log('  rank            needs                          reached at');
for (const rank of RANKS) {
  const reached = firstTime(RUN_SECONDS, DT, (s) => cityRank(s).index >= rank.index);
  const needs =
    rank.index === 0
      ? 'nothing — every city starts here'
      : `${rank.districts} districts, ${rank.population.toLocaleString('en-GB')} people`;
  console.log(`  ${rank.name.padEnd(16)}${needs.padEnd(32)}${clock(reached).padStart(8)}`);
}
console.log('');
console.log('  A rank is the *lower* of what the two say — see `rankAt`. A single');
console.log('  district of arcologies is dense rather than large, and a sprawl of');
console.log('  bungalows is large rather than dense; neither is a metropolis.');
console.log('');

// ------------------------------------------------------------------- part 4

console.log('what each gate costs when its rank arrives, and whether it bites\n');
{
  const arrival = new Map();
  for (const rank of RANKS) {
    arrival.set(
      rank.index,
      firstTime(RUN_SECONDS, DT, (s) => cityRank(s).index >= rank.index),
    );
  }
  /** The city as it stood the moment a rank arrived, so a price can be quoted. */
  const at = (index) => {
    let found = null;
    play(RUN_SECONDS, DT, (game) => {
      if (found === null && cityRank(game.state).index >= index) found = game.state;
    });
    return found;
  };
  const museum = LANDMARKS.find((landmark) => landmark.key === 'museum');
  const stadium = LANDMARKS.find((landmark) => landmark.key === 'stadium');
  console.log('  gate         rank           rank at    price   affordable at   bites by');
  const row = (label, index, price) => {
    const rank = RANKS[index];
    if (!rank) return;
    const state = at(index);
    const cost = state ? price(state) : NaN;
    // When the city could have paid for it with the rank gate lifted. If that
    // is *later* than the rank, the gate is decoration: the price was already
    // holding the button shut and the rank never got to.
    const rich = firstTime(RUN_SECONDS, DT, (s) => s.cash >= (state ? price(s) : Infinity));
    const reached = arrival.get(index) ?? Infinity;
    const bites = Number.isFinite(rich) && Number.isFinite(reached) ? reached - rich : NaN;
    console.log(
      `  ${label.padEnd(13)}${rank.name.padEnd(14)}${clock(reached).padStart(8)}` +
        `${thou(cost, 10)}${clock(rich).padStart(15)}` +
        `${(Number.isFinite(bites) ? (bites > 0 ? clock(bites) : 'not at all') : '—').padStart(12)}`,
    );
  };
  row('city hall', rankAt('cityHall'), () => CITY_HALL_BASE);
  row('museum', rankAt('museum'), (s) => (museum ? landmarkCost(s, museum) : 0));
  row('stadium', rankAt('stadium'), (s) => (stadium ? landmarkCost(s, stadium) : 0));
  row('highway', rankAt('highway'), () => highwayCost());
  console.log('');
  console.log(`  HIGHWAY_MIN_DISTRICTS is ${HIGHWAY_MIN_DISTRICTS}, and the Conurbation rung is set to`);
  console.log('  exactly it — the rank replaces that gate rather than stacking on it, so the');
  console.log('  highway unlocks on the district count it was always calibrated at.');
}
console.log('');

// ------------------------------------------------------------------- part 5

console.log('where the played run stops, and why\n');
{
  const game = play(RUN_SECONDS, DT, () => {});
  const s = game.state;
  console.log(`  after ${clock(RUN_SECONDS)}: ${s.districts} districts, ${thou(population(s), 1)} people`);
  for (const kind of ['home', 'shop', 'industry']) {
    console.log(
      `    ${kind.padEnd(9)}demand ${fixed(demandOf(s, kind), 7, 3)}   ` +
        `${thou(plotsOf(s, kind), 5)} of ${capacityOf(s, kind)} plots`,
    );
  }
  console.log(
    `    developed ${fixed(activeDeveloped(s), 6, 3)} against ANNEX_MIN_OCCUPANCY ${ANNEX_MIN_OCCUPANCY}` +
      `, so it never annexes again`,
  );
  console.log('');
  console.log('  This plateau is not the ranks. The same driver on master at 4b9dae6 stops at');
  console.log('  the same 5 districts and the same 67,360 people: housing demand goes negative');
  console.log('  once the level ladder has housed everyone on a third of the land, and');
  console.log('  auto-development will not build into oversupply. It is why the two upper');
  console.log('  rungs are measured against built-out cities below rather than against a run,');
  console.log('  and it is why HIGHWAY_MIN_DISTRICTS was already out of an auto-developer\'s');
  console.log('  reach before any of this.');
}
console.log('');

// ------------------------------------------------------------------- part 6

console.log('the upper rungs, against a city built out to its own frontage\n');
console.log('  districts' + LEVEL_LABELS.map((l) => pad(l, 14)).join(''));
for (const districts of [1, 3, 8, HIGHWAY_MIN_DISTRICTS, 28, MAX_DISTRICTS]) {
  const row = [];
  for (let level = 0; level < LEVELS; level++) row.push(cityRank(builtOut(districts, level)).name);
  console.log(`  ${pad(districts, 9)}` + row.map((v) => pad(v, 14)).join(''));
}
console.log('');
console.log('  Read down a column: a city of bungalows is a village until it has spread.');
console.log('  Read across a row: one district of arcologies is a town and never a city,');
console.log('  which is the whole reason a rank is two thresholds rather than one.');
