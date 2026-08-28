import { describe, expect, it } from 'vitest';
import {
  CITY_HALL_BASE,
  HIGHWAY_MIN_DISTRICTS,
  LANDMARKS,
  LEVELS,
  MAX_DISTRICTS,
  RANKS,
  RANK_GATES,
  SERVICES,
  type CityRank,
  type Landmark,
} from '../src/sim/config';
import {
  canBuildCityHall,
  canBuildHighway,
  canBuildLandmark,
  canBuildService,
  cityHallBlocker,
  cityRank,
  highwayBlocker,
  landmarkBlocker,
  nextRank,
  population,
  rankAllows,
  rankAt,
  rankBlocker,
  rankProgress,
  serviceBlocker,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { migrate } from '../src/sim/save';
import { createState, type GameState } from '../src/sim/state';
import { atRank, housed } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

const MUSEUM = LANDMARKS.find((l) => l.key === 'museum') as Landmark;
const STADIUM = LANDMARKS.find((l) => l.key === 'stadium') as Landmark;

describe('the ladder', () => {
  it('climbs in both columns at once, so a rung is never a step backwards', () => {
    for (let i = 1; i < RANKS.length; i++) {
      const rank = RANKS[i] as CityRank;
      const below = RANKS[i - 1] as CityRank;
      expect(rank.index).toBe(i);
      expect(rank.districts).toBeGreaterThanOrEqual(below.districts);
      expect(rank.population).toBeGreaterThan(below.population);
      expect(rank.name.length).toBeGreaterThan(0);
    }
  });

  it('starts every city at the bottom rung and asks nothing of it', () => {
    const fresh = createState(0);
    expect(cityRank(fresh).index).toBe(0);
    expect(RANKS[0]?.districts).toBe(1);
    expect(RANKS[0]?.population).toBe(0);
  });

  it('is the lower of what the two columns say', () => {
    const town = RANKS[1] as CityRank;
    const city = RANKS[2] as CityRank;
    // The people without the land. A district of arcologies is dense, and a
    // dense village is still a village.
    const dense = state({ districts: 1, ...housed(400, LEVELS - 1) });
    expect(population(dense)).toBeGreaterThan(city.population);
    expect(cityRank(dense).index).toBeLessThan(city.index);
    // The land without the people. Forty-nine districts of nothing at all.
    const empty = state({ districts: MAX_DISTRICTS });
    expect(cityRank(empty).index).toBe(0);
    // Both, and it is a city.
    const both = state(atRank(city.index, city.districts));
    expect(cityRank(both).index).toBe(city.index);
    void town;
  });

  it('reads the housing stock, not who is standing in it', () => {
    const built = state(atRank(2, 4));
    const full = cityRank({ ...built, occupancyR: 1 });
    // A tax rate that empties the city does not demote it. Occupancy is
    // integrated and a rank read through it would flicker.
    const emptied = cityRank({ ...built, occupancyR: 0.05 });
    expect(emptied.index).toBe(full.index);
  });

  it('is derived, so it never reaches the save', () => {
    const s = state(atRank(3, HIGHWAY_MIN_DISTRICTS));
    // Round-tripped through the migration, which is the shape a save actually
    // takes: nothing named a rank goes in, and the rank comes back out of the
    // counts on the other side.
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back).not.toBeNull();
    expect(Object.keys(back as GameState)).not.toContain('rank');
    expect(cityRank(back as GameState).index).toBe(cityRank(s).index);
  });

  it('counts toward the next rung, and stops counting at the top', () => {
    const village = state({ districts: 1 });
    expect(nextRank(village)?.index).toBe(1);
    expect(rankProgress(village)).toBe(0);
    const top = state(atRank(RANKS.length - 1, MAX_DISTRICTS));
    expect(cityRank(top).index).toBe(RANKS.length - 1);
    expect(nextRank(top)).toBeNull();
    expect(rankProgress(top)).toBeNull();
    // And it is the lesser of the two shares: half the people is half the way
    // even with all the land.
    const half = RANKS[1] as CityRank;
    const rich = state({
      districts: MAX_DISTRICTS,
      ...housed(Math.round(half.population / 2 / 140), 2),
    });
    expect(rankProgress(rich) ?? 1).toBeLessThan(0.7);
  });
});

describe('what a rank gates', () => {
  it('names the rank the way the rest of the HUD names a gate', () => {
    const village = state({ districts: 1 });
    for (const gate of Object.keys(RANK_GATES) as Array<keyof typeof RANK_GATES>) {
      const needed = RANKS[rankAt(gate)] as CityRank;
      expect(rankBlocker(village, gate)).toBe(`Needs a ${needed.name.toLowerCase()}`);
      expect(rankAllows(village, gate)).toBe(false);
    }
  });

  it('says nothing once the city has climbed', () => {
    for (const gate of Object.keys(RANK_GATES) as Array<keyof typeof RANK_GATES>) {
      const s = state(atRank(rankAt(gate), RANKS[rankAt(gate)]?.districts));
      expect(rankBlocker(s, gate)).toBeNull();
      expect(rankAllows(s, gate)).toBe(true);
    }
  });

  it('holds the city hall shut until there is a town to run', () => {
    const village = state({ districts: 1, cash: CITY_HALL_BASE * 10 });
    expect(canBuildCityHall(village)).toBe(false);
    expect(cityHallBlocker(village)).toBe('Needs a town');
    const game = new Game(village);
    expect(game.buildCityHall()).toBe(false);

    const town = state({ ...atRank(RANK_GATES.cityHall), cash: CITY_HALL_BASE * 10 });
    expect(canBuildCityHall(town)).toBe(true);
    expect(cityHallBlocker(town)).toBeNull();
    expect(new Game(town).buildCityHall()).toBe(true);
  });

  it('holds the landmarks shut, each at its own rung', () => {
    const village = state({ districts: 4, cash: 1e12 });
    expect(canBuildLandmark(village, MUSEUM)).toBe(false);
    expect(landmarkBlocker(village, MUSEUM)).toBe('Needs a town');
    expect(landmarkBlocker(village, STADIUM)).toBe('Needs a city');

    // A town has its museum and still no stadium, which is the point of two
    // rungs rather than one.
    const town = state({ ...atRank(RANK_GATES.museum, 4), cash: 1e12 });
    expect(canBuildLandmark(town, MUSEUM)).toBe(true);
    expect(landmarkBlocker(town, MUSEUM)).toBeNull();
    expect(canBuildLandmark(town, STADIUM)).toBe(false);

    const city = state({ ...atRank(RANK_GATES.stadium, 4), cash: 1e12 });
    expect(canBuildLandmark(city, STADIUM)).toBe(true);
    expect(landmarkBlocker(city, STADIUM)).toBeNull();
  });

  it('replaces the highway district count rather than stacking on it', () => {
    // The whole of "do not put two gates on one button": the rank's own
    // district column *is* HIGHWAY_MIN_DISTRICTS, so the road unlocks where it
    // always did and the button says the rank by name instead of the number.
    const conurbation = RANKS[RANK_GATES.highway] as CityRank;
    expect(conurbation.districts).toBe(HIGHWAY_MIN_DISTRICTS);
    const short = state({
      ...atRank(RANK_GATES.highway, HIGHWAY_MIN_DISTRICTS - 1),
      districts: HIGHWAY_MIN_DISTRICTS - 1,
      cash: 1e14,
    });
    expect(canBuildHighway(short)).toBe(false);
    expect(highwayBlocker(short)).toBe(`Needs a ${conurbation.name.toLowerCase()}`);
    const ready = state({ ...atRank(RANK_GATES.highway, HIGHWAY_MIN_DISTRICTS), cash: 1e14 });
    expect(canBuildHighway(ready)).toBe(true);
    expect(highwayBlocker(ready)).toBeNull();
  });

  it('leaves every service off the ladder, the university included', () => {
    // The one that was tried and measured out: `educationCoverage` needs
    // universities to clear LEVEL_EDUCATION's second rung at any city size the
    // opening reaches, so a rank on it deadlocks the level ladder rather than
    // gating it. See `serviceBlocker`.
    const village = state({ districts: 1, ...housed(4), cash: 1e12 });
    for (const service of SERVICES) {
      expect(serviceBlocker(village, service) ?? '').not.toMatch(/^Needs a /);
    }
    const university = SERVICES.find((s) => s.key === 'university');
    expect(university).toBeDefined();
    if (university) expect(canBuildService(village, university)).toBe(true);
  });

  it('never gates the grid, which a city needs before it is big', () => {
    // A brownout caps occupancy at POWER_FLOOR, so a plant is what lets a city
    // reach a rank. Gating it would be a gate on its own precondition.
    const village = state({ districts: 1, ...housed(4), cash: 1e12 });
    const game = new Game(village);
    expect(game.buildPlant()).toBe(true);
  });
});

describe('the opening is untouched', () => {
  it('still lets the player spend immediately', () => {
    const game = new Game(createState(0));
    expect(game.buildHome()).toBe(true);
    expect(game.buildHome()).toBe(true);
  });

  it('gates nothing a village has to buy in its first hour', () => {
    // Housing, commerce, industry, parks and the services a city needs
    // for happiness are all on the table at rank 0. If any of them were not,
    // the pacing guard in test/game.test.ts would be measuring a rank.
    const village = state({ districts: 1, ...housed(4), cash: 1e9, happiness: 1 });
    const game = new Game(village);
    expect(game.buildHome()).toBe(true);
    expect(game.buildShop()).toBe(true);
    expect(game.buildIndustry()).toBe(true);
    expect(game.buildPark()).toBe(true);
    for (const service of SERVICES) {
      if (service.key === 'university') continue;
      expect(game.buildService(service)).toBe(true);
    }
  });
});
