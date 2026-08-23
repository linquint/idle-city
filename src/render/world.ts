import * as THREE from 'three';
import { PALETTE } from './palette';

const SHADOW_SPAN = 150;
const LIGHT_DIR = new THREE.Vector3(0.62, 0.78, 0.38).normalize();

/**
 * Scene, camera, renderer and the dusk lighting rig.
 *
 * The one interesting bit is the shadow frustum. A city that grows to 700 world
 * units across cannot be covered by a single 2048px shadow map without shadows
 * turning to mush, so the map covers a fixed span that follows the camera's
 * focus instead. Texel density stays constant no matter how far the city spreads.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly key: THREE.DirectionalLight;

  private readonly shadowFocus = new THREE.Vector3(NaN, NaN, NaN);
  private radius = 100;
  private fogDistance = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(PALETTE.ink);
    this.scene.fog = new THREE.Fog(PALETTE.ink, 110, 240);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1200);

    // One low warm key for the sodium cast, one cold hemisphere fill for the
    // sky. Two lights is all a Lambert city needs to read as dusk.
    this.key = new THREE.DirectionalLight(0xffce96, 2.1);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0007;
    this.key.shadow.normalBias = 0.02;
    const cam = this.key.shadow.camera;
    cam.near = 1;
    cam.far = 520;
    this.scene.add(this.key, this.key.target);
    this.scene.add(new THREE.HemisphereLight(0x5e7fa8, PALETTE.ink, 1.15));

    this.resize();
  }

  /** Re-frames depth for a city of the given radius. */
  fit(radius: number): void {
    this.radius = radius;
    this.camera.far = radius * 8 + 600;
    this.camera.updateProjectionMatrix();
    this.fogDistance = -1;
  }

  /**
   * Fog depths are distances from the *camera*, not from the world origin, so
   * they have to follow the orbit as well as the size of the city. Fitting them
   * to the city radius alone puts the whole place behind the far plane the
   * moment the player zooms out.
   */
  updateFog(distance: number): void {
    if (Math.abs(distance - this.fogDistance) < 0.5) return;
    this.fogDistance = distance;
    const fog = this.scene.fog as THREE.Fog;
    fog.near = distance * 0.8;
    fog.far = distance + this.radius * 2.6 + 80;
  }

  /**
   * Points the shadow frustum at what the player is looking at. Snapping to a
   * grid the size of one shadow texel is what stops the shadows from crawling
   * as the camera drifts.
   */
  focusShadows(target: THREE.Vector3): void {
    // Room for the city *and* the shadows it throws past its own edge.
    const span = Math.min(SHADOW_SPAN, this.radius + 34);
    const texel = (span * 2) / this.key.shadow.mapSize.x;
    const x = Math.round(target.x / texel) * texel;
    const z = Math.round(target.z / texel) * texel;
    if (this.shadowFocus.x === x && this.shadowFocus.z === z) return;
    this.shadowFocus.set(x, 0, z);

    this.key.target.position.set(x, 0, z);
    this.key.target.updateMatrixWorld();
    this.key.position.copy(LIGHT_DIR).multiplyScalar(240).add(this.key.target.position);

    const cam = this.key.shadow.camera;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.updateProjectionMatrix();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
