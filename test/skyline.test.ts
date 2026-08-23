import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/sim/config';
import { CityLayout } from '../src/sim/layout';
import { Buildings } from '../src/render/buildings';
import { createState, type GameState } from '../src/sim/state';
import { housed, trading } from './levels';

/**
 * The building layer, checked as a black box.
 *
 * `Buildings` owns no game state — given counts it reconciles the scene toward
 * them — so it can be driven headlessly: three's scene graph needs no WebGL
 * context, only `WebGLRenderer` does. What is worth checking here is the one
 * piece of the renderer that is not obvious by eye: the map from level cohorts
 * to instance ranges, and the roof bank that is packed per *variant* while the
 * bodies are packed per *level*. A slot's roof landing on the wrong instance is
 * invisible in a screenshot of a settled city and glaring the moment one grows.
 */
const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

interface Scene {
  readonly buildings: Buildings;
  counts(): Map<string, number>;
}

function scene(): Scene {
  const root = new THREE.Scene();
  const buildings = new Buildings(root, new CityLayout());
  return {
    buildings,
    counts(): Map<string, number> {
      const found = new Map<string, number>();
      root.traverse((object) => {
        if (!(object instanceof THREE.InstancedMesh) || object.name === '') return;
        found.set(object.name, (found.get(object.name) ?? 0) + object.count);
      });
      return found;
    },
  };
}

const roofTotal = (counts: Map<string, number>): number =>
  (counts.get('roof:pitched') ?? 0) +
  (counts.get('roof:flat') ?? 0) +
  (counts.get('roof:parapet') ?? 0);

describe('the skyline the renderer draws', () => {
  it('gives every home exactly one body and one roof', () => {
    const { buildings, counts } = scene();
    for (const levels of [
      [24, 0, 0, 0],
      [0, 24, 0, 0],
      [6, 6, 6, 6],
      [1, 2, 3, 18],
      [0, 0, 0, 24],
    ]) {
      buildings.sync(state({ homes: 24, homeLevels: [...levels] }), 0);
      const seen = counts();
      for (let l = 0; l < LEVELS; l++) {
        expect(seen.get(`home:${l}`) ?? 0).toBe(levels[l]);
      }
      expect(roofTotal(seen)).toBe(24);
    }
  });

  it('keeps the roof bank in step through a promotion', () => {
    // The case the shared bank exists for: a promotion moves one building from
    // one body mesh to another, and its roof from one variant to another. Both
    // packings are rebuilt, and neither may strand or duplicate an instance.
    const { buildings, counts } = scene();
    const levels = [24, 0, 0, 0];
    for (let promoted = 0; promoted <= 24; promoted++) {
      levels[0] = 24 - promoted;
      levels[1] = promoted;
      buildings.sync(state({ homes: 24, homeLevels: [...levels] }), promoted * 0.1);
      const seen = counts();
      expect(seen.get('home:0')).toBe(24 - promoted);
      expect(seen.get('home:1')).toBe(promoted);
      expect(roofTotal(seen)).toBe(24);
    }
  });

  it('draws a ruin on its plot, in the level-0 set, with a roof', () => {
    const { buildings, counts } = scene();
    // Twenty standing homes at level 2, four boarded up. The ruins hold their
    // plots, so the city still draws 24 buildings and 24 roofs.
    buildings.sync(state({ homes: 24, homeLevels: [0, 0, 20, 0], abandonedR: 4 }), 0);
    const seen = counts();
    expect(seen.get('home:2')).toBe(20);
    expect(seen.get('home:0')).toBe(4);
    expect(roofTotal(seen)).toBe(24);
    // Every ruin takes the flat roof, so there are at least four of them.
    expect(seen.get('roof:flat') ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('puts out the lights on a shuttered shop but leaves it standing', () => {
    const { buildings, counts } = scene();
    buildings.sync(state({ ...trading(20) }), 0);
    expect(counts().get('shop:body')).toBe(20);
    expect(counts().get('shop:fascia')).toBe(20);

    // Seven closed. The bodies stay — the plot is still occupied — and exactly
    // the trading thirteen keep a lit fascia.
    buildings.sync(state({ shops: 20, shopLevels: [13, 0, 0, 0], abandonedC: 7 }), 1);
    expect(counts().get('shop:body')).toBe(20);
    expect(counts().get('shop:fascia')).toBe(13);
  });

  it('uses more than one roof shape, and only sensible ones per level', () => {
    const { buildings, counts } = scene();
    // A whole district of detached housing: pitched roofs dominate, because a
    // pitched roof is what makes a house read as a house.
    buildings.sync(state(housed(24)), 0);
    const cottages = counts();
    expect(cottages.get('roof:pitched') ?? 0).toBeGreaterThan(10);
    expect(cottages.get('roof:flat') ?? 0).toBe(0);

    // A whole district of arcologies: never pitched, and a mix of the other two.
    buildings.sync(state(housed(24, 3)), 1);
    const towers = counts();
    expect(towers.get('roof:pitched') ?? 0).toBe(0);
    expect(towers.get('roof:flat') ?? 0).toBeGreaterThan(0);
    expect(towers.get('roof:parapet') ?? 0).toBeGreaterThan(0);
  });

  it('costs three roof draw calls whatever the city is made of', () => {
    // The constraint the shared bank exists to satisfy. Three variants across
    // four levels would be twelve meshes if each level owned its own; the
    // geometry is a unit shape scaled per instance instead, so it is three.
    const root = new THREE.Scene();
    const buildings = new Buildings(root, new CityLayout());
    buildings.sync(state({ homes: 400, homeLevels: [100, 100, 100, 100], districts: 20 }), 0);
    const roofs: string[] = [];
    root.traverse((object) => {
      if (object instanceof THREE.InstancedMesh && object.name.startsWith('roof:')) {
        roofs.push(object.name);
      }
    });
    expect(roofs.sort()).toEqual(['roof:flat', 'roof:parapet', 'roof:pitched']);
  });
});
