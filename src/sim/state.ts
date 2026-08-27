import { LEVELS, OCCUPANCY_FULL, START_CASH, TAX_NEUTRAL } from './config.ts';

/**
 * The three zones the player builds in, and the only three that can burn.
 *
 * One name for both jobs on purpose: a fire happens to a building, and the
 * buildings a fire can happen to are exactly the ones the city sells plots for.
 * Civic sites do not catch fire — see `Game`.
 */
export type ZoneKind = 'home' | 'shop' | 'industry';

/** What kind of building is burning. */
export type FireKind = ZoneKind;

/**
 * One building on fire.
 *
 * `index` is the building's *ordinal* — the i-th home ever built — never a
 * coordinate. Where that plot is on the map is a pure function of the ordinal
 * and the seed, exactly as it is for the building standing on it, so a fire
 * survives a reload without the save ever learning what a position is.
 */
/**
 * How many buildings of one zone stand at each level. Index is the level.
 *
 * Cohorts, not instances, and that is a decision worth defending rather than an
 * economy. There is no spatial variation in any input a building could respond
 * to: happiness, education coverage and demand are all city-wide scalars, so
 * two houses built in the same tick would hold byte-identical per-building
 * state forever and the only thing that ever tells them apart is age. Age is
 * exactly what a cohort boundary encodes.
 *
 * Buildings take levels in build order — the oldest slots hold the highest
 * levels — so the k-th building's level is a lookup against these boundaries
 * and stays a pure function of counts. The save stays a handful of numbers and
 * positions stay derived.
 *
 * One has arrived and it still does not. Land value (see `landValue`) reads a
 * plot's centrality, so two houses at the same level genuinely earn different
 * rents — the condition this comment named. What keeps the cohorts is that the
 * k-th home's plot is a pure function of its ordinal and the seed, so the mean
 * over the first n of them is still a pure function of counts and the ledger
 * needs no more than that mean. The door is ajar rather than open.
 *
 * What would push it the rest of the way is an input that varies per building
 * *and* cannot be summarised: a per-building age, a per-building tenant, a
 * modifier applied to one building and not its neighbour. Anything the city can
 * recompute from `{ homes, mergedR }` and the seed belongs here instead.
 */
export type LevelCohort = number[];

/** A fresh cohort with everything at level 0. */
export const cohortOf = (count = 0): LevelCohort => {
  const levels = new Array<number>(LEVELS).fill(0);
  levels[0] = Math.max(0, count);
  return levels;
};

export interface Fire {
  readonly kind: FireKind;
  readonly index: number;
  /** Value of `elapsed` when it started. Age is the only clock a fire needs. */
  readonly startedAt: number;
}

export const SAVE_VERSION = 9;

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
  /**
   * Level cohorts per zone. Each sums to that zone's *standing* buildings —
   * its count less the ones written off — because an abandoned building has no
   * level to hold until it comes back.
   */
  homeLevels: LevelCohort;
  shopLevels: LevelCohort;
  industryLevels: LevelCohort;
  /**
   * Parcels of each zone holding one merged building, per LEVEL_FOOTPRINT.
   *
   * The second number a zone's land needs, and the reason capacity is counted in
   * plots rather than buildings: `homes` says how many buildings there are and
   * this says how much land they are standing on, because a level-2 building
   * covers the two plots its merge consumed. `homes + mergedR` is the plots
   * used, which is the quantity `homeCapacity` bounds.
   *
   * Not derivable from the cohorts, and the case that makes it so is a ruin: a
   * merged building that is written off keeps both its plots — it is a boarded
   * -up tower, not a boarded-up house — so the parcel stays merged while the
   * cohort it was counted in does not. See `ParcelBook` for what the count
   * indexes, and `Game.recover` for how such a ruin comes back.
   */
  mergedR: number;
  mergedC: number;
  mergedI: number;
  /**
   * Share of each zone's capacity that is actually filled, in [0, 1].
   *
   * Integrated rather than derived, exactly like demand and happiness, and in
   * the save for the same reason: the lag is the mechanic. A city whose mood
   * has just collapsed still has people in its houses for a few minutes, and
   * recomputing this on load would empty them the instant the tab reopened.
   */
  occupancyR: number;
  occupancyC: number;
  occupancyI: number;
  /** Seconds each zone has sat below OCCUPANCY_EMPTY. Reset the moment it does not. */
  vacantR: number;
  vacantC: number;
  vacantI: number;
  /**
   * Buildings written off, taken from the newest end of each zone.
   *
   * They keep their plot and are drawn as ruins; they house nobody, earn
   * nothing and hold no level. Recoverable, always — permanent loss is the
   * fastest way to make someone close an idle game for good.
   */
  abandonedR: number;
  abandonedC: number;
  abandonedI: number;
  /**
   * Fractional buildings banked toward the next change in each zone: positive
   * toward a recovery or a promotion, negative toward an abandonment.
   *
   * The accumulator that makes levelling step-size invariant. Promoting
   * `floor(rate * dt)` buildings a tick would round a 0.1s tick's worth to
   * nothing and never promote anything at all; banking the remainder and
   * spending whole buildings out of it gives the same answer at any step size,
   * which is the same trick `fireHazard` uses for ignition.
   */
  driftR: number;
  driftC: number;
  driftI: number;
  /**
   * Parks. One courtyard plot each, four to a district, no income at all.
   *
   * The only thing the city builds that never fronts a street: the interior of
   * a deep block is land nothing else can use, so recreation costs the economy
   * no frontage whatsoever.
   */
  parks: number;
  /** Civic buildings, one 2x2 site each. They earn nothing; they gate income,
   *  demand and — below HAPPINESS_MIN_BUILD — housing itself. */
  hospitals: number;
  police: number;
  fire: number;
  /**
   * Education. Same machinery as the three above — a site, a cost curve, a
   * staffing ramp — and a different job: what they gate is how tall the city is
   * allowed to build, not how happy it is. See LEVEL_EDUCATION.
   */
  schools: number;
  universities: number;
  /**
   * Transit depots. The fifth type on the 2x2 interleave, and the only civic
   * building that earns rather than gates — see SERVICES.
   */
  depots: number;
  /**
   * Landmarks, on the squares FRONTAGE_TARGET reserves for them: one 2x2 and
   * one 3x3 a district.
   *
   * Two counts and nothing else, which is the whole of the area-of-effect. A
   * landmark lifts the mood of the housing around it, and "around it" is
   * resolved against the *layout* rather than stored — the i-th museum stands on
   * the i-th museum site, so which plots it reaches is a pure function of the
   * count and the seed. Anything per-building here would mean per-instance
   * state and a save that grows with the city. See `landmarkCoverage`.
   */
  museums: number;
  stadiums: number;
  /**
   * Terminals on the city's waterfront: one berth of each per coastal district.
   *
   * Two counts, in the same shape as the landmarks above and for the same
   * reason — the i-th terminal stands at the i-th coastal district's quay, so
   * where a port *is* falls out of the count and the seed. What they buy is not
   * symmetrical: a cruise terminal earns, scaled by happiness, and a cargo
   * terminal lifts the export tap that industrial demand is drawn against.
   */
  cruiseTerminals: number;
  cargoTerminals: number;
  /**
   * The city hall. One per city, on district 0's reserved 2x2 square.
   *
   * A boolean and nothing else, which is the whole of what it is: it holds no
   * level, has no coverage, carries no happiness weight and stands in exactly
   * one place. What it does is *gate* — the tax rate, free transport and
   * auto-development are all policy, and a city with nobody to set policy runs
   * at TAX_NEUTRAL with fares on. That is already what a fresh city gets, so
   * nothing about the opening minutes changes.
   *
   * The stored policy fields survive without it rather than being overwritten:
   * `taxStep` reads neutral while there is no hall and the player's own choice
   * again the moment there is one. A save that predates this gets a hall on
   * migration — see `migrate` — because those cities set their rates under the
   * old rules and had every right to.
   */
  cityHall: boolean;
  /**
   * The road out of town, and the works standing along it.
   *
   * A boolean and a count, and the boolean is the progression gate: the highway
   * is bought once and the estates are what it is for. Their positions come out
   * of the count and the seed exactly as everything else's do — see
   * `estateCell` — and they are the first thing the city builds on land it does
   * not own, which is why they are counted apart from every plot total in
   * `economy.ts` rather than folded into one.
   */
  highway: boolean;
  estates: number;
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
  schoolStaff: number;
  universityStaff: number;
  depotStaff: number;
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
  /** Districts annexed. Always at least 1. */
  districts: number;
  /** Lifetime earnings, for the ledger. */
  earned: number;
  /**
   * The tax step the city is on, an index into TAX_STEPS.
   *
   * Persisted policy, not a preference: it multiplies income and moves the
   * happiness target, so a city reopened on a different rate from the one it was
   * left on would earn a different amount for reasons the player never chose.
   */
  taxRate: number;
  /**
   * Fares off, coverage up, mood up. Persisted policy for the same reason the
   * tax rate is: it moves income and happiness, so a city reopened on a
   * different setting from the one it was left on would earn a different amount
   * for reasons the player never chose.
   */
  freeTransport: boolean;
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
    homeLevels: cohortOf(),
    shopLevels: cohortOf(),
    industryLevels: cohortOf(),
    mergedR: 0,
    mergedC: 0,
    mergedI: 0,
    // An empty zone is neither full nor empty. Starting at OCCUPANCY_FULL means
    // the first house opens full rather than spending two minutes filling up,
    // and it is the value a loaded save defaults to for the same reason.
    occupancyR: OCCUPANCY_FULL,
    occupancyC: OCCUPANCY_FULL,
    occupancyI: OCCUPANCY_FULL,
    vacantR: 0,
    vacantC: 0,
    vacantI: 0,
    abandonedR: 0,
    abandonedC: 0,
    abandonedI: 0,
    driftR: 0,
    driftC: 0,
    driftI: 0,
    parks: 0,
    museums: 0,
    stadiums: 0,
    cruiseTerminals: 0,
    cargoTerminals: 0,
    cityHall: false,
    highway: false,
    estates: 0,
    hospitals: 0,
    police: 0,
    fire: 0,
    schools: 0,
    universities: 0,
    depots: 0,
    hospitalStaff: 0,
    policeStaff: 0,
    fireStaff: 0,
    schoolStaff: 0,
    universityStaff: 0,
    depotStaff: 0,
    // An empty city has nobody to be unhappy: coverage is a share of residents,
    // and the share of nobody is everybody. It lags down as the first homes fill.
    happiness: 1,
    demandR: 0,
    demandC: 0,
    demandI: 0,
    fires: [],
    fireCursor: 0,
    fireHazard: 0,
    districts: 1,
    earned: 0,
    taxRate: TAX_NEUTRAL,
    freeTransport: false,
    autoDevelop: false,
    savedAt: now,
  };
}
