import { mixSeed, rng, shuffle } from '../core/rng';
import { CELL, COMMERCE_SHARE, DISTRICT_SPAN, ROAD_BLOCK, SEED } from './config';

export interface Coord {
  /** Global grid column. Districts tile this space, so it goes negative. */
  readonly x: number;
  /** Global grid row. */
  readonly z: number;
}

export interface District {
  readonly index: number;
  /** District-space coordinate, spiralling out from (0, 0). */
  readonly coord: Coord;
  /** World-space centre of the district's land tile. */
  readonly centreX: number;
  readonly centreZ: number;
  readonly roads: readonly Coord[];
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** A constant column: the street here runs north-south. */
export const isRoadCol = (x: number): boolean => mod(x, ROAD_BLOCK) === 0;
/** A constant row: the street here runs east-west. */
export const isRoadRow = (z: number): boolean => mod(z, ROAD_BLOCK) === 0;

/** Streets run along every ROAD_BLOCKth *global* line, so they join across districts. */
export const isRoad = (x: number, z: number): boolean => isRoadCol(x) || isRoadRow(z);

/** Grid cell -> world-space centre, with district (0, 0) straddling the origin. */
const OFFSET = (DISTRICT_SPAN - 1) / 2;
export const worldX = (x: number): number => (x - OFFSET) * CELL;
export const worldZ = (z: number): number => (z - OFFSET) * CELL;

/** Side length of one district in world units. */
export const DISTRICT_WIDTH = DISTRICT_SPAN * CELL;

function countPlots(): number {
  let n = 0;
  for (let z = 0; z < DISTRICT_SPAN; z++)
    for (let x = 0; x < DISTRICT_SPAN; x++) if (!isRoad(x, z)) n++;
  return n;
}

/**
 * A district's plot count is a constant: DISTRICT_SPAN is a multiple of
 * ROAD_BLOCK, so every district carves out its streets in exactly the same
 * places. That lets the economy reason about capacity without building layouts.
 */
export const PLOTS_PER_DISTRICT = countPlots();
export const COMMERCIAL_PER_DISTRICT = Math.max(1, Math.round(PLOTS_PER_DISTRICT * COMMERCE_SHARE));
export const RESIDENTIAL_PER_DISTRICT = PLOTS_PER_DISTRICT - COMMERCIAL_PER_DISTRICT;

/**
 * The order in which a ring of districts gets annexed.
 *
 * Walking the perimeter in order would grow the city as a lopsided arc, with
 * every new district stuck to the last. Pairing each position with the one
 * directly opposite it instead means the city expands north, then south, then
 * north-east, then south-west — balanced around its own centre at every step.
 */
function ringCoords(r: number): Coord[] {
  if (r === 0) return [{ x: 0, z: 0 }];

  const edge: Coord[] = [];
  for (let x = -r; x <= r; x++) edge.push({ x, z: -r });
  for (let z = -r + 1; z <= r; z++) edge.push({ x: r, z });
  for (let x = r - 1; x >= -r; x--) edge.push({ x, z: r });
  for (let z = r - 1; z >= -r + 1; z--) edge.push({ x: -r, z });

  // Rotate so the ring opens due north, then interleave the two halves.
  const north = edge.findIndex((c) => c.x === 0 && c.z === -r);
  const walk = edge.slice(north).concat(edge.slice(0, north));
  const half = walk.length / 2;

  const order: Coord[] = [];
  for (let i = 0; i < half; i++) {
    order.push(walk[i] as Coord, walk[i + half] as Coord);
  }
  return order;
}

const coordCache: Coord[] = [];
let cachedRings = 0;

/** District index -> district-space coordinate. Stable forever. */
export function districtCoord(index: number): Coord {
  while (coordCache.length <= index) coordCache.push(...ringCoords(cachedRings++));
  return coordCache[index] as Coord;
}

/**
 * Where the built world sits. Districts spiral outward but a partial ring is
 * off-centre, so the camera has to look at the city rather than at the origin.
 */
export function cityCentre(districts: number): { x: number; z: number } {
  let x = 0;
  let z = 0;
  for (let i = 0; i < districts; i++) {
    const c = districtCoord(i);
    x += c.x;
    z += c.z;
  }
  return { x: (x / districts) * DISTRICT_WIDTH, z: (z / districts) * DISTRICT_WIDTH };
}

/** How far the built world reaches, in world units. Drives fog, shadows, camera. */
export function cityRadius(districts: number): number {
  let ring = 0;
  for (let i = 0; i < districts; i++) {
    const c = districtCoord(i);
    ring = Math.max(ring, Math.abs(c.x), Math.abs(c.z));
  }
  return (ring + 0.5) * DISTRICT_WIDTH;
}

interface DistrictPlots {
  readonly residential: Coord[];
  readonly commercial: Coord[];
  readonly roads: Coord[];
}

/**
 * Zones one district. Commerce is not scattered: a seeded anchor picks a high
 * street and the nearest plots become the commercial quarter, so every district
 * grows a recognisable centre instead of a uniform sprawl.
 */
function zoneDistrict(index: number): DistrictPlots {
  const c = districtCoord(index);
  const ox = c.x * DISTRICT_SPAN;
  const oz = c.z * DISTRICT_SPAN;

  const plots: Coord[] = [];
  const roads: Coord[] = [];
  for (let lz = 0; lz < DISTRICT_SPAN; lz++) {
    for (let lx = 0; lx < DISTRICT_SPAN; lx++) {
      const cell = { x: ox + lx, z: oz + lz };
      (isRoad(cell.x, cell.z) ? roads : plots).push(cell);
    }
  }

  const random = rng(mixSeed(SEED, index + 1));
  const anchorX = ox + Math.floor(random() * DISTRICT_SPAN);
  const anchorZ = oz + Math.floor(random() * DISTRICT_SPAN);

  // Sorting by squared distance keeps this integer-exact; the index tiebreak
  // keeps it deterministic when several plots sit the same distance away.
  const ranked = plots
    .map((cell, i) => {
      const dx = cell.x - anchorX;
      const dz = cell.z - anchorZ;
      return { cell, i, d: dx * dx + dz * dz };
    })
    .sort((a, b) => a.d - b.d || a.i - b.i);

  const commercial = ranked.slice(0, COMMERCIAL_PER_DISTRICT).map((r) => r.cell);
  const residential = ranked.slice(COMMERCIAL_PER_DISTRICT).map((r) => r.cell);

  // Build order is shuffled so a district fills in unevenly, like a real one.
  shuffle(residential, rng(mixSeed(SEED, index + 977)));
  shuffle(commercial, rng(mixSeed(SEED, index + 4013)));

  return { residential, commercial, roads };
}

/**
 * The city's plot book. Districts are appended, never rewritten, so a building
 * placed in district 1 keeps its exact plot after you annex district 20.
 */
export class CityLayout {
  private materialised = 0;
  private readonly _residential: Coord[] = [];
  private readonly _commercial: Coord[] = [];
  private readonly _districts: District[] = [];

  /** Materialises districts up to `count`. Idempotent and cheap to over-call. */
  ensure(count: number): this {
    for (let i = this.materialised; i < count; i++) {
      const { residential, commercial, roads } = zoneDistrict(i);
      this._residential.push(...residential);
      this._commercial.push(...commercial);
      const c = districtCoord(i);
      this._districts.push({
        index: i,
        coord: c,
        // worldX already folds OFFSET in, so the centre of a district's cells
        // is just its coordinate scaled up. Adding OFFSET again here slides
        // every land tile half a district off its own streets.
        centreX: c.x * DISTRICT_WIDTH,
        centreZ: c.z * DISTRICT_WIDTH,
        roads,
      });
    }
    this.materialised = Math.max(this.materialised, count);
    return this;
  }

  get districts(): readonly District[] {
    return this._districts;
  }

  /** Plot for the i-th home ever built. Index is stable across expansion. */
  homeCell(i: number): Coord {
    return this._residential[i] as Coord;
  }

  /** Plot for the i-th shop ever opened. */
  shopCell(i: number): Coord {
    return this._commercial[i] as Coord;
  }
}
