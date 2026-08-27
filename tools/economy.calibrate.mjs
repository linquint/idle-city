/**
 * Measures the demand loop over 24 simulated hours under three policies, so the
 * constants in src/sim/config.ts can be set from numbers rather than from a
 * feel. Same contract as tools/citygen.calibrate.mjs: it prints, it does not
 * assert, and what it prints belongs in the config comments.
 *
 * It reports, per policy:
 *   - the longest continuous stretch each demand signal spends pinned at +-1
 *   - whether any cost curve is ever non-monotonic in n
 *   - time to first rezone, first annex, first service and the city hall
 *   - happiness at 1h / 6h / 24h
 *   - the share of income attributable to the shop multiplier at 1h / 6h / 24h,
 *     which is what stops a cheap commercial curve collapsing the game into
 *     "buy shops, ignore everything else"
 *   - what the commercial demand surcharge is doing in the opening ten minutes
 *
 *   node tools/economy.calibrate.mjs [hours]
 */
import {
  ANNEX_MIN_OCCUPANCY,
  DISTRICT_BONUS,
  FRONTAGE_TARGET,
  HOME_BASE,
  HOME_GROWTH,
  INDUSTRY_BASE,
  INDUSTRY_BONUS,
  INDUSTRY_GROWTH,
  PRICE_DISCOUNT_MAX,
  PRICE_SURCHARGE_MAX,
  SERVICES,
  SHOP_BASE,
  SHOP_BONUS,
  SHOP_GROWTH,
  LEVEL_CAPACITY,
  LEVEL_NAMES,
} from '../src/sim/config.ts';
import {
  canAnnex,
  canBuildCityHall,
  canBuildPlant,
  cityHallCost,
  plantCost,
  powerRatio,
  canBuildHome,
  canBuildIndustry,
  canBuildPark,
  canBuildService,
  canBuildShop,
  civicBuildings,
  cohortTotal,
  coverage,
  developed,
  population,
  homeCost,
  industryCost,
  parkCost,
  priceModifier,
  recreationCoverage,
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
/**
 * Auto-develop, exactly as the game plays it while you are away — once it can.
 *
 * The switch is policy and policy needs a city hall, so this policy plays the
 * opening by hand and then stops playing. Until the hall is up it buys housing,
 * which is what auto-development itself would buy at that point and what a
 * player saving for anything does; from the hall onward it touches nothing.
 *
 * Bootstrapping it is not a convenience. A policy that only flipped the switch
 * would sit at START_CASH forever now, since the switch does nothing without
 * the hall and nothing else in the policy buys anything — measured, 24 hours
 * and zero buildings. That would be a broken probe rather than a finding.
 */
const auto = (game) => {
  const s = game.state;
  if (!s.cityHall) {
    if (canBuildCityHall(s)) game.buildCityHall();
    else bootstrap(game);
    return;
  }
  if (!s.autoDevelop) game.setAutoDevelop(true);
};

/**
 * The opening, played by hand: whatever the city is short of, then housing.
 *
 * Deliberately the same priority `Game.autoDevelop` uses, because that is what
 * it is standing in for. Buying only housing was measured first and stalls at
 * four homes — the happiness gate closes with no hospital behind it, income
 * falls to the floor, and the treasury reaches 835 in twenty-four hours against
 * a hall that costs 1,500. That is the tutorial working rather than a price
 * being wrong, but it makes the probe a measurement of the tutorial instead of
 * of the hall.
 */
const bootstrap = (game) => {
  const s = game.state;
  for (let guard = 0; guard < 16; guard++) {
    let bought = false;
    if (powerRatio(s) < 1 && canBuildPlant(s)) bought = game.buildPlant();
    for (const service of SERVICES) {
      if (residents(s) > 0 && coverage(s, service) < 1 && canBuildService(s, service)) {
        bought = game.buildService(service);
        break;
      }
    }
    if (!bought && s.homes > 0 && recreationCoverage(s) < 1 && canBuildPark(s)) {
      bought = game.buildPark();
    }
    if (!bought && s.demandR >= 0 && canBuildHome(s)) bought = game.buildHome();
    if (!bought) return;
  }
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
    const options = [];
    // The hall is a purchase like any other and sits in the same pool, so what
    // the sweep measures is a player choosing it against a hospital rather than
    // one handed it for free.
    if (canBuildCityHall(s)) options.push([cityHallCost(), () => game.buildCityHall()]);
    // And a plant whenever the grid is short. A policy that ignored power would
    // measure the brownout rather than the thing it was written to measure:
    // without this, a disciplined city stalls at 626 residents and never leaves
    // towers, because the cap holds occupancy under LEVEL_UP_OCCUPANCY forever.
    if (powerRatio(s) < 1 && canBuildPlant(s)) {
      options.push([plantCost(s), () => game.buildPlant()]);
    }
    for (const service of SERVICES) {
      if (residents(s) > 0 && coverage(s, service) < 1 && canBuildService(s, service)) {
        options.push([serviceCost(s, service), () => game.buildService(service)]);
      }
    }
    // Recreation is the fourth happiness term, so a player who keeps the city
    // covered keeps it covered too.
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
    if (s.homes > 0 && recreationCoverage(s) < 1 && canBuildPark(s)) {
      options.push([0, () => game.buildPark()]);
    }
    if (canBuildCityHall(s)) options.push([0, () => game.buildCityHall()]);
    if (powerRatio(s) < 1 && canBuildPlant(s)) options.push([0, () => game.buildPlant()]);
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
 * Share of income the shop multiplier is responsible for.
 *
 * `income` is residents x RENT x (1 + SHOP_BONUS x shops + ...) x happiness, so
 * the multiplier's own terms are the only place the mix between building types
 * shows up — everything else scales all of them together. This is the number a
 * cheap commercial curve breaks: shops are the strongest multiplier in the
 * game, and an eleven-fold discount on them collapses every other decision.
 */
const shopShare = (s) => {
  const multiplier =
    1 + SHOP_BONUS * s.shops + INDUSTRY_BONUS * s.industry + DISTRICT_BONUS * (s.districts - 1);
  return (SHOP_BONUS * s.shops) / multiplier;
};

/** The opening window the demand surcharge has to still be doing something in. */
const OPENING_SECONDS = 600;

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
  const firsts = { level: null, top: null, annex: null, service: null, hall: null };
  const happy = {};
  const share = {};
  // What the surcharge is actually doing in the first ten minutes: how long
  // commerce spends oversupplied, and the worst mark-up it ever applies.
  const opening = { surchargedSeconds: 0, worstSurcharge: 0, shopsAt: 0 };
  /** Worst commercial mark-up over the whole run, to see if the cap ever binds. */
  let peakSurcharge = 0;
  let t = 0;

  while (t < SECONDS) {
    policy(game);
    game.advance(STEP);
    t += STEP;

    const s = game.state;
    pins.R.sample(s.demandR, STEP);
    pins.C.sample(s.demandC, STEP);
    pins.I.sample(s.demandI, STEP);
    if (firsts.level === null && s.homeLevels[0] < cohortTotal(s.homeLevels)) firsts.level = t;
    if (firsts.top === null && s.homeLevels[LEVEL_CAPACITY.length - 1] > 0) firsts.top = t;
    if (firsts.annex === null && s.districts > 1) firsts.annex = t;
    if (firsts.service === null && civicBuildings(s) > 0) firsts.service = t;
    if (firsts.hall === null && s.cityHall) firsts.hall = t;
    for (const mark of [3600, 6 * 3600, 24 * 3600]) {
      if (happy[mark] === undefined && t >= mark) {
        happy[mark] = s.happiness;
        share[mark] = shopShare(s);
      }
    }
    const markup = priceModifier(s.demandC) - 1;
    if (markup > peakSurcharge) peakSurcharge = markup;
    if (t <= OPENING_SECONDS) {
      if (markup > 0) {
        opening.surchargedSeconds += STEP;
        opening.worstSurcharge = Math.max(opening.worstSurcharge, markup);
      }
      opening.shopsAt = s.shops;
    }
  }
  return { game, pins, firsts, happy, share, opening, peakSurcharge };
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
  const { game, pins, firsts, happy, share, opening, peakSurcharge } = run(policy);
  const s = game.state;
  console.log(`policy: ${name}`);
  console.log(
    `  built:          ${s.homes}R / ${s.shops}C / ${s.industry}I / ` +
      `${civicBuildings(s)} civic, ${s.districts} district(s)`,
  );
  console.log(
    `  developed:      ${(developed(s) * 100).toFixed(1)}% (annex gate ${(ANNEX_MIN_OCCUPANCY * 100).toFixed(0)}%)`,
  );
  console.log(
    `  home levels:    ${JSON.stringify([...s.homeLevels])} + ${s.abandonedR} abandoned, ` +
      `occupancy R ${s.occupancyR.toFixed(2)} C ${s.occupancyC.toFixed(2)} I ${s.occupancyI.toFixed(2)}`,
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
    `  first level-up: ${fmtTime(firsts.level)}   first top level: ${fmtTime(firsts.top)}   ` +
      `first annex: ${fmtTime(firsts.annex)}   first service: ${fmtTime(firsts.service)}   ` +
      `city hall: ${fmtTime(firsts.hall)}`,
  );
  console.log(
    `  happiness:      1h ${((happy[3600] ?? 0) * 100).toFixed(0)}%  ` +
      `6h ${((happy[6 * 3600] ?? 0) * 100).toFixed(0)}%  ` +
      `24h ${((happy[24 * 3600] ?? 0) * 100).toFixed(0)}%`,
  );
  const pctShare = (mark) => `${((share[mark] ?? 0) * 100).toFixed(0)}%`;
  const overShare = [3600, 6 * 3600, 24 * 3600].some((mark) => (share[mark] ?? 0) > 0.6);
  console.log(
    `  shop multiplier: 1h ${pctShare(3600)}  6h ${pctShare(6 * 3600)}  ` +
      `24h ${pctShare(24 * 3600)} of income` +
      (overShare ? '   <- over the 60% threshold' : ''),
  );
  console.log(
    `  opening 10min:  commercial surcharged ${(opening.surchargedSeconds / 60).toFixed(1)}m, ` +
      `worst +${(opening.worstSurcharge * 100).toFixed(0)}% ` +
      `(cap +${(PRICE_SURCHARGE_MAX * 100).toFixed(0)}%), ${opening.shopsAt} shops open`,
  );
  console.log(
    `  peak surcharge: +${(peakSurcharge * 100).toFixed(0)}% over the whole run, against a ` +
      `+${(PRICE_SURCHARGE_MAX * 100).toFixed(0)}% cap` +
      (peakSurcharge >= PRICE_SURCHARGE_MAX - 1e-9 ? '   <- the cap binds' : ''),
  );
  console.log(
    `  costs at end:   home ${homeCost(s).toExponential(2)}  shop ${shopCost(s).toExponential(2)}  ` +
      `industry ${industryCost(s).toExponential(2)}  ` +
      `${SERVICES[0].key} ${serviceCost(s, SERVICES[0]).toExponential(2)}`,
  );
  console.log('');
}

/**
 * The parity the price change is aiming at: both types opening at a similar
 * price, with commerce compounding somewhat faster rather than differently.
 */
console.log('residential against commercial, undiscounted');
for (const n of [0, 5, 10, 20, 40]) {
  const home = HOME_BASE * HOME_GROWTH ** n;
  const shop = SHOP_BASE * SHOP_GROWTH ** n;
  console.log(
    `  n=${String(n).padStart(2)}  home ${home.toFixed(1).padStart(10)}  ` +
      `shop ${shop.toFixed(1).padStart(10)}  shop/home ${(shop / home).toFixed(2)}x`,
  );
}
const tenShops = (SHOP_BASE * (SHOP_GROWTH ** 10 - 1)) / (SHOP_GROWTH - 1);
console.log(
  `  first ten shops cost ${tenShops.toFixed(0)} and buy ${(SHOP_BONUS * 10).toFixed(2)}x base ` +
    `income — ${(tenShops / (SHOP_BONUS * 10)).toFixed(0)} per 1.0 of multiplier`,
);

/**
 * The plot ratio, priced.
 *
 * A district sells 28 commercial plots against 19 residential ones — 47% more
 * commerce — so a faster commercial curve compounds over 47% more buildings
 * than the residential one does. That ratio is *inverted* against ZONE_SHARE
 * (R 0.48, C 0.31), which was solved on zoned land rather than on the
 * road-adjacent land that is actually for sale, so the pricing has to be judged
 * against the frontage split and not against the zoning budget.
 */
const fill = (base, growth, plots) => (base * (growth ** plots - 1)) / (growth - 1);
const housing = fill(HOME_BASE, HOME_GROWTH, FRONTAGE_TARGET.residential);
const commerce = fill(SHOP_BASE, SHOP_GROWTH, FRONTAGE_TARGET.commercial);
console.log(
  `  filling one district: ${FRONTAGE_TARGET.residential} homes for ${housing.toFixed(0)}, ` +
    `${FRONTAGE_TARGET.commercial} shops for ${commerce.toFixed(0)} — ` +
    `commerce costs ${(commerce / housing).toFixed(1)}x housing over ` +
    `${((FRONTAGE_TARGET.commercial / FRONTAGE_TARGET.residential - 1) * 100).toFixed(0)}% more plots`,
);
console.log('');

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
function equilibrium(level) {
  // Held at `level` rather than started there: levelling is earned now, so the
  // only way to ask "what does a district of towers settle at" is to keep
  // putting the cohort back where the question wants it after every purchase.
  const game = new Game({ ...createState(0), cash: 1e12 });
  const pin = () => {
    const s = game.state;
    const standing = s.homes - s.abandonedR;
    const levels = [0, 0, 0, 0];
    levels[level] = standing;
    // Lit as well as pinned. This asks what a *demand-neutral* district settles
    // at, and a browned-out one is not demand-neutral: the power cap drags
    // commercial and industrial occupancy down, their demand targets follow, and
    // the probe buys a district's worth of shops it would never have wanted.
    // Measured without it, the towers row read 176 shops against 69.
    Object.assign(s, {
      homeLevels: levels,
      occupancyR: 0.92,
      plants: s.districts,
      plantStaff: 1,
    });
  };
  for (let step = 0; step < 400; step++) {
    pin();
    // ~12 tau, so the signal is at its target before the next decision.
    for (let i = 0; i < 3000; i++) game.advance(0.1);
    pin();
    const s = game.state;
    let bought = false;
    for (const service of SERVICES) {
      if (population(s) > 0 && coverage(s, service) < 1 && canBuildService(s, service)) {
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
  pin();
  return game.state;
}

console.log('\ndemand-neutral build-out of one district, per level held');
console.log(`  (the annexation gate is ${(ANNEX_MIN_OCCUPANCY * 100).toFixed(0)}%)`);
for (let level = 0; level < LEVEL_CAPACITY.length; level++) {
  const s = equilibrium(level);
  const pct = developed(s) * 100;
  console.log(
    `  ${LEVEL_NAMES[level].padEnd(17)} ${pct.toFixed(1).padStart(5)}%  ` +
      `${s.homes}R / ${s.shops}C / ${s.industry}I / ${civicBuildings(s)} civic, ` +
      `levels ${JSON.stringify([...s.homeLevels])}` +
      (pct >= ANNEX_MIN_OCCUPANCY * 100 ? '' : '   <- under the gate'),
  );
}
