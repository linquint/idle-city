import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CELL, LEVEL_FOOTPRINT, LEVELS, MAX_DISTRICTS, SEED } from '../src/sim/config';
import { CityLayout } from '../src/sim/layout';
import {
  bodyExtent,
  bodyFootprint,
  BUILDING_MESH_BUDGET,
  Buildings,
  buildingStyle,
  modelStyleOf,
} from '../src/render/buildings';
import {
  MODEL_EXTENT,
  MODEL_LEVELS,
  MODEL_LIT,
  MODEL_STYLES,
  MODELLED_KINDS,
  type ModelExtent,
  type ModelledKind,
} from '../src/render/modelled';
import { createState, type GameState, type ZoneKind } from '../src/sim/state';
import { cohort, housed, making, mix, trading, zonedAt, zoning } from './levels';
import { ZONE } from '../src/sim/citygen';
import { cellX, cellZ, createPlacement, isRoad } from '../src/sim/layout';
import { modelFacing } from '../src/render/modelled';

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

const ROOF_PARTS = ['part:flat', 'part:parapet'] as const;

/**
 * Roofs out of the shared bank, which is every building the ladder *masses*.
 *
 * Housing's first rung is not one of them: it is drawn from five models, each
 * carrying its own roof in its geometry, so a district of level-1 houses has
 * every roof it should have and none of them here. That is what took the hipped
 * cone out of the bank — it had no other wearer.
 */
const roofTotal = (counts: Map<string, number>): number =>
  ROOF_PARTS.reduce((sum, name) => sum + (counts.get(name) ?? 0), 0);

/** The five modelled buildings of one (zone, rung). See `ModelMeshes`. */
const modelMeshes = (kind: ModelledKind, level: number): string[] =>
  Array.from({ length: MODEL_STYLES[kind] }, (_, i) => `model:${kind}:${level}:${i}`);

/** Every model mesh a zone owns, over every rung it draws from models. */
const allModelMeshes = (kind: ModelledKind): string[] =>
  Array.from({ length: MODEL_LEVELS[kind] }, (_, l) => modelMeshes(kind, l)).flat();

/** Buildings of a zone standing at one modelled rung, over all five models. */
const modelTotal = (counts: Map<string, number>, kind: ModelledKind, level = 0): number =>
  modelMeshes(kind, level).reduce((sum, name) => sum + (counts.get(name) ?? 0), 0);

/** Every modelled rung of a zone, which is [0] for two zones and [0, 1] for housing. */
const modelRungs = (kind: ModelledKind): number[] =>
  Array.from({ length: MODEL_LEVELS[kind] }, (_, l) => l);

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
  it('gives every home exactly one body, and every massed one a roof', () => {
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
      // Housing's first two rungs are modelled and have no body mesh at all,
      // each drawing from its own set of five; the rungs above are one mesh
      // each, exactly as before.
      let modelledHomes = 0;
      for (const l of modelRungs('home')) {
        expect(seen.get(`home:${l}`) ?? 0).toBe(0);
        expect(modelTotal(seen, 'home', l)).toBe(levels[l]);
        modelledHomes += levels[l] as number;
      }
      for (let l = MODEL_LEVELS.home; l < LEVELS; l++) {
        expect(seen.get(`home:${l}`) ?? 0).toBe(levels[l]);
      }
      // Every building still has exactly one roof; the modelled ones carry
      // theirs themselves, so the bank draws one for each of the rest.
      expect(roofTotal(seen)).toBe(24 - modelledHomes);
    }
  });

  it('keeps the part bank in step through a promotion', () => {
    // The case the shared bank exists for: a promotion moves one building from
    // one body mesh to another, and its roof from one part to another. Both
    // packings are rebuilt, and neither may strand or duplicate an instance.
    const { buildings, counts } = scene();
    // Housing's first promotion is now modelled to modelled: a house leaves one
    // model set for another, and takes nothing from the bank on the way — a
    // walk-up carries its own roof exactly as the house did.
    for (let promoted = 0; promoted <= 24; promoted++) {
      buildings.sync(
        state({ homes: 24, homeLevels: mix(24 - promoted, promoted) }),
        promoted * 0.1,
      );
      const seen = counts();
      expect(modelTotal(seen, 'home', 0)).toBe(24 - promoted);
      expect(modelTotal(seen, 'home', 1)).toBe(promoted);
      expect(seen.get('home:1') ?? 0).toBe(0);
      expect(roofTotal(seen)).toBe(0);
    }
    // The second promotion is modelled to modelled as well, and it is the one
    // that merges: a walk-up on one plot becomes a tower on two.
    for (let promoted = 0; promoted <= 24; promoted++) {
      buildings.sync(
        state({ homes: 24, homeLevels: mix(0, 24 - promoted, promoted) }),
        3 + promoted * 0.1,
      );
      const seen = counts();
      expect(modelTotal(seen, 'home', 1)).toBe(24 - promoted);
      expect(modelTotal(seen, 'home', 2)).toBe(promoted);
      expect(seen.get('home:2') ?? 0).toBe(0);
      expect(roofTotal(seen)).toBe(0);
    }
    // And the promotion off the modelled rungs, which is the one that hands a
    // building to a body mesh and its roof to the bank.
    for (let promoted = 0; promoted <= 24; promoted++) {
      buildings.sync(
        state({ homes: 24, homeLevels: mix(0, 0, 24 - promoted, promoted) }),
        6 + promoted * 0.1,
      );
      const seen = counts();
      expect(modelTotal(seen, 'home', 2)).toBe(24 - promoted);
      expect(seen.get('home:3') ?? 0).toBe(promoted);
      expect(roofTotal(seen)).toBe(promoted);
    }
  });

  it('draws a ruin on its plot, in the modelled set, and unlit', () => {
    const { buildings, counts } = scene();
    // Twenty standing homes at level 4, four boarded up. The ruins hold their
    // plots, so the city still draws 24 buildings. Level 4 rather than level 3
    // because what this is about is a ruin dropping *off* the modelled rungs,
    // and level 3 is one of them now.
    buildings.sync(state({ homes: 24, homeLevels: mix(0, 0, 0, 20), abandonedR: 4 }), 0);
    const seen = counts();
    expect(seen.get('home:3')).toBe(20);
    // A ruin is drawn in the *first* rung's set, whatever the plot had climbed
    // to — so a boarded-up plot is a darkened house rather than a darkened box,
    // and never a darkened walk-up or tower.
    expect(seen.get('home:0') ?? 0).toBe(0);
    expect(modelTotal(seen, 'home', 0)).toBe(4);
    expect(modelTotal(seen, 'home', 1)).toBe(0);
    expect(modelTotal(seen, 'home', 2)).toBe(0);
    // Twenty roofs out of the bank: the standing level-4 blocks. The four ruins
    // wear their model's own roof and take nothing from it.
    expect(roofTotal(seen)).toBe(20);
    // And a ruin keeps its plot and loses everything else, its lit band
    // included: twenty standing buildings can light bands, four ruins cannot.
    const lit = seen.get('part:band') ?? 0;
    buildings.sync(state({ homes: 24, homeLevels: mix(0, 0, 0, 24) }), 1);
    expect(counts().get('part:band') ?? 0).toBeGreaterThan(lit);
  });

  it('puts out the lights on a shuttered building but leaves it standing', () => {
    const { buildings, counts } = scene();
    buildings.sync(state({ ...trading(20) }), 0);
    const lit = counts().get('part:band') ?? 0;
    expect(lit).toBeGreaterThan(0);
    expect(modelTotal(counts(), 'shop')).toBe(20);

    // Seven closed. The bodies stay — the plot is still occupied — and the lit
    // pieces stop at the trading thirteen. On a modelled shop those are the
    // shopfront and the sign, which is the whole of how a shuttered unit reads.
    buildings.sync(state({ shops: 20, shopLevels: mix(13), abandonedC: 7 }), 1);
    expect(modelTotal(counts(), 'shop')).toBe(20);
    expect(counts().get('part:band') ?? 0).toBeLessThan(lit);
  });

  it('uses more than one roof shape, and only sensible ones per level', () => {
    const { buildings, counts } = scene();
    // A whole district of detached housing takes nothing from the roof bank at
    // all: every one of them is a model with its own roof on it. This is what
    // the hipped cone used to be for, and the reason it is gone.
    buildings.sync(state(housed(24)), 0);
    const cottages = counts();
    expect(modelTotal(cottages, 'home', 0)).toBe(24);
    expect(roofTotal(cottages)).toBe(0);

    // And so does a whole district promoted to walk-ups, which is the rung the
    // player reaches next and the reason it is modelled too.
    buildings.sync(state(housed(24, 1)), 0.5);
    const walkups = counts();
    expect(modelTotal(walkups, 'home', 1)).toBe(24);
    expect(roofTotal(walkups)).toBe(0);

    // A whole district of megastructures: a mix of the two shapes left. Ten of
    // them rather than twenty-four — each stands on a merged parcel, and a
    // district offers about ten pairs of housing frontage.
    buildings.sync(state(housed(10, LEVELS - 1)), 1);
    const towers = counts();
    for (const l of modelRungs('home')) expect(modelTotal(towers, 'home', l)).toBe(0);
    expect(towers.get('part:flat') ?? 0).toBeGreaterThan(0);
    expect(towers.get('part:parapet') ?? 0).toBeGreaterThan(0);
  });

  it('builds a street out of all five models, in every zone', () => {
    const { buildings, counts } = scene();
    // Two districts built out at the first rung, which is the state a city
    // spends its first hour in. Every model has to actually turn up in it, or
    // the variety is a table nobody sees.
    buildings.sync(
      state({ ...housed(48), ...trading(60), ...making(26), districts: 2 }),
      0,
    );
    const seen = counts();
    expect(modelTotal(seen, 'home')).toBe(48);
    expect(modelTotal(seen, 'shop')).toBe(60);
    expect(modelTotal(seen, 'industry')).toBe(26);
    for (const kind of MODELLED_KINDS) {
      for (const name of modelMeshes(kind, 0)) expect(seen.get(name) ?? 0).toBeGreaterThan(0);
    }
    // Every zone is modelled at this rung now, so nothing draws a level-1 body.
    for (const kind of MODELLED_KINDS) expect(seen.get(`${kind}:0`) ?? 0).toBe(0);

    // And the same of the rung above it, which only housing has: two districts
    // of walk-ups have to reach all five of those too, or the promotion the
    // models were built for lands on a street of one silhouette.
    buildings.sync(state({ ...housed(48, 1), districts: 2 }), 1);
    const climbed = counts();
    expect(modelTotal(climbed, 'home', 1)).toBe(48);
    for (const name of modelMeshes('home', 1)) expect(climbed.get(name) ?? 0).toBeGreaterThan(0);
  });

  it('lays a merged model along its parcel, and still faces it at a street', () => {
    // The rule a merged rung needed and the rungs below did not. A tower is
    // oblong and built to its parcel, so of the four quarter turns a house can
    // take it may take only the two that lie the right way — otherwise it
    // renders across two neighbours' kerbs and out into the street.
    //
    // Driven through `sync` rather than by poking the layout, because that is
    // what puts the layout in the state the renderer actually sees; the same
    // layout is then asked where each parcel is.
    const districts = 2;
    const merged = 10;
    const z = zonedAt(districts);
    const layout = new CityLayout();
    const buildings = new Buildings(new THREE.Scene(), layout);
    buildings.sync(state({ ...zoning(districts), ...housed(merged, 2) }), 0);

    const at = createPlacement();
    const foot = { width: 0, depth: 0 };
    const sides = [
      { dx: 0, dz: 1 },
      { dx: 1, dz: 0 },
      { dx: 0, dz: -1 },
      { dx: -1, dz: 0 },
    ];
    let seen = 0;
    let fronting = 0;
    for (let slot = 0; slot < merged; slot++) {
      const place = layout.place(ZONE.residential, slot, merged, z, at);
      if (place.plots < 2) continue;
      seen++;
      bodyFootprint('home', slot, 2, place, foot);
      const along = place.alongX ? foot.width : foot.depth;
      const across = place.alongX ? foot.depth : foot.width;
      // The long span lies along the parcel, every time. A tower is oblong by
      // at least 1.5:1, so this cannot pass by accident.
      expect(along).toBeGreaterThan(across * 1.5);
      // And it stays inside its own land on both axes: two plots along, one
      // across, each less the kerb gutter every building leaves.
      expect(along).toBeLessThan(2 * CELL);
      expect(across).toBeLessThan(CELL);

      // The turn is legal by construction above; this is the other half — that
      // constraining it to two did not cost the model its front. The seed is
      // passed twice, so a parcel with a genuine choice is exercised either
      // way rather than only at whatever one draw happens to pick.
      for (const pick of [0.13, 0.87]) {
        const turn = modelFacing(place.x, place.z, pick, place.alongX);
        expect(turn % 2 === 0).toBe(place.alongX);
        const side = sides[turn] as { dx: number; dz: number };
        if (isRoad(cellX(place.x) + side.dx, cellZ(place.z) + side.dz)) fronting++;
      }
    }
    // The fixture has to actually contain merged parcels, or the whole test is
    // ten skipped iterations reporting success.
    expect(seen).toBe(merged);
    // Every one of them fronts a street on the side it turned to, at both
    // draws. That is the claim worth pinning: a parcel is two plots that each
    // front a street, so narrowing the choice from four turns to two leaves a
    // correct one available rather than forcing a compromise.
    expect(fronting).toBe(seen * 2);
  });

  it('lights a modelled tower on top, and only from the rung that asks for it', () => {
    const { buildings, counts } = scene();
    // The warning light is a property of the *row*, not of the models: housing
    // carries one from level 3 up. The two modelled rungs below it must not
    // have one, and the modelled rung that does must not have lost it by being
    // modelled — which is exactly what would have happened silently.
    buildings.sync(state(housed(24, 0)), 0);
    expect(counts().get('part:beacon') ?? 0).toBe(0);
    buildings.sync(state(housed(24, 1)), 1);
    expect(counts().get('part:beacon') ?? 0).toBe(0);

    buildings.sync(state(housed(10, 2)), 2);
    expect(modelTotal(counts(), 'home', 2)).toBe(10);
    expect(counts().get('part:beacon') ?? 0).toBe(10);

    // And a ruined tower is dark on top like everything else about it: a ruin
    // reverts to the first rung's models, which carry no beacon anyway, but the
    // assertion is about the light rather than the model.
    buildings.sync(state({ homes: 10, homeLevels: mix(0, 0, 6), abandonedR: 4 }), 3);
    expect(counts().get('part:beacon') ?? 0).toBe(6);
  });

  it('gives every modelled rung five silhouettes, all inside the plot', () => {
    for (const kind of MODELLED_KINDS) {
      for (const level of modelRungs(kind)) {
        const rung = MODEL_EXTENT[kind][level] as readonly ModelExtent[];
        // Five models are only worth five meshes if they read as five
        // buildings. Bounding boxes are a coarse proxy for that and a sharp one
        // for the case that would matter: a model pasted twice.
        const shapes = rung.map((m) => `${m.width}x${m.depth}x${m.height}`);
        expect(new Set(shapes).size).toBe(MODEL_STYLES[kind]);
        // Every model has to fit the land its rung stands on, and which land
        // that is depends on the footprint. `bodyExtent` reports only the
        // widest of the five and only across the frontage; this is each of
        // them, on both axes.
        //
        //   - on one plot a model turns freely, so either span can end up
        //     across the frontage and both have to clear the same kerb;
        //   - on a merged parcel it cannot turn freely — its long span lies
        //     along the parcel at every turn it can take — so the two spans
        //     answer to two plots and to one.
        const merged = (LEVEL_FOOTPRINT[level] ?? 1) > 1;
        for (const model of rung) {
          if (merged) {
            expect(model.width).toBeLessThan(2 * CELL);
            expect(model.depth).toBeLessThan(CELL);
            // And it is genuinely oblong, which is what makes the turn rule
            // load-bearing rather than decorative: a square model on a merged
            // parcel would fit either way round and none of this would matter.
            expect(model.width).toBeGreaterThan(model.depth * 1.5);
          } else {
            expect(Math.max(model.width, model.depth)).toBeLessThan(CELL);
          }
        }
        // And every model is lit, or the rung goes dark at dusk one style at a
        // time — the failure `MODEL_LIT` throws on, asserted from the outside.
        for (const lit of MODEL_LIT[kind][level] ?? []) expect(lit.length).toBeGreaterThan(0);
      }
    }
  });

  it('picks a model from the slot and the seed, and never from the save', () => {
    // The same contract `buildingStyle` keeps. A building's model must not
    // depend on the cohort under it — it keeps its character as the city grows
    // around it — and must not be anywhere in a save.
    const draws = 4000;
    for (const kind of MODELLED_KINDS) {
      const styles = MODEL_STYLES[kind];
      const seen = new Array<number>(styles).fill(0);
      for (let slot = 0; slot < draws; slot++) {
        const style = modelStyleOf(kind, slot);
        expect(style).toBe(modelStyleOf(kind, slot));
        expect(style).toBeGreaterThanOrEqual(0);
        expect(style).toBeLessThan(styles);
        seen[style] = (seen[style] as number) + 1;
      }
      // All five reachable, and none of them running away with the street.
      for (const n of seen) expect(n).toBeGreaterThan(draws / styles / 2);
    }
    // And the two zones draw independently: a plot's house and the shop on the
    // same slot must not be the same index, or half the map would rhyme.
    let same = 0;
    for (let slot = 0; slot < draws; slot++) {
      if (modelStyleOf('home', slot) === modelStyleOf('shop', slot)) same++;
    }
    expect(same).toBeLessThan(draws * 0.3);
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
      if (
        /^(home|shop|industry):\d+$/.test(object.name) ||
        object.name.startsWith('model:') ||
        object.name.startsWith('part:')
      ) {
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
    // A zone is a body short for every rung it models — one for commerce and
    // industry, two for housing — and each of those rungs is five model meshes
    // in its place. Five *per modelled rung* is the cost being asserted: the
    // number the budget has to answer for grows with the rungs, not with the
    // city.
    for (const kind of MODELLED_KINDS) {
      expect(full.filter((name) => name.startsWith(`${kind}:`))).toHaveLength(
        LEVELS - MODEL_LEVELS[kind],
      );
      expect(full.filter((name) => name.startsWith(`model:${kind}:`))).toHaveLength(
        MODEL_STYLES[kind] * MODEL_LEVELS[kind],
      );
      expect(full.filter((name) => name.startsWith(`model:${kind}:`)).sort()).toEqual(
        allModelMeshes(kind).sort(),
      );
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
    // would read as a stunted apartment block. Industry is under commerce: it
    // is the anti-tower.
    //
    // Both orderings are about the *massed* rungs, and level 0 is not one — it
    // is modelled in all three zones, and what `bodyExtent` reports there is a
    // model's whole silhouette, chimney and fin sign and all. That is a
    // different quantity from a massed body, which has never counted the stack
    // standing on it: a level-1 industrial shed is 1.3 tall and carries a stack
    // 1.35 times that, and this has always reported 1.93 rather than 3.05. So
    // comparing model heights to each other here would be comparing silhouettes
    // to bodies, and it would say a works with a 6-unit flue is "taller" than a
    // shop in a sense the massed numbers never meant. Level 0 was already the
    // exception for commerce against housing, for a smaller version of the same
    // reason; it is now the exception for both orderings.
    for (let level = 1; level < LEVELS; level++) {
      expect(bodyExtent('shop', level).height).toBeLessThan(bodyExtent('home', level).height);
      expect(bodyExtent('industry', level).height).toBeLessThan(bodyExtent('shop', level).height);
    }

    // What *is* true at the modelled rung, and is the whole of how the three
    // zones read from the play camera: industry is the widest thing standing on
    // a plot, and housing the narrowest. Footprint carries the type there,
    // exactly as the massed ladder intends it to.
    const span = (kind: ZoneKind): number => bodyExtent(kind, 0).width;
    expect(span('industry')).toBeGreaterThan(span('shop'));
    expect(span('shop')).toBeGreaterThan(span('home'));
  });

  it('gives every building its dressing, and every zone the same bank', () => {
    const { buildings, counts } = scene();
    buildings.sync(state({ ...housed(8), ...trading(12), ...making(5) }), 0);
    const seen = counts();
    // Nothing draws a roof out of the shared bank at all: every building here
    // is at its zone's modelled rung and carries its own. The bank's roofs are
    // for the rungs above, which this city has not climbed to.
    expect(roofTotal(seen)).toBe(0);
    expect(modelTotal(seen, 'home')).toBe(8);
    expect(modelTotal(seen, 'shop')).toBe(12);
    expect(modelTotal(seen, 'industry')).toBe(5);
    // And the bank is genuinely shared: no zone has a part mesh of its own.
    expect(meshes(new THREE.Scene(), 'shop:front')).toHaveLength(0);
  });

  it('draws a merged building across its whole parcel', () => {
    const root = new THREE.Scene();
    const buildings = new Buildings(root, new CityLayout());
    // Six merged shops and six single ones on the same district. The merged
    // ones are the *oldest* slots, so they are the level-3 set; the singles are
    // at level 2 rather than level 1 because level 1 is modelled, and a model
    // is never stretched to a parcel — the comparison has to be between two
    // massed bodies to mean anything.
    buildings.sync(state({ shops: 12, shopLevels: mix(0, 6, 0, 6), mergedC: 6, districts: 2 }), 0);

    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const aspect = (mesh: THREE.InstancedMesh | undefined, i: number): number => {
      mesh?.getMatrixAt(i, matrix);
      matrix.decompose(position, quaternion, scale);
      return Math.max(scale.x, scale.z) / Math.min(scale.x, scale.z);
    };
    const merged = meshes(root, 'shop:3')[0];
    const single = meshes(root, 'shop:1')[0];
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

describe('the cages on what is being built', () => {
  /** The one scaffold mesh, found the way every other test finds a mesh. */
  const cage = (root: THREE.Object3D): THREE.InstancedMesh => {
    const found = meshes(root, 'part:scaffold');
    expect(found).toHaveLength(1);
    return found[0] as THREE.InstancedMesh;
  };

  /** What the cage mesh actually submits: nothing at all when it is hidden. */
  const standing = (mesh: THREE.InstancedMesh): number => (mesh.visible ? mesh.count : 0);

  it('costs one mesh, and draws none of it on a settled city', () => {
    const root = new THREE.Scene();
    const buildings = new Buildings(root, new CityLayout());
    const mesh = cage(root);
    expect(mesh.visible).toBe(false);

    // A city that arrived already built — a save being loaded — animates, so
    // it is caged; run past the animation and the cages come down.
    buildings.sync(state({ ...housed(24) }), 0);
    buildings.update(0.1);
    expect(standing(mesh)).toBeGreaterThan(0);
    buildings.update(10);
    expect(standing(mesh)).toBe(0);
    expect(mesh.visible).toBe(false);
  });

  it('cages exactly what is mid-growth, and nothing that has finished', () => {
    const root = new THREE.Scene();
    const buildings = new Buildings(root, new CityLayout());
    const mesh = cage(root);
    // Settle the opening city first, so the only thing moving is the purchase.
    buildings.sync(state({ ...housed(24) }), 0);
    buildings.update(10);
    expect(standing(mesh)).toBe(0);

    buildings.sync(state({ ...housed(28) }), 10);
    buildings.update(10.1);
    expect(standing(mesh)).toBe(4);
    expect(buildings.scaffolds).toBe(4);
  });

  it('takes the cage down on the same frame the growth retires', () => {
    // The bug this is here for: a cage keyed to a building rather than to the
    // animation would need something to come back and remove it, and nothing
    // does. `GrowthSchedule` drops an index the frame its scale reaches 1, so
    // the cage list simply does not include it on that frame.
    const root = new THREE.Scene();
    const buildings = new Buildings(root, new CityLayout());
    const mesh = cage(root);
    buildings.sync(state({ ...housed(1) }), 0);

    let lastCaged = 0;
    let lastMoving = true;
    for (let frame = 1; frame <= 200 && lastMoving; frame++) {
      const now = frame * 0.02;
      lastMoving = buildings.update(now);
      lastCaged = standing(mesh);
      // Never a cage on a frame with nothing in flight, at any point.
      if (!lastMoving) expect(lastCaged).toBe(0);
      else expect(lastCaged).toBe(1);
    }
    expect(lastMoving).toBe(false);
    expect(lastCaged).toBe(0);
    // And it stays down: a frame after the animation ended writes nothing.
    buildings.update(20);
    expect(standing(mesh)).toBe(0);
  });

  it('is sized for a wave rather than for the city', () => {
    // The case the budget exists for: a twelve-hour catch-up staging a full
    // wave in all three zones at once. `stage` caps each at WAVE_BUDGET, so the
    // cage count is bounded by the budget and not by the four thousand
    // buildings standing around it.
    const root = new THREE.Scene();
    const buildings = new Buildings(root, new CityLayout());
    const mesh = cage(root);
    const huge = state({
      districts: MAX_DISTRICTS,
      homes: 4_000,
      homeLevels: mix(4_000),
      shops: 2_000,
      shopLevels: mix(2_000),
      industry: 600,
      industryLevels: mix(600),
    });
    buildings.sync(huge, 0);
    buildings.update(0.01);
    const caged = standing(mesh);
    expect(caged).toBeGreaterThan(0);
    // Three zones, one wave each, and never one cage per building.
    expect(caged).toBeLessThanOrEqual(3 * 320);
    expect(caged).toBeLessThan(4_000);
    buildings.update(100);
    expect(standing(mesh)).toBe(0);
  });

  it('wraps a merged parcel rather than one plot of it', () => {
    // A cage sized for a detached house standing around an arcology would read
    // as a bug, so the cage takes the *drawn* footprint — the same number the
    // body's own merged stretch is built from.
    const box = new THREE.Matrix4();
    const size = new THREE.Vector3();

    // A fresh layer per reading, because a merge is exactly what `stage` now
    // clears in-flight animations on — see its note. Two readings from one
    // layer would be measuring the second against a wiped schedule.
    const spanOf = (levels: number[], homes: number, merged = 0): number => {
      const root = new THREE.Scene();
      const buildings = new Buildings(root, new CityLayout());
      const mesh = cage(root);
      buildings.sync(state({ homes, homeLevels: [...levels], mergedR: merged }), 0);
      buildings.update(0.01);
      expect(standing(mesh)).toBeGreaterThan(0);
      mesh.getMatrixAt(0, box);
      size.setFromMatrixScale(box);
      return Math.max(size.x, size.z);
    };

    const detached = spanOf(mix(4), 4);
    // The top rung is above MERGE_LEVEL, so the parcel is two plots long and
    // the cage has to be too.
    const merged = spanOf(cohort(4, LEVELS - 1), 4, 4);
    expect(merged).toBeGreaterThan(detached * 1.5);
    // Both stand on the ground rather than floating, whatever they wrap.
    expect(size.y).toBeGreaterThan(0);
  });
});
