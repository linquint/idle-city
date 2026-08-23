/**
 * Every tunable in the game lives here. Nothing in this file imports anything,
 * so balance can be changed without touching a line of simulation or render
 * code — and the tests can assert against the same constants the game uses.
 */

/** Changing this reseeds every street layout in the game. */
export const SEED = 20260823;

/** World units per plot. */
export const CELL = 4;

/** Plots per side of a district. A district is the unit of expansion. */
export const DISTRICT_SPAN = 12;

/** A road runs along every Nth global grid line, so streets meet across districts. */
export const ROAD_BLOCK = 4;

/** Share of a district's buildable plots zoned for commerce (the high street). */
export const COMMERCE_SHARE = 0.2;

/** Rings of districts around the centre: 7x7 grid of districts. */
export const MAX_DISTRICTS = 49;

export interface Tier {
  /** Shown in the zoning readout. */
  readonly name: string;
  /** Verb on the build button while this tier is active. */
  readonly buildLabel: string;
  /** Residents housed per building. */
  readonly capacity: number;
  /** Footprint width in world units (must stay under CELL). */
  readonly width: number;
  /** Height in world units. */
  readonly height: number;
  /** Pitched roofs read as houses; flat roofs read as blocks. */
  readonly pitched: boolean;
  /** Tall tiers get an aircraft warning light, which is what sells their scale. */
  readonly beacon: boolean;
}

export const TIERS: readonly Tier[] = [
  { name: 'detached housing', buildLabel: 'Build home',            capacity: 4,   width: 2.2, height: 1.6,  pitched: true,  beacon: false },
  { name: 'apartments',       buildLabel: 'Build apartment block', capacity: 16,  width: 2.6, height: 4.6,  pitched: false, beacon: false },
  { name: 'towers',           buildLabel: 'Raise tower',           capacity: 70,  width: 2.8, height: 11.5, pitched: false, beacon: true  },
  { name: 'arcologies',       buildLabel: 'Seal arcology',         capacity: 300, width: 3.0, height: 22.0, pitched: false, beacon: true  },
];

/**
 * Cash per resident per second.
 *
 * RENT, HOME_BASE and the first tier's capacity together set how long the first
 * house takes to pay for itself, which is the single number the opening minute
 * lives or dies on. At 8 / 4 / 0.14 it is about fourteen seconds: long enough to
 * feel like a decision, short enough that nobody sits watching an empty plot.
 */
export const RENT = 0.14;

/** Each shop adds this share of base income. */
export const SHOP_BONUS = 0.18;

/** Each district past the first adds this share of base income (civic economies of scale). */
export const DISTRICT_BONUS = 0.05;

export const HOME_BASE = 8;
export const HOME_GROWTH = 1.14;

export const SHOP_BASE = 90;
export const SHOP_GROWTH = 1.22;

export const REZONE_BASE = 3_000;
export const REZONE_GROWTH = 26;

/** Rezoning is a district-wide programme; it needs a district worth building on. */
export const REZONE_MIN_HOMES = 12;

export const ANNEX_BASE = 60_000;
export const ANNEX_GROWTH = 3.4;

/** You must have built out this share of your land before you may annex more. */
export const ANNEX_MIN_OCCUPANCY = 0.7;

/** Starting treasury. */
export const START_CASH = 40;

/** Simulation ticks per second, independent of frame rate. */
export const TICK_RATE = 10;

/** Offline earnings stop accruing past this many hours away. */
export const OFFLINE_CAP_SECONDS = 12 * 3600;
