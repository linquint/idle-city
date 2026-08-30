/**
 * Measures the demand model's two invariants, so DEMAND_SCALE, JOBS_LADDER and
 * SURVEY_DEMAND can be set from numbers rather than from a feel. Same contract
 * as tools/economy.calibrate.mjs: it prints, it does not assert, and what it
 * prints belongs in the config comments.
 *
 * The two questions, and why they are the two:
 *
 *   - **is it size-invariant?** A demand signal is a statement about the city's
 *     balance, and balance is a ratio, so a city in perfect proportion has to
 *     read the same at one district and at forty-nine. Every term the model
 *     divides is a city-wide total, so a scale that does not grow with the city
 *     measures an absolute imbalance against a fixed yardstick — and an
 *     absolute imbalance grows with the city by construction. That was the bug:
 *     residential pinned at -1 by the eighth district with forty-one still to
 *     annex. See `demandScale`;
 *   - **can the player move it?** A signal nobody can steer is not a mechanic,
 *     however lively it looks. Jobs used to be flat per plot while residents
 *     climbed 300x, so by the top of the ladder commerce and industry answered
 *     0.6% of the residential signal and "a mature city has to go and find them
 *     work" was a sentence the game said and the player could not act on. See
 *     JOBS_LADDER.
 *
 *   node --experimental-transform-types tools/demand.calibrate.mjs [hours]
 */
import {
  FRONTAGE_TARGET,
  JOBS_EXPONENT,
  LEVELS,
  LEVEL_FOOTPRINT,
  LEVEL_NAMES,
  SERVICES,
  SURVEY_DEMAND,
} from '../src/sim/config.ts';
import {
  canAnnex,
  canBuildCityHall,
  canBuildHome,
  canBuildIndustry,
  canBuildPark,
  canBuildPlant,
  canBuildService,
  canBuildShop,
  cityHallCost,
  cityScale,
  coverage,
  demandScale,
  demandTargets,
  homeCost,
  industryCost,
  jobs,
  parkCost,
  plantCost,
  powerRatio,
  recreationCoverage,
  reachableWorkers,
  residents,
  serviceCost,
  shopCost,
  standingPlotsOf,
  unemployment,
} from '../src/sim/economy.ts';
import { Game } from '../src/sim/game.ts';
import { cohortOf, createState } from '../src/sim/state.ts';

const HOURS = Number(process.argv[2] ?? 24);

const at = (level, count) => {
  const c = cohortOf(0);
  c[level] = count;
  return c;
};

/**
 * `districts` worth of land at FRONTAGE_TARGET's own split, built out at one
 * level, with every service the land allows.
 *
 * A city in perfect proportion, differing between rows only in how much of it
 * there is — which is what makes the first table's flatness the property worth
 * reading rather than an accident of what happened to be built.
 */
const proportioned = (districts, level, commercialShare = null) => {
  const s = createState();
  const foot = LEVEL_FOOTPRINT[level] ?? 1;
  const pool = (FRONTAGE_TARGET.residential + FRONTAGE_TARGET.commercial) * districts;
  const shopPlots =
    commercialShare === null ? FRONTAGE_TARGET.commercial * districts : Math.round(pool * commercialShare);
  const homePlots = commercialShare === null ? FRONTAGE_TARGET.residential * districts : pool - shopPlots;
  const homes = Math.max(1, Math.floor(homePlots / foot));
  const shops = Math.max(0, Math.floor(shopPlots / foot));
  const works = Math.floor((FRONTAGE_TARGET.industrial * districts) / foot);
  s.districts = districts;
  s.homes = homes;
  s.shops = shops;
  s.industry = works;
  s.homeLevels = at(level, homes);
  s.shopLevels = at(level, shops);
  s.industryLevels = at(level, works);
  s.mergedR = foot > 1 ? homes : 0;
  s.mergedC = foot > 1 ? shops : 0;
  s.mergedI = foot > 1 ? works : 0;
  s.occupancyR = 1;
  s.occupancyC = 1;
  s.occupancyI = 1;
  s.happiness = 1;
  s.hospitals = s.police = s.fire = s.schools = s.universities = s.depots = 8 * districts;
  s.wasteDepots = 4 * districts;
  s.parks = 4 * districts;
  s.museums = s.stadiums = 2 * districts;
  s.cityHall = true;
  return s;
};

const n = (v, w, d = 0) => v.toFixed(d).padStart(w);
const sig = (v) => (v < 0 ? '' : '+') + v.toFixed(3);

const TOP = LEVELS - 1;

console.log(`\nis the model size-invariant?`);
console.log(`  land at FRONTAGE_TARGET's split, built out at ${LEVEL_NAMES[TOP]}, fully served.`);
console.log(`  A city in proportion reads the same at every size, or the panel is a district counter.\n`);
console.log('  districts  R plots      jobs    workers        scale       R       C       I');
for (const k of [1, 2, 3, 5, 8, 12, 20, 30, 49]) {
  const s = proportioned(k, TOP);
  const d = demandTargets(s);
  console.log(
    `  ${n(k, 9)}  ${n(standingPlotsOf(s, 'home'), 7)}  ${n(jobs(s), 8)}  ${n(reachableWorkers(s), 9)}  ${n(demandScale(s), 11)}  ${sig(d.r).padStart(6)}  ${sig(d.c).padStart(6)}  ${sig(d.i).padStart(6)}`,
  );
}

console.log(`\nthe level arc, in one district`);
console.log(`  Young cities are job-rich and pull people in; mature ones are worker-rich and`);
console.log(`  have to go and find them work. The sign has to turn, and turn once.\n`);
console.log('  level                 residents      jobs   workers  wkr/job       R       C       I');
for (let l = 0; l < LEVELS; l++) {
  const s = proportioned(1, l);
  const d = demandTargets(s);
  console.log(
    `  ${LEVEL_NAMES[l].padEnd(20)}  ${n(residents(s), 9)}  ${n(jobs(s), 8)}  ${n(reachableWorkers(s), 8)}  ${n(reachableWorkers(s) / Math.max(1, jobs(s)), 6, 2)}x  ${sig(d.r).padStart(6)}  ${sig(d.c).padStart(6)}  ${sig(d.i).padStart(6)}`,
  );
}

console.log(`\nhow far a signal travels when a zone is genuinely short`);
console.log(`  Twelve districts at ${LEVEL_NAMES[TOP]}; the commercial share of the residential`);
console.log(`  and commercial land swept from starved to glutted. SURVEY_DEMAND is ${SURVEY_DEMAND}.\n`);
console.log('  C share  R plots  C plots  wkr/job       R       C       I');
for (const share of [0.05, 0.25, 0.45, 0.65, 0.85, 0.95]) {
  const s = proportioned(12, TOP, share);
  const d = demandTargets(s);
  const gate = (v) => (Math.abs(v) >= SURVEY_DEMAND ? '*' : ' ');
  console.log(
    `  ${n(share * 100, 6)}%  ${n(standingPlotsOf(s, 'home'), 7)}  ${n(standingPlotsOf(s, 'shop'), 7)}  ${n(reachableWorkers(s) / Math.max(1, jobs(s)), 6, 2)}x  ${sig(d.r).padStart(6)}${gate(d.r)} ${sig(d.c).padStart(6)}${gate(d.c)} ${sig(d.i).padStart(6)}${gate(d.i)}`,
  );
}
console.log(`\n  (* past SURVEY_DEMAND, so the surveyor would move land)`);

/** A player who keeps the city covered and respects the demand floors. */
const disciplined = (game) => {
  const s = game.state;
  for (let guard = 0; guard < 64; guard++) {
    if (canAnnex(s) && game.annex()) continue;
    const options = [];
    if (canBuildCityHall(s)) options.push([cityHallCost(), () => game.buildCityHall()]);
    if (powerRatio(s) < 1 && canBuildPlant(s)) options.push([plantCost(s), () => game.buildPlant()]);
    for (const service of SERVICES) {
      if (residents(s) > 0 && coverage(s, service) < 1 && canBuildService(s, service)) {
        options.push([serviceCost(s, service), () => game.buildService(service)]);
      }
    }
    if (s.homes > 0 && recreationCoverage(s) < 1 && canBuildPark(s)) {
      options.push([parkCost(s), () => game.buildPark()]);
    }
    if (options.length === 0) {
      if (s.demandR >= 0 && canBuildHome(s)) options.push([homeCost(s), () => game.buildHome()]);
      if (s.demandC >= 0 && canBuildShop(s)) options.push([shopCost(s), () => game.buildShop()]);
      if (s.demandI >= 0 && canBuildIndustry(s)) options.push([industryCost(s), () => game.buildIndustry()]);
    }
    if (options.length === 0) return;
    options.sort((a, b) => a[0] - b[0]);
    if (!options[0][1]()) return;
  }
};

const game = new Game(createState());
for (let t = 0; t < Math.round(HOURS * 3600); t++) {
  disciplined(game);
  game.step(1);
}
const settled = game.state;

/** The settled city with one zone's stock multiplied by `factor`. */
const perturbed = (levelsKey, mergedKey, countKey, factor) => {
  const s = structuredClone(settled);
  s[levelsKey] = s[levelsKey].map((c) => Math.round(c * factor));
  s[mergedKey] = Math.round(s[mergedKey] * factor);
  s[countKey] = s[levelsKey].reduce((a, b) => a + b, 0);
  return s;
};

console.log(`\ncan the player move it?`);
console.log(`  A settled ${HOURS}h disciplined city — ${settled.districts} districts, ${residents(settled).toFixed(0)} residents —`);
console.log(`  with one zone's stock halved and doubled. A column that does not move is a`);
console.log(`  button the player is pressing for nothing.\n`);
console.log('  perturbation           R plots  C plots  I plots  wkr/job    idle       R       C       I');
const row = (label, s) => {
  const d = demandTargets(s);
  console.log(
    `  ${label.padEnd(21)}  ${n(standingPlotsOf(s, 'home'), 7)}  ${n(standingPlotsOf(s, 'shop'), 7)}  ${n(standingPlotsOf(s, 'industry'), 7)}  ${n(reachableWorkers(s) / Math.max(1, jobs(s)), 6, 2)}x  ${n(unemployment(s) * 100, 5, 1)}%  ${sig(d.r).padStart(6)}  ${sig(d.c).padStart(6)}  ${sig(d.i).padStart(6)}`,
  );
};
row('as built', settled);
row('half the housing', perturbed('homeLevels', 'mergedR', 'homes', 0.5));
row('double the housing', perturbed('homeLevels', 'mergedR', 'homes', 2));
row('half the commerce', perturbed('shopLevels', 'mergedC', 'shops', 0.5));
row('double the commerce', perturbed('shopLevels', 'mergedC', 'shops', 2));
row('half the industry', perturbed('industryLevels', 'mergedI', 'industry', 0.5));
row('double the industry', perturbed('industryLevels', 'mergedI', 'industry', 2));

console.log(`\n  JOBS_EXPONENT is ${JOBS_EXPONENT}; cityScale ${cityScale(settled).toFixed(1)}, demandScale ${demandScale(settled).toFixed(0)}\n`);
