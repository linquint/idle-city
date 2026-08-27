import { describe, expect, it } from 'vitest';
import {
  FRONTAGE_TARGET,
  HOME_BASE,
  HOME_GROWTH,
  INDUSTRY_RESERVE,
  MAX_DISTRICTS,
  SHOP_BASE,
  SHOP_GROWTH,
  SURVEY_FILL,
  SURVEY_SECONDS,
  CATCHUP_MAX_SURVEYS,
  ZONE_FLOOR,
} from '../src/sim/config';
import { ZONE } from '../src/sim/citygen';
import {
  CityLayout,
  SELLABLE_PER_DISTRICT,
  cutParcels,
  districtCoord,
  districtLand,
  districtPlanAt,
  districtPool,
  districtZonePlots,
  joinParcels,
  parcelPlots,
  reverseParcels,
  zoneParcels,
  zoningAt,
} from '../src/sim/layout';
import {
  homeCapacity,
  homeCost,
  industryCapacity,
  plotsOf,
  scrubPlots,
  shopCapacity,
  shopCost,
  willRelease,
  willSurvey,
  willTransfer,
  zoneFill,
  zoneFillMultiples,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { createState, openZoning, type GameState } from '../src/sim/state';
import { built, housed, zonedAt } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** A city of `districts`, every one on the split it opened at. */
const city = (districts: number, patch: Partial<GameState> = {}): GameState => {
  const s = state({ districts, ...patch });
  s.surveyedR = [];
  s.surveyedC = [];
  s.surveyedI = [];
  for (let i = 0; i < districts; i++) {
    const z = openZoning(i);
    s.surveyedR.push(z.home);
    s.surveyedC.push(z.shop);
    s.surveyedI.push(z.industry);
  }
  return s;
};

describe('the district pool', () => {
  it('tiles every sellable plot exactly once, at every seed', () => {
    for (let i = 0; i < 40; i++) {
      const c = districtCoord(i);
      const pool = districtPool(districtPlanAt(c.x, c.z));
      const all = [
        ...pool.homeFloor.cells, ...pool.shopFloor.cells, ...pool.worksFloor.cells,
        ...pool.worksReserve.cells, ...pool.shared.cells,
      ];
      expect(all).toHaveLength(SELLABLE_PER_DISTRICT);
      expect(new Set(all).size).toBe(SELLABLE_PER_DISTRICT);
    }
  });

  it('keeps a floor for every zone, and industry a reserve of its own', () => {
    for (let i = 0; i < 40; i++) {
      const land = districtLand(i);
      // At least, not exactly: the pool is cut at parcel boundaries, so a floor
      // lands on the first one at or past the constant.
      expect(land.floor.home).toBeGreaterThanOrEqual(ZONE_FLOOR.home);
      expect(land.floor.shop).toBeGreaterThanOrEqual(ZONE_FLOOR.shop);
      expect(land.floor.industry).toBeGreaterThanOrEqual(ZONE_FLOOR.industry);
      expect(parcelPlots(land.pool.worksReserve)).toBe(INDUSTRY_RESERVE);
    }
  });

  it('reproduces the split every district sold before zoning floated', () => {
    // The whole of why the v10 migration moves nothing: the old 24 / 45 / 13 is
    // a *point inside* the pool rather than a special case beside it.
    for (let i = 0; i < 40; i++) {
      const c = districtCoord(i);
      const plan = districtPlanAt(c.x, c.z);
      const pool = districtPool(plan);
      const at = openZoning(i);
      expect([...zoneParcels(pool, at, ZONE.residential).cells]).toEqual([...plan.residential]);
      expect([...zoneParcels(pool, at, ZONE.commercial).cells]).toEqual([...plan.commercial]);
      expect([...zoneParcels(pool, at, ZONE.industrial).cells]).toEqual([...plan.industrial]);
    }
  });

  it('lets residential and commercial invert, out of one shared total', () => {
    const land = districtLand(0);
    const all = land.limits.shared;
    const homeMost = districtZonePlots(
      { districts: 1, surveyedR: [all], surveyedC: [0], surveyedI: [0] }, 0, ZONE.residential);
    const shopMost = districtZonePlots(
      { districts: 1, surveyedR: [0], surveyedC: [all], surveyedI: [0] }, 0, ZONE.commercial);
    // Each can take the whole pool, and neither can take it while the other has.
    expect(homeMost).toBeGreaterThan(FRONTAGE_TARGET.commercial);
    expect(shopMost).toBeGreaterThan(FRONTAGE_TARGET.commercial);
    const both = zoningAt({ districts: 1, surveyedR: [all], surveyedC: [all], surveyedI: [0] }, 0);
    expect(both.home + both.shop).toBeLessThanOrEqual(all);
  });

  it('never hands the same plot to two zones, at any split', () => {
    const land = districtLand(0);
    for (let home = 0; home <= land.limits.shared; home += 3) {
      for (let shop = 0; shop + home <= land.limits.shared; shop += 3) {
        const at = { home, shop, industry: land.limits.works };
        const r = zoneParcels(land.pool, at, ZONE.residential).cells;
        const c = zoneParcels(land.pool, at, ZONE.commercial).cells;
        const i = zoneParcels(land.pool, at, ZONE.industrial).cells;
        const all = [...r, ...c, ...i];
        expect(new Set(all).size).toBe(all.length);
      }
    }
  });
});

describe('parcel arithmetic', () => {
  const run = { cells: [1, 2, 3, 4, 5, 6, 7], sizes: [2, 2, 1, 2] };

  it('cuts at a parcel boundary and never inside one', () => {
    for (let plots = 0; plots <= 8; plots++) {
      const { head, tail } = cutParcels(run, plots);
      expect(head.cells.length).toBeGreaterThanOrEqual(Math.min(plots, 7));
      expect([...head.cells, ...tail.cells]).toEqual(run.cells);
      expect([...head.sizes, ...tail.sizes]).toEqual(run.sizes);
      // Every parcel is whole on one side or the other.
      expect(head.cells.length).toBe(head.sizes.reduce((a, b) => a + b, 0));
    }
  });

  it('reverses parcel order while keeping each parcel intact', () => {
    const back = reverseParcels(run);
    expect([...back.sizes]).toEqual([2, 1, 2, 2]);
    expect([...back.cells]).toEqual([6, 7, 5, 3, 4, 1, 2]);
    // And twice is the identity, which is what makes commerce read the pool's
    // tail in the order the generator laid it.
    expect([...reverseParcels(back).cells]).toEqual(run.cells);
  });

  it('joins without losing a plot', () => {
    const joined = joinParcels(run, run);
    expect(joined.cells).toHaveLength(14);
    expect(joined.sizes).toHaveLength(8);
  });
});

describe('the surveyor', () => {
  it('will not zone a zone the city does not want more of', () => {
    const s = city(1, { ...built(24, 45, 13), demandR: 0, demandC: 0, demandI: 0 });
    for (const kind of ['home', 'shop', 'industry'] as const) {
      expect(willSurvey(s, kind)).toBe(false);
      expect(willRelease(s, kind)).toBe(false);
    }
  });

  it('will not zone a zone the city has not filled', () => {
    // Demand alone is not enough: the build-out gate is what stops a stall being
    // worth anything, because a survey drops the zone under it again.
    const s = city(1, { ...built(2, 2, 2), demandR: 1, demandC: 1, demandI: 1 });
    expect(zoneFill(s, 'home')).toBeLessThan(SURVEY_FILL);
    expect(willSurvey(s, 'home')).toBe(false);
  });

  it('shuts its own gate after one move, so a stall harvests one parcel', () => {
    // A district opens with its pool fully allocated, so what moves land here is
    // the contest rather than spare ground — housing wants it more than commerce
    // does, and commerce has an empty parcel at the end of its run.
    const s = city(1, { demandR: 1, demandC: -1, demandI: -1 });
    const capacity = homeCapacity(s);
    Object.assign(s, built(Math.ceil(capacity * SURVEY_FILL), 4, 0));
    expect(willTransfer(s)).not.toBeNull();
    const game = new Game(s);
    // Ticked far past any settling, and building nothing. What a stall is.
    for (let i = 0; i < 40_000; i++) game.advance(0.1);
    const after = game.state;
    expect(homeCapacity(after)).toBeGreaterThan(capacity);
    // The gate shuts, and it shuts within a parcel or two rather than running.
    // Each move takes the zone from n/A to n/(A+size), so the fill ratio falls
    // strictly and crosses SURVEY_FILL from above — a zone already past the gate
    // may take a second parcel getting under it, and never many.
    expect(zoneFill(after, 'home')).toBeLessThanOrEqual(SURVEY_FILL);
    expect(willTransfer(after)).toBeNull();
    expect(homeCapacity(after) - capacity).toBeLessThanOrEqual(4);
  });

  it('gives the pool to whichever zone wants it more, not to one in surplus', () => {
    // The case absolute thresholds cannot express, and the one that carries the
    // whole mechanic: neither zone is oversupplied, but one wants it more.
    const s = city(1, { demandR: 0.5, demandC: 0.0, demandI: 0 });
    Object.assign(s, built(Math.ceil(homeCapacity(s) * SURVEY_FILL), 4, 0));
    expect(willSurvey(s, 'home')).toBe(false);
    expect(willRelease(s, 'shop')).toBe(false);
    const swap = willTransfer(s);
    expect(swap).toEqual({ to: 'home', from: 'shop' });
  });

  it('gives land back when a zone is oversupplied and its tail is empty', () => {
    // Housing at its floor with the city long on shops and miserable, so the
    // *target* is deeply negative too — the signal stays under the release
    // threshold across the surveyor's clock rather than needing to be held.
    const s = city(1, {
      ...built(8, 45, 13), demandR: -1, demandC: 0, demandI: 0, happiness: 0,
    });
    const before = homeCapacity(s);
    expect(willRelease(s, 'home')).toBe(true);
    const game = new Game(s);
    // Past the surveyor's clock: it banks seconds and spends whole passes, so
    // nothing moves inside a tenth of a second. See SURVEY_SECONDS.
    for (let i = 0; i < 10 * (SURVEY_SECONDS + 1); i++) game.advance(0.1);
    expect(homeCapacity(game.state)).toBeLessThan(before);
  });

  it('never takes the ground out from under a building', () => {
    // The condition that makes releasing safe at all. A full zone has nothing
    // spare to give up, however unwanted it is.
    const s = city(1, { ...built(homeCapacity(city(1)), 0, 0), demandR: -1 });
    expect(plotsOf(s, 'home')).toBe(homeCapacity(s));
    expect(willRelease(s, 'home')).toBe(false);
  });

  it('never zones a type out of a district', () => {
    const s = city(1, { ...built(0, 0, 0), demandR: -1, demandC: -1, demandI: -1 });
    const game = new Game(s);
    for (let i = 0; i < 4000; i++) game.advance(0.1);
    expect(homeCapacity(game.state)).toBeGreaterThanOrEqual(ZONE_FLOOR.home);
    expect(shopCapacity(game.state)).toBeGreaterThanOrEqual(ZONE_FLOOR.shop);
    expect(industryCapacity(game.state)).toBeGreaterThanOrEqual(ZONE_FLOOR.industry);
  });

  it("holds a district's split the moment the next one is annexed", () => {
    const s = city(1, { ...built(24, 45, 13), cash: 1e9, demandR: 1 });
    const game = new Game(s);
    game.annex();
    const frozen = {
      r: game.state.surveyedR[0],
      c: game.state.surveyedC[0],
      i: game.state.surveyedI[0],
    };
    for (let i = 0; i < 6000; i++) game.advance(0.1);
    expect(game.state.surveyedR[0]).toBe(frozen.r);
    expect(game.state.surveyedC[0]).toBe(frozen.c);
    expect(game.state.surveyedI[0]).toBe(frozen.i);
  });

  it('strands no land: a frozen district holds all 82 of its plots', () => {
    const s = city(1, { ...built(24, 45, 13), cash: 1e12, demandR: -1, demandC: -1 });
    const game = new Game(s);
    // Let it give land back, then annex — the freeze has to spend the remainder.
    for (let i = 0; i < 3000; i++) game.advance(0.1);
    game.annex();
    const held =
      districtZonePlots(game.state, 0, ZONE.residential) +
      districtZonePlots(game.state, 0, ZONE.commercial) +
      districtZonePlots(game.state, 0, ZONE.industrial);
    expect(held).toBe(SELLABLE_PER_DISTRICT);
    // So only the frontier can ever carry scrub, whatever the city has done.
    expect(scrubPlots(game.state)).toBeLessThanOrEqual(SELLABLE_PER_DISTRICT);
  });

  it('rezones a city away about as watching it would, when nothing is bought', () => {
    // What the surveyor itself guarantees: it reads the state and nothing else,
    // so a 60-second step and six hundred tenth-second ones have to reach the
    // same zoning. A spending city is a different question and an older one —
    // CATCHUP_MAX_ANNEXES has capped an away city's districts since long before
    // any of this, and CATCHUP_MAX_SURVEYS is the same guard for the same
    // reason. Measured on the build before zoning existed, a twelve-hour
    // absence already came back three districts against a watched six.
    // The city's age used to be part of this fixture, because the opening grace
    // was a clock and a district built out to 24 / 20 / 13 is not two minutes
    // old. It is COVERAGE_GRACE_PLOTS now, and twenty-four housing plots are
    // clear of it at any age — so the fixture says what it means without
    // stamping an elapsed time on a city that would have taken an hour.
    const patch = { ...built(24, 20, 13), cash: 0 };
    const away = new Game(city(1, patch));
    const watched = new Game(city(1, patch));
    away.catchUp(3_600);
    for (let i = 0; i < 36_000; i++) watched.advance(0.1);
    // Within a parcel, not to the parcel. A 60-second step banks three passes
    // and runs them against the demand it read at the top of the step, where
    // sixty ticks of a second read it sixty times as it moves — the same
    // coarse-step approximation every chained integrator in this game carries.
    // What the clock fixed is the *rate*: without it an hour away reached 11
    // parcels against a watched 13, and with it the two are within one.
    for (const key of ['surveyedR', 'surveyedC', 'surveyedI'] as const) {
      for (let i = 0; i < away.state[key].length; i++) {
        const gap = Math.abs((away.state[key][i] as number) - (watched.state[key][i] as number));
        expect(gap).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is capped for the length of an absence', () => {
    const s = city(1, { ...built(24, 45, 13), demandR: 1, demandC: 1, demandI: 1, cash: 0 });
    const game = new Game(s);
    const report = game.catchUp(12 * 3600);
    expect(report.surveyed).toBeLessThanOrEqual(CATCHUP_MAX_SURVEYS);
  });
});

describe('a survey never moves a building', () => {
  it('leaves every standing plot where it was, on either side of a survey', () => {
    const before = city(3, { ...built(60, 100, 30) });
    const layout = new CityLayout().ensure(before);
    const cells = (z: 1 | 2 | 3): string[] =>
      layout.zoneCells(z).map((c) => `${c.x},${c.z}`);
    const was = { r: cells(ZONE.residential), c: cells(ZONE.commercial) };

    // Survey the frontier — the only district that may move — and re-read.
    const after = { ...before, surveyedR: [...before.surveyedR], surveyedC: [...before.surveyedC], surveyedI: [...before.surveyedI] };
    after.surveyedC[2] = (after.surveyedC[2] as number) - 1;
    after.surveyedR[2] = (after.surveyedR[2] as number) + 1;
    const now = new CityLayout().ensure(after);
    const nowCells = (z: 1 | 2 | 3): string[] =>
      now.zoneCells(z).map((c) => `${c.x},${c.z}`);

    // Housing gained a parcel at the end; everything before it is untouched.
    expect(nowCells(ZONE.residential).slice(0, was.r.length)).toEqual(was.r);
    // Commerce lost its last parcel; everything before it is untouched.
    const shrunk = nowCells(ZONE.commercial);
    expect(was.c.slice(0, shrunk.length)).toEqual(shrunk);
  });
});

describe('the price curve, derived from the allotment', () => {
  it('is exactly the old curve at the split every district used to sell', () => {
    for (const n of [0, 1, 12, 24, 47, 100, 200]) {
      const districts = Math.max(1, Math.ceil(n / FRONTAGE_TARGET.residential));
      const s = city(districts, housed(n));
      // Relative, because the curve reaches 1.9e12 by 200 plots and an absolute
      // tolerance there asks for more precision than a double carries.
      const want = HOME_BASE * HOME_GROWTH ** n;
      expect(Math.abs(homeCost(s) / want - 1)).toBeLessThan(1e-12);
    }
    for (const n of [0, 9, 45, 90]) {
      const districts = Math.max(1, Math.ceil(n / FRONTAGE_TARGET.commercial));
      const s = city(districts, built(0, n, 0));
      const want = SHOP_BASE * SHOP_GROWTH ** n;
      expect(Math.abs(shopCost(s) / want - 1)).toBeLessThan(1e-12);
    }
  });

  it('is strictly increasing in plots taken, at every split', () => {
    const land = districtLand(0);
    for (const home of [0, 6, 14, land.limits.shared]) {
      const s = city(1);
      s.surveyedR = [home];
      s.surveyedC = [land.limits.shared - home];
      const capacity = homeCapacity(s);
      let previous = 0;
      for (let n = 0; n <= capacity; n++) {
        const cost = homeCost({ ...s, ...housed(n) });
        expect(cost).toBeGreaterThan(previous);
        previous = cost;
      }
    }
  });

  it('costs the same to fill a district however that district is zoned', () => {
    // The property the whole derivation exists for. Filling your commercial
    // land multiplies its price by one district's multiple, whether that land is
    // eight plots or fifty-five.
    const land = districtLand(0);
    const last: number[] = [];
    for (const shop of [0, 5, 12, 19, land.limits.shared]) {
      const s = city(1);
      s.surveyedC = [shop];
      s.surveyedR = [land.limits.shared - shop];
      const capacity = shopCapacity(s);
      last.push(shopCost({ ...s, ...built(0, capacity, 0) }));
    }
    for (const cost of last) {
      expect(Math.abs(cost / (last[0] as number) - 1)).toBeLessThan(1e-12);
    }
  });

  it('does not move a price when a district is annexed', () => {
    // What per-district growth buys over a city-wide allotment: a new district
    // appends a term whose numerator is zero, so nothing already priced moves.
    for (const [districts, homes] of [[1, 20], [3, 60], [6, 130]] as const) {
      const before = homeCost(city(districts, housed(homes)));
      const after = homeCost(city(districts + 1, housed(homes)));
      expect(Math.abs(after / before - 1)).toBeLessThan(1e-12);
    }
  });

  it('counts a district as filled when its own allotment is', () => {
    const s = city(2, housed(homeCapacity(city(2))));
    expect(zoneFillMultiples(s, 'home')).toBeCloseTo(2, 9);
  });
});

describe('what a save carries', () => {
  it('opens a fresh city on the land it always opened on', () => {
    const fresh = createState(0);
    expect(homeCapacity(fresh)).toBe(FRONTAGE_TARGET.residential);
    expect(shopCapacity(fresh)).toBe(FRONTAGE_TARGET.commercial);
    expect(industryCapacity(fresh)).toBe(FRONTAGE_TARGET.industrial);
    expect(scrubPlots(fresh)).toBe(0);
  });

  it('grows one entry per district and no more', () => {
    const game = new Game(city(1, { ...built(24, 45, 13), cash: 1e30 }));
    for (let i = 0; i < 6; i++) game.annex();
    expect(game.state.surveyedR).toHaveLength(game.state.districts);
    expect(game.state.surveyedC).toHaveLength(game.state.districts);
    expect(game.state.surveyedI).toHaveLength(game.state.districts);
    expect(game.state.districts).toBeLessThanOrEqual(MAX_DISTRICTS);
  });

  it('is the same city read twice, whatever order it was built in', () => {
    const z = zonedAt(4);
    expect(homeCapacity(city(4))).toBe(
      districtZonePlots(z, 0, ZONE.residential) +
        districtZonePlots(z, 1, ZONE.residential) +
        districtZonePlots(z, 2, ZONE.residential) +
        districtZonePlots(z, 3, ZONE.residential),
    );
  });
});
