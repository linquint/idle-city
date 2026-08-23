import { START_CASH } from './config.ts';

/** What kind of building is burning. Civic sites do not catch fire — see `Game`. */
export type FireKind = 'home' | 'shop' | 'industry';

/**
 * One building on fire.
 *
 * `index` is the building's *ordinal* — the i-th home ever built — never a
 * coordinate. Where that plot is on the map is a pure function of the ordinal
 * and the seed, exactly as it is for the building standing on it, so a fire
 * survives a reload without the save ever learning what a position is.
 */
export interface Fire {
  readonly kind: FireKind;
  readonly index: number;
  /** Value of `elapsed` when it started. Age is the only clock a fire needs. */
  readonly startedAt: number;
}

export const SAVE_VERSION = 4;

/**
 * The entire game, in a handful of fields.
 *
 * If anything that affects what you see is not in here, offline progress and
 * save/load are already broken — the renderer would be holding state it cannot
 * reproduce. Positions, animation clocks and camera angles all live in the view
 * layer precisely because they are recomputable from these fields.
 */
export interface GameState {
  version: number;
  cash: number;
  /** Seconds of simulated time, including time caught up while away. */
  elapsed: number;
  homes: number;
  shops: number;
  industry: number;
  /** Civic buildings, one 2x2 site each. They earn nothing; they gate income,
   *  demand and — below HAPPINESS_MIN_BUILD — housing itself. */
  hospitals: number;
  police: number;
  fire: number;
  /**
   * Share of each type's buildings that are actually staffed, in [0, 1].
   *
   * In the save because it is integrated, not derived: a hospital opened ten
   * seconds ago and one opened last week are the same `hospitals: 4` but not the
   * same coverage, and recomputing on load would hand a returning player either
   * a free ramp or an instant one.
   */
  hospitalStaff: number;
  policeStaff: number;
  fireStaff: number;
  /**
   * Happiness, lagged behind the coverage it is chasing. Same reasoning as the
   * demand signals: the lag is the mechanic, so it has to survive a reload.
   */
  happiness: number;
  /**
   * Demand per zone, in [-1, 1], negative meaning oversupplied.
   *
   * These are integrated rather than derived, which is exactly why they live in
   * the save: the lag is the mechanic. Recomputing them from counts on load
   * would hand a returning player a city whose prices had silently snapped to
   * their asymptote while they were away.
   */
  demandR: number;
  demandC: number;
  demandI: number;
  /**
   * Buildings currently burning, capped at MAX_ACTIVE_FIRES.
   *
   * Simulation state, not decoration: a burning building earns nothing, drags
   * happiness while it burns, and may be gone when it stops. The renderer draws
   * flames and sends a truck by reading this list; it contributes nothing to it.
   */
  fires: Fire[];
  /**
   * How many random draws the fire process has taken.
   *
   * The whole reason fires are reproducible. Every draw is `hash(cursor)` and
   * every draw advances the cursor, so a save reopened is a save that carries
   * on the same sequence — a fire that had no stored cursor would rearrange
   * itself on every reload, and offline catch-up would invent a different city
   * from the one watching would have produced.
   */
  fireCursor: number;
  /**
   * Ignition pressure accumulated toward the next draw, in expected fires.
   *
   * The integrator that makes the Poisson process step-size invariant. A
   * Bernoulli trial per tick is not: 60 trials at 1s and one trial at 60s are
   * different distributions, so a catch-up would systematically disagree with
   * watching. Accumulating `rate x dt` and spending it against exponential
   * thresholds gives the same answer at any step size the loop is run at.
   */
  fireHazard: number;
  /** Index into TIERS. */
  tier: number;
  /** Districts annexed. Always at least 1. */
  districts: number;
  /** Lifetime earnings, for the ledger. */
  earned: number;
  /** When on, surplus cash is spent on the cheapest available plot, awake or away. */
  autoDevelop: boolean;
  /** Epoch ms of the last save, used to compute time away. */
  savedAt: number;
}

export function createState(now = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    cash: START_CASH,
    elapsed: 0,
    homes: 0,
    shops: 0,
    industry: 0,
    hospitals: 0,
    police: 0,
    fire: 0,
    hospitalStaff: 0,
    policeStaff: 0,
    fireStaff: 0,
    // An empty city has nobody to be unhappy: coverage is a share of residents,
    // and the share of nobody is everybody. It lags down as the first homes fill.
    happiness: 1,
    demandR: 0,
    demandC: 0,
    demandI: 0,
    fires: [],
    fireCursor: 0,
    fireHazard: 0,
    tier: 0,
    districts: 1,
    earned: 0,
    autoDevelop: false,
    savedAt: now,
  };
}
