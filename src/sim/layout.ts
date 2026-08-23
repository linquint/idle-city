import { mixSeed } from '../core/rng.ts';
import { generateDistrict, ZONE, type DistrictLayout, type Zone } from './citygen.ts';
import { CELL, DISTRICT_SPAN, FRONTAGE_TARGET, SEED, TARGET_PLOTS } from './config.ts';

/**
 * How many types share the 2x2 civic sites: hospital, police, fire, school and
 * the transit depot.
 *
 * A number rather than an import of CIVIC_SERVICES, because `layout.ts` is the
 * bottom of the simulation and `economy.ts` already depends on it — taking the
 * list from config here would work, but the count is the only part of it this
 * file needs and `civicSiteFor` is called with the offset anyway.
 */
const CIVIC_TYPES = 5;

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

// ---------------------------------------------------------------- parcels

/**
 * The spatial unit a building stands on: one plot, or two adjacent ones.
 *
 * Levels 0 and 1 stand on a single plot; reaching level 2 *merges* two
 * neighbours into one building, and level 3 grows upward on that same two-plot
 * footprint (LEVEL_FOOTPRINT). So the thing capacity is counted in is the plot,
 * and the thing a building occupies is the parcel.
 *
 * Two plots, never four. Measured over 100 districts by greedily pairing
 * frontage into 2x1 dominoes and then pairing those into 2x2 quads
 * (tools/parcels.calibrate.mjs):
 *
 *   residential  24 plots -> 10.5 dominoes (min 10), 3.0 unpairable (max 4), 0.0 quads
 *   commercial   31 plots -> 15.0 dominoes (min 15), 1.0 unpairable (max 1), 0.4 quads
 *   industrial    8 plots ->  3.0 dominoes (min  3), 2.0 unpairable (max 2), 0.0 quads
 *
 * Quads effectively do not exist, and that is structural rather than unlucky:
 * `universitySites` and `civicSites` are ranked on dead land, so they take
 * exactly the deep-block interiors, and what is left for sale is a one-plot-wide
 * perimeter ring. A 2x2 merge would have to be carved back out of park or civic
 * land. Do not "fix" the ordering below to find quads — there are none to find.
 */

/**
 * Pairs one zone's frontage into parcels: adjacent pairs first, singles last.
 *
 * The matching walks cells in ascending index and prefers the horizontal
 * partner over the vertical one, so it is a pure function of the layout and not
 * of the build order it is handed. The *emission* order is the build order the
 * generator shuffled, so a district still fills in unevenly — only now its two
 * halves of a parcel arrive together.
 *
 * Singles last is what makes the merge rule expressible as a count: merging
 * always takes the next two-plot parcel, so the unpairable plots of a district
 * are the ones nothing ever merges and they cap at level 1. That is three
 * residential plots a district — a permanent low-rise fringe, which is variety
 * rather than a defect.
 */
export function parcelOrder(cells: readonly number[]): {
  cells: readonly number[];
  sizes: readonly number[];
} {
  const zoned = new Set(cells);
  const partner = new Map<number, number>();
  const paired = new Set<number>();
  const last = DISTRICT_SPAN * DISTRICT_SPAN;

  for (const cell of [...cells].sort((a, b) => a - b)) {
    if (paired.has(cell)) continue;
    const right = cell + 1;
    const below = cell + DISTRICT_SPAN;
    const mate =
      cell % DISTRICT_SPAN !== DISTRICT_SPAN - 1 && zoned.has(right) && !paired.has(right)
        ? right
        : below < last && zoned.has(below) && !paired.has(below)
          ? below
          : -1;
    if (mate < 0) continue;
    paired.add(cell);
    paired.add(mate);
    partner.set(cell, mate);
    partner.set(mate, cell);
  }

  const ordered: number[] = [];
  const sizes: number[] = [];
  const placed = new Set<number>();
  for (const cell of cells) {
    if (placed.has(cell) || !paired.has(cell)) continue;
    const mate = partner.get(cell) as number;
    placed.add(cell);
    placed.add(mate);
    ordered.push(cell, mate);
    sizes.push(2);
  }
  for (const cell of cells) {
    if (paired.has(cell)) continue;
    ordered.push(cell);
    sizes.push(1);
  }
  return { cells: ordered, sizes };
}

/** One district's land, split into what can be bought and what cannot. */
export interface DistrictPlan {
  readonly layout: DistrictLayout;
  /** 3x3 university sites, reserved before anything else. */
  readonly universities: readonly CivicSite[];
  readonly sites: readonly CivicSite[];
  /**
   * Build order per zone: road-adjacent, clear of every reserved site, and
   * ordered parcel by parcel — see `parcelOrder`.
   */
  readonly residential: readonly number[];
  readonly commercial: readonly number[];
  readonly industrial: readonly number[];
  /** Plots in each parcel, in the same order the lists above are laid out in. */
  readonly residentialParcels: readonly number[];
  readonly commercialParcels: readonly number[];
  readonly industrialParcels: readonly number[];
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
  // Paired after the sites are reserved, never before: a plot a hospital is
  // standing on is not a plot anything can merge with.
  const residential = parcelOrder(keep(layout.residential));
  const commercial = parcelOrder(keep(layout.commercial));
  const industrial = parcelOrder(keep(layout.industrial));

  const courtyards: number[] = [];
  const forSale = new Set([...residential.cells, ...commercial.cells, ...industrial.cells]);
  for (let i = 0; i < layout.zone.length; i++) {
    if (layout.zone[i] === ZONE.road || reserved.has(i) || forSale.has(i)) continue;
    courtyards.push(i);
  }
  return {
    layout,
    universities,
    sites,
    residential: residential.cells,
    commercial: commercial.cells,
    industrial: industrial.cells,
    residentialParcels: residential.sizes,
    commercialParcels: commercial.sizes,
    industrialParcels: industrial.sizes,
    courtyards,
  };
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

/**
 * One zone's parcels across the whole city, appended district by district.
 *
 * The lookup that turns a building's *ordinal* into the land it stands on, with
 * nothing spatial stored anywhere: given how many parcels of the zone have been
 * merged, a building's parcel, footprint and cells are arithmetic over the two
 * prefix tables below. Append-only, exactly like the plot lists it indexes, so
 * annexing land never moves a building that is already standing.
 *
 * Slots are ordered merged-first: slot j < merged is the j-th two-plot parcel,
 * and every slot past that is one plot of what is left, in parcel order. That
 * ordering is what keeps `levelAt` a plain cohort walk — buildings take levels
 * oldest-first and the merged ones are exactly the oldest.
 */
export class ParcelBook {
  private readonly size: number[] = [];
  /** Where each parcel starts in the zone's flat plot list. */
  private readonly begin: number[] = [];
  /** Parcel index of the j-th two-plot parcel. */
  private readonly pairAt: number[] = [];
  /** Two-plot parcels lying before each parcel. */
  private readonly pairsBefore: number[] = [];
  /** Two-plot parcels in the first d districts, indexed by d. */
  private readonly pairsThrough: number[] = [0];
  private total = 0;

  /** Appends one district's parcels. Sizes are 1 or 2, pairs first. */
  push(sizes: readonly number[]): void {
    for (const size of sizes) {
      this.begin.push(this.total);
      this.pairsBefore.push(this.pairAt.length);
      if (size === 2) this.pairAt.push(this.size.length);
      this.size.push(size);
      this.total += size;
    }
    this.pairsThrough.push(this.pairAt.length);
  }

  /**
   * Two-plot parcels in the first `districts` districts. The ceiling on merges.
   *
   * Asked per district count rather than read off the whole book, because a book
   * is grown by whoever needs the most land and never shrinks: a city of one
   * district must not be told it owns the pairs of a city of forty that happened
   * to be read first. Districts vary in how many pairs they offer — 10 to 11 of
   * housing, measured — so this is a running total rather than a multiplication.
   */
  pairs(districts: number): number {
    const at = Math.max(0, Math.min(districts, this.pairsThrough.length - 1));
    return this.pairsThrough[at] as number;
  }

  /** Plots the city owns in this zone. Equals the zone's capacity. */
  get plots(): number {
    return this.total;
  }

  /** The two plot indices of the j-th merged parcel, into the flat plot list. */
  mergedPlot(j: number, half: 0 | 1): number {
    return (this.begin[this.pairAt[j] as number] as number) + half;
  }

  /**
   * Where the next parcel to merge starts, counted in unmerged plots.
   *
   * Usually zero: merging takes the two-plot parcels off the front, so the front
   * of what is left is the next one. It is not zero once a district's pairs are
   * spent — its unpairable plots are then sitting at the front of the list and
   * nothing will ever merge them, so the next pair is that many plots along.
   */
  pairFront(merged: number): number {
    if (merged >= this.pairAt.length) return Number.POSITIVE_INFINITY;
    return (this.begin[this.pairAt[merged] as number] as number) - 2 * merged;
  }

  /**
   * How many plots the parcel holding a given plot has: 1 or 2.
   *
   * What the inspector needs to tell a building at level 1 that is waiting for
   * its turn to merge from one that will never get one. Unmerged, both look the
   * same on the ground; only the parcel under them says which is which.
   */
  parcelPlots(plot: number): number {
    let lo = 0;
    let hi = this.size.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.begin[mid] as number) <= plot) lo = mid;
      else hi = mid - 1;
    }
    return this.size[lo] as number;
  }

  /** Flat plot index of the u-th unmerged plot, with `merged` parcels taken. */
  unmergedPlot(u: number, merged: number): number {
    // Binary search for the last parcel whose unmerged start is at or before u.
    // A merged parcel contributes nothing, so its start equals its successor's
    // and taking the *last* match walks past it without a second test.
    let lo = 0;
    let hi = this.size.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.unmergedStart(mid, merged) <= u) lo = mid;
      else hi = mid - 1;
    }
    return (this.begin[lo] as number) + (u - this.unmergedStart(lo, merged));
  }

  private unmergedStart(parcel: number, merged: number): number {
    return (
      (this.begin[parcel] as number) - 2 * Math.min(merged, this.pairsBefore[parcel] as number)
    );
  }
}

function parcelsOf(plan: DistrictPlan, zone: Zone): readonly number[] {
  if (zone === ZONE.commercial) return plan.commercialParcels;
  if (zone === ZONE.industrial) return plan.industrialParcels;
  return plan.residentialParcels;
}

const PARCEL_ZONES: readonly Zone[] = [ZONE.residential, ZONE.commercial, ZONE.industrial];

/** One set of books, per zone, grown district by district. */
class ParcelBooks {
  private readonly books = new Map<Zone, ParcelBook>(
    PARCEL_ZONES.map((zone) => [zone, new ParcelBook()]),
  );
  private districts = 0;

  of(zone: Zone, districts: number): ParcelBook {
    for (let i = this.districts; i < districts; i++) {
      const c = districtCoord(i);
      const plan = districtPlanAt(c.x, c.z);
      for (const z of PARCEL_ZONES) (this.books.get(z) as ParcelBook).push(parcelsOf(plan, z));
    }
    this.districts = Math.max(this.districts, districts);
    return this.books.get(zone) as ParcelBook;
  }
}

/**
 * The simulation's parcel books.
 *
 * Module-level for the same reason `plans` is: `economy.ts` has no `CityLayout`
 * of its own and needs to know how many pairs the city owns before it will let
 * one merge. `CityLayout` keeps a set of its own rather than sharing this one —
 * its plot lists are the thing the book indexes, and a book grown past the
 * districts that layout has materialised would index off the end of them.
 * District order is fixed, so two books at the same district count are equal.
 */
const cityBooks = new ParcelBooks();

/** The parcel book for one zone, materialised out to `districts`. */
export function parcelBook(zone: Zone, districts: number): ParcelBook {
  return cityBooks.of(zone, districts);
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
 * Where one building stands, filled in place.
 *
 * Written into a caller-owned object rather than returned fresh: the renderer
 * asks this per building per rebuild and per in-flight animation per frame, and
 * a `{ x, z }` per call is a per-frame allocation.
 */
export interface Placement {
  /** World-space centre of the footprint. */
  x: number;
  z: number;
  /** Plots it covers: one, or two once its parcel has merged. */
  plots: number;
  /** For a merged parcel, whether its two plots differ in x rather than in z. */
  alongX: boolean;
  /** Index of its first plot in the zone's flat list. Identifies the parcel. */
  plot: number;
  /**
   * Plots in the parcel this building stands on, merged or not.
   *
   * `plots` says what the building covers *now*; this says what it could ever
   * cover. They differ for exactly one building: one at the level below
   * MERGE_LEVEL standing on a pair that has not merged yet. Where they are both
   * 1 the plot has no neighbour and never will.
   */
  parcelPlots: number;
}

export const createPlacement = (): Placement => ({
  x: 0,
  z: 0,
  plots: 1,
  alongX: true,
  plot: 0,
  parcelPlots: 1,
});

/**
 * The city's plot book. Districts are appended, never rewritten, so a building
 * placed in district 1 keeps its exact plot after you annex district 20.
 */
export class CityLayout {
  private materialised = 0;
  /** This layout's own parcel books. See `cityBooks` for why they are not shared. */
  private readonly books = new ParcelBooks();
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

  /**
   * Where the k-th building of a zone stands, given how many of its parcels
   * have merged.
   *
   * A pure function of two counts and the seed, which is the whole point: the
   * save carries `{ homes, mergedR }` and the position of every building in the
   * city falls out of them. Slots are merged-first — see `ParcelBook`.
   */
  place(zone: Zone, slot: number, merged: number, out: Placement): Placement {
    const book = this.books.of(zone, this.materialised);
    const cells = this.zoneCells(zone);
    // Clamped rather than trusted. `migrate` and `Game` both keep the counts
    // inside the land, but this is the one place a state that got past them
    // would index off the end of a plot list — and the renderer's answer to a
    // broken save has to be a wrong-looking city, not a thrown frame.
    merged = Math.max(0, Math.min(merged, book.pairs(this.materialised)));
    if (slot < merged) {
      const first = book.mergedPlot(slot, 0);
      const a = cells[first] as Coord;
      const b = cells[book.mergedPlot(slot, 1)] as Coord;
      out.plot = first;
      out.plots = 2;
      out.parcelPlots = 2;
      out.alongX = a.x !== b.x;
      out.x = (worldX(a.x) + worldX(b.x)) / 2;
      out.z = (worldZ(a.z) + worldZ(b.z)) / 2;
      return out;
    }
    const plot = Math.min(book.unmergedPlot(slot - merged, merged), cells.length - 1);
    const cell = (cells[Math.max(0, plot)] ?? cells[0]) as Coord;
    out.plot = plot;
    out.plots = 1;
    out.parcelPlots = book.parcelPlots(plot);
    out.alongX = true;
    out.x = worldX(cell.x);
    out.z = worldZ(cell.z);
    return out;
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
   * Which site each 2x2 type draws on: hospitals take 5k, police 5k+1, fire
   * 5k+2, schools 5k+3 and depots 5k+4, out of one fixed city-wide list.
   *
   * A fixed interleave, not "whichever district is worst covered". Assigning
   * greedily against coverage would make the i-th hospital's position depend on
   * what the city looked like the moment it was built, and a save stores counts
   * — so the city would rearrange itself on the next refresh. Indexing is the
   * only rule that survives a reload.
   *
   * Five types over six sites a district: the university took a 3x3 out of the
   * land before the 2x2 pass ran, and schools and then transit joined the pool
   * that was left. The first district gets 2/1/1/1/1, so a young city can open
   * one of everything and a second hospital before it needs more land.
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
