import { describe, expect, it } from 'vitest';
import {
  CRIME_FROM_IDLENESS,
  CULTURE,
  LANDMARKS,
  LEVELS,
  LIBRARY_CRIME_RELIEF,
  MAX_DISTRICTS,
  RECREATION_WEIGHT,
  SERVICES,
  THEATRE_VISITORS,
} from '../src/sim/config';
import {
  berthsLanding,
  canBuildCulture,
  crime,
  crimePressure,
  cultureAllowed,
  cultureBlocker,
  cultureCost,
  cultureCoverage,
  happinessTarget,
  libraryCoverage,
  parkCapacity,
  serviceAllowed,
  theatreCoverage,
  unemployment,
  visitorSources,
  visitors,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import {
  BUILDABLE_RESIDENTIAL_PER_DISTRICT,
  CULTURE_SITES_PER_DISTRICT,
  CityLayout,
} from '../src/sim/layout';
import { migrate } from '../src/sim/save';
import { createState, SAVE_VERSION, type GameState } from '../src/sim/state';
import { housedOn, zoning } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

const LIBRARY = CULTURE[0]!;
const THEATRE = CULTURE[1]!;

/**
 * A city of `districts` at the top of the ladder, with a real crime pressure.
 *
 * `housedOn` fills the district's *plots*, which is what `Culture.plots` is
 * denominated in — a top-level building stands on two of them, so a fixture
 * counted in buildings describes twice the land it means to.
 */
const crowded = (districts: number): GameState =>
  state({
    ...zoning(districts),
    ...housedOn(BUILDABLE_RESIDENTIAL_PER_DISTRICT * districts, LEVELS - 1),
    districts,
    occupancyR: 1,
  });

/** A city of `districts` with every housing plot developed and surveyed. */
const city = (districts: number, patch: Partial<GameState> = {}): GameState =>
  state({
    ...zoning(districts),
    ...housedOn(BUILDABLE_RESIDENTIAL_PER_DISTRICT * districts),
    districts,
    ...patch,
  });

describe('the culture square', () => {
  /**
   * The whole reason culture took a site class of its own rather than a second
   * small-landmark site: two small sites a district would have doubled the
   * *museum's* allowance, and a museum is an area-of-effect. See
   * FRONTAGE_TARGET.cultureSites.
   */
  it('leaves the museum on exactly one site a district', () => {
    const layout = new CityLayout().ensure(city(10));
    expect(layout.landmarkSmallSites).toBe(10);
    expect(layout.cultureSites).toBe(10 * CULTURE_SITES_PER_DISTRICT);
  });

  it('is a square of its own, overlapping nothing', () => {
    const layout = new CityLayout().ensure(city(6));
    const key = (c: { x: number; z: number }): string => `${c.x},${c.z}`;
    const seen = new Set<string>();
    const square = (c: { x: number; z: number }): void => {
      for (let dz = 0; dz < 2; dz++) {
        for (let dx = 0; dx < 2; dx++) {
          const k = key({ x: c.x + dx, z: c.z + dz });
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
      }
    };
    for (let i = 0; i < layout.cultureSites; i++) square(layout.cultureSiteCell(i));
    for (let i = 0; i < layout.landmarkSmallSites; i++) square(layout.landmarkSmallSiteCell(i));
    for (let i = 0; i < layout.civicSites; i++) square(layout.civicSiteCell(i));
    for (let i = 0; i < layout.cityHallSites; i++) square(layout.cityHallSiteCell(i));
    for (let i = 0; i < layout.powerPlantSites; i++) square(layout.powerPlantCell(i));
  });

  /**
   * A fixed interleave, exactly as `civicSiteFor` uses, and for exactly that
   * reason: the save holds a count, so a building's site has to fall out of its
   * ordinal or the city rearranges itself on the next reload.
   */
  it('splits its sites between the two types, one district each in turn', () => {
    for (const districts of [1, 2, 4, 12, 25, MAX_DISTRICTS]) {
      const s = city(districts);
      const libraries = cultureAllowed(s, LIBRARY);
      const theatres = cultureAllowed(s, THEATRE);
      expect(libraries + theatres).toBe(districts * CULTURE_SITES_PER_DISTRICT);
      // The library is offset 0, so it is the one a single district gets.
      expect(libraries).toBe(Math.ceil(districts / 2));
      expect(theatres).toBe(Math.floor(districts / 2));
    }
  });

  it('covers the city exactly when every site the land allows is filled', () => {
    for (const districts of [2, 4, 12, 25]) {
      const s = city(districts);
      const full = {
        ...s,
        libraries: cultureAllowed(s, LIBRARY),
        theatres: cultureAllowed(s, THEATRE),
      };
      expect(libraryCoverage(full)).toBe(1);
      expect(theatreCoverage(full)).toBeGreaterThan(0.9);
    }
  });

  it('reads nothing for a city with no housing', () => {
    const empty = state({ districts: 4, libraries: 4, theatres: 4 });
    expect(libraryCoverage(empty)).toBe(0);
    expect(theatreCoverage(empty)).toBe(0);
  });
});

describe('what a culture building may be built on', () => {
  it('is bounded by the sites, and by nothing else', () => {
    for (const districts of [1, 4, 25]) {
      const s = city(districts, { cash: Number.MAX_SAFE_INTEGER });
      for (const culture of CULTURE) {
        const full = { ...s, libraries: 99, theatres: 99 };
        expect(canBuildCulture(full, culture)).toBe(false);
        expect(cultureBlocker(full, culture)).toBe('No sites left');
        // A one-district city has a library site and no theatre site — the
        // interleave has to give somebody the first square — so the blocker is
        // only null where the land actually offers one.
        expect(cultureBlocker(s, culture)).toBe(
          cultureAllowed(s, culture) > 0 ? null : 'No sites left',
        );
      }
    }
  });

  it('is cheaper than the museum it sits under, at every rung', () => {
    const museum = LANDMARKS[0]!;
    for (const n of [0, 3, 7, 15]) {
      const s = city(25, { libraries: n, theatres: n });
      for (const culture of CULTURE) {
        expect(cultureCost(s, culture)).toBeLessThan(museum.base * museum.growth ** n);
      }
    }
  });

  it('is bought one at a time, compounding over its own count', () => {
    const game = new Game(city(12, { cash: 1e9 }));
    const before = cultureCost(game.state, LIBRARY);
    expect(game.buildCulture(LIBRARY)).toBe(true);
    expect(game.state.libraries).toBe(1);
    expect(game.state.theatres).toBe(0);
    expect(cultureCost(game.state, LIBRARY)).toBeCloseTo(before * LIBRARY.growth, 6);
    expect(game.state.cash).toBeCloseTo(1e9 - before, 2);
  });

  it('refuses one the city cannot afford', () => {
    expect(canBuildCulture(city(12, { cash: 0 }), LIBRARY)).toBe(false);
  });
});

describe('what a library does', () => {
  /**
   * The idleness half of `crimePressure`, and only that half. Crowding is the
   * level ladder and no reading room makes a tower less full — see
   * LIBRARY_CRIME_RELIEF.
   */
  it('answers idleness and never crowding', () => {
    // `housedOn` rather than `built`: it fills the district's *plots*, and a
    // top-level building stands on two of them — so `built(288, …)` at the top
    // rung is twenty-four districts of land on twelve districts of sites.
    const bare = crowded(12);
    const full = { ...bare, libraries: cultureAllowed(bare, LIBRARY) };
    expect(libraryCoverage(full)).toBe(1);
    expect(crimePressure(full)).toBeLessThan(crimePressure(bare));
    // And exactly the idleness half: the relief is the whole difference, so
    // the crowding term is provably untouched. Stated as the arithmetic rather
    // than as a second fixture with no unemployment in it, because a city with
    // no idleness also has no pressure and the assertion would be vacuous.
    const idle = unemployment(bare);
    expect(crimePressure(bare) - crimePressure(full)).toBeCloseTo(
      CRIME_FROM_IDLENESS * idle * LIBRARY_CRIME_RELIEF * libraryCoverage(full),
      9,
    );
  });

  it('takes the measured share off the pressure and no more', () => {
    const bare = crowded(12);
    const full = { ...bare, libraries: cultureAllowed(bare, LIBRARY) };
    const idle = crimePressure(bare) - crimePressure(full);
    // The whole of the relief is LIBRARY_CRIME_RELIEF of the idleness term,
    // which is CRIME_FROM_IDLENESS of the pressure.
    expect(idle).toBeLessThanOrEqual(LIBRARY_CRIME_RELIEF * CRIME_FROM_IDLENESS + 1e-9);
    expect(idle).toBeGreaterThan(0);
  });

  /**
   * The guard, and it holds by construction rather than by measurement: `crime`
   * is pressure times the share the police do *not* reach, so a fully policed
   * city reads exactly zero whatever the pressure and the ceiling cannot move.
   */
  it('cannot move the happiness ceiling at any city size', () => {
    for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
      const s = state({
        ...housedOn(BUILDABLE_RESIDENTIAL_PER_DISTRICT * districts, LEVELS - 1),
        districts,
      });
      s.parks = parkCapacity(s);
      for (const service of SERVICES) {
        const n = serviceAllowed(s, service);
        if (service.key === 'hospital') { s.hospitals = n; s.hospitalStaff = 1; }
        if (service.key === 'police') { s.police = n; s.policeStaff = 1; }
        if (service.key === 'fire') { s.fire = n; s.fireStaff = 1; }
        if (service.key === 'school') { s.schools = n; s.schoolStaff = 1; }
        if (service.key === 'transit') { s.depots = n; s.depotStaff = 1; }
        if (service.key === 'university') { s.universities = n; s.universityStaff = 1; }
      }
      const cultured = {
        ...s,
        libraries: cultureAllowed(s, LIBRARY),
        theatres: cultureAllowed(s, THEATRE),
      };
      expect(crime(cultured)).toBe(crime(s));
      expect(happinessTarget(s)).toBeGreaterThanOrEqual(0.95);
      // A theatre lands visitors, and visitors do not touch the mood bracket at
      // all — so the ceiling is identical rather than merely still over 0.95.
      expect(happinessTarget(cultured)).toBe(happinessTarget(s));
    }
  });
});

describe('what a theatre does', () => {
  it('lands an audience on the one arrivals expression', () => {
    const bare = city(12);
    const full = { ...bare, theatres: cultureAllowed(bare, THEATRE) };
    expect(berthsLanding(full) - berthsLanding(bare)).toBeCloseTo(
      THEATRE_VISITORS * theatreCoverage(full),
      9,
    );
    const from = visitorSources(full);
    expect(from.stage).toBeGreaterThan(0);
    expect(from.quay + from.air + from.road + from.rail + from.stage).toBeCloseTo(
      from.total,
      6,
    );
  });

  it('lands nobody in a city nobody wants to visit', () => {
    const grim = city(12, { theatres: 6, happiness: 0 });
    expect(visitors(grim)).toBe(0);
    expect(visitorSources(grim).stage).toBe(0);
  });

  it('is the smallest of the landlocked arrival sources', () => {
    expect(THEATRE_VISITORS).toBeLessThan(2);
  });
});

describe('the two are not one building with two names', () => {
  it('reach the same land and do entirely different things with it', () => {
    const s = crowded(12);
    const libraries = { ...s, libraries: cultureAllowed(s, LIBRARY) };
    const theatres = { ...s, theatres: cultureAllowed(s, THEATRE) };
    expect(cultureCoverage(libraries, LIBRARY)).toBeGreaterThan(0);
    expect(cultureCoverage(theatres, THEATRE)).toBeGreaterThan(0);
    // The library moves crime and not arrivals; the theatre moves arrivals and
    // not crime.
    expect(crimePressure(libraries)).toBeLessThan(crimePressure(s));
    expect(berthsLanding(libraries)).toBe(berthsLanding(s));
    expect(berthsLanding(theatres)).toBeGreaterThan(berthsLanding(s));
    expect(crimePressure(theatres)).toBe(crimePressure(s));
  });

  /** Neither is a happiness weight, and neither is a modifier in the bracket. */
  it('adds nothing to the happiness sum', () => {
    const weights =
      SERVICES.reduce((sum, service) => sum + service.weight, 0) + RECREATION_WEIGHT;
    expect(weights).toBeCloseTo(1, 10);
  });
});

describe('culture across a save', () => {
  it('opens a save that predates it with none', () => {
    const raw = JSON.parse(JSON.stringify(city(4))) as Record<string, unknown>;
    raw['version'] = 14;
    delete raw['libraries'];
    delete raw['theatres'];
    const back = migrate(raw, 0)!;
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.libraries).toBe(0);
    expect(back.theatres).toBe(0);
  });

  it('clamps a doctored count to the sites the land offers', () => {
    const raw = JSON.parse(JSON.stringify(city(4))) as Record<string, unknown>;
    raw['libraries'] = 900;
    raw['theatres'] = 900;
    const back = migrate(raw, 0)!;
    expect(back.libraries).toBe(cultureAllowed(back, LIBRARY));
    expect(back.theatres).toBe(cultureAllowed(back, THEATRE));
  });

  it('round-trips what was built', () => {
    const s = city(12, { libraries: 3, theatres: 2 });
    const back = migrate(JSON.parse(JSON.stringify(s)), 0)!;
    expect(back.libraries).toBe(3);
    expect(back.theatres).toBe(2);
  });
});
