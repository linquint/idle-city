import * as THREE from 'three';
import { hash01 } from '../core/rng';
import { ZONE } from '../sim/citygen';
import { CELL, CIVIC_SERVICES, HAPPINESS_SERVICES } from '../sim/config';
import { congestion, covered, serviceCount, zoneOf } from '../sim/economy';
import {
  BUILDABLE_PARKS_PER_DISTRICT as PARKS_PER_DISTRICT,
  createPlacement,
  housingCentrality,
  worldX,
  worldZ,
  type CityLayout,
  type Coord,
} from '../sim/layout';
import type { GameState, ZoneKind } from '../sim/state';
import { ROAD_H } from './ground';
import { GrowableInstancedMesh } from './growable';
import { PALETTE } from './palette';

/** A gutter under the pad so plots read as plots rather than as a colour wash. */
const PAD = CELL - 0.8;
const PAD_H = 0.1;
/** The land tile's top face sits at y = 0; clear it rather than z-fight it. */
const PAD_Y = 0.06;

/**
 * Where a road pad sits.
 *
 * The carriageway is already ROAD_H above the ground, so a pad at PAD_Y would
 * be *under* the street it is trying to colour and the mode would draw nothing.
 * Clear of it by the same margin the plot pads clear the land tile by.
 */
const ROAD_PAD_Y = ROAD_H + 0.06;

/**
 * Quantisation of demand for the rebuild stamp: 20 steps across [-1, 1].
 *
 * Demand moves on a 25-second constant, so an unquantised stamp would differ on
 * every single frame and rebuild the whole instance buffer for a colour shift
 * nobody can see. A twentieth of the range is finer than the eye reads off a
 * pad and coarse enough that the rebuild fires a handful of times a minute.
 */
const DEMAND_STEPS = 10;
const quantise = (d: number): number => Math.round(d * DEMAND_STEPS);

/**
 * Zoned land that will never carry a building, drawn so it does not read as a
 * hole punched in the block.
 *
 * Two kinds end up here, and they look the same from above because they are the
 * same thing — land the city owns and is not building on:
 *
 *   - the interior of a deep block, which no longer appears in any build list
 *     now that every building has to front a street;
 *   - the 2x2 civic sites still standing empty. There are seven a district and
 *     they are reserved from the moment the land is annexed, so without this a
 *     new district would open as a grid of 28 gaps.
 *
 * Interior plots carrying a park are drawn by `Parks` instead, so this class
 * draws the tail of the courtyard list rather than all of it.
 *
 * Always on, unlike the zoning overlay, and rebuilt only when a count it draws
 * from actually moves.
 */
export class Courtyards {
  private readonly pads: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color(PALETTE.courtyard);
  /** Survey ground. Drier and paler than a courtyard, so the two read apart. */
  private readonly scrubTint = new THREE.Color(PALETTE.scrub);
  private stamp = '';

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    this.pads = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(PAD, PAD_H, PAD),
      new THREE.MeshLambertMaterial({ color: PALETTE.courtyard }),
      256,
      { receiveShadow: true },
    );
  }

  sync(state: Readonly<GameState>): void {
    const built = SERVICE_KEYS.map((key) => serviceCount(state, key));
    // The frontier district's zoning is in the stamp because scrub moves with
    // it: a survey turns a scrub plot into zoned land and this is what draws the
    // difference. Only the last entry can change, so three numbers cover it.
    const at = state.districts - 1;
    const stamp =
      `${state.districts}:${state.parks}:${state.cityHall}:${state.plants}:${built.join(',')}` +
      `:${state.surveyedR[at] ?? 0}:${state.surveyedC[at] ?? 0}:${state.surveyedI[at] ?? 0}`;
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    this.layout.ensure(state);

    const courtyards = this.layout.courtyards;
    // Parks are the front of the courtyard list, so the plots still standing
    // empty are the tail past `parks` — the same rule the build lists use.
    const laid = Math.min(state.parks, courtyards.length);
    // A site is empty until the building indexed onto it exists. The interleave
    // is fixed, so "site i is taken" is pure arithmetic over three counts.
    const types = SERVICE_KEYS.length;
    const taken = (site: number): boolean =>
      (built[site % types] as number) > Math.floor(site / types);

    let n = 0;
    const write = (cell: Coord, tint = this.tint): void => {
      this.dummy.position.set(worldX(cell.x), PAD_Y, worldZ(cell.z));
      this.dummy.updateMatrix();
      this.pads.setMatrixAt(n, this.dummy.matrix);
      this.pads.setColorAt(n, tint);
      n++;
    };

    // The city hall's squares are reserved in every district and built on in
    // exactly one, so every one past the first is land nothing will ever stand
    // on. Drawn for the same reason an empty civic site is: a reserved square
    // left bare reads as a hole in the block rather than as held ground.
    const halls = Math.max(0, this.layout.cityHallSites - (state.cityHall ? 1 : 0));
    // Plant squares the city owns and has not built on. Unlike the hall's, these
    // are all buildable — a district needs about 0.78 of a plant at the top of
    // the level ladder — so this list empties as the city grows into it.
    const plants = Math.max(0, this.layout.powerPlantSites - state.plants);
    let empty = 0;
    for (let i = 0; i < this.layout.civicSites; i++) if (!taken(i)) empty++;
    // Survey ground: sellable frontage the city owns and has zoned to nothing.
    // Through this mesh rather than one of its own, because BUILDING_MESH_BUDGET
    // is 24 with no slack in it — what tells scrub from courtyard is the tint on
    // the instance, which this mesh already varies. Only the frontier district
    // ever holds any, so this list is one district's pool at most.
    const scrub = this.layout.scrub;
    this.pads.ensure(courtyards.length - laid + scrub.length + (empty + halls + plants) * 4);

    const quad = (c: Coord): void => {
      write(c);
      write({ x: c.x + 1, z: c.z });
      write({ x: c.x, z: c.z + 1 });
      write({ x: c.x + 1, z: c.z + 1 });
    };

    for (let i = laid; i < courtyards.length; i++) write(courtyards[i] as Coord);
    for (const cell of scrub) write(cell, this.scrubTint);
    for (let i = 0; i < this.layout.civicSites; i++) {
      // The site's four plots, from its lower-left corner.
      if (!taken(i)) quad(this.layout.civicSiteCell(i));
    }
    for (let i = state.cityHall ? 1 : 0; i < this.layout.cityHallSites; i++) {
      quad(this.layout.cityHallSiteCell(i));
    }
    for (let i = state.plants; i < this.layout.powerPlantSites; i++) {
      quad(this.layout.powerPlantCell(i));
    }

    this.pads.count = n;
    this.pads.flush();
  }
}

/**
 * Parks: a green pad and a handful of trees, on land nothing else can use.
 *
 * The pad is the courtyard pad — same geometry, same height, same one-unit
 * gutter — because a park *is* a courtyard with something on it, and drawing it
 * any other way would make the interior of a block read as two different kinds
 * of land. What distinguishes it is the colour and the trees.
 *
 * Rebuilt only when the park count or the district count moves. Tree placement
 * is `hash01` over the park's ordinal, so a park scatters the same way on every
 * device and after every reload without a single coordinate being stored.
 */
class ParkTrees {
  /** Trees to a plot. Four reads as planting; more reads as woodland. */
  static readonly PER_PARK = 4;
  /** Kept inside the pad, so no canopy overhangs the kerb. */
  static readonly SPREAD = PAD / 2 - 0.55;
}

export class Parks {
  private readonly pads: GrowableInstancedMesh;
  private readonly trunks: GrowableInstancedMesh;
  private readonly canopies: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color(PALETTE.park);
  private stamp = '';

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    this.pads = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(PAD, PAD_H, PAD),
      new THREE.MeshLambertMaterial({ color: PALETTE.park }),
      64,
      { receiveShadow: true },
    );
    this.trunks = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(0.16, 0.55, 0.16),
      new THREE.MeshLambertMaterial({ color: PALETTE.trunk }),
      256,
      { castShadow: true },
    );
    this.canopies = new GrowableInstancedMesh(
      scene,
      new THREE.ConeGeometry(0.52, 1.15, 6),
      new THREE.MeshLambertMaterial({ color: PALETTE.canopy }),
      256,
      { castShadow: true },
    );
  }

  sync(state: Readonly<GameState>): void {
    const stamp = `${state.districts}:${state.parks}`;
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    this.layout.ensure(state);

    const n = Math.min(state.parks, state.districts * PARKS_PER_DISTRICT);
    this.pads.ensure(n);
    this.trunks.ensure(n * ParkTrees.PER_PARK);
    this.canopies.ensure(n * ParkTrees.PER_PARK);

    let tree = 0;
    for (let i = 0; i < n; i++) {
      const cell = this.layout.parkCell(i);
      const x = worldX(cell.x);
      const z = worldZ(cell.z);

      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.position.set(x, PAD_Y, z);
      this.dummy.updateMatrix();
      this.pads.setMatrixAt(i, this.dummy.matrix);
      this.pads.setColorAt(i, this.tint);

      for (let k = 0; k < ParkTrees.PER_PARK; k++) {
        const seed = i * ParkTrees.PER_PARK + k;
        const tx = x + (hash01(seed ^ 0x51ed270b) * 2 - 1) * ParkTrees.SPREAD;
        const tz = z + (hash01(seed ^ 0x2f9a3b17) * 2 - 1) * ParkTrees.SPREAD;
        // A little height variation, or four identical cones read as a fence.
        const grow = 0.78 + hash01(seed ^ 0x7c1a55d3) * 0.5;

        this.dummy.scale.set(1, grow, 1);
        this.dummy.position.set(tx, PAD_Y + (0.55 * grow) / 2, tz);
        this.dummy.updateMatrix();
        this.trunks.setMatrixAt(tree, this.dummy.matrix);

        this.dummy.position.y = PAD_Y + 0.55 * grow + (1.15 * grow) / 2;
        this.dummy.updateMatrix();
        this.canopies.setMatrixAt(tree, this.dummy.matrix);
        tree++;
      }
    }

    this.pads.count = n;
    this.trunks.count = tree;
    this.canopies.count = tree;
    this.pads.flush();
    this.trunks.flush();
    this.canopies.flush();
  }
}

/**
 * What the overlay is showing.
 *
 * Six modes and an off. `plan` is the zoning map and `demand` repaints the same
 * pads by how badly the city wants that type; the four that follow are about
 * the land the city has already built on, which is why `Buildings.setOverlay`
 * takes a per-slot colour rather than one per zone.
 *
 * **Pollution is deliberately not here.** There is no pollution number anywhere
 * in `src/sim`, so an overlay over it would be a picture of nothing — see
 * NOTES.md section 9, where it is written up as the simulation feature it would
 * have to be first.
 */
export type ZoneMode = 'off' | 'plan' | 'demand' | 'value' | 'coverage' | 'order' | 'traffic';

/**
 * The modes, in cycle order, with what the picker calls each.
 *
 * A cycle of seven on one key is unusable, which is why the HUD has a picker —
 * but the key stays, because a player who has learned Z should not have to
 * relearn anything. Shift-Z walks it backwards.
 */
export const ZONE_MODES: readonly { key: ZoneMode; label: string; note: string }[] = [
  { key: 'off', label: 'Off', note: 'No overlay.' },
  { key: 'plan', label: 'Zoning', note: 'What each plot is zoned for.' },
  { key: 'demand', label: 'Demand', note: 'How badly the city wants each type.' },
  { key: 'value', label: 'Land value', note: 'Centrality, which is what rent is multiplied by.' },
  {
    key: 'coverage',
    label: 'Coverage',
    note: 'Housing the worst-covered service accounts for, oldest land first.',
  },
  { key: 'order', label: 'Build order', note: 'Which plots the city took first.' },
  { key: 'traffic', label: 'Traffic', note: 'How jammed the streets are. One number, city-wide.' },
];

/**
 * The 2x2 civic types, in the interleave's own order.
 *
 * `CityLayout.civicSiteFor` hands type `offset` the sites at `i * n + offset`
 * where n is the number of 2x2 types, so "is site s taken" is arithmetic over
 * this list — and it has to be *this* list. It read three types and a modulo 3
 * for two cycles after schools and depots joined the pool, which drew a pad
 * under two buildings in every five and left two genuinely empty sites without
 * one. Derived from CIVIC_SERVICES rather than typed out, so the next type to
 * join cannot leave it behind again.
 */
const SERVICE_KEYS = CIVIC_SERVICES.map((service) => service.key);

const CYCLE: readonly ZoneMode[] = ZONE_MODES.map((mode) => mode.key);

/**
 * A value in [0, 1] as a colour, cold to warm.
 *
 * One ramp for every mode that shows a quantity — land value, build order — so
 * a player who has read one of them can read the others. Deliberately not the
 * demand ramp, which is diverging around a neutral because demand has a sign
 * and these do not.
 */
function ramp(t: number, out: THREE.Color): THREE.Color {
  const at = Math.max(0, Math.min(1, t));
  return out.setHex(PALETTE.overlayLow).lerp(TEMP.setHex(PALETTE.overlayHigh), at);
}

/** Scratch for the ramp's far end, so a colour lerp allocates nothing. */
const TEMP = new THREE.Color();

/**
 * What one plot is worth to the mode being shown, in [0, 1], or null for a plot
 * the mode has nothing to say about.
 *
 * The one place a mode's *meaning* lives, so the pads under the unbuilt land and
 * the bodies of the buildings standing on the built land cannot disagree about
 * what a colour means. `zone` is which list the plot came from and `plot` is its
 * index in that list, which is also its build order.
 */
export interface OverlayReading {
  /** Plots of housing the worst-covered service accounts for. See `coveredPlots`. */
  readonly covered: number;
  readonly congestion: number;
  /** The range the land-value ramp is stretched over. See `read`. */
  readonly valueMin: number;
  readonly valueMax: number;
}

/** What the plan mode calls each zone. The pads and the bodies share it. */
const ZONE_HEX: Record<ZoneKind, number> = {
  home: PALETTE.zoneResidential,
  shop: PALETTE.zoneCommercial,
  industry: PALETTE.zoneIndustrial,
};

/**
 * A per-slot overlay colour for the buildings.
 *
 * The other half of the overlay, and the half the pads cannot carry: a pad
 * drawn under a building is a pad nobody can see. So the unbuilt land is pads
 * and the built land is the building bodies, and this is what tells `Buildings`
 * what colour to make the k-th building of a zone.
 *
 * A function rather than a colour per zone, which is the change this feature
 * needed: `bodyColor` already took an overlay hex per instance, so widening
 * `setOverlay` from one hex to one per slot is the whole of the mesh-layer work.
 */
export type OverlaySource = (kind: ZoneKind, slot: number) => number;

/**
 * The zone plan and every other overlay, as flat coloured pads at ground level.
 *
 * Two InstancedMeshes and two draw calls: one over the zoned plots the city has
 * not built on, and one over the road cells, which only the traffic mode uses.
 * Both rebuild only when the counts they draw from actually move — see `sync`,
 * where the stamp covers whatever each mode reads.
 *
 * Unlit on purpose — an overlay that the key light rakes across is a worse
 * diagram than one that just states the colour.
 */
export class Zones {
  private readonly pads: GrowableInstancedMesh;
  /**
   * The road cells, for the traffic mode alone.
   *
   * Its own mesh rather than more instances in `pads`, because the two answer
   * to different counts: the pads follow the build lists and this follows the
   * district count and nothing else, so a mode that showed both would rebuild
   * the roads every time a house went up.
   */
  private readonly streets: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color();
  private readonly high = new THREE.Color(PALETTE.demandHigh);
  private readonly neutral = new THREE.Color(PALETTE.demandNeutral);
  private readonly low = new THREE.Color(PALETTE.demandLow);
  private mode: ZoneMode = 'off';
  /** What the pads were last built for. Empty forces a rebuild. */
  private stamp = '';
  /** What the road pads were last built for. They follow the districts alone. */
  private roadStamp = '';
  /** How many pads each mode drew last, for the performance report. */
  private drawn = 0;

  constructor(
    scene: THREE.Scene,
    private readonly layout: CityLayout,
  ) {
    this.pads = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(PAD, PAD_H, PAD),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      256,
    );
    this.pads.mesh.visible = false;
    this.streets = new GrowableInstancedMesh(
      scene,
      // The full cell, not PAD: a road pad with a gutter round it would draw a
      // grid of squares where the city has a street network.
      new THREE.BoxGeometry(CELL, PAD_H, CELL),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      256,
    );
    this.streets.mesh.visible = false;
  }

  get enabled(): boolean {
    return this.mode !== 'off';
  }

  get current(): ZoneMode {
    return this.mode;
  }

  /** Pads drawn by the last rebuild. Read by the dev overlay report. */
  get instances(): number {
    return this.drawn;
  }

  /** Steps to the next mode, or the previous one. */
  cycle(back = false): ZoneMode {
    const at = CYCLE.indexOf(this.mode);
    const step = back ? CYCLE.length - 1 : 1;
    return this.set(CYCLE[(at + step) % CYCLE.length] as ZoneMode);
  }

  /** Jumps straight to one mode. What the HUD picker calls. */
  set(mode: ZoneMode): ZoneMode {
    this.mode = mode;
    const on = mode !== 'off';
    this.pads.mesh.visible = on && mode !== 'traffic';
    this.streets.mesh.visible = mode === 'traffic';
    this.stamp = '';
    this.roadStamp = '';
    if (!on) {
      this.pads.count = 0;
      this.streets.count = 0;
      this.drawn = 0;
    }
    return mode;
  }

  /**
   * Demand -> pad colour: green at a live discount, red at oversupply, grey at
   * the balance point. Interpolating through a neutral rather than straight
   * from red to green keeps "nearly balanced" from reading as a weak yes.
   */
  private demandColor(d: number, out: THREE.Color): THREE.Color {
    const t = Math.min(1, Math.abs(d));
    return out.copy(this.neutral).lerp(d >= 0 ? this.high : this.low, t);
  }

  /**
   * How much of the city's housing the *worst-covered* service reaches.
   *
   * One tint rather than a sub-mode per service, and the reason is the same one
   * that put a picker in the HUD: four more entries on a cycle that already has
   * seven would make the control unusable to save a player one comparison. The
   * worst service is also the one the happiness panel already names, so the two
   * agree about what is short.
   *
   * **Coverage in this game has no geometry**, and the overlay says what it can
   * rather than inventing some: `coverage` is `covered / housingPlots`, a share,
   * and `covered` is a plot *count* with nothing anywhere deciding which plots.
   * So the pads state which plots that number accounts for under the city's own
   * ordering — oldest land first, the same build order that decides which plot
   * the k-th house takes. Inventing a radius round each hospital would put a
   * number on screen that the services panel does not have.
   */
  private coveredPlots(state: Readonly<GameState>): number {
    let worst = Number.POSITIVE_INFINITY;
    for (const service of HAPPINESS_SERVICES) worst = Math.min(worst, covered(state, service));
    return Number.isFinite(worst) ? worst : 0;
  }

  /**
   * The colour of one plot, by mode.
   *
   * `zone` says which build list it came from, `index` is its position in that
   * list — which is its build order — and `built` is how many of that list the
   * city has built on. Shared by the pads below and, through `overlay`, by the
   * buildings, so the two halves of a mode cannot drift apart.
   */
  private plotColor(
    state: Readonly<GameState>,
    kind: ZoneKind,
    index: number,
    total: number,
    reading: OverlayReading,
    out: THREE.Color,
  ): THREE.Color {
    switch (this.mode) {
      case 'plan':
        return out.setHex(ZONE_HEX[kind]);
      case 'demand':
        return this.demandColor(
          kind === 'home' ? state.demandR : kind === 'shop' ? state.demandC : state.demandI,
          out,
        );
      case 'value': {
        // Housing only, and that is not a simplification: `landValue` multiplies
        // *rent*, and rent is paid by residents. A shop's plot has a centrality
        // and the ledger has never read it.
        if (kind !== 'home') return out.setHex(PALETTE.overlayMute);
        const at = housingCentrality(index, state);
        const span = reading.valueMax - reading.valueMin;
        return ramp(span > 1e-6 ? (at - reading.valueMin) / span : 0.5, out);
      }
      case 'coverage':
        if (kind !== 'home') return out.setHex(PALETTE.overlayMute);
        return index < reading.covered ? ramp(1, out) : ramp(0, out);
      case 'order':
        // Within its own list, so a young district's shops read as new even
        // though the city has far more housing than commerce.
        return ramp(total > 1 ? 1 - index / (total - 1) : 1, out);
      case 'traffic':
        // The streets carry it. A plot has no traffic reading of its own — road
        // supply does not vary between districts, so congestion is a city-wide
        // scalar and a per-plot tint would be a fabrication. See `congestion`.
        return out.setHex(PALETTE.overlayMute);
      default:
        return out.setHex(PALETTE.overlayMute);
    }
  }

  /** Everything a mode reads that is not per-plot, gathered once per rebuild. */
  private read(state: Readonly<GameState>): OverlayReading {
    const homes = this.layout.zoneCells(ZONE.residential).length;
    let valueMin = Number.POSITIVE_INFINITY;
    let valueMax = Number.NEGATIVE_INFINITY;
    if (this.mode === 'value') {
      // One pass over the housing plots so the ramp uses its whole range: the
      // raw centralities sit in a narrow band and a ramp over [0, 1] would draw
      // the whole city one colour.
      for (let i = 0; i < homes; i++) {
        const at = housingCentrality(i, state);
        if (at < valueMin) valueMin = at;
        if (at > valueMax) valueMax = at;
      }
    }
    return {
      covered: this.coveredPlots(state),
      congestion: congestion(state),
      valueMin: Number.isFinite(valueMin) ? valueMin : 0,
      valueMax: Number.isFinite(valueMax) ? valueMax : 1,
    };
  }

  /**
   * A per-slot colour for the buildings, or null when the mode has nothing to
   * say about built land.
   *
   * Built once per rebuild and handed to `Buildings.setOverlay`, which walks it
   * over every instance. `plan` and `demand` are the two that do not vary by
   * slot — a building's zone is the whole of what they state — so they come
   * back as a constant per zone and cost nothing.
   */
  overlay(state: Readonly<GameState>): OverlaySource | null {
    if (this.mode === 'off') return null;
    // The plot lists and the parcel books have to exist before a slot can be
    // resolved to a plot. `sync` does this too; a mode change can land between
    // two syncs, so it is done here as well rather than assumed.
    this.layout.ensure(state);
    const reading = this.read(state);
    const scratch = new THREE.Color();
    const totals: Record<ZoneKind, number> = {
      home: this.layout.zoneCells(ZONE.residential).length,
      shop: this.layout.zoneCells(ZONE.commercial).length,
      industry: this.layout.zoneCells(ZONE.industrial).length,
    };
    const merged: Record<ZoneKind, number> = {
      home: state.mergedR,
      shop: state.mergedC,
      industry: state.mergedI,
    };
    const at = createPlacement();
    return (kind, slot) => {
      // The plot a slot stands on, which is not the slot: merged parcels are
      // the front of the list and take two plots each. `place` is the same call
      // the inspector makes, so the card and the overlay agree about the land.
      const plot =
        this.mode === 'value' || this.mode === 'coverage' || this.mode === 'order'
          ? this.layout.place(zoneOf(kind), slot, merged[kind], state, at).plot
          : slot;
      return this.plotColor(state, kind, plot, totals[kind], reading, scratch).getHex();
    };
  }

  /**
   * Rebuilds the pads if anything they draw from has moved.
   *
   * Returns whether it rebuilt, so the caller knows to re-colour the buildings:
   * four of the six modes vary per building, so a rebuild here is a rebuild
   * there and one stamp decides both.
   */
  sync(state: Readonly<GameState>): boolean {
    if (this.mode === 'off') return false;
    if (this.mode === 'traffic') return this.syncStreets(state);

    const counts = `${state.districts}:${state.homes}:${state.shops}:${state.industry}`;
    // The stamp covers whatever the *mode* reads, which is the rule this had to
    // grow into: a mode that read a number the stamp did not carry would paint
    // once and then never notice it had changed.
    const extra =
      this.mode === 'demand'
        ? `${quantise(state.demandR)}:${quantise(state.demandC)}:${quantise(state.demandI)}`
        : this.mode === 'coverage'
          ? `${Math.round(this.coveredPlots(state))}`
          : this.mode === 'value'
            ? `${state.mergedR}`
            : `${state.mergedR}:${state.mergedC}:${state.mergedI}`;
    const stamp = `${this.mode}:${counts}:${extra}`;
    if (stamp === this.stamp) return false;
    this.stamp = stamp;
    this.layout.ensure(state);
    this.streets.count = 0;

    const residential = this.layout.zoneCells(ZONE.residential);
    const commercial = this.layout.zoneCells(ZONE.commercial);
    const industrial = this.layout.zoneCells(ZONE.industrial);
    const reading = this.read(state);

    // Built plots are the *front* of each zone's build order, so "unbuilt" is
    // simply the tail past the count the simulation reports. Civic sites were
    // taken out of these lists before the city ever saw them, so there is no
    // longer a second run at the far end to work around.
    //
    // The pads stop at the unbuilt land in every mode, including the four that
    // are about built land as well. A pad under a building is a pad nobody can
    // see: the built half is carried by the building bodies instead, which is
    // what `overlay` above is for.
    const homes = Math.min(state.homes, residential.length);
    const shops = Math.min(state.shops, commercial.length);
    const industry = Math.min(state.industry, industrial.length);
    const total =
      (residential.length - homes) + (commercial.length - shops) + (industrial.length - industry);
    this.pads.ensure(total);

    let n = 0;
    const write = (cells: readonly Coord[], kind: ZoneKind, from: number): void => {
      for (let i = from; i < cells.length; i++) {
        const cell = cells[i] as Coord;
        this.plotColor(state, kind, i, cells.length, reading, this.tint);
        this.dummy.position.set(worldX(cell.x), PAD_Y, worldZ(cell.z));
        this.dummy.updateMatrix();
        this.pads.setMatrixAt(n, this.dummy.matrix);
        this.pads.setColorAt(n, this.tint);
        n++;
      }
    };

    write(residential, 'home', homes);
    write(commercial, 'shop', shops);
    write(industrial, 'industry', industry);

    this.pads.count = n;
    this.drawn = n;
    this.pads.flush();
    return true;
  }

  /**
   * The traffic mode: every road cell, tinted by the one congestion number.
   *
   * The roads follow the district count and nothing else, so this rebuilds when
   * the city annexes and when the number moves and at no other time — where the
   * plot pads rebuild whenever a building goes up. Two stamps, two meshes.
   */
  private syncStreets(state: Readonly<GameState>): boolean {
    const jam = congestion(state);
    const stamp = `${state.districts}:${Math.round(jam * 100)}`;
    if (stamp === this.roadStamp) return false;
    this.roadStamp = stamp;
    this.layout.ensure(state);
    this.pads.count = 0;

    let n = 0;
    for (const district of this.layout.districts) n += district.roads.length;
    this.streets.ensure(n);
    ramp(jam, this.tint);

    let at = 0;
    for (const district of this.layout.districts) {
      for (const cell of district.roads as readonly Coord[]) {
        this.dummy.position.set(worldX(cell.x), ROAD_PAD_Y, worldZ(cell.z));
        this.dummy.updateMatrix();
        this.streets.setMatrixAt(at, this.dummy.matrix);
        this.streets.setColorAt(at, this.tint);
        at++;
      }
    }
    this.streets.count = at;
    this.drawn = at;
    this.streets.flush();
    return true;
  }
}
