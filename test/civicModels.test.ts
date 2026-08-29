import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Buildings } from '../src/render/buildings';
import { Cars } from '../src/render/cars';
import { ROAD_H } from '../src/render/ground';
import { Parks } from '../src/render/zones';
import {
  BUS_DEPOT_PARTS,
  BUS_PARTS,
  CAMPUS_PARTS,
  FIRE_STATION_PARTS,
  HOSPITAL_PARTS,
  MUSEUM_PARTS,
  PARK_PARTS,
  POLICE_STATION_PARTS,
  SCHOOL_PARTS,
  STADIUM_PARTS,
} from '../src/render/civicModels';
import type { ModelPart } from '../src/render/model';
import { CELL } from '../src/sim/config';
import { CityLayout, worldX, worldZ, type Coord } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';

/**
 * The eight buildings on a reserved square that come out of a model, checked as
 * a black box. The park and the bus, which are modelled too and are not
 * buildings, are at the bottom of this file.
 *
 * The other two are a slab with one thing standing on them, and bounds checks
 * on those would only restate `civicTrio`. These eight are assembled from part
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
    label: 'school',
    parts: SCHOOL_PARTS,
    site: (layout, i) => layout.civicSiteFor(3, i),
    span: 2,
    count: (n) => ({ schools: n }),
    meshes: new Map([
      ['school-stone', 'school:walls'],
      ['glazing', 'school:glazing'],
      ['school-roof', 'school:roofs'],
      ['clerestory-light', 'school:clerestory'],
      ['trim-grey', 'school:trim'],
      ['yard-asphalt', 'school:yard'],
      ['marking-white', 'school:markings'],
      ['hedge-green', 'school:hedge'],
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
    label: 'university',
    parts: CAMPUS_PARTS,
    // The university has a 3x3 list of its own and never touches the civic
    // interleave, which is what keeps the five 2x2 types where they are.
    site: (layout, i) => layout.universitySiteCell(i),
    span: 3,
    count: (n) => ({ universities: n }),
    meshes: new Map([
      ['trim-grey', 'university:terrace'],
      ['quad-lawn', 'university:lawn'],
      ['quad-path', 'university:paths'],
      ['campus-stone', 'university:walls'],
      ['glazing', 'university:glazing'],
      ['campus-roof', 'university:caps'],
      ['belfry-light', 'university:belfry'],
      ['tree-trunk', 'university:trunks'],
      ['tree-canopy', 'university:canopies'],
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


/**
 * The park, which is modelled like the seven above and drawn by none of the
 * same code.
 *
 * It is a single plot with no building on it, so `Parks` writes one transform
 * per park into one mesh per material and there is no growth animation to keep
 * anything in register through. That leaves two of the four questions above
 * worth asking — the parts land where the model puts them, and they land in the
 * right meshes — plus one this file could not ask of a building: that the model
 * stays inside the pad, because a park's neighbours are other plots rather than
 * the rest of its own site.
 */
describe('the park', () => {
  /** The pad a park is drawn on: a plot, less the gutter every plot leaves. */
  const PAD = CELL - 0.8;

  const laid = (): { root: THREE.Scene; layout: CityLayout; centre: THREE.Vector3 } => {
    const root = new THREE.Scene();
    const layout = new CityLayout();
    const parks = new Parks(root, layout);
    const at = state({ districts: 1, parks: 1 });
    layout.ensure(at);
    parks.sync(at);
    const cell = layout.parkCell(0);
    // A park sits on one plot and `worldX` is that plot's centre, so unlike a
    // civic building there is no half-site to step over.
    return { root, layout, centre: new THREE.Vector3(worldX(cell.x), 0, worldZ(cell.z)) };
  };

  const MESHES = new Map([
    ['park-lawn', 'park:park-lawn'],
    ['park-path', 'park:park-path'],
    ['planting-bed', 'park:planting-bed'],
    ['pond-water', 'park:pond-water'],
    ['tree-trunk', 'park:tree-trunk'],
    ['tree-canopy', 'park:tree-canopy'],
    ['bench-grey', 'park:bench-grey'],
    ['lamp-light', 'park:lamp-light'],
  ]);

  it('lays out where the model puts it, material for material', () => {
    const { root, centre } = laid();
    const drawn = boxes(root, 'park', 0);
    const want = expected(PARK_PARTS);

    expect([...drawn.keys()].sort()).toEqual([...MESHES.values()].sort());
    expect(want.size).toBe(MESHES.size);

    for (const [mtl, box] of want) {
      const got = drawn.get(MESHES.get(mtl) as string);
      expect(got, mtl).toBeDefined();
      if (!got) continue;
      expect([got.min.x - centre.x, got.min.y, got.min.z - centre.z].map(round)).toEqual(
        box.min.map(round),
      );
      expect([got.max.x - centre.x, got.max.y, got.max.z - centre.z].map(round)).toEqual(
        box.max.map(round),
      );
    }
  });

  it('keeps inside its own plot and out of the ground', () => {
    const { root, centre } = laid();
    // The pad's own half-width. A park's neighbours are plots rather than the
    // rest of a site it owns, so anything past this is over someone's kerb —
    // and the lamp on the corner is what makes that worth asserting.
    const half = PAD / 2;
    for (const [name, box] of boxes(root, 'park', 0)) {
      expect(box.min.y, `${name} sits on the ground`).toBeGreaterThanOrEqual(-EPSILON);
      for (const corner of [box.min, box.max]) {
        expect(Math.abs(corner.x - centre.x), `${name} within the pad in x`).toBeLessThanOrEqual(
          half + EPSILON,
        );
        expect(Math.abs(corner.z - centre.z), `${name} within the pad in z`).toBeLessThanOrEqual(
          half + EPSILON,
        );
      }
    }
  });

  it('costs one mesh a material however many the city lays out', () => {
    const root = new THREE.Scene();
    const layout = new CityLayout();
    const parks = new Parks(root, layout);
    const names = (): string[] => {
      const found: string[] = [];
      root.traverse((object) => {
        if (object instanceof THREE.InstancedMesh && object.name.startsWith('park:')) {
          found.push(object.name);
        }
      });
      return found.sort();
    };
    expect(names()).toEqual([...MESHES.values()].sort());

    const at = state({ districts: 8, parks: 32 });
    layout.ensure(at);
    parks.sync(at);
    expect(names()).toEqual([...MESHES.values()].sort());

    // And the thirty-second is the model too, on its own plot.
    const cell = layout.parkCell(31);
    const centre = new THREE.Vector3(worldX(cell.x), 0, worldZ(cell.z));
    const drawn = boxes(root, 'park', 31);
    for (const [mtl, box] of expected(PARK_PARTS)) {
      const got = drawn.get(MESHES.get(mtl) as string);
      expect(got, mtl).toBeDefined();
      if (got) {
        expect([got.max.x - centre.x, got.max.y, got.max.z - centre.z].map(round)).toEqual(
          box.max.map(round),
        );
      }
    }
  });
});


/**
 * The bus, which is modelled like everything above and drawn like none of it.
 *
 * It is the one model that moves, so it is the one merged by `mergeColoured`
 * rather than by material: a vehicle's transform is rewritten every frame, and
 * a mesh per material would multiply the hottest loop in the renderer by seven.
 * What that buys has to be checked differently — there is no mesh per material
 * to look for — and it puts two things at risk that a building never had:
 *
 *  - The **colours**, which are now an attribute on the geometry rather than a
 *    material each. Drop the attribute and every bus in the city is white.
 *  - The **height**. A box is centred on its own middle and a model stands on
 *    its wheels, so the two want different y for the same vehicle on the same
 *    road. Get it wrong and every bus is buried to the windows.
 */
describe('the bus', () => {
  const LIT = new Set(['destination-blind', 'headlight']);

  /** The meshes a bus is drawn in, and which of the model's parts each carries. */
  const MESHES: ReadonlyArray<[string, (part: ModelPart) => boolean]> = [
    ['traffic:bus', (part) => !LIT.has(part.mtl)],
    ['traffic:bus:blind', (part) => part.mtl === 'destination-blind'],
    ['traffic:bus:lamps', (part) => part.mtl === 'headlight'],
  ];

  /** A city with buses on its streets, driven far enough to have routed them. */
  const running = (night = 1): { root: THREE.Scene; cars: Cars } => {
    const root = new THREE.Scene();
    const cars = new Cars(root, new CityLayout(), true);
    cars.sync(state({ districts: 4, depots: 2, depotStaff: 1 }));
    for (let i = 0; i < 30; i++) cars.update(1 / 60, new THREE.Vector3(0, 0, 0), night);
    return { root, cars };
  };

  const meshNamed = (root: THREE.Object3D, name: string): THREE.InstancedMesh | null => {
    let found: THREE.InstancedMesh | null = null;
    root.traverse((object) => {
      if (object instanceof THREE.InstancedMesh && object.name === name) found = object;
    });
    return found;
  };

  it('is the model, in three meshes, each covering its own parts', () => {
    const { root } = running();
    for (const [name, holds] of MESHES) {
      const mesh = meshNamed(root, name);
      expect(mesh, name).not.toBeNull();
      if (!mesh) continue;
      mesh.geometry.computeBoundingBox();
      const got = mesh.geometry.boundingBox;
      expect(got, name).toBeDefined();
      if (!got) continue;

      // What the table says this mesh's parts cover, worked out by hand.
      const parts = BUS_PARTS.filter(holds);
      expect(parts.length, `${name} draws something`).toBeGreaterThan(0);
      const want = parts.map(extent).reduce((box, one) => ({
        min: box.min.map((v, a) => Math.min(v, one.min[a] as number)),
        max: box.max.map((v, a) => Math.max(v, one.max[a] as number)),
      }));
      expect([got.min.x, got.min.y, got.min.z].map(round), `${name} min`).toEqual(
        want.min.map(round),
      );
      expect([got.max.x, got.max.y, got.max.z].map(round), `${name} max`).toEqual(
        want.max.map(round),
      );
    }
  });

  it('carries its colours on the body geometry, not on the material', () => {
    const { root } = running();
    const body = meshNamed(root, 'traffic:bus');
    expect(body).not.toBeNull();
    if (!body) return;
    const colours = body.geometry.getAttribute('color');
    expect(colours, 'the body is vertex-coloured').toBeDefined();
    expect(colours.count).toBe(body.geometry.getAttribute('position').count);
    // Every unlit material in the model, in the values a material of its own
    // would have been given. Anything less means a colour was dropped in the
    // merge and some part of every bus is wearing another part's paint.
    const seen = new Set<string>();
    for (let i = 0; i < colours.count; i++) {
      seen.add([colours.getX(i), colours.getY(i), colours.getZ(i)].map(round).join(','));
    }
    const want = new Set(
      BUS_PARTS.filter((part) => !LIT.has(part.mtl)).map((part) => {
        const colour = new THREE.Color().setHex(part.colour);
        return [colour.r, colour.g, colour.b].map(round).join(',');
      }),
    );
    expect(seen).toEqual(want);
  });

  it('draws its blind and its lamps once each, and its lamps only at night', () => {
    const at = (root: THREE.Object3D, name: string): THREE.InstancedMesh =>
      meshNamed(root, name) as THREE.InstancedMesh;

    const dark = running(1).root;
    const body = at(dark, 'traffic:bus');
    expect(body.count, 'a staffed depot puts buses on the street').toBeGreaterThan(0);
    // The blind and the lamps are parts of the bus, so one of each per bus and
    // on the bus's own transform. A count that drifted would leave the last bus
    // in the fleet wearing the first one's face.
    const matrix = new THREE.Matrix4();
    const other = new THREE.Matrix4();
    for (const name of ['traffic:bus:blind', 'traffic:bus:lamps']) {
      const mesh = at(dark, name);
      expect(mesh.count, name).toBe(body.count);
      expect(mesh.visible, name).toBe(true);
      for (let i = 0; i < body.count; i++) {
        body.getMatrixAt(i, matrix);
        mesh.getMatrixAt(i, other);
        expect(other.elements, `${name} ${i} rides the bus`).toEqual(matrix.elements);
      }
    }

    // By day the headlights are off, exactly as every other vehicle's are —
    // but the blind is a display and stays drawn, dimmed by its own floor.
    const day = running(0).root;
    expect(at(day, 'traffic:bus:lamps').visible).toBe(false);
    expect(at(day, 'traffic:bus:blind').count).toBe(at(day, 'traffic:bus').count);
  });

  it('stands on the road rather than sunk into it', () => {
    const { root } = running();
    const body = meshNamed(root, 'traffic:bus');
    expect(body).not.toBeNull();
    if (!body) return;
    expect(body.count, 'a staffed depot puts buses on the street').toBeGreaterThan(0);

    const matrix = new THREE.Matrix4();
    body.geometry.computeBoundingBox();
    const local = body.geometry.boundingBox as THREE.Box3;
    for (let i = 0; i < body.count; i++) {
      body.getMatrixAt(i, matrix);
      const box = local.clone().applyMatrix4(matrix);
      // The model's own wheels are at y = 0, so a bus's bottom is the road
      // surface exactly. A box body would sit half its height lower.
      expect(box.min.y, `bus ${i} on the tarmac`).toBeCloseTo(ROAD_H, 5);
    }
  });
});
