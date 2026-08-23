import { describe, expect, it } from 'vitest';
import {
  CIVIC_SERVICES,
  EDUCATION_SERVICES,
  HAPPINESS_SERVICES,
  LEVEL_EDUCATION,
  LEVELS,
  SERVICES,
} from '../src/sim/config';
import {
  bindingTerm,
  canBuildService,
  civicSiteCapacity,
  cohortTotal,
  coverage,
  educationCoverage,
  happinessTarget,
  happinessTerms,
  serviceAllowed,
  serviceBlocker,
  serviceCost,
  serviceCount,
  siteCapacity,
  universitySiteCapacity,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { CityLayout } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { housed } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

const run = (game: Game, seconds: number): Game => {
  for (let i = 0; i < Math.round(seconds * 10); i++) game.advance(0.1);
  return game;
};

const school = SERVICES.find((s) => s.key === 'school');
const university = SERVICES.find((s) => s.key === 'university');

/** Happiness maxed and occupancy full, so education is the only gate left. */
const content = (patch: Partial<GameState> = {}): Partial<GameState> => ({
  hospitals: 40,
  police: 40,
  fire: 40,
  hospitalStaff: 1,
  policeStaff: 1,
  fireStaff: 1,
  parks: 200,
  happiness: 1,
  ...patch,
});

describe('education is a gate, not a mood', () => {
  it('carries no happiness weight and appears in no happiness term', () => {
    // The rule this whole design turns on. Happiness was calibrated across four
    // weights summing to 1; a fifth would re-open that for nothing, because
    // what education is *for* is deciding how tall the city may build.
    for (const service of EDUCATION_SERVICES) expect(service.weight).toBe(0);
    expect(EDUCATION_SERVICES.map((s) => s.key)).toEqual(['school', 'university']);
    expect(HAPPINESS_SERVICES.map((s) => s.key)).toEqual(['hospital', 'police', 'fire']);

    const keys = happinessTerms(state(housed(24))).map((term) => term.key);
    expect(keys).not.toContain('school');
    expect(keys).not.toContain('university');
  });

  it('changes nothing about happiness when it is built', () => {
    const bare = state({ ...housed(24), ...content() });
    const taught = state({
      ...housed(24),
      ...content(),
      schools: 9,
      schoolStaff: 1,
      universities: 9,
      universityStaff: 1,
    });
    expect(happinessTarget(taught)).toBeCloseTo(happinessTarget(bare), 12);
    expect(bindingTerm(taught).key).toBe(bindingTerm(bare).key);
    // And it very much changes education.
    expect(educationCoverage(taught)).toBeGreaterThan(educationCoverage(bare));
  });
});

describe('education coverage', () => {
  it('pools schools and universities against the housing stock', () => {
    const s = state({ ...housed(24, 2), schools: 2, schoolStaff: 1 });
    const people = 24 * 70;
    expect(educationCoverage(s)).toBeCloseTo((2 * (school?.capacity ?? 0)) / people, 9);

    const withUni = { ...s, universities: 1, universityStaff: 1 };
    // Capped at everybody, like every other coverage: one university is nearly
    // three times what a district of towers needs on its own.
    expect(educationCoverage(withUni)).toBeCloseTo(
      Math.min(1, (2 * (school?.capacity ?? 0) + (university?.capacity ?? 0)) / people),
      9,
    );
    expect(educationCoverage(withUni)).toBe(1);
  });

  it('weighs a university far more heavily than a school', () => {
    expect(university?.capacity ?? 0).toBeGreaterThan((school?.capacity ?? 0) * 3);
  });

  it('reads as covered only where there is no housing to teach', () => {
    expect(educationCoverage(state())).toBe(1);
    expect(educationCoverage(state(housed(1)))).toBe(0);
  });

  it('ramps rather than snapping when a school opens', () => {
    const game = at({ ...housed(24, 2), cash: 1e9 });
    expect(school).toBeDefined();
    expect(game.buildService(school as never)).toBe(true);
    expect(educationCoverage(game.state)).toBe(0);
    run(game, 1);
    const early = educationCoverage(game.state);
    run(game, 600);
    expect(early).toBeLessThan(educationCoverage(game.state) * 0.5);
  });
});

describe('the education gate on levelling', () => {
  it('holds the cohort still with no school at all', () => {
    // Both other gates wide open, so the only thing missing is teaching.
    const game = at({ ...housed(24), ...content(), occupancyR: 1 });
    for (let i = 0; i < 12_000; i++) {
      Object.assign(game.state, { happiness: 1 });
      game.advance(0.1);
    }
    expect(educationCoverage(game.state)).toBe(0);
    expect(game.state.homeLevels[0]).toBe(24);
  });

  it('lets the city climb the moment a school is teaching', () => {
    const game = at({
      ...housed(24),
      ...content(),
      occupancyR: 1,
      schools: 4,
      schoolStaff: 1,
      cash: 1e9,
    });
    expect(educationCoverage(game.state)).toBeGreaterThanOrEqual(LEVEL_EDUCATION[1] ?? 0);
    run(game, 900);
    expect(game.state.homeLevels[0]).toBeLessThan(24);
    expect(cohortTotal(game.state.homeLevels)).toBe(24);
  });

  /**
   * The headline claim of this change: the top of the skyline is the
   * university's to unlock. A district's share of the 2x2 sites is 1.5 schools,
   * which covers a district of towers to 63% against a requirement of 85%.
   */
  it('cannot reach level 3 on schools alone', () => {
    const districts = 4;
    const homes = 24 * districts;
    const schools = siteCapacity(state({ districts }), 'school');
    const game = at({
      ...housed(homes),
      ...content(),
      districts,
      occupancyR: 1,
      schools,
      schoolStaff: 1,
      cash: 1e12,
    });
    for (let i = 0; i < 200; i++) game.catchUp(60);

    // It climbs, and then it stops one rung short.
    expect(game.state.homeLevels[2]).toBeGreaterThan(0);
    expect(game.state.homeLevels[LEVELS - 1]).toBe(0);
    expect(educationCoverage(game.state)).toBeLessThan(LEVEL_EDUCATION[LEVELS - 1] ?? 1);

    // Found the universities the land allows and the ceiling lifts.
    Object.assign(game.state, {
      universities: universitySiteCapacity(game.state),
      universityStaff: 1,
    });
    expect(educationCoverage(game.state)).toBeGreaterThanOrEqual(LEVEL_EDUCATION[LEVELS - 1] ?? 1);
    for (let i = 0; i < 200; i++) game.catchUp(60);
    expect(game.state.homeLevels[LEVELS - 1]).toBeGreaterThan(0);
    expect(cohortTotal(game.state.homeLevels)).toBe(homes);
  });
});

describe('education land', () => {
  it('gives schools the fourth slot of the 2x2 interleave', () => {
    expect(CIVIC_SERVICES.map((s) => s.key)).toEqual(['hospital', 'police', 'fire', 'school']);
    for (const districts of [1, 2, 5, 9]) {
      const s = state({ districts });
      const shared = CIVIC_SERVICES.reduce((sum, svc) => sum + siteCapacity(s, svc.key), 0);
      // Divides the shared list exactly: nothing stranded, nothing shared.
      expect(shared).toBe(civicSiteCapacity(s));
    }
    // The first district's six sites split 2/2/1/1 across the four types.
    const one = state({ districts: 1 });
    expect(CIVIC_SERVICES.map((svc) => siteCapacity(one, svc.key))).toEqual([2, 2, 1, 1]);
  });

  it('gives the university its own list, one to a district', () => {
    for (const districts of [1, 3, 12]) {
      const s = state({ districts });
      expect(siteCapacity(s, 'university')).toBe(districts);
      expect(universitySiteCapacity(s)).toBe(districts);
    }
    // And it never draws on a civic quad, so a hospital cannot take its land.
    const layout = new CityLayout().ensure(4);
    const civic = new Set<string>();
    for (let i = 0; i < layout.civicSites; i++) {
      const c = layout.civicSiteCell(i);
      for (const dz of [0, 1]) for (const dx of [0, 1]) civic.add(`${c.x + dx},${c.z + dz}`);
    }
    for (let i = 0; i < layout.universitySites; i++) {
      const c = layout.universitySiteCell(i);
      for (let dz = 0; dz < 3; dz++) {
        for (let dx = 0; dx < 3; dx++) expect(civic.has(`${c.x + dx},${c.z + dz}`)).toBe(false);
      }
    }
  });

  it('runs out of university land rather than of permission', () => {
    const s = state({ ...housed(24 * 3, 3), districts: 3, cash: 1e15 });
    expect(university).toBeDefined();
    const many = { ...s, universities: universitySiteCapacity(s) };
    expect(canBuildService(many, university as never)).toBe(false);
    expect(serviceBlocker(many, university as never)).toBe('No sites left');
    expect(serviceCount(many, 'university')).toBe(serviceAllowed(many, university as never));
  });
});

describe('the university price curve', () => {
  it('opens as a landmark and compounds faster than a civic building', () => {
    const civic = SERVICES.find((s) => s.key === 'hospital');
    expect(university?.base ?? 0).toBeGreaterThan((civic?.base ?? 0) * 20);
    expect(university?.growth ?? 0).toBeGreaterThan(civic?.growth ?? 0);

    // Steeper in practice, not just in the constant: the second one costs
    // nearly twice the first, where a second hospital is a third dearer.
    const s = state({ ...housed(24 * 9, 3), districts: 9 });
    const first = serviceCost(s, university as never);
    const second = serviceCost({ ...s, universities: 1 }, university as never);
    expect(second / first).toBeCloseTo(university?.growth ?? 0, 9);
    expect(second / first).toBeGreaterThan(1.5);
  });

  it('is priced against a city that has been running, not an opening one', () => {
    // A university costs more than filling a district's entire housing stock
    // does, so it is never the first thing a player buys.
    const s = state();
    expect(serviceCost(s, university as never)).toBeGreaterThan(5_000);
    for (const other of SERVICES) {
      if (other.key === 'university') continue;
      expect(serviceCost(s, university as never)).toBeGreaterThan(serviceCost(s, other) * 10);
    }
  });
});

describe('coverage still behaves for the three that feed happiness', () => {
  it('is unchanged by the two that do not', () => {
    const bare = state({ ...housed(24, 2), hospitals: 1, hospitalStaff: 1 });
    const taught = { ...bare, schools: 9, schoolStaff: 1, universities: 9, universityStaff: 1 };
    for (const service of HAPPINESS_SERVICES) {
      expect(coverage(taught, service)).toBe(coverage(bare, service));
    }
  });
});
