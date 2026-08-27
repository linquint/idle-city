import { MAX_DISTRICTS } from './config.ts';
import { cityRadius } from './layout.ts';
import { WATERS, WATER_TILE, type Shore } from './water.ts';

/**
 * The industrial estates beyond the city edge, and where they stand.
 *
 * Deliberately *not* a district and deliberately not built out of
 * `districtPlan`. A district is a street generator's output — an irregular grid
 * of small plots, rejection-sampled until its frontage budget lands exactly —
 * and none of that is what an estate is. An estate is one large parcel off a
 * road, with no streets inside it, no zoning split and no frontage to sell. It
 * would be a strange thing to reach for `districtPlan` to describe, and using
 * it would also make the estates inherit a layout the frozen generator is not
 * allowed to change for them.
 *
 * So this is its own thing: a coarse grid in the coast frame, laid in a band
 * behind the city, filled outward from the axis and skipping whatever the water
 * has taken. Same rules as everything else in the simulation — a pure function
 * of an ordinal and the seed, nothing stored, nothing that moves once built.
 */

/** The side of one estate parcel, in world units. Nine plots across. */
export const ESTATE_SPAN = 36;

/**
 * How far apart the columns are laid, centre to centre.
 *
 * Wider than the parcel by a verge either side, and the verge is load-bearing:
 * the highway spur comes down the axis *between* the two middle columns to
 * reach the band road, so the gap has to be wide enough for a road and its
 * shoulders. A pitch equal to the span would have put the spur through a yard.
 */
const ESTATE_PITCH = ESTATE_SPAN + 12;

/**
 * How deep the band is, in parcels.
 *
 * Two rows rather than a wide field, because the band has to read as an *edge*
 * from the play camera — a strip of works along a road at the end of town, not
 * a second city. Both rows front onto the same road, which runs down the gap
 * between them; a band deeper than two would need service roads of its own and
 * would have stopped being an edge.
 */
export const ESTATE_ROWS = 2;

/** The gap the band road runs down, between the two rows. */
export const ESTATE_ROAD_GAP = 16;

/**
 * How far out the band reaches along the shore, in columns either side.
 *
 * Six puts thirteen columns and twenty-six parcels in the band, which comes out
 * 624 world units across — within a district of the 660 a full city is wide. A
 * band much wider than the town it serves reads as a second town.
 */
const ESTATE_COLS = 6;

/**
 * How far the band stands off the furthest land the city could ever own.
 *
 * Derived from `cityRadius(MAX_DISTRICTS)` rather than chosen, and that is the
 * whole reason the estates can be at a fixed place at all: an estate must never
 * move once it is built, so its position cannot depend on how big the city is
 * *now* — and the only bound that does not is how big the city could ever get.
 * Half a district of clearance is what the highway spur runs through.
 */
const ESTATE_GAP = WATER_TILE / 2;
const ESTATE_INSET = cityRadius(MAX_DISTRICTS) + ESTATE_GAP;

/** Where the band's near edge and its far edge sit, in the coast frame. */
export const ESTATE_NEAR = -ESTATE_INSET;
export const ESTATE_FAR = ESTATE_NEAR - ESTATE_ROWS * ESTATE_SPAN - ESTATE_ROAD_GAP;

/**
 * Where the band road runs, in the coast frame: down the gap between the rows.
 *
 * Stated here rather than in the renderer because it is a fact about the
 * *layout* — the rows are placed either side of it — and a road the renderer
 * decided on its own would be one the parcels had no reason to line up with.
 */
export const ESTATE_ROAD_U = ESTATE_NEAR - ESTATE_SPAN - ESTATE_ROAD_GAP / 2;

/** Where the row-th row of parcels has its centreline. */
const rowU = (row: number): number =>
  ESTATE_NEAR - (row + 0.5) * ESTATE_SPAN - (row >= 1 ? ESTATE_ROAD_GAP : 0);

/** One parcel's place in the coast frame. */
export interface EstateCell {
  /** Away from the sea; always negative, since the band is behind the city. */
  readonly u: number;
  /** Along the shore. Zero is the axis the highway spur runs down. */
  readonly v: number;
}

/**
 * The order parcels are taken in: outward from the axis, both ways, a whole
 * column at a time.
 *
 * Balanced around the spur for the same reason `ringCoords` is balanced around
 * the origin — a band that filled from one end would grow as a lopsided arm
 * with the highway chasing it. The columns straddle the axis rather than
 * sitting on it, so the pair nearest the spur is one either side of it, and
 * both rows of a column are taken together so a column is finished before the
 * next is opened.
 */
function ordered(): EstateCell[] {
  const cells: EstateCell[] = [];
  for (let k = 0; k <= ESTATE_COLS; k++) {
    for (const col of k === 0 ? [0, -1] : [k, -k - 1]) {
      for (let row = 0; row < ESTATE_ROWS; row++) {
        cells.push({ u: rowU(row), v: (col + 0.5) * ESTATE_PITCH });
      }
    }
  }
  return cells;
}

/**
 * The dry parcels, in order. Built once.
 *
 * Wet ones are skipped rather than left as gaps, exactly as the district spiral
 * skips them, so `estates: 6` means six estates rather than six positions of
 * which some are lake. The band is behind the city and the river runs across
 * that ground, so this is not a formality — see the calibrator for how many the
 * water takes.
 */
const cells: EstateCell[] = ordered().filter((cell) => {
  const at: Shore = { x: 0, z: 0 };
  WATERS.toWorld(cell.u, cell.v, at);
  return WATERS.dryAround(at.x, at.z, ESTATE_SPAN / 2);
});

/** How many parcels the band holds at all. The ceiling on `estates`. */
export const ESTATE_CELLS = cells.length;

/** Where the i-th estate stands, in the coast frame, or null past the band. */
export function estateCell(i: number): EstateCell | null {
  return cells[i] ?? null;
}

/**
 * How far along the shore the built estates reach, in world units either side.
 *
 * What the highway has to cover. Read by the renderer rather than stored: the
 * road follows the industry, and the industry is a count.
 */
export function estateReach(built: number): number {
  let reach = 0;
  for (let i = 0; i < built && i < cells.length; i++) {
    reach = Math.max(reach, Math.abs((cells[i] as EstateCell).v));
  }
  return reach;
}
