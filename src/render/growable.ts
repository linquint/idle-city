import * as THREE from 'three';

export interface GrowableOptions {
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
    // The city is always the thing on screen, so a per-object frustum test can
    // only ever cost us. Skipping it also avoids stale bounds, since instance
    // matrices change every frame that anything is still growing.
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.parent.add(mesh);
    return mesh;
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
