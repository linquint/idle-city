import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LEVELS, MERGE_LEVEL } from '../src/sim/config';
import {
  buildingIncome,
  levelAt,
  mergedOf,
  promotionBlocker,
  zoneOf,
} from '../src/sim/economy';
import { Buildings, type BuildingRef } from '../src/render/buildings';
import { CityLayout, createPlacement } from '../src/sim/layout';
import { save } from '../src/sim/save';
import { createState, type GameState, type ZoneKind } from '../src/sim/state';
import { housed, making, served, trading } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/**
 * The building layer, driven headlessly.
 *
 * `Raycaster` is pure geometry — no WebGL context is involved — so the pick
 * path can be tested end to end against the real instance matrices rather than
 * against a reimplementation of them.
 */
function scene(patch: Partial<GameState>): {
  buildings: Buildings;
  layout: CityLayout;
  s: GameState;
} {
  const root = new THREE.Scene();
  const layout = new CityLayout();
  const buildings = new Buildings(root, layout);
  const s = state(patch);
  layout.ensure(s);
  buildings.sync(s, 0);
  return { buildings, layout, s };
}

/** Fires a ray straight down onto a world point and asks what it hit. */
function under(buildings: Buildings, x: number, z: number): BuildingRef | null {
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(x, 400, z),
    new THREE.Vector3(0, -1, 0),
  );
  return buildings.pick(raycaster);
}

/**
 * Every distinct answer a plot gives to a ray dropped anywhere over it.
 *
 * The plot centre used to be enough, because every body was a box centred on
 * it. A modelled building is not: the modern house is an L of two wings with
 * its drive in the notch, and the notch is where the plot centre falls — so a
 * ray straight down the middle of that plot passes through its garden and hits
 * the ground, exactly as a ray a metre off the middle of *any* plot always has.
 * A plot is 4 units across and nothing on it has ever filled that.
 *
 * So the question the pick map actually has to answer is this one: a building
 * is hittable somewhere over its own plot, and everything hit over that plot is
 * that building. Sweeping is what asks it.
 */
function over(buildings: Buildings, x: number, z: number): Set<string> {
  const found = new Set<string>();
  for (let i = -4; i <= 4; i++) {
    for (let j = -4; j <= 4; j++) {
      const hit = under(buildings, x + i * 0.4, z + j * 0.4);
      if (hit) found.add(`${hit.kind}:${hit.slot}`);
    }
  }
  return found;
}

describe('picking a building', () => {
  it('round-trips every built slot, in every zone', () => {
    const { buildings, layout, s } = scene({
      ...housed(18),
      ...trading(14),
      ...making(6),
      districts: 2,
    });
    const out = createPlacement();
    for (const kind of ['home', 'shop', 'industry'] as ZoneKind[]) {
      const count = kind === 'home' ? s.homes : kind === 'shop' ? s.shops : s.industry;
      for (let slot = 0; slot < count; slot++) {
        const at = layout.place(zoneOf(kind), slot, mergedOf(s, kind), s, out);
        // Its own plot answers with it, and with nothing else. A neighbour
        // reaching over the kerb would show up here as a second entry.
        expect(over(buildings, at.x, at.z)).toEqual(new Set([`${kind}:${slot}`]));
      }
    }
  });

  it('round-trips a mixed skyline, where a level and a slot are different numbers', () => {
    // The case the range map exists for: the bodies are packed per level, so a
    // level-2 building's instance index has nothing to do with its slot.
    const { buildings, layout, s } = scene({
      homes: 14,
      homeLevels: [6, 4, 3, 1],
      mergedR: 4,
      districts: 2,
      occupancyR: 1,
    });
    const out = createPlacement();
    for (let slot = 0; slot < s.homes; slot++) {
      const at = layout.place(zoneOf('home'), slot, s.mergedR, s, out);
      expect(over(buildings, at.x, at.z)).toEqual(new Set([`home:${slot}`]));
    }
  });

  it('round-trips ruins, which hold a plot and no level', () => {
    const { buildings, layout, s } = scene({
      homes: 12,
      homeLevels: [8, 0, 0, 0],
      abandonedR: 4,
      districts: 1,
    });
    const out = createPlacement();
    for (let slot = 0; slot < s.homes; slot++) {
      const at = layout.place(zoneOf('home'), slot, 0, s, out);
      expect(over(buildings, at.x, at.z)).toEqual(new Set([`home:${slot}`]));
    }
  });

  it('hits nothing over empty land or a civic site', () => {
    const { buildings } = scene({ ...housed(4), hospitals: 1, districts: 1 });
    // Far outside the first district, over grassland.
    expect(under(buildings, 900, 900)).toBeNull();
  });
});

describe('the selection', () => {
  it('never reaches the save', () => {
    const s = state({ ...housed(6), districts: 1 });
    const before = JSON.stringify(s);
    const { buildings } = scene({ ...housed(6), districts: 1 });
    buildings.highlight({ kind: 'home', slot: 2 }, s);
    // Highlighting is a write to the scene graph and to nothing else.
    expect(JSON.stringify(s)).toBe(before);

    const written = JSON.parse(JSON.stringify({ ...s, savedAt: 0 })) as Record<string, unknown>;
    for (const key of Object.keys(written)) {
      expect(key.toLowerCase()).not.toContain('select');
    }
    expect(typeof save).toBe('function');
  });

  it('drops a building the city no longer owns', () => {
    // Nothing crashes and nothing is drawn when the slot has gone.
    const { buildings } = scene({ ...housed(6), districts: 1 });
    expect(() => buildings.highlight({ kind: 'home', slot: 99 }, state(housed(6)))).not.toThrow();
    expect(() => buildings.highlight(null, state(housed(6)))).not.toThrow();
  });
});

describe('what a building is allowed to say', () => {
  it('tells an unpairable plot it will never merge', () => {
    const s = state({ ...housed(20, MERGE_LEVEL - 1), ...served(), happiness: 1 });
    expect(promotionBlocker(s, 'home', MERGE_LEVEL - 1, 1)).toBe('No neighbour to merge with');
    // And the same building on a pair is only waiting its turn.
    expect(promotionBlocker(s, 'home', MERGE_LEVEL - 1, 2)).toBeNull();
  });

  it('names the top level rather than a gate', () => {
    const s = state({ ...housed(4, LEVELS - 1), ...served(), happiness: 1 });
    expect(promotionBlocker(s, 'home', LEVELS - 1, 2)).toBe('At its top level');
  });

  it('names the gate that is actually shut', () => {
    const bare = state({ ...housed(8), happiness: 1, occupancyR: 1 });
    expect(promotionBlocker(bare, 'home', 0, 2)).toContain('education');
    const empty = state({ ...housed(8), ...served(), happiness: 1, occupancyR: 0.1 });
    expect(promotionBlocker(empty, 'home', 0, 2)).toBe('Too empty to expand');
    const sad = state({ ...housed(8), ...served(), happiness: 0.1, occupancyR: 1 });
    expect(promotionBlocker(sad, 'home', 0, 2)).toBe('City is too unhappy');
  });

  it('quotes a marginal income, and zero for a ruin', () => {
    const s = state({ ...housed(10, 1), ...trading(6), districts: 1, happiness: 1 });
    expect(buildingIncome(s, 'home', -1)).toBe(0);
    // A taller home is worth more, and a shop is worth what taking it away
    // would cost the multiplier rather than a rent line of its own.
    expect(buildingIncome(s, 'home', 1)).toBeGreaterThan(buildingIncome(s, 'home', 0));
    expect(buildingIncome(s, 'shop', 1)).toBeGreaterThan(buildingIncome(s, 'shop', 0));
    expect(buildingIncome(s, 'shop', 0)).toBeGreaterThan(0);
  });

  it('reports a level that is a pure function of the cohorts', () => {
    const s = state({ homes: 10, homeLevels: [4, 3, 3, 0], mergedR: 3 });
    expect(levelAt(s.homeLevels, 0)).toBe(2);
    expect(levelAt(s.homeLevels, 2)).toBe(2);
    expect(levelAt(s.homeLevels, 3)).toBe(1);
    expect(levelAt(s.homeLevels, 9)).toBe(0);
  });
});
