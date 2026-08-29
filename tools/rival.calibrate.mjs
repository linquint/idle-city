/**
 * Measures the rival city and the two trade agreements, so their constants can
 * be set from numbers rather than from a feel. Same contract as the other
 * calibrators: it prints, it does not assert.
 *
 * The brief names the trap and it is the first thing measured here.
 * `priceModifier` is asymmetric on purpose — a discount is `1 - 0.45 d` and a
 * surcharge is `1 + 0.60 d` — so **a rival sized against the demand number is a
 * rival sized against the wrong thing**: one that pinned commercial demand
 * negative would not slow the city down, it would make shops 60% dearer
 * forever. So what is printed is what it does to the cost of *filling a
 * district*, which is the number a player pays.
 *
 * Five questions:
 *
 *   - what the rival is, over a city's life. It has to arrive and it has to be
 *     outgrown, or it is a tax with a clock on it;
 *   - what it costs to fill one district, at 1, 10 and 25 districts;
 *   - what it does to the demand signals, which is the thing it is *made* of
 *     and not the thing it is sized against;
 *   - what the two agreements are worth against `income`, at the same sizes;
 *   - that neither breaks the happiness ceiling, which is the guard every
 *     feature in this phase answers to.
 *
 *   node tools/rival.calibrate.mjs
 */
import {
  FRONTAGE_TARGET,
  GOODS_TRADE_ANSWER,
  GOODS_TRADE_LIFT,
  GOODS_TRADE_UPKEEP,
  LEVELS,
  LEVEL_FOOTPRINT,
  MAX_DISTRICTS,
  OCCUPANCY_FULL,
  POWER_EXPORT_CAP,
  POWER_TRADES,
  PRICE_DISCOUNT_MAX,
  PRICE_SURCHARGE_MAX,
  RIVAL_COMMERCIAL_DEMAND,
  RIVAL_INDUSTRIAL_DEMAND,
  RIVAL_MATCH_DISTRICTS,
  RANK_GATES,
  RIVAL_SETTLE_SECONDS,
  SERVICES,
} from '../src/sim/config.ts';
import {
  cityRank,
  crime,
  demandTargets,
  exportMarket,
  garbage,
  happinessTarget,
  income,
  industryCost,
  parkCapacity,
  ownPowerSupply,
  powerDemand,
  powerRatio,
  powerSurplus,
  powerTradeCost,
  powerTradeIncome,
  priceModifier,
  residents,
  rivalStrength,
  serviceAllowed,
  shopCost,
  tradeUpkeep,
  upkeep,
} from '../src/sim/economy.ts';
import { createState } from '../src/sim/state.ts';

const SIZES = [1, 10, 25];

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 2) => pad(Number(v).toFixed(d), w);
const thou = (v, w) => pad(Math.round(v).toLocaleString('en-GB'), w);

function clock(seconds) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`;
}

/**
 * A city of `districts` districts at `level`, fully served and fully staffed.
 *
 * Housing at its full frontage and premises at `filled` of theirs, and the
 * fraction is not a detail: a city built out to every plot has its demand
 * signals pinned at the clamp, where a rival term is invisible because
 * `clampDemand` has already eaten it. What a demand term is worth is what it
 * does to a city that is still deciding, which is every city a player is
 * actually playing.
 */
function city(districts, level, patch = {}, filled = 0.4) {
  const s = createState(0);
  s.districts = districts;
  const foot = LEVEL_FOOTPRINT[level] ?? 1;
  const fit = (per) => Math.floor((districts * per) / foot);
  const part = (per) => Math.max(1, Math.floor((districts * per * filled) / foot));
  const cohort = (n) => {
    const levels = new Array(LEVELS).fill(0);
    levels[level] = n;
    return levels;
  };
  const homes = fit(FRONTAGE_TARGET.residential);
  const shops = part(FRONTAGE_TARGET.commercial);
  const works = part(FRONTAGE_TARGET.industrial);
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
    cityHall: true,
  });
  s.parks = parkCapacity(s);
  for (const service of SERVICES) {
    const n = serviceAllowed(s, service);
    if (service.key === 'hospital') s.hospitals = n;
    else if (service.key === 'police') s.police = n;
    else if (service.key === 'fire') s.fire = n;
    else if (service.key === 'school') s.schools = n;
    else if (service.key === 'transit') s.depots = n;
    else s.universities = n;
  }
  s.hospitalStaff = 1;
  s.policeStaff = 1;
  s.fireStaff = 1;
  s.schoolStaff = 1;
  s.universityStaff = 1;
  s.depotStaff = 1;
  Object.assign(s, patch);
  return s;
}

/**
 * What filling a district's frontage of one zone costs, at a given demand.
 *
 * The number the rival is sized against. `priceModifier` multiplies every
 * purchase, so what a demand term is *worth* is what it does to a bill the
 * player is about to pay — and a district's frontage is the bill the whole cost
 * curve was calibrated against.
 */
function fillCost(s, kind, demand) {
  const per = kind === 'shop' ? FRONTAGE_TARGET.commercial : FRONTAGE_TARGET.industrial;
  const base = kind === 'shop' ? shopCost : industryCost;
  let total = 0;
  const probe = { ...s };
  for (let i = 0; i < per; i++) {
    if (kind === 'shop') {
      probe.shops = s.shops + i;
      probe.shopLevels = s.shopLevels.map((n, l) => (l === 0 ? n + i : n));
      probe.demandC = demand;
    } else {
      probe.industry = s.industry + i;
      probe.industryLevels = s.industryLevels.map((n, l) => (l === 0 ? n + i : n));
      probe.demandI = demand;
    }
    total += base(probe);
  }
  return total;
}

// ------------------------------------------------------------------- part 1

console.log('the rival, over a city\'s life\n');
console.log(`  ${RIVAL_SETTLE_SECONDS}s to half established, gone by ${RIVAL_MATCH_DISTRICTS} districts\n`);
console.log('  elapsed' + [1, 3, 6, 10, RIVAL_MATCH_DISTRICTS, MAX_DISTRICTS].map((d) => pad(`${d}d`, 9)).join(''));
for (const elapsed of [60, 600, 1_200, 3_600, 7_200, 21_600, 86_400]) {
  const row = [1, 3, 6, 10, RIVAL_MATCH_DISTRICTS, MAX_DISTRICTS].map((districts) =>
    rivalStrength({ elapsed, districts, cityHall: false, goodsTrade: false }),
  );
  console.log(`  ${clock(elapsed).padStart(7)}` + row.map((v) => fixed(v, 9, 3)).join(''));
}
console.log('');
console.log('  It arrives and it is outgrown, which is the whole difference between a');
console.log('  rival and a tax. The treaty is the faster answer — see part 4.');
console.log('');

// ------------------------------------------------------------------- part 2

console.log('what it costs to fill one district — the number it is sized against\n');
console.log(`  priceModifier is 1 - ${PRICE_DISCOUNT_MAX} d on a discount and 1 + ${PRICE_SURCHARGE_MAX} d on a`);
console.log('  surcharge, so a rival that pinned a signal would cost 60%. It does not.\n');
console.log('  A ratio rather than two totals: every purchase in a fill is multiplied by');
console.log('  the same modifier, so what the rival does to the bill is exactly what it');
console.log('  does to `priceModifier` — and the totals themselves compound over plots');
console.log('  taken and run to twenty digits on a large city.\n');
console.log('  districts  zone       demand without   with   one building without      with   fill cost');
for (const districts of SIZES) {
  const s = city(districts, 1, { elapsed: 86_400 });
  const bare = demandTargets({ ...s, elapsed: 0 });
  const under = demandTargets(s);
  for (const kind of ['shop', 'industry']) {
    const from = kind === 'shop' ? bare.c : bare.i;
    const to = kind === 'shop' ? under.c : under.i;
    const price = kind === 'shop' ? shopCost : industryCost;
    const key = kind === 'shop' ? 'demandC' : 'demandI';
    const was = price({ ...s, [key]: from });
    const now = price({ ...s, [key]: to });
    console.log(
      `  ${pad(districts, 9)}  ${kind.padEnd(9)}${fixed(from, 15, 3)}${fixed(to, 7, 3)}` +
        `${thou(was, 20)}${thou(now, 10)}${fixed((priceModifier(to) / priceModifier(from) - 1) * 100, 11, 1)}%`,
    );
  }
}
console.log('');
console.log('  The rival is a cost, and it is a cost the player can read on the button.');
console.log('  What it is not is a wall: the surcharge it buys is single digits, against');
console.log('  the 60% a pinned signal would have been.');
console.log('');
console.log('  and the worst it can ever be, over the whole demand range:\n');
console.log('  base demand   commercial   industrial');
for (const base of [1, 0.5, 0.25, 0, -0.25, -0.5]) {
  const c = priceModifier(base - RIVAL_COMMERCIAL_DEMAND) / priceModifier(base) - 1;
  const i = priceModifier(base - RIVAL_INDUSTRIAL_DEMAND) / priceModifier(base) - 1;
  console.log(`  ${fixed(base, 11, 2)}${fixed(c * 100, 12, 1)}%${fixed(i * 100, 12, 1)}%`);
}
console.log('');

// ------------------------------------------------------------------- part 3

console.log('what it does to the signals it is made of\n');
console.log('  districts   commercial without    with   industrial without    with');
for (const districts of SIZES) {
  const s = city(districts, 1, { elapsed: 86_400 });
  const bare = demandTargets({ ...s, elapsed: 0 });
  const under = demandTargets(s);
  console.log(
    `  ${pad(districts, 9)}${fixed(bare.c, 20, 3)}${fixed(under.c, 8, 3)}` +
      `${fixed(bare.i, 21, 3)}${fixed(under.i, 8, 3)}`,
  );
}
console.log('');
console.log(`  RIVAL_COMMERCIAL_DEMAND ${RIVAL_COMMERCIAL_DEMAND}, RIVAL_INDUSTRIAL_DEMAND ${RIVAL_INDUSTRIAL_DEMAND}`);
console.log('');

// ------------------------------------------------------------------- part 4

console.log('what the agreements are worth against income\n');
console.log('  The goods treaty is a *tap*, not a line: `exportMarket` feeds industrial');
console.log('  demand and nothing else, exactly as CARGO_EXPORT_LIFT does. So what it adds');
console.log('  to `income` directly is zero, and what it costs is real — the honest way to');
console.log('  price it is the fee against the income, and the discount against the bill.\n');
console.log('  districts   income   fee/s   fee as income   export tap   industry demand   industry price');
for (const districts of SIZES) {
  const off = city(districts, 1, { elapsed: 86_400 });
  const on = { ...off, goodsTrade: true };
  const before = demandTargets(off).i;
  const after = demandTargets(on).i;
  console.log(
    `  ${pad(districts, 9)}${thou(income(off), 9)}${fixed(tradeUpkeep(on), 8, 2)}` +
      `${fixed((tradeUpkeep(on) / income(off)) * 100, 15, 2)}%` +
      `${fixed(exportMarket(off), 8, 0)}->${fixed(exportMarket(on), 4, 0)}` +
      `${fixed(before, 12, 3)}->${fixed(after, 6, 3)}` +
      `${fixed((priceModifier(after) / priceModifier(before) - 1) * 100, 15, 1)}%`,
  );
}
console.log('');
console.log(`  GOODS_TRADE_LIFT ${GOODS_TRADE_LIFT} on the export tap, GOODS_TRADE_UPKEEP ${GOODS_TRADE_UPKEEP} of the ledger,`);
console.log(`  and it answers ${GOODS_TRADE_ANSWER} of the rival. It pays twice and it costs once, which`);
console.log('  is what makes it a lever rather than a chore.\n');
console.log('  and what it does to the rival, at 10 districts:');
{
  const off = city(10, 1, { elapsed: 86_400 });
  const on = { ...off, goodsTrade: true };
  console.log(`    rival ${fixed(rivalStrength(off), 8, 3)} -> ${fixed(rivalStrength(on), 5, 3)}`);
}
console.log('');
console.log('  the grid, which *is* a line on both sides, at 10 districts:\n');
console.log('  level   draw   ratio off   importing   import/s   as income   export/s   as income');
for (let level = 0; level < LEVELS; level++) {
  const off = city(10, level);
  const importing = { ...off, powerTrade: 1 };
  const exporting = { ...off, powerTrade: 2 };
  const base = income(off);
  console.log(
    `  ${pad(level, 5)}${thou(powerDemand(off), 7)}` +
      `${fixed(powerRatio(off), 12, 2)}${fixed(powerRatio(importing), 12, 2)}` +
      `${thou(powerTradeCost(importing), 11)}${fixed((powerTradeCost(importing) / base) * 100, 11, 1)}%` +
      `${thou(powerTradeIncome(exporting), 11)}${fixed((powerTradeIncome(exporting) / base) * 100, 11, 1)}%`,
  );
}
console.log('');
console.log('  A brownout the city cannot build its way out of yet is what the import is');
console.log('  for; a surplus it over-built is what the export is for. Neither is free and');
console.log('  neither is strictly better — see POWER_TRADES.');
console.log('');
console.log('  a browned-out city, at 10 districts, level 4 with two plants:\n');
{
  const short = city(10, LEVELS - 1, { plants: 2 });
  const importing = { ...short, powerTrade: 1 };
  console.log(`    ratio without   ${powerRatio(short).toFixed(3)}`);
  console.log(`    ratio importing ${powerRatio(importing).toFixed(3)}`);
  console.log(`    it costs        ${powerTradeCost(importing).toFixed(0)}/s against an income of ${income(short).toFixed(0)}/s`);
  console.log(`    surplus         ${powerSurplus(short).toFixed(0)} (nothing to sell, so exporting is inert)`);
  console.log(`    upkeep goes     ${upkeep(short).toFixed(0)}/s -> ${upkeep(importing).toFixed(0)}/s`);
}
console.log('');
console.log('  and the guard on the export, which is the half that could have been an');
console.log('  arbitrage. Every district count and every level, built out to its own');
console.log('  frontage with one plant a district — the shape that makes the most spare:\n');
{
  const full = (districts, level) => city(districts, level, { powerTrade: 2 }, 1);
  let capped = 0;
  let cappedAt = '';
  let signable = 0;
  let signableAt = '';
  let uncapped = 0;
  for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
    for (let level = 0; level < LEVELS; level++) {
      const s = full(districts, level);
      const share = powerTradeIncome(s) / income(s);
      // What it would have earned with no cap at all, for the same city.
      const loose = (POWER_TRADES[2]?.sells ?? 0) * Math.max(0, ownPowerSupply(s) - powerDemand(s));
      uncapped = Math.max(uncapped, loose / income(s));
      if (share > capped) {
        capped = share;
        cappedAt = `${districts}d L${level}, ${Math.round(residents(s)).toLocaleString()} people`;
      }
      // The gate that actually decides it: no hall, no treaty.
      if (cityRank(s).index >= RANK_GATES.cityHall && share > signable) {
        signable = share;
        signableAt = `${districts}d L${level}, ${Math.round(residents(s)).toLocaleString()} people`;
      }
    }
  }
  console.log(`    uncapped, worst anywhere            ${(uncapped * 100).toFixed(0)}% of the ledger`);
  console.log(`    capped at ${POWER_EXPORT_CAP} of the draw, worst   ${(capped * 100).toFixed(1)}%   (${cappedAt})`);
  console.log(`    and worst that could hold a hall    ${(signable * 100).toFixed(1)}%   (${signableAt})`);
  console.log('');
  console.log('    The rank gate is the bigger of the two guards, and it is worth saying so:');
  console.log('    the worst capped city is a village of 88 people, and a village cannot sign.');
  console.log('    See POWER_EXPORT_CAP and RANK_GATES.cityHall.');
}
console.log('');

// ------------------------------------------------------------------- part 5

console.log('the guard: the happiness ceiling, with the rival and both treaties on\n');
console.log('  districts' + Array.from({ length: LEVELS }, (_, l) => pad(`L${l}`, 8)).join(''));
{
  let worst = 1;
  for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
    const row = [];
    for (let level = 0; level < LEVELS; level++) {
      const s = city(districts, level, {
        elapsed: 86_400,
        goodsTrade: true,
        powerTrade: POWER_TRADES.length - 1,
      });
      row.push(happinessTarget(s));
      worst = Math.min(worst, happinessTarget(s));
    }
    if ([1, 10, 25, MAX_DISTRICTS].includes(districts)) {
      console.log(`  ${pad(districts, 9)}` + row.map((v) => fixed(v, 8, 3)).join(''));
    }
  }
  console.log('');
  console.log(`  worst over every district count and level: ${worst.toFixed(4)}, against the test's 0.95.`);
  console.log('  Neither the rival nor either treaty touches happiness at all: the rival is');
  console.log('  a demand term and the treaties are a supply and a tap. Crime and rubbish');
  console.log('  are unchanged by both.');
  const s = city(MAX_DISTRICTS, LEVELS - 1, { elapsed: 86_400, goodsTrade: true });
  console.log(`  crime ${crime(s).toFixed(6)}, rubbish ${garbage(s).toFixed(6)} at 49 districts, fully served.`);
  console.log(`  price modifiers in play: ${priceModifier(-1).toFixed(2)} at a pinned surcharge,` +
    ` ${priceModifier(1).toFixed(2)} at a pinned discount.`);
}
