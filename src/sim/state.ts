import { START_CASH } from './config.ts';

export const SAVE_VERSION = 2;

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
  /** Civic buildings. They earn nothing; they gate income and demand. */
  schools: number;
  clinics: number;
  stations: number;
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
    schools: 0,
    clinics: 0,
    stations: 0,
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
