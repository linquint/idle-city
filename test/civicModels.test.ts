import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Buildings } from '../src/render/buildings';
import {
  BUS_DEPOT_PARTS,
  FIRE_STATION_PARTS,
  HOSPITAL_PARTS,
  MUSEUM_PARTS,
  POLICE_STATION_PARTS,
  STADIUM_PARTS,
} from '../src/render/civicModels';
import type { ModelPart } from '../src/render/model';
import { CELL } from '../src/sim/config';
import { CityLayout, worldX, worldZ, type Coord } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';

/**
 * The six buildings on a reserved square that come out of a model, checked as a
 * black box.
 *
 * The other four are a slab with one thing standing on them, and bounds checks
 * on those would only restate `civicTrio`. These six are assembled from part
 * tables generated out of `models/`, and three things can go wrong with that
 * which cannot go wrong with a slab:
 *
 *  - A part landing somewhere other than where the model puts it. Placement is
 *    baked into geometry rather than carried on a transform, so a mistake is a
 *    wing halfway through a wall rather than an exception.
  *  - Parts merging into the wrong mesh. Materials are merged by *name* because
 *    two of them can share a colour — the fire station's `roof-red` and
 *    `beacon-red` do, and so do the police station's `police-blue` and
 *    `signal-blue` — and a merge keyed on colour would weld each building's
 *    lights onto its roof caps and quietly stop them glowing.
 *  - The assembly scaling about something other than the site's ground centre
 *    while it grows. The parts stay in register only because they share one
 *    transform and a zero offset; give any one of them an offset and the
 *    building comes apart for the half second it is growing and then looks
 *    right forever, which is the hardest kind of bug to be shown.
 *
 * Expectations are computed from the part tables rather than copied out of
 * them, so a remodel does not need this file edited — it needs it to still
 * pass. The arithmetic here is deliberately not the renderer's: the tables go
 * to boxes by hand, and the renderer's answer comes back off the scene graph.
 */
const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** What a single primitive covers, from the table alone. */
function extent(part: ModelPart): { min: number[]; max: number[] } {
  const [x, y, z] = part.at;
  const half =
    part.shape === 'box'
      ? [part.size[0] / 2, part.size[1] / 2, part.size[2] / 2]
      : part.shape === 'disc'
        ? [part.radius, part.height / 2, part.radius]
        : [part.outer, part.height / 2, part.outer];
  return {
    min: [x - (half[0] as number), y - (half[1] as number), z - (half[2] as number)],
    max: [x + (half[0] as number), y + (half[1] as number), z + (half[2] as number)],
  };
}

/** What each material covers, from the table alone. */
function expected(parts: readonly ModelPart[]): Map<string, { min: number[]; max: number[] }> {
  const found = new Map<string, { min: number[]; max: number[] }>();
  for (const part of parts) {
    const box = extent(part);
    const seen = found.get(part.mtl);
    if (!seen) found.set(part.mtl, box);
    else {
      for (let a = 0; a < 3; a++) {
        seen.min[a] = Math.min(seen.min[a] as number, box.min[a] as number);
        seen.max[a] = Math.max(seen.max[a] as number, box.max[a] as number);
      }
    }
  }
  return found;
}

interface Modelled {
  readonly label: string;
  readonly parts: readonly ModelPart[];
  /**
   * The lower-left plot of the site the `i`-th of these stands on. A service
   * reads the civic interleave by its position in it — hospitals 0, police 1,
   * fire 2, depot 4 — and a landmark has a list of its own.
   */
  readonly site: (layout: CityLayout, i: number) => Coord;
  /** Plots a side: 2 for a civic square, 3 for the stadium's. */
  readonly span: number;
  readonly count: (n: number) => Partial<GameState>;
  /** Which mesh each of the model's materials is drawn into. */
  readonly meshes: ReadonlyMap<string, string>;
}

const MODELLED: readonly Modelled[] = [
  {
    label: 'hospital',
    parts: HOSPITAL_PARTS,
    site: (layout, i) => layout.civicSiteFor(0, i),
    span: 2,
    count: (n) => ({ hospitals: n }),
    meshes: new Map([
      ['clinic-white', 'hospital:walls'],
      ['glazing', 'hospital:glazing'],
      ['mint-roof', 'hospital:caps'],
      ['plant-grey', 'hospital:plant'],
      ['sodium-glow', 'hospital:doors'],
      ['deck-asphalt', 'hospital:helipad'],
      ['marking-white', 'hospital:mark'],
      ['emergency-red', 'hospital:cross'],
    ]),
  },
  {
    label: 'fire station',
    parts: FIRE_STATION_PARTS,
    site: (layout, i) => layout.civicSiteFor(2, i),
    span: 2,
    count: (n) => ({ fire: n }),
    meshes: new Map([
      ['engine-brick', 'fire:walls'],
      ['trim-concrete', 'fire:trim'],
      ['bay-door-light', 'fire:doors'],
      // Same red as the beacon, and a mesh of its own for exactly that reason.
      ['roof-red', 'fire:caps'],
      ['glazing', 'fire:glazing'],
      ['beacon-red', 'fire:beacon'],
      ['apron-asphalt', 'fire:apron'],
      ['marking-white', 'fire:markings'],
      ['plant-grey', 'fire:plant'],
    ]),
  },
  {
    label: 'police station',
    parts: POLICE_STATION_PARTS,
    site: (layout, i) => layout.civicSiteFor(1, i),
    span: 2,
    count: (n) => ({ police: n }),
    meshes: new Map([
      ['station-navy', 'police:walls'],
      ['band-stone', 'police:bands'],
      // Same blue as the lights, and a mesh of its own for exactly that reason.
      ['police-blue', 'police:caps'],
      ['mast-grey', 'police:mast'],
      ['trim-concrete', 'police:trim'],
      ['glazing', 'police:glazing'],
      ['yard-asphalt', 'police:yard'],
      ['patrol-white', 'police:cars'],
      ['signal-blue', 'police:lights'],
    ]),
  },
  {
    label: 'bus depot',
    parts: BUS_DEPOT_PARTS,
    site: (layout, i) => layout.civicSiteFor(4, i),
    span: 2,
    count: (n) => ({ depots: n }),
    meshes: new Map([
      ['depot-teal', 'transit:walls'],
      ['glazing', 'transit:glazing'],
      // The shed cap, the band down each bus and the sign on the pylon: one
      // livery worn by the building and by the vehicles parked in front of it.
      ['livery-lime', 'transit:livery'],
      ['apron-asphalt', 'transit:apron'],
      ['marking-white', 'transit:markings'],
      ['bus-green', 'transit:buses'],
      ['plant-grey', 'transit:canopies'],
      ['trim-concrete', 'transit:columns'],
      ['bay-light', 'transit:lights'],
    ]),
  },
  {
    label: 'museum',
    parts: MUSEUM_PARTS,
    // A landmark is reserved one square of each size a district, so the i-th
    // museum is the i-th district's and needs no interleave.
    site: (layout, i) => layout.landmarkSmallSiteCell(i),
    span: 2,
    count: (n) => ({ museums: n }),
    meshes: new Map([
      ['plinth-grey', 'museum:plinth'],
      ['landmark-stone', 'museum:walls'],
      ['cornice-brown', 'museum:cornice'],
      ['glazing', 'museum:glazing'],
      ['lantern-light', 'museum:lantern'],
    ]),
  },
  {
    label: 'stadium',
    parts: STADIUM_PARTS,
    site: (layout, i) => layout.landmarkLargeSiteCell(i),
    // The one modelled building on a 3x3 square, which is the whole reason
    // `site` and `span` are read off the entry rather than assumed.
    span: 3,
    count: (n) => ({ stadiums: n }),
    meshes: new Map([
      ['seating-grey', 'stadium:concourse'],
      ['pitch-green', 'stadium:pitch'],
      ['marking-white', 'stadium:markings'],
      ['landmark-stone', 'stadium:stands'],
      ['roof-brown', 'stadium:roof'],
      ['gate-dark', 'stadium:gates'],
      ['mast-grey', 'stadium:masts'],
      ['floodlight', 'stadium:floods'],
    ]),
  },
];

/** The world-space box each of a building's meshes covers, for instance `i`. */
function boxes(root: THREE.Object3D, prefix: string, i: number): Map<string, THREE.Box3> {
  const matrix = new THREE.Matrix4();
  const found = new Map<string, THREE.Box3>();
  root.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    if (!object.name.startsWith(`${prefix}:`) || i >= object.count) return;
    object.getMatrixAt(i, matrix);
    object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox;
    if (box) found.set(object.name, box.clone().applyMatrix4(matrix));
  });
  return found;
}

/** The centre of the site the `i`-th building of a type stands on. */
function siteCentre(layout: CityLayout, building: Modelled, i: number): THREE.Vector3 {
  const cell = building.site(layout, i);
  // `worldX` gives the centre of the plot the square is indexed by, and the
  // building straddles the whole square: half a cell further for a 2x2, a whole
  // one for the stadium's 3x3. This is the offset `CivicMeshes` is built with.
  const off = ((building.span - 1) * CELL) / 2;
  return new THREE.Vector3(worldX(cell.x) + off, 0, worldZ(cell.z) + off);
}

/**
 * Rounded to the millimetre, which is finer than any model is drawn.
 *
 * Position buffers are float32 and a model's numbers are not all representable
 * in it — the fire station's dorm sits at 1.525 and comes back a ten-millionth
 * below where it was put — so the comparison is to the millimetre and the
 * signed zero that rounding can produce is folded back onto zero.
 */
const round = (n: number): number => (Math.round(n * 1000) / 1000) + 0;

/** How far off exact a float32 round-trip is allowed to leave a coordinate. */
const EPSILON = 1e-5;

describe.each(MODELLED)('the $label', (building) => {
  const prefix = [...building.meshes.values()][0]?.split(':')[0] as string;
  const settled = (): {
    root: THREE.Scene;
    layout: CityLayout;
    buildings: Buildings;
    centre: THREE.Vector3;
  } => {
    const root = new THREE.Scene();
    const layout = new CityLayout();
    const buildings = new Buildings(root, layout);
    buildings.sync(state({ districts: 1, ...building.count(1) }), 0);
    // Past the end of the growth animation: the model is what it settles at.
    buildings.update(1e6);
    return { root, layout, buildings, centre: siteCentre(layout, building, 0) };
  };

  it('stands where the model puts it, material for material', () => {
    const { root, centre } = settled();
    const drawn = boxes(root, prefix, 0);
    const want = expected(building.parts);

    // One mesh per material in the model, and nothing else in the scene.
    expect([...drawn.keys()].sort()).toEqual([...building.meshes.values()].sort());
    expect(want.size).toBe(building.meshes.size);

    for (const [mtl, box] of want) {
      const name = building.meshes.get(mtl);
      expect(name, `${mtl} is drawn somewhere`).toBeDefined();
      const got = drawn.get(name as string);
      expect(got, name).toBeDefined();
      if (!got) continue;
      expect(
        [got.min.x - centre.x, got.min.y, got.min.z - centre.z].map(round),
        `${name} min`,
      ).toEqual(box.min.map(round));
      expect(
        [got.max.x - centre.x, got.max.y, got.max.z - centre.z].map(round),
        `${name} max`,
      ).toEqual(box.max.map(round));
    }
  });

  it('keeps inside its own site and out of the ground', () => {
    const { root, centre } = settled();
    // Anything past the site's own half-span is over a kerb or into a
    // neighbour, and anything under zero is through the pavement.
    const half = (building.span * CELL) / 2;
    for (const [name, box] of boxes(root, prefix, 0)) {
      expect(box.min.y, `${name} sits on the ground`).toBeGreaterThanOrEqual(-EPSILON);
      for (const corner of [box.min, box.max]) {
        expect(Math.abs(corner.x - centre.x), `${name} within its site in x`).toBeLessThanOrEqual(
          half + EPSILON,
        );
        expect(Math.abs(corner.z - centre.z), `${name} within its site in z`).toBeLessThanOrEqual(
          half + EPSILON,
        );
      }
    }
  });

  it('keeps every part in register with the others while it grows', () => {
    const { root, buildings, centre } = settled();
    const done = boxes(root, prefix, 0);
    const tallest = [...building.meshes.values()].reduce((best, name) =>
      (done.get(name)?.max.y ?? 0) > (done.get(best)?.max.y ?? 0) ? name : best,
    );
    const full = done.get(tallest);
    expect(full).toBeDefined();

    // Growth is staged in seconds and settles in well under one, so the frame
    // to check is scanned for rather than guessed at.
    buildings.sync(state({ districts: 1, ...building.count(0) }), 0);
    buildings.sync(state({ districts: 1, ...building.count(1) }), 10);
    let scale = 0;
    let mid: Map<string, THREE.Box3> | null = null;
    for (let t = 10; t < 11 && !mid && full; t += 0.005) {
      buildings.update(t);
      const growing = boxes(root, prefix, 0).get(tallest);
      if (!growing) continue;
      const seen = growing.max.y / full.max.y;
      if (seen > 0.05 && seen < 0.9) {
        scale = seen;
        mid = boxes(root, prefix, 0);
      }
    }
    expect(mid, 'a frame mid-growth').not.toBeNull();

    // Every part the same fraction of its settled self on all three axes,
    // measured from the site's ground centre. That is what one shared transform
    // and a zero offset buy, and the only way a building of nine meshes grows
    // without coming apart.
    for (const name of building.meshes.values()) {
      const now = mid?.get(name);
      const settledBox = done.get(name);
      expect(now, name).toBeDefined();
      expect(settledBox, name).toBeDefined();
      if (!now || !settledBox) continue;
      const ratio = (a: number, b: number): number => (Math.abs(b) < 1e-6 ? scale : a / b);
      expect(ratio(now.max.y, settledBox.max.y), `${name} height`).toBeCloseTo(scale, 6);
      expect(
        ratio(now.max.x - centre.x, settledBox.max.x - centre.x),
        `${name} width`,
      ).toBeCloseTo(scale, 6);
      expect(
        ratio(now.max.z - centre.z, settledBox.max.z - centre.z),
        `${name} depth`,
      ).toBeCloseTo(scale, 6);
    }
  });

  it('costs one mesh a material however many the city opens', () => {
    const root = new THREE.Scene();
    const layout = new CityLayout();
    const buildings = new Buildings(root, layout);
    const names = (): string[] => {
      const found: string[] = [];
      root.traverse((object) => {
        if (object instanceof THREE.InstancedMesh && object.name.startsWith(`${prefix}:`)) {
          found.push(object.name);
        }
      });
      return found.sort();
    };
    // Every mesh exists before the city has one of these at all.
    expect(names()).toEqual([...building.meshes.values()].sort());

    buildings.sync(state({ districts: 12, ...building.count(12) }), 0);
    buildings.update(1e6);
    expect(names()).toEqual([...building.meshes.values()].sort());

    // And the twelfth is the model too, on its own district's site.
    const centre = siteCentre(layout, building, 11);
    const drawn = boxes(root, prefix, 11);
    for (const [mtl, box] of expected(building.parts)) {
      const got = drawn.get(building.meshes.get(mtl) as string);
      expect(got, mtl).toBeDefined();
      if (got) {
        expect([got.max.x - centre.x, got.max.y, got.max.z - centre.z].map(round)).toEqual(
          box.max.map(round),
        );
      }
    }
  });
});
