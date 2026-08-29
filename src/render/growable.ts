import * as THREE from 'three';

export interface GrowableOptions {
  /**
   * Whether the mesh joins the shadow pass.
   *
   * Mutable, unlike the rest of this, because a shadow-quality step turns it
   * off for the dressing — see `setCastShadow`. Kept here rather than only on
   * the mesh so a reallocation reapplies whatever it was last set to: `build`
   * makes a *new* `InstancedMesh` and a flag that lived only on the old one
   * would silently come back on the first time a district was annexed.
   */
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: number;
  /**
   * Scene-graph name, reapplied across a reallocation.
   *
   * Set where a mesh is worth finding again from outside: the browser's scene
   * inspector, and the tests, which check the building layer as a black box by
   * walking the scene rather than by reaching into its privates.
   */
  name?: string;
}

/**
 * An InstancedMesh whose capacity can grow.
 *
 * three sizes an InstancedMesh once, at construction, but this city keeps
 * annexing land. Reallocating copies the existing instance buffers into a
 * larger pair and swaps the mesh in place, so buildings never flicker or move
 * across a resize. Doubling keeps reallocation amortised to O(1) per instance.
 */
export class GrowableInstancedMesh {
  mesh: THREE.InstancedMesh;

  /**
   * What this mesh covers, stated rather than derived. Null leaves the frustum
   * test off, which is the default. See `setBounds`.
   */
  private bounds: THREE.Sphere | null = null;

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly geometry: THREE.BufferGeometry,
    private readonly material: THREE.Material,
    capacity: number,
    private readonly options: GrowableOptions = {},
  ) {
    this.mesh = this.build(Math.max(1, capacity));
  }

  private build(capacity: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    mesh.castShadow = this.options.castShadow ?? false;
    mesh.receiveShadow = this.options.receiveShadow ?? false;
    mesh.renderOrder = this.options.renderOrder ?? 0;
    mesh.name = this.options.name ?? '';
    // Off until someone says what the mesh covers — see `setBounds`, which is
    // what turns it on. The default has to be off rather than on: three derives
    // an InstancedMesh's bounds by walking every instance matrix, caches the
    // answer and never looks again, so a mesh that grew or animated after its
    // first frustum test would be culled against where it used to be. A
    // building that vanishes when the camera turns is a worse bug than a draw
    // call that was never worth saving.
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.parent.add(mesh);
    this.applyBounds(mesh);
    return mesh;
  }

  /**
   * States what this mesh covers, and turns the frustum test on.
   *
   * Stated rather than computed, and that is the whole of the stale-bounds
   * answer. `InstancedMesh.computeBoundingSphere` is O(instances) and three
   * caches it forever, so the two honest options were "recompute every frame
   * anything is growing" — nine thousand matrix decompositions a frame on the
   * pavement mesh alone — or "say what it covers". The renderer already knows:
   * the city's extent is `cityRadius(state.districts)`, which moves only when
   * land is annexed. Asking three to rediscover it from the instance buffer is
   * paying a great deal to learn something the simulation states directly.
   *
   * It must over-estimate rather than under-estimate. The sphere is also what
   * `InstancedMesh.raycast` broad-phases against, so bounds tighter than the
   * truth would drop clicks on the buildings outside them.
   *
   * Re-applied across a reallocation, because `build` makes a new mesh and the
   * old one's bounds would go with it.
   *
   * @param x      centre of the covered ground, world space
   * @param z      centre of the covered ground, world space
   * @param reach  how far from that centre the instances can stand
   * @param top    the highest an instance reaches
   * @param bottom the lowest one reaches. Not always 0 — a district rises in
   *               from LIFT below grade, and a sphere that did not cover the
   *               approach would cull the land tile on the frame it is bought.
   */
  setBounds(x: number, z: number, reach: number, top: number, bottom = 0): void {
    const half = (top - bottom) / 2;
    this.bounds = new THREE.Sphere(
      new THREE.Vector3(x, bottom + half, z),
      Math.hypot(reach, half),
    );
    this.applyBounds(this.mesh);
  }

  private applyBounds(mesh: THREE.InstancedMesh): void {
    if (!this.bounds) return;
    mesh.boundingSphere = this.bounds;
    mesh.frustumCulled = true;
  }

  /**
   * Puts the mesh in or out of the shadow pass, under the running game.
   *
   * Written to the options as well as to the mesh, for the reason the option's
   * own comment gives: `ensure` rebuilds the mesh and reads the options back.
   */
  setCastShadow(on: boolean): void {
    this.options.castShadow = on;
    this.mesh.castShadow = on;
  }

  get capacity(): number {
    return this.mesh.instanceMatrix.count;
  }

  get count(): number {
    return this.mesh.count;
  }

  set count(n: number) {
    this.mesh.count = Math.min(n, this.capacity);
  }

  /** Guarantees room for `needed` instances, preserving everything written. */
  ensure(needed: number): void {
    if (needed <= this.capacity) return;

    let capacity = Math.max(1, this.capacity);
    while (capacity < needed) capacity *= 2;

    const next = this.build(capacity);
    next.instanceMatrix.array.set(this.mesh.instanceMatrix.array);
    next.instanceMatrix.needsUpdate = true;

    const colors = this.mesh.instanceColor;
    if (colors) {
      next.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      next.instanceColor.array.set(colors.array);
      next.instanceColor.needsUpdate = true;
    }
    next.count = this.mesh.count;

    this.parent.remove(this.mesh);
    this.mesh.dispose();
    this.mesh = next;
  }

  setMatrixAt(index: number, matrix: THREE.Matrix4): void {
    this.mesh.setMatrixAt(index, matrix);
  }

  setColorAt(index: number, color: THREE.Color): void {
    this.mesh.setColorAt(index, color);
  }

  /** Marks the instance buffers dirty. Call once per frame, not per instance. */
  flush(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.parent.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * The map back from a raycast hit to the building it hit.
 *
 * `Raycaster` hands an `InstancedMesh` intersection an `instanceId`, which is a
 * position in that mesh's own instance buffer and nothing else. Every mesh in
 * the building layer draws one contiguous run of slots — a level's cohort, or a
 * whole zone from slot zero — so the map back is a single addition, and the
 * only thing worth keeping is where each mesh's run starts.
 *
 * It lives beside `GrowableInstancedMesh` because the ranges are its ranges: a
 * mesh that reallocates swaps its `THREE.InstancedMesh` out from under the
 * scene graph, so a table keyed on the three.js object would silently go stale
 * the first time a district was annexed. Keyed on the wrapper, it cannot.
 */
export class SlotRanges<T> {
  private readonly entries: Array<{ mesh: GrowableInstancedMesh; tag: T; from: number }> = [];
  /** Reused by `targets`, which is called once per click and never per frame. */
  private readonly scratch: THREE.Object3D[] = [];

  /** Says that `mesh` draws the slots starting at `from`, tagged with `tag`. */
  set(mesh: GrowableInstancedMesh, tag: T, from: number): void {
    const found = this.entries.find((entry) => entry.mesh === mesh);
    if (found) {
      found.tag = tag;
      found.from = from;
      return;
    }
    this.entries.push({ mesh, tag, from });
  }

  /** Every mesh with something in it, for `Raycaster.intersectObjects`. */
  targets(): THREE.Object3D[] {
    this.scratch.length = 0;
    for (const entry of this.entries) {
      if (entry.mesh.count > 0) this.scratch.push(entry.mesh.mesh);
    }
    return this.scratch;
  }

  /** The slot an intersection stands for, or null if the mesh is not ours. */
  resolve(object: THREE.Object3D, instanceId: number): { tag: T; slot: number } | null {
    for (const entry of this.entries) {
      if (entry.mesh.mesh !== object) continue;
      if (instanceId < 0 || instanceId >= entry.mesh.count) return null;
      return { tag: entry.tag, slot: entry.from + instanceId };
    }
    return null;
  }
}
