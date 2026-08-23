import * as THREE from 'three';
import { ZONE } from '../sim/citygen';
import { CELL } from '../sim/config';
import { civicBuildings } from '../sim/economy';
import { worldX, worldZ, type CityLayout, type Coord } from '../sim/layout';
import type { GameState } from '../sim/state';
import { GrowableInstancedMesh } from './growable';
import { PALETTE } from './palette';

/** A gutter under the pad so plots read as plots rather than as a colour wash. */
const PAD = CELL - 0.8;
const PAD_H = 0.1;
/** The land tile's top face sits at y = 0; clear it rather than z-fight it. */
const PAD_Y = 0.06;

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
 * What the overlay is showing. `plan` is the zoning map; `demand` repaints the
 * same pads by how badly the city wants that type right now.
 */
export type ZoneMode = 'off' | 'plan' | 'demand';

const CYCLE: readonly ZoneMode[] = ['off', 'plan', 'demand'];

/**
 * The zone plan: every plot that is zoned but not yet built on, as a flat
 * coloured pad at ground level. One InstancedMesh, one draw call, and it only
 * rebuilds when the counts it draws from actually move.
 *
 * Unlit on purpose — an overlay that the key light rakes across is a worse
 * diagram than one that just states the colour.
 */
export class Zones {
  private readonly pads: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color();
  private readonly high = new THREE.Color(PALETTE.demandHigh);
  private readonly neutral = new THREE.Color(PALETTE.demandNeutral);
  private readonly low = new THREE.Color(PALETTE.demandLow);
  private mode: ZoneMode = 'off';
  /** What the pads were last built for. Empty forces a rebuild. */
  private stamp = '';

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
  }

  get enabled(): boolean {
    return this.mode !== 'off';
  }

  /** Steps to the next mode. The pads themselves are rebuilt by the next `sync`. */
  cycle(): ZoneMode {
    const next = CYCLE[(CYCLE.indexOf(this.mode) + 1) % CYCLE.length] as ZoneMode;
    this.mode = next;
    this.pads.mesh.visible = next !== 'off';
    this.stamp = '';
    if (next === 'off') this.pads.count = 0;
    return next;
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

  sync(state: Readonly<GameState>): void {
    if (this.mode === 'off') return;
    const civic = civicBuildings(state);
    const counts = `${state.districts}:${state.homes}:${state.shops}:${state.industry}:${civic}`;
    const stamp =
      this.mode === 'plan'
        ? `plan:${counts}`
        : `demand:${counts}:${quantise(state.demandR)}:${quantise(state.demandC)}:${quantise(state.demandI)}`;
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    this.layout.ensure(state.districts);

    const residential = this.layout.zoneCells(ZONE.residential);
    const commercial = this.layout.zoneCells(ZONE.commercial);
    const industrial = this.layout.zoneCells(ZONE.industrial);

    // Built plots are the *front* of each zone's build order, so "unbuilt" is
    // simply the tail past the count the simulation reports — except in the
    // residential zone, where civic buildings have taken the far end of it.
    const homes = Math.min(state.homes, residential.length);
    const civicFrom = Math.max(homes, residential.length - civic);
    const shops = Math.min(state.shops, commercial.length);
    const industry = Math.min(state.industry, industrial.length);
    const total =
      civicFrom - homes + (commercial.length - shops) + (industrial.length - industry);
    this.pads.ensure(total);

    let n = 0;
    const write = (cells: readonly Coord[], from: number, to: number, hex: number, d: number): void => {
      if (this.mode === 'plan') this.tint.setHex(hex);
      else this.demandColor(d, this.tint);
      for (let i = from; i < to; i++) {
        const cell = cells[i] as Coord;
        this.dummy.position.set(worldX(cell.x), PAD_Y, worldZ(cell.z));
        this.dummy.updateMatrix();
        this.pads.setMatrixAt(n, this.dummy.matrix);
        this.pads.setColorAt(n, this.tint);
        n++;
      }
    };

    write(residential, homes, civicFrom, PALETTE.zoneResidential, state.demandR);
    write(commercial, shops, commercial.length, PALETTE.zoneCommercial, state.demandC);
    write(industrial, industry, industrial.length, PALETTE.zoneIndustrial, state.demandI);

    this.pads.count = n;
    this.pads.flush();
  }
}
