import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Cars } from '../src/render/cars';
import { CityLayout } from '../src/sim/layout';
import {
  CIVIC_SERVICES,
  FREE_TRANSPORT_REACH,
  HAPPINESS_TAU,
  LEVELS,
  MAX_DISTRICTS,
  SERVICES,
  TAX_NEUTRAL,
  TAX_STEPS,
  UPKEEP_RATE,
} from '../src/sim/config';
import {
  cityHallBlocker,
  cityHallCost,
  civicSiteCapacity,
  demandTargets,
  developed,
  fareIncome,
  faresWaived,
  happinessTarget,
  happinessTerms,
  homeCapacity,
  income,
  labourReach,
  ledgerScale,
  plotCapacity,
  policyBlocker,
  residents,
  riders,
  siteCapacity,
  taxStep,
  transitCoverage,
  upkeep,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { migrate } from '../src/sim/save';
import { createState, type GameState } from '../src/sim/state';
import { housed, making, served, trading } from './levels';

/**
 * A city with a city hall, unless a test says otherwise.
 *
 * The hall is what makes a rate settable at all, and every test below is about
 * what a rate *does* rather than about whether the city may set one. That gate
 * has a describe block of its own at the foot of the file, which is where a
 * default of `true` here is answered for.
 */
const state = (patch: Partial<GameState> = {}): GameState => ({
  ...createState(0),
  cityHall: true,
  ...patch,
});
const at = (patch: Partial<GameState> = {}): Game => new Game(state(patch));

/** A city with services, money coming in, and nothing else moving. */
const running = (patch: Partial<GameState> = {}): Partial<GameState> => ({
  ...housed(12),
  ...trading(8),
  ...served(),
  happiness: 1,
  occupancyR: 1,
  occupancyC: 1,
  ...patch,
});

describe('the tax rate', () => {
  it('is a small number of discrete steps, neutral in the middle', () => {
    expect(TAX_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(TAX_STEPS.length).toBeLessThanOrEqual(6);
    expect(TAX_STEPS[TAX_NEUTRAL]?.income).toBe(1);
    expect(TAX_STEPS[TAX_NEUTRAL]?.mood).toBe(0);
    // Monotone in both directions: a higher rate always earns more and always
    // costs more mood, or the control would have a step nobody would ever pick.
    for (let i = 1; i < TAX_STEPS.length; i++) {
      expect(TAX_STEPS[i]?.income ?? 0).toBeGreaterThan(TAX_STEPS[i - 1]?.income ?? 0);
      expect(TAX_STEPS[i]?.mood ?? 0).toBeLessThan(TAX_STEPS[i - 1]?.mood ?? 0);
    }
  });

  it('multiplies the ledger and nothing else', () => {
    const neutral = state(running({ taxRate: TAX_NEUTRAL }));
    for (let i = 0; i < TAX_STEPS.length; i++) {
      const step = TAX_STEPS[i] as (typeof TAX_STEPS)[number];
      const taxed = state(running({ taxRate: i }));
      expect(income(taxed)).toBeCloseTo(income(neutral) * step.income, 9);
    }
  });

  it('moves the happiness target without touching the weights', () => {
    // A modifier on earned coverage, like the fire term — not a fifth weight.
    const neutral = state(running({ taxRate: TAX_NEUTRAL }));
    const base = happinessTarget(neutral);
    for (let i = 0; i < TAX_STEPS.length; i++) {
      const step = TAX_STEPS[i] as (typeof TAX_STEPS)[number];
      const taxed = state(running({ taxRate: i }));
      expect(happinessTarget(taxed)).toBeCloseTo(Math.max(0, Math.min(1, base + step.mood)), 9);
    }
  });

  it('is clamped rather than trusted, however it arrives', () => {
    expect(taxStep(state({ taxRate: -4 }))).toBe(TAX_STEPS[0]);
    expect(taxStep(state({ taxRate: 900 }))).toBe(TAX_STEPS[TAX_STEPS.length - 1]);
    const game = at();
    game.setTaxRate(99);
    expect(game.state.taxRate).toBe(TAX_STEPS.length - 1);
    game.setTaxRate(-99);
    expect(game.state.taxRate).toBe(0);
  });

  it('defaults to neutral for a save that predates it', () => {
    const back = migrate({ version: 5, homes: 4, districts: 1 }, 0);
    expect(back?.taxRate).toBe(TAX_NEUTRAL);
    // And a doctored one lands on a step that exists.
    expect(migrate({ taxRate: 42 }, 0)?.taxRate).toBe(TAX_STEPS.length - 1);
    expect(migrate({ taxRate: -3 }, 0)?.taxRate).toBe(0);
  });

  it('applies identically in one long step and in many short ones', () => {
    // Both terms are read inside `step`: income multiplies a rate, and the mood
    // term shifts a lagged target. Neither can be step-size dependent, and this
    // is the test that says so at the coarsest step the game takes.
    //
    // The city is deliberately finished: at the city limits so it cannot annex,
    // at the top level so nothing can promote, and fully covered so nothing
    // decays. What is left moving is the two things the tax rate touches.
    for (let rate = 0; rate < TAX_STEPS.length; rate++) {
      const patch = {
        ...housed(6, LEVELS - 1),
        ...trading(6, LEVELS - 1),
        ...served(),
        districts: MAX_DISTRICTS,
        taxRate: rate,
        cash: 0,
        happiness: 0.5,
      };
      const away = at(patch);
      const watched = at(patch);
      away.catchUp(3_600);
      for (let i = 0; i < 3_600; i++) watched.catchUp(1);
      expect(Math.abs(away.state.cash - watched.state.cash)).toBeLessThan(
        Math.max(1, watched.state.cash * 0.01),
      );
      expect(away.state.happiness).toBeCloseTo(watched.state.happiness, 6);
    }
  });

  it('buys income with mood rather than handing out both', () => {
    // The trade the control exists to offer, measured on a settled city: the
    // top step earns more per second and settles lower on the happiness bar.
    const low = at(running({ taxRate: 0, happiness: 0.5 }));
    const high = at(running({ taxRate: TAX_STEPS.length - 1, happiness: 0.5 }));
    for (let i = 0; i < 20; i++) {
      low.catchUp(HAPPINESS_TAU);
      high.catchUp(HAPPINESS_TAU);
    }
    expect(high.state.happiness).toBeLessThan(low.state.happiness);
    expect(income(high.state)).toBeGreaterThan(income(low.state));
  });
});

/**
 * Transport: the first civic building in the game that earns.
 */
describe('the transit depot', () => {
  const transit = SERVICES.find((s) => s.key === 'transit');

  /**
   * A city big enough for its network to be short of it.
   *
   * 40 towers is 5,600 people against a depot's 2,200, so coverage has room to
   * move — a district that is already covered outright would hide both of the
   * things transport does behind a cap at 1.
   */
  const withDepot = (patch: Partial<GameState> = {}): GameState =>
    state({
      ...housed(40, 2),
      ...trading(10),
      ...served(),
      districts: 5,
      depots: 1,
      depotStaff: 1,
      happiness: 1,
      occupancyR: 1,
      occupancyC: 1,
      ...patch,
    });

  it('joins the 2x2 pool as a fifth type, and the interleave follows', () => {
    expect(CIVIC_SERVICES.map((s) => s.key)).toContain('transit');
    expect(CIVIC_SERVICES.length).toBe(5);
    for (const districts of [1, 2, 5, 9, MAX_DISTRICTS]) {
      const s = state({ districts });
      const shared = CIVIC_SERVICES.reduce((sum, svc) => sum + siteCapacity(s, svc.key), 0);
      // Nothing stranded and nothing double-counted: the five divide the list.
      expect(shared).toBe(civicSiteCapacity(s));
    }
  });

  it('leaves a young city able to open one of everything', () => {
    // Six sites in the first district against five types. The gate that has to
    // stay open is the *land* one — the population gate is the pacing lever and
    // is supposed to bite — so this asks whether a district has room, not
    // whether a city can afford it.
    const one = state({ districts: 1 });
    for (const service of CIVIC_SERVICES) {
      expect(siteCapacity(one, service.key)).toBeGreaterThanOrEqual(1);
    }
    // And the spare site goes to the type a young city needs most of.
    expect(siteCapacity(one, 'hospital')).toBe(2);
  });

  it('earns fares, which no other civic building does', () => {
    const s = withDepot();
    expect(fareIncome(s)).toBeGreaterThan(0);
    // Scaled by covered riders, and capped at the people who actually live there.
    expect(riders(s)).toBeLessThanOrEqual(residents(s));
    const bigger = withDepot({ depots: 2 });
    expect(fareIncome(bigger)).toBeGreaterThan(fareIncome(s));
    // The rest of the civic list earns nothing at all, which is the rule this
    // one breaks: with no depot there are no fares.
    expect(fareIncome(withDepot({ depots: 0, depotStaff: 0 }))).toBe(0);
    expect(income(s)).toBeGreaterThan(income(withDepot({ depots: 0, depotStaff: 0 })));
  });

  it('carries no happiness weight at all', () => {
    expect(transit?.weight).toBe(0);
    expect(happinessTerms(withDepot()).some((t) => t.key === 'transit')).toBe(false);
    // The four weights still sum to exactly one.
    const total = happinessTerms(withDepot()).reduce((sum, t) => sum + t.weight, 0);
    expect(total).toBeCloseTo(1, 12);
    // And opening one changes happiness by nothing.
    const bare = withDepot({ depots: 0, depotStaff: 0 });
    expect(happinessTarget(withDepot())).toBeCloseTo(happinessTarget(bare), 12);
  });

  it('lifts commercial and industrial demand rather than income', () => {
    // A worker-rich city: plenty of people, not enough jobs. That is when a
    // network is worth having, and it is the only time the term is non-zero.
    const rich = { ...housed(20, LEVELS - 1), ...trading(2), ...making(1) };
    const without = state({ ...rich, ...served(), districts: 3, occupancyR: 1, occupancyC: 1, occupancyI: 1, happiness: 1 });
    const with_ = state({ ...without, depots: 3, depotStaff: 1 });
    expect(labourReach(without)).toBe(0);
    expect(labourReach(with_)).toBeGreaterThan(0);

    const before = demandTargets(without);
    const after = demandTargets(with_);
    expect(after.c).toBeGreaterThan(before.c);
    expect(after.i).toBeGreaterThan(before.i);
    // And residential is the one it does *not* lift: the same people now fill
    // more jobs, so another house is a slightly weaker argument.
    expect(after.r).toBeLessThanOrEqual(before.r);
  });
});

describe('free transport', () => {
  const running2 = (patch: Partial<GameState> = {}): GameState =>
    state({
      ...housed(40, 2),
      ...trading(10),
      ...served(),
      districts: 5,
      depots: 1,
      depotStaff: 1,
      happiness: 1,
      occupancyR: 1,
      occupancyC: 1,
      ...patch,
    });

  it('takes fares to exactly zero and strictly raises coverage', () => {
    const paid = running2({ freeTransport: false });
    const free = running2({ freeTransport: true });
    expect(fareIncome(paid)).toBeGreaterThan(0);
    expect(fareIncome(free)).toBe(0);
    expect(transitCoverage(free)).toBeGreaterThan(transitCoverage(paid));
    expect(transitCoverage(free)).toBeCloseTo(
      Math.min(1, transitCoverage(paid) * (1 + FREE_TRANSPORT_REACH)),
      9,
    );
  });

  it('is a trade rather than an upgrade', () => {
    // Short of its services, so the mood term has somewhere to go: a city
    // already sitting at 1 cannot be made happier by anything.
    const short = { hospitals: 1, police: 1, fire: 1, parks: 2 };
    const paid = running2({ ...short, freeTransport: false });
    const free = running2({ ...short, freeTransport: true });
    // Bought: mood, and the labour a wider network reaches.
    expect(happinessTarget(free)).toBeGreaterThan(happinessTarget(paid));
    expect(labourReach(free)).toBeGreaterThanOrEqual(labourReach(paid));
    // Paid for: every penny of the fares, at the same happiness.
    const level = { ...short, happiness: 0.8 };
    expect(income(running2({ ...level, freeTransport: true }))).toBeLessThan(
      income(running2({ ...level, freeTransport: false })),
    );
  });

  it('applies identically in one long step and in many short ones', () => {
    for (const free of [false, true]) {
      const patch = {
        ...housed(6, LEVELS - 1),
        ...trading(6, LEVELS - 1),
        ...served(),
        districts: MAX_DISTRICTS,
        depots: 4,
        depotStaff: 1,
        freeTransport: free,
        cash: 0,
        happiness: 0.5,
      };
      const away = at(patch);
      const watched = at(patch);
      away.catchUp(3_600);
      for (let i = 0; i < 3_600; i++) watched.catchUp(1);
      expect(Math.abs(away.state.cash - watched.state.cash)).toBeLessThan(
        Math.max(1, watched.state.cash * 0.01),
      );
      expect(away.state.happiness).toBeCloseTo(watched.state.happiness, 6);
    }
  });

  it('defaults off, with no depots, for a save that predates it', () => {
    const back = migrate(
      { version: 5, homes: 8, districts: 1, hospitals: 1, hospitalStaff: 1 },
      0,
    )!;
    expect(back.freeTransport).toBe(false);
    expect(back.depots).toBe(0);
    expect(back.depotStaff).toBe(0);
    expect(back.taxRate).toBe(TAX_NEUTRAL);
    // And the counts it did carry are inside the plot capacities.
    expect(back.homes).toBeLessThanOrEqual(homeCapacity(back));
  });
});

/**
 * Buses are a readout of `depots`, in exactly the way a building is a readout
 * of `homes`. Nothing about one reaches the save.
 */
describe('the bus fleet', () => {
  const drive = (patch: Partial<GameState>): Map<string, number> => {
    const root = new THREE.Scene();
    const cars = new Cars(root, new CityLayout(), true);
    const s = state({ ...housed(24, 1), ...trading(12), districts: 2, occupancyR: 1, ...patch });
    cars.sync(s);
    // A few frames, so routing has happened and the culling has settled.
    for (let i = 0; i < 40; i++) cars.update(0.1, new THREE.Vector3(0, 0, 0), 0);
    const found = new Map<string, number>();
    root.traverse((object) => {
      if (object instanceof THREE.InstancedMesh && object.name !== '') {
        found.set(object.name, object.count);
      }
    });
    return found;
  };

  it('puts buses on the road only once a depot is staffed', () => {
    expect(drive({ depots: 0, depotStaff: 0 }).get('traffic:bus')).toBe(0);
    // Built but not yet staffed is a depot with no drivers, and the view has to
    // agree with the ramp the simulation is running.
    expect(drive({ depots: 2, depotStaff: 0 }).get('traffic:bus')).toBe(0);
    expect(drive({ depots: 2, depotStaff: 1 }).get('traffic:bus') ?? 0).toBeGreaterThan(0);
  });

  it('takes them out of the car pool rather than adding a second fleet', () => {
    const none = drive({ depots: 0, depotStaff: 0 });
    const some = drive({ depots: 2, depotStaff: 1 });
    const total = (m: Map<string, number>): number =>
      (m.get('traffic:car') ?? 0) + (m.get('traffic:bus') ?? 0);
    expect(total(some)).toBe(total(none));
    expect(some.get('traffic:car') ?? 0).toBeLessThan(none.get('traffic:car') ?? 0);
  });

  it('keeps nothing about a bus in the save', () => {
    const s = state({ ...housed(24, 1), depots: 3, depotStaff: 1, districts: 2 });
    const before = JSON.stringify(s);
    const cars = new Cars(new THREE.Scene(), new CityLayout(), true);
    cars.sync(s);
    for (let i = 0; i < 20; i++) cars.update(0.1, new THREE.Vector3(0, 0, 0), 0);
    expect(JSON.stringify(s)).toBe(before);
    for (const key of Object.keys(s)) expect(key.toLowerCase()).not.toContain('bus');
  });
});

describe('the city hall', () => {
  /**
   * The gate everything above is a test of the far side of.
   *
   * A rate is policy and policy needs somebody to set it, so a city with no
   * hall runs at TAX_NEUTRAL with fares on — which is exactly what a fresh city
   * already got, so nothing about the opening minutes changes. What makes this
   * worth testing rather than asserting once is the *storage*: the player's
   * choices are kept rather than overwritten, so a city that buys a hall goes
   * straight back onto the rate it had.
   */
  it('is not there to begin with', () => {
    expect(createState(0).cityHall).toBe(false);
  });

  it('runs the city at neutral with fares on until it is built', () => {
    const ungoverned = state({
      cityHall: false,
      taxRate: TAX_STEPS.length - 1,
      freeTransport: true,
      ...housed(24),
      depots: 2,
      depotStaff: 1,
    });
    expect(taxStep(ungoverned)).toBe(TAX_STEPS[TAX_NEUTRAL]);
    expect(faresWaived(ungoverned)).toBe(false);
    expect(fareIncome(ungoverned)).toBeGreaterThan(0);
    // The neutral reading is exactly what a city with no rate set at all gets,
    // which is the whole claim that the opening is unchanged.
    const fresh = state({ cityHall: false, ...housed(24), depots: 2, depotStaff: 1 });
    expect(income(ungoverned)).toBeCloseTo(income(fresh), 9);
  });

  it('keeps the choices it was not allowed to act on', () => {
    // The migration case, as a property: a stored rate is a decision the player
    // made, and losing it silently is worse than not acting on it.
    const stored = { taxRate: TAX_STEPS.length - 1, freeTransport: true };
    const before = state({ ...stored, cityHall: false, ...housed(24), depots: 2, depotStaff: 1 });
    const after = state({ ...stored, cityHall: true, ...housed(24), depots: 2, depotStaff: 1 });
    expect(before.taxRate).toBe(after.taxRate);
    expect(before.freeTransport).toBe(after.freeTransport);
    // And acting on them is exactly what the hall changes.
    expect(taxStep(after)).toBe(TAX_STEPS[TAX_STEPS.length - 1]);
    expect(faresWaived(after)).toBe(true);
    expect(fareIncome(after)).toBe(0);
  });

  it('refuses the controls rather than taking them silently', () => {
    const game = at({ cityHall: false });
    game.setTaxRate(TAX_STEPS.length - 1);
    game.setFreeTransport(true);
    game.setAutoDevelop(true);
    expect(game.state.taxRate).toBe(TAX_NEUTRAL);
    expect(game.state.freeTransport).toBe(false);
    expect(game.state.autoDevelop).toBe(false);
    expect(policyBlocker(game.state)).toBe('Needs a city hall');
  });

  it('takes them the moment the hall is up', () => {
    const game = at({ cityHall: false, cash: cityHallCost() });
    expect(game.buildCityHall()).toBe(true);
    expect(game.state.cash).toBeCloseTo(0, 9);
    game.setTaxRate(TAX_STEPS.length - 1);
    game.setFreeTransport(true);
    game.setAutoDevelop(true);
    expect(game.state.taxRate).toBe(TAX_STEPS.length - 1);
    expect(game.state.freeTransport).toBe(true);
    expect(game.state.autoDevelop).toBe(true);
    expect(policyBlocker(game.state)).toBeNull();
  });

  it('is bought once and only once', () => {
    const game = at({ cityHall: false, cash: cityHallCost() * 4 });
    expect(game.buildCityHall()).toBe(true);
    expect(game.buildCityHall()).toBe(false);
    expect(cityHallBlocker(game.state)).toBe('Built');
    expect(game.state.cash).toBeCloseTo(cityHallCost() * 3, 9);
  });

  it('will not develop the city away without one', () => {
    // The stored switch survives — a v8 save may arrive with it on — and the
    // *effect* is what the gate holds back.
    const game = at({ cityHall: false, cash: 1e6, ...housed(4) });
    Object.assign(game.state, { autoDevelop: true });
    const before = game.state.homes + game.state.shops + game.state.industry;
    for (let i = 0; i < 600; i++) game.advance(0.1);
    expect(game.state.homes + game.state.shops + game.state.industry).toBe(before);

    Object.assign(game.state, { cityHall: true });
    for (let i = 0; i < 600; i++) game.advance(0.1);
    expect(game.state.homes + game.state.shops + game.state.industry).toBeGreaterThan(before);
  });

  it('costs nothing to happiness and nothing to the land the city sells', () => {
    // Two things it deliberately does not do. The four happiness weights sum to
    // exactly 1 and a UI gate is not worth re-opening that; and the square it
    // stands on came out of land that was already spare, so the annexation gate
    // does not move under a player who has never opened the tab.
    // Explicitly ungoverned: the helper at the top of this file hands every
    // other test a hall, and this pair is the one comparison that needs both.
    const bare = state({ cityHall: false, ...housed(24), ...trading(45), ...making(13) });
    const governed = { ...bare, cityHall: true };
    expect(happinessTarget(governed)).toBe(happinessTarget(bare));
    expect(developed(governed)).toBe(developed(bare));
    expect(plotCapacity(governed)).toBe(plotCapacity(bare));
  });

  it('joins the wage bill', () => {
    const bare = state({ cityHall: false, ...housed(24), hospitals: 1, hospitalStaff: 1 });
    const governed = { ...bare, cityHall: true };
    expect(upkeep(governed)).toBeGreaterThan(upkeep(bare));
    expect(upkeep(governed) - upkeep(bare)).toBeCloseTo(
      UPKEEP_RATE * cityHallCost() * ledgerScale(bare),
      9,
    );
  });
});
