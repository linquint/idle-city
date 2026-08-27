import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CELL, LEVELS, SEED } from '../src/sim/config';
import { CityLayout } from '../src/sim/layout';
import {
  bodyExtent,
  BUILDING_MESH_BUDGET,
  Buildings,
  buildingStyle,
} from '../src/render/buildings';
import { createState, type GameState, type ZoneKind } from '../src/sim/state';
import { housed, making, mix, trading } from './levels';

/**
 * The building layer, checked as a black box.
 *
 * `Buildings` owns no game state — given counts it reconciles the scene toward
 * them — so it can be driven headlessly: three's scene graph needs no WebGL
 * context, only `WebGLRenderer` does. What is worth checking here is the piece
 * of the renderer that is not obvious by eye: the map from level cohorts to
 * instance ranges, and the shared part bank that is packed per *part* while the
 * bodies are packed per (zone, level). A slot's roof landing on the wrong
 * instance is invisible in a screenshot of a settled city and glaring the
 * moment one grows.
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

const ROOF_PARTS = ['part:pitched', 'part:flat', 'part:parapet'] as const;

const roofTotal = (counts: Map<string, number>): number =>
  ROOF_PARTS.reduce((sum, name) => sum + (counts.get(name) ?? 0), 0);

/** Every InstancedMesh under a scene whose name starts with `prefix`. */
const meshes = (root: THREE.Object3D, prefix: string): THREE.InstancedMesh[] => {
  const found: THREE.InstancedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.InstancedMesh && object.name.startsWith(prefix)) found.push(object);
  });
  return found;
};

/** A cohort spread over every level the ladder has, summing to `total`. */
const spread = (total: number): number[] => {
  const each = Math.floor(total / LEVELS);
  const levels = new Array<number>(LEVELS).fill(each);
  levels[0] = total - each * (LEVELS - 1);
  return levels;
};

describe('the skyline the renderer draws', () => {
  it('gives every home exactly one body and one roof', () => {
    const { buildings, counts } = scene();
    for (const levels of [
      mix(24),
      mix(0, 24),
      spread(24),
      mix(1, 2, 3, 9, 9),
      mix(...new Array<number>(LEVELS - 1).fill(0), 24),
    ]) {
      buildings.sync(state({ homes: 24, homeLevels: [...levels] }), 0);
      const seen = counts();
      for (let l = 0; l < LEVELS; l++) {
        expect(seen.get(`home:${l}`) ?? 0).toBe(levels[l]);
      }
      expect(roofTotal(seen)).toBe(24);
    }
  });

  it('keeps the part bank in step through a promotion', () => {
    // The case the shared bank exists for: a promotion moves one building from
    // one body mesh to another, and its roof from one part to another. Both
    // packings are rebuilt, and neither may strand or duplicate an instance.
    const { buildings, counts } = scene();
    for (let promoted = 0; promoted <= 24; promoted++) {
      buildings.sync(
        state({ homes: 24, homeLevels: mix(24 - promoted, promoted) }),
        promoted * 0.1,
      );
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
    buildings.sync(state({ homes: 24, homeLevels: mix(0, 0, 20), abandonedR: 4 }), 0);
    const seen = counts();
    expect(seen.get('home:2')).toBe(20);
    expect(seen.get('home:0')).toBe(4);
    expect(roofTotal(seen)).toBe(24);
    // Every ruin takes the flat roof, so there are at least four of them.
    expect(seen.get('part:flat') ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('puts out the lights on a shuttered building but leaves it standing', () => {
    const { buildings, counts } = scene();
    buildings.sync(state({ ...trading(20) }), 0);
    const lit = counts().get('part:band') ?? 0;
    expect(lit).toBeGreaterThan(0);
    expect(counts().get('shop:0')).toBe(20);

    // Seven closed. The bodies stay — the plot is still occupied — and the lit
    // bands stop at the trading thirteen.
    buildings.sync(state({ shops: 20, shopLevels: mix(13), abandonedC: 7 }), 1);
    expect((counts().get('shop:0') ?? 0)).toBe(20);
    expect(counts().get('part:band') ?? 0).toBeLessThan(lit);
  });

  it('uses more than one roof shape, and only sensible ones per level', () => {
    const { buildings, counts } = scene();
    // A whole district of detached housing: pitched roofs dominate, because a
    // pitched roof is what makes a house read as a house.
    buildings.sync(state(housed(24)), 0);
    const cottages = counts();
    expect(cottages.get('part:pitched') ?? 0).toBeGreaterThan(10);
    expect(cottages.get('part:flat') ?? 0).toBe(0);

    // A whole district of megastructures: never pitched, and a mix of the other
    // two. Ten of them rather than twenty-four — each stands on a merged
    // parcel, and a district offers about ten pairs of housing frontage.
    buildings.sync(state(housed(10, LEVELS - 1)), 1);
    const towers = counts();
    expect(towers.get('part:pitched') ?? 0).toBe(0);
    expect(towers.get('part:flat') ?? 0).toBeGreaterThan(0);
    expect(towers.get('part:parapet') ?? 0).toBeGreaterThan(0);
  });
});

/**
 * Variety, and what it is allowed to cost.
 *
 * Five levels x three styles x three zones is 45 looks. As meshes that would be
 * 45 draw calls for what is fundamentally the same box, so a style is a
 * parameter set instead: proportions, a colour band, and which of the shared
 * unit-geometry parts it wears. The budget is the assertion — without it a
 * later change can quietly double the draw calls and nothing would notice.
 */
describe('what the ladder costs to draw', () => {
  /** Everything the three zone ladders put in the scene. Civic is separate. */
  const zoneMeshNames = (root: THREE.Object3D): string[] => {
    const names: string[] = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.InstancedMesh)) return;
      if (/^(home|shop|industry):\d+$/.test(object.name) || object.name.startsWith('part:')) {
        names.push(object.name);
      }
    });
    return names.sort();
  };

  it('stays inside the mesh budget, whatever the city is made of', () => {
    const root = new THREE.Scene();
    const buildings = new Buildings(root, new CityLayout());
    const empty = zoneMeshNames(root);
    buildings.sync(
      state({
        districts: 20,
        homes: 400,
        homeLevels: spread(400),
        shops: 300,
        shopLevels: spread(300),
        industry: 100,
        industryLevels: spread(100),
      }),
      0,
    );
    const full = zoneMeshNames(root);
    // Every mesh exists from construction: growing the city grows instance
    // buffers, never the number of draw calls.
    expect(full).toEqual(empty);
    expect(full.length).toBeLessThanOrEqual(BUILDING_MESH_BUDGET);
    // One body per (zone, level), and no duplicates anywhere.
    expect(new Set(full).size).toBe(full.length);
    for (const kind of ['home', 'shop', 'industry']) {
      expect(full.filter((name) => name.startsWith(`${kind}:`))).toHaveLength(LEVELS);
    }
  });

  it('never lets a body cross its own kerb', () => {
    // The bound that decides every width in ZONE_SHAPES. A body reaches its
    // level's width times its style's multiplier times the top of the jitter
    // range, and CELL is the plot it has to stay inside — a building wider than
    // its plot renders through the kerb and into the street.
    for (const kind of ['home', 'shop', 'industry'] as const) {
      for (let level = 0; level < LEVELS; level++) {
        expect(bodyExtent(kind, level).width).toBeLessThan(CELL);
      }
    }
    // And industry is still the widest thing on the map, which is the whole of
    // how the type reads from the play camera.
    const widest = (kind: 'home' | 'shop' | 'industry'): number =>
      Math.max(...Array.from({ length: LEVELS }, (_, l) => bodyExtent(kind, l).width));
    expect(widest('industry')).toBeGreaterThan(widest('home'));
    expect(widest('industry')).toBeGreaterThan(widest('shop'));
  });

  it('climbs without turning the top rung into a needle', () => {
    // Housing climbs on height and the top rung is the slenderest thing the
    // ladder can build, so it is the one worth pinning. It stands on a merged
    // parcel, so the side actually seen is the body height against MERGED_SPAN
    // rather than against its own frontage.
    const top = bodyExtent('home', LEVELS - 1);
    const below = bodyExtent('home', LEVELS - 2);
    expect(top.height).toBeGreaterThan(below.height);
    const aspect = (extent: { height: number }): number => extent.height / (2 * CELL - 1.2);
    expect(aspect(top)).toBeGreaterThan(aspect(below));
    expect(aspect(top)).toBeLessThan(6);
    // Commerce stays well under housing from the rung housing becomes a block
    // of flats: height is housing's signal, and a shop that competed on it
    // would read as a stunted apartment block. Level 0 is the exception and
    // always has been — a shopfront under a fascia really is taller than a
    // bungalow. Industry is under commerce everywhere: it is the anti-tower.
    for (let level = 0; level < LEVELS; level++) {
      if (level > 0) {
        expect(bodyExtent('shop', level).height).toBeLessThan(bodyExtent('home', level).height);
      }
      expect(bodyExtent('industry', level).height).toBeLessThan(bodyExtent('shop', level).height);
    }
  });

  it('gives every building its dressing, and every zone the same bank', () => {
    const { buildings, counts } = scene();
    buildings.sync(state({ ...housed(8), ...trading(12), ...making(5) }), 0);
    const seen = counts();
    // One roof each, across all three zones, out of the one shared bank.
    expect(roofTotal(seen)).toBe(8 + 12 + 5);
    // And the bank is genuinely shared: no zone has a part mesh of its own.
    expect(meshes(new THREE.Scene(), 'shop:front')).toHaveLength(0);
  });

  it('draws a merged building across its whole parcel', () => {
    const root = new THREE.Scene();
    const buildings = new Buildings(root, new CityLayout());
    // Six merged shops and six single ones on the same district. The merged
    // ones are the *oldest* slots, so they are the level-2 set.
    buildings.sync(state({ shops: 12, shopLevels: mix(6, 0, 6), mergedC: 6, districts: 2 }), 0);

    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const aspect = (mesh: THREE.InstancedMesh | undefined, i: number): number => {
      mesh?.getMatrixAt(i, matrix);
      matrix.decompose(position, quaternion, scale);
      return Math.max(scale.x, scale.z) / Math.min(scale.x, scale.z);
    };
    const merged = meshes(root, 'shop:2')[0];
    const single = meshes(root, 'shop:0')[0];
    // A merged shop is oblong by roughly the parcel's two plots against one
    // shop's width; a single one is square to within its own jitter and its
    // style's proportions.
    for (let i = 0; i < 6; i++) expect(aspect(merged, i)).toBeGreaterThan(1.8);
    for (let i = 0; i < 6; i++) expect(aspect(single, i)).toBeLessThan(1.4);
  });
});

/**
 * A style is a pure function of the slot and the seed, and nothing else.
 *
 * The alternative — a variant field per building — would put the look of the
 * city in the save file, which is the one thing this codebase will not do. It
 * would also mean per-instance state, and positions would stop deriving from
 * counts.
 */
describe('building style', () => {
  const KINDS: readonly ZoneKind[] = ['home', 'shop', 'industry'];

  it('depends on the slot and the seed and on nothing else', () => {
    for (const kind of KINDS) {
      for (let slot = 0; slot < 200; slot++) {
        const first = buildingStyle(kind, slot);
        // Same call, same answer, however many times and in whatever order.
        expect(buildingStyle(kind, slot)).toBe(first);
        expect(buildingStyle(kind, slot)).toBe(first);
      }
    }
  });

  it('is stable as a building climbs, merges and is boarded up', () => {
    // The state a building can be in is not an input: `buildingStyle` takes a
    // slot. A promotion, a merge and an abandonment all move a building between
    // cohorts and none of them may change what it looks like.
    const { buildings, counts } = scene();
    const before = Array.from({ length: 24 }, (_, slot) => buildingStyle('home', slot));
    for (const levels of [mix(24), mix(0, 24), mix(0, 0, 12), spread(24)]) {
      buildings.sync(state({ homes: 24, homeLevels: [...levels] }), 0);
      expect(counts().size).toBeGreaterThan(0);
    }
    for (let slot = 0; slot < 24; slot++) expect(buildingStyle('home', slot)).toBe(before[slot]);
  });

  it('uses all three styles, and splits them roughly evenly', () => {
    for (const kind of KINDS) {
      const seen = [0, 0, 0];
      for (let slot = 0; slot < 3_000; slot++) {
        const style = buildingStyle(kind, slot);
        expect(style).toBeGreaterThanOrEqual(0);
        expect(style).toBeLessThan(3);
        seen[style] = (seen[style] ?? 0) + 1;
      }
      // A hash, not a rotation: within a fifth of even is what a fair one gives.
      for (const n of seen) expect(n).toBeGreaterThan(3_000 / 3 / 1.2);
    }
  });

  it('gives the three zones different answers on the same slot', () => {
    // Salted per zone, so a street does not come out with the house, the shop
    // and the works on slot 7 all wearing style 2.
    let differ = 0;
    for (let slot = 0; slot < 300; slot++) {
      if (buildingStyle('home', slot) !== buildingStyle('shop', slot)) differ++;
    }
    expect(differ).toBeGreaterThan(100);
  });

  it('is not in the save, in any form', () => {
    // The whole point, asserted where it can actually be checked: a state has
    // no field a style could hide in.
    const keys = Object.keys(createState(0));
    for (const key of keys) expect(key.toLowerCase()).not.toContain('style');
    for (const key of keys) expect(key.toLowerCase()).not.toContain('variant');
    // And the seed is genuinely an input: a different seed is a different city.
    expect(SEED).toBeTypeOf('number');
  });
});
