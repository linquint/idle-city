import { WATERS } from '../sim/water.ts';
import { airportCell, estateCell } from '../sim/estates.ts';
import {
  DISTRICT_WIDTH,
  cityCentre,
  cityRadius,
  coastalDistrictAt,
  districtCoord,
  portDistrict,
} from '../sim/layout.ts';
import type { GameState } from '../sim/state.ts';

/**
 * One place the tour stops, and how it looks at it.
 *
 * A *want* for each of the four numbers the rig already holds, and nothing
 * else. That is the whole of how this stays a mode rather than a second camera:
 * a stop is not a keyframe to be played back, it is a set of values for
 * `wantTheta`, `wantPhi`, `wantRadius` and `wantTarget`, and the rig's own
 * damping is what carries the camera between them. There is no spline and no
 * second interpolator — see `CameraRig.update`.
 */
export interface TourStop {
  /** What it is looking at, in world units. */
  readonly x: number;
  readonly z: number;
  /** How far back, or -1 to keep whatever street mode decides. */
  readonly radius: number;
  /** Pitch, or -1 to leave the mode's own clamp to choose. */
  readonly phi: number;
  /** Bearing, absolute. */
  readonly theta: number;
  /** Whether to look at it from the pavement. */
  readonly street: boolean;
  /** Seconds to hold here before moving on. */
  readonly hold: number;
  /** What the HUD says while it is here. */
  readonly name: string;
}

/**
 * How long a stop holds, in seconds, and how far the camera arcs while it does.
 *
 * Long enough that the damping has arrived and the arc has read as an arc.
 * The rig runs a slower damping while touring — see TOUR_DAMPING — so a stop
 * spends its first second and a half still gliding in, which is the part that
 * looks like a camera move rather than a cut.
 */
const HOLD = 6.5;
const STREET_HOLD = 7.5;

/**
 * How far the tour stands back from a district, and from the whole city.
 *
 * A multiple of DISTRICT_WIDTH rather than a fixed number, so a stop over one
 * district frames a district whatever the city around it is doing. The wide
 * shots are the city's own framing distance, which is what `CameraRig.fit`
 * already computes — restated here rather than reached for, because the tour
 * has to be able to name a radius before the rig has been fitted.
 */
const DISTRICT_RADIUS = DISTRICT_WIDTH * 1.35;
const framing = (districts: number): number => cityRadius(districts) * 3.6 + 18;

/** A pitch high enough to read a district's plan, and one low enough to read a skyline. */
const HIGH_PHI = 0.42;
const LOW_PHI = 1.14;

/**
 * The bearing at the k-th stop.
 *
 * Irrational-ish turns rather than a fixed step, so a tour of eight stops does
 * not come back to the same angle twice and a tour of three does not look like
 * three views of one corner. Nothing here is random: the tour has to be the
 * same tour for the same city, because a tour that reshuffled itself would be
 * the first thing in the renderer that could disagree with the city twice.
 */
const bearing = (k: number): number => 0.72 + k * 2.399963;

/** The centre of a district, in world units. */
function districtAt(index: number): { x: number; z: number } {
  const coord = districtCoord(index);
  return { x: coord.x * DISTRICT_WIDTH, z: coord.z * DISTRICT_WIDTH };
}

/** A point in the coast frame, in world units. */
const shore = { x: 0, z: 0 };
function coastAt(u: number, v: number): { x: number; z: number } {
  WATERS.toWorld(u, v, shore);
  return { x: shore.x, z: shore.z };
}

/**
 * How many districts the tour visits on its own, at most.
 *
 * Four, and it is a cap rather than a fraction: a one-district city has one
 * thing to look at and a forty-nine-district city does not have forty-nine
 * minutes of anybody's attention. What the four are is spread across the
 * annexation order — the first, the newest, and two between — so the tour
 * shows the city growing rather than four views of the middle.
 */
const DISTRICT_STOPS = 4;

/**
 * The stops, derived from the state and from nothing else.
 *
 * The city is a pure function of its counts and the seed, so the tour is too —
 * which is the whole reason there is no authored path in this file. A
 * hand-written list of positions would be the first thing in the renderer that
 * could disagree with the city: it would fly to a port a city has not built, to
 * a district it has not annexed, and to the middle of a map whose centre has
 * moved since somebody wrote the number down.
 *
 * It also means the tour only ever visits things that are *there*. A
 * one-district city has no port, no highway and no airport, and flying to where
 * they would be is a tour of empty ground — so each of them is a stop only when
 * the state says it exists.
 *
 * Nothing here writes. It is handed a `Readonly<GameState>` and returns a list;
 * a tour is a camera path and a camera is view state, exactly as the selection
 * and the overlay are.
 */
export function tourStops(state: Readonly<GameState>, street: boolean): readonly TourStop[] {
  const stops: TourStop[] = [];
  const centre = cityCentre(state.districts);
  let k = 0;
  const next = (): number => bearing(k++);

  // Open wide. The city as it stands, which is the shot the player never gets
  // themselves because the play camera opens where they left it.
  stops.push({
    ...centre,
    radius: framing(state.districts),
    phi: HIGH_PHI,
    theta: next(),
    street: false,
    hold: HOLD,
    name: 'The city',
  });

  // Districts, spread across the order they were annexed rather than clustered:
  // the first is where the city started and the last is its frontier, and the
  // two between are the middle of its history.
  const picks = new Set<number>();
  const wanted = Math.min(DISTRICT_STOPS, state.districts);
  for (let i = 0; i < wanted; i++) {
    picks.add(Math.round((i * (state.districts - 1)) / Math.max(1, wanted - 1)));
  }
  const ordered = [...picks].sort((a, b) => a - b);
  for (const index of ordered) {
    const at = districtAt(index);
    // Every other district stop is taken from the pavement, when the mode is
    // available at all — a tour that stayed at altitude never shows the player
    // what the city looks like from inside it, which is the half of it the
    // orbit camera cannot say.
    const low = street && index !== ordered[0];
    stops.push({
      ...at,
      radius: low ? -1 : DISTRICT_RADIUS,
      phi: low ? -1 : LOW_PHI,
      theta: next(),
      street: low,
      hold: low ? STREET_HOLD : HOLD,
      name: `District ${index + 1}`,
    });
  }

  // The waterfront, if the city has reached it. `portDistrict` is -1 until it
  // has, which is the same read `terminalCapacity` makes.
  const port = portDistrict(state.districts);
  if (port >= 0 && state.cruiseTerminals + state.cargoTerminals > 0) {
    stops.push({
      ...districtAt(port),
      radius: DISTRICT_RADIUS,
      phi: LOW_PHI,
      theta: next(),
      street: false,
      hold: HOLD,
      name: 'The waterfront',
    });
  } else if (port >= 0 && coastalDistrictAt(0, state.districts) >= 0) {
    // Coast but no berths: still worth the shot, because the sea is the thing
    // the city spent forty thousand on reaching.
    stops.push({
      ...districtAt(port),
      radius: DISTRICT_RADIUS * 1.2,
      phi: LOW_PHI,
      theta: next(),
      street: false,
      hold: HOLD,
      name: 'The coast',
    });
  }

  // The estates, which are the first thing the city builds on land it does not
  // own. The newest one, because it is the furthest out and carries the road
  // with it into the shot.
  const estate = state.estates > 0 ? estateCell(state.estates - 1) : null;
  if (estate) {
    stops.push({
      ...coastAt(estate.u, estate.v),
      radius: DISTRICT_RADIUS * 1.4,
      phi: LOW_PHI,
      theta: next(),
      street: false,
      hold: HOLD,
      name: 'The estates',
    });
  }

  const runway = state.airport ? airportCell() : null;
  if (runway) {
    stops.push({
      ...coastAt(runway.u, runway.v),
      radius: DISTRICT_RADIUS * 2.4,
      // Flatter than everything else, because a runway is three districts long
      // and one wide and reads as a line from anywhere but the ground.
      phi: 0.86,
      theta: next(),
      street: false,
      hold: HOLD,
      name: 'The airport',
    });
  }

  // And back, from the other side. The same shot the tour opened on at a
  // different bearing, so it closes where it started without repeating itself.
  stops.push({
    ...centre,
    radius: framing(state.districts),
    phi: HIGH_PHI,
    theta: next(),
    street: false,
    hold: HOLD,
    name: 'The city',
  });

  return stops;
}

/** How long a tour of this city would run, in seconds. For the HUD. */
export const tourSeconds = (stops: readonly TourStop[]): number =>
  stops.reduce((n, stop) => n + stop.hold, 0);
