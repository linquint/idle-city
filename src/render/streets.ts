import { ZONE } from '../sim/citygen.ts';
import { DISTRICT_SPAN } from '../sim/config.ts';
import { districtLayoutAt, type Coord, type District } from '../sim/layout.ts';

/**
 * The street graph of one district, shared by everything that travels along it.
 *
 * It lived in `cars.ts` until the pavements needed it too, and it is here
 * rather than imported from there for the reason `routeHighway` takes its lane
 * geometry from `highway.ts`: two opinions about where a street is would
 * eventually be one walker crossing a block diagonally. A street is neither the
 * traffic's nor the pedestrians' — it is the citygen's, read once and cached.
 *
 * Imports carry their `.ts` extensions, which is the convention `tsconfig.json`
 * documents: a module a `tools/` harness has to load is a module plain Node has
 * to resolve, and `tools/pedestrians.calibrate.mjs` loads this one.
 */

/**
 * The junction grid of one district: every street that runs the whole way
 * across it, and what each of them fronts.
 *
 * Grid coordinates rather than world ones, because a junction is the *pair* of
 * a row and a column and the arithmetic that turns a car onto a crossing street
 * is arithmetic over those two numbers. World positions are a multiplication
 * away and are worked out per leg.
 *
 * The far boundary is included in both axes. It is the neighbouring district's
 * line 0 rather than this district's — that is how `citygen` keeps a district
 * edge a single-width street instead of a double one — but it is a street, and
 * the old router already drove cars to it by spanning `centre +/- half`.
 */
export interface RoadLines {
  /** Grid z of each full row street, plus the district's far edge. */
  readonly rows: number[];
  /** Grid x of each full column street, plus the district's far edge. */
  readonly cols: number[];
  /**
   * Zoned plots fronting each street, housing and workplaces counted apart.
   *
   * The bias that makes a route read as a commute rather than as wandering: a
   * car starts on a street with houses on it and finishes on one with shops or
   * works. Indexed alongside `rows` / `cols`.
   *
   * Read off the generator's *zoning* rather than off the built plots, and that
   * is the load-bearing choice: a route must not depend on which specific
   * building exists, or a car would be holding a fact the simulation could not
   * reproduce. Zoning is a pure function of the seed, so this is cached once
   * per district and never recomputed.
   */
  readonly rowHomes: number[];
  readonly colHomes: number[];
  readonly rowWork: number[];
  readonly colWork: number[];
}

/**
 * Which of a district's streets run the whole way across it, and what they front.
 *
 * A district's road cells are the union of its full rows and its full columns,
 * so a line is exactly a coordinate that contributes DISTRICT_SPAN cells. Any
 * other row picks up only the cells where the column streets cross it. Measured
 * over the 49 districts of a full city: the count picks out the generator's own
 * rowRoad/colRoad masks exactly, every district has 2 or 3 lines on each axis,
 * and the largest count a *non*-line ever reaches is 3 against a threshold of
 * 12. Derived once per district and cached; districts are append-only.
 *
 * Exported for the pedestrians, which walk the same streets. Sharing it rather
 * than copying it is the same argument `routeHighway` makes for taking the
 * highway's lane geometry from `highway.ts`: two opinions about where a street
 * is would eventually be one walker crossing a block diagonally.
 */
export function roadLines(district: District): RoadLines {
  const rowCount = new Int32Array(DISTRICT_SPAN);
  const colCount = new Int32Array(DISTRICT_SPAN);
  const ox = district.coord.x * DISTRICT_SPAN;
  const oz = district.coord.z * DISTRICT_SPAN;
  for (const cell of district.roads as readonly Coord[]) {
    const lz = cell.z - oz;
    const lx = cell.x - ox;
    if (lz >= 0 && lz < DISTRICT_SPAN) rowCount[lz] = (rowCount[lz] ?? 0) + 1;
    if (lx >= 0 && lx < DISTRICT_SPAN) colCount[lx] = (colCount[lx] ?? 0) + 1;
  }
  const rows: number[] = [];
  const cols: number[] = [];
  const local: number[] = [];
  const localCols: number[] = [];
  for (let i = 0; i < DISTRICT_SPAN; i++) {
    if (rowCount[i] === DISTRICT_SPAN) {
      rows.push(oz + i);
      local.push(i);
    }
    if (colCount[i] === DISTRICT_SPAN) {
      cols.push(ox + i);
      localCols.push(i);
    }
  }
  // The neighbour's line 0, which is this district's far kerb. A car is only
  // ever created, turned or retired at a junction, and the edge is one.
  rows.push(oz + DISTRICT_SPAN);
  local.push(DISTRICT_SPAN);
  cols.push(ox + DISTRICT_SPAN);
  localCols.push(DISTRICT_SPAN);

  const zone = districtLayoutAt(district.coord.x, district.coord.z).zone;
  const at = (x: number, z: number): number =>
    x < 0 || x >= DISTRICT_SPAN || z < 0 || z >= DISTRICT_SPAN ? -1 : (zone[z * DISTRICT_SPAN + x] ?? -1);
  /** Plots of one kind fronting a street, counted along both of its kerbs. */
  const fronting = (line: number, alongX: boolean, homes: boolean): number => {
    let n = 0;
    for (let i = 0; i < DISTRICT_SPAN; i++) {
      for (const side of [-1, 1]) {
        const z = alongX ? line + side : i;
        const x = alongX ? i : line + side;
        const kind = at(x, z);
        if (kind < 0) continue;
        if (homes ? kind === ZONE.residential : kind === ZONE.commercial || kind === ZONE.industrial) {
          n++;
        }
      }
    }
    return n;
  };

  return {
    rows,
    cols,
    rowHomes: local.map((z) => fronting(z, true, true)),
    colHomes: localCols.map((x) => fronting(x, false, true)),
    rowWork: local.map((z) => fronting(z, true, false)),
    colWork: localCols.map((x) => fronting(x, false, false)),
  };
}
