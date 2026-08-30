import { describe, expect, it } from 'vitest';
import {
  CONGESTION_DENSITY_EXPONENT,
  CONGESTION_MOOD,
  CONGESTION_SCALE,
  DISTRICT_SPAN,
  FREE_TRANSPORT_RIDERSHIP,
  LEVELS,
  MAX_DISTRICTS,
  ROAD_CELLS_PER_DISTRICT,
  SPEND_PER_RESIDENT,
  TARGET_PLOTS,
  TAX_STEPS,
  TRANSIT_ROAD_SHARE,
  TRIPS_PER_RESIDENT,
  WORKING_SHARE,
} from '../src/sim/config';
import {
  bindingTerm,
  cityScale,
  congestion,
  congestionMood,
  garbageMood,
  congestionWithDepot,
  happinessFix,
  happinessTarget,
  happinessTerms,
  jobs,
  residents,
  roadTrips,
  transitCoverage,
  transitShare,
  trips,
  workers,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { districtCoord, districtLayoutAt } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { housedOn, making, served, trading, zoning } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** The grid the calibrator prints, so the two agree about what is being measured. */
const SIZES = [1, 4, 12, 25, MAX_DISTRICTS];

/** A city of `districts` built out at `level`, fully served. */
function city(districts: number, level: number, patch: Partial<GameState> = {}): GameState {
  const plots = 24 * districts;
  return state({
    ...zoning(districts),
    ...housedOn(plots, level),
    ...trading(Math.floor((45 * districts) / (level >= 2 ? 2 : 1)), level),
    ...making(Math.floor((13 * districts) / (level >= 2 ? 2 : 1)), level),
    ...served(),
    districts,
    happiness: 1,
    depots: 0,
    depotStaff: 0,
    cityHall: true,
    ...patch,
  });
}

describe('the road the city has', () => {
  /**
   * The measurement the whole feature rests on, asserted rather than assumed.
   *
   * If a future change to `citygen` ever lets road supply vary between
   * districts, congestion stops being honest as a city-wide scalar and this is
   * the test that says so.
   */
  it('gives every district exactly the same supply, however it is laid out', () => {
    const placements = new Set<string>();
    for (let i = 0; i < MAX_DISTRICTS; i++) {
      const at = districtCoord(i);
      const plan = districtLayoutAt(at.x, at.z);
      let road = 0;
      for (const zone of plan.zone) if (zone === 0) road++;
      let rows = 0;
      let cols = 0;
      for (let n = 0; n < DISTRICT_SPAN; n++) {
        if (plan.rowRoad[n]) rows++;
        if (plan.colRoad[n]) cols++;
      }
      expect(road).toBe(ROAD_CELLS_PER_DISTRICT);
      expect(plan.buildable).toBe(TARGET_PLOTS);
      // The sampler forces 144 = 12 x 12 buildable plots, which forces exactly
      // three full lines on each axis.
      expect(rows).toBe(3);
      expect(cols).toBe(3);
      placements.add(`${plan.rowRoad.join('')}|${plan.colRoad.join('')}`);
    }
    // Placement varies; supply does not. That is the whole argument for a
    // city-wide number, so both halves are asserted.
    expect(placements.size).toBeGreaterThan(1);
    expect(ROAD_CELLS_PER_DISTRICT).toBe(DISTRICT_SPAN * DISTRICT_SPAN - TARGET_PLOTS);
  });
});

describe('trips', () => {
  it('are driven by residents rather than by matched jobs', () => {
    expect(TRIPS_PER_RESIDENT).toBeCloseTo(WORKING_SHARE + SPEND_PER_RESIDENT, 12);
    for (const level of [0, LEVELS - 1]) {
      const s = city(4, level);
      expect(trips(s)).toBeCloseTo(residents(s) * TRIPS_PER_RESIDENT, 9);
    }
    // The measurement that forces it: a finished city is worker-rich, so
    // matched pairs would under-read its commute — and would miss its shopping
    // trips altogether, which is the larger half of the argument and the half
    // no job ladder can touch.
    //
    // It used to be worker-rich by 14.7x and this line asserted a tenfold gap.
    // That gap was the labour market having decayed rather than the arc working
    // — jobs stood still per plot while residents climbed 300x — and JOBS_LADDER
    // has closed it to about 1.2x. The *sign* is what the arc is, and it is
    // what this asserts now: still worker-rich at the top of the ladder, and
    // still under-read by matched pairs.
    const finished = city(MAX_DISTRICTS, LEVELS - 1);
    expect(workers(finished)).toBeGreaterThan(jobs(finished));
    expect(trips(finished)).toBeGreaterThan(Math.min(workers(finished), jobs(finished)));
  });

  it('go to nothing when nobody lives there', () => {
    const empty = state({ districts: 4 });
    expect(trips(empty)).toBe(0);
    expect(congestion(empty)).toBe(0);
    expect(congestionMood(empty)).toBeCloseTo(0, 12);
  });
});

describe('congestion', () => {
  it('stays inside [0, 1] at every size and level', () => {
    for (const districts of SIZES) {
      for (let level = 0; level < LEVELS; level++) {
        for (const patch of [
          {},
          { depots: 400, depotStaff: 1 },
          { depots: 400, depotStaff: 1, freeTransport: true },
        ]) {
          const jam = congestion(city(districts, level, patch));
          expect(jam).toBeGreaterThanOrEqual(0);
          expect(jam).toBeLessThanOrEqual(1);
          expect(Number.isFinite(jam)).toBe(true);
        }
      }
    }
  });

  it('does not vary with the size of the city', () => {
    // Road supply and residents both grow one district at a time, so the ratio
    // is flat across the map. A reading that moved with size would mean the
    // annexation curve had quietly become a traffic curve too.
    for (let level = 0; level < LEVELS; level++) {
      const one = congestion(city(1, level));
      for (const districts of SIZES) {
        expect(congestion(city(districts, level))).toBeCloseTo(one, 9);
      }
    }
  });

  it('rises with density, and by the exponent it says it does', () => {
    let last = -1;
    for (let level = 0; level < LEVELS; level++) {
      const s = city(1, level);
      const jam = congestion(s);
      expect(jam).toBeGreaterThan(last);
      last = jam;
      // The formula, spelled out: trips per road cell, discounted by density,
      // over the scale. Asserted rather than restated so a change to either
      // constant has to be a change to the measured table as well.
      expect(jam).toBeCloseTo(
        Math.min(
          1,
          trips(s) /
            (ROAD_CELLS_PER_DISTRICT * s.districts) /
            cityScale(s) ** CONGESTION_DENSITY_EXPONENT /
            CONGESTION_SCALE,
        ),
        9,
      );
    }
  });

  it('falls monotonically as the network reaches further', () => {
    for (let level = 0; level < LEVELS; level++) {
      let last = Number.POSITIVE_INFINITY;
      let lastReach = -1;
      for (const staff of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
        const s = city(12, level, { depots: 400, depotStaff: staff });
        expect(transitCoverage(s)).toBeGreaterThanOrEqual(lastReach);
        lastReach = transitCoverage(s);
        expect(congestion(s)).toBeLessThanOrEqual(last);
        last = congestion(s);
      }
    }
  });

  it('falls again when the fares are waived', () => {
    for (let level = 0; level < LEVELS; level++) {
      const paid = city(12, level, { depots: 400, depotStaff: 1 });
      const free = { ...paid, freeTransport: true };
      expect(transitShare(free)).toBeGreaterThan(transitShare(paid));
      expect(congestion(free)).toBeLessThan(congestion(paid));
    }
    // And the two effects together are what the constants claim.
    const free = city(12, 2, { depots: 400, depotStaff: 1, freeTransport: true });
    expect(transitShare(free)).toBeCloseTo(
      Math.min(1, TRANSIT_ROAD_SHARE * (1 + FREE_TRANSPORT_RIDERSHIP)),
      9,
    );
  });

  it('takes trips off the road rather than pretending they were never made', () => {
    const s = city(12, 2, { depots: 400, depotStaff: 1 });
    expect(roadTrips(s)).toBeCloseTo(trips(s) * (1 - transitShare(s)), 9);
    expect(roadTrips(s)).toBeLessThan(trips(s));
    expect(roadTrips(s)).toBeGreaterThan(0);
  });

  it('is derived, so it needs no lag of its own and cannot drift', () => {
    // Nothing integrates it, so a 60-second step and 600 tenth-second ticks read
    // the same number off the same state — the property the brief asked for,
    // stated as what it actually is: a pure function.
    const s = city(4, 1, { depots: 20, depotStaff: 0.6 });
    const frozen = JSON.parse(JSON.stringify(s)) as GameState;
    expect(congestion(s)).toBe(congestion(frozen));
    expect(congestion(s)).toBe(congestion(s));
    // And the state carries no field for it: there is nothing to save, nothing
    // to migrate and nothing a doctored save could put out of range.
    expect(Object.keys(s)).not.toContain('congestion');
  });
});

describe('what it costs the mood', () => {
  it('is a modifier, not a fifth weight', () => {
    const terms = happinessTerms(city(4, 1));
    const weighted = terms.filter((term) => term.modifier !== true);
    expect(weighted.reduce((sum, term) => sum + term.weight, 0)).toBeCloseTo(1, 12);
    const jam = terms.find((term) => term.key === 'congestion');
    expect(jam?.modifier).toBe(true);
    expect(jam?.weight).toBe(CONGESTION_MOOD);
    // Stated as the good thing, so every row in the panel reads the same way.
    expect(jam?.coverage).toBeCloseTo(1 - congestion(city(4, 1)), 12);
  });

  it('costs a fully jammed city about what the punitive rate does', () => {
    const worst = TAX_STEPS.reduce((low, step) => Math.min(low, step.mood), 0);
    expect(-CONGESTION_MOOD).toBeCloseTo(worst, 2);
    const jammed = city(4, LEVELS - 1);
    expect(congestion(jammed)).toBeGreaterThan(0.9);
    expect(congestionMood(jammed)).toBeLessThan(-0.12);
  });

  it('costs a city that has bought its way out almost nothing', () => {
    const moving = city(4, LEVELS - 1, {
      depots: 400,
      depotStaff: 1,
      freeTransport: true,
    });
    expect(congestion(moving)).toBeLessThan(0.1);
    expect(congestionMood(moving)).toBeGreaterThan(-0.02);
  });

  it('can never push the target outside [0, 1]', () => {
    for (const districts of SIZES) {
      for (let level = 0; level < LEVELS; level++) {
        for (const patch of [
          {},
          { depots: 400, depotStaff: 1 },
          { parks: 0, hospitals: 0, police: 0, fire: 0 },
          { taxRate: TAX_STEPS.length - 1, museums: 40, stadiums: 40 },
        ]) {
          const target = happinessTarget(city(districts, level, patch));
          expect(target).toBeGreaterThanOrEqual(0);
          expect(target).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('lands in the same bracket as the tax step rather than in the weights', () => {
    // Two cities identical but for their traffic: the difference is exactly the
    // modifiers, with nothing rescaled underneath it.
    //
    // Modifier*s*, plural, because a depot answers rubbish as well as traffic
    // now — see `garbageCollection`. That is the point of the assertion rather
    // than a complication of it: what a purchase is worth is the sum of the
    // modifiers it moves, and none of it comes out of the weighted half.
    const jammed = city(4, 1);
    const moving = { ...jammed, depots: 400, depotStaff: 1 };
    const modifiers = (s: GameState): number => congestionMood(s) + garbageMood(s);
    expect(happinessTarget(moving) - happinessTarget(jammed)).toBeCloseTo(
      modifiers(moving) - modifiers(jammed),
      12,
    );
  });
});

describe('the depot as a purchase', () => {
  it('can become the binding term once everything else is covered', () => {
    const covered = city(4, 2);
    expect(bindingTerm(covered).key).toBe('congestion');
    // It stays the binding term with the buses running, and that is right
    // rather than a bug: with every service and every park at 1 the roads are
    // the only thing still costing the city anything. What changes is what it
    // costs — an order of magnitude less.
    const moving = city(4, 2, { depots: 400, depotStaff: 1, freeTransport: true });
    expect(bindingTerm(moving).key).toBe('congestion');
    expect(congestion(moving)).toBeLessThan(congestion(covered) / 5);

    // And it yields to a real shortfall: a city short of a hospital is told
    // about the hospital, not about its traffic.
    const sick = city(4, 2, { hospitals: 0, hospitalStaff: 0 });
    expect(bindingTerm(sick).key).toBe('hospital');
  });

  it('is named by happinessFix, with its price', () => {
    const covered = city(4, 2, { cash: 1e9 });
    const fix = happinessFix(covered);
    expect(fix?.label).toBe('Open depot');
    expect(fix?.lift).toBeGreaterThan(0);
    expect(fix?.affordable).toBe(true);
  });

  it('prices one more depot against the coverage the city has now', () => {
    const covered = city(4, 2, { cash: 1e9 });
    expect(congestionWithDepot(covered)).toBeLessThan(congestion(covered));
    // Worth nothing once the network is complete, so a covered city is never
    // told to buy another one.
    const done = city(4, 2, { cash: 1e9, depots: 400, depotStaff: 1 });
    expect(congestionWithDepot(done)).toBeCloseTo(congestion(done), 12);
    expect(happinessFix(done)?.label).not.toBe('Open depot');
  });

  it('is worth nothing at all to a city with nobody in it', () => {
    const empty = state({ districts: 4, ...served(), cash: 1e9 });
    expect(congestion(empty)).toBe(0);
    expect(congestionWithDepot(empty)).toBe(0);
  });
});

describe('in the running simulation', () => {
  it("lifts a settled city's mood when the depots open", () => {
    const patch: Partial<GameState> = {
      ...zoning(4),
      ...housedOn(96, 1),
      ...trading(45),
      ...making(13),
      ...served(),
      cash: 1e9,
      happiness: 0.5,
    };
    const jammed = new Game(state(patch));
    const moving = new Game(state({ ...patch, depots: 400, depotStaff: 1 }));
    for (let i = 0; i < 20; i++) {
      jammed.catchUp(60);
      moving.catchUp(60);
    }
    expect(moving.state.happiness).toBeGreaterThan(jammed.state.happiness);
    expect(congestion(moving.state)).toBeLessThan(congestion(jammed.state));
  });

  it('leaves the opening minute where it was', () => {
    // A fresh city has a handful of residents against 81 road cells, so the term
    // is worth a fraction of a point and the tutorial is untouched.
    const game = new Game(state({ cash: 1e4 }));
    game.buildHome();
    expect(congestion(game.state)).toBeLessThan(0.02);
    expect(congestionMood(game.state)).toBeGreaterThan(-0.003);
  });
});
