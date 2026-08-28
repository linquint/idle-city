import * as THREE from 'three';
import type { SkyReading } from './daylight.ts';
import { PALETTE } from './palette.ts';

const SHADOW_SPAN = 150;

/**
 * Tallest thing the city can stand on a plot: an arcology at the top of its
 * height jitter, plus its roof. Only used to size the shadow frustum.
 */
const MAX_BUILDING_HEIGHT = 30;

/** Clearance between the light and the near face of the shadow box. */
const SHADOW_MARGIN = 60;

/**
 * Scene, camera, renderer and the lighting rig.
 *
 * Two interesting bits. The first is the shadow frustum: a city that grows to
 * 700 world units across cannot be covered by a single 2048px shadow map
 * without shadows turning to mush, so the map covers a fixed span that follows
 * the camera's focus instead. Texel density stays constant no matter how far
 * the city spreads.
 *
 * The second is that the sun moves. Nothing here decides when — the light
 * direction and the whole palette arrive from `setSky`, which the view samples
 * off the simulation's own clock. This class only has to keep the frustum
 * around a light that no longer sits still.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly key: THREE.DirectionalLight;

  private readonly hemi: THREE.HemisphereLight;
  private readonly backdrop = new THREE.Color(PALETTE.ink);
  private readonly haze = new THREE.Fog(PALETTE.ink, 110, 240);
  /** Direction *toward* the sun. Replaces what used to be a module constant. */
  private readonly lightDir = new THREE.Vector3(0.62, 0.78, 0.38).normalize();
  private sunMoved = true;

  private readonly shadowFocus = new THREE.Vector3(NaN, NaN, NaN);
  private radius = 100;
  private fogDistance = -1;

  /** The element the world is drawn into. Where a click's coordinates are measured from. */
  readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Held rather than looked up: both are re-tinted every frame by the cycle,
    // and `scene.background` is typed wide enough that reading it back would
    // need a cast on each one.
    this.scene.background = this.backdrop;
    this.scene.fog = this.haze;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1200);

    // One key for the sun, one hemisphere fill for the sky. Two lights is all a
    // Lambert city needs; what makes it read as a time of day is that both of
    // them change colour together.
    this.key = new THREE.DirectionalLight(0xffce96, 2.1);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0007;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.key, this.key.target);
    this.hemi = new THREE.HemisphereLight(0x5e7fa8, PALETTE.ink, 1.15);
    this.scene.add(this.hemi);

    this.resize();
  }

  /**
   * Applies one frame of the day/night cycle.
   *
   * Every write here is to a light, a colour or a scalar — never to an instance
   * buffer. Retinting the city's own lit surfaces per instance is what would
   * make a moving sun expensive, and nothing in this method touches one.
   */
  setSky(sky: Readonly<SkyReading>): void {
    this.key.color.setHex(sky.keyColor);
    this.key.intensity = sky.keyIntensity;
    this.hemi.color.setHex(sky.skyColor);
    this.hemi.groundColor.setHex(sky.groundColor);
    this.hemi.intensity = sky.hemiIntensity;
    this.backdrop.setHex(sky.background);
    this.haze.color.setHex(sky.background);

    if (this.lightDir.x === sky.dirX && this.lightDir.y === sky.dirY && this.lightDir.z === sky.dirZ) {
      return;
    }
    this.lightDir.set(sky.dirX, sky.dirY, sky.dirZ);
    this.sunMoved = true;
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
    const fog = this.haze;
    // Pushed out from `distance * 0.8` and `radius * 2.6 + 80`. Those depths
    // were set against a world that ended at the city's edge, where hazing the
    // near half of the frame cost nothing because there was nothing behind it.
    // With grassland running to the horizon the same numbers put a milky band
    // across the middle of every shot: the city itself was inside the fog.
    fog.near = distance * 0.95;
    // Never past the far plane, or the ground is clipped before it has finished
    // fading and the horizon becomes an edge instead of a haze.
    fog.far = Math.min(this.camera.far * 0.98, distance + this.radius * 4 + 400);
  }

  /**
   * Points the shadow frustum at what the player is looking at. Snapping to a
   * grid the size of one shadow texel is what stops the shadows from crawling
   * as the camera drifts.
   *
   * The early-out now has to consider the sun as well: the focus can sit still
   * for minutes while the light walks right across the sky, and a frustum that
   * only rebuilt when the camera moved would leave the shadows behind it.
   */
  focusShadows(target: THREE.Vector3): void {
    // Room for the city *and* the shadows it throws past its own edge.
    const span = Math.min(SHADOW_SPAN, this.radius + 34);
    const texel = (span * 2) / this.key.shadow.mapSize.x;
    const x = Math.round(target.x / texel) * texel;
    const z = Math.round(target.z / texel) * texel;
    if (!this.sunMoved && this.shadowFocus.x === x && this.shadowFocus.z === z) return;
    this.sunMoved = false;
    this.shadowFocus.set(x, 0, z);

    this.key.target.position.set(x, 0, z);
    this.key.target.updateMatrixWorld();

    // How far the shadow box reaches along the light's own axis. A high sun
    // foreshortens the ground span and picks up the buildings' height; a low
    // one does the reverse and stretches almost the full diagonal. Deriving
    // this rather than fixing near/far at a pair of numbers is what keeps an
    // 8-degree sun from clipping the far half of the district out of its own
    // shadow map: measured at span 150, reach runs from 126 units at noon to
    // 214 at the elevation clamp, against the fixed 240 the light used to sit
    // at with a near/far of 1/520.
    const flat = Math.hypot(this.lightDir.x, this.lightDir.z);
    const reach = span * Math.SQRT2 * flat + MAX_BUILDING_HEIGHT * Math.abs(this.lightDir.y);
    // Standing the light off by the reach plus a margin guarantees the whole
    // box is in front of it whatever the sun is doing. A directional light
    // shades from its direction alone, so moving it changes nothing but shadows.
    const distance = reach + SHADOW_MARGIN;
    this.key.position.copy(this.lightDir).multiplyScalar(distance).add(this.key.target.position);

    const cam = this.key.shadow.camera;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.near = SHADOW_MARGIN * 0.5;
    cam.far = distance + reach + SHADOW_MARGIN * 0.5;
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
