/**
 * District generation: streets, blocks and zoning.
 *
 * A district is generated as a pure function of one integer seed. Nothing here
 * imports three.js or touches the DOM, so the whole thing runs in Node — which
 * is what `tools/citygen.test.mjs` and `tools/citygen.calibrate.mjs` rely on.
 *
 * The unit of generation is one district, not the whole city. That is forced by
 * the economy: `PLOTS_PER_DISTRICT` is a compile-time constant that
 * `homeCapacity`/`shopCapacity` multiply by the district count, so every
 * district must carve out *exactly* the same number of buildable plots however
 * irregular its streets are. Rejection sampling below is what guarantees it.
 */
import { rng, shuffle } from '../core/rng.ts';
import {
  DISTRICT_SPAN,
  ROAD_GAP_MAX,
  ROAD_GAP_MIN,
  TARGET_PLOTS,
  ZONE_SHARE,
} from './config.ts';

export const ZONE = {
  road: 0,
  residential: 1,
  commercial: 2,
  industrial: 3,
} as const;

export type Zone = (typeof ZONE)[keyof typeof ZONE];

/** Which map edge the freight line runs along. Industry gravitates to it. */
export const RAIL_SIDE = { north: 0, east: 1, south: 2, west: 3 } as const;
export type RailSide = (typeof RAIL_SIDE)[keyof typeof RAIL_SIDE];

export interface Block {
  readonly id: number;
  /** Inclusive plot bounds. Blocks are axis-aligned rectangles by construction. */
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  /** Local cell indices (z * DISTRICT_SPAN + x), row-major. */
  readonly cells: readonly number[];
  readonly area: number;
  /** Plots touching a road / area. ~1.0 for a small block, lower for a big one. */
  readonly frontage: number;
  /** 1 at the middle of the district, 0 at its furthest corner. */
  readonly centrality: number;
}

export interface DistrictLayout {
  /** The seed that actually produced this layout (the accepted attempt's seed). */
  readonly seed: number;
  /** How many rejection-sampling attempts it took. 1 means first try. */
  readonly attempts: number;
  /** Road masks, indexed by local row/column. Index DISTRICT_SPAN is the
   *  neighbouring district's line 0, which is always a road. */
  readonly rowRoad: Uint8Array;
  readonly colRoad: Uint8Array;
  /** Per local cell: a ZONE value. Roads are ZONE.road. */
  readonly zone: Uint8Array;
  /** Per local cell: owning block id, or -1 for a road. */
  readonly block: Int16Array;
  /**
   * Per local cell: 1 when the plot touches a road, 0 when it is buried inside
   * a block. This is what the three build-order lists are filtered on, so an
   * interior plot stays zoned but is never offered as a building site.
   */
  readonly perimeter: Uint8Array;
  readonly blocks: readonly Block[];
  readonly buildable: number;
  readonly railSide: RailSide;
  /**
   * Build order per zone: local cell indices, shuffled within the zone.
   *
   * Road-adjacent plots only. Every building in this game fronts a street, so
   * the interior of a deep block is zoned land that will never be built on —
   * `civicSites` in layout.ts claims most of it for 2x2 civic buildings and the
   * renderer draws whatever is left as a courtyard.
   */
  readonly residential: readonly number[];
  readonly commercial: readonly number[];
  readonly industrial: readonly number[];
}

const SPAN = DISTRICT_SPAN;
const cellIndex = (x: number, z: number): number => z * SPAN + x;

// ------------------------------------------------------------------- part 1

/**
 * Walks from 0 to `span` in seeded steps, marking each landing as a road line.
 * Returns the line positions, always starting at 0 and ending at `span`.
 *
 * The tail is the whole difficulty. Stepping until the walk passes `span` and
 * clamping leaves a final gap anywhere in [1, max] — with span 12 and steps of
 * 3-7 you can land on 11 and be left with a one-plot sliver, or absorb it and
 * be left with a gap of 9. Both are repaired explicitly below and the result is
 * asserted, because an out-of-range gap is a rendering artefact nobody would
 * trace back to here.
 */
export function cutWalk(
  random: () => number,
  span: number,
  min: number,
  max: number,
): number[] {
  const lines = [0];
  let p = 0;
  while (p < span) {
    p += min + Math.floor(random() * (max - min + 1));
    lines.push(Math.min(p, span));
  }
  // The clamp above can duplicate `span` only if p landed exactly on it, in
  // which case the loop had already stopped. One trailing entry, always.
  const last = lines.length - 1;
  const tail = span - (lines[last - 1] as number);

  if (tail < min && lines.length > 2) {
    // Too thin: absorb the sliver into the previous block by dropping the line
    // that created it.
    const before = lines[last - 2] as number;
    const merged = span - before;
    if (merged <= max) {
      lines.splice(last - 1, 1);
    } else {
      // Absorbing would leave a gap that is too *wide*, so move the line rather
      // than drop it. This branch only runs for merged > max, and a step plus a
      // sub-minimum tail cannot exceed max + min - 1, so the split lands inside
      // [min, max] on both sides as long as max + 1 >= 2 * min. If a future
      // pair of constants breaks that, assertGaps below says so rather than
      // letting an illegal block reach the renderer.
      const half = Math.min(Math.max(Math.round(merged / 2), min), merged - min);
      lines[last - 1] = before + half;
    }
  }

  assertGaps(lines, span, min, max);
  return lines;
}

/** Assert it, don't assume it. */
function assertGaps(lines: readonly number[], span: number, min: number, max: number): void {
  if (lines[0] !== 0 || lines[lines.length - 1] !== span) {
    throw new Error(`cut walk must span [0, ${span}]: got ${lines.join(',')}`);
  }
  for (let i = 1; i < lines.length; i++) {
    const gap = (lines[i] as number) - (lines[i - 1] as number);
    if (gap < min || gap > max) {
      throw new Error(`gap ${gap} outside [${min}, ${max}] in ${lines.join(',')}`);
    }
  }
}

// ------------------------------------------------------------------- part 2

interface Skeleton {
  readonly rowLines: number[];
  readonly colLines: number[];
  readonly rowRoad: Uint8Array;
  readonly colRoad: Uint8Array;
  readonly buildable: number;
}

/**
 * Both axes of one candidate street plan.
 *
 * Line `span` belongs to the *next* district — it is that district's line 0,
 * which is always a road. Sharing the boundary line rather than giving every
 * district its own perimeter is what keeps district boundaries a single-width
 * street instead of a double-width one, and it is why streets still meet across
 * districts now that spacing is irregular.
 */
function skeleton(random: () => number): Skeleton {
  const rowLines = cutWalk(random, SPAN, ROAD_GAP_MIN, ROAD_GAP_MAX);
  const colLines = cutWalk(random, SPAN, ROAD_GAP_MIN, ROAD_GAP_MAX);

  const rowRoad = new Uint8Array(SPAN + 1);
  const colRoad = new Uint8Array(SPAN + 1);
  for (const z of rowLines) rowRoad[z] = 1;
  for (const x of colLines) colRoad[x] = 1;

  // Lines strictly inside [0, span) are this district's own streets; the line
  // at `span` is the neighbour's, so it costs this district nothing.
  const buildable = (SPAN - (rowLines.length - 1)) * (SPAN - (colLines.length - 1));
  return { rowLines, colLines, rowRoad, colRoad, buildable };
}

interface Labelled {
  readonly blocks: Block[];
  readonly block: Int16Array;
  readonly perimeter: Uint8Array;
}

/** Labels the non-road cells. Blocks are rectangles, so this is a scan. */
function label(s: Skeleton): Labelled {
  const blocks: Block[] = [];
  const block = new Int16Array(SPAN * SPAN).fill(-1);
  const perimeter = new Uint8Array(SPAN * SPAN);

  const mid = (SPAN - 1) / 2;
  const maxDistance = Math.hypot(mid, mid);

  for (let r = 1; r < s.rowLines.length; r++) {
    for (let c = 1; c < s.colLines.length; c++) {
      const z0 = (s.rowLines[r - 1] as number) + 1;
      const z1 = (s.rowLines[r] as number) - 1;
      const x0 = (s.colLines[c - 1] as number) + 1;
      const x1 = (s.colLines[c] as number) - 1;

      const id = blocks.length;
      const cells: number[] = [];
      let touching = 0;
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const i = cellIndex(x, z);
          cells.push(i);
          block[i] = id;
          // Every block is bounded by roads on all four sides, so touching a
          // road is exactly being on the block's outer ring.
          const edge = z === z0 || z === z1 || x === x0 || x === x1;
          if (edge) {
            perimeter[i] = 1;
            touching++;
          }
        }
      }

      const area = cells.length;
      const distance = Math.hypot((x0 + x1) / 2 - mid, (z0 + z1) / 2 - mid);
      blocks.push({
        id,
        x0,
        x1,
        z0,
        z1,
        cells,
        area,
        frontage: touching / area,
        // "Centrality" is centre-ness, so it is the *inverse* of the normalised
        // distance: 1 in the middle, 0 at the furthest corner. Scoring commerce
        // on raw distance would push every shop to the rim.
        centrality: 1 - distance / maxDistance,
      });
    }
  }

  return { blocks, block, perimeter };
}

// ------------------------------------------------------------------- part 3

/** Distance from a block's centre to the rail edge, normalised to [0, 1]. */
function railProximity(b: Block, side: RailSide): number {
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  const d =
    side === RAIL_SIDE.north ? cz
    : side === RAIL_SIDE.south ? SPAN - cz
    : side === RAIL_SIDE.west ? cx
    : SPAN - cx;
  return 1 - d / SPAN;
}

/**
 * The perimeter of a block walked as a ring: top edge left to right, then right
 * edge, bottom edge, left edge. A commercial block that only half fits inside
 * the budget then gets a contiguous run of shopfronts rather than a dotted line.
 */
function ring(b: Block): number[] {
  // Gaps are never below 3, so a block is never thinner than two plots and the
  // ring below always has an inside and an outside. The guard is belt and braces.
  if (b.z0 === b.z1 || b.x0 === b.x1) return [...b.cells];
  const out: number[] = [];
  for (let x = b.x0; x <= b.x1; x++) out.push(cellIndex(x, b.z0));
  for (let z = b.z0 + 1; z <= b.z1; z++) out.push(cellIndex(b.x1, z));
  for (let x = b.x1 - 1; x >= b.x0; x--) out.push(cellIndex(x, b.z1));
  for (let z = b.z1 - 1; z > b.z0; z--) out.push(cellIndex(b.x0, z));
  return out;
}

/**
 * Zones block-wise, never plot-wise. A factory block that comes out half
 * residential defeats the point of having blocks at all.
 */
export interface ZoneBudget {
  readonly residential: number;
  readonly commercial: number;
  readonly industrial: number;
}

/**
 * Splits a plot count three ways. Industry and commerce round; housing takes
 * the remainder, so the three always sum back to `buildable` exactly however
 * the fractions land. The economy's per-district constants are derived from
 * this same function, so the map and the capacity numbers cannot drift apart.
 */
export function zoneBudget(buildable: number): ZoneBudget {
  const industrial = Math.round(buildable * ZONE_SHARE.industrial);
  const commercial = Math.round(buildable * ZONE_SHARE.commercial);
  return { residential: buildable - industrial - commercial, commercial, industrial };
}

function zoneBlocks(
  blocks: readonly Block[],
  buildable: number,
  railSide: RailSide,
): Uint8Array {
  const zone = new Uint8Array(SPAN * SPAN);
  const maxArea = blocks.reduce((m, b) => Math.max(m, b.area), 1);

  const budget = zoneBudget(buildable);
  let industrialBudget = budget.industrial;
  let commercialBudget = budget.commercial;

  const byId = (a: { id: number }, b: { id: number }): number => a.id - b.id;

  // Industry wants footprint and wants to be out of the way.
  const industrialOrder = blocks
    .map((b) => ({ b, id: b.id, score: 0.55 * railProximity(b, railSide) + 0.45 * (b.area / maxArea) }))
    .sort((p, q) => q.score - p.score || byId(p, q));

  const industrialBlocks = new Set<number>();
  for (const { b } of industrialOrder) {
    if (industrialBudget <= 0) break;
    industrialBlocks.add(b.id);
    // The block that straddles the budget line is only partly assigned. Filling
    // it row-major keeps the part that is taken contiguous.
    const take = Math.min(industrialBudget, b.area);
    for (let i = 0; i < take; i++) zone[b.cells[i] as number] = ZONE.industrial;
    industrialBudget -= take;
  }

  // Shops belong on the street, and near the middle of the district.
  const commercialOrder = blocks
    .filter((b) => !industrialBlocks.has(b.id))
    .map((b) => ({ b, id: b.id, score: 0.6 * b.frontage + 0.4 * b.centrality }))
    .sort((p, q) => q.score - p.score || byId(p, q));

  for (const { b } of commercialOrder) {
    if (commercialBudget <= 0) break;
    // Only perimeter plots are commercial; the interior falls back to housing.
    // That is what produces shopfronts wrapping a residential core.
    for (const cell of ring(b)) {
      if (commercialBudget <= 0) break;
      // 0 is "not yet assigned" as well as ZONE.road; inside a block it can
      // only mean unassigned, so this skips plots industry already took.
      if (zone[cell] !== 0) continue;
      zone[cell] = ZONE.commercial;
      commercialBudget--;
    }
  }

  // Housing is everything left over.
  for (const b of blocks) {
    for (const cell of b.cells) if (zone[cell] === 0) zone[cell] = ZONE.residential;
  }
  return zone;
}

// ------------------------------------------------------------------ assembly

/**
 * One attempt: a street plan, its blocks, and the zoning over them. Exported so
 * the calibration script can measure the raw distribution of buildable counts
 * before rejection sampling narrows it to one.
 */
export function generateAttempt(seed: number): Omit<DistrictLayout, 'attempts'> {
  const random = rng(seed);
  const s = skeleton(random);
  const { blocks, block, perimeter } = label(s);
  const railSide = Math.floor(random() * 4) as RailSide;
  const zone = zoneBlocks(blocks, s.buildable, railSide);

  const residential: number[] = [];
  const commercial: number[] = [];
  const industrial: number[] = [];
  for (let i = 0; i < zone.length; i++) {
    // Frontage is the filter. `zone` keeps the interior plots — they are still
    // residential or industrial land, they are simply not for sale.
    if (perimeter[i] !== 1) continue;
    if (zone[i] === ZONE.residential) residential.push(i);
    else if (zone[i] === ZONE.commercial) commercial.push(i);
    else if (zone[i] === ZONE.industrial) industrial.push(i);
  }

  // Build order is shuffled inside each zone, so a district fills in unevenly
  // without a home ever landing on a shop's plot.
  shuffle(residential, rng(seed ^ 0x9e3779b9));
  shuffle(commercial, rng(seed ^ 0x85ebca6b));
  shuffle(industrial, rng(seed ^ 0xc2b2ae35));

  return {
    seed,
    rowRoad: s.rowRoad,
    colRoad: s.colRoad,
    zone,
    block,
    perimeter,
    blocks,
    buildable: s.buildable,
    railSide,
    residential,
    commercial,
    industrial,
  };
}

/** How many reseeds a district may take before the fallback below kicks in. */
export const MAX_ATTEMPTS = 64;

/**
 * Generates one district, rejection-sampling until it carves out exactly
 * TARGET_PLOTS buildable plots.
 *
 * The published version of this idea accepts anything within a tolerance band.
 * Here the tolerance is zero, because `PLOTS_PER_DISTRICT` is a constant the
 * economy multiplies by the district count: a district with 144 plots and a
 * district with 132 cannot share one capacity number without either stranding
 * land or letting the player buy a plot that does not exist. Widening the band
 * would mean rewriting `homeCapacity`/`shopCapacity` to walk the plot book,
 * which is a change to the economy this task is not allowed to make.
 *
 * See tools/citygen.calibrate.mjs for the distribution TARGET_PLOTS came from.
 */
export function generateDistrict(seed: number): DistrictLayout {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = generateAttempt((seed + i * 7919) | 0);
    if (candidate.buildable === TARGET_PLOTS) return { ...candidate, attempts: i + 1 };
  }
  // Unreachable in practice — the test sweeps 1000 seeds and the worst case is
  // a small number of attempts. Throwing beats silently shipping a district
  // with the wrong plot count, which would desync the economy from the map.
  throw new Error(`no ${TARGET_PLOTS}-plot layout for seed ${seed} in ${MAX_ATTEMPTS} attempts`);
}
