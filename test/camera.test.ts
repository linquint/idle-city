import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { CameraRig } from '../src/render/cameraRig';
import { Buildings } from '../src/render/buildings';
import { CELL, DISTRICT_SPAN, LEVELS, MAX_DISTRICTS } from '../src/sim/config';
import {
  CityLayout,
  cellX,
  cellZ,
  cityCentre,
  cityRadius,
  isRoad,
  worldX,
  worldZ,
} from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { housed, making, trading } from './levels';

/**
 * The camera, checked as a black box.
 *
 * `CameraRig` owns no game state and needs no WebGL context — it moves a
 * `PerspectiveCamera` around a target — so it can be driven headlessly the way
 * the building layer is. What is worth checking is not the feel but the two
 * invariants street mode rests on: the eye is always over a street, and it is
 * always above the ground. Both are properties of the clamps rather than of a
 * per-frame test, which is exactly what makes them assertable.
 */

/** A DOM stub. The rig only ever adds listeners to it and reads its bounds. */
function stubDom(): HTMLElement {
  const noop = (): void => {};
  return {
    addEventListener: noop,
    removeEventListener: noop,
    setPointerCapture: noop,
    releasePointerCapture: noop,
    hasPointerCapture: () => false,
  } as unknown as HTMLElement;
}

/** A window stub, for the listeners the rig attaches to it. */
function stubWindow(): void {
  const target = globalThis as unknown as {
    window?: { addEventListener: () => void; removeEventListener: () => void };
  };
  if (target.window) return;
  target.window = { addEventListener: () => {}, removeEventListener: () => {} };
}

interface Rigged {
  rig: CameraRig;
  camera: THREE.PerspectiveCamera;
  /** Runs the damping to rest, so the assertions are about where it settles. */
  settle(seconds?: number): void;
}

function rigged(districts = 9): Rigged {
  stubWindow();
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 1200);
  const rig = new CameraRig(camera, stubDom(), false);
  rig.fit(cityRadius(districts), cityCentre(districts));
  return {
    rig,
    camera,
    settle(seconds = 4): void {
      for (let i = 0; i < seconds * 60; i++) rig.update(1 / 60);
    },
  };
}

describe('the orbit camera is the play camera', () => {
  it('starts out of street mode and frames the city', () => {
    const { rig, camera, settle } = rigged();
    expect(rig.street).toBe(false);
    settle();
    // Well above the ground and well back from what it is looking at, which is
    // the whole of what "the camera did not change" means here.
    expect(camera.position.y).toBeGreaterThan(20);
    expect(rig.distance).toBeGreaterThan(26);
    expect(camera.near).toBeCloseTo(0.5, 6);
  });

  it('comes back to a frame that shows the city when street mode is left', () => {
    const { rig, camera, settle } = rigged();
    rig.setStreet(true);
    settle();
    const low = camera.position.y;
    rig.setStreet(false);
    settle();
    expect(rig.street).toBe(false);
    expect(camera.position.y).toBeGreaterThan(low * 4);
    expect(rig.distance).toBeGreaterThanOrEqual(26);
    expect(camera.near).toBeCloseTo(0.5, 6);
  });
});

describe('street mode', () => {
  it('drops the eye to street level and keeps it there', () => {
    const { rig, camera, settle } = rigged();
    rig.setStreet(true);
    settle();
    expect(rig.street).toBe(true);
    // Above a walker (0.72) and a car (0.55), under a level-1 house (4.6).
    expect(camera.position.y).toBeGreaterThan(0.9);
    expect(camera.position.y).toBeLessThan(4.6);
  });

  it('never puts the eye under the ground, at any pitch', () => {
    const { rig, camera, settle } = rigged();
    rig.setStreet(true);
    settle();
    // Drag the pitch hard in both directions. The clamp is the terrain guard —
    // phi stays strictly under a right angle, so the eye is always above its
    // own target, and its own target is above ground.
    const orbit = (rig as unknown as { orbit(dx: number, dy: number): void }).orbit.bind(rig);
    for (const dy of [-4_000, 4_000]) {
      orbit(0, dy);
      settle();
      expect(camera.position.y).toBeGreaterThan(0);
    }
  });

  it('keeps the eye over a road cell, however it is turned', () => {
    const { rig, camera, settle } = rigged();
    rig.setStreet(true);
    settle();
    const inner = rig as unknown as {
      orbit(dx: number, dy: number): void;
      arm(): number;
      radius: number;
    };
    // A full turn, sampled every few degrees. At every one of them the arm has
    // to have found a street — that is what `arm` is for.
    let jammed = 0;
    for (let step = 0; step < 24; step++) {
      inner.orbit(44, 0);
      settle(1);
      expect(isRoad(cellX(camera.position.x), cellZ(camera.position.z))).toBe(true);
      if (inner.arm() < inner.radius - 1e-6) jammed++;
    }
    // And the arm is doing work rather than the test passing by luck: turned
    // across the street the eye backs into a block and the arm gives way.
    expect(jammed).toBeGreaterThan(0);
  });

  it('steps onto a street on the way in, wherever the orbit was looking', () => {
    // Every plot in a district, as a place the orbit camera might have been
    // pointed at when the player pressed V. The citygen holds its street gaps
    // in [3, 7], so none of them is more than three cells from a road — and
    // arriving inside a building would leave the player unable to walk out.
    for (let cell = 0; cell < DISTRICT_SPAN * DISTRICT_SPAN; cell++) {
      const { rig } = rigged();
      const inner = rig as unknown as { wantTarget: THREE.Vector3 };
      inner.wantTarget.set(
        worldX(cell % DISTRICT_SPAN),
        0,
        worldZ(Math.floor(cell / DISTRICT_SPAN)),
      );
      rig.setStreet(true);
      expect(isRoad(cellX(inner.wantTarget.x), cellZ(inner.wantTarget.z))).toBe(true);
    }
  });

  it('walks along the streets rather than through the blocks', () => {
    const { rig, settle } = rigged();
    rig.setStreet(true);
    settle();
    const inner = rig as unknown as {
      moveTarget(dx: number, dz: number): void;
      wantTarget: THREE.Vector3;
    };
    // Push in every direction, a plot at a time, for a long walk. The target is
    // what the arm is measured from, so it is the one that must stay on a road.
    let moved = 0;
    for (let step = 0; step < 400; step++) {
      const angle = (step * 0.37) % (Math.PI * 2);
      const from = inner.wantTarget.clone();
      inner.moveTarget(Math.cos(angle) * CELL, Math.sin(angle) * CELL);
      expect(isRoad(cellX(inner.wantTarget.x), cellZ(inner.wantTarget.z))).toBe(true);
      if (inner.wantTarget.distanceTo(from) > 1e-6) moved++;
    }
    // And it is a walk rather than a wall: most pushes get somewhere, which is
    // what sliding along the frontage buys over refusing the whole step.
    expect(moved).toBeGreaterThan(200);
  });

  it('pulls the near plane in as the camera closes on what it is looking at', () => {
    const { rig, camera, settle } = rigged();
    settle();
    const wide = camera.near;
    rig.setStreet(true);
    settle();
    expect(camera.near).toBeLessThan(wide);
    // Never so near that the depth buffer gives out. See NEAR_SHARE.
    expect(camera.near).toBeGreaterThanOrEqual(0.12);
  });

  it('interpolates rather than cutting', () => {
    const { rig, camera } = rigged();
    for (let i = 0; i < 240; i++) rig.update(1 / 60);
    const from = camera.position.clone();
    rig.setStreet(true);
    rig.update(1 / 60);
    const step = camera.position.distanceTo(from);
    // One frame of DAMPING = 12 moves about 18% of the way, so a descent of a
    // hundred units is under twenty in the first frame — a move, not a cut.
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(from.distanceTo(camera.position) + 1);
    let moving = 0;
    for (let i = 0; i < 240; i++) {
      const before = camera.position.clone();
      rig.update(1 / 60);
      if (camera.position.distanceTo(before) > 1e-3) moving++;
    }
    // It is still easing several frames later rather than having arrived on the
    // first one, which is what "interpolate" means.
    expect(moving).toBeGreaterThan(10);
  });

  it('does not throw the camera across the map when land is annexed', () => {
    const { rig, camera, settle } = rigged(4);
    rig.setStreet(true);
    settle();
    const before = camera.position.clone();
    // A reveal, which in the orbit camera pulls out and re-centres on the city.
    rig.fit(cityRadius(9), cityCentre(9), true);
    settle();
    expect(rig.street).toBe(true);
    expect(camera.position.distanceTo(before)).toBeLessThan(30);
  });
});

describe('the detail mask', () => {
  const city = (districts: number): GameState => ({
    ...createState(0),
    ...housed(districts * 12, LEVELS - 1),
    ...trading(districts * 22),
    ...making(districts * 6),
    districts,
  });

  let buildings: Buildings;
  let state: GameState;

  beforeEach(() => {
    state = city(MAX_DISTRICTS);
    buildings = new Buildings(new THREE.Scene(), new CityLayout());
    buildings.sync(state, 0);
  });

  const centre = (): { x: number; z: number } => cityCentre(MAX_DISTRICTS);

  it('leaves the wide shot fully dressed', () => {
    const at = centre();
    expect(buildings.setDetail(at.x, at.z, 1_200, state.districts)).toBe(false);
    expect(buildings.dressingAll).toBe(true);
  });

  it('engages once the camera is down among the buildings', () => {
    const at = centre();
    expect(buildings.setDetail(at.x, at.z, 7, state.districts)).toBe(true);
    expect(buildings.dressingAll).toBe(false);
  });

  it('costs a repack only when the focus has really moved', () => {
    const at = centre();
    buildings.setDetail(at.x, at.z, 7, state.districts);
    // Standing still, and shuffling about within half a district, say nothing.
    expect(buildings.setDetail(at.x, at.z, 7, state.districts)).toBe(false);
    expect(buildings.setDetail(at.x + 10, at.z, 7, state.districts)).toBe(false);
    expect(buildings.setDetail(at.x + 20, at.z + 20, 7, state.districts)).toBe(false);
    // A district away is a different set of neighbours.
    expect(buildings.setDetail(at.x + 200, at.z, 7, state.districts)).toBe(true);
  });

  it('takes the dressing off the city it cannot see, and only that', () => {
    const at = centre();
    const dressing = (scene: THREE.Object3D): number => {
      let n = 0;
      scene.traverse((object) => {
        if (object instanceof THREE.InstancedMesh && object.name.startsWith('part:')) {
          n += object.count;
        }
      });
      return n;
    };
    const scene = new THREE.Scene();
    const layer = new Buildings(scene, new CityLayout());
    layer.sync(state, 0);
    const all = dressing(scene);
    expect(all).toBeGreaterThan(0);
    layer.setDetail(at.x, at.z, 7, state.districts);
    layer.repack(0);
    const near = dressing(scene);
    expect(near).toBeLessThan(all);
    // The roofs are not dressing: every building keeps its silhouette however
    // far away it is, so the drop can never be everything.
    expect(near).toBeGreaterThan(0);
    // And it comes back when the camera pulls out.
    layer.setDetail(at.x, at.z, 1_200, state.districts);
    layer.repack(0);
    expect(dressing(scene)).toBe(all);
  });

  it('gives every building a roof whatever the detail level', () => {
    const scene = new THREE.Scene();
    const layer = new Buildings(scene, new CityLayout());
    layer.sync(state, 0);
    const roofs = (): number => {
      let n = 0;
      scene.traverse((object) => {
        if (
          object instanceof THREE.InstancedMesh &&
          ['part:pitched', 'part:flat', 'part:parapet'].includes(object.name)
        ) {
          n += object.count;
        }
      });
      return n;
    };
    const dressed = roofs();
    const at = centre();
    layer.setDetail(at.x, at.z, 7, state.districts);
    layer.repack(0);
    expect(roofs()).toBe(dressed);
  });
});
