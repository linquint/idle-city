import { describe, expect, it } from 'vitest';
import { CELL, DISTRICT_SPAN, MAX_DISTRICTS, SEED } from '../src/sim/config';
import {
  DISTRICT_WIDTH,
  districtCoord,
  districtIsCoastal,
  districtIsDry,
  portDistrict,
  worldX,
  worldZ,
} from '../src/sim/layout';
import {
  COAST_DISTANCE,
  COAST_RINGS,
  COAST_WAVE,
  CORE_CLEAR,
  CORRIDOR_HALF,
  DRY_MARGIN,
  LAKE_COUNT,
  RIVER_HALF,
  WATER_TILE,
  Waters,
  WATERS,
  waterAt,
} from '../src/sim/water';

/** A spread of seeds that does not correlate with anything else in the suite. */
const seeds = (count: number): number[] =>
  Array.from({ length: count }, (_, i) => (i * 2_654_435_761 + 12_345) | 0);

/** The unfiltered ring order, so the tests can ask what the water cost. */
function ringCoords(r: number): { x: number; z: number }[] {
  if (r === 0) return [{ x: 0, z: 0 }];
  const edge: { x: number; z: number }[] = [];
  for (let x = -r; x <= r; x++) edge.push({ x, z: -r });
  for (let z = -r + 1; z <= r; z++) edge.push({ x: r, z });
  for (let x = r - 1; x >= -r; x--) edge.push({ x, z: r });
  for (let z = r - 1; z >= -r + 1; z--) edge.push({ x: -r, z });
  return edge;
}

/** The coast-frame coordinate `(u, v)` as a district-space coordinate. */
const tile = (waters: Waters, u: number, v: number): { x: number; z: number } =>
  waters.coast.axis === 'x'
    ? { x: waters.coast.sign * u, z: v }
    : { x: v, z: waters.coast.sign * u };

describe('the water field', () => {
  it('gives the same answer every time it is asked', () => {
    const waters = new Waters(SEED);
    for (let i = 0; i < 4_000; i++) {
      const x = ((i * 7919) % 1200) - 600;
      const z = ((i * 6271) % 1200) - 600;
      const first = waters.at(x, z);
      expect(waters.at(x, z)).toBe(first);
      expect(waterAt(x, z)).toBe(first);
    }
  });

  it('is a pure function of the seed, not of when it was built', () => {
    for (const seed of seeds(24)) {
      const a = new Waters(seed);
      const b = new Waters(seed);
      expect(b.coast).toEqual(a.coast);
      expect(b.lakes).toEqual(a.lakes);
      for (let i = 0; i < 600; i++) {
        const x = ((i * 4409) % 1400) - 700;
        const z = ((i * 3571) % 1400) - 700;
        expect(b.depth(x, z)).toBe(a.depth(x, z));
      }
    }
  });

  it('puts a different world under different seeds', () => {
    const shapes = new Set<string>();
    for (const seed of seeds(64)) {
      const w = new Waters(seed);
      shapes.add(`${w.coast.axis}${w.coast.sign}:${w.shore(0).toFixed(3)}:${w.riverSide}`);
    }
    // Four orientations times a continuous shore distance: near-total spread is
    // the only thing that would not be a bug, so the bar is deliberately high.
    expect(shapes.size).toBeGreaterThan(60);
  });

  it('keeps every feature wider than the lattice `dry` samples on', () => {
    // The claim DRY_MARGIN rests on. A feature narrower than the lattice could
    // pass between two samples and flood a district nobody could see it in.
    expect(RIVER_HALF * 2).toBeGreaterThan(CELL * 2);
    for (const seed of seeds(200)) {
      for (const lake of new Waters(seed).lakes) {
        // The wobble takes at most 26% off the radius; see LAKE_WOBBLE_A/B.
        expect(lake.radius * 2 * 0.74).toBeGreaterThan(CELL * 2);
      }
    }
  });

  it('measures districts on the same tile `layout.ts` places them on', () => {
    expect(WATER_TILE).toBe(DISTRICT_WIDTH);
    // Not a restatement: it is the *cells* that have to fall inside the tile,
    // and they are laid out by `worldX`/`worldZ` rather than by WATER_TILE.
    for (const c of [{ x: 0, z: 0 }, { x: 3, z: -2 }]) {
      for (const local of [0, DISTRICT_SPAN - 1]) {
        expect(Math.abs(worldX(c.x * DISTRICT_SPAN + local) - c.x * DISTRICT_WIDTH))
          .toBeLessThanOrEqual(DISTRICT_WIDTH / 2 - CELL / 2);
        expect(Math.abs(worldZ(c.z * DISTRICT_SPAN + local) - c.z * DISTRICT_WIDTH))
          .toBeLessThanOrEqual(DISTRICT_WIDTH / 2 - CELL / 2);
      }
    }
  });

  it('holds the shore inside the bounds COAST_DISTANCE is derived from', () => {
    // The two inequalities the reachability proof is made of. If either fails,
    // the ring at COAST_RINGS stops being reliably coastal.
    const near = (COAST_RINGS + 0.5) * WATER_TILE + DRY_MARGIN;
    const far = (COAST_RINGS + 1.5) * WATER_TILE - DRY_MARGIN;
    expect(COAST_DISTANCE - COAST_WAVE).toBeGreaterThanOrEqual(near);
    expect(COAST_DISTANCE + COAST_WAVE).toBeLessThan(far);
    for (const seed of seeds(300)) {
      const w = new Waters(seed);
      for (let v = -900; v <= 900; v += 3) {
        expect(w.shore(v)).toBeGreaterThanOrEqual(COAST_DISTANCE - COAST_WAVE - 1e-9);
        expect(w.shore(v)).toBeLessThanOrEqual(COAST_DISTANCE + COAST_WAVE + 1e-9);
      }
    }
  });
});

describe('water and the land the city can annex', () => {
  it('leaves the origin district dry, for every seed', () => {
    for (const seed of seeds(1_000)) expect(new Waters(seed).dry(0, 0)).toBe(true);
  });

  it('runs a dry corridor from the origin to a coastal district, for every seed', () => {
    // The guarantee, checked the way the comment on COAST_DISTANCE claims it:
    // straight out along the axis, every tile dry, the last one coastal.
    for (const seed of seeds(1_000)) {
      const w = new Waters(seed);
      for (let u = 0; u <= COAST_RINGS; u++) {
        const c = tile(w, u, 0);
        expect(w.dry(c.x, c.z)).toBe(true);
      }
      const last = tile(w, COAST_RINGS, 0);
      expect(w.coastal(last.x, last.z)).toBe(true);
      const beyond = tile(w, COAST_RINGS + 1, 0);
      expect(w.dry(beyond.x, beyond.z)).toBe(false);
    }
  });

  it('reaches a coastal district by walking only annexable ones, for every seed', () => {
    // The same guarantee without assuming the route: a breadth-first walk over
    // dry tiles only, which is what a player annexing outward actually does.
    for (const seed of seeds(400)) {
      const w = new Waters(seed);
      const seen = new Set(['0,0']);
      const queue: { x: number; z: number }[] = [{ x: 0, z: 0 }];
      let found = false;
      for (let steps = 0; steps < 400 && queue.length > 0 && !found; steps++) {
        const c = queue.shift() as { x: number; z: number };
        if (w.coastal(c.x, c.z)) found = true;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const n = { x: c.x + dx, z: c.z + dz };
          const k = `${n.x},${n.z}`;
          if (seen.has(k)) continue;
          seen.add(k);
          if (w.dry(n.x, n.z)) queue.push(n);
        }
      }
      expect(found).toBe(true);
    }
  });

  it('never offers the city a district with water in it', () => {
    // The unannexability criterion, read the way the renderer reads it: every
    // plot of every district the spiral hands out is on dry land.
    for (let i = 0; i < MAX_DISTRICTS; i++) {
      const c = districtCoord(i);
      expect(districtIsDry(c.x, c.z)).toBe(true);
      for (let lz = 0; lz < DISTRICT_SPAN; lz++) {
        for (let lx = 0; lx < DISTRICT_SPAN; lx++) {
          const x = worldX(c.x * DISTRICT_SPAN + lx);
          const z = worldZ(c.z * DISTRICT_SPAN + lz);
          expect(waterAt(x, z)).toBe(false);
        }
      }
    }
  });

  it('skips the wet positions rather than renumbering the rings', () => {
    // Rings still fill in order, and every position the spiral passed over is
    // one the water field says is wet — no coordinate is dropped for any other
    // reason, so `districts` still counts districts.
    const taken = new Set<string>();
    let ring = 0;
    for (let i = 0; i < MAX_DISTRICTS; i++) {
      const c = districtCoord(i);
      taken.add(`${c.x},${c.z}`);
      ring = Math.max(ring, Math.max(Math.abs(c.x), Math.abs(c.z)));
    }
    expect(taken.size).toBe(MAX_DISTRICTS);
    for (let r = 0; r <= ring; r++) {
      for (const c of ringCoords(r)) {
        if (taken.has(`${c.x},${c.z}`)) continue;
        // Either wet, or in a ring the city has not finished — never dropped.
        const outer = Math.max(Math.abs(c.x), Math.abs(c.z)) === ring;
        expect(outer || !districtIsDry(c.x, c.z)).toBe(true);
      }
    }
  });

  it('keeps the opening ring of districts clear of river and lake', () => {
    // CORE_CLEAR, measured rather than trusted: a young city that could not
    // annex its own neighbours would spend its first day scattered.
    for (const seed of seeds(500)) {
      const w = new Waters(seed);
      for (const c of ringCoords(1)) expect(w.dry(c.x, c.z)).toBe(true);
    }
    expect(CORE_CLEAR).toBeGreaterThanOrEqual(1.5 * WATER_TILE);
  });

  it('keeps river and lakes out of the corridor', () => {
    for (const seed of seeds(300)) {
      const w = new Waters(seed);
      for (let u = -WATER_TILE; u <= COAST_DISTANCE; u += CELL) {
        expect(Math.abs(w.riverCentre(u)) - RIVER_HALF).toBeGreaterThan(CORRIDOR_HALF);
      }
      for (const lake of w.lakes) {
        expect(Math.abs(lake.v) - lake.radius * 1.26).toBeGreaterThan(CORRIDOR_HALF);
      }
    }
  });

  it('keeps all of its lakes, so the rejection rules are not fighting', () => {
    // A field that had to throw lakes away would be one whose exclusion zones
    // had grown past the space it scatters them in — which is a silent loss.
    for (const seed of seeds(500)) expect(new Waters(seed).lakes.length).toBe(LAKE_COUNT);
  });
});

describe('the coast the city reaches', () => {
  it('finds a coastal district inside the land it can own', () => {
    const first = portDistrict(MAX_DISTRICTS);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(MAX_DISTRICTS);
    const c = districtCoord(first);
    expect(districtIsCoastal(c.x, c.z)).toBe(true);
  });

  it('reports no port until the coastal district has been annexed', () => {
    const first = portDistrict(MAX_DISTRICTS);
    expect(portDistrict(first)).toBe(-1);
    expect(portDistrict(first + 1)).toBe(first);
    expect(portDistrict(MAX_DISTRICTS)).toBe(first);
  });

  it('puts a coastal district on the water rather than merely near it', () => {
    // What the quay is built along. The bound is the one COAST_DISTANCE's
    // derivation predicts: DRY_MARGIN to DRY_MARGIN + 2 * COAST_WAVE.
    for (const seed of seeds(300)) {
      const w = new Waters(seed);
      const c = tile(w, COAST_RINGS, 0);
      const edge = (COAST_RINGS + 0.5) * WATER_TILE;
      const gap = w.shore(w.v(c.x * WATER_TILE, c.z * WATER_TILE)) - edge;
      expect(gap).toBeGreaterThanOrEqual(DRY_MARGIN - 1e-9);
      expect(gap).toBeLessThanOrEqual(DRY_MARGIN + 2 * COAST_WAVE + 1e-9);
    }
  });

  it('never calls a lakeside or riverside district coastal', () => {
    // A cruise terminal on a lake is a joke, so `coastal` asks about the sea
    // alone. Checked by finding a district the river blocks and confirming its
    // dry neighbours are not coastal on its account.
    const w = WATERS;
    let checked = 0;
    for (let u = -3; u <= 1 && checked < 3; u++) {
      for (let v = -4; v <= 4 && checked < 3; v++) {
        const c = tile(w, u, v);
        if (w.dry(c.x, c.z)) continue;
        // Wet, and too far inland for the sea to be the reason.
        expect(w.sea(c.x * WATER_TILE, c.z * WATER_TILE)).toBe(false);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (!w.dry(c.x + dx, c.z + dz)) continue;
          // The neighbour may still be coastal for its *own* seaward side, so
          // this only asserts that this tile is not what made it so.
          if (Math.max(Math.abs(c.x + dx), Math.abs(c.z + dz)) < COAST_RINGS) {
            expect(w.coastal(c.x + dx, c.z + dz)).toBe(false);
          }
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
