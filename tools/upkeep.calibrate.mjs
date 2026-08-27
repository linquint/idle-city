/**
 * Measures what the wage bill is worth, so UPKEEP_RATE and UPKEEP_GROWTH can be
 * set from numbers rather than from a feel. Same contract as the other
 * calibrators: it prints, it does not assert, and what it prints belongs in the
 * config comments.
 *
 * Two measurements, and they answer different questions.
 *
 * The *open-loop* sweep is the one that picks the constants. It builds a city
 * out to its own frontage with every service the land allows, holds it at a
 * rung of the level ladder, and asks what a candidate rate would cost as a
 * share of that city's gross income. Open-loop because it has to be: at the
 * moment of choosing there is no closed loop to measure, and the answer a
 * player experiences — "how much of my ledger goes on wages" — is exactly this
 * ratio. It sweeps over city sizes as well as rates, because the whole reason
 * upkeep is scaled by `cityScale` is that a constant would only be a decision at
 * one end of the ladder.
 *
 * The *closed-loop* run is the check on the choice: the four policies from
 * tools/economy.calibrate.mjs, played for real against the configured
 * constants, reporting the upkeep share at 1h / 6h / 24h, how long any policy
 * spends unable to make its wages, and what that did to staffing.
 *
 *   node tools/upkeep.calibrate.mjs [hours]
 */
import {
  CIVIC_GROWTH,
  FRONTAGE_TARGET,
  LEVEL_NAMES,
  SERVICES,
  UPKEEP_GROWTH,
  UPKEEP_RATE,
} from '../src/sim/config.ts';
import {
  canAnnex,
  canBuildHome,
  canBuildIndustry,
  canBuildPark,
  canBuildService,
  canBuildShop,
  cityScale,
  civicBuildings,
  coverage,
  civicPayroll,
  income,
  ledgerScale,
  netIncome,
  homeCost,
  industryCost,
  parkCost,
  population,
  priceModifier,
  recreationCoverage,
  residents,
  serviceAllowed,
  serviceCost,
  serviceUpkeep,
  shopCost,
  staffing,
  upkeep,
} from '../src/sim/economy.ts';
import { Game } from '../src/sim/game.ts';
import { createState } from '../src/sim/state.ts';

const HOURS = Number(process.argv[2] ?? 24);
const STEP = 1;
const SECONDS = Math.round(HOURS * 3600);

const pct = (n) => `${(n * 100).toFixed(1)}%`;

// --------------------------------------------------------------- open loop

/** Candidate rates, spanning "invisible" to "the game is a wage bill". */
const RATES = [5e-5, 1.5e-4, 5e-4, 1.5e-3];
/** Candidate compounding, from flat to CIVIC_GROWTH's own 1.35. */
const GROWTHS = [1, 1.01, 1.02, 1.04, 1.08];
/** District counts to read each candidate at: one, the port's, and the map's. */
const SIZES = [1, 12, 49];
/** The rung the labour market clears at, and the two either side of it. */
const RUNGS = [1, 2, 4];

/**
 * A city of `districts` built out to its own frontage at `level`, with every
 * service the land allows standing and fully staffed.
 *
 * The ceiling, deliberately: upkeep is a tax on coverage, so the city to judge
 * it against is the one that bought all of it. A half-served city pays less and
 * tells you less.
 */
function builtOut(districts, level) {
  const s = createState(0);
  s.districts = districts;
  s.cash = Number.MAX_SAFE_INTEGER;

  const plots = (per) => districts * per;
  const fit = (per) => {
    // Levels 2 and up stand on two plots, so the same land holds half as many
    // buildings — the land is what is held fixed here, not the count.
    const foot = level >= 2 ? 2 : 1;
    return Math.floor(plots(per) / foot);
  };
  const cohort = (n) => {
    const levels = [0, 0, 0, 0, 0];
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
    mergedR: level >= 2 ? homes : 0,
    mergedC: level >= 2 ? shops : 0,
    mergedI: level >= 2 ? works : 0,
    occupancyR: 0.92,
    occupancyC: 0.92,
    occupancyI: 0.92,
    happiness: 1,
    parks: plots(4),
  });
  for (const service of SERVICES) {
    const allowed = serviceAllowed(s, service);
    if (service.key === 'hospital') s.hospitals = allowed;
    else if (service.key === 'police') s.police = allowed;
    else if (service.key === 'fire') s.fire = allowed;
    else if (service.key === 'school') s.schools = allowed;
    else if (service.key === 'transit') s.depots = allowed;
    else s.universities = allowed;
  }
  s.hospitalStaff = 1;
  s.policeStaff = 1;
  s.fireStaff = 1;
  s.schoolStaff = 1;
  s.universityStaff = 1;
  s.depotStaff = 1;
  return s;
}

/**
 * What a candidate rate would cost this city, as a share of its gross income.
 *
 * `upkeep` is linear in UPKEEP_RATE, so the configured reading is rescaled
 * rather than re-derived — which keeps this measuring the one thing that varies
 * and not a second copy of the formula that could drift from it.
 */
const shareAt = (s, rate, growth) =>
  (rate * civicPayroll(s, growth) * ledgerScale(s)) / income(s);

console.log(`upkeep at ${UPKEEP_RATE} a second per unit of opening price per unit of plot yield, ` +
  `compounding at ${UPKEEP_GROWTH} against CIVIC_GROWTH ${CIVIC_GROWTH}\n`);

/**
 * The rate sweep, at the growth the config is on.
 *
 * Read down a column for what a candidate costs a city, and across a row for
 * whether it goes on costing that as the city climbs — which is the property
 * that picks the scale term, not the rate.
 */
console.log('open loop: share of gross income, on cities built out and fully served');
for (const level of RUNGS) {
  console.log(`  held at ${LEVEL_NAMES[level]}`);
  console.log(`    rate       ${SIZES.map((d) => `${String(d).padStart(2)} districts`).join('   ')}`);
  for (const rate of RATES) {
    const cells = SIZES.map((d) => pct(shareAt(builtOut(d, level), rate, UPKEEP_GROWTH)).padStart(13));
    console.log(`    ${rate.toExponential(1).padStart(7)}${cells.join('  ')}`);
  }
}
console.log('');

/**
 * The growth sweep, at the rate the config is on.
 *
 * What this is judged on is flatness across the row: a growth that outruns the
 * ledger makes a big city's wage bill the whole game, and a flat one makes a
 * small city's the only one that ever mattered.
 */
console.log('open loop: the same, per UPKEEP_GROWTH, at the configured rate');
for (const level of RUNGS) {
  console.log(`  held at ${LEVEL_NAMES[level]}`);
  console.log(`    growth    ${SIZES.map((d) => `${String(d).padStart(2)} districts`).join('   ')}`);
  for (const growth of GROWTHS) {
    const cells = SIZES.map((d) => pct(shareAt(builtOut(d, level), UPKEEP_RATE, growth)).padStart(13));
    console.log(`    ${growth.toFixed(2).padStart(6)}${cells.join('  ')}`);
  }
}
console.log('');

/**
 * The constraint UPKEEP_GROWTH exists to satisfy, stated as the number it is
 * judged by: what the n-th building of a type costs to run, against what it
 * cost to open. At CIVIC_GROWTH the two curves are the same curve and the
 * second hospital is unaffordable forever.
 */
console.log('compounding: what a type\'s whole payroll costs, in first buildings');
const compounded = (g, n) => (g === 1 ? n : (g ** n - 1) / (g - 1));
console.log('    buildings    upkeep at UPKEEP_GROWTH    price at CIVIC_GROWTH');
for (const n of [1, 2, 6, 12, 30, 59]) {
  console.log(
    `    ${String(n).padStart(9)}${compounded(UPKEEP_GROWTH, n).toFixed(2).padStart(26)}` +
      `${compounded(CIVIC_GROWTH, n).toExponential(2).padStart(25)}`,
  );
}
console.log('');

/** What one service of each type costs the biggest city the map allows. */
{
  const s = builtOut(49, 4);
  console.log('per type, on a 49-district city of megastructures');
  console.log(`  gross ${income(s).toExponential(3)}/s, wages ${upkeep(s).toExponential(3)}/s, ` +
    `net ${netIncome(s).toExponential(3)}/s, cityScale ${cityScale(s).toFixed(0)}, ` +
    `ledgerScale ${ledgerScale(s).toExponential(2)}`);
  for (const service of SERVICES) {
    const built = serviceAllowed(s, service);
    console.log(
      `  ${service.key.padEnd(11)} ${String(built).padStart(3)} built  ` +
        `${serviceUpkeep(s, service).toExponential(2)}/s  ` +
        `${pct(serviceUpkeep(s, service) / upkeep(s)).padStart(7)} of the bill`,
    );
  }
  console.log('');
}

// -------------------------------------------------------------- closed loop

const idle = () => {};
const auto = (game) => {
  if (!game.state.autoDevelop) game.setAutoDevelop(true);
};

const disciplined = (game) => {
  const s = game.state;
  for (let guard = 0; guard < 64; guard++) {
    if (canAnnex(s) && game.annex()) continue;
    const options = [];
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
      if (s.demandI >= 0 && canBuildIndustry(s)) {
        options.push([industryCost(s), () => game.buildIndustry()]);
      }
    }
    if (options.length === 0) return;
    options.sort((a, b) => a[0] - b[0]);
    if (!options[0][1]()) return;
  }
};

const greedy = (game) => {
  const s = game.state;
  for (let guard = 0; guard < 64; guard++) {
    const options = [];
    if (canBuildHome(s)) options.push([priceModifier(s.demandR), () => game.buildHome()]);
    if (canBuildShop(s)) options.push([priceModifier(s.demandC), () => game.buildShop()]);
    if (canBuildIndustry(s)) options.push([priceModifier(s.demandI), () => game.buildIndustry()]);
    for (const service of SERVICES) {
      if (coverage(s, service) < 1 && canBuildService(s, service)) {
        options.push([0, () => game.buildService(service)]);
      }
    }
    if (s.homes > 0 && recreationCoverage(s) < 1 && canBuildPark(s)) {
      options.push([0, () => game.buildPark()]);
    }
    if (canAnnex(s)) options.push([-1, () => game.annex()]);
    if (options.length === 0) return;
    options.sort((a, b) => a[0] - b[0]);
    if (!options[0][1]()) return;
  }
};

const POLICIES = [
  ['idle only', idle],
  ['auto-develop', auto],
  ['greedy discount-chasing', greedy],
  ['disciplined (extra)', disciplined],
];

/**
 * The failure the bankruptcy rule has to not have: a city that cannot make its
 * wages and never climbs back out. Tracked as the longest continuous stretch
 * spent short, and the worst staffing any type reached while it was.
 */
function play(policy) {
  const game = new Game(createState(0));
  const marks = {};
  let short = 0;
  let worstShort = 0;
  let worstStaff = 1;
  let broke = 0;
  let t = 0;

  while (t < SECONDS) {
    policy(game);
    game.advance(STEP);
    t += STEP;
    const s = game.state;
    if (netIncome(s) < 0) {
      short += STEP;
      worstShort = Math.max(worstShort, short);
      for (const service of SERVICES) {
        if (s[`${service.key}Staff`] !== undefined) continue;
      }
      for (const key of ['hospital', 'police', 'fire', 'school', 'university', 'transit']) {
        if (civicBuildings(s) > 0) worstStaff = Math.min(worstStaff, staffing(s, key) || 1);
      }
    } else {
      short = 0;
    }
    if (s.cash <= 0) broke += STEP;
    for (const mark of [3600, 6 * 3600, 24 * 3600]) {
      if (marks[mark] === undefined && t >= mark) {
        marks[mark] = { gross: income(s), due: upkeep(s) };
      }
    }
  }
  return { game, marks, worstShort, worstStaff, broke };
}

console.log(`closed loop: ${HOURS}h simulated, ${STEP}s sample step`);
for (const [name, policy] of POLICIES) {
  const { game, marks, worstShort, worstStaff, broke } = play(policy);
  const s = game.state;
  const at = (mark) => {
    const m = marks[mark];
    return m === undefined || m.gross <= 0 ? '   —' : pct(m.due / m.gross).padStart(6);
  };
  console.log(`  policy: ${name}`);
  console.log(
    `    built:        ${s.homes}R / ${s.shops}C / ${s.industry}I / ${civicBuildings(s)} civic, ` +
      `${s.districts} district(s)`,
  );
  console.log(
    `    upkeep share: 1h ${at(3600)}  6h ${at(6 * 3600)}  24h ${at(24 * 3600)} of gross income`,
  );
  console.log(
    `    at the end:   gross ${income(s).toExponential(2)}/s  wages ${upkeep(s).toExponential(2)}/s  ` +
      `net ${netIncome(s).toExponential(2)}/s`,
  );
  console.log(
    `    in the red:   longest ${(worstShort / 60).toFixed(1)}m, ` +
      `${(broke / 60).toFixed(1)}m with an empty treasury, ` +
      `worst staffing while short ${pct(worstStaff)}`,
  );
  console.log(
    `    staffing now: ` +
      ['hospital', 'police', 'fire', 'school', 'university', 'transit']
        .map((key) => `${key[0]}${pct(staffing(s, key))}`)
        .join(' '),
  );
  console.log('');
}

/**
 * The one that must never fail: a city that cannot afford its only hospital has
 * to be able to climb back out. Run directly rather than inferred from the
 * policies above, because no policy above ever gets into that state on purpose.
 *
 * Two cities, because the two failures are different. The first is the opening
 * the brief names — a handful of homes and one hospital, bought the moment it
 * was affordable and unaffordable a minute later. The second is the pathological
 * one the arrears fixed point was found on: the same city holding a university
 * as well, whose base is fifty-five times a hospital's and which no city that
 * small could ever have bought.
 */
for (const [name, patch] of [
  ['a four-home city with one hospital', { hospitals: 1, hospitalStaff: 1 }],
  [
    'the same, holding a university it could never have bought',
    { hospitals: 1, hospitalStaff: 1, universities: 1, universityStaff: 1 },
  ],
]) {
  const game = new Game({
    ...createState(0),
    cash: 0,
    homes: 4,
    homeLevels: [4, 0, 0, 0, 0],
    occupancyR: 0.5,
    ...patch,
  });
  const start = netIncome(game.state);
  let worst = 1;
  const marks = [];
  for (let hour = 0; hour < 6; hour++) {
    for (let i = 0; i < 3600; i++) {
      game.advance(1);
      worst = Math.min(worst, game.state.hospitalStaff);
    }
    marks.push(game.state.cash);
  }
  const s = game.state;
  console.log(`climbing out: ${name}`);
  console.log(
    `  opened at net ${start.toFixed(3)}/s; cash by the hour ` +
      `${marks.map((c) => c.toFixed(1)).join(' ')}`,
  );
  console.log(
    `  after 6h: net ${netIncome(s).toFixed(3)}/s, hospital staffing ${pct(s.hospitalStaff)} ` +
      `(worst ${pct(worst)}), homes ${s.homes}, population ${Math.round(population(s))}`,
  );
}
