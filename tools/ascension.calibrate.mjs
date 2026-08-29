/**
 * Measures what a founding is worth, so LEGACY_YIELD can be set from the guard
 * the brief names rather than from a feel. Same contract as the other
 * calibrators: it prints, it does not assert.
 *
 * The guard is time to the first annexation across successive runs, and the
 * rule is stated: *if run 3 clears its first district in under a minute, the
 * multiplier is too strong.* START_CASH is 40 and the first house is 8, so a
 * carryover that handed the second city a thousand buildings' worth of anything
 * would delete the first hour — which is the hour every constant in this game
 * is calibrated on.
 *
 * Four questions:
 *
 *   - what the multiplier is, run by run. The square root is what makes it
 *     compound slowly, and a table is the only way to see that it does;
 *   - what it does to the opening. Time to the first annexation, and to the
 *     first few after it, on runs 1, 2, 3, 5 and 20;
 *   - where the gate sits. Ascension is on the rank ladder, so this is the same
 *     arrival time `tools/ranks.calibrate.mjs` prints for that rung;
 *   - what a run is actually worth. Districts given up, against the multiplier
 *     that buys.
 *
 *   node tools/ascension.calibrate.mjs
 */
import {
  LEGACY_YIELD,
  MAX_DISTRICTS,
  RANKS,
  RANK_GATES,
  SERVICES,
} from '../src/sim/config.ts';
import {
  canAscend,
  canBuildCityHall,
  canBuildHome,
  canBuildIndustry,
  canBuildPark,
  canBuildPlant,
  canBuildService,
  canBuildShop,
  coverage,
  homeCost,
  housingPlots,
  income,
  industryCost,
  legacyMultiplier,
  netIncome,
  parkCost,
  plantCost,
  powerRatio,
  population,
  recreationCoverage,
  serviceCost,
  shopCost,
  upkeepReserve,
} from '../src/sim/economy.ts';
import { Game } from '../src/sim/game.ts';
import { createState } from '../src/sim/state.ts';

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 2) => pad(Number(v).toFixed(d), w);
const thou = (v, w) => pad(Math.round(v).toLocaleString('en-GB'), w);

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

/** `autoDevelop`'s pool for one purchase, hand-played. See ranks.calibrate.mjs. */
function buyOnce(game) {
  const s = game.state;
  const shortfalls = [];
  const options = [];
  if (netIncome(s) >= 0 && housingPlots(s) > 0) {
    for (const service of SERVICES) {
      if (coverage(s, service) >= 1 || !canBuildService(s, service)) continue;
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

  const pool = [...shortfalls, ...options];
  let best = null;
  for (const option of pool) if (best === null || option[0] < best[0]) best = option;
  if (best === null || best[0] > s.cash - upkeepReserve(s)) return false;
  return best[1]() === true;
}

/**
 * A run that starts with `legacy` districts behind it, played forward.
 *
 * Seeded directly rather than by ascending a previous run, and that is what
 * makes the table readable: what is being measured is what a *given* legacy
 * does to an opening, and reaching that legacy by playing would mix in however
 * long the run before it took.
 */
function run(legacy, seconds, dt) {
  const state = createState(0);
  state.legacy = legacy;
  state.foundings = legacy > 0 ? 2 : 1;
  const game = new Game(state);
  const districtAt = new Map([[1, 0]]);
  let auto = false;
  for (let t = 0; t < seconds; t += dt) {
    game.advance(dt);
    const s = game.state;
    if (!auto) {
      if (canBuildCityHall(s) && game.buildCityHall()) {
        game.setAutoDevelop(true);
        auto = true;
      } else {
        for (let i = 0; i < 8; i++) if (!buyOnce(game)) break;
      }
    }
    if (!districtAt.has(s.districts)) districtAt.set(s.districts, t + dt);
  }
  return { game, districtAt };
}

const DT = 1;
const RUN_SECONDS = 3 * 3600;

// ------------------------------------------------------------------- part 1

console.log('what a run is worth, and how slowly it compounds\n');
console.log('  runs   legacy   multiplier   against the run before');
{
  // A full run gives up MAX_DISTRICTS. It is the ceiling rather than the norm,
  // and it is what makes the table an upper bound on the compounding.
  let last = 1;
  for (const runs of [1, 2, 3, 5, 10, 20, 50]) {
    const legacy = (runs - 1) * MAX_DISTRICTS;
    const m = legacyMultiplier({ legacy });
    console.log(
      `  ${pad(runs, 4)}${thou(legacy, 9)}${fixed(m, 13)}${fixed(m / last, 24)}x`,
    );
    last = m;
  }
}
console.log('');
console.log(`  LEGACY_YIELD ${LEGACY_YIELD}, and the multiplier is 1 + yield * sqrt(legacy).`);
console.log('  Four full runs are twice the first, not four times it — which is the');
console.log('  square root doing the only job it has.');
console.log('');
console.log('  and what a *partial* run gives up, which is the usual case\n');
console.log('  districts at ascension   legacy after one   multiplier');
for (const districts of [3, 5, 10, 20, MAX_DISTRICTS]) {
  console.log(
    `  ${pad(districts, 22)}${thou(districts, 19)}${fixed(legacyMultiplier({ legacy: districts }), 13)}`,
  );
}
console.log('');

// ------------------------------------------------------------------- part 2

console.log('the guard: time to the first annexations, run by run\n');
console.log('  run   legacy   multiplier   district 2   district 3   district 4');
for (const [label, legacy] of [
  ['1', 0],
  ['2', MAX_DISTRICTS],
  ['3', MAX_DISTRICTS * 2],
  ['5', MAX_DISTRICTS * 4],
  ['20', MAX_DISTRICTS * 19],
]) {
  const { districtAt } = run(legacy, RUN_SECONDS, DT);
  console.log(
    `  ${label.padEnd(5)}${thou(legacy, 7)}${fixed(legacyMultiplier({ legacy }), 13)}` +
      [2, 3, 4].map((d) => clock(districtAt.get(d) ?? Infinity).padStart(13)).join(''),
  );
}
console.log('');
console.log('  The rule the brief states: if run 3 clears its first district in under a');
console.log('  minute, the multiplier is too strong. It does not, and the reason it does');
console.log('  not is that cash is only half of the gate — `activeDeveloped` has to reach');
console.log('  ANNEX_MIN_OCCUPANCY before a district can be bought at any price, so a rich');
console.log('  second city still has to build its first one out.');
console.log('');

// ------------------------------------------------------------------- part 3

console.log('when the city may be given up\n');
{
  const rank = RANKS[RANK_GATES.ascend];
  console.log(`  gate   a ${rank.name.toLowerCase()}: ${rank.districts} districts and ` +
    `${rank.population.toLocaleString('en-GB')} people`);
  const { game } = run(0, RUN_SECONDS, DT);
  const s = game.state;
  console.log(
    `  after ${clock(RUN_SECONDS)} of run 1: ${s.districts} districts, ` +
      `${thou(population(s), 1)} people, may ascend: ${canAscend(s) ? 'yes' : 'no'}`,
  );
  console.log('');
  console.log('  Same rung tools/ranks.calibrate.mjs prints as arriving at 1:57:22, which');
  console.log('  is early enough that a player who wants the loop can have it and late');
  console.log('  enough that founding again is a decision rather than a reflex.');
}
console.log('');

// ------------------------------------------------------------------- part 4

console.log('what the multiplier is worth to a settled city\n');
console.log('  run   multiplier   income at 3h        against run 1');
for (const [label, legacy] of [
  ['1', 0],
  ['2', MAX_DISTRICTS],
  ['3', MAX_DISTRICTS * 2],
  ['5', MAX_DISTRICTS * 4],
]) {
  const { game } = run(legacy, RUN_SECONDS, DT);
  const base = legacyMultiplier({ legacy: 0 });
  console.log(
    `  ${label.padEnd(5)}${fixed(legacyMultiplier({ legacy }), 12)}` +
      `${thou(income(game.state), 15)}${fixed(legacyMultiplier({ legacy }) / base, 21)}x`,
  );
}
console.log('');
console.log('  Income at three hours is not the multiplier times run 1: the run reaches a');
console.log('  different city in the same time, and where it gets to is what the');
console.log('  carryover actually buys.');
