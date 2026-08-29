import * as THREE from 'three';
import { MAX_ACTIVE_FIRES } from '../sim/config.ts';
import { GrowableInstancedMesh } from './growable.ts';
import { PALETTE } from './palette.ts';

/**
 * How long a building takes to come down, in seconds.
 *
 * The plot is empty for exactly this long before the rebuild animation starts,
 * so it is also how long the city is visibly one building short. Long enough to
 * read as a collapse rather than a pop, short enough that a player watching a
 * fire does not go and do something else.
 */
export const COLLAPSE_SECONDS = 0.85;

/**
 * What is left standing when it is over, as a share of the building's height.
 *
 * Not zero. A demolished building leaves a heap, and a heap that shrank to
 * nothing would read as the building being deleted rather than falling down —
 * which is precisely the thing this animation exists to stop being true.
 */
const RUBBLE = 0.16;

/** How far the heap spreads past the footprint it fell from. */
const SPREAD = 1.32;

/** How far the dust reaches, and how high it climbs, against the footprint. */
const DUST_SPREAD = 2.3;
const DUST_RISE = 0.55;

/**
 * When the dust is at its widest, as a share of the collapse.
 *
 * Well before the end, because dust is thrown outward by the fall and then
 * settles — a cloud still growing when the rubble has stopped moving reads as
 * an explosion rather than as a demolition.
 */
const DUST_PEAK = 0.42;

/**
 * A building coming down: the heap, and the dust it throws.
 *
 * Falling accelerates, so the height curve is `t^2` — and it is worth being
 * explicit that this is *not* `easeOutBack`, which is what `GrowthSchedule`
 * runs. That curve overshoots its target and comes back, which is right for
 * something being built and exactly wrong for something falling over: a
 * building that bounced back up past its own rubble would be a spring, not a
 * collapse. The spread runs the other way, `1 - (1-t)^2`, because the debris
 * leaves fastest at the moment of impact and then stops.
 */
const fall = (t: number): number => 1 - t * t;
const spread = (t: number): number => 1 - (1 - t) * (1 - t);

/** One building on its way down. Position and shape, captured, never a slot. */
interface Falling {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  /** Renderer clock at which it started. -1 for an unused entry. */
  at: number;
}

/**
 * Buildings falling down, and nothing else.
 *
 * Two instances a collapse out of one mesh — the heap and the dust around it —
 * and one draw call, hidden on every frame nothing is falling.
 *
 * What matters most about this class is what it does *not* hold: a slot. Every
 * entry is a world position and a set of dimensions, captured at the instant
 * the fire ended and never looked up again. That is the whole answer to the
 * renumbering problem `Buildings.stage` documents — a merge, an abandonment and
 * a demolition landing in the same tick renumber every slot above the one that
 * moved, and an animation keyed to a slot would then play on the wrong
 * building. This one cannot, because by the time it is running the building it
 * is standing in for is already gone from the simulation and the animation is
 * the only thing that still knows where it was.
 *
 * Bounded by MAX_ACTIVE_FIRES, and that bound is exact rather than generous:
 * `resolveFires` is the only thing that destroys a building, it can end at most
 * the fires that exist, and there are at most six of those. A twelve-hour
 * catch-up is capped at CATCHUP_MAX_LOSSES = 1 loss however long the absence,
 * so there is no wave case here at all — which is why this needs nothing like
 * WAVE_BUDGET and why the pool is a fixed six.
 */
export class Collapse {
  private readonly mesh: GrowableInstancedMesh;
  private readonly falling: Falling[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly tint = new THREE.Color();
  private shown = 0;

  constructor(scene: THREE.Scene) {
    this.mesh = new GrowableInstancedMesh(
      scene,
      new THREE.BoxGeometry(1, 1, 1),
      // Lambert rather than basic, so a heap goes through the day with the city
      // it fell out of: at dusk the rubble is the same value as the pavement
      // around it, which is what stops it reading as a pale box on a dark map.
      new THREE.MeshLambertMaterial({ color: PALETTE.concrete }),
      // Two instances each: the heap and the dust. No shadow — a heap 0.16 of a
      // building high, standing for under a second, does not earn a place in a
      // pass that is already the most expensive thing on the frame.
      MAX_ACTIVE_FIRES * 2,
      { name: 'collapse:rubble' },
    );
    this.mesh.mesh.visible = false;
    for (let i = 0; i < MAX_ACTIVE_FIRES; i++) {
      this.falling.push({ x: 0, z: 0, width: 0, depth: 0, height: 0, at: -1 });
    }
  }

  // No `setBounds`, and therefore no frustum test, which is a departure from
  // every other mesh in the renderer and is cheaper than the alternative here.
  // The mesh holds at most twelve instances and is hidden on all but a handful
  // of frames in a session, so the whole thing it could ever save is one draw
  // call on the rare frame a building falls down off screen. Stating bounds for
  // that would be a `setBounds` call every time a district is annexed, forever,
  // to save one draw call almost never.

  /**
   * Starts one, at a position rather than at a building.
   *
   * Silently drops the seventh, which cannot happen: the pool is
   * MAX_ACTIVE_FIRES and only a fire ending can call this. Written as a drop
   * rather than an assert because a renderer's answer to an impossible state is
   * a frame that is slightly wrong, never a thrown frame.
   */
  start(x: number, z: number, width: number, depth: number, height: number, now: number): void {
    const free = this.falling.find((one) => one.at < 0);
    if (!free) return;
    free.x = x;
    free.z = z;
    free.width = width;
    free.depth = depth;
    free.height = height;
    free.at = now;
  }

  /** Whether anything is falling. For the tests and the tools. */
  get standing(): number {
    return this.shown;
  }

  /**
   * Advances every heap and retires the ones that have finished.
   *
   * Rebuilt from scratch each frame, exactly as `Scaffold` is and for the same
   * reason: the list is only ever what this pass put in it, so a collapse comes
   * down by not being written rather than by something coming back to remove
   * it. Free when nothing is falling.
   */
  update(now: number): boolean {
    let at = 0;
    for (const one of this.falling) {
      if (one.at < 0) continue;
      const t = (now - one.at) / COLLAPSE_SECONDS;
      if (t >= 1) {
        one.at = -1;
        continue;
      }
      const age = Math.max(0, t);

      // The heap: down fast, out slowly, and it stops at RUBBLE rather than at
      // nothing.
      const height = one.height * (RUBBLE + (1 - RUBBLE) * fall(age));
      const out = 1 + (SPREAD - 1) * spread(age);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.position.set(one.x, height / 2, one.z);
      this.dummy.scale.set(one.width * out, height, one.depth * out);
      this.dummy.updateMatrix();
      this.mesh.ensure(at + 1);
      this.mesh.setMatrixAt(at, this.dummy.matrix);
      this.mesh.setColorAt(at, this.tint.setRGB(0.72, 0.7, 0.66));
      at++;

      // The dust: out past the heap, up a little, and back to nothing.
      //
      // It fades by *shrinking* rather than by opacity, and that is a
      // constraint rather than a preference: a material's opacity is shared by
      // every instance drawn from it, so six heaps at six different ages would
      // all fade at whichever one wrote last. Shrinking is per-instance, so it
      // is per-collapse, and a cloud that expands and then draws back into the
      // ground is what dust settling looks like anyway.
      const puff = age < DUST_PEAK ? age / DUST_PEAK : 1 - (age - DUST_PEAK) / (1 - DUST_PEAK);
      if (puff > 0.02) {
        const reach = 1 + (DUST_SPREAD - 1) * spread(Math.min(1, age / DUST_PEAK));
        const tall = one.height * DUST_RISE * puff;
        this.dummy.position.set(one.x, tall / 2, one.z);
        this.dummy.scale.set(one.width * reach * puff, tall, one.depth * reach * puff);
        this.dummy.updateMatrix();
        this.mesh.ensure(at + 1);
        this.mesh.setMatrixAt(at, this.dummy.matrix);
        // Paler than the heap and paler still as it thins, so it reads as air
        // rather than as a second slab of concrete.
        const pale = 0.86 + 0.14 * (1 - puff);
        this.mesh.setColorAt(at, this.tint.setRGB(pale, pale, pale * 0.97));
        at++;
      }
    }

    if (at === 0 && this.shown === 0) return false;
    this.mesh.count = at;
    this.mesh.mesh.visible = at > 0;
    this.mesh.flush();
    this.shown = at;
    return at > 0;
  }

  /** Drops everything in flight. What a `reset` or an ascension leaves behind. */
  clear(): void {
    for (const one of this.falling) one.at = -1;
  }
}
