import * as THREE from 'three';
import { CELL } from '../sim/config';
import {
  COAST_DISTANCE,
  COAST_WAVE,
  RIVER_HALF,
  RIVER_SOURCE,
  WATERS,
  type Lake,
  type Shore,
} from '../sim/water';
import { GRASS_REACH, GRASS_Y } from './ground';
import { PALETTE } from './palette';

/**
 * The sea, the river and the lakes: one geometry, one material, one draw call.
 *
 * Built parametrically rather than marched off a grid, and from the *same*
 * numbers `sim/water.ts` tests against — the sea's inner edge is `shore(v)`
 * evaluated along the coast, the river is a ribbon around `riverCentre(u)`, a
 * lake is its own wobbled rim. Sampling a boolean field on a lattice instead
 * would give a staircase for a coastline and, worse, a second opinion about
 * where the water is: the one a ship could sail through and the one a district
 * could not be annexed into would drift apart at the edges.
 *
 * Nothing here animates and nothing reflects. What makes it read as water from
 * the play camera is the pale band along every shore and the fact that the same
 * key and hemisphere lights that carry the city through the day carry it too.
 */

/**
 * Where the surface sits.
 *
 * Above the grassland and below the districts' own ground, which is the whole
 * of the illusion: the plane is translucent, so the grass GRASS_Y below it
 * reads as a bottom, and the land tiles stand the difference proud of it as a
 * bank. Derived from GRASS_Y rather than stated, because it is the gap between
 * the two that does the work and a pair of independent numbers would drift.
 */
const WATER_Y = GRASS_Y + 0.2;

/**
 * How much of the ground below shows through.
 *
 * Measured against the grassland's own colours rather than picked: at 0.12
 * bleed the deep tone moves by about four points of green, which is enough to
 * read as depth over ground and far too little to read as green water.
 */
const OPACITY = 0.88;

/** How wide the pale band along a shore is. Just under two plots. */
const BAND = CELL * 1.75;

/**
 * How finely the coast is sampled, in world units.
 *
 * One plot. The shortest wavelength in `waves` is 37 units, so a plot puts nine
 * samples across the tightest bend the coastline can make and the shore reads
 * as a curve rather than as a run of chamfers. The whole sea is then 1,921
 * columns of three vertices — one geometry, and less of one than the grassland
 * it lies on.
 */
const STEP = CELL;

/** Segments around a lake. 72 is five degrees, which is smooth at any zoom. */
const LAKE_SEGMENTS = 72;

/**
 * Accumulates a triangle soup in the coast frame and hands back a geometry.
 *
 * Construction-time only — it allocates freely, and then everything it made is
 * dropped except the three typed arrays. The frame loop never comes near it.
 */
class Surface {
  private readonly position: number[] = [];
  private readonly color: number[] = [];
  private readonly index: number[] = [];
  private readonly point: Shore = { x: 0, z: 0 };
  private readonly tint = new THREE.Color();

  /** Adds one vertex at coast-frame (u, v) and returns its index. */
  vertex(u: number, v: number, hex: number): number {
    WATERS.toWorld(u, v, this.point);
    this.position.push(this.point.x, WATER_Y, this.point.z);
    this.tint.setHex(hex);
    this.color.push(this.tint.r, this.tint.g, this.tint.b);
    return this.position.length / 3 - 1;
  }

  /** Two triangles over four corners. */
  quad(a: number, b: number, c: number, d: number): void {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }

  /**
   * One triangle, wound so it faces up whichever way it was handed over.
   *
   * The winding is measured rather than assumed, and that is not fussiness:
   * three pieces are built by three loops that walk their own axes — the sea
   * along the shore, the river across it, a lake around itself — and which way
   * round that comes out also depends on which of four ways the coast is
   * facing this seed. A back-facing triangle here does not vanish, because the
   * material is double-sided; it renders *black*, since three flips the normal
   * for a back face and a surface lit from underneath gets the hemisphere
   * light's ground colour and nothing else. Measured once at build, on the
   * cross product's Y term, and then it cannot be got wrong.
   */
  triangle(a: number, b: number, c: number): void {
    const ax = this.position[a * 3] as number;
    const az = this.position[a * 3 + 2] as number;
    const ux = (this.position[b * 3] as number) - ax;
    const uz = (this.position[b * 3 + 2] as number) - az;
    const vx = (this.position[c * 3] as number) - ax;
    const vz = (this.position[c * 3 + 2] as number) - az;
    // +Y of (b - a) x (c - a) in a right-handed frame, which is what "wound
    // anticlockwise seen from above" means.
    if (uz * vx - ux * vz >= 0) this.index.push(a, b, c);
    else this.index.push(a, c, b);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    // Stated rather than computed. The surface is flat and level everywhere, so
    // every normal is +Y — and deriving them from the winding instead makes the
    // *lighting* depend on which way each piece happens to be walked: the sea
    // runs along the shore while the river runs across it, so one of the two
    // would come out lit from underneath. See DoubleSide below for the other
    // half of the same problem.
    const up = new Float32Array(this.position.length);
    for (let i = 1; i < up.length; i += 3) up[i] = 1;
    geometry.setAttribute('normal', new THREE.BufferAttribute(up, 3));
    geometry.setIndex(this.index);
    return geometry;
  }
}

/**
 * The open sea: a strip running the length of the coast, three vertices deep.
 *
 * The inner row is the shoreline itself, so there is no seam to hide — the
 * water simply stops where `shore` says it does. The middle row carries the
 * band inshore of the deep tone, and the outer one runs past the far plane.
 */
function sea(surface: Surface): void {
  let previous: [number, number, number] | null = null;
  for (let v = -GRASS_REACH; v <= GRASS_REACH; v += STEP) {
    const edge = WATERS.shore(v);
    const column: [number, number, number] = [
      surface.vertex(edge, v, PALETTE.shallow),
      surface.vertex(edge + BAND, v, PALETTE.water),
      surface.vertex(GRASS_REACH, v, PALETTE.water),
    ];
    if (previous) {
      surface.quad(previous[0], column[0], column[1], previous[1]);
      surface.quad(previous[1], column[1], column[2], previous[2]);
    }
    previous = column;
  }
}

/**
 * The river: a ribbon of four rows following the centreline, banks pale.
 *
 * Its mouth is not drawn and then clipped — every vertex is pulled back to
 * `shore` at its own along-shore position, so the ribbon ends exactly on the
 * coastline whatever angle it meets it at. Overshooting into the sea instead
 * would blend two translucent surfaces over each other and put a stain at the
 * river mouth; stopping short would leave a strip of grass between them.
 */
function river(surface: Surface): void {
  const across = [-RIVER_HALF, -RIVER_HALF + BAND, RIVER_HALF - BAND, RIVER_HALF];
  const tones = [PALETTE.shallow, PALETTE.water, PALETTE.water, PALETTE.shallow];
  let previous: number[] | null = null;
  // Past the furthest the shore can reach, so the clamp above has run out of
  // river to pull back before the loop runs out of steps.
  const mouth = COAST_DISTANCE + COAST_WAVE + STEP;
  for (let u = RIVER_SOURCE; u <= mouth; u += STEP) {
    const centre = WATERS.riverCentre(u);
    const column: number[] = [];
    for (let i = 0; i < across.length; i++) {
      const v = centre + (across[i] as number);
      column.push(surface.vertex(Math.min(u, WATERS.shore(v)), v, tones[i] as number));
    }
    if (previous) {
      for (let i = 0; i + 1 < column.length; i++) {
        surface.quad(
          previous[i] as number,
          column[i] as number,
          column[i + 1] as number,
          previous[i + 1] as number,
        );
      }
    }
    previous = column;
  }
}

/** One lake: a fan of deep water inside a pale rim. */
function lake(surface: Surface, it: Lake): void {
  const middle = surface.vertex(it.u, it.v, PALETTE.water);
  let previous: [number, number] | null = null;
  // Round-trip inclusive, so the last ring lands back on the first and closes
  // the fan without a seam vertex to match up.
  for (let i = 0; i <= LAKE_SEGMENTS; i++) {
    const theta = (i / LAKE_SEGMENTS) * Math.PI * 2;
    const rim =
      it.radius *
      (1 + it.wobbleA * Math.sin(3 * theta + it.phaseA) + it.wobbleB * Math.sin(5 * theta + it.phaseB));
    // The band is a share of the rim near the edge, never more than a third of
    // the way in: a small lake would otherwise be band all the way to its middle.
    const inner = rim - Math.min(BAND, rim * 0.35);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const ring: [number, number] = [
      surface.vertex(it.u + cos * inner, it.v + sin * inner, PALETTE.water),
      surface.vertex(it.u + cos * rim, it.v + sin * rim, PALETTE.shallow),
    ];
    if (previous) {
      surface.triangle(middle, previous[0], ring[0]);
      surface.quad(previous[0], previous[1], ring[1], ring[0]);
    }
    previous = ring;
  }
}

/**
 * The water layer.
 *
 * Built once in the constructor and never touched again: it has no per-district
 * state to reconcile, nothing about it depends on the game, and — unlike the
 * districts it lies between — it was always there.
 */
export class Water {
  constructor(scene: THREE.Scene) {
    const surface = new Surface();
    sea(surface);
    river(surface);
    for (const it of WATERS.lakes) lake(surface, it);

    const mesh = new THREE.Mesh(
      surface.build(),
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: true,
        opacity: OPACITY,
        // Depth *test* stays on, so a building in front of the sea still hides
        // it. Writing depth is what would be wrong: the transparent pass is
        // sorted back to front and a surface this large would occlude anything
        // translucent drawn behind it — the fires' glow, for one.
        depthWrite: false,
        // The grassland is 0.2 below the surface, and 0.2 is *less* than the
        // depth buffer can resolve out at the horizon: at 1,500 units from a
        // camera with a near plane of 0.5, one step of a 24-bit depth buffer is
        // about 0.27 world units, so the sea and the ground under it were
        // trading fragments in a dither across the far half of the frame.
        // Offsetting in depth-buffer units rather than world units is the fix
        // that scales with the distance the problem does. The factor is zero
        // because the surface is level: there is no slope for it to act on.
        polygonOffset: true,
        polygonOffsetFactor: 0,
        polygonOffsetUnits: -12,
      }),
    );
    // Flat, translucent and nowhere near a shadow caster — the dry margin keeps
    // every building six units clear of it — so shadows here would be a shadow
    // map lookup a frame for nothing anyone can see.
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
}
