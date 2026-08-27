import { mixSeed } from '../core/rng.ts';
import { generateDistrict, ZONE, type DistrictLayout, type Zone } from './citygen.ts';
import { WATERS } from './water.ts';
import {
  CELL,
  DISTRICT_SPAN,
  FRONTAGE_TARGET,
  ZONE_FLOOR,
  LANDMARKS,
  SEED,
  TARGET_PLOTS,
  type Landmark,
} from './config.ts';

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
 * in the district (45 plots, every one of them on a street) and a hospital
 * sitting on four of them would cost the city a tenth of its commerce.
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
 * (tools/parcels.calibrate.mjs), and re-measured at the wider district:
 *
 *   residential  24 plots -> 10.9 dominoes (min  9), 2.2 unpairable (max 6), 0.0 quads
 *   commercial   45 plots -> 22.0 dominoes (min 22), 1.0 unpairable (max 1), 2.1 quads
 *   industrial   13 plots ->  5.7 dominoes (min  5), 1.7 unpairable (max 3), 0.0 quads
 *
 * Residential quads still do not exist, and that is structural rather than
 * unlucky: `universitySites` and `civicSites` are ranked on dead land, so they
 * take exactly the deep-block interiors, and what is left for sale is a
 * one-plot-wide perimeter ring. A 2x2 merge would have to be carved back out of
 * park or civic land. Do not "fix" the ordering below to find quads — there are
 * none to find, and it is housing the footprint ladder is a statement about.
 *
 * Commerce found two a district at span 15 where it had 0.4 at span 13, which
 * is the extra frontage doubling back on itself in the deeper blocks. Nothing
 * reads them: LEVEL_FOOTPRINT stops at two for every zone, so a commercial quad
 * is just a pair of dominoes that happen to be adjacent.
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

/**
 * A run of parcels: the cells, and how many plots each parcel holds.
 *
 * The pair `parcelOrder` returns, named so the pool below can pass it around
 * whole. Cells are laid out parcel by parcel, so `sizes[k]` covers the cells at
 * the running offset — see `parcelPlots` for the reader.
 */
export interface Parcels {
  readonly cells: readonly number[];
  readonly sizes: readonly number[];
}

/** Plots a run of parcels covers. */
export const parcelPlots = (p: Parcels): number => p.cells.length;

/** Plots the first `n` parcels of a run cover. */
export function plotsThrough(p: Parcels, n: number): number {
  const take = Math.max(0, Math.min(n, p.sizes.length));
  let plots = 0;
  for (let i = 0; i < take; i++) plots += p.sizes[i] as number;
  return plots;
}

/**
 * Cuts a run of parcels in two at the first parcel boundary at or past `plots`.
 *
 * At a boundary, never inside one, and that is the whole reason the zoning pool
 * is counted in parcels rather than plots. A merge takes the two halves of a
 * parcel together, so a boundary that fell inside one would hand each half to a
 * different zone and neither could ever merge — and worse, moving the boundary
 * by a plot would turn a single into a pair and reorder `ParcelBook`'s merged
 * slots underneath buildings that are already standing.
 */
export function cutParcels(p: Parcels, plots: number): { head: Parcels; tail: Parcels } {
  let taken = 0;
  let parcel = 0;
  while (parcel < p.sizes.length && taken < plots) {
    taken += p.sizes[parcel] as number;
    parcel++;
  }
  return {
    head: { cells: p.cells.slice(0, taken), sizes: p.sizes.slice(0, parcel) },
    tail: { cells: p.cells.slice(taken), sizes: p.sizes.slice(parcel) },
  };
}

/** A run of parcels with the *parcel* order reversed, each parcel's cells intact. */
export function reverseParcels(p: Parcels): Parcels {
  const cells: number[] = [];
  const sizes: number[] = [];
  let end = p.cells.length;
  for (let i = p.sizes.length - 1; i >= 0; i--) {
    const size = p.sizes[i] as number;
    cells.push(...p.cells.slice(end - size, end));
    sizes.push(size);
    end -= size;
  }
  return { cells, sizes };
}

/** Two runs of parcels, end to end. */
export const joinParcels = (a: Parcels, b: Parcels): Parcels => ({
  cells: [...a.cells, ...b.cells],
  sizes: [...a.sizes, ...b.sizes],
});

/** The first `n` parcels of a run. */
export const takeParcels = (p: Parcels, n: number): Parcels => {
  const take = Math.max(0, Math.min(n, p.sizes.length));
  const plots = plotsThrough(p, take);
  return { cells: p.cells.slice(0, plots), sizes: p.sizes.slice(0, take) };
};

/**
 * One district's sellable land, arranged so its split can float without moving
 * anything already standing.
 *
 * Five runs, and every one of a district's 82 plots is in exactly one of them:
 *
 *   homeFloor      the housing a district keeps whatever happens
 *   shopFloor      the same for commerce
 *   worksFloor     the same for industry
 *   worksReserve   industry's own draw, INDUSTRY_RESERVE plots of it
 *   shared         what residential and commercial contest
 *
 * Residential takes a *prefix* of `shared` and commercial takes a *suffix*, and
 * that is the whole trick: a zone's k-th parcel is then a function of k alone
 * rather than of the other zone's count, so surveying commerce cannot move a
 * home that is already built. They are disjoint for every split whose two counts
 * sum to no more than the pool, which is exactly the constraint the surveyor
 * enforces. Three zones drawing from one pool this way is a contradiction rather
 * than a harder problem — see INDUSTRY_RESERVE.
 *
 * The pool is laid out so each zone reaches its own kind of land first. The
 * front of `shared` is the housing frontage left over after the floor, and the
 * back is the commercial frontage left over after its floor, reversed so that
 * reading from the back walks it forwards. A district that grows its housing
 * therefore spreads inward through land the generator already zoned residential
 * before it starts taking high street, and commerce spreads outward from the
 * high street before it starts taking housing.
 *
 * The property that makes the migration free: at the *default* split — every
 * leftover parcel taken by the zone it came from — this reconstructs
 * `plan.residential`, `plan.commercial` and `plan.industrial` cell for cell, in
 * their original order. A v9 city reopens on exactly the land it was left on.
 */
export interface DistrictPool {
  readonly homeFloor: Parcels;
  readonly shopFloor: Parcels;
  readonly worksFloor: Parcels;
  readonly worksReserve: Parcels;
  readonly shared: Parcels;
}

export function districtPool(plan: DistrictPlan): DistrictPool {
  const home = cutParcels(
    { cells: plan.residential, sizes: plan.residentialParcels },
    ZONE_FLOOR.home,
  );
  const shop = cutParcels(
    { cells: plan.commercial, sizes: plan.commercialParcels },
    ZONE_FLOOR.shop,
  );
  const works = cutParcels(
    { cells: plan.industrial, sizes: plan.industrialParcels },
    ZONE_FLOOR.industry,
  );
  return {
    homeFloor: home.head,
    shopFloor: shop.head,
    worksFloor: works.head,
    // Industry's whole remainder. INDUSTRY_RESERVE is what it *is* rather than a
    // cut of it: a district's industrial frontage is 13 plots and the floor took
    // the first four, so what is left is the reserve.
    worksReserve: works.tail,
    shared: joinParcels(home.tail, reverseParcels(shop.tail)),
  };
}

/** How many parcels each zone may survey in one district, before any are taken. */
export interface PoolLimits {
  /** Shared parcels, contested by residential and commercial together. */
  readonly shared: number;
  /** Parcels industry may take on top of its floor. */
  readonly works: number;
}

export const poolLimits = (pool: DistrictPool): PoolLimits => ({
  shared: pool.shared.sizes.length,
  works: pool.worksReserve.sizes.length,
});

/**
 * One district's zoning: how many *parcels* each zone has surveyed out of the
 * pool, on top of its floor.
 *
 * Parcels rather than plots, because the pool is cut at parcel boundaries — see
 * `cutParcels`. Plot counts are derived from these and the seed, which is what
 * keeps them out of the save.
 */
export interface DistrictZoning {
  readonly home: number;
  readonly shop: number;
  readonly industry: number;
}

/** The parcels one zone holds in a district, at a given zoning. */
export function zoneParcels(
  pool: DistrictPool,
  zoning: DistrictZoning,
  zone: Zone,
): Parcels {
  if (zone === ZONE.industrial) {
    return joinParcels(pool.worksFloor, takeParcels(pool.worksReserve, zoning.industry));
  }
  if (zone === ZONE.commercial) {
    // From the back. `reverseParcels` walks the pool's tail forwards, which is
    // the order the generator laid the commercial frontage in — so commerce
    // fills its own high street before it reaches into housing land.
    return joinParcels(pool.shopFloor, takeParcels(reverseParcels(pool.shared), zoning.shop));
  }
  return joinParcels(pool.homeFloor, takeParcels(pool.shared, zoning.home));
}

/**
 * One district's pool, with the prefix sums the capacity reads need.
 *
 * `homeCapacity` and its siblings are sums over districts now rather than one
 * multiplication, and they run ten times a second — so turning a parcel count
 * into a plot count has to be a lookup rather than a walk. Both directions are
 * held, because residential reads the pool from the front and commerce from the
 * back.
 */
export interface DistrictLand {
  readonly pool: DistrictPool;
  readonly limits: PoolLimits;
  /** Plots in the first k shared parcels, indexed by k. */
  readonly sharedFront: readonly number[];
  /** Plots in the last k shared parcels, indexed by k. */
  readonly sharedBack: readonly number[];
  /** Plots in the first k of industry's reserve parcels. */
  readonly worksFront: readonly number[];
  readonly floor: { readonly home: number; readonly shop: number; readonly industry: number };
}

const prefix = (sizes: readonly number[]): number[] => {
  const out = [0];
  for (const size of sizes) out.push((out[out.length - 1] as number) + size);
  return out;
};

const suffix = (sizes: readonly number[]): number[] => {
  const out = [0];
  for (let i = sizes.length - 1; i >= 0; i--) {
    out.push((out[out.length - 1] as number) + (sizes[i] as number));
  }
  return out;
};

const lands = new Map<number, DistrictLand>();

/** One district's pool, memoised. Keyed by annexation index, like every list. */
export function districtLand(index: number): DistrictLand {
  let land = lands.get(index);
  if (!land) {
    const c = districtCoord(index);
    const pool = districtPool(districtPlanAt(c.x, c.z));
    land = {
      pool,
      limits: poolLimits(pool),
      sharedFront: prefix(pool.shared.sizes),
      sharedBack: suffix(pool.shared.sizes),
      worksFront: prefix(pool.worksReserve.sizes),
      floor: {
        home: parcelPlots(pool.homeFloor),
        shop: parcelPlots(pool.shopFloor),
        industry: parcelPlots(pool.worksFloor),
      },
    };
    lands.set(index, land);
  }
  return land;
}

/**
 * The city's zoning: how many pool parcels each zone has surveyed, per district.
 *
 * `GameState` satisfies this structurally, which is deliberate — `economy.ts`
 * and the renderer both have a state in hand and neither should have to build a
 * second thing to ask a layout question.
 */
export interface Zoning {
  readonly districts: number;
  readonly surveyedR: readonly number[];
  readonly surveyedC: readonly number[];
  readonly surveyedI: readonly number[];
}

/** A city with no districts and no zoning. What a renderer holds before its first sync. */
export const EMPTY_ZONING: Zoning = { districts: 0, surveyedR: [], surveyedC: [], surveyedI: [] };

/** One district's zoning, clamped to the land it actually has. */
export function zoningAt(z: Zoning, index: number): DistrictZoning {
  const limits = districtLand(index).limits;
  // Clamped rather than trusted, for the reason `place` is: this is the one
  // place a doctored save would index off the end of a parcel list, and the
  // answer to a broken save is a wrong-looking city rather than a thrown frame.
  const home = Math.max(0, Math.min(Math.floor(z.surveyedR[index] ?? 0), limits.shared));
  const shop = Math.max(0, Math.min(Math.floor(z.surveyedC[index] ?? 0), limits.shared - home));
  const industry = Math.max(0, Math.min(Math.floor(z.surveyedI[index] ?? 0), limits.works));
  return { home, shop, industry };
}

/** Plots one zone holds in one district, at that district's zoning. */
export function districtZonePlots(z: Zoning, index: number, zone: Zone): number {
  const land = districtLand(index);
  const at = zoningAt(z, index);
  if (zone === ZONE.industrial) return land.floor.industry + (land.worksFront[at.industry] as number);
  if (zone === ZONE.commercial) return land.floor.shop + (land.sharedBack[at.shop] as number);
  return land.floor.home + (land.sharedFront[at.home] as number);
}

/**
 * Which district a plot index falls in, for a zone's flat plot list.
 *
 * A walk rather than a division, and that is the whole of it: the flat lists are
 * districts concatenated in annexation order, and each district contributes
 * `districtZonePlots` of them — 8 to 61 for residential or commercial, not a
 * constant. Dividing by the old fixed 24 / 45 / 13 was right only while every
 * district sold the same split, and it has not been since zoning floated: the
 * inspector reading `floor(plot / 24)` names the wrong district for most of a
 * surveyed city, and is off by three districts at the far end of eight.
 *
 * O(districts) of O(1) lookups, the same walk `zonePlots` measured at 0.31 us
 * over 49 districts — and this one runs once per inspector card rather than per
 * tick, so it is not worth memoising and is worth being able to read.
 */
export function districtOfPlot(z: Zoning, zone: Zone, plot: number): number {
  const target = Math.max(0, Math.floor(plot));
  let end = 0;
  for (let i = 0; i < z.districts; i++) {
    end += districtZonePlots(z, i, zone);
    if (target < end) return i;
  }
  // Past the end of the land the city owns, which `place` already clamps
  // against: the frontier is the honest answer, and a card that named a
  // district the city has not annexed would read as a bug.
  return Math.max(0, z.districts - 1);
}

/**
 * Plots one zone holds across the whole city.
 *
 * A sum over districts rather than a multiplication, and that is the change
 * demand-driven zoning actually makes to the economy: every district has its own
 * split now, written when it was the frontier and frozen when the next arrived.
 * O(districts) of O(1) lookups — a walk over 49 districts costs 0.31 us, which
 * `coastalDistricts`' own note already measured, so this is not worth memoising
 * and is worth being able to read.
 */
/**
 * The three zone totals, memoised against every mutation the arrays can take.
 *
 * Four numbers and three references, compared rather than hashed — this is read
 * several times a tick through `capacityOf` and `plotCapacity`, and a template
 * string per call allocates more than the walk it is there to avoid. Measured,
 * the string form cost about a microsecond a tick on a small city.
 *
 * Only the last district's entry ever changes in play, because the surveyor
 * works the frontier and nothing else — so the district count and the three last
 * values catch every in-place write. What they miss is a wholesale replacement,
 * which is what a load or a reset does, and the array *references* catch that:
 * `migrate` and `createState` both build new arrays rather than writing into old
 * ones.
 */
const zoneTotals = {
  districts: -1,
  lastR: -1,
  lastC: -1,
  lastI: -1,
  arrays: [null, null, null] as unknown[],
  plots: [0, 0, 0],
};

export function zonePlots(z: Zoning, zone: Zone): number {
  const last = z.districts - 1;
  const lastR = z.surveyedR[last] ?? -1;
  const lastC = z.surveyedC[last] ?? -1;
  const lastI = z.surveyedI[last] ?? -1;
  if (
    zoneTotals.districts !== z.districts ||
    zoneTotals.lastR !== lastR ||
    zoneTotals.lastC !== lastC ||
    zoneTotals.lastI !== lastI ||
    zoneTotals.arrays[0] !== z.surveyedR ||
    zoneTotals.arrays[1] !== z.surveyedC ||
    zoneTotals.arrays[2] !== z.surveyedI
  ) {
    // All three at once, because the caller that costs is `plotCapacity` and it
    // wants all three plus the scrub they leave — six walks over the districts
    // for one answer, measured at 10 us a call on a full map, which is the whole
    // of why this is memoised at all.
    zoneTotals.districts = z.districts;
    zoneTotals.lastR = lastR;
    zoneTotals.lastC = lastC;
    zoneTotals.lastI = lastI;
    zoneTotals.arrays = [z.surveyedR, z.surveyedC, z.surveyedI];
    let home = 0;
    let shop = 0;
    let works = 0;
    for (let i = 0; i < z.districts; i++) {
      const land = districtLand(i);
      const at = zoningAt(z, i);
      home += land.floor.home + (land.sharedFront[at.home] as number);
      shop += land.floor.shop + (land.sharedBack[at.shop] as number);
      works += land.floor.industry + (land.worksFront[at.industry] as number);
    }
    zoneTotals.plots = [home, shop, works];
  }
  const at = zone === ZONE.commercial ? 1 : zone === ZONE.industrial ? 2 : 0;
  return zoneTotals.plots[at] as number;
}

/** Shared parcels a district still has spare, for the surveyor. */
export function sharedSpare(z: Zoning, index: number): number {
  const at = zoningAt(z, index);
  return districtLand(index).limits.shared - at.home - at.shop;
}

/** Industry reserve parcels a district still has spare. */
export function worksSpare(z: Zoning, index: number): number {
  return districtLand(index).limits.works - zoningAt(z, index).industry;
}

/** One district's land, split into what can be bought and what cannot. */
export interface DistrictPlan {
  readonly layout: DistrictLayout;
  /** 3x3 university sites, reserved before anything else. */
  readonly universities: readonly CivicSite[];
  /** 3x3 landmark sites, reserved alongside the universities. */
  readonly landmarksLarge: readonly CivicSite[];
  /** 2x2 landmark sites, taken off the front of the same claim `sites` is. */
  readonly landmarksSmall: readonly CivicSite[];
  readonly sites: readonly CivicSite[];
  /**
   * 2x2 city hall sites, sliced *after* the civic six.
   *
   * After, and that is the whole of house rule four made concrete: `siteCapacity`
   * assigns the 2x2 civic types by a fixed interleave over `CIVIC_SERVICES`, so a
   * sixth entry in that table would change the divisor and move every hospital,
   * police station, fire station, school and depot in the city onto a different
   * site. Slicing a list of its own after them, exactly as `landmarksSmall` is
   * sliced before them, leaves the interleave untouched.
   *
   * One a district for a building the city only ever has one of — see
   * FRONTAGE_TARGET.cityHallSites for why the reservation has to be uniform.
   */
  readonly cityHalls: readonly CivicSite[];
  /**
   * 2x2 power plant sites, sliced after the city hall — the last of the nine.
   *
   * One a district and every one of them buildable, unlike the hall's: a city
   * needs about 0.78 plants a district at the top of the level ladder, so this
   * list is the one reservation the game expects to fill. See POWER_EXPONENT,
   * which is bounded above by exactly this.
   */
  readonly powerPlants: readonly CivicSite[];
  /**
   * 2x2 squares the district claimed and reserved but nothing stands on.
   *
   * Deliberately empty land, and the reason it is *reserved* rather than left
   * for sale: the build lists have to hit FRONTAGE_TARGET exactly, so a square
   * handed back to them would move the count the sampler is pinning. Held for
   * whatever the city learns to build next. See FRONTAGE_TARGET.
   */
  readonly spareSquares: readonly CivicSite[];
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
 * Reserves every square a district owes before the build lists are drawn, and
 * hands back what is left.
 *
 * The 3x3s go first because a 3x3 is the scarce shape: the 2x2 pass would
 * otherwise fragment the only squares big enough to hold one. There are two of
 * them now — the university and the large landmark — and they are taken off the
 * same ranked list in order, so which is which is a pure function of the layout
 * rather than of what the city has built.
 *
 * Reserving the whole 2x2 claim rather than the squares a building has actually
 * landed on is what keeps `homeCapacity` independent of build order — the plot
 * a house gets must be recoverable from `{ homes: 41 }` alone, and it would not
 * be if opening a hospital shortened the housing list under it. The claim is
 * then split by position: the first square is the small landmark's, the next six
 * are civic, and whatever is past them is spare land nothing stands on yet.
 */
export function districtPlan(layout: DistrictLayout): DistrictPlan {
  const reserved = new Set<number>();
  const threes = universitySites(layout);
  const universities = threes.slice(0, FRONTAGE_TARGET.universitySites);
  const landmarksLarge = threes.slice(
    FRONTAGE_TARGET.universitySites,
    FRONTAGE_TARGET.universitySites + FRONTAGE_TARGET.landmarkLargeSites,
  );
  for (const site of universities) for (const c of site.cells) reserved.add(c);
  for (const site of landmarksLarge) for (const c of site.cells) reserved.add(c);
  const squares = civicSites(layout, reserved);
  const landmarksSmall = squares.slice(0, FRONTAGE_TARGET.landmarkSmallSites);
  const sites = squares.slice(
    FRONTAGE_TARGET.landmarkSmallSites,
    FRONTAGE_TARGET.landmarkSmallSites + FRONTAGE_TARGET.civicSites,
  );
  const afterCivic = FRONTAGE_TARGET.landmarkSmallSites + FRONTAGE_TARGET.civicSites;
  const cityHalls = squares.slice(afterCivic, afterCivic + FRONTAGE_TARGET.cityHallSites);
  const afterHall = afterCivic + FRONTAGE_TARGET.cityHallSites;
  const powerPlants = squares.slice(afterHall, afterHall + FRONTAGE_TARGET.powerSites);
  const spareSquares = squares.slice(afterHall + FRONTAGE_TARGET.powerSites);

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
    landmarksLarge,
    landmarksSmall,
    sites,
    cityHalls,
    powerPlants,
    spareSquares,
    residential: residential.cells,
    commercial: commercial.cells,
    industrial: industrial.cells,
    residentialParcels: residential.sizes,
    commercialParcels: commercial.sizes,
    industrialParcels: industrial.sizes,
    courtyards,
  };
}

/**
 * Whether a plan hits the counts every district has to agree on.
 *
 * The *whole* 2x2 claim is pinned rather than only the squares something stands
 * on, because the claim is what is reserved and therefore what the build lists
 * are drawn from what is left of. Pinning six and letting the surplus vary
 * would leave the sale counts varying with it.
 */
function onTarget(plan: DistrictPlan): boolean {
  return (
    plan.residential.length === FRONTAGE_TARGET.residential &&
    plan.commercial.length === FRONTAGE_TARGET.commercial &&
    plan.industrial.length === FRONTAGE_TARGET.industrial &&
    plan.sites.length === FRONTAGE_TARGET.civicSites &&
    plan.landmarksSmall.length === FRONTAGE_TARGET.landmarkSmallSites &&
    plan.cityHalls.length === FRONTAGE_TARGET.cityHallSites &&
    plan.powerPlants.length === FRONTAGE_TARGET.powerSites &&
    plan.spareSquares.length ===
      FRONTAGE_TARGET.squares -
        FRONTAGE_TARGET.civicSites -
        FRONTAGE_TARGET.landmarkSmallSites -
        FRONTAGE_TARGET.cityHallSites -
        FRONTAGE_TARGET.powerSites &&
    plan.universities.length === FRONTAGE_TARGET.universitySites &&
    plan.landmarksLarge.length === FRONTAGE_TARGET.landmarkLargeSites
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
 * Zoned land per district: every plot that is not a street, whatever the
 * streets do.
 *
 * This is *not* how much of it can be built on. It is the denominator the
 * zoning budget splits and nothing else — see the four constants below, which
 * are the ones capacity is made of. Conflating the two is the mistake this pair
 * of comments exists to prevent.
 */
export const PLOTS_PER_DISTRICT = TARGET_PLOTS;

/**
 * Buildable land per district: the plots that front a street and are not
 * reserved for a square. 24 + 45 + 13 = 82 of the 144 zoned plots are for sale,
 * 36 more are held for the nine 2x2 squares, 18 for the two 3x3s — the
 * university and the large landmark — and the last 8 are interior land the
 * renderer draws as courtyard, half of it park and half of it spare.
 *
 * These are constants because `districtPlanAt` reseeds until they are — the
 * road-adjacent split is not seed-invariant on its own. See FRONTAGE_TARGET.
 */
/**
 * Park land per district, in courtyard plots.
 *
 * Stated rather than derived, which is what the wider district changed. It used
 * to be "whatever is left", and at span 13 what was left was exactly 4 — but at
 * span 15 the courtyard remainder is 8, and letting parks take all of it would
 * double park land against housing that did not move. PLOTS_PER_PARK is 6 and a
 * district holds 24 housing plots, so 4 parks cover its housing exactly; a
 * remainder-derived 8 would cover it twice over and delete recreation as a
 * happiness term worth earning.
 *
 * The other four courtyard plots are spare. The renderer already draws every
 * courtyard past `state.parks` as empty ground, so they read as what they are.
 */
export const BUILDABLE_PARKS_PER_DISTRICT = 4;

/**
 * Land a district holds that nothing stands on: the two spare 2x2 squares, and
 * the courtyard plots parks do not take.
 *
 * Deliberate, and the reason DISTRICT_SPAN moved further than one landmark
 * needed — a budget with no slack in it is one that has to be re-cut every time
 * the game learns to build something. Derived rather than stated so it cannot
 * drift from the numbers above it.
 */
export const SPARE_PLOTS_PER_DISTRICT =
  TARGET_PLOTS -
  FRONTAGE_TARGET.residential -
  FRONTAGE_TARGET.commercial -
  FRONTAGE_TARGET.industrial -
  FRONTAGE_TARGET.squares * 4 -
  (FRONTAGE_TARGET.universitySites + FRONTAGE_TARGET.landmarkLargeSites) * 9 -
  BUILDABLE_PARKS_PER_DISTRICT +
  (FRONTAGE_TARGET.squares -
    FRONTAGE_TARGET.civicSites -
    FRONTAGE_TARGET.landmarkSmallSites -
    FRONTAGE_TARGET.cityHallSites -
    FRONTAGE_TARGET.powerSites) *
    4;

/**
 * Sellable frontage a district carries, however it is zoned.
 *
 * The number demand-driven zoning holds fixed while everything under it floats:
 * 24 + 45 + 13 is what the generator's reservations leave road-adjacent, and it
 * is geometry rather than balance. What the surveyor moves is the split between
 * the three; the total is not its to move. See `districtPool`.
 */
export const SELLABLE_PER_DISTRICT =
  FRONTAGE_TARGET.residential + FRONTAGE_TARGET.commercial + FRONTAGE_TARGET.industrial;

/**
 * What a district's zones held before zoning floated. Kept for the migration and
 * for the tools that still speak in the old split — nothing in the running game
 * multiplies by these any more.
 */
export const BUILDABLE_RESIDENTIAL_PER_DISTRICT = FRONTAGE_TARGET.residential;
export const BUILDABLE_COMMERCIAL_PER_DISTRICT = FRONTAGE_TARGET.commercial;
export const BUILDABLE_INDUSTRIAL_PER_DISTRICT = FRONTAGE_TARGET.industrial;
export const CIVIC_SITES_PER_DISTRICT = FRONTAGE_TARGET.civicSites;
export const UNIVERSITY_SITES_PER_DISTRICT = FRONTAGE_TARGET.universitySites;
export const LANDMARK_LARGE_SITES_PER_DISTRICT = FRONTAGE_TARGET.landmarkLargeSites;
export const LANDMARK_SMALL_SITES_PER_DISTRICT = FRONTAGE_TARGET.landmarkSmallSites;
export const CITY_HALL_SITES_PER_DISTRICT = FRONTAGE_TARGET.cityHallSites;
export const POWER_SITES_PER_DISTRICT = FRONTAGE_TARGET.powerSites;

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

/**
 * Whether a district-space coordinate is land the city could annex.
 *
 * Memoised, and it has to be: `districtCoord` asks this of every position in
 * every ring it walks, and the answer is 256 samples of the water field. Keyed
 * on the coordinate for the same reason `plans` is — a tile's dryness is a
 * property of where it is, not of when anyone looked at it.
 */
const dryness = new Map<string, boolean>();

export function districtIsDry(dx: number, dz: number): boolean {
  const key = `${dx},${dz}`;
  let dry = dryness.get(key);
  if (dry === undefined) {
    dry = WATERS.dry(dx, dz);
    dryness.set(key, dry);
  }
  return dry;
}

/** Whether a district-space coordinate is dry land with the sea against it. */
const coastline = new Map<string, boolean>();

export function districtIsCoastal(dx: number, dz: number): boolean {
  const key = `${dx},${dz}`;
  let coastal = coastline.get(key);
  if (coastal === undefined) {
    coastal = WATERS.coastal(dx, dz);
    coastline.set(key, coastal);
  }
  return coastal;
}

const coordCache: Coord[] = [];
let cachedRings = 0;

/**
 * How far out the spiral will look for land before giving up.
 *
 * A backstop on a loop whose termination depends on the water field, not a
 * budget: MAX_DISTRICTS districts are found inside five rings for every seed
 * measured (tools/water.calibrate.mjs), and sixty-four is far enough out that
 * reaching it means the field is broken rather than merely wet.
 */
const MAX_RINGS = 64;

/**
 * District index -> district-space coordinate. Stable forever.
 *
 * Water positions are skipped rather than annexed and left empty, which is what
 * makes `districts: 12` still mean twelve districts of land. The sequence is
 * still a pure function of the seed — the water field is — so this stays the
 * one rule that survives a reload, and a coordinate never moves once the cache
 * has reached it.
 */
export function districtCoord(index: number): Coord {
  while (coordCache.length <= index) {
    if (cachedRings > MAX_RINGS) {
      throw new Error(`no dry district for index ${index} inside ${MAX_RINGS} rings`);
    }
    for (const coord of ringCoords(cachedRings++)) {
      if (districtIsDry(coord.x, coord.z)) coordCache.push(coord);
    }
  }
  return coordCache[index] as Coord;
}

/**
 * Which districts have the sea against them, in the order they were annexed.
 *
 * Appended and remembered, because it cannot change: the spiral is fixed, so
 * which of its positions are coastal is fixed too, and a city that has reached
 * the water never un-reaches it. `income` asks this every tick, and rescanning
 * forty-nine coordinates a frame for an answer settled days ago would be the
 * one place the simulation allocated per step.
 *
 * The bound on every read is what makes `reset` work: the count drops back to
 * 1, and a berth on a district nobody owns has to read as no berth at all
 * rather than as a port floating on land the city sold.
 */
const coastalIndices: number[] = [];
let coastalScanned = 0;

function scanCoastal(districts: number): void {
  while (coastalScanned < districts) {
    const coord = districtCoord(coastalScanned);
    if (districtIsCoastal(coord.x, coord.z)) coastalIndices.push(coastalScanned);
    coastalScanned++;
  }
}

/** How many coastal districts the city owns. The berths a port may take. */
export function coastalDistricts(districts: number): number {
  scanCoastal(districts);
  let owned = 0;
  while (owned < coastalIndices.length && (coastalIndices[owned] as number) < districts) owned++;
  return owned;
}

/** The i-th coastal district the city annexed, or -1 if it does not own one. */
export function coastalDistrictAt(i: number, districts: number): number {
  scanCoastal(districts);
  const index = coastalIndices[i];
  return index !== undefined && index < districts ? index : -1;
}

/**
 * The district the first port stands on, or -1 before the city reaches water.
 *
 * Named separately from `coastalDistrictAt(0, ...)` because it is the question
 * everything outside the port asks: whether the coast has been reached at all.
 */
export function portDistrict(districts: number): number {
  return coastalDistrictAt(0, districts);
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
  /** Parcels, and plots, in the first d districts. What `rewind` rolls back to. */
  private readonly parcelsThrough: number[] = [0];
  private readonly plotsThrough: number[] = [0];
  private total = 0;

  /** Appends one district's parcels. Sizes are 1 or 2. */
  push(sizes: readonly number[]): void {
    for (const size of sizes) {
      this.begin.push(this.total);
      this.pairsBefore.push(this.pairAt.length);
      if (size === 2) this.pairAt.push(this.size.length);
      this.size.push(size);
      this.total += size;
    }
    this.pairsThrough.push(this.pairAt.length);
    this.parcelsThrough.push(this.size.length);
    this.plotsThrough.push(this.total);
  }

  /** Districts this book has been given. */
  get districts(): number {
    return this.parcelsThrough.length - 1;
  }

  /**
   * Drops every district past the `d`-th, so the tail can be pushed again.
   *
   * The one thing demand-driven zoning asks of this class. A district's split
   * floats while it is the frontier, so its parcels change under it — and every
   * district before it is frozen, so what has to be rebuilt is only ever the
   * last one. Rolling back to a district boundary and pushing again is exactly
   * that, and it leaves every earlier parcel where it was, which is what stops a
   * survey from moving a building three districts away.
   */
  rewind(d: number): void {
    const at = Math.max(0, Math.min(d, this.districts));
    const parcels = this.parcelsThrough[at] as number;
    const pairs = this.pairsThrough[at] as number;
    this.size.length = parcels;
    this.begin.length = parcels;
    this.pairsBefore.length = parcels;
    this.pairAt.length = pairs;
    this.pairsThrough.length = at + 1;
    this.parcelsThrough.length = at + 1;
    this.plotsThrough.length = at + 1;
    this.total = this.plotsThrough[at] as number;
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

const PARCEL_ZONES: readonly Zone[] = [ZONE.residential, ZONE.commercial, ZONE.industrial];

/**
 * One set of books, per zone, grown district by district.
 *
 * Grown *and* rewound, since zoning arrived. Districts before the last are
 * frozen and are pushed once; the last is the frontier, its split moves, and its
 * parcels are rebuilt whenever it does. `stamp` is what says whether it moved —
 * three small integers, compared rather than recomputed, because this is on the
 * path `place` takes for every building on every rebuild.
 */
class ParcelBooks {
  private readonly books = new Map<Zone, ParcelBook>(
    PARCEL_ZONES.map((zone) => [zone, new ParcelBook()]),
  );
  private frozen = 0;
  private stamp = '';

  of(zone: Zone, z: Zoning): ParcelBook {
    const districts = Math.max(0, z.districts);
    // A shorter city than the book holds is a `reset` or a save from a smaller
    // one: roll the whole tail off rather than trusting what is past it.
    if (districts < this.frozen) {
      for (const key of PARCEL_ZONES) (this.books.get(key) as ParcelBook).rewind(districts);
      this.frozen = districts;
      this.stamp = '';
    }
    // Everything but the newest district is frozen, so push those once.
    const settled = Math.max(0, districts - 1);
    for (let i = this.frozen; i < settled; i++) this.pushDistrict(i, z);
    if (this.frozen < settled) this.stamp = '';
    this.frozen = Math.max(this.frozen, settled);

    if (districts > 0) {
      const live = districts - 1;
      const at = zoningAt(z, live);
      const stamp = `${live}:${at.home}:${at.shop}:${at.industry}`;
      if (stamp !== this.stamp) {
        for (const key of PARCEL_ZONES) (this.books.get(key) as ParcelBook).rewind(live);
        this.pushDistrict(live, z);
        this.stamp = stamp;
      }
    }
    return this.books.get(zone) as ParcelBook;
  }

  private pushDistrict(index: number, z: Zoning): void {
    const land = districtLand(index);
    const at = zoningAt(z, index);
    for (const key of PARCEL_ZONES) {
      (this.books.get(key) as ParcelBook).push(zoneParcels(land.pool, at, key).sizes);
    }
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

/** The parcel book for one zone, materialised against the city's zoning. */
export function parcelBook(zone: Zone, z: Zoning): ParcelBook {
  return cityBooks.of(zone, z);
}

/**
 * How much of the city's housing land the landmarks reach.
 *
 * The area-of-effect, precomputed. A landmark covers the housing plots inside
 * its `reach`, and the share of the city's developed housing plots under at
 * least one landmark is the scalar happiness reads — see LANDMARKS for why it
 * is a share of land rather than a modifier on buildings.
 *
 * The trick that makes it cheap is the pair of arrays below. For each
 * residential plot the city owns, `nearestMuseum[i]` is the *lowest site
 * ordinal* whose museum would reach it, and `nearestStadium[i]` likewise — so
 * plot i is covered exactly when `nearestMuseum[i] < museums built` or
 * `nearestStadium[i] < stadiums built`. Landmarks are laid out in site order the
 * same way homes and civic buildings are, so "the first n sites" is what "n
 * landmarks" means, and the whole query becomes one walk over a Uint32Array
 * with no geometry in it at all.
 *
 * That walk is still O(plots), so the answer is memoised against the counts it
 * depends on: `happinessTarget` runs ten times a second and must not re-walk a
 * thousand plots to do it. Measured on the largest city the map allows — 49
 * districts, 1,176 housing plots, 98 landmark sites:
 *
 *   warm read       0.21 us, so 0.002 ms a second of simulation at TICK_RATE
 *   cache miss      2.7 us, which is what one purchase costs
 *   table rebuild   4.4 ms for all 49 districts at once, and 1.1 ms in total
 *                   when the city is annexed one district at a time
 *
 * The district plans the tables are built over cost about 290 ms for 49, and
 * that is not this class's bill: `districtPlanAt` memoises module-wide and the
 * renderer's `CityLayout` materialises the same plans on the same frame.
 *
 * Module-level for the same reason `cityBooks` is — `economy.ts` has no
 * `CityLayout` of its own — and district order is fixed, so two of these at the
 * same district count are equal.
 */
class LandmarkReach {
  private materialised = 0;
  /** Districts whose housing plots are frozen, and where they end. */
  private settled = 0;
  private frozenPlots = 0;
  private liveStamp = '';
  /** Residential plots, in the same order `CityLayout.homeCell` hands them out. */
  private readonly plots: Coord[] = [];
  /** Lower-left plot of each landmark site, in site order. */
  private readonly museums: Coord[] = [];
  private readonly stadiums: Coord[] = [];
  private nearestMuseum: Uint32Array<ArrayBufferLike> = new Uint32Array(0);
  private nearestStadium: Uint32Array<ArrayBufferLike> = new Uint32Array(0);
  private stamp = '';
  private cached = 0;

  /**
   * Materialises out to `districts`, rebuilding the nearest-site tables.
   *
   * Rebuilt whole rather than extended, because annexing a district puts new
   * housing inside the reach of landmarks that were already standing — the
   * tables are not append-only even though the lists they index are.
   */
  private ensure(z: Zoning): void {
    const districts = Math.max(0, z.districts);
    if (districts < this.materialised) {
      this.plots.length = 0;
      this.museums.length = 0;
      this.stadiums.length = 0;
      this.materialised = 0;
      this.settled = 0;
      this.frozenPlots = 0;
      this.liveStamp = '';
    }
    const live = districts - 1;
    const at = districts > 0 ? zoningAt(z, live) : undefined;
    const stamp = at === undefined ? '' : `${live}:${at.home}`;
    if (districts === this.materialised && stamp === this.liveStamp) return;

    // The landmark sites are fixed land and are appended once; the housing plots
    // are not, because the frontier district's split moves them. Same frozen /
    // live split `CityLayout.ensure` carries, and for the same reason.
    for (let i = this.materialised; i < districts; i++) {
      const { landmarksSmall, landmarksLarge } = placeDistrict(i, z);
      this.museums.push(...landmarksSmall);
      this.stadiums.push(...landmarksLarge);
    }
    this.plots.length = this.frozenPlots;
    for (let i = this.settled; i < Math.max(0, live); i++) {
      this.plots.push(...placeDistrict(i, z).residential);
    }
    this.settled = Math.max(0, live);
    this.frozenPlots = this.plots.length;
    if (districts > 0) this.plots.push(...placeDistrict(live, z).residential);

    this.materialised = districts;
    this.liveStamp = stamp;
    this.nearestMuseum = LandmarkReach.nearest(this.plots, this.museums, 2, reachOf('museum'));
    this.nearestStadium = LandmarkReach.nearest(this.plots, this.stadiums, 3, reachOf('stadium'));
    this.stamp = '';
  }

  /**
   * For each plot, the lowest site ordinal that reaches it, or `NONE`.
   *
   * A site is `span` plots on a side and is indexed by its lower-left plot, so
   * its centre sits half a span along each axis from there. Distances are
   * compared squared: a square root per plot per site is the only expensive
   * thing in here and it changes no answer.
   */
  private static nearest(
    plots: readonly Coord[],
    sites: readonly Coord[],
    span: number,
    reach: number,
  ): Uint32Array<ArrayBufferLike> {
    const out = new Uint32Array(plots.length);
    out.fill(NO_LANDMARK);
    const limit = reach * reach;
    const offset = ((span - 1) / 2) * CELL;
    for (let k = sites.length - 1; k >= 0; k--) {
      const site = sites[k] as Coord;
      const sx = worldX(site.x) + offset;
      const sz = worldZ(site.z) + offset;
      for (let i = 0; i < plots.length; i++) {
        const plot = plots[i] as Coord;
        const dx = worldX(plot.x) - sx;
        const dz = worldZ(plot.z) - sz;
        // Walking sites from the back means the lowest ordinal wins by
        // overwriting, with no comparison per plot.
        if (dx * dx + dz * dz <= limit) out[i] = k;
      }
    }
    return out;
  }

  /**
   * Housing plots inside reach of the first `museums` and `stadiums` landmarks,
   * out of the first `plots` the city has developed.
   */
  covered(museums: number, stadiums: number, plots: number, z: Zoning): number {
    this.ensure(z);
    const capped = Math.max(0, Math.min(plots, this.plots.length));
    const stamp = `${this.liveStamp}:${z.districts}:${museums}:${stadiums}:${capped}`;
    if (stamp === this.stamp) return this.cached;
    let n = 0;
    for (let i = 0; i < capped; i++) {
      if ((this.nearestMuseum[i] ?? NO_LANDMARK) < museums) n++;
      else if ((this.nearestStadium[i] ?? NO_LANDMARK) < stadiums) n++;
    }
    this.stamp = stamp;
    this.cached = n;
    return n;
  }
}

/** No landmark site reaches this plot. Larger than any site count can be. */
const NO_LANDMARK = 0xffffffff;

const reachOf = (key: Landmark['key']): number =>
  LANDMARKS.find((landmark) => landmark.key === key)?.reach ?? 0;

const cityReach = new LandmarkReach();

/**
 * Housing plots under at least one landmark. A pure function of four counts and
 * the seed, which is what `landmarkCoverage` needs it to be.
 */
export function landmarkPlotsCovered(
  museums: number,
  stadiums: number,
  plots: number,
  z: Zoning,
): number {
  return cityReach.covered(museums, stadiums, plots, z);
}

/**
 * The centrality of every housing plot the city sells, in build order.
 *
 * `citygen` already scores each block 1 at the district's middle and 0 at its
 * furthest corner, and a plot inherits its block's score. Rent was flat over
 * that; `landValue` in economy.ts makes it vary. What this class is for is
 * making the variation cost nothing to read.
 *
 * Two reads, and both are O(1) because of the prefix table. `at` is one plot's
 * score, which is what the inspector needs; `mean` is the average over the
 * first n plots, which is what `income` needs and which runs ten times a second.
 * A prefix sum rather than a memo against counts — `landmarkCoverage` memoises
 * because its query is a walk over a thousand plots and this one is a
 * subtraction, so there is nothing left to cache.
 *
 * Append-only, exactly like the plot lists it indexes. Annexing a district adds
 * scores to the end and moves nothing already in it, which is what keeps a
 * building's rent a pure function of its ordinal and the seed.
 *
 * The build list is the *plot* list, and that is worth stating because it is an
 * approximation once a city starts merging. Buildings fill the list from the
 * front, so the plots a city of `homes + mergedR` occupies are the first
 * `homes + mergedR` of it — exactly, inside one district, because `parcelOrder`
 * emits every pair before any single. Across a district boundary a heavily
 * merged city can hold a plot or two out of order: its unpairable singles sit
 * unbuilt while merging has moved on to the next district's pairs. That is at
 * most the two singles a district has (see `parcelOrder`), it washes out of a
 * mean over hundreds of plots, and it is exactly zero at build-out — which is
 * the reading the normalisation has to be exact at.
 */
class LandValue {
  private materialised = 0;
  /** Districts whose housing plots are frozen, and where their scores end. */
  private settled = 0;
  private frozenLen = 0;
  private liveStamp = '';
  /** Centrality per housing plot, in the order `CityLayout` hands them out. */
  private score: number[] = [];
  /** `sum[i]` is the total score of the first i plots. One longer than `score`. */
  private sum: number[] = [0];

  /**
   * Materialises the housing scores against the city's zoning.
   *
   * The frozen / live split every table over the housing list now carries: which
   * plots are housing depends on the frontier district's split, so its scores are
   * rolled off and rebuilt when the surveyor moves it. The prefix sum has to be
   * rebuilt from the boundary for the same reason, which is cheap — it is a
   * running total over one district's plots.
   */
  private ensure(z: Zoning): void {
    const districts = Math.max(0, z.districts);
    if (districts < this.materialised) {
      this.score = [];
      this.sum = [0];
      this.materialised = 0;
      this.settled = 0;
      this.frozenLen = 0;
      this.liveStamp = '';
    }
    const live = districts - 1;
    const at = districts > 0 ? zoningAt(z, live) : undefined;
    const stamp = at === undefined ? '' : `${live}:${at.home}`;
    if (districts === this.materialised && stamp === this.liveStamp) return;

    this.score.length = this.frozenLen;
    this.sum.length = this.frozenLen + 1;
    for (let i = this.settled; i < Math.max(0, live); i++) this.pushDistrict(i, z);
    this.settled = Math.max(0, live);
    this.frozenLen = this.score.length;
    if (districts > 0) this.pushDistrict(live, z);
    this.materialised = districts;
    this.liveStamp = stamp;
  }

  private pushDistrict(index: number, z: Zoning): void {
    const c = districtCoord(index);
    const plan = districtPlanAt(c.x, c.z);
    const { blocks, block } = plan.layout;
    const land = districtLand(index);
    for (const cell of zoneParcels(land.pool, zoningAt(z, index), ZONE.residential).cells) {
      const id = block[cell] as number;
      // A road cell has no block and cannot be in a build list, but the list
      // is data and the lookup is cheap: a missing block reads as the
      // district's edge rather than as a crash.
      const score = (blocks[id]?.centrality ?? 0);
      this.score.push(score);
      this.sum.push((this.sum[this.sum.length - 1] as number) + score);
    }
  }

  /** Centrality of one housing plot, clamped to the land the city owns. */
  at(plot: number, z: Zoning): number {
    this.ensure(z);
    const i = Math.max(0, Math.min(Math.floor(plot), this.score.length - 1));
    return this.score[i] ?? 0;
  }

  /** Mean centrality over the first `plots` housing plots the city sells. */
  mean(plots: number, z: Zoning): number {
    this.ensure(z);
    const n = Math.max(0, Math.min(Math.floor(plots), this.score.length));
    if (n <= 0) return 0;
    return (this.sum[n] as number) / n;
  }
}

const cityLand = new LandValue();

/**
 * Centrality of the i-th housing plot the city sells, in [0, 1].
 *
 * What the inspector reads, and the reason `buildingIncome` can now differ
 * between two identical houses: it is the first spatially varying input in the
 * game. See the `LevelCohort` comment in state.ts for what that does and does
 * not justify.
 */
export function housingCentrality(plot: number, z: Zoning): number {
  return cityLand.at(plot, z);
}

/**
 * Mean centrality over the first `plots` housing plots. What `income` reads.
 */
export function housingCentralityMean(plots: number, z: Zoning): number {
  return cityLand.mean(plots, z);
}

/**
 * Mean centrality over every housing plot the city owns.
 *
 * The normaliser, and the whole of why land value redistributes rent rather
 * than adding or removing it: the multiplier is `1 + spread x (c - this)`, so
 * its mean over a fully built city is exactly 1 and RENT, HOME_BASE and the
 * first tier's capacity all still mean what they meant.
 *
 * Against the land the city *owns* rather than a constant measured over every
 * seed, because that is the only reading that makes build-out exact rather than
 * approximate. It moves when a district is annexed, which is a real consequence
 * worth stating: taking land shifts what the existing housing is worth, because
 * the middle of the city has moved. Measured, the shift is a fraction of a
 * percent — districts are generated by one process and their means agree
 * closely — see tools/landvalue.calibrate.mjs.
 *
 * It moves when the city *rezones*, too, and that is the same statement one
 * layer down: surveying housing into a district adds plots to this mean, and
 * surveying commerce over housing takes them out of it. The normaliser is the
 * housing land the city owns, whatever the surveyor has decided that is.
 */
export function housingCentralityBase(z: Zoning): number {
  return cityLand.mean(zonePlots(z, ZONE.residential), z);
}

interface DistrictPlots {
  readonly residential: Coord[];
  readonly commercial: Coord[];
  readonly industrial: Coord[];
  /** Sellable plots the district has not zoned to anything yet. */
  readonly scrub: Coord[];
  /** Lower-left plot of each civic site, in site order. */
  readonly civic: Coord[];
  /** Lower-left plot of each university site, in site order. */
  readonly universities: Coord[];
  /** Lower-left plot of each 3x3 landmark site, in site order. */
  readonly landmarksLarge: Coord[];
  /** Lower-left plot of each 2x2 landmark site, in site order. */
  readonly landmarksSmall: Coord[];
  /** Lower-left plot of each 2x2 city hall site, in site order. */
  readonly cityHalls: Coord[];
  /** Lower-left plot of each 2x2 power plant site, in site order. */
  readonly powerPlants: Coord[];
  /** Lower-left plot of each 2x2 square nothing stands on. */
  readonly spareSquares: Coord[];
  readonly courtyards: Coord[];
  readonly roads: Coord[];
}

/**
 * Lifts one district's plan into global coordinates. The generator has already
 * zoned block-wise and shuffled the build order inside each zone, and
 * `districtPlan` has already taken the civic sites out, so there is nothing to
 * decide here.
 */
function placeDistrict(index: number, z: Zoning): DistrictPlots {
  const c = districtCoord(index);
  const ox = c.x * DISTRICT_SPAN;
  const oz = c.z * DISTRICT_SPAN;
  const plan = districtPlanAt(c.x, c.z);
  // The three sale lists come from the district's *pool* at its own zoning now,
  // rather than from the plan's fixed 24 / 45 / 13. Everything else on the plan —
  // the reserved squares, the courtyards, the streets — is untouched by zoning
  // and is read straight off it, which is why `districtPlan` did not have to move.
  const land = districtLand(index);
  const at = zoningAt(z, index);
  const sale = {
    residential: zoneParcels(land.pool, at, ZONE.residential).cells,
    commercial: zoneParcels(land.pool, at, ZONE.commercial).cells,
    industrial: zoneParcels(land.pool, at, ZONE.industrial).cells,
  };

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

  // Sellable land the district has not zoned to anything: the survey ground.
  // Drawn as scrub rather than left as a hole — it is land the city owns and is
  // not building on, which is what the courtyard list already means.
  const zoned = new Set([...sale.residential, ...sale.commercial, ...sale.industrial]);
  const scrub: number[] = [];
  for (const cell of [...plan.residential, ...plan.commercial, ...plan.industrial]) {
    if (!zoned.has(cell)) scrub.push(cell);
  }

  return {
    residential: sale.residential.map(toGlobal),
    commercial: sale.commercial.map(toGlobal),
    industrial: sale.industrial.map(toGlobal),
    scrub: scrub.map(toGlobal),
    civic: plan.sites.map((site) => toGlobal(site.cell)),
    universities: plan.universities.map((site) => toGlobal(site.cell)),
    landmarksLarge: plan.landmarksLarge.map((site) => toGlobal(site.cell)),
    landmarksSmall: plan.landmarksSmall.map((site) => toGlobal(site.cell)),
    cityHalls: plan.cityHalls.map((site) => toGlobal(site.cell)),
    powerPlants: plan.powerPlants.map((site) => toGlobal(site.cell)),
    spareSquares: plan.spareSquares.map((site) => toGlobal(site.cell)),
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
  /** This layout's own parcel books. See `cityBooks` for why they are not shared. */
  private readonly books = new ParcelBooks();
  private readonly _residential: Coord[] = [];
  private readonly _commercial: Coord[] = [];
  private readonly _industrial: Coord[] = [];
  private readonly _civic: Coord[] = [];
  private readonly _universities: Coord[] = [];
  /**
   * Landmark sites, appended district by district exactly as every other site
   * list is. Two lists because a landmark comes in two sizes and they stand on
   * different squares — see FRONTAGE_TARGET.
   */
  private readonly _landmarksLarge: Coord[] = [];
  private readonly _landmarksSmall: Coord[] = [];
  /**
   * City hall sites, one per district and only ever one of them built on.
   *
   * A list rather than a single coordinate for the same reason every other site
   * list is one: `ensure` appends district by district and nothing already in it
   * moves. The city's one hall stands on entry 0 — district 0's square — and the
   * rest are reserved land the renderer draws as empty.
   */
  private readonly _cityHalls: Coord[] = [];
  /** Power plant sites, one per district and the i-th plant on the i-th. */
  private readonly _powerPlants: Coord[] = [];
  /** Lower-left plot of every 2x2 square held back with nothing on it. */
  private readonly _spareSquares: Coord[] = [];
  /**
   * Interior plots, park land first and spare land after it.
   *
   * Two lists rather than one, and the wider district is why. A district now
   * leaves eight courtyard plots where `parkCapacity` still only counts four, so
   * appending all eight to a single list would put the city's fifth park on the
   * first district's *spare* land instead of on the second district's park land
   * — parks would bunch up in the oldest districts and the spare plots would
   * quietly disappear under them. Splitting the two at the district and joining
   * them at the city keeps `parkCell(i)` the i-th park and leaves the renderer's
   * rule intact: everything past `state.parks` in `courtyards` is empty ground.
   */
  private readonly _parks: Coord[] = [];
  private readonly _spare: Coord[] = [];
  /** `_parks` then `_spare`, rebuilt in `ensure` so reading it allocates nothing. */
  private _courtyards: Coord[] = [];
  private readonly _districts: District[] = [];

  /** Sellable plots no zone has taken, appended district by district. */
  private readonly _scrub: Coord[] = [];
  /** Districts whose *fixed* land — sites, courtyards, streets — is materialised. */
  private fixed = 0;
  /** Districts whose *sale* land is frozen. Always `districts - 1` or 0. */
  private settled = 0;
  /** Where the frozen districts' sale lists end. What `rewindSale` rolls back to. */
  private frozenLengths = { residential: 0, commercial: 0, industrial: 0, scrub: 0 };
  /** The frontier district's zoning, as last built. Empty forces a rebuild. */
  private liveStamp = '';

  /**
   * Materialises the city's land against its zoning. Idempotent and cheap to
   * over-call, which the renderer relies on — it calls this every sync.
   *
   * Two kinds of land, and the split is what makes demand-driven zoning safe.
   * A district's *fixed* land — its civic squares, its courtyards, its streets —
   * has nothing to do with zoning and is appended once, exactly as it always
   * was. Its *sale* land is the three zoned lists, and those depend on the split.
   *
   * Every district but the newest is frozen: its split was written while it was
   * the frontier and fixed the moment the next was annexed, so its plots are
   * appended once and never touched again. The newest is live, and its segment
   * is rolled off and rebuilt whenever the surveyor moves it.
   *
   * That the live district is the last one is the whole reason a survey never
   * moves a building. A list may only grow at its end, and the frontier's segment
   * is the end — rezoning district 0 under a city of twelve would insert plots
   * before district 1's and shift every home past them onto new ground.
   */
  ensure(z: Zoning): this {
    const count = Math.max(0, z.districts);
    if (count < this.fixed) this.rewind();

    for (let i = this.fixed; i < count; i++) this.appendFixed(i);
    if (count > this.fixed) {
      this.fixed = count;
      this._courtyards = this._parks.concat(this._spare);
    }

    const live = count - 1;
    const at = count > 0 ? zoningAt(z, live) : undefined;
    const stamp = at === undefined ? '' : `${live}:${at.home}:${at.shop}:${at.industry}`;
    if (stamp === this.liveStamp && this.settled === Math.max(0, live)) return this;

    // Back to the frozen prefix, then forward again: any district that has since
    // stopped being the frontier is appended as frozen, and the new frontier is
    // built on top of it.
    this.rewindSale();
    for (let i = this.settled; i < Math.max(0, live); i++) this.appendSale(i, z);
    this.settled = Math.max(0, live);
    this.frozenLengths = {
      residential: this._residential.length,
      commercial: this._commercial.length,
      industrial: this._industrial.length,
      scrub: this._scrub.length,
    };
    if (count > 0) this.appendSale(live, z);
    this.liveStamp = stamp;
    return this;
  }

  /**
   * Materialises only the land zoning cannot move: streets, sites, courtyards.
   *
   * What the ground renderer wants, and all it wants — it draws tarmac and land
   * tiles, neither of which has an opinion about what is zoned on top. Composes
   * with `ensure`: the two share the same counter, so whichever runs first does
   * the work and the other finds it done.
   */
  ensureFixed(districts: number): this {
    const count = Math.max(0, districts);
    if (count < this.fixed) this.rewind();
    for (let i = this.fixed; i < count; i++) this.appendFixed(i);
    if (count > this.fixed) {
      this.fixed = count;
      this._courtyards = this._parks.concat(this._spare);
    }
    return this;
  }

  /** Rolls the whole layout back to nothing. A `reset`, or a save from a smaller city. */
  private rewind(): void {
    for (const list of [
      this._residential, this._commercial, this._industrial, this._scrub,
      this._civic, this._universities, this._landmarksLarge, this._landmarksSmall,
      this._cityHalls, this._powerPlants, this._spareSquares, this._parks, this._spare,
    ]) {
      list.length = 0;
    }
    this._districts.length = 0;
    this._courtyards = [];
    this.fixed = 0;
    this.settled = 0;
    this.liveStamp = '';
    this.frozenLengths = { residential: 0, commercial: 0, industrial: 0, scrub: 0 };
  }

  /** Drops every sale plot past the frozen districts. The four zoned lists only. */
  private rewindSale(): void {
    this._residential.length = this.frozenLengths.residential;
    this._commercial.length = this.frozenLengths.commercial;
    this._industrial.length = this.frozenLengths.industrial;
    this._scrub.length = this.frozenLengths.scrub;
  }

  /** One district's zoned plots, at the zoning it currently has. */
  private appendSale(i: number, z: Zoning): void {
    const { residential, commercial, industrial, scrub } = placeDistrict(i, z);
    this._residential.push(...residential);
    this._commercial.push(...commercial);
    this._industrial.push(...industrial);
    this._scrub.push(...scrub);
  }

  /** Everything about a district that zoning cannot move. Appended once. */
  private appendFixed(i: number): void {
    const c = districtCoord(i);
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
    const courtyards = plan.courtyards.map(toGlobal);
    this._civic.push(...plan.sites.map((site) => toGlobal(site.cell)));
    this._universities.push(...plan.universities.map((site) => toGlobal(site.cell)));
    this._landmarksLarge.push(...plan.landmarksLarge.map((site) => toGlobal(site.cell)));
    this._landmarksSmall.push(...plan.landmarksSmall.map((site) => toGlobal(site.cell)));
    this._cityHalls.push(...plan.cityHalls.map((site) => toGlobal(site.cell)));
    this._powerPlants.push(...plan.powerPlants.map((site) => toGlobal(site.cell)));
    this._spareSquares.push(...plan.spareSquares.map((site) => toGlobal(site.cell)));
    this._parks.push(...courtyards.slice(0, BUILDABLE_PARKS_PER_DISTRICT));
    this._spare.push(...courtyards.slice(BUILDABLE_PARKS_PER_DISTRICT));
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

  /** Sellable plots the city owns and has zoned to nothing. Drawn as scrub. */
  get scrub(): readonly Coord[] {
    return this._scrub;
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
  place(zone: Zone, slot: number, merged: number, z: Zoning, out: Placement): Placement {
    const book = this.books.of(zone, z);
    const cells = this.zoneCells(zone);
    // Clamped rather than trusted. `migrate` and `Game` both keep the counts
    // inside the land, but this is the one place a state that got past them
    // would index off the end of a plot list — and the renderer's answer to a
    // broken save has to be a wrong-looking city, not a thrown frame.
    merged = Math.max(0, Math.min(merged, book.pairs(z.districts)));
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
    return this._parks[i] as Coord;
  }

  /**
   * Every interior plot the city owns, park land first and spare land after it.
   *
   * The first `parks` of these carry a park; everything past that is drawn as
   * courtyard — the park plots not yet laid out, then the plots no park will
   * ever stand on. One list at the city level rather than two, because a park
   * does not move a plot from one category to another: it puts something on land
   * the city already had.
   */
  get courtyards(): readonly Coord[] {
    return this._courtyards;
  }

  /** Interior plots held back for whatever the city learns to build next. */
  get spare(): readonly Coord[] {
    return this._spare;
  }

  /** Lower-left plot of every 2x2 square held back with nothing on it. */
  get spareSquares(): readonly Coord[] {
    return this._spareSquares;
  }

  /**
   * Lower-left plot of the i-th landmark site of each size.
   *
   * The same shape as `civicSiteCell` and for the same reason: a landmark's
   * position is a pure function of its ordinal and the layout, so the save
   * carries a count and nothing else. There is one site of each size per
   * district, so the i-th is the i-th district's.
   */
  landmarkLargeSiteCell(i: number): Coord {
    return this._landmarksLarge[i] as Coord;
  }

  landmarkSmallSiteCell(i: number): Coord {
    return this._landmarksSmall[i] as Coord;
  }

  get landmarkLargeSites(): number {
    return this._landmarksLarge.length;
  }

  get landmarkSmallSites(): number {
    return this._landmarksSmall.length;
  }

  /**
   * Lower-left plot of the i-th city hall site. The building spans this plot and
   * the three at +x, +z and +x+z.
   *
   * Only site 0 is ever built on — there is one city hall — and the rest are
   * reserved squares the renderer draws as empty ground. See
   * FRONTAGE_TARGET.cityHallSites for why they are reserved at all.
   */
  cityHallSiteCell(i: number): Coord {
    return this._cityHalls[i] as Coord;
  }

  get cityHallSites(): number {
    return this._cityHalls.length;
  }

  /**
   * Lower-left plot of the i-th power plant site. One a district, and the i-th
   * plant stands on the i-th — no interleave, exactly like a landmark.
   */
  powerPlantCell(i: number): Coord {
    return this._powerPlants[i] as Coord;
  }

  get powerPlantSites(): number {
    return this._powerPlants.length;
  }

  /** Every plot of one zone, in build order. Used by the zone overlay. */
  zoneCells(zone: Zone): readonly Coord[] {
    if (zone === ZONE.commercial) return this._commercial;
    if (zone === ZONE.industrial) return this._industrial;
    return this._residential;
  }
}
