import * as THREE from 'three';
import {
  coastalDistrictAt,
  districtCoord,
  DISTRICT_WIDTH,
  type Coord,
} from '../sim/layout';
import type { GameState } from '../sim/state';
import { WATERS, type Shore } from '../sim/water';
import { Glow } from './glow';
import { GrowableInstancedMesh } from './growable';
import { PALETTE } from './palette';

/**
 * The city's waterfront: a quay off every coastal district that has a terminal
 * on it, with what the terminals are.
 *
 * A readout of two counts, in exactly the way the skyline is a readout of
 * `homes`. The i-th terminal of each kind stands at the i-th coastal district's
 * quay, so nothing here is stored and nothing needs to be: where a berth is
 * falls out of `coastalDistrictAt` and the water field, both of which are pure
 * functions of the seed.
 *
 * The quay itself is why a port can be drawn at all. A coastal district is dry
 * land with the sea against it, and "against it" is only ever within a district
 * of the tile — measured, 6 to 50 world units of beach. A terminal planted on
 * the district would stand in a field looking at the water; a deck run out from
 * the district's own edge to past the waterline puts it where a port goes, and
 * turns that variable gap into the thing it looks like from the air, which is
 * dockland.
 */

/** How far the deck runs past the waterline. Room for a berth and a crane. */
const QUAY_OUT = 26;

/** How wide the deck is along the shore. Two terminals side by side. */
const QUAY_WIDE = 26;

/** Deck top, and how thick it is. It stands proud of the water like a wharf. */
const DECK_TOP = 0.3;
const DECK_H = 1.4;

const CRUISE_LEN = 18;
const CRUISE_WIDE = 10;
const CRUISE_H = 4.6;

const CARGO_LEN = 14;
const CARGO_WIDE = 10;
const CARGO_H = 4;

/**
 * The roof monitor both terminals wear, as a share of the shed under it.
 *
 * Deliberately *smaller* than the body rather than an overhang, which is the
 * opposite of what the civic buildings do — and the reason is that these two
 * share one mesh. A slab wider than its shed hides the shed from overhead, so
 * an overhanging roof in one colour would make the pale cruise terminal and the
 * dark cargo one identical from the play camera. Sitting a narrower monitor on
 * top leaves the body colour showing all the way round it, which is the signal.
 */
const ROOF_H = 0.5;
const ROOF_SHARE = 0.55;

/** Gantry masts over the cargo berth. Two of them read as a crane; one is a chimney. */
const MAST_W = 1.6;
const MAST_H = 12;
const MAST_GAP = 7;

/** A lit band on each terminal, so the waterfront is still there after dark. */
const LAMP_H = 0.5;

/** Instances one port can want, per mesh. Two terminals, two masts, two lamps. */
const PER_PORT = 2;

/**
 * Where one berth's deck runs, in the coast frame.
 *
 * Filled in place rather than returned: `sync` walks every port whenever a
 * count changes, and a fresh object per berth would be an allocation on a path
 * the annexation ceremony already runs through.
 */
interface Berth {
  /** Along the coast, shared by everything on this quay. */
  v: number;
  /** The district's seaward edge, where the deck starts. */
  from: number;
  /** The waterline. Terminals stand just past it, ships moor past them. */
  shore: number;
  /** The seaward end of the deck. */
  to: number;
}

const probe: Berth = { v: 0, from: 0, shore: 0, to: 0 };
const tip: Shore = { x: 0, z: 0 };

/** Fills `berth` for the i-th port. False when the city does not own one. */
function berthAt(i: number, districts: number, out: Berth): boolean {
  const index = coastalDistrictAt(i, districts);
  if (index < 0) return false;
  const coord = districtCoord(index) as Coord;
  const x = coord.x * DISTRICT_WIDTH;
  const z = coord.z * DISTRICT_WIDTH;
  out.v = WATERS.v(x, z);
  out.from = WATERS.u(x, z) + DISTRICT_WIDTH / 2;
  out.shore = WATERS.shore(out.v);
  out.to = out.shore + QUAY_OUT;
  return true;
}

/**
 * How far from a point the built waterfront reaches, or 0 if there is none.
 *
 * Asked by the camera rig, which used to bound panning to the districts alone —
 * so a quay was something you could see from a wide shot and could not go and
 * stand over. The city owns more than its districts now.
 */
export function portReach(state: Readonly<GameState>, x: number, z: number): number {
  let reach = 0;
  const ports = Math.max(state.cruiseTerminals, state.cargoTerminals);
  for (let i = 0; i < ports; i++) {
    if (!berthAt(i, state.districts, probe)) continue;
    WATERS.toWorld(probe.to, probe.v, tip);
    reach = Math.max(reach, Math.hypot(tip.x - x, tip.z - z));
  }
  return reach;
}

/** The waterfront layer. Six meshes, none of which grows past the berths. */
export class Port {
  private readonly deck: GrowableInstancedMesh;
  private readonly cruise: GrowableInstancedMesh;
  private readonly cargo: GrowableInstancedMesh;
  private readonly roofs: GrowableInstancedMesh;
  private readonly masts: GrowableInstancedMesh;
  private readonly lamps: GrowableInstancedMesh;
  private readonly glow = new Glow(PALETTE.sodium, 0.3);
  private readonly dummy = new THREE.Object3D();
  private readonly point: Shore = { x: 0, z: 0 };
  private readonly berth: Berth = { v: 0, from: 0, shore: 0, to: 0 };

  /** What the scene was last built for. Three counts, so nothing rebuilds idly. */
  private shownDistricts = -1;
  private shownCruise = -1;
  private shownCargo = -1;

  constructor(scene: THREE.Scene) {
    this.deck = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, DECK_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.quay }),
      2,
      { castShadow: true, receiveShadow: true, name: 'port:deck' },
    );
    this.cruise = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, CRUISE_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.concrete }),
      2,
      { castShadow: true, receiveShadow: true, name: 'port:cruise' },
    );
    this.cargo = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, CARGO_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.industry }),
      2,
      { castShadow: true, receiveShadow: true, name: 'port:cargo' },
    );
    // One slab for both terminals, scaled per instance: a roof is the second
    // signal that says which shed you are looking at, and it is the same slab.
    this.roofs = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, ROOF_H, 1),
      new THREE.MeshLambertMaterial({ color: PALETTE.parapet }),
      2 * PER_PORT,
      { castShadow: true },
    );
    this.masts = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(MAST_W, MAST_H, MAST_W),
      new THREE.MeshLambertMaterial({ color: PALETTE.stack }),
      2 * PER_PORT,
      { castShadow: true },
    );
    this.lamps = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, LAMP_H, 1),
      this.glow.material,
      2 * PER_PORT,
    );
  }

  setNight(night: number): void {
    this.glow.setNight(night);
  }

  /**
   * Rebuilds the waterfront when a count moves. Cheap when nothing has.
   *
   * Rebuilt whole rather than appended, unlike the districts: there are at most
   * a handful of berths, they are written from scratch in a few dozen matrix
   * writes, and a port is the one thing in the city whose *position* can change
   * for a reason other than being built — annexing a nearer coastal district
   * does not move an existing quay, but reloading a city that has one does not
   * know which quay was built first without walking them all anyway.
   */
  sync(state: Readonly<GameState>): void {
    if (
      state.districts === this.shownDistricts &&
      state.cruiseTerminals === this.shownCruise &&
      state.cargoTerminals === this.shownCargo
    ) {
      return;
    }
    this.shownDistricts = state.districts;
    this.shownCruise = state.cruiseTerminals;
    this.shownCargo = state.cargoTerminals;

    const ports = Math.max(state.cruiseTerminals, state.cargoTerminals);
    this.deck.ensure(Math.max(1, ports));
    this.cruise.ensure(Math.max(1, state.cruiseTerminals));
    this.cargo.ensure(Math.max(1, state.cargoTerminals));
    this.roofs.ensure(Math.max(1, ports * PER_PORT));
    this.masts.ensure(Math.max(1, state.cargoTerminals * PER_PORT));
    this.lamps.ensure(Math.max(1, ports * PER_PORT));

    let decks = 0;
    let cruises = 0;
    let cargos = 0;
    let roofs = 0;
    let masts = 0;
    let lamps = 0;
    for (let i = 0; i < ports; i++) {
      // Counted as written rather than assumed, for the reason `CityLayout.place`
      // clamps: the counts are held inside the berths by `Game` and by `migrate`,
      // and if one ever got past both, the renderer's answer has to be a port
      // that is missing rather than a quay drawn on last frame's matrix.
      if (!berthAt(i, state.districts, this.berth)) continue;
      const b = this.berth;
      this.box((b.from + b.to) / 2, b.v, b.to - b.from, QUAY_WIDE, DECK_TOP - DECK_H / 2);
      this.deck.setMatrixAt(decks++, this.dummy.matrix);

      // Terminals stand on the deck past the waterline, which is where a
      // terminal goes: the landward stretch is the beach the deck bridges, and
      // it is as little as six units wide on some seeds.
      const shed = b.shore + QUAY_OUT * 0.4;
      if (i < state.cruiseTerminals) {
        const v = b.v - QUAY_WIDE / 4;
        this.box(shed, v, CRUISE_LEN, CRUISE_WIDE, DECK_TOP + CRUISE_H / 2);
        this.cruise.setMatrixAt(cruises++, this.dummy.matrix);
        this.box(
          shed,
          v,
          CRUISE_LEN * ROOF_SHARE,
          CRUISE_WIDE * ROOF_SHARE,
          DECK_TOP + CRUISE_H + ROOF_H / 2,
        );
        this.roofs.setMatrixAt(roofs++, this.dummy.matrix);
        this.box(shed, v, CRUISE_LEN * 0.9, CRUISE_WIDE + 0.2, DECK_TOP + CRUISE_H * 0.55);
        this.lamps.setMatrixAt(lamps++, this.dummy.matrix);
      }
      if (i < state.cargoTerminals) {
        const v = b.v + QUAY_WIDE / 4;
        this.box(shed, v, CARGO_LEN, CARGO_WIDE, DECK_TOP + CARGO_H / 2);
        this.cargo.setMatrixAt(cargos++, this.dummy.matrix);
        this.box(
          shed,
          v,
          CARGO_LEN * ROOF_SHARE,
          CARGO_WIDE * ROOF_SHARE,
          DECK_TOP + CARGO_H + ROOF_H / 2,
        );
        this.roofs.setMatrixAt(roofs++, this.dummy.matrix);
        this.box(shed, v, CARGO_LEN * 0.85, CARGO_WIDE + 0.2, DECK_TOP + CARGO_H * 0.5);
        this.lamps.setMatrixAt(lamps++, this.dummy.matrix);
        // Two masts straddling the berth, so the pair reads as a gantry crane
        // rather than as a chimney somebody left on a quay.
        for (let k = 0; k < PER_PORT; k++) {
          const at = b.to - 6;
          WATERS.toWorld(at, v + (k === 0 ? -MAST_GAP / 2 : MAST_GAP / 2), this.point);
          this.dummy.position.set(this.point.x, DECK_TOP + MAST_H / 2, this.point.z);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          this.masts.setMatrixAt(masts++, this.dummy.matrix);
        }
      }
    }

    this.deck.count = decks;
    this.cruise.count = cruises;
    this.cargo.count = cargos;
    this.roofs.count = roofs;
    this.masts.count = masts;
    this.lamps.count = lamps;
    this.deck.flush();
    this.cruise.flush();
    this.cargo.flush();
    this.roofs.flush();
    this.masts.flush();
    this.lamps.flush();
  }

  /**
   * Writes one axis-aligned box in the coast frame into `dummy`.
   *
   * Scaled rather than rotated. The coast runs along a world axis by
   * construction — see `Waters.coast` — so "along the shore" is either x or z,
   * and swapping which side of the scale gets the length is the whole of the
   * transform. A rotation would be a quaternion per box for the same result.
   */
  private box(u: number, v: number, along: number, across: number, y: number): void {
    WATERS.toWorld(u, v, this.point);
    this.dummy.position.set(this.point.x, y, this.point.z);
    if (WATERS.coast.axis === 'x') this.dummy.scale.set(along, 1, across);
    else this.dummy.scale.set(across, 1, along);
    this.dummy.updateMatrix();
  }
}
