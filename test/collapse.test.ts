import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LEVELS, MAX_ACTIVE_FIRES, MERGE_LEVEL } from '../src/sim/config';
import { ZONE } from '../src/sim/citygen';
import { CityLayout, createPlacement } from '../src/sim/layout';
import { createState, type GameState, type ZoneKind } from '../src/sim/state';
import { Buildings } from '../src/render/buildings';
import { Collapse, COLLAPSE_SECONDS } from '../src/render/collapse';
import { Fires } from '../src/render/fires';
import { cohort, housed, making, trading } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

const burning = (kind: ZoneKind, index: number, startedAt = 0) => ({ kind, index, startedAt });

const fires = (): { fires: Fires; scene: THREE.Scene } => {
  const scene = new THREE.Scene();
  return { fires: new Fires(scene, new CityLayout(), true), scene };
};

/** Every InstancedMesh under a scene whose name starts with `prefix`. */
const meshes = (root: THREE.Object3D, prefix: string): THREE.InstancedMesh[] => {
  const found: THREE.InstancedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.InstancedMesh && object.name.startsWith(prefix)) found.push(object);
  });
  return found;
};

describe('telling a building the fire took from one it did not', () => {
  it('reports a loss where the flames were, not where the count dropped', () => {
    const { fires: layer } = fires();
    const alight = state({ ...housed(240), fires: [burning('home', 12)] });
    layer.sync(alight);
    expect(layer.drainLosses()).toHaveLength(0);

    // The fire ends and the city is one home smaller. `Game.demolish` takes it
    // off the *newest* end, so slot 12 is still standing — which is the whole
    // reason this animation exists.
    layer.sync(state({ ...housed(239), fires: [] }));
    const lost = layer.drainLosses();
    expect(lost).toHaveLength(1);
    expect(lost[0]?.kind).toBe('home');
    expect(lost[0]?.slot).toBe(12);
    // A real plot, a real roofline, a real footprint — captured while the fire
    // was still in the list, because nothing records them afterwards.
    expect(lost[0]?.top).toBeGreaterThan(0);
    expect(lost[0]?.width).toBeGreaterThan(0);
    expect(lost[0]?.depth).toBeGreaterThan(0);

    // Drained rather than read: the same building never falls down twice.
    expect(layer.drainLosses()).toHaveLength(0);
  });

  it('measures the plot the flames were on against the plot that empties', () => {
    // The number the whole decision rests on. At 49 districts the building that
    // silently vanishes is most of a city away from the fire — which is why
    // animating the collapse where the count drops was never an option.
    const layout = new CityLayout();
    const big = state({ ...housed(400), districts: 20 });
    layout.ensure(big);
    const at = layout.place(ZONE.residential, 12, 0, big, createPlacement());
    const flames = { x: at.x, z: at.z };
    const empties = layout.place(ZONE.residential, 399, 0, big, createPlacement());
    expect(Math.hypot(flames.x - empties.x, flames.z - empties.z)).toBeGreaterThan(100);
  });

  it('does not call a merge a loss', () => {
    const { fires: layer } = fires();
    // Two towers at MERGE_LEVEL - 1 and a fire on one of them.
    const before = state({
      homes: 240,
      homeLevels: cohort(240, MERGE_LEVEL - 1),
      fires: [burning('home', 3)],
    });
    layer.sync(before);
    layer.drainLosses();
    // A merge: two buildings become one, and the parcel count rises with it.
    const levels = cohort(238, MERGE_LEVEL - 1);
    levels[MERGE_LEVEL] = 1;
    layer.sync(state({ homes: 239, homeLevels: levels, mergedR: 1, fires: [] }));
    // The count fell and the fire ended, and neither of those is a demolition.
    expect(layer.drainLosses()).toHaveLength(0);
  });

  it('does not call an abandonment a loss', () => {
    const { fires: layer } = fires();
    layer.sync(state({ ...housed(240), fires: [burning('home', 5)] }));
    layer.drainLosses();
    // A ruin keeps its plot and its slot: the count does not move at all.
    layer.sync(state({ homes: 240, homeLevels: cohort(236), abandonedR: 4, fires: [] }));
    expect(layer.drainLosses()).toHaveLength(0);
  });

  it('says nothing about the first city it is ever shown', () => {
    // A save arriving, a `reset` and an ascension all look like an enormous
    // drop. None of them is a fire.
    const { fires: layer } = fires();
    layer.sync(state({ ...housed(400), ...trading(300), ...making(90) }));
    expect(layer.drainLosses()).toHaveLength(0);
    layer.sync(state());
    expect(layer.drainLosses()).toHaveLength(0);
  });

  it('pairs several fires ending together with several buildings lost', () => {
    const { fires: layer } = fires();
    layer.sync(
      state({
        ...housed(240),
        fires: [burning('home', 1), burning('home', 2), burning('home', 3)],
      }),
    );
    layer.drainLosses();
    // `resolveFires` decides `wouldBurnOut` once for the whole tick, so fires
    // that end together end the same way.
    layer.sync(state({ ...housed(237), fires: [] }));
    const lost = layer.drainLosses();
    expect(lost).toHaveLength(3);
    expect(lost.map((one) => one.slot).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('never reports more than the city can have alight', () => {
    const { fires: layer } = fires();
    layer.sync(state({ ...housed(400), fires: [] }));
    layer.drainLosses();
    layer.sync(state({ ...housed(200), fires: [] }));
    // Two hundred buildings gone with nothing burning is not a fire — it is a
    // save from a smaller city, or a doctored one. Nothing falls down.
    expect(layer.drainLosses()).toHaveLength(0);
    expect(MAX_ACTIVE_FIRES).toBeGreaterThan(0);
  });
});

describe('the collapse itself', () => {
  it('costs one mesh, and draws none of it when nothing is falling', () => {
    const scene = new THREE.Scene();
    const collapse = new Collapse(scene);
    const found = meshes(scene, 'collapse:');
    expect(found).toHaveLength(1);
    expect(found[0]?.visible).toBe(false);
    expect(collapse.update(0)).toBe(false);
    expect(collapse.standing).toBe(0);
  });

  it('comes down and clears itself up', () => {
    const scene = new THREE.Scene();
    const collapse = new Collapse(scene);
    const mesh = meshes(scene, 'collapse:')[0] as THREE.InstancedMesh;
    const box = new THREE.Matrix4();
    const size = new THREE.Vector3();

    collapse.start(20, 30, 3, 3, 12, 100);
    const heightAt = (now: number): number => {
      collapse.update(now);
      mesh.getMatrixAt(0, box);
      size.setFromMatrixScale(box);
      return size.y;
    };

    const early = heightAt(100.02);
    const middle = heightAt(100 + COLLAPSE_SECONDS * 0.5);
    const late = heightAt(100 + COLLAPSE_SECONDS * 0.95);
    // Down, monotonically. `easeOutBack` overshoots and would come back up
    // through its own rubble; a collapse must not.
    expect(early).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(late);
    // And it never reaches zero: a heap is what a demolished building leaves.
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(early * 0.5);

    // Then it retires itself, on the frame its own clock runs out.
    expect(collapse.update(100 + COLLAPSE_SECONDS + 0.001)).toBe(false);
    expect(collapse.standing).toBe(0);
    expect(mesh.visible).toBe(false);
  });

  it('throws dust that spreads and settles rather than growing forever', () => {
    const scene = new THREE.Scene();
    const collapse = new Collapse(scene);
    const mesh = meshes(scene, 'collapse:')[0] as THREE.InstancedMesh;
    const box = new THREE.Matrix4();
    const size = new THREE.Vector3();
    collapse.start(0, 0, 4, 4, 20, 0);
    const dustAt = (t: number): number => {
      collapse.update(COLLAPSE_SECONDS * t);
      // Instance 0 is the heap; instance 1 is the dust around it.
      if (mesh.count < 2) return 0;
      mesh.getMatrixAt(1, box);
      size.setFromMatrixScale(box);
      return size.x;
    };
    const rising = dustAt(0.2);
    const peak = dustAt(0.42);
    const settling = dustAt(0.85);
    expect(peak).toBeGreaterThan(rising);
    expect(settling).toBeLessThan(peak);
  });

  it('holds every fire the city can have alight at once, and no more', () => {
    const scene = new THREE.Scene();
    const collapse = new Collapse(scene);
    const mesh = meshes(scene, 'collapse:')[0] as THREE.InstancedMesh;
    for (let i = 0; i < MAX_ACTIVE_FIRES + 4; i++) collapse.start(i * 8, 0, 3, 3, 10, 0);
    collapse.update(COLLAPSE_SECONDS * 0.2);
    // Two instances each — the heap and its dust — and the pool is exactly the
    // fire cap, because only a fire ending can start one.
    expect(mesh.count).toBe(MAX_ACTIVE_FIRES * 2);
    expect(collapse.standing).toBe(MAX_ACTIVE_FIRES * 2);
  });

  it('drops everything in flight when asked', () => {
    const scene = new THREE.Scene();
    const collapse = new Collapse(scene);
    collapse.start(0, 0, 3, 3, 10, 0);
    collapse.update(0.1);
    expect(collapse.standing).toBeGreaterThan(0);
    collapse.clear();
    expect(collapse.update(0.2)).toBe(false);
    expect(collapse.standing).toBe(0);
  });
});

describe('the plot that is rebuilt', () => {
  /** The scaffolding mesh, which is what says a slot is mid-animation. */
  const cages = (root: THREE.Object3D): THREE.InstancedMesh =>
    meshes(root, 'part:scaffold')[0] as THREE.InstancedMesh;

  it('stands empty for the collapse and then grows back', () => {
    const root = new THREE.Scene();
    const layer = new Buildings(root, new CityLayout());
    // Looked up per read rather than held: `GrowableInstancedMesh` swaps its
    // `InstancedMesh` out from under the scene when it reallocates, so a
    // reference taken at construction goes stale the first time the city grows
    // past the mesh's opening capacity.
    const bodies = (): THREE.InstancedMesh => meshes(root, 'home:0')[0] as THREE.InstancedMesh;
    const box = new THREE.Matrix4();
    const size = new THREE.Vector3();
    layer.sync(state({ ...housed(240) }), 0);
    layer.update(50);
    expect(layer.scaffolds).toBe(0);

    // The city loses one, and the plot the flames were on is rebuilt.
    layer.sync(state({ ...housed(239) }), 50);
    layer.rebuild('home', 12, 50 + COLLAPSE_SECONDS);
    const scaleAt = (now: number): number => {
      layer.update(now);
      bodies().getMatrixAt(12, box);
      size.setFromMatrixScale(box);
      return size.y;
    };
    // Nothing standing on it while it is coming down.
    expect(scaleAt(50.1)).toBeLessThan(0.01);
    expect(scaleAt(50 + COLLAPSE_SECONDS * 0.9)).toBeLessThan(0.01);
    // Then it is rising, and it is an ordinary arrival — cage and all.
    expect(scaleAt(50 + COLLAPSE_SECONDS + 0.1)).toBeGreaterThan(0.01);
    expect(cages(root).count).toBe(1);
    // And it is back, and the cage is down, once the arrival has run.
    expect(scaleAt(50 + COLLAPSE_SECONDS + 2)).toBeGreaterThan(0.5);
    expect(layer.scaffolds).toBe(0);
  });

  it('survives the very shrink that caused it', () => {
    // The bug this is here for. `stage` used to clear every in-flight animation
    // on any shrink, so the rebuild scheduled by a demolition was wiped by the
    // demolition. It clears on a *merge* now, which is the only thing that
    // actually renumbers a slot's plot.
    const root = new THREE.Scene();
    const layer = new Buildings(root, new CityLayout());
    layer.sync(state({ ...housed(240) }), 0);
    layer.update(50);
    layer.rebuild('home', 12, 50 + COLLAPSE_SECONDS);
    // A second demolition lands before the first plot has finished rebuilding.
    layer.sync(state({ ...housed(238) }), 50.2);
    layer.update(50.3);
    expect(layer.scaffolds).toBeGreaterThan(0);
  });

  it('gives up on a merge, because a merge moves every plot', () => {
    const root = new THREE.Scene();
    const layer = new Buildings(root, new CityLayout());
    layer.sync(state({ homes: 240, homeLevels: cohort(240, MERGE_LEVEL - 1) }), 0);
    layer.update(50);
    layer.rebuild('home', 12, 50 + COLLAPSE_SECONDS);
    layer.update(50.1);
    expect(layer.scaffolds).toBe(1);

    // `place(zone, slot, merged, ...)` maps slots [0, merged) onto the two-plot
    // parcels, so raising `merged` moves the plot every slot stands on — and an
    // animation keyed to a slot would carry on playing on the wrong building.
    const levels = cohort(238, MERGE_LEVEL - 1);
    levels[MERGE_LEVEL] = 1;
    layer.sync(state({ homes: 239, homeLevels: levels, mergedR: 1 }), 50.2);
    layer.update(50.3);
    expect(layer.scaffolds).toBe(0);
  });

  it('leaves an abandonment alone, because a ruin keeps its slot', () => {
    const root = new THREE.Scene();
    const layer = new Buildings(root, new CityLayout());
    layer.sync(state({ ...housed(240) }), 0);
    layer.update(50);
    layer.rebuild('home', 12, 50 + COLLAPSE_SECONDS);
    layer.update(50.1);
    expect(layer.scaffolds).toBe(1);
    // Four written off. The count does not move; only the cohort does.
    layer.sync(state({ homes: 240, homeLevels: cohort(236), abandonedR: 4 }), 50.2);
    layer.update(50.3);
    expect(layer.scaffolds).toBe(1);
  });

  it('will not schedule a slot the zone does not have', () => {
    const root = new THREE.Scene();
    const layer = new Buildings(root, new CityLayout());
    layer.sync(state({ ...housed(24) }), 0);
    layer.update(50);
    layer.rebuild('home', 900, 50 + COLLAPSE_SECONDS);
    layer.rebuild('home', -1, 50 + COLLAPSE_SECONDS);
    layer.update(50.1);
    expect(layer.scaffolds).toBe(0);
    expect(LEVELS).toBeGreaterThan(0);
  });
});
