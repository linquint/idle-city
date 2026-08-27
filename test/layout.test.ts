import { describe, expect, it } from 'vitest';
import { ZONE } from '../src/sim/citygen';
import { CELL, DISTRICT_SPAN, FRONTAGE_TARGET, MAX_DISTRICTS } from '../src/sim/config';
import {
  BUILDABLE_COMMERCIAL_PER_DISTRICT as COMMERCIAL_PER_DISTRICT,
  BUILDABLE_PARKS_PER_DISTRICT,
  BUILDABLE_INDUSTRIAL_PER_DISTRICT as INDUSTRIAL_PER_DISTRICT,
  BUILDABLE_RESIDENTIAL_PER_DISTRICT as RESIDENTIAL_PER_DISTRICT,
  CityLayout,
  CIVIC_SITES_PER_DISTRICT,
  cityRadius,
  DISTRICT_WIDTH,
  districtCoord,
  housingCentrality,
  housingCentralityBase,
  housingCentralityMean,
  isRoad,
  planFor,
  PLOTS_PER_DISTRICT,
  SPARE_PLOTS_PER_DISTRICT,
  UNIVERSITY_SITES_PER_DISTRICT,
  worldX,
  worldZ,
  zoneAt,
} from '../src/sim/layout';

const key = (c: { x: number; z: number }): string => `${c.x},${c.z}`;

describe('district placement', () => {
  it('spirals outward without ever repeating a coordinate', () => {
    const seen = new Set<string>();
    for (let i = 0; i < MAX_DISTRICTS; i++) seen.add(key(districtCoord(i)));
    expect(seen.size).toBe(MAX_DISTRICTS);
  });

  it('fills each ring before starting the next', () => {
    let previous = 0;
    for (let i = 0; i < MAX_DISTRICTS; i++) {
      const c = districtCoord(i);
      const ring = Math.max(Math.abs(c.x), Math.abs(c.z));
      expect(ring).toBeGreaterThanOrEqual(previous);
      previous = ring;
    }
  });

  it('grows the city radius monotonically', () => {
    for (let i = 2; i <= MAX_DISTRICTS; i++) {
      expect(cityRadius(i)).toBeGreaterThanOrEqual(cityRadius(i - 1));
    }
  });
});

describe('land tiles', () => {
  it('sit exactly on top of their own streets', () => {
    // A tile that is offset from the cells it is supposed to hold shows up as
    // a slab of ground sliding out from under the road grid.
    const layout = new CityLayout().ensure(9);
    for (const district of layout.districts) {
      const xs = district.roads.map((c) => worldX(c.x));
      const zs = district.roads.map((c) => worldZ(c.z));
      // Streets run along both axes, so the road cells reach every edge of the
      // district and their bounding box is the district's own.
      const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
      expect(district.centreX).toBeCloseTo(midX, 6);
      expect(district.centreZ).toBeCloseTo(midZ, 6);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(DISTRICT_WIDTH - CELL, 6);
    }
  });

  it('tiles the plane edge to edge', () => {
    const layout = new CityLayout().ensure(9);
    const a = layout.districts[0]!;
    const neighbours = layout.districts.filter(
      (d) => Math.abs(d.coord.x - a.coord.x) + Math.abs(d.coord.z - a.coord.z) === 1,
    );
    expect(neighbours.length).toBeGreaterThan(0);
    for (const n of neighbours) {
      const gap = Math.hypot(n.centreX - a.centreX, n.centreZ - a.centreZ);
      expect(gap).toBeCloseTo(DISTRICT_WIDTH, 6);
    }
  });
});

describe('streets', () => {
  it('joins up across district boundaries', () => {
    // Each district's line 0 is always a road and its far edge is the *next*
    // district's line 0, so a boundary is one street wide rather than two and
    // the grid still connects however irregular the interiors are.
    for (let d = -2; d <= 2; d++) {
      for (let i = 0; i < DISTRICT_SPAN * 3; i++) {
        expect(isRoad(d * DISTRICT_SPAN, i)).toBe(true);
        expect(isRoad(i, d * DISTRICT_SPAN)).toBe(true);
      }
    }
  });

  it('never leaves a plot more than a step from a street', () => {
    // A gap above the maximum would bury plots in the middle of a super-block.
    const reach = Math.floor((7 - 1) / 2);
    for (let z = -DISTRICT_SPAN; z < DISTRICT_SPAN * 2; z++) {
      for (let x = -DISTRICT_SPAN; x < DISTRICT_SPAN * 2; x++) {
        if (isRoad(x, z)) continue;
        let near = false;
        for (let d = 1; d <= reach && !near; d++) {
          near = isRoad(x - d, z) || isRoad(x + d, z) || isRoad(x, z - d) || isRoad(x, z + d);
        }
        expect(near).toBe(true);
      }
    }
  });

  it('agrees with the zone map about what is a road', () => {
    for (let z = -DISTRICT_SPAN; z < DISTRICT_SPAN * 2; z++) {
      for (let x = -DISTRICT_SPAN; x < DISTRICT_SPAN * 2; x++) {
        expect(isRoad(x, z)).toBe(zoneAt(x, z) === ZONE.road);
      }
    }
  });
});

describe('plot book', () => {
  it('splits every district into the same plot counts', () => {
    // Two numbers, and conflating them is the mistake worth guarding against:
    // PLOTS_PER_DISTRICT is the zoned land, and the buildable constants are the
    // part of it that fronts a street and is not held for a civic site. The
    // rest is courtyard, which is why these no longer add up to the total.
    const sellable =
      RESIDENTIAL_PER_DISTRICT + COMMERCIAL_PER_DISTRICT + INDUSTRIAL_PER_DISTRICT;
    expect(
      sellable + CIVIC_SITES_PER_DISTRICT * 4 + UNIVERSITY_SITES_PER_DISTRICT * 9,
    ).toBeLessThanOrEqual(PLOTS_PER_DISTRICT);
    expect(sellable).toBeLessThan(PLOTS_PER_DISTRICT);
    expect(PLOTS_PER_DISTRICT).toBeLessThan(DISTRICT_SPAN * DISTRICT_SPAN);

    const layout = new CityLayout().ensure(MAX_DISTRICTS);
    for (const district of layout.districts) {
      const plots = DISTRICT_SPAN * DISTRICT_SPAN - district.roads.length;
      expect(plots).toBe(PLOTS_PER_DISTRICT);
    }
  });

  it('offers only plots that front a street', () => {
    // The rule the whole change turns on: no building is ever landlocked in the
    // middle of a block, so every plot the city can buy has a road neighbour.
    const layout = new CityLayout().ensure(4);
    const fronts = (c: { x: number; z: number }): boolean =>
      isRoad(c.x - 1, c.z) || isRoad(c.x + 1, c.z) || isRoad(c.x, c.z - 1) || isRoad(c.x, c.z + 1);
    for (let i = 0; i < RESIDENTIAL_PER_DISTRICT * 4; i++) expect(fronts(layout.homeCell(i))).toBe(true);
    for (let i = 0; i < COMMERCIAL_PER_DISTRICT * 4; i++) expect(fronts(layout.shopCell(i))).toBe(true);
    for (let i = 0; i < INDUSTRIAL_PER_DISTRICT * 4; i++) expect(fronts(layout.industryCell(i))).toBe(true);
    // And so does every civic site, on at least one of its four plots.
    for (let i = 0; i < layout.civicSites; i++) {
      const c = layout.civicSiteCell(i);
      const quad = [c, { x: c.x + 1, z: c.z }, { x: c.x, z: c.z + 1 }, { x: c.x + 1, z: c.z + 1 }];
      expect(quad.some(fronts)).toBe(true);
      for (const cell of quad) expect(isRoad(cell.x, cell.z)).toBe(false);
    }
  });

  it('never places a building on a street', () => {
    const layout = new CityLayout().ensure(6);
    for (let i = 0; i < RESIDENTIAL_PER_DISTRICT * 6; i++) {
      const cell = layout.homeCell(i);
      expect(isRoad(cell.x, cell.z)).toBe(false);
    }
    for (let i = 0; i < COMMERCIAL_PER_DISTRICT * 6; i++) {
      const cell = layout.shopCell(i);
      expect(isRoad(cell.x, cell.z)).toBe(false);
    }
    for (let i = 0; i < INDUSTRIAL_PER_DISTRICT * 6; i++) {
      const cell = layout.industryCell(i);
      expect(isRoad(cell.x, cell.z)).toBe(false);
    }
  });

  it('puts every building on a plot zoned for it', () => {
    const layout = new CityLayout().ensure(6);
    for (let i = 0; i < RESIDENTIAL_PER_DISTRICT * 6; i++) {
      const cell = layout.homeCell(i);
      expect(zoneAt(cell.x, cell.z)).toBe(ZONE.residential);
    }
    for (let i = 0; i < COMMERCIAL_PER_DISTRICT * 6; i++) {
      const cell = layout.shopCell(i);
      expect(zoneAt(cell.x, cell.z)).toBe(ZONE.commercial);
    }
    for (let i = 0; i < INDUSTRIAL_PER_DISTRICT * 6; i++) {
      const cell = layout.industryCell(i);
      expect(zoneAt(cell.x, cell.z)).toBe(ZONE.industrial);
    }
  });

  it('gives every plot in the city a distinct cell', () => {
    const layout = new CityLayout().ensure(9);
    const seen = new Set<string>();
    for (let i = 0; i < RESIDENTIAL_PER_DISTRICT * 9; i++) seen.add(key(layout.homeCell(i)));
    for (let i = 0; i < COMMERCIAL_PER_DISTRICT * 9; i++) seen.add(key(layout.shopCell(i)));
    for (let i = 0; i < INDUSTRIAL_PER_DISTRICT * 9; i++) seen.add(key(layout.industryCell(i)));
    const sellable =
      (RESIDENTIAL_PER_DISTRICT + COMMERCIAL_PER_DISTRICT + INDUSTRIAL_PER_DISTRICT) * 9;
    expect(seen.size).toBe(sellable);

    // Civic sites, universities and courtyards make up the difference, with
    // nothing shared: every one of these adds a cell the sale lists never had.
    for (let i = 0; i < layout.civicSites; i++) {
      const c = layout.civicSiteCell(i);
      for (const cell of [c, { x: c.x + 1, z: c.z }, { x: c.x, z: c.z + 1 }, { x: c.x + 1, z: c.z + 1 }]) {
        seen.add(key(cell));
      }
    }
    const square = (c: { x: number; z: number }, size: number): void => {
      for (let dz = 0; dz < size; dz++) {
        for (let dx = 0; dx < size; dx++) seen.add(key({ x: c.x + dx, z: c.z + dz }));
      }
    };
    for (let i = 0; i < layout.universitySites; i++) square(layout.universitySiteCell(i), 3);
    // The squares the wider district bought: a 3x3 and a 2x2 landmark site per
    // district, and the 2x2s nothing stands on. Every one of them is land the
    // sale lists never saw, which is the whole point of reserving them.
    for (let i = 0; i < layout.landmarkLargeSites; i++) square(layout.landmarkLargeSiteCell(i), 3);
    for (let i = 0; i < layout.landmarkSmallSites; i++) square(layout.landmarkSmallSiteCell(i), 2);
    for (const c of layout.spareSquares) square(c, 2);
    for (const cell of layout.courtyards) seen.add(key(cell));
    expect(seen.size).toBe(PLOTS_PER_DISTRICT * 9);
  });

  /**
   * The budget, asserted as arithmetic rather than trusted to the comments.
   *
   * Every plot a district owns has exactly one owner, and the sum is
   * TARGET_PLOTS. This is what a future span change trips over first: the
   * commercial count is structurally fixed per span, so widening the district
   * without re-deriving this tuple leaves the sampler looking for a split that
   * no seed produces.
   */
  it('accounts for every plot a district owns, exactly once', () => {
    const sale =
      FRONTAGE_TARGET.residential + FRONTAGE_TARGET.commercial + FRONTAGE_TARGET.industrial;
    const squares = FRONTAGE_TARGET.squares * 4;
    const bigSquares =
      (FRONTAGE_TARGET.universitySites + FRONTAGE_TARGET.landmarkLargeSites) * 9;
    const courtyard = PLOTS_PER_DISTRICT - sale - squares - bigSquares;
    expect(courtyard).toBeGreaterThanOrEqual(BUILDABLE_PARKS_PER_DISTRICT);
    expect(sale + squares + bigSquares + courtyard).toBe(PLOTS_PER_DISTRICT);

    // The 2x2 claim divides exactly between the things that use it and the
    // things that do not, and the spare pool is the two together.
    const usedSquares =
      FRONTAGE_TARGET.civicSites + FRONTAGE_TARGET.landmarkSmallSites;
    expect(usedSquares).toBeLessThanOrEqual(FRONTAGE_TARGET.squares);
    expect(SPARE_PLOTS_PER_DISTRICT).toBe(
      (FRONTAGE_TARGET.squares - usedSquares) * 4 + courtyard - BUILDABLE_PARKS_PER_DISTRICT,
    );
    expect(SPARE_PLOTS_PER_DISTRICT).toBeGreaterThan(0);
  });

  it('lands every district on that budget, for every seed', () => {
    for (let seed = 0; seed < 200; seed++) {
      const plan = planFor((0x51ed2701 + seed * 2654435761) | 0);
      expect(plan.residential).toHaveLength(FRONTAGE_TARGET.residential);
      expect(plan.commercial).toHaveLength(FRONTAGE_TARGET.commercial);
      expect(plan.industrial).toHaveLength(FRONTAGE_TARGET.industrial);
      expect(plan.sites).toHaveLength(FRONTAGE_TARGET.civicSites);
      expect(plan.universities).toHaveLength(FRONTAGE_TARGET.universitySites);
      expect(plan.landmarksLarge).toHaveLength(FRONTAGE_TARGET.landmarkLargeSites);
      expect(plan.landmarksSmall).toHaveLength(FRONTAGE_TARGET.landmarkSmallSites);
      // Nothing overlaps: a plot reserved for one square is not for sale and is
      // not in another square.
      const seen = new Set<number>();
      const take = (cells: readonly number[]): void => {
        for (const c of cells) {
          expect(seen.has(c)).toBe(false);
          seen.add(c);
        }
      };
      take(plan.residential);
      take(plan.commercial);
      take(plan.industrial);
      for (const site of [
        ...plan.universities,
        ...plan.landmarksLarge,
        ...plan.landmarksSmall,
        ...plan.sites,
        ...plan.spareSquares,
      ]) {
        take(site.cells);
      }
      take(plan.courtyards);
      expect(seen.size).toBe(PLOTS_PER_DISTRICT);
    }
  });

  it('keeps existing plots put when the city expands', () => {
    // This is the invariant the whole save format rests on: a building placed in
    // district 1 must not move when district 20 is annexed.
    const small = new CityLayout().ensure(1);
    const large = new CityLayout().ensure(MAX_DISTRICTS);
    for (let i = 0; i < RESIDENTIAL_PER_DISTRICT; i++) {
      expect(large.homeCell(i)).toEqual(small.homeCell(i));
    }
    for (let i = 0; i < COMMERCIAL_PER_DISTRICT; i++) {
      expect(large.shopCell(i)).toEqual(small.shopCell(i));
    }
    for (let i = 0; i < INDUSTRIAL_PER_DISTRICT; i++) {
      expect(large.industryCell(i)).toEqual(small.industryCell(i));
    }
  });

  it('is identical across independently built layouts', () => {
    const a = new CityLayout().ensure(4);
    const b = new CityLayout().ensure(2).ensure(4);
    for (let i = 0; i < RESIDENTIAL_PER_DISTRICT * 4; i++) {
      expect(a.homeCell(i)).toEqual(b.homeCell(i));
    }
  });

  it('clusters commerce instead of scattering it', () => {
    const layout = new CityLayout().ensure(1);
    const cells = Array.from({ length: COMMERCIAL_PER_DISTRICT }, (_, i) => layout.shopCell(i));
    const cx = cells.reduce((sum, c) => sum + c.x, 0) / cells.length;
    const cz = cells.reduce((sum, c) => sum + c.z, 0) / cells.length;
    const spread = Math.max(...cells.map((c) => Math.hypot(c.x - cx, c.z - cz)));
    // A scattered quarter would spread across most of the district's diagonal.
    expect(spread).toBeLessThan(DISTRICT_SPAN * 0.6);
  });
});

describe('land value', () => {
  /**
   * The prefix table `landValue` reads, checked against the definition it is a
   * shortcut for. `income` runs ten times a second, so the mean over the first
   * n housing plots has to be a subtraction rather than a walk — and a
   * subtraction that disagreed with the walk would be a rent nobody could
   * account for.
   */
  it('means what a walk over the plots would mean, at every count', () => {
    const districts = 4;
    const plots = districts * RESIDENTIAL_PER_DISTRICT;
    let sum = 0;
    for (let n = 1; n <= plots; n++) {
      sum += housingCentrality(n - 1, districts);
      expect(housingCentralityMean(n, districts)).toBeCloseTo(sum / n, 12);
    }
    expect(housingCentralityBase(districts)).toBeCloseTo(sum / plots, 12);
  });

  it('scores every housing plot inside the range citygen promises', () => {
    // 1 at a district's middle and 0 at its furthest corner. A plot outside
    // that band would mean the block lookup had fallen through to a road.
    for (let i = 0; i < MAX_DISTRICTS * RESIDENTIAL_PER_DISTRICT; i++) {
      const score = housingCentrality(i, MAX_DISTRICTS);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('does not move a plot already scored when the city expands', () => {
    // The same guarantee the plot lists carry, one level up: a house does not
    // change what it is worth because a district was annexed on the far side of
    // the map. The *normaliser* moves, and deliberately — see
    // `housingCentralityBase` — but the plot's own score never does.
    const small = [];
    for (let i = 0; i < RESIDENTIAL_PER_DISTRICT; i++) small.push(housingCentrality(i, 1));
    for (let i = 0; i < RESIDENTIAL_PER_DISTRICT; i++) {
      expect(housingCentrality(i, MAX_DISTRICTS)).toBe(small[i]);
    }
  });

  it('clamps rather than reading off the end of the land', () => {
    const last = housingCentrality(MAX_DISTRICTS * RESIDENTIAL_PER_DISTRICT - 1, MAX_DISTRICTS);
    expect(housingCentrality(1e9, MAX_DISTRICTS)).toBe(last);
    expect(housingCentrality(-5, MAX_DISTRICTS)).toBe(housingCentrality(0, MAX_DISTRICTS));
    expect(housingCentralityMean(0, 1)).toBe(0);
  });

  it('varies enough between plots to be worth reading', () => {
    // The premise of the whole feature: if every housing plot scored the same
    // there would be nothing to redistribute. Checked inside one district, so
    // this is about the street plan rather than about the spiral.
    const scores = [];
    for (let i = 0; i < RESIDENTIAL_PER_DISTRICT; i++) scores.push(housingCentrality(i, 1));
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(0.2);
  });
});
