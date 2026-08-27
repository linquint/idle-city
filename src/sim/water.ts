import { mixSeed, rng } from '../core/rng.ts';
import { CELL, DISTRICT_SPAN, SEED } from './config.ts';

/**
 * The water the city was built beside: one coast, one river reaching it, a few
 * lakes.
 *
 * Everything here is analytic. A coastline is a wiggly line, a river is a band
 * around a wandering centreline and a lake is a wobbled disc — so "is this
 * point wet?" is a handful of sines rather than a lookup into a field somebody
 * had to store, and the renderer builds its geometry from the *same* parameters
 * the simulation tests against rather than from a marched grid that could
 * disagree with it. That is the whole reason this file is shaped the way it is:
 * two descriptions of where the water is would eventually be two different
 * answers, and one of them would be the one you can sail a ship through.
 *
 * The shape constants live here rather than in `config.ts` because none of them
 * trades off against anything there. They are the world, not the balance. The
 * one exception in spirit is COAST_RINGS, which paces when a port can be built
 * at all — its measurement is in its own comment.
 */

/**
 * One district tile, in world units.
 *
 * Re-derived rather than imported: `layout.ts` exports this as DISTRICT_WIDTH
 * and imports *this* file, so taking it from there would be a cycle. The two
 * are asserted equal in the tests, which is cheaper than a third module holding
 * one multiplication.
 */
const TILE = DISTRICT_SPAN * CELL;

/**
 * How far land keeps back from water, in world units.
 *
 * `dry` samples a district tile on a lattice one plot wide, so a feature can
 * only slip between samples if it is narrower than the lattice — and nothing
 * here is: the river is 18 across and the smallest lake 38. The margin turns
 * that from "narrow features are unlikely to be missed" into "no point of a dry
 * tile is within 6 units of water", because the fields below are within about
 * 15% of true distances (the sines' slopes are bounded, so this is arithmetic
 * rather than a hope) and 6 is more than 1.5 lattice steps.
 */
const DRY_MARGIN = CELL * 1.5;

/**
 * How far the coastline wanders either side of its mean, in world units.
 *
 * Bounded exactly, not statistically: `waves` is three sines whose amplitudes
 * sum to one, so the shore is always inside COAST_DISTANCE +- COAST_WAVE. That
 * exact bound is what turns COAST_DISTANCE below from a number that usually
 * works into one that provably does.
 */
const COAST_WAVE = 22;

/**
 * How many rings of districts fit between the origin and the sea.
 *
 * The pacing lever for the port, and the only water constant that is really a
 * balance knob. Districts are annexed ring by ring — 1, then 8, then 16 — so
 * two rings puts the first coastal district somewhere in the tenth to
 * twenty-fifth annexation, which is a few days of play. Three rings pushes it
 * past the twenty-sixth and most of the way to MAX_DISTRICTS, which is a
 * feature most players would never see.
 */
const COAST_RINGS = 2;

/**
 * Where the coastline sits, on average.
 *
 * Derived rather than chosen, and the derivation is the guarantee. Ring
 * COAST_RINGS reaches (COAST_RINGS + 0.5) tiles from the origin, so putting the
 * *nearest* the shore ever comes exactly DRY_MARGIN past that edge means every
 * tile in that ring clears the water and every tile in the next one is in it —
 * whatever the seed did to the wiggle. The consequences are worth stating
 * plainly, because both are load-bearing:
 *
 *   - the ring at COAST_RINGS is always annexable and always coastal, so a port
 *     is always reachable (see `coastal`);
 *   - the ring beyond it is always sea on that side, so the coast is a real
 *     edge to the city rather than a suggestion.
 *
 * Measured: the water then sits between DRY_MARGIN and DRY_MARGIN + 2 *
 * COAST_WAVE past the waterfront district's edge — 6 to 50 units, a median of
 * 28 over 4,000 seeds. That gap is the causeway the port is built along.
 */
const COAST_DISTANCE = (COAST_RINGS + 0.5) * TILE + DRY_MARGIN + COAST_WAVE;

/**
 * The dry corridor from the origin to the sea, either side of the axis.
 *
 * The other half of the guarantee, made structural instead of tested for: no
 * river and no lake is ever generated inside it, so the districts at
 * along-shore coordinate 0 are dry all the way out to the water whatever the
 * seed did. Together with COAST_DISTANCE that is the whole proof — the tiles
 * (0, 0) through (COAST_RINGS, 0) in the coast frame are always annexable and
 * the last of them is always coastal. A district tile is TILE wide, so its
 * half-width is TILE / 2 = 30; the extra 10 clears the dry margin.
 */
const CORRIDOR_HALF = TILE / 2 + 10;

/**
 * How far the first ring of districts keeps clear of everything but the sea.
 *
 * A district tile at ring 1 reaches 1.5 tiles from the origin, so a river or a
 * lake inside this box would cost a city its opening land — measured before the
 * rule went in, the median seed lost 2 of ring 1's 8 positions and the worst
 * lost 6, which is a first day spent annexing districts that are not next to
 * anything. The sea is exempt: COAST_RINGS keeps it two rings out by
 * construction, so it cannot reach this box in the first place.
 */
const CORE_CLEAR = 1.5 * TILE;

/** Half the width of the river. 18 units is four and a half plots across. */
const RIVER_HALF = 9;

/**
 * How close the river's centreline may come to the corridor, and how far it
 * wanders beyond that.
 *
 * The near offset clears the corridor by its own width plus the dry margin, so
 * the river cannot touch a district the corridor is protecting. The swing is
 * what stops it reading as a canal drawn parallel to the road out of town.
 */
const RIVER_NEAR = CORE_CLEAR + RIVER_HALF + DRY_MARGIN;
const RIVER_SWING = 130;

/**
 * How far inland the river starts.
 *
 * Far enough that its blunt source is never something anyone looks at. Six
 * districts was past the city's own edge and no further, which put the end of
 * the river exactly where the industrial estates were later laid — so the one
 * place the player was given a reason to go and stand was the one place the
 * river visibly stopped. Twenty districts is under the fog from anywhere.
 */
const RIVER_SOURCE = -20 * TILE;

const LAKE_COUNT = 3;
const LAKE_MIN_RADIUS = 26;
const LAKE_MAX_RADIUS = 44;
/** How far out lakes are scattered, in the coast frame. */
const LAKE_U_MIN = -5 * TILE;
const LAKE_U_MAX = 2.4 * TILE;
const LAKE_V_REACH = 4.5 * TILE;
/** Draws allowed before the field settles for however many lakes it has. */
const LAKE_ATTEMPTS = 64;


/**
 * Three sines, amplitudes summing to one, in [-1, 1].
 *
 * The only noise this file has. Wavelengths are deliberately not multiples of
 * each other, so the coast does not visibly repeat over the width of a city,
 * and the exact bound is what the reachability proof leans on.
 */
const WAVE_1 = 191;
const WAVE_2 = 83;
const WAVE_3 = 37;

const phase = (seed: number, salt: number): number =>
  (mixSeed(seed, salt) >>> 0) * (Math.PI * 2) / 4_294_967_296;

function waves(t: number, seed: number): number {
  return (
    0.55 * Math.sin(t / WAVE_1 + phase(seed, 1)) +
    0.3 * Math.sin(t / WAVE_2 + phase(seed, 2)) +
    0.15 * Math.sin(t / WAVE_3 + phase(seed, 3))
  );
}

/** A lake, as the parameters both the inside test and the mesh are built from. */
export interface Lake {
  /** Centre, in the coast frame. */
  readonly u: number;
  readonly v: number;
  readonly radius: number;
  /** Radial wobble: two harmonics, so a lake is a lake and not a coin. */
  readonly wobbleA: number;
  readonly wobbleB: number;
  readonly phaseA: number;
  readonly phaseB: number;
}

const LAKE_WOBBLE_A = 0.16;
const LAKE_WOBBLE_B = 0.1;
/** The most a lake's rim can bulge past its radius. Used by the spacing tests. */
const LAKE_BULGE = 1 + LAKE_WOBBLE_A + LAKE_WOBBLE_B;

/** Which way the coast lies: which world axis crosses it, and toward which end. */
export interface Coast {
  readonly axis: 'x' | 'z';
  readonly sign: 1 | -1;
}

/** A point in the coast frame, filled in place so sampling allocates nothing. */
export interface Shore {
  x: number;
  z: number;
}

/**
 * The whole water field for one seed.
 *
 * A class rather than a module of functions because the tests have to sweep
 * seeds — "every seed reaches the coast" is not a property you can check
 * against a module constant — and because the derived parameters (which way the
 * coast faces, where the lakes are) are worth deriving once.
 */
export class Waters {
  readonly coast: Coast;
  readonly lakes: readonly Lake[];
  /** Which side of the corridor the river runs down: +1 or -1. */
  readonly riverSide: number;

  private readonly coastSeed: number;
  private readonly riverSeed: number;

  constructor(seed: number) {
    const random = rng(mixSeed(seed, 0x5ea));
    // Four orientations, so two cities from two seeds do not both open with the
    // sea to the east. Everything downstream reads `coast` rather than assuming
    // an axis, which is why this costs one draw and nothing else.
    const turn = Math.floor(random() * 4);
    this.coast = {
      axis: turn < 2 ? 'x' : 'z',
      sign: turn % 2 === 0 ? 1 : -1,
    };
    this.riverSide = random() < 0.5 ? 1 : -1;
    this.coastSeed = mixSeed(seed, 0xc0a5);
    this.riverSeed = mixSeed(seed, 0x21be);
    this.lakes = this.drawLakes(rng(mixSeed(seed, 0x1a4e)));
  }

  // ------------------------------------------------------------- the frame

  /** Distance from the origin toward the sea. The coast is a level set of this. */
  u(x: number, z: number): number {
    return this.coast.sign * (this.coast.axis === 'x' ? x : z);
  }

  /** Distance along the shore. Sign is arbitrary; nothing depends on it. */
  v(x: number, z: number): number {
    return this.coast.axis === 'x' ? z : x;
  }

  /** Coast frame -> world, written into a caller-owned point. */
  toWorld(u: number, v: number, out: Shore): Shore {
    if (this.coast.axis === 'x') {
      out.x = this.coast.sign * u;
      out.z = v;
    } else {
      out.x = v;
      out.z = this.coast.sign * u;
    }
    return out;
  }

  // ------------------------------------------------------------- the water

  /** How far out the shore lies at along-shore position `v`. */
  shore(v: number): number {
    return COAST_DISTANCE + COAST_WAVE * waves(v, this.coastSeed);
  }

  /** Where the river's centreline sits at distance `u` from the origin. */
  riverCentre(u: number): number {
    return this.riverSide * (RIVER_NEAR + RIVER_SWING * (0.5 + 0.5 * waves(u, this.riverSeed)));
  }

  /**
   * How deep the water is at a point, near enough: positive in water, negative
   * on land, and within about 15% of the true distance to the nearest bank.
   *
   * Not a true signed distance and it does not need to be. What `dry` needs is
   * a field that cannot understate the distance by more than the margin it
   * keeps, and the slopes here are bounded by construction — the coast's is
   * 1.03, the river's 1.16, a lake's rim 1.4 — so the margin covers it.
   */
  depth(x: number, z: number): number {
    const u = this.u(x, z);
    const v = this.v(x, z);
    let deepest = this.seaDepthAt(u, v);
    const river = this.riverDepthAt(u, v);
    if (river > deepest) deepest = river;
    for (let i = 0; i < this.lakes.length; i++) {
      const lake = this.lakes[i] as Lake;
      const lakeDepth = Waters.lakeDepthAt(lake, u, v);
      if (lakeDepth > deepest) deepest = lakeDepth;
    }
    return deepest;
  }

  /** Whether a world point is under water. The predicate everything else asks. */
  at(x: number, z: number): boolean {
    return this.depth(x, z) > 0;
  }

  /**
   * Whether a world point is under *sea*, as opposed to river or lake.
   *
   * Its own question because a port is a sea port: a cruise terminal on a lake
   * is a joke, and the reachability guarantee below is about the sea alone.
   */
  sea(x: number, z: number): boolean {
    return this.seaDepthAt(this.u(x, z), this.v(x, z)) > 0;
  }

  private seaDepthAt(u: number, v: number): number {
    return u - this.shore(v);
  }

  private riverDepthAt(u: number, v: number): number {
    // -Infinity rather than a small negative number, and the difference is not
    // cosmetic: `depth` is the *maximum* over the three fields, so a sentinel
    // meaning "no river here" is read as a distance to one. A -1 put the whole
    // world one unit from water everywhere past the river's source, which made
    // `dryAround` refuse every parcel out there — invisible while the districts
    // were the only thing asking, since none of them reach that far.
    if (u < RIVER_SOURCE) return -Infinity;
    // The river stops where it meets the sea rather than running under it: two
    // translucent surfaces over the same water would blend twice and read as a
    // stain at the river mouth.
    if (u > this.shore(v)) return -Infinity;
    return RIVER_HALF - Math.abs(v - this.riverCentre(u));
  }

  private static lakeDepthAt(lake: Lake, u: number, v: number): number {
    const du = u - lake.u;
    const dv = v - lake.v;
    const dist = Math.hypot(du, dv);
    // The centre of a lake has no angle, and it is water whatever we call it.
    if (dist < 1e-6) return lake.radius;
    const theta = Math.atan2(dv, du);
    const rim =
      lake.radius *
      (1 +
        LAKE_WOBBLE_A * Math.sin(3 * theta + lake.phaseA) +
        LAKE_WOBBLE_B * Math.sin(5 * theta + lake.phaseB));
    return rim - dist;
  }

  /**
   * Scatters lakes, rejecting any that would break something.
   *
   * Three rules, each of which exists because breaking it is visible: a lake in
   * the corridor could cut the route to the sea, a lake over the river or over
   * another lake draws its own surface twice, and a lake in the sea is not a
   * lake. Rejection rather than repair, because a nudged lake is a lake whose
   * position depends on the order the rules ran in.
   */
  private drawLakes(random: () => number): Lake[] {
    const found: Lake[] = [];
    for (let attempt = 0; attempt < LAKE_ATTEMPTS && found.length < LAKE_COUNT; attempt++) {
      const radius = LAKE_MIN_RADIUS + random() * (LAKE_MAX_RADIUS - LAKE_MIN_RADIUS);
      const reach = radius * LAKE_BULGE;
      const lake: Lake = {
        u: LAKE_U_MIN + random() * (LAKE_U_MAX - LAKE_U_MIN),
        v: (random() * 2 - 1) * LAKE_V_REACH,
        radius,
        wobbleA: LAKE_WOBBLE_A,
        wobbleB: LAKE_WOBBLE_B,
        phaseA: random() * Math.PI * 2,
        phaseB: random() * Math.PI * 2,
      };
      // Clear of the corridor, with the dry margin on top so a district inside
      // it stays annexable rather than merely unflooded.
      if (Math.abs(lake.v) - reach < CORRIDOR_HALF + DRY_MARGIN) continue;
      // Clear of the opening nine districts. Rectangular rather than radial
      // because districts are square: this is the distance from the disc to the
      // box ring 1 fills, and zero means it is inside it.
      const boxU = Math.max(0, Math.abs(lake.u) - CORE_CLEAR);
      const boxV = Math.max(0, Math.abs(lake.v) - CORE_CLEAR);
      if (Math.hypot(boxU, boxV) < reach + DRY_MARGIN) continue;
      // Inland: COAST_DISTANCE - COAST_WAVE is the closest the shore ever comes.
      if (lake.u + reach > COAST_DISTANCE - COAST_WAVE) continue;
      if (this.touchesRiver(lake, reach)) continue;
      if (found.some((other) => Math.hypot(other.u - lake.u, other.v - lake.v) <
        reach + other.radius * LAKE_BULGE + DRY_MARGIN)) continue;
      found.push(lake);
    }
    return found;
  }

  /** Whether a lake's rim comes within the dry margin of the river's band. */
  private touchesRiver(lake: Lake, reach: number): boolean {
    // Walked along the centreline rather than solved: the river meanders, so
    // the nearest approach is not at the lake's own `u`. Steps of RIVER_HALF
    // cannot step over a gap the lake could fit through.
    const clearance = reach + RIVER_HALF + DRY_MARGIN;
    for (let u = lake.u - reach - clearance; u <= lake.u + reach + clearance; u += RIVER_HALF) {
      if (u < RIVER_SOURCE) continue;
      if (Math.hypot(u - lake.u, this.riverCentre(u) - lake.v) < clearance) return true;
    }
    return false;
  }

  // ----------------------------------------------------------- the districts

  /**
   * Whether a district tile can be annexed: no water anywhere inside it, with
   * DRY_MARGIN to spare.
   *
   * Sampled on a lattice one plot wide over the tile's own corners, which is
   * exact for this field rather than merely likely — see DRY_MARGIN. The tile
   * is `centre +- TILE / 2`, matching `layout.ts`: a district's cells run from
   * its centre out by half a tile in each direction.
   */
  dry(dx: number, dz: number): boolean {
    return this.dryAround(dx * TILE, dz * TILE, TILE / 2);
  }

  /**
   * Whether a square of land centred on a world point is clear of water.
   *
   * The general form `dry` is one case of, because the districts are no longer
   * the only thing that has to keep off the water — an industrial estate beyond
   * the city edge asks the same question about a differently sized parcel. The
   * lattice is stepped at CELL or finer whatever the square's size, which is
   * what DRY_MARGIN's argument rests on.
   */
  dryAround(x: number, z: number, half: number): boolean {
    const steps = Math.max(1, Math.ceil((half * 2) / CELL));
    const step = (half * 2) / steps;
    for (let i = 0; i <= steps; i++) {
      const at = z - half + i * step;
      for (let j = 0; j <= steps; j++) {
        if (this.depth(x - half + j * step, at) > -DRY_MARGIN) return false;
      }
    }
    return true;
  }

  /**
   * Whether the *sea* is what makes a district tile unannexable.
   *
   * The same margin `dry` uses, and it has to be: a tile whose corner is four
   * units from the water is not dry, and asking whether it is strictly wet
   * would answer no. That gap is exactly where the coastal test used to fall
   * through — the last tile before the sea would be neither dry nor sea, and
   * its landward neighbour would not count as coastal at all.
   */
  private tileBlockedBySea(dx: number, dz: number): boolean {
    const x0 = dx * TILE - TILE / 2;
    const z0 = dz * TILE - TILE / 2;
    for (let i = 0; i <= DISTRICT_SPAN; i++) {
      const z = z0 + i * CELL;
      for (let j = 0; j <= DISTRICT_SPAN; j++) {
        const x = x0 + j * CELL;
        if (this.seaDepthAt(this.u(x, z), this.v(x, z)) > -DRY_MARGIN) return true;
      }
    }
    return false;
  }

  /**
   * Whether a district tile is dry land with the sea against it.
   *
   * The neighbour test rather than a distance, and that choice is what makes
   * the port reachable for every seed instead of for most of them. Walk out
   * along the corridor: the corridor is dry, so every tile there is annexable
   * until the sea stops it, and the sea always does — `shore` is bounded above
   * by COAST_DISTANCE + COAST_WAVE, so a tile far enough out is certainly wet.
   * Let k be the last dry one. Tile k+1 is wet, so k is coastal, and the walk
   * from the origin to k is a path of annexable tiles. No sweep required; the
   * sweep in the tests is there to catch this comment going wrong.
   */
  coastal(dx: number, dz: number): boolean {
    if (!this.dry(dx, dz)) return false;
    return (
      this.tileBlockedBySea(dx + 1, dz) ||
      this.tileBlockedBySea(dx - 1, dz) ||
      this.tileBlockedBySea(dx, dz + 1) ||
      this.tileBlockedBySea(dx, dz - 1)
    );
  }
}

/** The world this build is playing in. */
export const WATERS = new Waters(SEED);

/** Whether a world point is under water. Pure, and the same answer every run. */
export const waterAt = (worldX: number, worldZ: number): boolean => WATERS.at(worldX, worldZ);

export {
  COAST_DISTANCE,
  COAST_RINGS,
  COAST_WAVE,
  CORE_CLEAR,
  CORRIDOR_HALF,
  DRY_MARGIN,
  LAKE_BULGE,
  LAKE_COUNT,
  RIVER_HALF,
  RIVER_SOURCE,
  TILE as WATER_TILE,
};
