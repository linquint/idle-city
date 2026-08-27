import * as THREE from 'three';

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
  readonly target = new THREE.Vector3(0, 4, 0);

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
  private readonly centre = new THREE.Vector3(0, 4, 0);
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

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly drift: boolean,
  ) {
    this.listen();
    this.apply();
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
    this.centre.set(centre.x, 4, centre.z);

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
    } else if (reveal) {
      this.wantRadius = Math.max(this.wantRadius, framing);
      this.wantTarget.copy(this.centre);
    }
    this.wantRadius = Math.min(this.wantRadius, this.maxRadius);
  }

  /** Distance from the camera to what it is looking at, for fog fitting. */
  get distance(): number {
    return this.radius;
  }

  update(dt: number): void {
    this.applyKeys(dt);
    if (this.drift && !this.interacting) this.wantTheta += dt * DRIFT;

    // Frame-rate independent exponential damping.
    const k = 1 - Math.exp(-DAMPING * dt);
    this.theta += (this.wantTheta - this.theta) * k;
    this.phi += (this.wantPhi - this.phi) * k;
    this.radius += (this.wantRadius - this.radius) * k;
    this.target.lerp(this.wantTarget, k);
    this.apply();
  }

  private apply(): void {
    const sinPhi = Math.sin(this.phi);
    this.camera.position.set(
      this.target.x + this.radius * sinPhi * Math.cos(this.theta),
      this.target.y + this.radius * Math.cos(this.phi),
      this.target.z + this.radius * sinPhi * Math.sin(this.theta),
    );
    this.camera.lookAt(this.target);
  }

  private orbit(dx: number, dy: number): void {
    this.wantTheta -= dx * 0.006;
    this.wantPhi = THREE.MathUtils.clamp(this.wantPhi - dy * 0.005, MIN_PHI, MAX_PHI);
  }

  private pan(dx: number, dy: number): void {
    // Pan along the ground plane, in the direction the camera is facing, and
    // scale by distance so the world tracks the cursor at any zoom.
    const scale = this.radius * 0.0016;
    const cos = Math.cos(this.theta);
    const sin = Math.sin(this.theta);
    this.moveTarget(
      (-dx * sin - dy * cos) * scale,
      (dx * cos - dy * sin) * scale,
    );
  }

  /** Panning is bounded to the city, wherever the city currently happens to be. */
  private moveTarget(dx: number, dz: number): void {
    const x = this.wantTarget.x + dx - this.centre.x;
    const z = this.wantTarget.z + dz - this.centre.z;
    const reach = Math.hypot(x, z);
    const scale = reach > this.bounds ? this.bounds / reach : 1;
    this.wantTarget.x = this.centre.x + x * scale;
    this.wantTarget.z = this.centre.z + z * scale;
  }

  private zoom(delta: number): void {
    this.wantRadius = THREE.MathUtils.clamp(
      this.wantRadius * Math.exp(delta * 0.0012),
      MIN_RADIUS,
      this.maxRadius,
    );
  }

  private applyKeys(dt: number): void {
    if (this.keys.size === 0) return;
    const speed = this.radius * 0.9 * dt;
    const cos = Math.cos(this.theta);
    const sin = Math.sin(this.theta);
    for (const key of this.keys) {
      const dir = PAN_KEYS[key];
      if (!dir) continue;
      const [kx, kz] = dir;
      this.moveTarget((-kx * sin - kz * cos) * speed, (kx * cos - kz * sin) * speed);
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
        // Line-mode wheels report ~3 lines where pixel-mode reports ~100px.
        this.zoom(event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY);
      },
      { passive: false },
    );

    on(dom, 'contextmenu', (event: Event) => event.preventDefault());

    on(window, 'keydown', (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.tagName === 'BUTTON') return;
      if (PAN_KEYS[event.key]) {
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
