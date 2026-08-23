import { describe, expect, it } from 'vitest';
import { ZONE, type Zone } from '../src/sim/citygen';
import {
  CATCHUP_STEP_SECONDS,
  DISTRICT_SPAN,
  LEVEL_FOOTPRINT,
  LEVELS,
  MERGE_LEVEL,
} from '../src/sim/config';
import {
  canBuildHome,
  canBuildIndustry,
  canBuildShop,
  capacityOf,
  cohortTotal,
  homeCapacity,
  industryCapacity,
  levelAt,
  mergeCapacity,
  mergedCohort,
  mergedOf,
  plotsOf,
  shopCapacity,
  standingOf,
  ZONE_KINDS,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import {
  CityLayout,
  createPlacement,
  districtPlanAt,
  parcelOrder,
  worldX,
  worldZ,
} from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { housed, served } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game(state(patch));

/**
 * Runs a city with its treasury held at zero.
 *
 * These tests are about one district's parcels, and a city that can afford the
 * next district takes it: `autoAnnex` runs inside `step` and asks nobody. A
 * treasury pinned at zero is the least invasive way to hold the land still
 * while the skyline moves, and merging costs nothing, so it changes nothing
 * about what is being measured.
 */
const broke = (game: Game, steps: number, seconds = 60): Game => {
  for (let i = 0; i < steps; i++) {
    game.catchUp(seconds);
    Object.assign(game.state, { cash: 0 });
  }
  return game;
};

/** A city with every gate wide open, so promotion is the only thing happening. */
const climbing = (patch: Partial<GameState> = {}): Partial<GameState> => ({
  ...served(),
  happiness: 1,
  occupancyR: 1,
  occupancyC: 1,
  occupancyI: 1,
  cash: 1e12,
  ...patch,
});

const zoneCells = (plan: ReturnType<typeof districtPlanAt>, zone: Zone): readonly number[] =>
  zone === ZONE.commercial
    ? plan.commercial
    : zone === ZONE.industrial
      ? plan.industrial
      : plan.residential;

const zoneSizes = (plan: ReturnType<typeof districtPlanAt>, zone: Zone): readonly number[] =>
  zone === ZONE.commercial
    ? plan.commercialParcels
    : zone === ZONE.industrial
      ? plan.industrialParcels
      : plan.residentialParcels;

const ZONES: readonly Zone[] = [ZONE.residential, ZONE.commercial, ZONE.industrial];

describe('parcels are a pure function of the layout', () => {
  it('gives the same district the same parcels, across a thousand seeds', { timeout: 30_000 }, () => {
    for (let i = 0; i < 1_000; i++) {
      const plan = districtPlanAt(i % 40, Math.floor(i / 40));
      for (const zone of ZONES) {
        const again = parcelOrder(zoneCells(plan, zone));
        // The plan is already parcel-ordered, so re-running the pairing over its
        // own output has to be the identity. Anything that made the ordering
        // depend on the order it was handed would fail here.
        expect([...again.cells]).toEqual([...zoneCells(plan, zone)]);
        expect([...again.sizes]).toEqual([...zoneSizes(plan, zone)]);
      }
    }
  });

  it('pairs only cells that are adjacent and in the same zone', { timeout: 30_000 }, () => {
    for (let i = 0; i < 1_000; i++) {
      const plan = districtPlanAt(i % 40, Math.floor(i / 40));
      for (const zone of ZONES) {
        const cells = zoneCells(plan, zone);
        const inZone = new Set(cells);
        let at = 0;
        for (const size of zoneSizes(plan, zone)) {
          if (size === 2) {
            const a = cells[at] as number;
            const b = cells[at + 1] as number;
            const gap = Math.abs(a - b);
            // Side by side along a row, or one directly below the other. Never
            // a wrap: a cell at the right-hand edge is not next to the one at
            // the left-hand edge of the next row.
            const sideBySide = gap === 1 && Math.floor(a / DISTRICT_SPAN) === Math.floor(b / DISTRICT_SPAN);
            expect(sideBySide || gap === DISTRICT_SPAN).toBe(true);
            expect(inZone.has(a) && inZone.has(b)).toBe(true);
          }
          at += size;
        }
        expect(at).toBe(cells.length);
      }
    }
  });

  it('sorts every unpairable plot to the back', () => {
    for (let i = 0; i < 200; i++) {
      const plan = districtPlanAt(i % 20, Math.floor(i / 20));
      for (const zone of ZONES) {
        const sizes = zoneSizes(plan, zone);
        const firstSingle = sizes.indexOf(1);
        if (firstSingle < 0) continue;
        expect(sizes.slice(firstSingle).every((size) => size === 1)).toBe(true);
      }
    }
  });

  it('leaves unpairable plots in every district, which is why level 1 has a floor', () => {
    // The measurement `parcelOrder` documents: about three residential plots a
    // district have no neighbour to merge with, so a city always keeps a
    // low-rise fringe. If this ever comes out zero the comment is wrong.
    let singles = 0;
    for (let i = 0; i < 100; i++) {
      const plan = districtPlanAt(i % 10, Math.floor(i / 10));
      singles += zoneSizes(plan, ZONE.residential).filter((size) => size === 1).length;
    }
    expect(singles / 100).toBeGreaterThan(2);
    expect(singles / 100).toBeLessThan(4);
  });
});

describe('a building stands where its counts say it does', () => {
  const layout = new CityLayout().ensure(4);

  it('never puts two buildings on the same plot, merged or not', () => {
    for (const zone of ZONES) {
      const pairs = mergeCapacity(state({ districts: 4 }), zone === ZONE.residential ? 'home' : zone === ZONE.commercial ? 'shop' : 'industry');
      for (const merged of [0, 1, 3, Math.floor(pairs / 2), pairs]) {
        const seen = new Set<string>();
        const buildings = zoneCapacity(zone) - merged;
        const out = createPlacement();
        for (let slot = 0; slot < buildings; slot++) {
          const place = layout.place(zone, slot, merged, out);
          const cells = layout.zoneCells(zone);
          const first = cells[place.plot];
          expect(first).toBeDefined();
          for (let p = 0; p < place.plots; p++) {
            const cell = cells[place.plot + p];
            expect(cell).toBeDefined();
            const key = `${cell?.x},${cell?.z}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
          }
          // The footprint's centre is the midpoint of the plots it covers.
          if (place.plots === 2) {
            const a = cells[place.plot];
            const b = cells[place.plot + 1];
            expect(place.x).toBeCloseTo((worldX(a?.x ?? 0) + worldX(b?.x ?? 0)) / 2, 9);
            expect(place.z).toBeCloseTo((worldZ(a?.z ?? 0) + worldZ(b?.z ?? 0)) / 2, 9);
            expect(place.alongX).toBe((a?.x ?? 0) !== (b?.x ?? 0));
          }
        }
      }
    }
  });

  it('keeps a plot under a building when the city merges around it', () => {
    // Merging removes a pair from the front of what is left, so every building
    // behind it shifts one slot down and lands on exactly the plot it was on.
    const out = createPlacement();
    const other = createPlacement();
    for (let merged = 0; merged < 8; merged++) {
      const buildings = 24 - merged;
      for (let slot = merged + 1; slot < buildings - 1; slot++) {
        const before = layout.place(ZONE.residential, slot + 1, merged, out);
        const key = { plot: before.plot, plots: before.plots };
        const after = layout.place(ZONE.residential, slot, merged + 1, other);
        if (after.plots !== key.plots) continue;
        expect(after.plot).toBe(key.plot);
      }
    }
  });
});

const zoneCapacity = (zone: Zone): number =>
  zone === ZONE.commercial
    ? shopCapacity(state({ districts: 4 }))
    : zone === ZONE.industrial
      ? industryCapacity(state({ districts: 4 }))
      : homeCapacity(state({ districts: 4 }));

describe('merging', () => {
  it('conserves plots while the building count falls', () => {
    const game = at({ ...housed(24), ...climbing({ cash: 0 }) });
    const plots = plotsOf(game.state, 'home');
    let merges = 0;
    for (let i = 0; i < 6_000; i++) {
      const was = game.state.mergedR;
      game.advance(0.1);
      Object.assign(game.state, { cash: 0 });
      if (game.state.mergedR === was) continue;
      merges += game.state.mergedR - was;
      // Every merge, at the moment it happens: one building fewer, the same
      // land underneath.
      expect(plotsOf(game.state, 'home')).toBe(plots);
    }
    expect(merges).toBeGreaterThan(0);
    expect(game.state.homes).toBeLessThan(24);
  });

  it('never merges an unpairable plot, and caps it at level 1', () => {
    // Run a single district all the way out. What is left below MERGE_LEVEL at
    // the end is exactly the plots that had no neighbour.
    const game = at({ ...housed(24), ...climbing({ cash: 0 }) });
    broke(game, 400);
    const singles = zoneSizes(districtPlanAt(0, 0), ZONE.residential).filter((n) => n === 1).length;
    expect(game.state.mergedR).toBe(mergeCapacity(game.state, 'home'));
    // Those plots are stuck at level 1: they are standing, they are not merged,
    // and there is nothing below them left to climb.
    expect(game.state.homeLevels[MERGE_LEVEL - 1]).toBe(singles);
    expect(game.state.homeLevels[0]).toBe(0);
    expect(plotsOf(game.state, 'home')).toBe(24);
  });

  it('is step-size invariant at the catch-up step', () => {
    const patch = { ...housed(24, 0), ...climbing(), districts: 3 };
    const away = at(patch);
    const watched = at(patch);
    away.catchUp(3_600);
    for (let i = 0; i < 3_600; i++) watched.catchUp(1);
    const close = (a: number, b: number): void => {
      expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(1, Math.abs(b) * 0.01));
    };
    close(away.state.mergedR, watched.state.mergedR);
    close(away.state.homes, watched.state.homes);
    for (let l = 0; l < LEVELS; l++) {
      close(away.state.homeLevels[l] ?? 0, watched.state.homeLevels[l] ?? 0);
    }
  });

  it('consumes a whole parcel, never half of one', () => {
    // The pair leaving level 1 is always two. A merge that took one would show
    // up as an odd change in the cohort against an even change in the count.
    const game = at({ ...housed(24), ...climbing({ cash: 0 }) });
    let before = [...game.state.homeLevels];
    let merged = game.state.mergedR;
    for (let i = 0; i < 600; i++) {
      game.catchUp(CATCHUP_STEP_SECONDS);
      Object.assign(game.state, { cash: 0 });
      const gained = game.state.mergedR - merged;
      if (gained > 0) {
        const left = (before[MERGE_LEVEL - 1] ?? 0) - (game.state.homeLevels[MERGE_LEVEL - 1] ?? 0);
        // Some of level 1 may have been topped up from level 0 in the same
        // pass, so the drop is at most two per merge and never less than the
        // pair count once the bottom is empty.
        expect((game.state.homeLevels[MERGE_LEVEL] ?? 0) - (before[MERGE_LEVEL] ?? 0)).toBe(gained);
        expect(left).toBeLessThanOrEqual(2 * gained);
      }
      before = [...game.state.homeLevels];
      merged = game.state.mergedR;
    }
  });
});

describe('capacity is plots', () => {
  it('refuses to build exactly when no free plot remains', () => {
    for (const kind of ZONE_KINDS) {
      const game = at({ ...climbing(), districts: 2 });
      const buy =
        kind === 'home'
          ? () => game.buildHome()
          : kind === 'shop'
            ? () => game.buildShop()
            : () => game.buildIndustry();
      const can =
        kind === 'home' ? canBuildHome : kind === 'shop' ? canBuildShop : canBuildIndustry;
      let bought = 0;
      while (buy()) bought++;
      expect(bought).toBe(capacityOf(game.state, kind));
      expect(plotsOf(game.state, kind)).toBe(capacityOf(game.state, kind));
      expect(can(game.state)).toBe(false);
    }
  });

  it('frees nothing when a pair merges — the land is still spoken for', () => {
    const game = at({ ...housed(24), ...climbing({ cash: 0 }) });
    broke(game, 50);
    expect(game.state.mergedR).toBeGreaterThan(0);
    expect(canBuildHome(game.state)).toBe(false);
    expect(plotsOf(game.state, 'home')).toBe(homeCapacity(game.state));
  });
});

describe('the parcel invariant', () => {
  const check = (s: Readonly<GameState>): void => {
    for (const kind of ZONE_KINDS) {
      const levels =
        kind === 'home' ? s.homeLevels : kind === 'shop' ? s.shopLevels : s.industryLevels;
      expect(mergedCohort(levels)).toBe(Math.min(mergedOf(s, kind), cohortTotal(levels)));
      expect(cohortTotal(levels)).toBe(standingOf(s, kind));
      expect(plotsOf(s, kind)).toBeLessThanOrEqual(capacityOf(s, kind));
      expect(mergedOf(s, kind)).toBeLessThanOrEqual(mergeCapacity(s, kind));
      // A building above MERGE_LEVEL - 1 stands on two plots, and one below it
      // on one. The cohort's own footprint has to agree with the parcel count.
      let footprint = 0;
      for (let l = 0; l < LEVELS; l++) footprint += (levels[l] ?? 0) * (LEVEL_FOOTPRINT[l] ?? 1);
      expect(footprint).toBe(cohortTotal(levels) + Math.min(mergedOf(s, kind), cohortTotal(levels)));
    }
  };

  it('holds through building, merging, abandonment and recovery', { timeout: 30_000 }, () => {
    const game = at({ ...housed(20), ...climbing(), districts: 2 });
    for (let i = 0; i < 4_000; i++) {
      game.advance(0.1);
      game.buildHome();
      game.buildShop();
      game.buildIndustry();
      check(game.state);
    }
    // Take the services away and let it rot.
    Object.assign(game.state, { hospitals: 0, police: 0, fire: 0, happiness: 0, occupancyR: 0 });
    for (let i = 0; i < 12_000; i++) {
      game.advance(0.1);
      check(game.state);
    }
    // And give them back.
    Object.assign(game.state, { ...served(), happiness: 1 });
    for (let i = 0; i < 12_000; i++) {
      game.advance(0.1);
      check(game.state);
    }
  });

  it('leaves a merged parcel merged when its building is boarded up', () => {
    // The one case where the parcel count is not the cohort: a zone whose whole
    // stock is merged, emptying out. The ruin keeps both its plots.
    const game = at({
      ...housed(6, MERGE_LEVEL),
      happiness: 0,
      occupancyR: 0,
      districts: 1,
    });
    for (let i = 0; i < 40; i++) game.catchUp(60);
    expect(game.state.abandonedR).toBeGreaterThan(0);
    expect(game.state.mergedR).toBeGreaterThan(mergedCohort(game.state.homeLevels));
    expect(plotsOf(game.state, 'home')).toBe(12);
    check(game.state);
  });

  it('reopens a boarded-up merged building as what its parcel can hold', () => {
    const game = at({
      ...housed(6, MERGE_LEVEL),
      happiness: 0,
      occupancyR: 0,
      districts: 1,
    });
    for (let i = 0; i < 40; i++) game.catchUp(60);
    const ruins = game.state.abandonedR;
    expect(ruins).toBeGreaterThan(0);
    Object.assign(game.state, { ...served(), happiness: 1, occupancyR: 1 });
    for (let i = 0; i < 40; i++) game.catchUp(60);
    expect(game.state.abandonedR).toBe(0);
    // Back at MERGE_LEVEL, not at level 0: the land under it is still a pair.
    expect(game.state.homeLevels[0]).toBe(0);
    check(game.state);
  });
});

describe("a building's level is a function of its slot", () => {
  it('reads merged parcels as the oldest slots', () => {
    const game = at({ ...housed(24), ...climbing() });
    for (let i = 0; i < 200; i++) game.catchUp(60);
    const s = game.state;
    expect(s.mergedR).toBeGreaterThan(0);
    for (let slot = 0; slot < s.homes; slot++) {
      const level = levelAt(s.homeLevels, slot);
      if (slot < s.mergedR) expect(level).toBeGreaterThanOrEqual(MERGE_LEVEL);
      else expect(level).toBeLessThan(MERGE_LEVEL);
    }
  });

  it('is the same city whatever order the operations arrive in', { timeout: 30_000 }, () => {
    // Every path that reaches the same counts has to reach the same city. Ten
    // runs, each shuffling how the ticks and the purchases interleave.
    const skyline = (s: Readonly<GameState>): string =>
      `${s.homes}/${s.mergedR}/${s.homeLevels.join(',')}`;
    const layout = new CityLayout().ensure(2);
    const out = createPlacement();

    const positions = (s: Readonly<GameState>): string => {
      const parts: string[] = [];
      for (let slot = 0; slot < s.homes; slot++) {
        const place = layout.place(ZONE.residential, slot, s.mergedR, out);
        parts.push(`${place.plot}:${place.plots}`);
      }
      return parts.join('|');
    };

    let reference: string | null = null;
    for (let seed = 0; seed < 10; seed++) {
      const game = at({ ...climbing(), districts: 2 });
      for (let i = 0; i < 3_000; i++) {
        // A different interleave each run, deterministic per seed.
        if ((i * 7 + seed * 13) % 5 === 0) game.buildHome();
        game.advance(0.1);
      }
      // Then drive every run to the same finished state.
      for (let i = 0; i < 400; i++) {
        game.buildHome();
        game.catchUp(60);
      }
      const shape = `${skyline(game.state)} ${positions(game.state)}`;
      if (reference === null) reference = shape;
      else expect(shape).toBe(reference);
    }
  });
});
