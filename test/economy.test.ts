import { describe, expect, it } from 'vitest';
import {
  ANNEX_MIN_OCCUPANCY,
  HOME_BASE,
  INDUSTRY_BASE,
  MAX_DISTRICTS,
  REZONE_MIN_HOMES,
  SHOP_BASE,
  TIERS,
} from '../src/sim/config';
import {
  annexBlocker,
  canAnnex,
  canBuildHome,
  canBuildIndustry,
  canBuildShop,
  canRezone,
  homeCapacity,
  homeCost,
  income,
  industryCapacity,
  industryCost,
  occupancy,
  plotCapacity,
  plotsUsed,
  residents,
  rezoneBlocker,
  shopCapacity,
  shopCost,
} from '../src/sim/economy';
import { createState, type GameState } from '../src/sim/state';

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

describe('income', () => {
  it('is zero with nobody living there', () => {
    expect(income(state())).toBe(0);
  });

  it('counts residents by the active tier', () => {
    for (let tier = 0; tier < TIERS.length; tier++) {
      expect(residents(state({ homes: 10, tier }))).toBe(10 * TIERS[tier]!.capacity);
    }
  });

  it('rises with shops and with districts', () => {
    const base = state({ homes: 20, cash: 0 });
    expect(income({ ...base, shops: 5 })).toBeGreaterThan(income(base));
    expect(income({ ...base, districts: 3 })).toBeGreaterThan(income(base));
  });
});

describe('capacity', () => {
  it('scales linearly with annexed districts', () => {
    const one = plotCapacity(state({ districts: 1 }));
    expect(plotCapacity(state({ districts: 4 }))).toBe(one * 4);
  });

  it('counts industrial land now that something builds on it', () => {
    const s = state();
    expect(plotCapacity(s)).toBe(homeCapacity(s) + shopCapacity(s) + industryCapacity(s));
    expect(industryCapacity(s)).toBeGreaterThan(0);
  });

  it('counts every kind of building against the same total', () => {
    const s = state({ homes: 3, shops: 2, industry: 4, schools: 1, clinics: 1 });
    expect(plotsUsed(s)).toBe(11);
    expect(occupancy(s)).toBeCloseTo(11 / plotCapacity(s), 12);
  });

  it('refuses to build past the land you own', () => {
    const full = state({ homes: homeCapacity(state()), cash: Infinity });
    expect(canBuildHome(full)).toBe(false);
    const shopsFull = state({ shops: shopCapacity(state()), cash: Infinity });
    expect(canBuildShop(shopsFull)).toBe(false);
    const worksFull = state({ industry: industryCapacity(state()), cash: Infinity });
    expect(canBuildIndustry(worksFull)).toBe(false);
  });
});

describe('rezoning', () => {
  it('needs homes before it needs money', () => {
    const poor = state({ homes: REZONE_MIN_HOMES - 1, cash: Infinity });
    expect(canRezone(poor)).toBe(false);
    expect(rezoneBlocker(poor)).toContain(String(REZONE_MIN_HOMES));
    expect(canRezone({ ...poor, homes: REZONE_MIN_HOMES })).toBe(true);
  });

  it('stops at the last tier', () => {
    const top = state({ homes: 50, cash: Infinity, tier: TIERS.length - 1 });
    expect(canRezone(top)).toBe(false);
    expect(rezoneBlocker(top)).toBe('Zoning maxed');
  });
});

describe('annexation', () => {
  it('is gated on developing the land you already have', () => {
    const empty = state({ cash: Infinity });
    expect(canAnnex(empty)).toBe(false);
    expect(annexBlocker(empty)).toMatch(/developed/);

    // Housing alone no longer reaches the gate: with industry folded in, a
    // district is 48% residential against a denominator of every plot it owns.
    const developed = state({
      cash: Infinity,
      homes: homeCapacity(state()),
      shops: shopCapacity(state()),
      industry: industryCapacity(state()),
    });
    expect(occupancy(developed)).toBeGreaterThanOrEqual(ANNEX_MIN_OCCUPANCY);
    expect(canAnnex(developed)).toBe(true);
  });

  it('stops at the city limits', () => {
    const maxed = state({ cash: Infinity, districts: MAX_DISTRICTS });
    maxed.homes = homeCapacity(maxed);
    maxed.shops = shopCapacity(maxed);
    maxed.industry = industryCapacity(maxed);
    expect(canAnnex(maxed)).toBe(false);
    expect(annexBlocker(maxed)).toBe('City limits reached');
  });
});
