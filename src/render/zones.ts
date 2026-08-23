import * as THREE from 'three';
import { ZONE } from '../sim/citygen';
import { CELL } from '../sim/config';
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
  private on = false;
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
    return this.on;
  }

  /** Flips the overlay. The pads themselves are rebuilt by the next `sync`. */
  toggle(): boolean {
    this.on = !this.on;
    this.pads.mesh.visible = this.on;
    this.stamp = '';
    if (!this.on) this.pads.count = 0;
    return this.on;
  }

  sync(state: Readonly<GameState>): void {
    if (!this.on) return;
    const stamp = `${state.districts}:${state.homes}:${state.shops}`;
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    this.layout.ensure(state.districts);

    const residential = this.layout.zoneCells(ZONE.residential);
    const commercial = this.layout.zoneCells(ZONE.commercial);
    const industrial = this.layout.zoneCells(ZONE.industrial);

    // Built plots are the *front* of each zone's build order, so "unbuilt" is
    // simply the tail past the count the simulation reports.
    const homes = Math.min(state.homes, residential.length);
    const shops = Math.min(state.shops, commercial.length);
    const total =
      residential.length - homes + (commercial.length - shops) + industrial.length;
    this.pads.ensure(total);

    let n = 0;
    const write = (cells: readonly Coord[], from: number, hex: number): void => {
      this.tint.setHex(hex);
      for (let i = from; i < cells.length; i++) {
        const cell = cells[i] as Coord;
        this.dummy.position.set(worldX(cell.x), PAD_Y, worldZ(cell.z));
        this.dummy.updateMatrix();
        this.pads.setMatrixAt(n, this.dummy.matrix);
        this.pads.setColorAt(n, this.tint);
        n++;
      }
    };

    write(residential, homes, PALETTE.zoneResidential);
    write(commercial, shops, PALETTE.zoneCommercial);
    // No industrial building type exists yet, so every industrial plot is bare.
    write(industrial, 0, PALETTE.zoneIndustrial);

    this.pads.count = n;
    this.pads.flush();
  }
}
