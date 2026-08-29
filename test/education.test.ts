import { describe, expect, it } from 'vitest';
import {
  INDUSTRY_BONUS,
  SHOP_BONUS,
  CIVIC_SERVICES,
  EDUCATION_SERVICES,
  HAPPINESS_SERVICES,
  LEVEL_EDUCATION,
  LEVELS,
  MAX_DISTRICTS,
  SERVICES,
  SKILL_YIELD,
} from '../src/sim/config';
import {
  bindingTerm,
  canBuildService,
  demandTargets,
  income,
  workforceSkill,
  civicSiteCapacity,
  plotsOf,
  coverage,
  educationCoverage,
  happinessTarget,
  happinessTerms,
  effectiveOf,
  estateEarning,
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
import { housed, housedOn, making, powered, trading, zonedAt } from './levels';

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
    // The rule this whole design turns on. Happiness is calibrated across
    // weights summing to 1; one more would re-open that for nothing, because
    // what education is *for* is deciding how tall the city may build.
    for (const service of EDUCATION_SERVICES) expect(service.weight).toBe(0);
    expect(EDUCATION_SERVICES.map((s) => s.key)).toEqual(['school', 'university']);
    // Two rather than three since crime: police left the weighted sum, and the
    // 0.26 it carried was re-normalised across what was left. It is the same
    // rule this test states, applied to a service that had a weight and stopped
    // needing one — see the police row in SERVICES.
    expect(HAPPINESS_SERVICES.map((s) => s.key)).toEqual(['hospital', 'fire']);

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
  it('pools schools and universities against the housing land', () => {
    // Two districts' worth of housing land, whatever level stands on it.
    const plots = 48;
    const s = state({ ...housedOn(plots, 2), schools: 2, schoolStaff: 1 });
    expect(educationCoverage(s)).toBeCloseTo((2 * (school?.plots ?? 0)) / plots, 9);

    const withUni = { ...s, universities: 2, universityStaff: 1 };
    expect(educationCoverage(withUni)).toBeCloseTo(
      Math.min(1, (2 * (school?.plots ?? 0) + 2 * (university?.plots ?? 0)) / plots),
      9,
    );
    expect(educationCoverage(withUni)).toBe(1);
  });

  /**
   * The top rung is the pair's, not either one's. A university reaches more
   * land than a school and there is one site for it against 1.2 school sites,
   * so neither type alone clears LEVEL_EDUCATION's 0.85 — which is what makes
   * the last level something the city finishes rather than something it buys.
   */
  it('needs both types for the top rung, and neither alone', () => {
    expect(university?.plots ?? 0).toBeGreaterThan(school?.plots ?? 0);
    const top = LEVEL_EDUCATION[LEVELS - 1] ?? 1;
    const plots = 24;
    const schoolsOnly = state({ ...housedOn(plots, 2), schools: 1, schoolStaff: 1 });
    const uniOnly = state({ ...housedOn(plots, 2), universities: 1, universityStaff: 1 });
    const both = { ...schoolsOnly, universities: 1, universityStaff: 1 };
    expect(educationCoverage(schoolsOnly)).toBeLessThan(top);
    expect(educationCoverage(uniOnly)).toBeLessThan(top);
    expect(educationCoverage(both)).toBeGreaterThanOrEqual(top);
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
    // Plots, not buildings: climbing past LEVEL_FOOTPRINT's first 2 merges
    // pairs, so the count falls while the land under it does not.
    expect(plotsOf(game.state, 'home')).toBe(24);
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
      // Lit, because this is a test about the education gate. A browned-out
      // city caps its occupancy at POWER_FLOOR, which holds it under
      // LEVEL_UP_OCCUPANCY — so without the grid this would stop climbing for
      // a reason that has nothing to do with schools.
      ...powered(),
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
    expect(plotsOf(game.state, 'home')).toBe(homes);
  });
});

describe('education land', () => {
  it('gives schools the fourth slot of the 2x2 interleave', () => {
    expect(CIVIC_SERVICES.map((s) => s.key)).toEqual([
      'hospital',
      'police',
      'fire',
      'school',
      'transit',
    ]);
    for (const districts of [1, 2, 5, 9]) {
      const s = state({ districts });
      const shared = CIVIC_SERVICES.reduce((sum, svc) => sum + siteCapacity(s, svc.key), 0);
      // Divides the shared list exactly: nothing stranded, nothing shared.
      expect(shared).toBe(civicSiteCapacity(s));
    }
    // The first district's six sites split 2/1/1/1/1 across the five types, so
    // a young city can open one of each and still have a site to spare.
    const one = state({ districts: 1 });
    expect(CIVIC_SERVICES.map((svc) => siteCapacity(one, svc.key))).toEqual([2, 1, 1, 1, 1]);
  });

  it('gives the university its own list, one to a district', () => {
    for (const districts of [1, 3, 12]) {
      const s = state({ districts });
      expect(siteCapacity(s, 'university')).toBe(districts);
      expect(universitySiteCapacity(s)).toBe(districts);
    }
    // And it never draws on a civic quad, so a hospital cannot take its land.
    const layout = new CityLayout().ensure(zonedAt(4));
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

/**
 * Education's second job: an educated city's works are worth more.
 *
 * The trap the whole feature is arranged around is that this cannot go on the
 * goods side. INDUSTRY_OUTPUT feeds `demandTargets.i` *negatively* — it is
 * supply against the export tap — so a skill bonus that raised output would
 * make an educated city stop wanting industry, and DEMAND_TERMS' own +0.20
 * education term on industrial demand would be pulling the other way through
 * the same coverage. The first test below is the one that would catch it.
 */
describe('the workforce skill', () => {
  const taught = (patch: Partial<GameState> = {}): Partial<GameState> => ({
    schools: 40,
    schoolStaff: 1,
    universities: 40,
    universityStaff: 1,
    ...patch,
  });

  it('is 1 at no coverage and bounded at full', () => {
    const bare = state({ ...housed(24, 1) });
    expect(educationCoverage(bare)).toBe(0);
    expect(workforceSkill(bare)).toBe(1);

    const schooled = state({ ...housed(24, 1), ...taught() });
    expect(educationCoverage(schooled)).toBe(1);
    expect(workforceSkill(schooled)).toBeCloseTo(1 + SKILL_YIELD, 12);

    // And it is a share of a share, so nothing can push it past the bound —
    // there is no city, however over-provisioned, worth more than SKILL_YIELD.
    const absurd = state({ ...housed(24, 1), schools: 4000, schoolStaff: 1, universities: 4000, universityStaff: 1 });
    expect(workforceSkill(absurd)).toBeCloseTo(1 + SKILL_YIELD, 12);
  });

  it('ramps with the staffing rather than with the building', () => {
    // The lag the feature needs and does not add: education already lags
    // through the ramp its coverage is multiplied by, so a school opened this
    // instant is worth nothing yet.
    const opened = state({ ...housed(24, 1), schools: 40, schoolStaff: 0 });
    expect(workforceSkill(opened)).toBe(1);
    let last = 0;
    for (const staff of [0, 0.25, 0.5, 0.75, 1]) {
      const s = state({ ...housed(24, 1), schools: 2, schoolStaff: staff });
      expect(workforceSkill(s)).toBeGreaterThanOrEqual(last);
      last = workforceSkill(s);
    }
  });

  it('never appears in a demand target', () => {
    // The trap, asserted: schooling must not move the goods side. Industrial
    // demand may only move through DEMAND_TERMS' own education term, which is
    // *positive* — so a taught city wants more industry, not less.
    const base = state({ ...housed(96, 1), ...trading(45), ...making(13), districts: 4, occupancyR: 1, occupancyC: 1, occupancyI: 1 });
    const schooled = state({ ...base, ...taught() });
    // Same buildings, same occupancy: the only thing that moved is schooling.
    expect(demandTargets(schooled).i).toBeGreaterThanOrEqual(demandTargets(base).i);
    // And with the education demand term held level — same coverage on both
    // sides — the skill contributes exactly nothing to any signal.
    const a = demandTargets(schooled);
    const b = demandTargets({ ...schooled, industry: schooled.industry });
    expect(a.i).toBe(b.i);
    expect(a.c).toBe(b.c);
    expect(a.r).toBe(b.r);
  });

  it('raises income, monotonically in schools and universities', () => {
    const base = state({
      ...housed(96, 1),
      ...trading(45),
      ...making(13),
      districts: 4,
      occupancyR: 1,
      occupancyC: 1,
      occupancyI: 1,
      happiness: 1,
    });
    let last = 0;
    for (const schools of [0, 1, 2, 4, 8]) {
      const s = state({ ...base, schools, schoolStaff: 1 });
      expect(income(s)).toBeGreaterThanOrEqual(last);
      last = income(s);
    }
    last = 0;
    for (const universities of [0, 1, 2, 4]) {
      const s = state({ ...base, universities, universityStaff: 1 });
      expect(income(s)).toBeGreaterThanOrEqual(last);
      last = income(s);
    }
    // Full coverage is worth the whole yield on the industrial term, which is
    // about a tenth of the ledger — see tools/education.calibrate.mjs.
    const full = income(state({ ...base, ...taught() }));
    expect(full / income(base) - 1).toBeGreaterThan(0.05);
    expect(full / income(base) - 1).toBeLessThan(0.2);
  });

  it('reaches the estates, because they are the same firms', () => {
    // `estateEarning` already multiplies by `industryScale` — the mean level
    // weight of city industry — so the band is the city's industry with a road
    // between. A skill that stopped at the city limit would mean an educated
    // city's works got better everywhere except where it had most recently
    // expanded.
    const base = state({
      ...housed(24 * 20, 1),
      ...making(13 * 20),
      districts: 20,
      highway: true,
      estates: 8,
      occupancyR: 1,
      occupancyI: 1,
      happiness: 1,
    });
    const withEstates = income(state({ ...base, ...taught() })) - income(base);
    const without = income(state({ ...base, estates: 0, ...taught() })) - income({ ...base, estates: 0 });
    expect(withEstates).toBeGreaterThan(without);
  });

  it('does not overtake the shop bonus at full coverage', () => {
    // The bound the design names. Read on the built-out map, where the two
    // terms are furthest apart in the city's favour.
    const s = state({
      ...housed(24 * MAX_DISTRICTS, 2),
      ...trading(45 * MAX_DISTRICTS / 2),
      ...making(Math.floor((13 * MAX_DISTRICTS) / 2)),
      districts: MAX_DISTRICTS,
      occupancyR: 1,
      occupancyC: 1,
      occupancyI: 1,
      ...taught(),
    });
    const shop = SHOP_BONUS * effectiveOf(s, 'shop');
    const works = INDUSTRY_BONUS * (effectiveOf(s, 'industry') + estateEarning(s)) * workforceSkill(s);
    expect(works).toBeLessThan(shop);
  });

  it('leaves LEVEL_EDUCATION alone', () => {
    // Education still gates height and only gates it. A second education term
    // on the promotion *rate* would double-count the same coverage — see
    // NOTES.md, where the case for it is written up and not implemented.
    for (let level = 1; level < LEVELS; level++) {
      expect(LEVEL_EDUCATION[level]).toBeGreaterThanOrEqual(0);
      expect(LEVEL_EDUCATION[level]).toBeLessThanOrEqual(1);
    }
    expect(LEVEL_EDUCATION[0]).toBe(0);
  });
});
