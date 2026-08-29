import { describe, expect, it } from 'vitest';
import {
  ANNEX_MIN_OCCUPANCY,
  FRONTAGE_TARGET,
  LAND_VALUE_SPREAD,
  HOME_BASE,
  INDUSTRY_BASE,
  LEVEL_CAPACITY,
  LEVEL_HOUSING,
  MAX_DISTRICTS,
  SHOP_BASE,
  SHOP_BONUS,
} from '../src/sim/config';
import {
  annexBlocker,
  buildingIncome,
  canAnnex,
  canBuildHome,
  canBuildIndustry,
  canBuildShop,
  civicSiteCapacity,
  developed,
  universitySiteCapacity,
  homeCapacity,
  homeCost,
  income,
  industryCapacity,
  industryCost,
  landValue,
  parcelLandValue,
  plotCapacity,
  plotsUsed,
  residents,
  shopCapacity,
  shopCost,
} from '../src/sim/economy';
import {
  BUILDABLE_COMMERCIAL_PER_DISTRICT,
  BUILDABLE_INDUSTRIAL_PER_DISTRICT,
  BUILDABLE_RESIDENTIAL_PER_DISTRICT,
  CIVIC_SITES_PER_DISTRICT,
  housingCentrality,
  PLOTS_PER_DISTRICT,
  UNIVERSITY_SITES_PER_DISTRICT,
} from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { built, housed, making, mix, trading, zonedAt, zoning } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

describe('costs', () => {
  it('starts at the base price and compounds', () => {
    expect(homeCost(state({ homes: 0 }))).toBe(HOME_BASE);
    expect(homeCost(state({ homes: 10 }))).toBeGreaterThan(homeCost(state({ homes: 9 })));
  });

  it('is the bare base price at neutral demand, for every type', () => {
    // A fresh city sits at zero demand everywhere, so the opening prices are
    // exactly the constants — no hidden discount to explain away.
    expect(homeCost(state())).toBe(HOME_BASE);
    expect(shopCost(state())).toBe(SHOP_BASE);
    expect(industryCost(state())).toBe(INDUSTRY_BASE);
  });

  it('discounts what the city wants and surcharges what it has too much of', () => {
    expect(homeCost(state({ homes: 5, demandR: 0.8 }))).toBeLessThan(homeCost(state({ homes: 5 })));
    expect(shopCost(state({ shops: 5, demandC: -0.8 }))).toBeGreaterThan(shopCost(state({ shops: 5 })));
  });
});

/**
 * Housing and commerce are two curves out of one starting price now, rather
 * than two different games. A shop used to open at 11.3x a house and reach
 * 43.7x by the twentieth of each, which made commerce something you unlocked;
 * it opens at 1.375x and stays there, which makes it something you choose.
 *
 * "Stays there" is measured per *share of the land the zone is given*, not per
 * count, and that is the change this block last took. A district sells 45
 * commercial plots against 24 residential, so matching the two growth rates
 * charged commerce `1.14 ** 45` to fill a district against housing's
 * `1.14 ** 24` — 16x, compounding again with every district the city took, and
 * a built city could no longer afford the one thing its own demand panel was
 * asking for. Both zones fill a district for the same multiple now. See
 * DISTRICT_FILL_MULTIPLE.
 *
 * Undiscounted throughout: a fresh city sits at zero demand, so these are the
 * constants themselves and not what a demand swing did to them.
 */
describe('residential and commercial parity', () => {
  const home = (n: number): number => homeCost(state({ homes: n }));
  const shop = (n: number): number => shopCost(state({ shops: n }));

  it('opens both types within a third of each other', () => {
    const gap = Math.abs(shop(0) - home(0)) / Math.max(shop(0), home(0));
    expect(gap).toBeLessThanOrEqual(1 / 3);
  });

  /**
   * The price *order* being constant is what a discount-chasing player is held
   * up by: they buy whatever is cheapest, so a curve that crosses housing's is
   * a curve that eventually makes shops the only thing worth buying — measured,
   * one such pair stalled that policy at 15 shops, four homes and no hospital
   * it could ever save up for.
   *
   * What that order is measured over is the share of the land each zone is
   * given, not the count. The two are the same thing only while a district
   * sells both zones the same number of plots, and it does not: 45 against 24.
   * So the sixth shop and the sixth house are an eighth of a district's
   * commerce against a quarter of its housing, and comparing them was standing
   * in for this. At equal share the ratio is exactly the ratio of the two bases,
   * at every share, and it never crosses.
   *
   * The raw order does cross, from the sixth of each on, and that is stated
   * rather than hidden — see SHOP_BASE, where the livelock above was re-measured
   * against the crossing curve rather than assumed away.
   */
  it('keeps commerce dearer than housing at every share of its own land', () => {
    // Thirds, because 45 and 24 are both divisible by 3 and a share has to land
    // on a whole plot in each zone to be a price at all.
    const steps = 3;
    const shopsPer = FRONTAGE_TARGET.commercial / steps;
    const homesPer = FRONTAGE_TARGET.residential / steps;
    expect(Number.isInteger(shopsPer) && Number.isInteger(homesPer)).toBe(true);
    for (let k = 0; k <= steps; k++) {
      expect(shop(shopsPer * k)).toBeGreaterThan(home(homesPer * k));
      expect(shop(shopsPer * k) / home(homesPer * k)).toBeCloseTo(SHOP_BASE / HOME_BASE, 9);
    }
  });

  /**
   * The trap every commercial rebalance has to avoid. Cheap shops are only a
   * rebalance if what they buy is priced against them; left alone, the strongest
   * income multiplier in the game goes on sale and the opening collapses into
   * one button.
   *
   * The floor has real margin at neither end now, and that is deliberate: the
   * flatter curve puts ten shops at 307 per 1.0 of SHOP_BONUS against the 425
   * the last rebalance aimed at, so this assertion is a canary rather than a
   * bound with room in it. Anything that lowers SHOP_BASE or flattens the curve
   * further has to come back here and answer for it. SHOP_BASE carries what was
   * measured instead — the shop multiplier's share of income, which is what
   * "collapses into one button" actually looks like in a 24-hour run.
   */
  it('keeps the price of the shop multiplier from collapsing', () => {
    const tenShops = Array.from({ length: 10 }, (_, n) => shop(n)).reduce((a, b) => a + b, 0);
    const perMultiplier = tenShops / (SHOP_BONUS * 10);
    // Cheaper than it was — 1,433 — because that was the point, but nowhere
    // near the 118 that leaving SHOP_BONUS at 0.18 would have made it.
    expect(perMultiplier).toBeGreaterThan(300);
    expect(perMultiplier).toBeLessThan(1_433);
  });

  /**
   * A district sells 45 commercial plots against 24 residential, so commerce is
   * the expensive half by *count* and by nothing else — each shop is 1.375
   * houses and there are 88% more of them, which multiplies out to about 2.6x.
   * That is what stops "shops are cheap now" becoming "shops are free", and it
   * is a bound the plot split can be read straight off.
   *
   * The upper bound is the one that moved and it is the point of the change:
   * this used to read 22.5x, because the two zones filled a district for
   * `1.14 ** 45` against `1.14 ** 24`, and an exponent charged for the width of
   * a frontage is a gap that compounds with every district rather than a price.
   * A ceiling of 4x is what says the gap now lives on the base.
   */
  it('leaves commerce the dearer half of a district to fill', () => {
    const fill = (cost: (n: number) => number, plots: number): number =>
      Array.from({ length: plots }, (_, n) => cost(n)).reduce((a, b) => a + b, 0);
    const housing = fill(home, FRONTAGE_TARGET.residential);
    const commerce = fill(shop, FRONTAGE_TARGET.commercial);
    expect(FRONTAGE_TARGET.commercial).toBeGreaterThan(FRONTAGE_TARGET.residential);
    // More than the plot count alone would give, because each of them is 1.375
    // houses, and less than the base ratio times the count with room to spare.
    expect(commerce / housing).toBeGreaterThan(
      FRONTAGE_TARGET.commercial / FRONTAGE_TARGET.residential,
    );
    expect(commerce / housing).toBeLessThan(4);
  });
});

describe('income', () => {
  it('is zero with nobody living there', () => {
    expect(income(state())).toBe(0);
  });

  it('counts residents cohort by cohort', () => {
    for (let level = 0; level < LEVEL_CAPACITY.length; level++) {
      // Per building, so a merged level counts its whole footprint's worth.
      expect(residents(state(housed(10, level)))).toBe(10 * (LEVEL_HOUSING[level] ?? 0));
    }
    // And a mixed skyline is the sum of its parts rather than one global level,
    // which is the whole thing cohorts buy over the tier they replaced.
    const mixed = state({ homes: 10, homeLevels: mix(4, 3, 2, 1), occupancyR: 1 });
    expect(residents(mixed)).toBe(
      4 * (LEVEL_HOUSING[0] ?? 0) +
        3 * (LEVEL_HOUSING[1] ?? 0) +
        2 * (LEVEL_HOUSING[2] ?? 0) +
        1 * (LEVEL_HOUSING[3] ?? 0),
    );
  });

  it('rises with shops and with districts', () => {
    const base = state({ ...housed(20), cash: 0 });
    expect(income({ ...base, ...trading(5) })).toBeGreaterThan(income(base));
    expect(income({ ...base, districts: 3 })).toBeGreaterThan(income(base));
  });
});

describe('capacity', () => {
  it('scales linearly with annexed districts', () => {
    const one = plotCapacity(state({ districts: 1 }));
    expect(plotCapacity(state({ districts: 4 }))).toBe(one * 4);
  });

  it('counts industrial land and every kind of site, not just what is for sale', () => {
    const s = state();
    expect(plotCapacity(s)).toBe(
      homeCapacity(s) +
        shopCapacity(s) +
        industryCapacity(s) +
        civicSiteCapacity(s) +
        universitySiteCapacity(s),
    );
    expect(industryCapacity(s)).toBeGreaterThan(0);
    expect(civicSiteCapacity(s)).toBeGreaterThan(0);
    expect(universitySiteCapacity(s)).toBe(1);
  });

  it('is a share of the plots that front a street, not of the zoned land', () => {
    // The distinction the renamed constants exist to keep straight: a district
    // is zoned for 144 plots and sells 82 of them, because a building has to
    // have a street to stand on and the rest of the land is held in squares —
    // six 2x2 for civic use, one 3x3 for the university, two more for landmarks
    // and two 2x2s spare. A site holds one building however many plots it
    // covers, so the seven civic and university sites add seven to what the
    // city can develop.
    const s = state();
    const sale =
      BUILDABLE_RESIDENTIAL_PER_DISTRICT +
      BUILDABLE_COMMERCIAL_PER_DISTRICT +
      BUILDABLE_INDUSTRIAL_PER_DISTRICT;
    expect(homeCapacity(s) + shopCapacity(s) + industryCapacity(s)).toBe(sale);
    expect(plotCapacity(s)).toBe(sale + CIVIC_SITES_PER_DISTRICT + UNIVERSITY_SITES_PER_DISTRICT);
    expect(plotCapacity(s)).toBeLessThan(PLOTS_PER_DISTRICT);
  });

  it('counts every kind of building against the same total', () => {
    const s = state({ ...built(3, 2, 4), hospitals: 1, police: 1 });
    expect(plotsUsed(s)).toBe(11);
    expect(developed(s)).toBeCloseTo(11 / plotCapacity(s), 12);
  });

  it('refuses to build past the land you own', () => {
    const atCapacity = state({ ...housed(homeCapacity(state())), cash: Infinity, happiness: 1 });
    expect(canBuildHome(atCapacity)).toBe(false);
    const shopsFull = state({ ...trading(shopCapacity(state())), cash: Infinity });
    expect(canBuildShop(shopsFull)).toBe(false);
    const worksFull = state({ ...making(industryCapacity(state())), cash: Infinity });
    expect(canBuildIndustry(worksFull)).toBe(false);
  });
});

describe('annexation', () => {
  it('is gated on developing the land you already have', () => {
    const empty = state({ cash: Infinity });
    expect(canAnnex(empty)).toBe(false);
    expect(annexBlocker(empty)).toMatch(/developed/);

    // Housing alone no longer reaches the gate: with industry folded in, a
    // district is 48% residential against a denominator of every plot it owns.
    const full = state({
      cash: Infinity,
      ...built(homeCapacity(state()), shopCapacity(state()), industryCapacity(state())),
    });
    expect(developed(full)).toBeGreaterThanOrEqual(ANNEX_MIN_OCCUPANCY);
    expect(canAnnex(full)).toBe(true);
  });

  it('stops at the city limits', () => {
    const maxed = state({ cash: Infinity, districts: MAX_DISTRICTS });
    Object.assign(
      maxed,
      built(homeCapacity(maxed), shopCapacity(maxed), industryCapacity(maxed)),
    );
    expect(canAnnex(maxed)).toBe(false);
    expect(annexBlocker(maxed)).toBe('City limits reached');
  });
});

describe('land value', () => {
  /**
   * The constraint the whole feature is built around, and the reason the
   * multiplier is centred on the city's own mean rather than on a constant.
   *
   * RENT, HOME_BASE and the first tier's capacity together set how long the
   * first house takes to pay for itself — the number the opening minute lives
   * or dies on. If centrality changed what a built-out city earns, all three
   * would be re-opened. It redistributes rent across the build order and adds
   * none.
   *
   * Exact rather than to a tolerance, because the normaliser is the mean over
   * exactly the plots being averaged: 1e-12 is the double's own precision on a
   * sum of a thousand terms, not a slack the design needs.
   */
  it('leaves a built-out city earning exactly what flat rent earned it', () => {
    for (const districts of [1, 4, 12, 25, MAX_DISTRICTS]) {
      const plots = districts * BUILDABLE_RESIDENTIAL_PER_DISTRICT;
      const s = state({ ...zoning(districts), ...housed(plots) });
      expect(landValue(s)).toBeCloseTo(1, 12);
    }
  });

  it('is one for a city with no housing at all', () => {
    expect(landValue(state())).toBe(1);
    expect(landValue(state({ ...housed(0), ...zoning(4) }))).toBe(1);
  });

  it('redistributes rather than adding: the plot means average to one', () => {
    // The per-plot form of the same claim, so a change to `parcelLandValue`
    // that broke the centring could not hide behind the city-wide mean.
    const districts = 12;
    const plots = districts * BUILDABLE_RESIDENTIAL_PER_DISTRICT;
    const s = state({ ...zoning(districts), ...housed(plots) });
    let sum = 0;
    for (let i = 0; i < plots; i++) sum += parcelLandValue(s, i);
    expect(sum / plots).toBeCloseTo(1, 12);
  });

  it('makes two identical houses worth different rents', () => {
    // The point of it, and the thing the inspector now says. Same level, same
    // city, different plot — the game's first spatially varying input.
    const districts = 4;
    const plots = districts * BUILDABLE_RESIDENTIAL_PER_DISTRICT;
    const s = state({ ...zoning(districts), ...housed(plots) });
    let best = 0;
    let worst = 1;
    let bestPlot = 0;
    let worstPlot = 0;
    for (let i = 0; i < plots; i++) {
      const score = housingCentrality(i, zonedAt(districts));
      if (score > best) {
        best = score;
        bestPlot = i;
      }
      if (score < worst) {
        worst = score;
        worstPlot = i;
      }
    }
    const dear = buildingIncome(s, 'home', 0, { plot: bestPlot, plots: 1 });
    const cheap = buildingIncome(s, 'home', 0, { plot: worstPlot, plots: 1 });
    expect(dear).toBeGreaterThan(cheap);
    // And by exactly the spread the config says, not by some other amount.
    expect(dear / cheap).toBeCloseTo(
      parcelLandValue(s, bestPlot) / parcelLandValue(s, worstPlot),
      9,
    );
    expect(dear / cheap - 1).toBeCloseTo(LAND_VALUE_SPREAD * (best - worst) / parcelLandValue(s, worstPlot), 9);
  });

  it('quotes a home at the city mean when no parcel is given', () => {
    // The inspector hands one in; everything else does not, and has to keep
    // getting the answer it got before this existed.
    const s = state({ districts: 4, ...housed(30) });
    const mean = buildingIncome(s, 'home', 0);
    let sum = 0;
    for (let i = 0; i < 30; i++) sum += buildingIncome(s, 'home', 0, { plot: i, plots: 1 });
    expect(sum / 30).toBeCloseTo(mean, 9);
  });

  it('averages a merged parcel over both its plots', () => {
    const s = state({ districts: 4, ...housed(40) });
    const pair = parcelLandValue(s, 6, 2);
    expect(pair).toBeCloseTo((parcelLandValue(s, 6) + parcelLandValue(s, 7)) / 2, 12);
  });

  it('leaves commerce and industry alone', () => {
    // Land value is a rent term. A shop earns through the multiplier and a
    // works through the goods cycle, and neither of those knows about streets.
    const s = state({ districts: 4, ...housed(30), shops: 10, occupancyC: 1 });
    expect(buildingIncome(s, 'shop', 0, { plot: 0, plots: 1 })).toBe(
      buildingIncome(s, 'shop', 0, { plot: 90, plots: 1 }),
    );
  });
});
