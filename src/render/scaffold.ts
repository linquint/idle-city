import * as THREE from 'three';
import { GrowableInstancedMesh } from './growable.ts';
import { PALETTE } from './palette.ts';

/**
 * How far the cage stands out from the body it wraps, per side, in world units.
 *
 * Constant rather than a share of the footprint, because a scaffold is: the
 * boards are the same width around a bungalow and around a tower. It is applied
 * to the *instance scale* rather than baked into the geometry for that reason —
 * a padded unit cage would put a proportional gap around a merged parcel and a
 * hairline one around a corner shop.
 *
 * 0.16 against a CELL of 4 and a widest body of 3.92: the very widest buildings
 * put their cage a hand's width over the kerb, which is what a scaffold does,
 * and it is standing there for half a second.
 */
const PAD = 0.16;

/**
 * How far the cage rises above the finished roofline, in world units.
 *
 * There has to be some. `easeOutBack` overshoots — the body passes 1 and comes
 * back — so a cage sized to the nominal height would have the building push
 * through its own top boards on the last few frames of every animation.
 */
const HEAD = 0.55;

/** Corner uprights: how thick, as a share of the cage's own footprint. */
const POLE = 0.055;

/**
 * Lifts — the working platforms — and how thick each is as a share of the
 * cage's height.
 *
 * A share, and this is the one place the unit-geometry trick shows its edges:
 * the whole bank of building parts is a unit shape carrying an instance scale,
 * so a horizontal bar's *thickness* scales with the building's height along
 * with everything else. A fixed count of lifts is what makes that read rather
 * than break. On a detached house the five bands are 0.03 thick and 0.4 apart
 * and the cage reads as netting; on an arcology they are 0.53 thick and 7.6
 * apart and read as decks. Both are what a scaffold at that scale looks like.
 *
 * The alternative — constant-thickness rails — needs a second instance matrix
 * per building and therefore a second mesh, which is a second draw call for
 * something that is on screen for half a second.
 */
const LIFTS = 5;
const LIFT_THICK = 0.014;
/** How far a lift's rail stands proud of the pole line, as a share of the span. */
const RAIL = 0.03;

/** One axis-aligned box in the unit cage's own space. */
interface Bar {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
}

/**
 * The unit cage: four uprights and five lifts, in one geometry.
 *
 * x and z run [-0.5, 0.5] and y runs [0, 1], so an instance scale of the
 * padded footprint by the padded height stands the cage on the ground around
 * the building — the same contract every shape in `PartBank` is built to.
 */
function bars(): Bar[] {
  const out: Bar[] = [];
  for (const sx of [-0.5, 0.5]) {
    for (const sz of [-0.5, 0.5]) {
      out.push({ x: sx, y: 0.5, z: sz, sx: POLE, sy: 1, sz: POLE });
    }
  }
  for (let lift = 1; lift <= LIFTS; lift++) {
    const y = lift / LIFTS;
    // The two long rails span the poles, the two short ones sit between them,
    // so the four meet at the corners rather than crossing through each other.
    out.push({ x: 0, y, z: -0.5, sx: 1 + POLE, sy: LIFT_THICK, sz: RAIL });
    out.push({ x: 0, y, z: 0.5, sx: 1 + POLE, sy: LIFT_THICK, sz: RAIL });
    out.push({ x: -0.5, y, z: 0, sx: RAIL, sy: LIFT_THICK, sz: 1 - POLE });
    out.push({ x: 0.5, y, z: 0, sx: RAIL, sy: LIFT_THICK, sz: 1 - POLE });
  }
  return out;
}

/**
 * The bars, merged into one buffer.
 *
 * Hand-rolled rather than `BufferGeometryUtils.mergeGeometries`. The reason
 * given here when this was written — that the addon would be a second entry
 * point into the biggest dependency in the bundle for twenty lines of
 * arithmetic — stopped being true on the merge that brought the composed civic
 * models: `model.ts` imports it, so it is in the bundle either way and this
 * could now use it. It has not been changed, because a merge is the wrong
 * commit to simplify working code in, and the note is left rather than the
 * stale reason.
 *
 * What still holds is why it is *correct*: every bar is an axis-aligned box
 * scaled by positive factors, so a vertex is an affine map and a *normal* is
 * unchanged — box normals are the six axis directions and a positive axis scale
 * leaves each one pointing where it did.
 */
function cageGeometry(): THREE.BufferGeometry {
  const unit = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const src = unit.getAttribute('position').array;
  const srcNormal = unit.getAttribute('normal').array;
  const stride = src.length;
  const list = bars();
  const position = new Float32Array(stride * list.length);
  const normal = new Float32Array(stride * list.length);
  list.forEach((bar, index) => {
    const at = index * stride;
    for (let i = 0; i < stride; i += 3) {
      position[at + i] = (src[i] ?? 0) * bar.sx + bar.x;
      position[at + i + 1] = (src[i + 1] ?? 0) * bar.sy + bar.y;
      position[at + i + 2] = (src[i + 2] ?? 0) * bar.sz + bar.z;
      normal[at + i] = srcNormal[i] ?? 0;
      normal[at + i + 1] = srcNormal[i + 1] ?? 0;
      normal[at + i + 2] = srcNormal[i + 2] ?? 0;
    }
  });
  unit.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  return geometry;
}

/**
 * Cages around whatever is mid-growth, and nothing else.
 *
 * One mesh, one draw call, and it is hidden on every frame the city is settled
 * — which is nearly all of them. What makes that affordable is that the list is
 * rebuilt from scratch every frame rather than reconciled: `GrowthSchedule`
 * already holds exactly the in-flight instances in a `Set`, so the work is
 * proportional to what is moving and not to the size of the city, and a cage
 * comes down by simply not being written on the frame its building finishes.
 *
 * That is also why it is not a tenth entry in `PartBank`. The bank is packed
 * once per repack and `partAt` maps a building's slot to the instance each of
 * its pieces landed on; a list that renumbers itself every frame cannot live
 * inside that without invalidating the map for every other part. It is a part
 * in every other sense — a unit shape wearing an instance scale, shared by all
 * three zones and every level.
 */
export class Scaffold {
  private readonly mesh: GrowableInstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private at = 0;
  /** What the mesh drew last frame, so a settled city uploads nothing. */
  private shown = 0;

  /**
   * @param capacity How many cages can stand at once. See `WAVE_BUDGET`: a
   *                 zone caps one wave at that many animations and there are
   *                 three zones, so the bound is three waves landing on the
   *                 same frame — not the size of the city, which is the whole
   *                 point of staging a backlog rather than popping it.
   */
  constructor(scene: THREE.Scene, capacity: number) {
    this.mesh = new GrowableInstancedMesh(
      scene,
      cageGeometry(),
      new THREE.MeshLambertMaterial({ color: PALETTE.scaffold }),
      capacity,
      // No shadow, and it is a measured decision rather than an oversight. The
      // shadow map covers SHADOW_SPAN = 150 world units at 2048px, which is
      // 0.073 units a texel; a pole is 0.16 across, so a cage would cast about
      // two texels of lattice and read as noise on the pavement rather than as
      // scaffolding. Skipping it halves what the cage costs — the shadow pass
      // resubmits every casting mesh — for something nobody could point at.
      { castShadow: false, name: 'part:scaffold' },
    );
    this.mesh.mesh.visible = false;
  }

  /** States what the cages cover, so the mesh can be frustum-culled. */
  setBounds(x: number, z: number, reach: number, top: number): void {
    this.mesh.setBounds(x, z, reach, top + HEAD);
  }

  /** Starts a frame's list. Everything standing last frame is forgotten. */
  begin(): void {
    this.at = 0;
  }

  /**
   * One cage, around a building of this footprint standing at this height.
   *
   * `height` is the building's *finished* height rather than the height it has
   * reached this frame, and that is the read: the scaffold goes up first and
   * the building rises inside it, which is both what happens on a site and the
   * more useful signal — the cage says how tall the thing is going to be.
   */
  add(x: number, z: number, width: number, depth: number, height: number): void {
    this.mesh.ensure(this.at + 1);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.position.set(x, 0, z);
    this.dummy.scale.set(width + PAD * 2, height + HEAD, depth + PAD * 2);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(this.at, this.dummy.matrix);
    this.at++;
  }

  /**
   * Closes the frame's list.
   *
   * The upload is conditional for the reason `FpsMeter`'s DOM write is: this
   * runs every frame whether or not anything is growing, and marking an
   * instance buffer dirty on a frame where nothing was written would hand the
   * driver a pointless copy sixty times a second forever. The mesh is hidden
   * rather than left at zero instances, so a settled city pays no draw call at
   * all for having the feature.
   */
  end(): void {
    if (this.at === 0 && this.shown === 0) return;
    this.mesh.count = this.at;
    this.mesh.mesh.visible = this.at > 0;
    this.mesh.flush();
    this.shown = this.at;
  }

  /** Cages standing this frame. For the tests and the calibrators. */
  get standing(): number {
    return this.shown;
  }
}
