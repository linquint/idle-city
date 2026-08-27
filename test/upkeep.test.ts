import { describe, expect, it } from 'vitest';
import {
  AUTO_ANNEX_RESERVE,
  CIVIC_GROWTH,
  COVERAGE_GRACE_PLOTS,
  SERVICES,
  UPKEEP_ARREARS_TAU,
  UPKEEP_GROWTH,
  UPKEEP_KEEP_SHARE,
  UPKEEP_RATE,
  UPKEEP_RESERVE_SECONDS,
} from '../src/sim/config';
import {
  annexCost,
  arrearsStep,
  canAnnex,
  civicPayroll,
  income,
  ledgerScale,
  netIncome,
  serviceUpkeep,
  upkeep,
  upkeepReserve,
  willAutoAnnex,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { createState, type GameState } from '../src/sim/state';
import { built, housed, mix, trading } from './levels';

/**
 * The wage bill, and the one thing it must never be able to do.
 *
 * Upkeep is the first term in this game that takes money *out* of the treasury
 * on a clock, so it is the first thing that can drive a city somewhere it cannot
 * come back from. Most of this file is about that: cash cannot go below zero,
 * cash cannot be *held* at zero, and a city that has browned out recovers when
 * its income does. The rest checks that the bill is priced the way the config
 * says it is, since the constants were measured against exactly these readings.
 */
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** Runs a game forward in real ticks. */
const play = (game: Game, seconds: number): Game => {
  for (let i = 0; i < seconds * 10; i++) game.advance(0.1);
  return game;
};

/**
 * A city whose wage bill is past what it earns.
 *
 * Built out of universities rather than out of many hospitals, because the
 * university is the type with a base big enough to outrun a small city's rent —
 * which is the same reason it is 87% of a built-out city's bill.
 */
const insolvent = (patch: Partial<GameState> = {}): GameState =>
  state({ ...housed(2), universities: 2, universityStaff: 1, happiness: 1, ...patch });

/** A city with services standing and fully staffed, so the bill is live. */
const serving = (patch: Partial<GameState> = {}): Partial<GameState> => ({
  hospitals: 2,
  police: 1,
  fire: 1,
  hospitalStaff: 1,
  policeStaff: 1,
  fireStaff: 1,
  ...patch,
});

describe('what the bill is made of', () => {
  it('is nothing at all for a city that has built no civic buildings', () => {
    expect(upkeep(state(built(40, 20, 10)))).toBe(0);
    expect(netIncome(state(built(40, 20, 10)))).toBe(income(state(built(40, 20, 10))));
  });

  it('is nothing while a building is still hiring', () => {
    // The staffing factor, which is what stops the bill arriving before the
    // coverage does — and, more importantly, what lets an unpaid payroll get
    // cheaper. A hospital opened this instant has nobody on the books.
    const opening = state({ ...housed(20), hospitals: 1, hospitalStaff: 0 });
    expect(upkeep(opening)).toBe(0);
    const staffed = state({ ...housed(20), hospitals: 1, hospitalStaff: 1 });
    expect(upkeep(staffed)).toBeGreaterThan(0);
    // And exactly proportional in between, so half a payroll is half a bill.
    const half = state({ ...housed(20), hospitals: 1, hospitalStaff: 0.5 });
    expect(upkeep(half)).toBeCloseTo(upkeep(staffed) / 2, 9);
  });

  it('sums to the per-type breakdown the panel would show', () => {
    const s = state({ ...built(20, 10, 5), ...serving({ schools: 1, schoolStaff: 1 }) });
    let sum = 0;
    for (const service of SERVICES) sum += serviceUpkeep(s, service);
    expect(sum).toBeCloseTo(upkeep(s), 9);
  });

  it('compounds over a type\'s own count, gentler than its price does', () => {
    // The constraint the brief put on UPKEEP_GROWTH, checked rather than
    // trusted: at CIVIC_GROWTH the wage bill would climb exactly as fast as the
    // price and the second hospital would be unaffordable forever.
    expect(UPKEEP_GROWTH).toBeLessThan(CIVIC_GROWTH);
    const one = state({ ...housed(24), hospitals: 1, hospitalStaff: 1 });
    const two = state({ ...housed(24), hospitals: 2, hospitalStaff: 1 });
    expect(upkeep(two)).toBeGreaterThan(upkeep(one) * 2 * 0.999);
    expect(upkeep(two)).toBeLessThan(upkeep(one) * (1 + CIVIC_GROWTH));
  });

  it('tracks the ledger rather than falling away as the city climbs', () => {
    // The measurement the scale term exists for, as an assertion. A wage bill
    // scaled by `cityScale` alone reads 4.6% of the ledger at one district of
    // apartments and 0.0% at forty-nine of megastructures — see `ledgerScale`,
    // which carries the numbers. The share has to be flat instead.
    //
    // The same land at four rungs of the ladder, with the same services on it:
    // `housedOn`-style land held fixed and the buildings promoted under it.
    const shares = [0, 1, 2, 4].map((level) => {
      const foot = level >= 2 ? 2 : 1;
      const homes = Math.floor(24 / foot);
      const shops = Math.floor(45 / foot);
      const s = state({
        homes,
        homeLevels: mix(...Array.from({ length: 5 }, (_, l) => (l === level ? homes : 0))),
        mergedR: level >= 2 ? homes : 0,
        occupancyR: 1,
        shops,
        shopLevels: mix(...Array.from({ length: 5 }, (_, l) => (l === level ? shops : 0))),
        mergedC: level >= 2 ? shops : 0,
        occupancyC: 1,
        ...serving(),
        happiness: 1,
      });
      return upkeep(s) / income(s);
    });
    for (const share of shares) {
      expect(share).toBeCloseTo(shares[0] as number, 6);
    }
  });

  it('is one for a fresh city, so the rate means what the comment says', () => {
    // UPKEEP_RATE is stated as a payback period measured at the opening, which
    // is only true if `ledgerScale` is exactly 1 there.
    expect(ledgerScale(createState(0))).toBe(1);
    const one = state({ hospitals: 1, hospitalStaff: 1 });
    const hospital = SERVICES.find((service) => service.key === 'hospital');
    expect(hospital).toBeDefined();
    expect(upkeep(one)).toBeCloseTo(UPKEEP_RATE * (hospital?.base ?? 0), 9);
  });

  it('does not fall when the city gets poorer', () => {
    // Occupancy, mood, the tax rate and fires are all deliberately out of the
    // scale term: a bill that shrank with the things that make a city poorer
    // would cancel the pressure it exists to apply. Same buildings, worse city.
    const good = state({ ...built(24, 45, 13), ...serving(), happiness: 1 });
    const bad = state({
      ...built(24, 45, 13),
      ...serving(),
      happiness: 0.1,
      occupancyR: 0.2,
      occupancyC: 0.2,
      occupancyI: 0.2,
      taxRate: 0,
    });
    expect(upkeep(bad)).toBeCloseTo(upkeep(good), 9);
    // And the share of the ledger therefore climbs as things go wrong, which is
    // what makes the arrears rule reachable at all.
    expect(upkeep(bad) / income(bad)).toBeGreaterThan(upkeep(good) / income(good));
  });

  it('leaves the gross line alone', () => {
    // The rule the whole split rests on: `income` is what the buildings earn,
    // and every marginal readout in the HUD reads it that way. A hospital that
    // changed it would make the inspector quietly wrong.
    const bare = state(built(24, 10, 4));
    const served = state({ ...built(24, 10, 4), ...serving() });
    expect(income(served)).toBeCloseTo(income(bare), 9);
    expect(netIncome(served)).toBeLessThan(income(served));
  });
});

describe('the arrears decay', () => {
  /**
   * The house rule every lagged quantity in this game is held to. The linear
   * form goes negative the moment `dt` passes TAU, and catch-up steps whole
   * minutes — so an hour of arrears taken in one step has to leave the same
   * payroll as an hour taken in thirty-six thousand ticks.
   */
  it('lands in the same place at any step size', () => {
    const chase = (shortfall: number, dt: number, total: number): number => {
      let staff = 1;
      for (let elapsed = 0; elapsed < total - 1e-9; elapsed += dt) {
        staff += (0 - staff) * arrearsStep(dt, shortfall);
      }
      return staff;
    };

    for (const shortfall of [1, 0.35]) {
      expect(chase(shortfall, 3600, 3600)).toBeCloseTo(chase(shortfall, 1, 3600), 9);
      const coarse = chase(shortfall, UPKEEP_ARREARS_TAU, UPKEEP_ARREARS_TAU * 2);
      const fine = chase(shortfall, 0.05, UPKEEP_ARREARS_TAU * 2);
      expect(Math.abs(coarse - fine)).toBeLessThan(0.01);
    }
  });

  it('never closes more than the whole gap, and never opens one', () => {
    for (const dt of [0.1, 1, 60, 1800, 43_200]) {
      for (const shortfall of [0, 0.5, 1, 9, -3]) {
        const k = arrearsStep(dt, shortfall);
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThanOrEqual(1);
      }
    }
    // A city that paid in full loses nothing at all, however long the step.
    expect(arrearsStep(43_200, 0)).toBe(0);
  });
});

describe('the bankruptcy rule', () => {
  /**
   * A city holding a university it could never have bought, with nothing in the
   * bank. The pathological case the keep-share was found on: without it the
   * treasury sits at exactly 0.00 forever and the player has no move.
   *
   * Housed at COVERAGE_GRACE_PLOTS and served by nothing, which is what a city
   * that spent everything on one building looks like. Both halves of that are
   * load-bearing: below COVERAGE_GRACE_PLOTS a coverage shortfall is discounted
   * for size, so a four-home version of this fixture is a comfortable city and
   * measures the opening ramp instead of the arrears rule this block is about.
   */
  const broke = (): Game =>
    at({
      cash: 0,
      ...housed(COVERAGE_GRACE_PLOTS),
      occupancyR: 0.5,
      universities: 1,
      universityStaff: 1,
    });

  it('cannot drive cash below zero', () => {
    const game = broke();
    for (let i = 0; i < 3600 * 10; i++) {
      game.advance(0.1);
      expect(game.state.cash).toBeGreaterThanOrEqual(0);
    }
  });

  it('cannot hold cash at zero either', () => {
    // The distinction that matters. "Cash never goes negative" is satisfied by a
    // city permanently pinned at nothing, which is the deadlock the brief
    // forbids: a city that cannot afford its only hospital must still be able to
    // climb out. The treasury has to *grow*.
    const game = broke();
    const marks = [];
    for (let hour = 0; hour < 4; hour++) {
      play(game, 3600);
      marks.push(game.state.cash);
    }
    expect(netIncome(game.state)).toBeLessThan(0);
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i] as number).toBeGreaterThan(marks[i - 1] as number);
    }
    // And it grows at the stated share of gross income, not at some remainder.
    const perHour = (marks[3] as number) - (marks[2] as number);
    expect(perHour).toBeCloseTo(income(game.state) * UPKEEP_KEEP_SHARE * 3600, -1);
  });

  it('pays the shortfall out of staffing rather than out of buildings', () => {
    const game = broke();
    const before = game.state.universities;
    play(game, 3600);
    expect(game.state.universities).toBe(before);
    expect(game.state.universityStaff).toBeLessThan(1);
    expect(game.state.universityStaff).toBeGreaterThan(0);
  });

  it('recovers the payroll when the income comes back', () => {
    const game = broke();
    play(game, 1800);
    const browned = game.state.universityStaff;
    expect(browned).toBeLessThan(1);

    // The income returns — the housing the city was short of, at the same level,
    // and the parks that make collecting rent on it worth anything — so what
    // changed is the rent and not the wage bill. Neither half moves the bill:
    // `ledgerScale` reads commerce, industry and districts, and recreation
    // carries no payroll at all. Commerce would have moved both, which is the
    // distinction here — a city that answered its arrears with shops would find
    // the bill had grown with them.
    const rich = new Game({ ...game.state, ...housed(24), parks: 4, happiness: 1 });
    play(rich, 900);
    expect(rich.state.universityStaff).toBeGreaterThan(browned);
    expect(netIncome(rich.state)).toBeGreaterThan(0);
  });

  it('does not brick the opening', () => {
    // The first hospital is the purchase the whole tutorial is built around, so
    // a city that buys it the moment it can must still be able to go on
    // playing. Bought as early as possible, then left alone for ten minutes.
    const game = new Game(createState(0));
    const hospital = SERVICES.find((service) => service.key === 'hospital');
    expect(hospital).toBeDefined();
    let opened = false;
    for (let i = 0; i < 6000; i++) {
      game.advance(0.1);
      while (game.buildHome());
      if (!opened && hospital && game.buildService(hospital)) opened = true;
    }
    expect(opened).toBe(true);
    expect(game.state.cash).toBeGreaterThan(0);
    expect(game.state.hospitalStaff).toBeGreaterThan(0.9);
    expect(netIncome(game.state)).toBeGreaterThan(0);
  });

  it('does not compound across a twelve-hour absence', () => {
    // The offline guard. A city left with a bill it cannot pay has to come back
    // browned out and solvent, not exponentially anything.
    const game = broke();
    const report = game.catchUp(12 * 3600);
    expect(game.state.cash).toBeGreaterThan(0);
    expect(Number.isFinite(game.state.cash)).toBe(true);
    expect(report.wages).toBeGreaterThan(0);
    expect(report.wages).toBeLessThanOrEqual(report.earned);
    expect(game.state.universityStaff).toBeGreaterThan(0);
    expect(game.state.universityStaff).toBeLessThan(1);
  });

  it('credits an absence the same way watching does', () => {
    // Step-size invariance through the game rather than through `arrearsStep`,
    // so a `step` that stopped using it would be caught too.
    const patch = {
      cash: 0,
      ...housed(4),
      occupancyR: 0.5,
      hospitals: 1,
      hospitalStaff: 1,
      universities: 1,
      universityStaff: 1,
    };
    const away = at(patch);
    const watched = play(at(patch), 3600);
    away.catchUp(3600);
    // Within a tenth rather than to the cent, and the reason is the same one
    // `demandTargets` has: `arrearsStep` is exact at any step size, but the
    // shortfall it is handed is a *target* that moves inside the step — the
    // payroll shrinking is what makes the bill affordable again. A 60-second
    // catch-up step holds it at the value it opened on and so over-decays, by
    // 5% of a payroll over an hour of arrears. Tightening this would mean
    // integrating the feedback rather than the quantity, which is a different
    // and much larger claim than the one this file is making.
    const gap = Math.abs(away.state.universityStaff - watched.state.universityStaff);
    expect(gap).toBeLessThan(0.1);
    expect(away.state.universityStaff).toBeLessThan(1);
    expect(Math.abs(away.state.cash - watched.state.cash)).toBeLessThan(
      Math.max(1, watched.state.cash * 0.05),
    );
  });
});

describe('spending against net', () => {
  it('holds nothing back while the ledger is positive', () => {
    expect(upkeepReserve(state(built(24, 45, 13)))).toBe(0);
    expect(upkeepReserve(state({ ...built(24, 45, 13), ...serving() }))).toBe(0);
  });

  it('holds back a minute of the shortfall once it is not', () => {
    const s = insolvent({ cash: 10_000 });
    expect(netIncome(s)).toBeLessThan(0);
    expect(upkeepReserve(s)).toBeCloseTo(-netIncome(s) * UPKEEP_RESERVE_SECONDS, 9);
  });

  it('stops auto-development adding to a payroll it cannot pay', () => {
    // Cash enough to buy plenty, and a wage bill it cannot cover. The cash
    // reserve alone would not catch this — a minute of the shortfall is nothing
    // against a full treasury — so the rule is about *what* is bought rather
    // than how much is left: nothing that adds to the payroll while the payroll
    // is already more than the city earns.
    const game = at({ ...insolvent({ cash: 500_000 }), autoDevelop: true, cityHall: true });
    expect(netIncome(game.state)).toBeLessThan(0);
    const civic = (): number => game.state.hospitals + game.state.police + game.state.fire;

    // Checked tick by tick rather than at the end, and that is the honest form
    // of the claim: an away city *should* buy services again the moment it can
    // pay for them, and this one earns its way there inside a couple of minutes.
    // What must never happen is a purchase made while the ledger is still short.
    //
    // Read on the tick's *closing* state, because that is when the pass runs —
    // auto-development is the last thing `step` does, after the integrators have
    // moved occupancy and happiness under it. A building that has just landed
    // has nobody on its payroll yet (see the staffing factor), so the bill is
    // the same either side of the purchase and the reading is not self-fulfilling.
    let sawShortfall = false;
    for (let i = 0; i < 1_200; i++) {
      if (netIncome(game.state) < 0) sawShortfall = true;
      const before = civic();
      game.advance(0.1);
      if (civic() > before) expect(netIncome(game.state)).toBeGreaterThanOrEqual(0);
    }
    expect(sawShortfall).toBe(true);
    // And it is still allowed to earn its way out, which is the half that keeps
    // this from being another deadlock.
    expect(game.state.homes).toBeGreaterThan(2);
  });

  it('keeps the automatic annex from spending into a brownout', () => {
    // Everything `canAnnex` asks for, and a ledger that cannot carry what the
    // city already runs. The button is still live — that is the override — and
    // the automatic pass is not.
    const bare = {
      districts: 1,
      ...built(24, 45, 13),
      happiness: 1,
    };
    const solvent = state({ ...bare, cash: 1e6 });
    expect(willAutoAnnex(solvent)).toBe(true);

    const short = { ...bare, universities: 15, universityStaff: 1 };
    const probe = state({ ...short, cash: 1e6 });
    expect(netIncome(probe)).toBeLessThan(0);
    // Cash placed between the two gates: past what the surplus rule asks on its
    // own, short of what it asks once the shortfall is reserved against.
    const surplus = annexCost(probe) * (1 + AUTO_ANNEX_RESERVE);
    const held = upkeepReserve(probe);
    expect(held).toBeGreaterThan(0);
    const s = state({ ...short, cash: surplus + held / 2 });
    expect(canAnnex(s)).toBe(true);
    expect(willAutoAnnex(s)).toBe(false);
    expect(willAutoAnnex(state({ ...short, cash: surplus + held * 2 }))).toBe(true);
  });
});

describe('the payroll read the calibrator sweeps', () => {
  it('is the sum the charged bill is built from', () => {
    // `civicPayroll` exists so tools/upkeep.calibrate.mjs can sweep
    // UPKEEP_GROWTH without reimplementing the formula. If the two ever came
    // apart the sweep would be measuring a curve the game does not charge.
    const s = state({ ...built(24, 45, 13), ...serving({ schools: 2, schoolStaff: 0.5 }) });
    expect(UPKEEP_RATE * civicPayroll(s) * ledgerScale(s)).toBeCloseTo(upkeep(s), 9);
    // And it is monotone in the growth it is handed, so a sweep reads in order.
    expect(civicPayroll(s, 1.2)).toBeGreaterThan(civicPayroll(s, 1));
  });

  it('counts nothing for a city with no civic buildings', () => {
    expect(civicPayroll(state(trading(20)))).toBe(0);
  });
});
