import { describe, expect, it } from 'vitest';
import {
  ANNEX_MIN_OCCUPANCY,
  AUTO_ANNEX_RESERVE,
  CATCHUP_MAX_ANNEXES,
  MAX_DISTRICTS,
} from '../src/sim/config';
import {
  abandonedBuildings,
  activeDeveloped,
  annexBlocker,
  annexCost,
  canAnnex,
  developed,
  homeCapacity,
  industryCapacity,
  plotCapacity,
  shopCapacity,
  willAutoAnnex,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { cohortOf, createState, type GameState } from '../src/sim/state';
import { built } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

/** A district built out past the gate, with the treasury to match. */
const ready = (patch: Partial<GameState> = {}): Partial<GameState> => {
  const one = createState(0);
  return {
    ...built(homeCapacity(one), shopCapacity(one), industryCapacity(one)),
    hospitals: 2,
    police: 2,
    fire: 1,
    schools: 1,
    universities: 1,
    hospitalStaff: 1,
    policeStaff: 1,
    fireStaff: 1,
    schoolStaff: 1,
    universityStaff: 1,
    cash: 1e6,
    ...patch,
  };
};

describe('the annexation trigger', () => {
  it('reads working buildings, not standing ones', () => {
    const full = state(ready());
    expect(activeDeveloped(full)).toBe(developed(full));
    expect(activeDeveloped(full)).toBeGreaterThanOrEqual(ANNEX_MIN_OCCUPANCY);

    // The same city with a third of its housing boarded up. Nothing has been
    // demolished — every plot still has something on it — so `developed` has
    // not moved, and the trigger must have.
    const decayed = state({
      ...ready(),
      abandonedR: 8,
      homeLevels: [homeCapacity(full) - 8, 0, 0, 0],
    });
    expect(abandonedBuildings(decayed)).toBe(8);
    expect(developed(decayed)).toBe(developed(full));
    expect(activeDeveloped(decayed)).toBeLessThan(activeDeveloped(full));
    expect(activeDeveloped(decayed)).toBeCloseTo(
      (developed(full) * plotCapacity(full) - 8) / plotCapacity(full),
      12,
    );
  });

  /**
   * The point of the distinction, stated as a scenario: a city that has given
   * up on a fifth of its plots must not read as full enough to want more land.
   * Expanding because the city is full of ruins is exactly backwards.
   */
  it('will not expand a city that is full of ruins', () => {
    const homes = homeCapacity(createState(0));
    // A district is 89 developable plots — 82 for sale plus the seven civic and
    // university sites — so writing off the whole housing stock takes the
    // working share well under the gate whatever else is standing.
    const ruined = state({
      ...ready(),
      abandonedR: homes,
      abandonedI: industryCapacity(createState(0)),
      homeLevels: cohortOf(),
      industryLevels: cohortOf(),
    });
    expect(activeDeveloped(ruined)).toBeLessThan(ANNEX_MIN_OCCUPANCY);
    expect(canAnnex(ruined)).toBe(false);
    expect(willAutoAnnex(ruined)).toBe(false);
    expect(annexBlocker(ruined)).toMatch(/developed/);
  });
});

describe('annexing itself', () => {
  it('happens without anyone pressing anything', () => {
    const game = at(ready());
    expect(game.state.districts).toBe(1);
    game.advance(0.1);
    expect(game.state.districts).toBe(2);
  });

  it('waits for a surplus, where the button does not', () => {
    // Exactly the price: the override will take it, the automatic pass will not.
    const priced = state(ready({ cash: 0 }));
    const cost = annexCost(priced);
    const tight = state(ready({ cash: cost }));
    expect(canAnnex(tight)).toBe(true);
    expect(willAutoAnnex(tight)).toBe(false);
    expect(annexBlocker(tight)).toBeNull();

    const game = at(ready({ cash: cost }));
    for (let i = 0; i < 5; i++) game.advance(0.1);
    // Income moves the treasury, so this only holds while it is still short of
    // the reserve — checked by asking the same question the pass asks.
    if (!willAutoAnnex(game.state)) expect(game.state.districts).toBe(1);
    expect(game.annex()).toBe(true);
    expect(game.state.districts).toBe(2);
  });

  it('fires on its own once the reserve is there', () => {
    const cost = annexCost(state(ready({ cash: 0 })));
    const game = at(ready({ cash: cost * (1 + AUTO_ANNEX_RESERVE) }));
    expect(willAutoAnnex(game.state)).toBe(true);
    game.advance(0.1);
    expect(game.state.districts).toBe(2);
  });

  it('refuses past the city limits, however rich', () => {
    const maxed = state(ready({ districts: MAX_DISTRICTS, cash: 1e30 }));
    expect(canAnnex(maxed)).toBe(false);
    expect(willAutoAnnex(maxed)).toBe(false);
    expect(annexBlocker(maxed)).toBe('City limits reached');
  });

  it('says which of the three things it is waiting for', () => {
    const empty = state({ cash: 1e12 });
    expect(annexBlocker(empty)).toMatch(/developed/);

    const broke = state(ready({ cash: 0 }));
    expect(annexBlocker(broke)).toBe('Saving for the next district');
    expect(canAnnex(broke)).toBe(false);

    const going = state(ready());
    expect(annexBlocker(going)).toBeNull();
  });
});

describe('the catch-up guard', () => {
  it('never takes more than the cap in one call, however long the absence', () => {
    // Auto-development on, or the city annexes once and then sits on empty land
    // it never builds out — the trigger is a *share*, so a second district is
    // only earned by filling the first.
    const game = at(ready({ cash: 1e30, autoDevelop: true, cityHall: true }));
    const report = game.catchUp(12 * 3_600);
    expect(report.districts).toBe(CATCHUP_MAX_ANNEXES);
    expect(game.state.districts).toBe(1 + CATCHUP_MAX_ANNEXES);
  });

  it('gives the next absence its own budget rather than spending it once', () => {
    const game = at(ready({ cash: 1e30, autoDevelop: true, cityHall: true }));
    game.catchUp(12 * 3_600);
    const again = game.catchUp(12 * 3_600);
    expect(again.districts).toBeGreaterThan(0);
    expect(again.districts).toBeLessThanOrEqual(CATCHUP_MAX_ANNEXES);
  });

  it('is unlimited while the player is watching', () => {
    // A district that arrives while you are looking at it is a thing that
    // happened; the guard is about the ones that arrive while you are not.
    //
    // The window is 600s rather than the 200s this watched before TRADE_LADDER,
    // and the reason is a real slowdown rather than a flaky bound: the gate is a
    // *share*, so a third district is earned by filling the second, and a city
    // whose commerce is worth more per plot buys fewer shops to fill it with.
    // Measured, the first two arrive inside a second — the city starts past the
    // gate — and the third at 310s where it used to arrive inside 200s. What is
    // asserted is unchanged: the cap does not apply while the player is here.
    const game = at(ready({ cash: 1e30, autoDevelop: true, cityHall: true }));
    for (let i = 0; i < 6_000; i++) game.advance(0.1);
    expect(game.state.districts).toBeGreaterThan(1 + CATCHUP_MAX_ANNEXES);
  });

  it('reports what it took while you were away', () => {
    const game = at(ready({ cash: 1e30, autoDevelop: true, cityHall: true }));
    const report = game.catchUp(6 * 3_600);
    expect(report.districts).toBeGreaterThan(0);
    // And the cash it spent doing it is in the ledger rather than vanishing:
    // an unrecorded outgoing reads back as income that never arrived.
    expect(report.spent).toBeGreaterThan(0);
  });
});
