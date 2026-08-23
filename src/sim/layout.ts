import { mixSeed } from '../core/rng.ts';
import { generateDistrict, ZONE, type DistrictLayout, type Zone } from './citygen.ts';
import { CELL, DISTRICT_SPAN, FRONTAGE_TARGET, SEED, TARGET_PLOTS } from './config.ts';

/**
 * How many types share the 2x2 civic sites: hospital, police, fire, school.
 *
 * A number rather than an import of CIVIC_SERVICES, because `layout.ts` is the
 * bottom of the simulation and `economy.ts` already depends on it — taking the
 * list from config here would work, but the count is the only part of it this
 * file needs and `civicSiteFor` is called with the offset anyway.
 */
const CIVIC_TYPES = 4;

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

// ------------------------------------------------------------- civic siting

/**
 * A square a civic building can stand on: 2x2 for a hospital, police station,
 * fire station or school, 3x3 for a university.
 */
export interface CivicSite {
  /** Local cell index of the square's lower-left plot. The rest follow it. */
  readonly cell: number;
  /** Every plot, local cell indices, row-major from the lower-left. */
  readonly cells: readonly number[];
  /** The zone they all share. Never commercial. */
  readonly zone: Zone;
  /** Interior plots the square swallows. What sites are ranked on. */
  readonly dead: number;
}

/**
 * Every square of `size` plots a building could stand on, best first.
 *
 * Pure, and deliberately not in citygen.ts: the street generator is frozen, and
 * this is a read over its output rather than a part of it.
 *
 * A site needs every plot in one zone and at least one of them on a street.
 * Commercial squares are excluded outright — shop frontage is the scarcest land
 * in the district (31 plots, every one of them on a street) and a hospital
 * sitting on four of them would cost the city a seventh of its commerce.
 *
 * Sites are ranked by how much *dead* land they swallow, descending. A square at
 * the edge of a deep block covers street plots and interior plots that could
 * never be built on anyway, so preferring it turns courtyard into civic land
 * instead of eating housing frontage. Ties go to the lower cell index, so the
 * list is a pure function of the layout.
 */
function squares(layout: DistrictLayout, size: number): CivicSite[] {
  const found: CivicSite[] = [];
  for (let z = 0; z + size - 1 < DISTRICT_SPAN; z++) {
    for (let x = 0; x + size - 1 < DISTRICT_SPAN; x++) {
      const cell = z * DISTRICT_SPAN + x;
      const cells: number[] = [];
      for (let dz = 0; dz < size; dz++) {
        for (let dx = 0; dx < size; dx++) cells.push(cell + dz * DISTRICT_SPAN + dx);
      }
      const zone = layout.zone[cell] as Zone;
      if (zone !== ZONE.residential && zone !== ZONE.industrial) continue;
      if (!cells.every((c) => layout.zone[c] === zone)) continue;
      if (!cells.some((c) => layout.perimeter[c] === 1)) continue;
      found.push({ cell, cells, zone, dead: cells.filter((c) => layout.perimeter[c] === 0).length });
    }
  }
  found.sort((a, b) => b.dead - a.dead || a.cell - b.cell);
  return found;
}

/** Greedily takes non-overlapping sites out of a ranked list, marking `taken`. */
function claim(ranked: readonly CivicSite[], taken: Set<number>): CivicSite[] {
  const chosen: CivicSite[] = [];
  for (const site of ranked) {
    if (site.cells.some((c) => taken.has(c))) continue;
    for (const c of site.cells) taken.add(c);
    chosen.push(site);
  }
  return chosen;
}

/**
 * Every 3x3 square a university could stand on, best first, non-overlapping.
 *
 * Same shape and same dead-land ranking as `civicSites`, three plots to a side
 * instead of two. Reserved *before* the 2x2 pass, because a 3x3 is far rarer
 * than a 2x2 — over 4000 districts the fewest 3x3 candidates any of them offers
 * is 3, against dozens of 2x2s — so letting the civic pass go first would leave
 * districts with nowhere to put a university at all.
 *
 * Only ever one is used (FRONTAGE_TARGET.universitySites), but the whole ranked
 * list is returned for the same reason `civicSites` returns its whole list:
 * `districtPlan` reserves the sites it is told about, and the harness checks
 * the ranking rather than trusting it.
 */
export function universitySites(layout: DistrictLayout): readonly CivicSite[] {
  return claim(squares(layout, 3), new Set<number>());
}

/** Every 2x2 quad a civic building could stand on, best first, non-overlapping. */
export function civicSites(layout: DistrictLayout, taken = new Set<number>()): readonly CivicSite[] {
  return claim(squares(layout, 2), taken);
}

/** One district's land, split into what can be bought and what cannot. */
export interface DistrictPlan {
  readonly layout: DistrictLayout;
  /** 3x3 university sites, reserved before anything else. */
  readonly universities: readonly CivicSite[];
  readonly sites: readonly CivicSite[];
  /** Build order per zone: road-adjacent, and clear of every reserved site. */
  readonly residential: readonly number[];
  readonly commercial: readonly number[];
  readonly industrial: readonly number[];
  /** Zoned plots that are neither for sale nor reserved. Drawn as courtyards. */
  readonly courtyards: readonly number[];
}

/**
 * Reserves the university and every civic site up front and hands back what is
 * left.
 *
 * The university goes first because a 3x3 is the scarce shape: the 2x2 pass
 * would otherwise fragment the only squares big enough to hold one. Reserving
 * the whole site list rather than the sites a building has actually landed on is
 * what keeps `homeCapacity` independent of build order — the plot a house gets
 * must be recoverable from `{ homes: 41 }` alone, and it would not be if opening
 * a hospital shortened the housing list under it.
 */
export function districtPlan(layout: DistrictLayout): DistrictPlan {
  const reserved = new Set<number>();
  const universities = universitySites(layout).slice(0, FRONTAGE_TARGET.universitySites);
  for (const site of universities) for (const c of site.cells) reserved.add(c);
  const sites = civicSites(layout, reserved);

  const keep = (cells: readonly number[]): number[] => cells.filter((c) => !reserved.has(c));
  const residential = keep(layout.residential);
  const commercial = keep(layout.commercial);
  const industrial = keep(layout.industrial);

  const courtyards: number[] = [];
  const forSale = new Set([...residential, ...commercial, ...industrial]);
  for (let i = 0; i < layout.zone.length; i++) {
    if (layout.zone[i] === ZONE.road || reserved.has(i) || forSale.has(i)) continue;
    courtyards.push(i);
  }
  return { layout, universities, sites, residential, commercial, industrial, courtyards };
}

/** Whether a plan hits the counts every district has to agree on. */
function onTarget(plan: DistrictPlan): boolean {
  return (
    plan.residential.length === FRONTAGE_TARGET.residential &&
    plan.commercial.length === FRONTAGE_TARGET.commercial &&
    plan.industrial.length === FRONTAGE_TARGET.industrial &&
    plan.sites.length === FRONTAGE_TARGET.civicSites &&
    plan.universities.length === FRONTAGE_TARGET.universitySites
  );
}

/**
 * Reseeds a district until it lands on FRONTAGE_TARGET. See that constant.
 *
 * Raised from 256 with the university: the tuple is reached by 3.28% of plans
 * rather than 8.8%, so the same headroom costs twice the attempts. At 512 the
 * probability of exhausting them is 3.9e-8 per district, or about 2e-6 across a
 * full 49-district city — measured over 20,000 plans, not assumed.
 */
export const FRONTAGE_MAX_ATTEMPTS = 512;

export function planFor(seed: number): DistrictPlan {
  for (let i = 0; i < FRONTAGE_MAX_ATTEMPTS; i++) {
    const plan = districtPlan(generateDistrict(mixSeed(seed, i * 2 + 1)));
    if (onTarget(plan)) return plan;
  }
  // Throwing beats shipping a district the economy cannot count.
  throw new Error(`no on-target district for seed ${seed} in ${FRONTAGE_MAX_ATTEMPTS} attempts`);
}

/**
 * Every district's plan, keyed by district-space coordinate.
 *
 * Keying on the *coordinate* rather than the annexation index is what lets
 * `isRoad` answer for land nobody has bought yet — the renderer needs the
 * neighbouring district's streets to tell a T-junction from a straight run at
 * a boundary, and a district's layout must not depend on when it was annexed.
 */
const plans = new Map<string, DistrictPlan>();

export function districtPlanAt(dx: number, dz: number): DistrictPlan {
  const key = `${dx},${dz}`;
  let plan = plans.get(key);
  if (!plan) {
    plan = planFor(mixSeed(mixSeed(SEED, dx * 2 + 1), dz * 2 + 1));
    plans.set(key, plan);
  }
  return plan;
}

export function districtLayoutAt(dx: number, dz: number): DistrictLayout {
  return districtPlanAt(dx, dz).layout;
}

/**
 * Streets are a lookup against two per-district masks, not arithmetic: spacing
 * is irregular now, so there is no modulus that answers this.
 *
 * Local line 0 is always a road and local line DISTRICT_SPAN is the *next*
 * district's line 0. Sharing that boundary line rather than giving every
 * district its own perimeter keeps district edges a single-width street, and is
 * what makes streets still meet across districts.
 */
export function isRoad(x: number, z: number): boolean {
  const layout = districtLayoutAt(Math.floor(x / DISTRICT_SPAN), Math.floor(z / DISTRICT_SPAN));
  return (
    layout.rowRoad[mod(z, DISTRICT_SPAN)] === 1 || layout.colRoad[mod(x, DISTRICT_SPAN)] === 1
  );
}

/** Zoning of a global cell. Roads report ZONE.road. */
export function zoneAt(x: number, z: number): Zone {
  const layout = districtLayoutAt(Math.floor(x / DISTRICT_SPAN), Math.floor(z / DISTRICT_SPAN));
  const local = mod(z, DISTRICT_SPAN) * DISTRICT_SPAN + mod(x, DISTRICT_SPAN);
  return layout.zone[local] as Zone;
}

/** Grid cell -> world-space centre, with district (0, 0) straddling the origin. */
const OFFSET = (DISTRICT_SPAN - 1) / 2;
export const worldX = (x: number): number => (x - OFFSET) * CELL;
export const worldZ = (z: number): number => (z - OFFSET) * CELL;

/** Side length of one district in world units. */
export const DISTRICT_WIDTH = DISTRICT_SPAN * CELL;

/**
 * Zoned land per district: 90 plots, whatever the streets do.
 *
 * This is *not* how much of it can be built on. It is the denominator the
 * zoning budget splits and nothing else — see the four constants below, which
 * are the ones capacity is made of. Conflating the two is the mistake this pair
 * of comments exists to prevent.
 */
export const PLOTS_PER_DISTRICT = TARGET_PLOTS;

/**
 * Buildable land per district: the plots that front a street and are not
 * reserved for a site. 24 + 31 + 8 = 63 of the 100 zoned plots are for sale, 24
 * more are held for the six 2x2 civic sites, 9 for the one 3x3 university, and
 * the last 4 are interior land the renderer draws as courtyard.
 *
 * These are constants because `districtPlanAt` reseeds until they are — the
 * road-adjacent split is not seed-invariant on its own. See FRONTAGE_TARGET.
 */
/**
 * Park land per district: whatever is left once frontage, civic sites and the
 * university are taken out. Arithmetic, not a measurement — 100 zoned plots less
 * 24 + 31 + 8 for sale, 6 x 4 held for civic sites and 1 x 9 for the university
 * leaves exactly 4, in every district, for every seed, because `districtPlanAt`
 * reseeds until the other numbers are exact. These are the plots `districtPlan`
 * already reports as courtyards.
 *
 * Holding this at 4 across the university change is the whole reason
 * DISTRICT_SPAN moved: at span 12 the reachable tuple left zero, and park land
 * at zero is a happiness term that can never be earned.
 */
export const BUILDABLE_PARKS_PER_DISTRICT =
  TARGET_PLOTS -
  FRONTAGE_TARGET.residential -
  FRONTAGE_TARGET.commercial -
  FRONTAGE_TARGET.industrial -
  FRONTAGE_TARGET.civicSites * 4 -
  FRONTAGE_TARGET.universitySites * 9;

export const BUILDABLE_RESIDENTIAL_PER_DISTRICT = FRONTAGE_TARGET.residential;
export const BUILDABLE_COMMERCIAL_PER_DISTRICT = FRONTAGE_TARGET.commercial;
export const BUILDABLE_INDUSTRIAL_PER_DISTRICT = FRONTAGE_TARGET.industrial;
export const CIVIC_SITES_PER_DISTRICT = FRONTAGE_TARGET.civicSites;
export const UNIVERSITY_SITES_PER_DISTRICT = FRONTAGE_TARGET.universitySites;

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
  readonly industrial: Coord[];
  /** Lower-left plot of each civic site, in site order. */
  readonly civic: Coord[];
  /** Lower-left plot of each university site, in site order. */
  readonly universities: Coord[];
  readonly courtyards: Coord[];
  readonly roads: Coord[];
}

/**
 * Lifts one district's plan into global coordinates. The generator has already
 * zoned block-wise and shuffled the build order inside each zone, and
 * `districtPlan` has already taken the civic sites out, so there is nothing to
 * decide here.
 */
function placeDistrict(index: number): DistrictPlots {
  const c = districtCoord(index);
  const ox = c.x * DISTRICT_SPAN;
  const oz = c.z * DISTRICT_SPAN;
  const plan = districtPlanAt(c.x, c.z);

  const toGlobal = (local: number): Coord => ({
    x: ox + (local % DISTRICT_SPAN),
    z: oz + Math.floor(local / DISTRICT_SPAN),
  });

  const roads: Coord[] = [];
  for (let lz = 0; lz < DISTRICT_SPAN; lz++) {
    for (let lx = 0; lx < DISTRICT_SPAN; lx++) {
      if (plan.layout.zone[lz * DISTRICT_SPAN + lx] === ZONE.road) {
        roads.push({ x: ox + lx, z: oz + lz });
      }
    }
  }

  return {
    residential: plan.residential.map(toGlobal),
    commercial: plan.commercial.map(toGlobal),
    industrial: plan.industrial.map(toGlobal),
    civic: plan.sites.map((site) => toGlobal(site.cell)),
    universities: plan.universities.map((site) => toGlobal(site.cell)),
    courtyards: plan.courtyards.map(toGlobal),
    roads,
  };
}

/**
 * The city's plot book. Districts are appended, never rewritten, so a building
 * placed in district 1 keeps its exact plot after you annex district 20.
 */
export class CityLayout {
  private materialised = 0;
  private readonly _residential: Coord[] = [];
  private readonly _commercial: Coord[] = [];
  private readonly _industrial: Coord[] = [];
  private readonly _civic: Coord[] = [];
  private readonly _universities: Coord[] = [];
  private readonly _courtyards: Coord[] = [];
  private readonly _districts: District[] = [];

  /** Materialises districts up to `count`. Idempotent and cheap to over-call. */
  ensure(count: number): this {
    for (let i = this.materialised; i < count; i++) {
      const { residential, commercial, industrial, civic, universities, courtyards, roads } =
        placeDistrict(i);
      this._residential.push(...residential);
      this._commercial.push(...commercial);
      this._industrial.push(...industrial);
      this._civic.push(...civic);
      this._universities.push(...universities);
      this._courtyards.push(...courtyards);
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

  /** Plot for the i-th industrial building. */
  industryCell(i: number): Coord {
    return this._industrial[i] as Coord;
  }

  /**
   * Lower-left plot of the i-th civic site. The building spans this plot and the
   * three at +x, +z and +x+z.
   *
   * Sites are reserved up front, so this list never moves: annexing land appends
   * to it and changes nothing already in it.
   */
  civicSiteCell(i: number): Coord {
    return this._civic[i] as Coord;
  }

  /** How many 2x2 civic sites the city owns. */
  get civicSites(): number {
    return this._civic.length;
  }

  /**
   * Lower-left plot of the i-th university site. The building spans this plot
   * and the eight at +x, +z out to +2x+2z.
   *
   * Its own list rather than a slot in the civic interleave: a university is a
   * different shape, one to a district, and mixing a 3x3 into a list of 2x2s
   * would mean every consumer of `civicSiteCell` had to ask how big the site it
   * just got is.
   */
  universitySiteCell(i: number): Coord {
    return this._universities[i] as Coord;
  }

  /** How many 3x3 university sites the city owns. One per district. */
  get universitySites(): number {
    return this._universities.length;
  }

  /**
   * Which site each 2x2 type draws on: hospitals take 4k, police 4k+1, fire
   * 4k+2 and schools 4k+3, out of one fixed city-wide list.
   *
   * A fixed interleave, not "whichever district is worst covered". Assigning
   * greedily against coverage would make the i-th hospital's position depend on
   * what the city looked like the moment it was built, and a save stores counts
   * — so the city would rearrange itself on the next refresh. Indexing is the
   * only rule that survives a reload.
   *
   * Four types over six sites a district rather than three over seven: the
   * university took a 3x3 out of the land before the 2x2 pass ran, and schools
   * joined the pool that was left. The first district gets 2/2/1/1.
   */
  civicSiteFor(offset: number, i: number): Coord {
    return this.civicSiteCell(i * CIVIC_TYPES + offset);
  }

  /**
   * Plot for the i-th park.
   *
   * Parks are the front of the courtyard list, the same way homes are the front
   * of the residential one. That is what makes `{ parks: 11 }` enough to place
   * every one of them, and it is why a park never has to be told where it is.
   */
  parkCell(i: number): Coord {
    return this._courtyards[i] as Coord;
  }

  /**
   * Every interior plot the city owns, park or not.
   *
   * The first `parks` of these carry a park; the rest are drawn as courtyard.
   * One list rather than two, because a park does not move a plot from one
   * category to another — it puts something on land the city already had.
   */
  get courtyards(): readonly Coord[] {
    return this._courtyards;
  }

  /** Every plot of one zone, in build order. Used by the zone overlay. */
  zoneCells(zone: Zone): readonly Coord[] {
    if (zone === ZONE.commercial) return this._commercial;
    if (zone === ZONE.industrial) return this._industrial;
    return this._residential;
  }
}
