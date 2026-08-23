/**
 * Measures the demand loop over 24 simulated hours under three policies, so the
 * constants in src/sim/config.ts can be set from numbers rather than from a
 * feel. Same contract as tools/citygen.calibrate.mjs: it prints, it does not
 * assert, and what it prints belongs in the config comments.
 *
 * It reports, per policy:
 *   - the longest continuous stretch each demand signal spends pinned at +-1
 *   - whether any cost curve is ever non-monotonic in n
 *   - time to first rezone, first annex and first service
 *   - happiness at 1h / 6h / 24h
 *
 *   node tools/economy.calibrate.mjs [hours]
 */
import {
  ANNEX_MIN_OCCUPANCY,
  HOME_BASE,
  HOME_GROWTH,
  INDUSTRY_BASE,
  INDUSTRY_GROWTH,
  PRICE_DISCOUNT_MAX,
  PRICE_SURCHARGE_MAX,
  SERVICES,
  SHOP_BASE,
  SHOP_GROWTH,
  TIERS,
} from '../src/sim/config.ts';
import {
  canAnnex,
  canBuildHome,
  canBuildIndustry,
  canBuildService,
  canBuildShop,
  canRezone,
  civicBuildings,
  coverage,
  homeCost,
  industryCost,
  occupancy,
  priceModifier,
  residents,
  serviceCost,
  shopCost,
} from '../src/sim/economy.ts';
import { Game } from '../src/sim/game.ts';
import { createState } from '../src/sim/state.ts';

const HOURS = Number(process.argv[2] ?? 24);
const STEP = 1; // seconds of simulated time per sample
const SECONDS = Math.round(HOURS * 3600);

const fmtTime = (s) =>
  s === null ? '     —' : s < 60 ? `${s.toFixed(0).padStart(4)}s` : s < 3600 ? `${(s / 60).toFixed(1).padStart(4)}m` : `${(s / 3600).toFixed(2).padStart(4)}h`;

/** Idle: never spends. The floor every other policy has to beat. */
const idle = () => {};

/** Auto-develop, exactly as the game plays it while you are away. */
const auto = (game) => {
  if (!game.state.autoDevelop) game.setAutoDevelop(true);
};

/**
 * Not one of the three the brief asks for, but the one the annexation gate has
 * to be judged against: a player who respects the demand floors — never buying
 * a type the city is oversupplied in — and who does rezone and annex when the
 * game lets them. Auto-develop deliberately never does either, so on its own it
 * cannot answer whether the gate is reachable.
 */
const disciplined = (game) => {
  const s = game.state;
  for (let guard = 0; guard < 64; guard++) {
    if (canAnnex(s) && game.annex()) continue;
    if (canRezone(s) && game.rezone()) continue;
    const options = [];
    for (const service of SERVICES) {
      if (residents(s) > 0 && coverage(s, service) < 1 && canBuildService(s, service)) {
        options.push([serviceCost(s, service), () => game.buildService(service)]);
      }
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

/**
 * The exploit policy: always buy whatever is most discounted right now, and
 * keep services just covered so the happiness cap never closes the discount.
 * If demand-responsive pricing can be farmed, this is the policy that finds it.
 */
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
    if (canRezone(s)) options.push([-1, () => game.rezone()]);
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

/** Longest continuous run, in seconds, that |d| sat at 1. */
class PinTracker {
  constructor() {
    this.run = 0;
    this.worst = 0;
  }
  sample(d, dt) {
    if (Math.abs(d) >= 0.999) {
      this.run += dt;
      this.worst = Math.max(this.worst, this.run);
    } else {
      this.run = 0;
    }
  }
}

function run(policy) {
  const game = new Game(createState(0));
  const pins = { R: new PinTracker(), C: new PinTracker(), I: new PinTracker() };
  const firsts = { rezone: null, annex: null, service: null };
  const happy = {};
  let t = 0;

  while (t < SECONDS) {
    policy(game);
    game.advance(STEP);
    t += STEP;

    const s = game.state;
    pins.R.sample(s.demandR, STEP);
    pins.C.sample(s.demandC, STEP);
    pins.I.sample(s.demandI, STEP);
    if (firsts.rezone === null && s.tier > 0) firsts.rezone = t;
    if (firsts.annex === null && s.districts > 1) firsts.annex = t;
    if (firsts.service === null && civicBuildings(s) > 0) firsts.service = t;
    for (const mark of [3600, 6 * 3600, 24 * 3600]) {
      if (happy[mark] === undefined && t >= mark) happy[mark] = s.happiness;
    }
  }
  return { game, pins, firsts, happy };
}

/**
 * The guardrail, checked directly: at maximum discount the curve must still be
 * strictly increasing in n. If this ever prints a failure, the discount has
 * been allowed to scale with something unbounded and the city builds for free.
 */
function monotonic() {
  const curves = [
    ['home', (n, d) => HOME_BASE * HOME_GROWTH ** n * priceModifier(d)],
    ['shop', (n, d) => SHOP_BASE * SHOP_GROWTH ** n * priceModifier(d)],
    ['industry', (n, d) => INDUSTRY_BASE * INDUSTRY_GROWTH ** n * priceModifier(d)],
  ];
  const breaks = [];
  for (const [name, cost] of curves) {
    for (const d of [1, 0.5, 0, -0.5, -1]) {
      for (let n = 0; n < 400; n++) {
        if (cost(n + 1, d) <= cost(n, d)) breaks.push(`${name} at n=${n}, demand ${d}`);
      }
    }
    // The case that actually matters: the *next* building bought at full
    // discount against the last one bought at full surcharge is still dearer
    // only if growth outruns the modifier band. Report the crossover either way.
    const band = (1 + PRICE_SURCHARGE_MAX) / (1 - PRICE_DISCOUNT_MAX);
    const growth = name === 'home' ? HOME_GROWTH : name === 'shop' ? SHOP_GROWTH : INDUSTRY_GROWTH;
    breaks.push(
      `  ${name}: ${Math.ceil(Math.log(band) / Math.log(growth))} buildings of progress can be undone by swinging demand`,
    );
  }
  return breaks;
}

console.log(`${HOURS}h simulated, ${STEP}s sample step\n`);

for (const [name, policy] of POLICIES) {
  const { game, pins, firsts, happy } = run(policy);
  const s = game.state;
  console.log(`policy: ${name}`);
  console.log(
    `  built:          ${s.homes}R / ${s.shops}C / ${s.industry}I / ` +
      `${civicBuildings(s)} civic, tier ${s.tier}, ${s.districts} district(s)`,
  );
  console.log(
    `  occupancy:      ${(occupancy(s) * 100).toFixed(1)}% (annex gate ${(ANNEX_MIN_OCCUPANCY * 100).toFixed(0)}%)`,
  );
  console.log(`  residents:      ${Math.round(residents(s))}, treasury ${s.cash.toExponential(2)}`);
  console.log(
    `  demand at end:  R ${s.demandR.toFixed(2)}  C ${s.demandC.toFixed(2)}  I ${s.demandI.toFixed(2)}`,
  );
  console.log(
    `  longest pin:    R ${(pins.R.worst / 60).toFixed(1)}m  C ${(pins.C.worst / 60).toFixed(1)}m  ` +
      `I ${(pins.I.worst / 60).toFixed(1)}m` +
      (Math.max(pins.R.worst, pins.C.worst, pins.I.worst) > 600 ? '   <- over the 10m threshold' : ''),
  );
  console.log(
    `  first rezone:   ${fmtTime(firsts.rezone)}   first annex: ${fmtTime(firsts.annex)}   ` +
      `first service: ${fmtTime(firsts.service)}`,
  );
  console.log(
    `  happiness:      1h ${((happy[3600] ?? 0) * 100).toFixed(0)}%  ` +
      `6h ${((happy[6 * 3600] ?? 0) * 100).toFixed(0)}%  ` +
      `24h ${((happy[24 * 3600] ?? 0) * 100).toFixed(0)}%`,
  );
  console.log(
    `  costs at end:   home ${homeCost(s).toExponential(2)}  shop ${shopCost(s).toExponential(2)}  ` +
      `industry ${industryCost(s).toExponential(2)}  ` +
      `${SERVICES[0].key} ${serviceCost(s, SERVICES[0]).toExponential(2)}`,
  );
  console.log('');
}

console.log('cost curve monotonicity in n, at every demand from +1 to -1');
for (const line of monotonic()) console.log(line.startsWith('  ') ? line : `  BROKEN: ${line}`);

/**
 * How far one district can be built out before the demand model starts
 * surcharging, per tier — with demand allowed to settle fully between
 * purchases, so the answer is the equilibrium rather than whatever a fast
 * buyer can push through the lag.
 *
 * This is the number ANNEX_MIN_OCCUPANCY has to be judged against: a gate above
 * what a tier can justify is a gate you can only pass by overbuilding into a
 * surcharge.
 */
function equilibrium(tier) {
  const game = new Game({ ...createState(0), tier, cash: 1e12 });
  for (let step = 0; step < 300; step++) {
    // ~12 tau, so the signal is at its target before the next decision.
    for (let i = 0; i < 3000; i++) game.advance(0.1);
    const s = game.state;
    let bought = false;
    for (const service of SERVICES) {
      if (residents(s) > 0 && coverage(s, service) < 1 && canBuildService(s, service)) {
        game.buildService(service);
        bought = true;
        break;
      }
    }
    if (bought) continue;
    if (s.demandR >= 0 && canBuildHome(s)) bought = game.buildHome();
    else if (s.demandC >= 0 && canBuildShop(s)) bought = game.buildShop();
    else if (s.demandI >= 0 && canBuildIndustry(s)) bought = game.buildIndustry();
    if (!bought) break;
  }
  return game.state;
}

console.log('\ndemand-neutral build-out of one district, per tier');
console.log(`  (the annexation gate is ${(ANNEX_MIN_OCCUPANCY * 100).toFixed(0)}%)`);
for (let tier = 0; tier < TIERS.length; tier++) {
  const s = equilibrium(tier);
  const pct = occupancy(s) * 100;
  console.log(
    `  ${TIERS[tier].name.padEnd(17)} ${pct.toFixed(1).padStart(5)}%  ` +
      `${s.homes}R / ${s.shops}C / ${s.industry}I / ${civicBuildings(s)} civic` +
      (pct >= ANNEX_MIN_OCCUPANCY * 100 ? '' : '   <- under the gate'),
  );
}
