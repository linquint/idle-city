import * as THREE from 'three';

/**
 * A shared material whose brightness rides the day/night phase.
 *
 * Per *material*, never per instance. A city's lit surfaces — every shop
 * fascia, every beacon, every bay door — are thousands of instances sharing a
 * handful of materials, and ramping them individually would mark the instance
 * colour buffer dirty on every frame of the cycle, which is a full re-upload
 * sixty times a second for a change one colour can make. This is one multiply
 * per material per frame instead, and the instance buffers are never touched.
 *
 * The floor is what stops a lit sign from switching off at noon: a sodium band
 * in daylight is still a painted orange band, just not a light source.
 */
export class Glow {
  readonly material: THREE.MeshBasicMaterial;
  private readonly base = new THREE.Color();

  constructor(
    hex: number,
    private readonly floor: number,
  ) {
    this.material = new THREE.MeshBasicMaterial({ color: hex });
    this.base.setHex(hex);
  }

  setNight(night: number): void {
    const k = this.floor + (1 - this.floor) * Math.max(0, Math.min(1, night));
    this.material.color.copy(this.base).multiplyScalar(k);
  }
}
