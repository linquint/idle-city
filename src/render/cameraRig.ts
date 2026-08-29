import * as THREE from 'three';
import { CELL } from '../sim/config.ts';
import { cellX, cellZ, isRoad } from '../sim/layout.ts';
import type { TourStop } from './tour.ts';

/**
 * What separates a click from a drag: the pointer came back up within this many
 * pixels of where it went down, and within this many milliseconds.
 *
 * The rig owns pointer events, so a competing listener on the canvas would
 * swallow the drags it is holding — every orbit starts as a pointerdown and
 * would fire a click on the way out. Measuring it here instead means a drag
 * stays a drag, and 5px is wide enough for a trackpad's wobble while staying
 * far under the smallest orbit anyone makes on purpose.
 */
const CLICK_SLOP = 5;
const CLICK_MS = 250;

const MIN_PHI = 0.18;
const MAX_PHI = 1.36;
const MIN_RADIUS = 26;
const DAMPING = 12;
const DRIFT = 0.02;

// ------------------------------------------------------------- tour mode

/**
 * How hard the camera is pulled toward a stop while the tour is running.
 *
 * The same exponential damping the player's camera uses, at a tenth of the
 * constant — which is what makes this a *mode* rather than a second camera or a
 * spline. DAMPING at 12 puts the camera on its want in about half a second,
 * which reads as a cut; 1.2 takes about two and a half, so a stop spends its
 * opening still gliding in and the arrival is the shot rather than the start of
 * it. There is nothing else between two stops: no keyframes, no easing curve,
 * no path. The rig chases a want and the tour moves the want.
 */
const TOUR_DAMPING = 1.2;

/**
 * How fast the camera arcs while it is holding at a stop, in radians a second.
 *
 * Ten times the idle DRIFT, which is deliberately slow enough that a player who
 * walks away does not come back to a spinning city. A tour is being *watched*,
 * so it can afford a bearing that visibly moves — a quarter turn over a
 * six-second hold, which is enough for the light to travel across a facade.
 */
const TOUR_ORBIT = 0.2;

/**
 * How much longer everything takes under reduced motion.
 *
 * The tour is *offered* rather than withheld, and that is the decision. Reduced
 * motion is about motion the player did not ask for — an autoplaying carousel,
 * a parallax header, a sun crossing the sky — and this is a control they went
 * and pressed. Withholding it would be answering a preference about
 * interruption with a refusal to do what was asked.
 *
 * What it does instead is take the aggressive parts out. Everything holds twice
 * as long and glides at half the rate, so no shot is a swing; and the street
 * passes are dropped entirely, because a low pass through traffic is the most
 * vestibularly aggressive thing here — and under reduced motion the traffic is
 * held still anyway, so a street stop would be a long look at a photograph.
 * See `tourStops`, which is handed the flag.
 */
export const TOUR_CALM = 2;

/**
 * How high the orbit camera's target floats above the ground.
 *
 * It was a literal 4 in three places. Named because street mode is a fourth
 * place with a different answer, and a mode that differed from the play camera
 * by an unnamed constant would be a mode nobody could reason about.
 */
const ORBIT_TARGET_Y = 4;

// ------------------------------------------------------------- street mode

/**
 * Street mode: the same orbit rig, run at a short arm and near the horizontal.
 *
 * A mode rather than a change to MIN_RADIUS, because the orbit camera is the
 * play camera and has to behave exactly as it did. Everything below is a
 * different set of clamps for the same three numbers — theta, phi, radius — so
 * entering and leaving is the existing damping doing what it already does, and
 * there is no second camera to keep in step with the first.
 */

/**
 * How far the eye stands behind what it is looking at, and the floor under it.
 *
 * Seven world units is a district cell and three quarters. Combined with the
 * phi clamp below it puts the eye about a body-and-a-half over the pavement:
 * a walker is 0.72 tall and a car 0.55, so the camera looks down on the traffic
 * and up at everything else, which is the whole point of the mode. The floor
 * exists because the arm shortens on contact — see `arm` — and an arm of zero
 * would put the eye exactly on its own target.
 */
const STREET_RADIUS = 7;
const STREET_MIN_RADIUS = 1.6;
const STREET_MAX_RADIUS = 26;

/**
 * How high the eye's target floats. Well under ORBIT_TARGET_Y, and that is most
 * of what makes the mode read: the orbit camera looks at a point four units up,
 * which is above a bungalow's roof.
 */
const STREET_TARGET_Y = 0.9;

/**
 * The pitch clamp, and the one that does the terrain check for free.
 *
 * Strictly under a right angle, so `cos(phi)` is strictly positive and the eye
 * is *always* above its own target — which sits at STREET_TARGET_Y, which is
 * above ground. The camera therefore cannot go under the terrain, and it cannot
 * because of the clamp rather than because of a test that runs every frame.
 * The upper end is a shallow look-down, enough to see the pavement in front of
 * you without becoming a drone shot.
 */
const STREET_MIN_PHI = 1.18;
const STREET_MAX_PHI = 1.545;

/**
 * How far the arm is shortened at a time when the eye is over something solid.
 *
 * A step of one world unit against a CELL of 4, so an arm that has to give way
 * gives way in quarters of a plot; the loop runs at most (7 - 1.6) / 1 = 6
 * `isRoad` calls a frame, each of which is a cached district lookup and two
 * array reads. See `arm` for what it is solving.
 */
const STREET_ARM_STEP = 1;

/**
 * How far `snapToRoad` looks for a street, in cells.
 *
 * The citygen holds every row and column gap in [3, 7] — asserted over a
 * thousand seeds in tools/citygen.test.mjs — so the furthest a plot can be from
 * a street is three cells. Four is that plus a margin, and the loop is 81 cheap
 * lookups in the worst case and none in the common one.
 */
const STREET_SNAP_RINGS = 4;

/**
 * How fast street mode walks, in world units a second.
 *
 * Fixed rather than `radius * 0.9` like the orbit pan, which at an arm of seven
 * would be six units a second — a stroll on a street that is sixty units long.
 * 14 is about ten times a walker's pace, which is what a camera the player is
 * steering wants to be: fast enough to cross a district in four seconds, slow
 * enough that the buildings read as you pass them.
 */
const STREET_PAN_SPEED = 14;

/**
 * The near plane, as a share of how far the camera is from what it looks at.
 *
 * 0.5 was fine for a camera that could never get closer than MIN_RADIUS = 26,
 * and it is not fine for one standing beside a building: the eye is over a road
 * cell, a cell is 4 across and a body can reach 3.92 of it, so the nearest
 * facade can be a few hundredths of a unit away and 0.5 would slice it open.
 *
 * Derived from the arm rather than switched with the mode, which is what keeps
 * it honest through the transition: there is no frame on the way down where the
 * camera is at street level with the orbit's near plane. The ceiling is the
 * value the orbit camera already had, so nothing about the play camera moves.
 *
 * The floor is what the depth buffer will stand. At 49 districts the far plane
 * is `radius * 8 + 600` = 3,240, so 0.12 is a ratio of 27,000:1 — about 0.18
 * world units of depth resolution at 600 units out, on geometry that is under
 * two pixels tall at that distance. The case that reaches the floor is the arm
 * jammed against a wall, where most of the frame *is* the wall.
 */
const NEAR_SHARE = 0.05;
const NEAR_MIN = 0.12;
const NEAR_MAX = 0.5;
/**
 * Which way each key walks, as the screen sees it: x across, y up and down the
 * screen. `applyKeys` turns that into a move along the ground.
 */
const PAN_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

/**
 * Orbit, pinch and pan, damped, with a slow idle drift.
 *
 * Hand-rolled rather than pulled from three's examples because the rig has to
 * know about the city: its zoom ceiling and pan bounds both grow when land is
 * annexed, and it eases outward to reveal a district the moment one is bought.
 */
export class CameraRig {
  readonly target = new THREE.Vector3(0, ORBIT_TARGET_Y, 0);

  /**
   * Called when a pointer went down and came back up in the same place, quickly
   * — a click on the world rather than the start of an orbit.
   *
   * A hook rather than a second listener, for the reason CLICK_SLOP explains.
   */
  onClick: ((x: number, y: number) => void) | null = null;

  private theta = 0.72;
  private phi = 0.95;
  private radius = 92;
  private wantTheta = this.theta;
  private wantPhi = this.phi;
  private wantRadius = this.radius;
  private readonly wantTarget = this.target.clone();

  private maxRadius = 240;
  private bounds = 120;
  private framed = false;
  private readonly centre = new THREE.Vector3(0, ORBIT_TARGET_Y, 0);
  /** True in street mode. Nothing but the clamps and the arm depends on it. */
  private streetMode = false;
  private interacting = false;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  /** Where and when the current gesture began, for the click test. */
  private pressX = 0;
  private pressY = 0;
  private pressAt = 0;
  private dragged = false;
  private readonly keys = new Set<string>();
  private readonly detach: Array<() => void> = [];

  /**
   * The stops the tour is playing, or null when it is not running.
   *
   * View state, and it stays view state: it is a list of camera positions
   * derived from `GameState` every time the tour starts, and nothing about it
   * is written anywhere. The rig holds no copy of the simulation's numbers —
   * `tourStops` was handed the state, answered, and is done with it.
   */
  private tour: readonly TourStop[] | null = null;
  private tourAt = 0;
  private tourHeld = 0;
  /** How much slower everything runs. 1 normally; see TOUR_CALM. */
  private tourCalm = 1;
  /**
   * Told when the tour moves on or ends, so the HUD can say where it is.
   *
   * A hook rather than the rig reaching into a panel, in the shape `onClick`
   * already is. Null names no stop, which is what ending looks like.
   */
  onTour: ((stop: TourStop | null) => void) | null = null;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
    private drift: boolean,
  ) {
    this.listen();
    this.apply();
  }

  /**
   * Whether the camera drifts when nobody is touching it.
   *
   * A switch rather than a constructor argument, so the motion preference can
   * be answered without rebuilding the rig. The drift only ever moves `theta`
   * toward a want that the damping is already chasing, so turning it off stops
   * the city rotating on the next frame and leaves the camera exactly where the
   * player last left it.
   */
  setDrift(on: boolean): void {
    this.drift = on;
  }

  /**
   * Re-frames for a city of this size and centre: widens the zoom ceiling and
   * the pan bounds, and eases out and over to reveal land that was just bought.
   */
  fit(
    cityRadius: number,
    centre: { x: number; z: number },
    reveal = false,
    /**
     * How far the player may pan, if further than the districts reach.
     *
     * Its own argument rather than a wider `cityRadius`, because the two are
     * used for different things: the radius sets the zoom ceiling and the
     * opening frame, and widening it for a quay half a district offshore would
     * open the game zoomed out past the city. This only moves the leash.
     */
    reach = cityRadius,
  ): void {
    this.maxRadius = Math.max(200, cityRadius * 4);
    this.bounds = Math.max(cityRadius, reach);
    this.centre.set(centre.x, this.targetY, centre.z);

    // The distance at which the whole city fits the frame. It scales off the
    // ground plane's diagonal, not its radius: seen obliquely, a square city is
    // half again as wide as it is across.
    const framing = cityRadius * 3.6 + 18;

    if (!this.framed) {
      this.framed = true;
      this.wantRadius = THREE.MathUtils.clamp(framing, MIN_RADIUS, this.maxRadius);
      this.radius = this.wantRadius;
      this.wantTarget.copy(this.centre);
      this.target.copy(this.centre);
    } else if (reveal && !this.streetMode) {
      // Not in street mode: the reveal is a wide shot of land the player just
      // bought, and cutting to it from ground level would throw the camera
      // across the map with no way back to where they were standing. The leash
      // and the zoom ceiling still widen — only the framing move is skipped.
      this.wantRadius = Math.max(this.wantRadius, framing);
      this.wantTarget.copy(this.centre);
    }
    this.wantRadius = Math.min(this.wantRadius, this.maxRadius);
  }

  /** Distance from the camera to what it is looking at, for fog fitting. */
  get distance(): number {
    return this.radius;
  }

  /** Whether the rig is at street level. Read by the view and the HUD. */
  get street(): boolean {
    return this.streetMode;
  }

  /**
   * Goes to street level, or comes back up.
   *
   * Nothing is cut. Every number the rig holds is already damped toward a want,
   * so the whole of the transition is re-clamping the wants into the other
   * mode's range and letting DAMPING carry them — which is why the descent
   * feels like the same camera rather than like a second one being swapped in.
   *
   * The one thing that has to be stated rather than clamped is where the eye is
   * *looking*: the orbit camera aims four units up and the street camera aims
   * just under one, so the target's own height moves with the mode.
   */
  setStreet(on: boolean): void {
    if (on === this.streetMode) return;
    this.streetMode = on;
    this.centre.y = this.targetY;
    this.wantTarget.y = this.targetY;
    if (on) {
      this.wantRadius = STREET_RADIUS;
      // Into the near-horizontal band, from wherever the orbit had been left.
      this.wantPhi = THREE.MathUtils.clamp(
        Math.max(this.wantPhi, STREET_MIN_PHI),
        STREET_MIN_PHI,
        STREET_MAX_PHI,
      );
      // Onto a street, before anything asks it to walk down one. The orbit
      // camera looks wherever it likes and is usually looking at a block, so
      // without this the player would arrive standing inside a building and
      // `moveTarget` — which will not step off the road — would have nowhere to
      // let them go.
      this.snapToRoad();
    } else {
      // Back to the orbit's own floor rather than to wherever it was before, so
      // leaving street mode always comes out at a frame that shows the city.
      this.wantRadius = Math.min(this.maxRadius, Math.max(MIN_RADIUS, this.wantRadius * 6));
      this.wantPhi = THREE.MathUtils.clamp(this.wantPhi, MIN_PHI, MAX_PHI);
    }
  }

  /** Whether the tour is running. Read by the view and the HUD. */
  get touring(): boolean {
    return this.tour !== null;
  }

  /**
   * Starts the tour, or stops it if it is already running.
   *
   * The stops arrive from outside rather than being built here, because what a
   * city has is the simulation's business and where a camera stands is the
   * rig's. See `tourStops`.
   */
  startTour(stops: readonly TourStop[], calm = 1): void {
    if (stops.length === 0) return;
    this.tour = stops;
    this.tourAt = -1;
    this.tourHeld = 0;
    this.tourCalm = Math.max(1, calm);
    this.advanceTour();
  }

  /**
   * Ends it, wherever it had got to.
   *
   * Nothing is restored. The camera stays where the tour left it and the
   * player's next drag carries on from there, which is the only behaviour that
   * does not feel like the game taking the camera back — and every number the
   * rig holds is already a damped want, so there is no state to unwind.
   *
   * Street mode is the one exception and it is not an exception to that rule:
   * it is *left on* if the tour was at a street stop, because the player has
   * just been handed a camera at pavement level and snatching it back to
   * altitude on the first click would be the game overruling them. V brings
   * them up when they want to come up.
   */
  stopTour(): void {
    if (!this.tour) return;
    this.tour = null;
    // The wants are pulled back onto where the camera *is*, and this is the
    // whole of "stops dead". Leaving them pointed at the stop it was gliding
    // toward would hand the player's own DAMPING — ten times the tour's — a
    // target most of a city away, and the camera would lunge there over the
    // next half second. Stopping a tour has to stop the camera.
    this.wantTarget.copy(this.target);
    this.wantTheta = this.theta;
    this.wantPhi = this.phi;
    this.wantRadius = this.radius;
    this.onTour?.(null);
  }

  /** Moves to the next stop, or ends the tour after the last. */
  private advanceTour(): void {
    const stops = this.tour;
    if (!stops) return;
    this.tourAt++;
    const stop = stops[this.tourAt];
    if (!stop) {
      this.stopTour();
      return;
    }
    this.tourHeld = 0;
    // Street mode first, because entering it snaps the target onto a road and
    // leaving it multiplies the radius — both of which have to happen before
    // the stop states what it wants.
    if (stop.street !== this.streetMode) {
      this.wantTarget.x = stop.x;
      this.wantTarget.z = stop.z;
      this.setStreet(stop.street);
    }
    this.wantTarget.x = stop.x;
    this.wantTarget.z = stop.z;
    this.wantTarget.y = this.targetY;
    this.wantTheta = stop.theta;
    const [lowPhi, highPhi] =
      this.streetMode ? [STREET_MIN_PHI, STREET_MAX_PHI] : [MIN_PHI, MAX_PHI];
    if (stop.phi >= 0) this.wantPhi = THREE.MathUtils.clamp(stop.phi, lowPhi, highPhi);
    if (stop.radius >= 0) {
      const [lowR, highR] =
        this.streetMode ? [STREET_MIN_RADIUS, STREET_MAX_RADIUS] : [MIN_RADIUS, this.maxRadius];
      this.wantRadius = THREE.MathUtils.clamp(stop.radius, lowR, highR);
    }
    // On a street stop the target has to be on a road, or `moveTarget` has
    // nowhere to let the camera go and `arm` has nothing to measure against.
    if (this.streetMode) this.snapToRoad();
    this.onTour?.(stop);
  }

  /** How high this mode's target floats above the ground. */
  private get targetY(): number {
    return this.streetMode ? STREET_TARGET_Y : ORBIT_TARGET_Y;
  }

  /**
   * Moves the target onto the nearest road cell, if it is not already on one.
   *
   * A square spiral rather than a search: the citygen's row and column gaps are
   * bounded to [3, 7], so a street is never more than four cells away and the
   * ring loop always terminates well inside its own bound. Called once, on the
   * way into street mode — not per frame, because `moveTarget` is what keeps it
   * on a road after that.
   */
  private snapToRoad(): void {
    const x = this.wantTarget.x;
    const z = this.wantTarget.z;
    if (this.overRoad(x, z)) return;
    for (let ring = 1; ring <= STREET_SNAP_RINGS; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          // Only the ring itself; the inside of it was covered by earlier rings.
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const px = x + dx * CELL;
          const pz = z + dz * CELL;
          if (!this.overRoad(px, pz)) continue;
          this.wantTarget.x = px;
          this.wantTarget.z = pz;
          return;
        }
      }
    }
  }

  update(dt: number): void {
    this.applyKeys(dt);
    if (this.tour) {
      // The whole of the tour's per-frame work: hold a clock, arc the bearing,
      // and move on when the stop is done. Everything else is the damping
      // below doing what it does for the player's own camera.
      this.tourHeld += dt;
      this.wantTheta += (dt * TOUR_ORBIT) / this.tourCalm;
      const stop = this.tour[this.tourAt];
      if (stop && this.tourHeld >= stop.hold * this.tourCalm) this.advanceTour();
    } else if (this.drift && !this.interacting) {
      this.wantTheta += dt * DRIFT;
    }

    // Frame-rate independent exponential damping. The tour runs the same
    // expression at a tenth of the constant — see TOUR_DAMPING, and note that
    // this is the only interpolator in the file.
    const k = 1 - Math.exp(-(this.tour ? TOUR_DAMPING / this.tourCalm : DAMPING) * dt);
    this.theta += (this.wantTheta - this.theta) * k;
    this.phi += (this.wantPhi - this.phi) * k;
    this.radius += (this.wantRadius - this.radius) * k;
    this.target.lerp(this.wantTarget, k);
    this.apply();
  }

  private apply(): void {
    const sinPhi = Math.sin(this.phi);
    const arm = this.streetMode ? this.arm() : this.radius;
    this.camera.position.set(
      this.target.x + arm * sinPhi * Math.cos(this.theta),
      this.target.y + arm * Math.cos(this.phi),
      this.target.z + arm * sinPhi * Math.sin(this.theta),
    );
    this.camera.lookAt(this.target);

    // See NEAR_SHARE. Only written when it actually moved, because rebuilding
    // the projection matrix on a frame where nothing changed is a frame's worth
    // of work for nothing.
    const near = THREE.MathUtils.clamp(arm * NEAR_SHARE, NEAR_MIN, NEAR_MAX);
    if (Math.abs(near - this.camera.near) > 1e-3) {
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * How far the eye may actually stand back before it is inside something.
   *
   * The target is already kept over a road cell — see `moveTarget` — but the
   * eye is seven units behind it, which is nearly two plots, and at any angle
   * that is not down the street those two plots are a building. So the arm
   * shortens until the eye is over a road cell too, which is the ordinary
   * spring-arm answer and reads as one: back into a wall and the camera closes
   * up on you rather than passing through it.
   *
   * A road cell rather than a raycast, because `isRoad` is pure, cached and
   * exact — the streets are the citygen's own and the renderer does not have to
   * guess at where a building is. At STREET_MIN_RADIUS the eye is 1.6 units
   * from a target that is itself over a road, and a road cell is 4 across, so
   * the shortest arm is still on the street it started from and the loop always
   * has an answer.
   */
  private arm(): number {
    const sinPhi = Math.sin(this.phi);
    const cos = Math.cos(this.theta);
    const sin = Math.sin(this.theta);
    for (let r = this.radius; r > STREET_MIN_RADIUS; r -= STREET_ARM_STEP) {
      if (this.overRoad(this.target.x + r * sinPhi * cos, this.target.z + r * sinPhi * sin)) {
        return r;
      }
    }
    return STREET_MIN_RADIUS;
  }

  /** Whether a world position stands over one of the citygen's road cells. */
  private overRoad(x: number, z: number): boolean {
    return isRoad(cellX(x), cellZ(z));
  }

  private orbit(dx: number, dy: number): void {
    this.wantTheta -= dx * 0.006;
    const [low, high] =
      this.streetMode ? [STREET_MIN_PHI, STREET_MAX_PHI] : [MIN_PHI, MAX_PHI];
    this.wantPhi = THREE.MathUtils.clamp(this.wantPhi - dy * 0.005, low, high);
  }

  private pan(dx: number, dy: number): void {
    // Pan along the ground plane, in the direction the camera is facing, and
    // scale by distance so the world tracks the cursor at any zoom. Street mode
    // is pinned to the orbit's own floor rather than to its arm: at a radius of
    // seven a drag across the whole screen would move the eye eleven units, and
    // a camera that cannot be dragged out of the block it is in reads as stuck.
    const scale = Math.max(this.radius, this.streetMode ? MIN_RADIUS : 0) * 0.0016;
    const cos = Math.cos(this.theta);
    const sin = Math.sin(this.theta);
    this.moveTarget(
      (-dx * sin - dy * cos) * scale,
      (dx * cos - dy * sin) * scale,
    );
  }

  /**
   * Panning is bounded to the city, wherever the city currently happens to be.
   *
   * In street mode it is bounded by the streets as well, and the two axes are
   * tried separately: a move that would leave the road is dropped on the axis
   * that would have left it and kept on the other, so walking into a corner
   * slides along the frontage instead of stopping dead. That is one `isRoad`
   * call per axis per step, and it is what keeps the eye's own target — which
   * the arm is measured from — over a street at all times.
   */
  private moveTarget(dx: number, dz: number): void {
    // The constraint only applies from a position that is already on a road:
    // anywhere else it would lock the camera in place rather than keep it on
    // the street, and a rig that cannot move is worse than one standing in a
    // shop. `snapToRoad` is what makes that the unreachable case.
    if (this.streetMode && this.overRoad(this.wantTarget.x, this.wantTarget.z)) {
      const x = this.wantTarget.x;
      const z = this.wantTarget.z;
      if (!this.overRoad(x + dx, z)) dx = 0;
      if (!this.overRoad(x + dx, z + dz)) dz = 0;
    }
    const x = this.wantTarget.x + dx - this.centre.x;
    const z = this.wantTarget.z + dz - this.centre.z;
    const reach = Math.hypot(x, z);
    const scale = reach > this.bounds ? this.bounds / reach : 1;
    this.wantTarget.x = this.centre.x + x * scale;
    this.wantTarget.z = this.centre.z + z * scale;
  }

  private zoom(delta: number): void {
    // Street mode keeps the wheel, on a range of its own: the player still
    // wants to step back from a tower, and a mode that ignored the wheel would
    // read as a mode where the wheel was broken. Zooming past
    // STREET_MAX_RADIUS is what the mode toggle is for, not what the wheel is.
    const [low, high] =
      this.streetMode ? [STREET_MIN_RADIUS, STREET_MAX_RADIUS] : [MIN_RADIUS, this.maxRadius];
    this.wantRadius = THREE.MathUtils.clamp(this.wantRadius * Math.exp(delta * 0.0012), low, high);
  }

  private applyKeys(dt: number): void {
    if (this.keys.size === 0) return;
    // The orbit pan scales with the zoom so the world tracks the cursor at any
    // distance. At an arm of seven that would be six units a second down a
    // sixty-unit street, so street mode walks at a pace of its own instead.
    const speed = (this.streetMode ? STREET_PAN_SPEED : this.radius * 0.9) * dt;
    const cos = Math.cos(this.theta);
    const sin = Math.sin(this.theta);
    for (const key of this.keys) {
      const dir = PAN_KEYS[key];
      if (!dir) continue;
      const [kx, kz] = dir;
      // A key moves the camera the way it points; a drag moves the world under
      // the pointer, which is the same basis with the sign flipped. Borrowing
      // `pan`'s expression as it stands is what had W walking backwards.
      this.moveTarget((kx * sin + kz * cos) * speed, (kz * sin - kx * cos) * speed);
    }
  }

  private listen(): void {
    const dom = this.dom;

    const centre = (): { x: number; y: number; spread: number } => {
      let x = 0;
      let y = 0;
      for (const p of this.pointers.values()) {
        x += p.x;
        y += p.y;
      }
      const n = this.pointers.size;
      const points = [...this.pointers.values()];
      const a = points[0];
      const b = points[1];
      const spread = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      return { x: x / n, y: y / n, spread };
    };

    let last = { x: 0, y: 0, spread: 0 };

    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K | string,
      handler: (event: never) => void,
      options?: AddEventListenerOptions,
    ): void => {
      target.addEventListener(type, handler as EventListener, options);
      this.detach.push(() => target.removeEventListener(type, handler as EventListener, options));
    };

    on(dom, 'pointerdown', (event: PointerEvent) => {
      // Any input ends the tour, and this is the whole of that contract for a
      // touch device: there is no keyboard to press anything on, so the first
      // finger on the canvas is how a tour is stopped.
      this.stopTour();
      dom.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.interacting = true;
      last = centre();
      this.pinch = last.spread;
      // A second finger is never a click, however still it is held.
      this.dragged = this.pointers.size > 1;
      this.pressX = event.clientX;
      this.pressY = event.clientY;
      this.pressAt = event.timeStamp;
    });

    on(dom, 'pointermove', (event: PointerEvent) => {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const now = centre();
      const dx = now.x - last.x;
      const dy = now.y - last.y;

      if (this.pointers.size >= 2) {
        this.pan(dx, dy);
        if (this.pinch > 0 && now.spread > 0) this.zoom((this.pinch - now.spread) * 2.4);
        this.pinch = now.spread;
      } else if (event.shiftKey || event.buttons === 2 || event.buttons === 4) {
        this.pan(dx, dy);
      } else {
        this.orbit(dx, dy);
      }
      last = now;
      if (Math.hypot(event.clientX - this.pressX, event.clientY - this.pressY) > CLICK_SLOP) {
        this.dragged = true;
      }
    });

    const release = (event: PointerEvent): void => {
      const single = this.pointers.size === 1;
      this.pointers.delete(event.pointerId);
      if (dom.hasPointerCapture(event.pointerId)) dom.releasePointerCapture(event.pointerId);
      if (this.pointers.size === 0) this.interacting = false;
      else last = centre();
      this.pinch = 0;
      if (event.type !== 'pointerup' || !single || this.dragged) return;
      if (event.timeStamp - this.pressAt > CLICK_MS) return;
      if (Math.hypot(event.clientX - this.pressX, event.clientY - this.pressY) > CLICK_SLOP) return;
      this.onClick?.(event.clientX, event.clientY);
    };
    on(dom, 'pointerup', release);
    on(dom, 'pointercancel', release);

    on(
      dom,
      'wheel',
      (event: WheelEvent) => {
        event.preventDefault();
        this.stopTour();
        // Line-mode wheels report ~3 lines where pixel-mode reports ~100px.
        this.zoom(event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY);
      },
      { passive: false },
    );

    on(dom, 'contextmenu', (event: Event) => event.preventDefault());

    on(window, 'keydown', (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.tagName === 'BUTTON') return;
      if (PAN_KEYS[event.key]) {
        this.stopTour();
        this.keys.add(event.key);
        this.interacting = true;
      }
    });
    on(window, 'keyup', (event: KeyboardEvent) => {
      this.keys.delete(event.key);
      if (this.keys.size === 0 && this.pointers.size === 0) this.interacting = false;
    });
    on(window, 'blur', () => {
      this.keys.clear();
      this.pointers.clear();
      this.interacting = false;
    });
  }

  dispose(): void {
    for (const off of this.detach) off();
    this.detach.length = 0;
  }
}
