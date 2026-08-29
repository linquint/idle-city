import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Buildings } from '../src/render/buildings';
import { CELL } from '../src/sim/config';
import { CityLayout, worldX, worldZ } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';

/**
 * The hospital's composed design, checked as a black box.
 *
 * Every other civic type is a slab with one thing standing on it, and bounds
 * checks on those would only be restating `civicTrio`. The hospital is the one
 * building assembled from a *drawing* — two volumes, glazing, canopies, a
 * helipad and a rooftop cross, merged by material — and two things can go wrong
 * with it that no other civic type can suffer:
 *
 *  - A part drifting off where the design puts it. Every offset is baked into
 *    geometry rather than carried on an instance transform, so a mistake is a
 *    wing halfway through a wall rather than an exception, and from the play
 *    camera a hospital is 7 units across and easy to glance past.
 *  - The assembly scaling about something other than the site's ground centre
 *    while it grows. The parts only stay in register because they share one
 *    transform and a zero offset; give any one of them an offset of its own and
 *    the building comes apart for the half second it is growing and then looks
 *    correct forever afterwards, which is the hardest kind of bug to be shown.
 *
 * The numbers are the design's own, measured off the source model in the site's
 * frame: x and z across the 7-unit civic footprint, y up from the pavement.
 */
const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** Where the design puts each material group, relative to the site centre. */
const DESIGN: ReadonlyArray<{
  readonly name: string;
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}> = [
  // The ward slab, the treatment wing in front of it, and the entrance columns.
  { name: 'hospital:walls', min: [-3.5, 0, -3.5], max: [3.5, 3.3, 3.86] },
  // Banded storeys on both volumes, plus the canopy over the entrance — the one
  // part of the building allowed past the 3.5 the rest of it keeps to, and
  // still inside the 1-unit gutter the site leaves against the kerb.
  { name: 'hospital:glazing', min: [-3.53, 0.57, -3.53], max: [3.53, 2.3, 3.95] },
  // The two mint caps, each overhanging its own walls.
  { name: 'hospital:caps', min: [-3.61, 1.64, -3.61], max: [3.61, 3.51, 3.6] },
  // The ambulance bay canopy and the plant housings on the ward roof, which are
  // the tallest thing on the building at 4.21.
  { name: 'hospital:plant', min: [-3.25, 1.87, -3.35], max: [3.45, 4.21, 3.2] },
  // The bay doors, at ground level on the ward's own face.
  { name: 'hospital:doors', min: [1.45, 0.025, -0.51], max: [3.35, 1.175, -0.37] },
  // The helipad deck and its H, standing on the ward cap rather than sunk in it.
  { name: 'hospital:helipad', min: [-0.05, 3.56, -3.45], max: [2.85, 3.68, -0.55] },
  { name: 'hospital:mark', min: [0.65, 3.69, -2.75], max: [2.15, 3.75, -1.25] },
  // The cross, on the wing where the ward does not overshadow it.
  { name: 'hospital:cross', min: [-2.5, 1.91, 0.1], max: [0.1, 1.98, 2.7] },
];

/** Every hospital mesh in the scene, by name. */
function hospitalMeshes(root: THREE.Object3D): THREE.InstancedMesh[] {
  const found: THREE.InstancedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.InstancedMesh && object.name.startsWith('hospital:')) {
      found.push(object);
    }
  });
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/** The world-space box each hospital mesh's `i`-th instance covers. */
function boxes(root: THREE.Object3D, i: number): Map<string, THREE.Box3> {
  const matrix = new THREE.Matrix4();
  const found = new Map<string, THREE.Box3>();
  for (const mesh of hospitalMeshes(root)) {
    if (i >= mesh.count) continue;
    mesh.getMatrixAt(i, matrix);
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (box) found.set(mesh.name, box.clone().applyMatrix4(matrix));
  }
  return found;
}

/**
 * The centre of the site the `i`-th hospital stands on, from the layout rather
 * than from the meshes — a design that placed itself wrongly would otherwise
 * move the origin it is being measured against and check out fine.
 */
function siteCentre(layout: CityLayout, i: number): THREE.Vector3 {
  const cell = layout.civicSiteFor(0, i);
  return new THREE.Vector3(worldX(cell.x) + CELL / 2, 0, worldZ(cell.z) + CELL / 2);
}

/** Rounded to the millimetre, which is finer than the design is drawn. */
const at = (corner: THREE.Vector3, centre: THREE.Vector3): number[] =>
  [corner.x - centre.x, corner.y, corner.z - centre.z].map((n) => Math.round(n * 1000) / 1000);

describe('the hospital', () => {
  it('stands as the design draws it, part for part', () => {
    const root = new THREE.Scene();
    const layout = new CityLayout();
    const buildings = new Buildings(root, layout);
    buildings.sync(state({ districts: 1, hospitals: 1 }), 0);
    // Past the end of the growth animation: the design is what it settles at.
    buildings.update(1e6);

    const centre = siteCentre(layout, 0);
    const found = boxes(root, 0);
    expect([...found.keys()].sort()).toEqual(DESIGN.map((part) => part.name).sort());

    for (const part of DESIGN) {
      const box = found.get(part.name);
      expect(box, part.name).toBeDefined();
      if (!box) continue;
      expect(at(box.min, centre), `${part.name} min`).toEqual([...part.min]);
      expect(at(box.max, centre), `${part.name} max`).toEqual([...part.max]);
    }
  });

  it('keeps every part in register with the others while it grows', () => {
    const root = new THREE.Scene();
    const layout = new CityLayout();
    const buildings = new Buildings(root, layout);

    buildings.sync(state({ districts: 1, hospitals: 1 }), 0);
    buildings.update(1e6);
    // The layout only lays out the sites a state asks it for, so the centre is
    // read after the first sync rather than before it.
    const centre = siteCentre(layout, 0);
    const settled = boxes(root, 0);

    // Growth is staged in seconds and settles in well under one, so the frame
    // to check is scanned for rather than guessed at.
    buildings.sync(state({ districts: 1, hospitals: 0 }), 0);
    buildings.sync(state({ districts: 1, hospitals: 1 }), 10);
    const roof = settled.get('hospital:caps');
    expect(roof).toBeDefined();
    let scale = 0;
    let mid: Map<string, THREE.Box3> | null = null;
    for (let t = 10; t < 11 && !mid && roof; t += 0.005) {
      buildings.update(t);
      const growing = boxes(root, 0).get('hospital:caps');
      if (!growing) continue;
      const seen = growing.max.y / roof.max.y;
      if (seen > 0.05 && seen < 0.9) {
        scale = seen;
        mid = boxes(root, 0);
      }
    }
    expect(mid, 'a frame mid-growth').not.toBeNull();

    // Every part the same fraction of its settled self on all three axes,
    // measured from the site's ground centre. That is what one shared transform
    // and a zero offset buy, and it is the only way a building made of eight
    // meshes can grow without coming apart.
    for (const part of DESIGN) {
      const now = mid?.get(part.name);
      const done = settled.get(part.name);
      expect(now, part.name).toBeDefined();
      expect(done, part.name).toBeDefined();
      if (!now || !done) continue;
      expect(now.max.y / done.max.y, `${part.name} height`).toBeCloseTo(scale, 6);
      expect(
        (now.max.x - centre.x) / (done.max.x - centre.x),
        `${part.name} width`,
      ).toBeCloseTo(scale, 6);
      expect(
        (now.max.z - centre.z) / (done.max.z - centre.z),
        `${part.name} depth`,
      ).toBeCloseTo(scale, 6);
    }
  });

  it('costs eight meshes however many hospitals the city opens', () => {
    const root = new THREE.Scene();
    const layout = new CityLayout();
    const buildings = new Buildings(root, layout);
    const empty = hospitalMeshes(root).map((mesh) => mesh.name);
    // Eight materials, eight draw calls, and every one of them built before the
    // city has a single hospital in it.
    expect(empty).toEqual(DESIGN.map((part) => part.name).sort());

    buildings.sync(state({ districts: 12, hospitals: 12 }), 0);
    buildings.update(1e6);
    expect(hospitalMeshes(root).map((mesh) => mesh.name)).toEqual(empty);
    for (const mesh of hospitalMeshes(root)) expect(mesh.count).toBe(12);

    // And the twelfth is the design too, on its own district's site.
    const centre = siteCentre(layout, 11);
    for (const part of DESIGN) {
      const box = boxes(root, 11).get(part.name);
      expect(box, part.name).toBeDefined();
      if (box) expect(at(box.max, centre), `${part.name} max`).toEqual([...part.max]);
    }
  });
});
