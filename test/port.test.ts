import { describe, expect, it } from 'vitest';
import {
  CARGO_EXPORT_LIFT,
  EXPORT_BASE,
  EXPORT_PER_DISTRICT,
  MAX_DISTRICTS,
  TERMINALS,
  VISITOR_SPEND,
  VISITORS_PER_RESIDENT,
  type Terminal,
} from '../src/sim/config';
import {
  canBuildTerminal,
  cruiseIncome,
  demandTargets,
  exportMarket,
  hasCoast,
  income,
  residents,
  terminalBlocker,
  terminalCapacity,
  terminalCost,
  terminalCount,
  terminalReadings,
  visitors,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { coastalDistricts, districtCoord, districtIsCoastal, portDistrict } from '../src/sim/layout';
import { migrate } from '../src/sim/save';
import { createState, type GameState } from '../src/sim/state';
import { housedOn } from './levels';

const cruise = TERMINALS.find((t) => t.key === 'cruise') as Terminal;
const cargo = TERMINALS.find((t) => t.key === 'cargo') as Terminal;

/** The first district count at which the city owns a coastal district. */
const FIRST_COAST = portDistrict(MAX_DISTRICTS) + 1;

/** A city of `districts` districts with `homes` top-level homes in it. */
function city(districts: number, patch: Partial<GameState> = {}): GameState {
  const s = createState(0);
  s.districts = districts;
  s.cash = 1e12;
  s.happiness = 1;
  return Object.assign(s, patch);
}

describe('where a port may be built', () => {
  it('offers no berth until the city has annexed a coastal district', () => {
    expect(FIRST_COAST).toBeGreaterThan(1);
    for (let n = 1; n < FIRST_COAST; n++) {
      const s = city(n);
      expect(hasCoast(s)).toBe(false);
      expect(terminalCapacity(s)).toBe(0);
      expect(canBuildTerminal(s, cruise)).toBe(false);
      expect(canBuildTerminal(s, cargo)).toBe(false);
      expect(terminalBlocker(s, cruise)).toBe('No coast yet');
    }
    const reached = city(FIRST_COAST);
    expect(hasCoast(reached)).toBe(true);
    expect(terminalCapacity(reached)).toBe(1);
    expect(canBuildTerminal(reached, cruise)).toBe(true);
    expect(terminalBlocker(reached, cruise)).toBeNull();
  });

  it('gives one berth of each kind per coastal district, and no more', () => {
    for (let n = 1; n <= MAX_DISTRICTS; n++) {
      const s = city(n);
      let coastal = 0;
      for (let i = 0; i < n; i++) {
        const c = districtCoord(i);
        if (districtIsCoastal(c.x, c.z)) coastal++;
      }
      expect(terminalCapacity(s)).toBe(coastal);
      expect(coastalDistricts(n)).toBe(coastal);
    }
  });

  it('stops selling berths once every quay is taken', () => {
    const s = city(MAX_DISTRICTS);
    const berths = terminalCapacity(s);
    expect(berths).toBeGreaterThan(1);
    s.cruiseTerminals = berths;
    expect(canBuildTerminal(s, cruise)).toBe(false);
    expect(terminalBlocker(s, cruise)).toBe('No berths left');
    // The two kinds are counted apart: filling the cruise berths does not use
    // up the cargo ones, since a quay carries one of each.
    expect(canBuildTerminal(s, cargo)).toBe(true);
    expect(terminalBlocker(s, cargo)).toBeNull();
  });

  it('prices a berth on its own count, exponentially', () => {
    const s = city(MAX_DISTRICTS);
    for (const terminal of TERMINALS) {
      let previous = 0;
      for (let built = 0; built < 6; built++) {
        const at = city(MAX_DISTRICTS, {
          cruiseTerminals: terminal.key === 'cruise' ? built : 0,
          cargoTerminals: terminal.key === 'cargo' ? built : 0,
        });
        const cost = terminalCost(at, terminal);
        expect(cost).toBeGreaterThan(previous);
        previous = cost;
      }
      expect(terminalCost(s, terminal)).toBe(terminal.base);
    }
  });

  it('takes the cash and the berth when one is built', () => {
    const game = new Game(city(MAX_DISTRICTS));
    const before = game.state.cash;
    const price = terminalCost(game.state, cruise);
    expect(game.buildTerminal(cruise)).toBe(true);
    expect(game.state.cruiseTerminals).toBe(1);
    expect(game.state.cargoTerminals).toBe(0);
    expect(game.state.cash).toBeCloseTo(before - price, 6);
    expect(terminalCount(game.state, 'cruise')).toBe(1);
  });

  it('refuses one the city cannot pay for or has no coast for', () => {
    const broke = new Game(city(MAX_DISTRICTS, { cash: 1 }));
    expect(broke.buildTerminal(cruise)).toBe(false);
    expect(broke.state.cruiseTerminals).toBe(0);

    const inland = new Game(city(1));
    expect(inland.buildTerminal(cargo)).toBe(false);
    expect(inland.state.cargoTerminals).toBe(0);
  });

  it('reports both kinds in one read for the panel', () => {
    const s = city(MAX_DISTRICTS, { cruiseTerminals: 2 });
    const rows = terminalReadings(s);
    expect(rows.map((row) => row.terminal.key)).toEqual(['cruise', 'cargo']);
    expect(rows[0]?.built).toBe(2);
    expect(rows[1]?.built).toBe(0);
    for (const row of rows) expect(row.allowed).toBe(terminalCapacity(s));
  });
});

describe('what a cruise terminal earns', () => {
  const populous = (patch: Partial<GameState> = {}): GameState =>
    city(MAX_DISTRICTS, { ...housedOn(200, 2), ...patch });

  it('lands nobody until a berth is open', () => {
    expect(visitors(populous())).toBe(0);
    expect(cruiseIncome(populous())).toBe(0);
  });

  it('scales with the city it serves and with its mood', () => {
    const happy = populous({ cruiseTerminals: 1 });
    expect(visitors(happy)).toBeCloseTo(residents(happy) * VISITORS_PER_RESIDENT, 6);
    expect(cruiseIncome(happy)).toBeCloseTo(visitors(happy) * VISITOR_SPEND, 6);

    const half = populous({ cruiseTerminals: 1, happiness: 0.5 });
    expect(visitors(half)).toBeCloseTo(visitors(happy) / 2, 6);

    // The one income line that goes to zero rather than to HAPPINESS_FLOOR.
    const grim = populous({ cruiseTerminals: 1, happiness: 0 });
    expect(visitors(grim)).toBe(0);
    expect(income(grim)).toBeGreaterThan(0);
  });

  it('adds to the ledger, and a second berth adds as much again', () => {
    const none = populous();
    const one = populous({ cruiseTerminals: 1 });
    const two = populous({ cruiseTerminals: 2 });
    expect(income(one)).toBeGreaterThan(income(none));
    expect(income(two) - income(one)).toBeCloseTo(income(one) - income(none), 6);
  });

  it('stays outside the multipliers rent goes through', () => {
    // Tourism is not rent, so it must not pick up the shop, industry or
    // district bonus — the same rule fares are held to.
    const plain = populous({ cruiseTerminals: 1 });
    const shoppy = populous({ cruiseTerminals: 1, shops: 40, shopLevels: [40, 0, 0, 0, 0] });
    expect(cruiseIncome(shoppy)).toBeCloseTo(cruiseIncome(plain), 6);
  });
});

describe('what a cargo terminal moves', () => {
  it('lifts the export tap rather than opening a second one', () => {
    const base = city(MAX_DISTRICTS);
    const tap = EXPORT_BASE + EXPORT_PER_DISTRICT * (MAX_DISTRICTS - 1);
    expect(exportMarket(base)).toBeCloseTo(tap, 6);
    for (let berths = 1; berths <= 4; berths++) {
      const with_ = city(MAX_DISTRICTS, { cargoTerminals: berths });
      expect(exportMarket(with_)).toBeCloseTo(tap * (1 + CARGO_EXPORT_LIFT * berths), 6);
    }
  });

  it('pushes industrial demand up and leaves the other two alone', () => {
    const supplied = { ...city(MAX_DISTRICTS), ...housedOn(60, 1), shops: 30, industry: 20 };
    supplied.shopLevels = [30, 0, 0, 0, 0];
    supplied.industryLevels = [20, 0, 0, 0, 0];
    const before = demandTargets(supplied);
    const after = demandTargets({ ...supplied, cargoTerminals: 2 });
    expect(after.i).toBeGreaterThan(before.i);
    expect(after.r).toBeCloseTo(before.r, 9);
    expect(after.c).toBeCloseTo(before.c, 9);
  });

  it('earns nothing directly', () => {
    const populous = { ...city(MAX_DISTRICTS), ...housedOn(200, 2) };
    expect(income({ ...populous, cargoTerminals: 3 })).toBeCloseTo(income(populous), 6);
  });
});

describe('a port across a save', () => {
  it('defaults to none for every save written before there was a coast', () => {
    const back = migrate({ cash: 10, homes: 4, districts: 2 }, 1_000) as GameState;
    expect(back.cruiseTerminals).toBe(0);
    expect(back.cargoTerminals).toBe(0);
    expect(visitors(back)).toBe(0);
    expect(exportMarket(back)).toBeCloseTo(EXPORT_BASE + EXPORT_PER_DISTRICT, 6);
  });

  it('carries what was built, and clamps it to the berths the city owns', () => {
    const kept = migrate(
      { homes: 9, districts: MAX_DISTRICTS, cruiseTerminals: 2, cargoTerminals: 1 },
      0,
    ) as GameState;
    expect(kept.cruiseTerminals).toBe(2);
    expect(kept.cargoTerminals).toBe(1);

    // A save claiming more berths than its districts carry loses the extras,
    // exactly as one claiming more hospitals than sites does.
    const trimmed = migrate(
      { homes: 9, districts: FIRST_COAST, cruiseTerminals: 99, cargoTerminals: 99 },
      0,
    ) as GameState;
    expect(trimmed.cruiseTerminals).toBe(terminalCapacity(trimmed));
    expect(trimmed.cargoTerminals).toBe(terminalCapacity(trimmed));
  });

  it('gives an inland save no berths whatever it claims', () => {
    const inland = migrate({ homes: 4, districts: 1, cruiseTerminals: 5 }, 0) as GameState;
    expect(inland.cruiseTerminals).toBe(0);
    expect(hasCoast(inland)).toBe(false);
  });
});
