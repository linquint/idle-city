import { START_CASH } from './config.ts';

export const SAVE_VERSION = 3;

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
    tier: 0,
    districts: 1,
    earned: 0,
    autoDevelop: false,
    savedAt: now,
  };
}
