import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraRig, TOUR_CALM } from '../src/render/cameraRig';
import { tourSeconds, tourStops, type TourStop } from '../src/render/tour';
import { MAX_DISTRICTS } from '../src/sim/config';
import { cityCentre, cityRadius, portDistrict } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { housed, trading, zoning } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** A DOM stub. The rig only ever adds listeners to it. See camera.test.ts. */
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

function stubWindow(): void {
  const target = globalThis as unknown as { window?: unknown };
  if (target.window) return;
  target.window = { addEventListener: () => {}, removeEventListener: () => {} };
}

function rig(districts = 12): { rig: CameraRig; camera: THREE.PerspectiveCamera } {
  stubWindow();
  const camera = new THREE.PerspectiveCamera(42, 1.6, 0.5, 1200);
  const built = new CameraRig(camera, stubDom(), true);
  built.fit(cityRadius(districts), cityCentre(districts));
  return { rig: built, camera };
}

/** Runs the rig for `seconds` at 60fps, which is what the frame loop does. */
const run = (camera: CameraRig, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) camera.update(1 / 60);
};

describe('the stops are derived from the city, never authored', () => {
  it('gives a one-district city one district and two wide shots', () => {
    const stops = tourStops(state(), true);
    // Nothing to visit but the city itself and the district it opened on: no
    // port, no estates, no airport, because a tour of where they would be is a
    // tour of empty ground.
    expect(stops.map((stop) => stop.name)).toEqual(['The city', 'District 1', 'The city']);
    for (const stop of stops) expect(stop.street).toBe(false);
  });

  it('visits only what the state says the city has', () => {
    const names = (s: GameState): string[] => tourStops(s, true).map((stop) => stop.name);
    const wide = state({ ...zoning(MAX_DISTRICTS), ...housed(600), ...trading(400) });
    expect(names(wide)).not.toContain('The estates');
    expect(names(wide)).not.toContain('The airport');

    expect(names({ ...wide, estates: 2 })).toContain('The estates');
    expect(names({ ...wide, airport: true })).toContain('The airport');
    // The coast is a landmark the moment the city reaches it; the waterfront
    // needs a berth actually built on it.
    expect(portDistrict(wide.districts)).toBeGreaterThanOrEqual(0);
    expect(names(wide)).toContain('The coast');
    expect(names({ ...wide, cruiseTerminals: 1 })).toContain('The waterfront');
    expect(names({ ...wide, cruiseTerminals: 1 })).not.toContain('The coast');
  });

  it('never flies to a coast a city has not reached', () => {
    const small = state();
    expect(portDistrict(small.districts)).toBe(-1);
    const names = tourStops(small, true).map((stop) => stop.name);
    expect(names).not.toContain('The coast');
    expect(names).not.toContain('The waterfront');
  });

  it('spreads its district stops across the annexation order', () => {
    const stops = tourStops(state({ ...zoning(MAX_DISTRICTS) }), true);
    const districts = stops
      .map((stop) => /^District (\d+)$/.exec(stop.name)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number);
    // Capped, so a 49-district city is not a 49-minute tour, and spread from
    // the first district to the frontier rather than clustered in the middle.
    expect(districts.length).toBeLessThanOrEqual(4);
    expect(districts[0]).toBe(1);
    expect(districts.at(-1)).toBe(MAX_DISTRICTS);
    expect([...districts].sort((a, b) => a - b)).toEqual(districts);
  });

  it('opens and closes on the city, from different bearings', () => {
    const stops = tourStops(state({ ...zoning(9) }), true);
    const first = stops[0] as TourStop;
    const last = stops.at(-1) as TourStop;
    expect(first.name).toBe('The city');
    expect(last.name).toBe('The city');
    const centre = cityCentre(9);
    for (const stop of [first, last]) {
      expect(stop.x).toBeCloseTo(centre.x);
      expect(stop.z).toBeCloseTo(centre.z);
    }
    // The same shot from somewhere else, so the tour closes where it started
    // without repeating itself.
    expect(Math.abs(last.theta - first.theta)).toBeGreaterThan(0.5);
  });

  it('is the same tour twice for the same city, and a different one for a bigger', () => {
    // No randomness anywhere: a tour that reshuffled itself would be the first
    // thing in the renderer that could disagree with the city twice.
    const s = state({ ...zoning(7), estates: 1, airport: true });
    expect(tourStops(s, true)).toEqual(tourStops(s, true));
    expect(tourStops(s, true)).not.toEqual(tourStops(state({ ...zoning(20) }), true));
  });

  it('takes the street passes out when motion is not wanted', () => {
    const s = state({ ...zoning(20) });
    const full = tourStops(s, true);
    const calm = tourStops(s, false);
    expect(full.some((stop) => stop.street)).toBe(true);
    // A low pass through traffic is the most vestibularly aggressive thing
    // here — and under reduced motion the traffic is held still anyway, so a
    // street stop would be a long look at a photograph.
    expect(calm.some((stop) => stop.street)).toBe(false);
    // The tour is still offered, and it still visits the same places.
    expect(calm.map((stop) => stop.name)).toEqual(full.map((stop) => stop.name));
  });

  it('runs for a length somebody might actually watch', () => {
    for (const districts of [1, 7, MAX_DISTRICTS]) {
      const seconds = tourSeconds(tourStops(state({ ...zoning(districts) }), true));
      expect(seconds).toBeGreaterThan(15);
      expect(seconds, `${districts} districts`).toBeLessThan(90);
    }
  });
});

describe('playing it', () => {
  const stops = (n = 3): TourStop[] =>
    Array.from({ length: n }, (_, i) => ({
      x: i * 120,
      z: i * -80,
      radius: 90 + i * 20,
      phi: 0.5,
      theta: i,
      street: false,
      hold: 2,
      name: `stop ${i}`,
    }));

  it('is not running until it is started, and reports every stop', () => {
    const camera = rig().rig;
    expect(camera.touring).toBe(false);
    const seen: (TourStop | null)[] = [];
    camera.onTour = (stop) => void seen.push(stop);
    camera.startTour(stops());
    expect(camera.touring).toBe(true);
    run(camera, 7.5);
    expect(camera.touring).toBe(false);
    // Three stops announced in order, and a null when it ended.
    expect(seen.map((stop) => stop?.name ?? null)).toEqual([
      'stop 0',
      'stop 1',
      'stop 2',
      null,
    ]);
  });

  it('arrives where the stop said, on the damping and nothing else', () => {
    const camera = rig().rig;
    camera.startTour([{ ...(stops(1)[0] as TourStop), hold: 6 }]);
    // Not there on the first frame: the whole point of a slower damping is that
    // the arrival is the shot rather than the start of it.
    run(camera, 0.2);
    const early = camera.target.clone();
    expect(early.length()).toBeLessThan(20);
    run(camera, 5);
    expect(Math.abs(camera.target.x)).toBeLessThan(1);
    expect(Math.abs(camera.distance - 90)).toBeLessThan(2);
  });

  it('holds each stop for as long as the stop says', () => {
    const camera = rig().rig;
    const seen: string[] = [];
    camera.onTour = (stop) => void seen.push(stop?.name ?? 'end');
    camera.startTour(stops(3));
    run(camera, 1.5);
    expect(seen).toEqual(['stop 0']);
    run(camera, 1);
    expect(seen).toEqual(['stop 0', 'stop 1']);
  });

  it('takes twice as long under reduced motion, and holds twice as long', () => {
    const brisk = rig().rig;
    const calm = rig().rig;
    const at = (camera: CameraRig): number => {
      const seen: string[] = [];
      camera.onTour = (stop) => void seen.push(stop?.name ?? 'end');
      return seen.length;
    };
    at(brisk);
    at(calm);
    let briskEnded = false;
    let calmEnded = false;
    brisk.onTour = (stop) => void (stop === null && (briskEnded = true));
    calm.onTour = (stop) => void (stop === null && (calmEnded = true));
    brisk.startTour(stops(2), 1);
    calm.startTour(stops(2), TOUR_CALM);
    run(brisk, 4.5);
    run(calm, 4.5);
    expect(briskEnded).toBe(true);
    expect(calmEnded).toBe(false);
    run(calm, 4.5);
    expect(calmEnded).toBe(true);
  });

  it('arcs while it holds, so a stop is a shot rather than a still', () => {
    const { rig: camera, camera: eye } = rig();
    camera.startTour([{ ...(stops(1)[0] as TourStop), hold: 30 }]);
    run(camera, 6);
    const settled = eye.position.clone();
    const target = camera.target.clone();
    run(camera, 4);
    // The target has not moved and the eye has, which is what an arc is.
    expect(eye.position.distanceTo(settled)).toBeGreaterThan(5);
    expect(camera.target.distanceTo(target)).toBeLessThan(0.5);
  });

  it('stops dead when asked, and leaves the camera where it was', () => {
    const camera = rig().rig;
    camera.startTour(stops(3));
    run(camera, 1);
    const target = camera.target.clone();
    const radius = camera.distance;
    camera.stopTour();
    expect(camera.touring).toBe(false);
    // Nothing is restored. The player's next drag carries on from here, which
    // is the only behaviour that does not read as the game taking the camera
    // back.
    run(camera, 0.05);
    expect(camera.target.distanceTo(target)).toBeLessThan(0.01);
    expect(Math.abs(camera.distance - radius)).toBeLessThan(0.01);
    // And still there a second later, rather than easing on to where the tour
    // had been heading.
    run(camera, 1);
    expect(camera.target.distanceTo(target)).toBeLessThan(0.01);
    // And it stays stopped.
    run(camera, 10);
    expect(camera.touring).toBe(false);
  });

  it('says nothing and does nothing when handed an empty tour', () => {
    const camera = rig().rig;
    let told = false;
    camera.onTour = () => void (told = true);
    camera.startTour([]);
    expect(camera.touring).toBe(false);
    expect(told).toBe(false);
  });

  it('goes to street level for a street stop, and comes back up after it', () => {
    const camera = rig(12).rig;
    const centre = cityCentre(12);
    camera.startTour([
      {
        x: centre.x,
        z: centre.z,
        radius: -1,
        phi: -1,
        theta: 0.4,
        street: true,
        hold: 2,
        name: 'a street',
      },
      { ...(stops(1)[0] as TourStop), hold: 4 },
    ]);
    run(camera, 1);
    expect(camera.street).toBe(true);
    // The street camera's own invariant, which the tour must not break: the eye
    // stands over a road cell rather than inside a building.
    run(camera, 2);
    expect(camera.street).toBe(false);
  });
});
