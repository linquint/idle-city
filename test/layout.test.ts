import { describe, expect, it } from 'vitest';
import { CELL, DISTRICT_SPAN, MAX_DISTRICTS } from '../src/sim/config';
import {
  CityLayout,
  COMMERCIAL_PER_DISTRICT,
  cityRadius,
  DISTRICT_WIDTH,
  districtCoord,
  isRoad,
  PLOTS_PER_DISTRICT,
  RESIDENTIAL_PER_DISTRICT,
  worldX,
  worldZ,
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

describe('plot book', () => {
  it('splits every district into the same plot counts', () => {
    expect(RESIDENTIAL_PER_DISTRICT + COMMERCIAL_PER_DISTRICT).toBe(PLOTS_PER_DISTRICT);
    expect(PLOTS_PER_DISTRICT).toBeLessThan(DISTRICT_SPAN * DISTRICT_SPAN);
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
  });

  it('gives every plot in the city a distinct cell', () => {
    const layout = new CityLayout().ensure(9);
    const seen = new Set<string>();
    for (let i = 0; i < RESIDENTIAL_PER_DISTRICT * 9; i++) seen.add(key(layout.homeCell(i)));
    for (let i = 0; i < COMMERCIAL_PER_DISTRICT * 9; i++) seen.add(key(layout.shopCell(i)));
    expect(seen.size).toBe(PLOTS_PER_DISTRICT * 9);
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
