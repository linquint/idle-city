import { describe, expect, it } from 'vitest';
import {
  ANNEX_MIN_OCCUPANCY,
  FRONTAGE_TARGET,
  HOME_BASE,
  INDUSTRY_BASE,
  LEVEL_CAPACITY,
  MAX_DISTRICTS,
  SHOP_BASE,
  SHOP_BONUS,
} from '../src/sim/config';
import {
  annexBlocker,
  canAnnex,
  canBuildHome,
  canBuildIndustry,
  canBuildShop,
  civicSiteCapacity,
  developed,
  homeCapacity,
  homeCost,
  income,
  industryCapacity,
  industryCost,
  plotCapacity,
  plotsUsed,
  residents,
  shopCapacity,
  shopCost,
} from '../src/sim/economy';
import { PLOTS_PER_DISTRICT } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { built, housed, making, trading } from './levels';

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
 * it opens at 1.13x and reaches 2.24x, which makes it something you choose.
 *
 * Undiscounted throughout: a fresh city sits at zero demand, so these are the
 * constants themselves and not what a demand swing did to them.
 */
describe('residential and commercial parity', () => {
  const home = (n: number): number => homeCost(state({ homes: n }));
  const shop = (n: number): number => shopCost(state({ shops: n }));

  it('opens both types at within 25% of each other', () => {
    const gap = Math.abs(shop(0) - home(0)) / Math.max(shop(0), home(0));
    expect(gap).toBeLessThanOrEqual(0.25);
  });

  it('has commerce compounding faster, but only somewhat', () => {
    const ratio = shop(20) / home(20);
    expect(ratio).toBeGreaterThanOrEqual(1.5);
    expect(ratio).toBeLessThanOrEqual(3);
    // Faster at every step, not just at the twentieth: the gap only ever opens.
    for (let n = 1; n <= 40; n++) {
      expect(shop(n) / home(n)).toBeGreaterThan(shop(n - 1) / home(n - 1));
    }
  });

  /**
   * The trap this change had to avoid. Cheap shops are only a rebalance if the
   * bonus moves with them; left alone, the strongest income multiplier in the
   * game goes on sale and the opening collapses into one button.
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
   * A district sells 31 commercial plots against 24 residential, so the faster
   * curve compounds over 29% more buildings. Commerce is still the expensive
   * half of a district — that is what stops "shops are cheap now" becoming
   * "shops are free". The ratio narrowed with the wider district (it was 47%
   * at 28/19), which makes the *curve* rather than the plot count the thing
   * carrying the price gap.
   */
  it('leaves commerce the dearer half of a district to fill', () => {
    const fill = (cost: (n: number) => number, plots: number): number =>
      Array.from({ length: plots }, (_, n) => cost(n)).reduce((a, b) => a + b, 0);
    const housing = fill(home, FRONTAGE_TARGET.residential);
    const commerce = fill(shop, FRONTAGE_TARGET.commercial);
    expect(FRONTAGE_TARGET.commercial / FRONTAGE_TARGET.residential).toBeCloseTo(1.29, 2);
    expect(commerce).toBeGreaterThan(housing * 4);
    expect(commerce).toBeLessThan(housing * 20);
  });
});

describe('income', () => {
  it('is zero with nobody living there', () => {
    expect(income(state())).toBe(0);
  });

  it('counts residents cohort by cohort', () => {
    for (let level = 0; level < LEVEL_CAPACITY.length; level++) {
      expect(residents(state(housed(10, level)))).toBe(10 * (LEVEL_CAPACITY[level] ?? 0));
    }
    // And a mixed skyline is the sum of its parts rather than one global level,
    // which is the whole thing cohorts buy over the tier they replaced.
    const mixed = state({ homes: 10, homeLevels: [4, 3, 2, 1], occupancyR: 1 });
    expect(residents(mixed)).toBe(4 * 4 + 3 * 16 + 2 * 70 + 1 * 300);
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

  it('counts industrial land and civic sites, not just what is for sale', () => {
    const s = state();
    expect(plotCapacity(s)).toBe(
      homeCapacity(s) + shopCapacity(s) + industryCapacity(s) + civicSiteCapacity(s),
    );
    expect(industryCapacity(s)).toBeGreaterThan(0);
    expect(civicSiteCapacity(s)).toBeGreaterThan(0);
  });

  it('is a share of the plots that front a street, not of the zoned land', () => {
    // The distinction the renamed constants exist to keep straight: a district
    // is zoned for 100 plots and sells 63 of them, because a building has to
    // have a street to stand on, six 2x2 quads are held for civic use and one
    // 3x3 for the university.
    const s = state();
    expect(homeCapacity(s) + shopCapacity(s) + industryCapacity(s)).toBe(63);
    expect(plotCapacity(s)).toBe(69);
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
