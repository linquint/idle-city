import {
  ANNEX_BASE,
  ANNEX_GROWTH,
  ANNEX_MIN_OCCUPANCY,
  AUTO_ANNEX_RESERVE,
  BASE_IGNITION_PER_BUILDING_HOUR,
  AIRPORT_BASE,
  AIRPORT_EXPORT_LIFT,
  AIRPORT_PAYROLL,
  AIRPORT_VISITORS,
  CARGO_EXPORT_LIFT,
  CITY_HALL_BASE,
  GOODS_TRADE_ANSWER,
  GOODS_TRADE_LIFT,
  GOODS_TRADE_UPKEEP,
  POWER_EXPORT_CAP,
  POWER_TRADES,
  POWER_TRADE_NEUTRAL,
  RIVAL_COMMERCIAL_DEMAND,
  RIVAL_INDUSTRIAL_DEMAND,
  RIVAL_MATCH_DISTRICTS,
  RIVAL_SETTLE_SECONDS,
  type PowerTrade,
  CRIME_CROWDING_FULL,
  CRIME_FROM_CROWDING,
  CRIME_FROM_IDLENESS,
  CRIME_MOOD,
  GARBAGE_MOOD,
  GARBAGE_PER_RESIDENT,
  GARBAGE_PER_SHOP,
  GARBAGE_PER_WORKS,
  GARBAGE_CURVE,
  GARBAGE_SATURATION,
  WASTE_RECYCLING,
  LEGACY_YIELD,
  RANKS,
  RANK_GATES,
  type CityRank,
  type RankGate,
  CONGESTION_DENSITY_EXPONENT,
  CONGESTION_MOOD,
  CONGESTION_SCALE,
  FREE_TRANSPORT_RIDERSHIP,
  ROAD_CELLS_PER_DISTRICT,
  TRANSIT_ROAD_SHARE,
  TRIPS_PER_RESIDENT,
  CIVIC_RAMP_SECONDS,
  CIVIC_SERVICES,
  ABANDON_SECONDS,
  ABANDON_SPREAD_SECONDS,
  DEMAND_SCALE,
  DEMAND_TERMS,
  SURVEY_DEMAND,
  SURVEY_FILL,
  ZONE_SHARE,
  FRONTAGE_TARGET,
  COVERAGE_GRACE_PLOTS,
  type DemandTerm,
  DEMAND_TAU,
  DISTRICT_BONUS,
  DISTRICT_FILL_MULTIPLE,
  ESTATE_BASE,
  ESTATE_GROWTH,
  ESTATE_PLOTS,
  ESTATE_YIELD,
  EXPORT_BASE,
  EXPORT_PER_DISTRICT,
  FIRE_RESPONSE,
  POLICE_RESPONSE,
  BASE_CALL_PER_BUILDING_HOUR,
  UNANSWERED_CRIME,
  type EmergencyResponse,
  FARE_PER_RIDER,
  FREE_TRANSPORT_MOOD,
  FREE_TRANSPORT_REACH,
  FIRE_SUPPRESSION,
  FIRE_UNHAPPINESS,
  HAPPINESS_FLOOR,
  HAPPINESS_MIN_BUILD,
  HAPPINESS_TAU,
  HIGHWAY_COST,
  HOME_BASE,
  INDUSTRIAL_OUTPUT,
  INDUSTRY_BASE,
  INDUSTRY_BONUS,
  INDUSTRY_GROWTH,
  INDUSTRY_JOBS,
  INDUSTRY_OUTPUT,
  JOBS_PER_ESTATE_PLOT,
  LAND_VALUE_SPREAD,
  LANDMARKS,
  LANDMARK_MOOD,
  LEVEL_CAPACITY,
  LEVEL_EDUCATION,
  LEVEL_FOOTPRINT,
  LEVEL_HOUSING,
  LEVEL_SCALE,
  LEVEL_UP_HAPPINESS,
  LEVEL_UP_OCCUPANCY,
  LEVEL_UP_SECONDS,
  LEVELS,
  MAX_DISTRICTS,
  MERGE_LEVEL,
  OCCUPANCY_DEMAND,
  OCCUPANCY_EMPTY,
  OCCUPANCY_FLOOR,
  OCCUPANCY_FULL,
  OCCUPANCY_TAU,
  PARK_BASE,
  PARK_GROWTH,
  POWER_BASE,
  POWER_EXPONENT,
  POWER_FLOOR,
  POWER_PER_PLANT,
  POWER_PER_PLOT,
  POWER_PLANT_BASE,
  POWER_PLANT_GROWTH,
  PLOTS_PER_PARK,
  PRICE_DISCOUNT_MAX,
  PRICE_SURCHARGE_MAX,
  RECOVER_SPREAD_SECONDS,
  EDUCATION_SERVICES,
  HAPPINESS_SERVICES,
  RECREATION_WEIGHT,
  RENT,
  SERVICES,
  SHOP_BASE,
  SHOP_BONUS,
  SHOP_JOBS,
  SKILL_YIELD,
  ROAD_VISITORS,
  RAIL_VISITORS,
  CULTURE,
  LIBRARY_CRIME_RELIEF,
  THEATRE_VISITORS,
  type Culture,
  VISITOR_TRIPS,
  SHOP_SUPPLY,
  SHOP_TRIPS,
  SPEND_PER_RESIDENT,
  TAX_NEUTRAL,
  TAX_STEPS,
  TERMINALS,
  TRANSIT_LABOUR_DRAW,
  TRANSIT_LINES,
  TRANSIT_MAX_SHARE,
  NETWORK_EXPORT_LIFT,
  NETWORK_ROAD_SHARE,
  NETWORK_WORKFORCE,
  type TransitLine,
  TRANSIT_WORKFORCE,
  UPKEEP_ARREARS_TAU,
  UPKEEP_GROWTH,
  UPKEEP_RATE,
  UPKEEP_RESERVE_SECONDS,
  VISITOR_SPEND,
  VISITORS_PER_RESIDENT,
  WORKING_SHARE,
  type Landmark,
  type Service,
  type Terminal,
} from './config.ts';
import { ZONE, type Zone } from './citygen.ts';
import { AIRPORT_SITED, ESTATE_CELLS } from './estates.ts';
import {
  BUILDABLE_PARKS_PER_DISTRICT,
  SELLABLE_PER_DISTRICT,
  zonePlots,
  districtZonePlots,
  districtLand,
  zoningAt,
  sharedSpare,
  worksSpare,
  type DistrictZoning,
  CIVIC_SITES_PER_DISTRICT,
  POWER_SITES_PER_DISTRICT,
  LANDMARK_LARGE_SITES_PER_DISTRICT,
  LANDMARK_SMALL_SITES_PER_DISTRICT,
  coastalDistricts,
  housingCentrality,
  housingCentralityBase,
  housingCentralityMean,
  CULTURE_SITES_PER_DISTRICT,
  landmarkPlotsCovered,
  linePairAt,
  linePairCapacity,
  networkedDistricts,
  parcelBook,
  UNIVERSITY_SITES_PER_DISTRICT,
} from './layout.ts';
import { openZoning, type GameState, type LevelCohort, type ZoneKind } from './state.ts';

/** Pure reads over a state. No mutation lives in this file. */

/**
 * The band every demand signal lives in. Exported because three places have to
 * agree on it: the targets, the integrator, and whatever a save file claims.
 */
export const clampDemand = (n: number): number => Math.max(-1, Math.min(1, n));

// -------------------------------------------------------------------- levels

/** Every zone read through one key, so nothing needs a lookup table per caller. */
export const countOf = (s: GameState, kind: ZoneKind): number =>
  kind === 'home' ? s.homes : kind === 'shop' ? s.shops : s.industry;

export const levelsOf = (s: GameState, kind: ZoneKind): LevelCohort =>
  kind === 'home' ? s.homeLevels : kind === 'shop' ? s.shopLevels : s.industryLevels;

export const abandonedOf = (s: GameState, kind: ZoneKind): number =>
  kind === 'home' ? s.abandonedR : kind === 'shop' ? s.abandonedC : s.abandonedI;

export const occupancyOf = (s: GameState, kind: ZoneKind): number =>
  kind === 'home' ? s.occupancyR : kind === 'shop' ? s.occupancyC : s.occupancyI;

export const vacantOf = (s: GameState, kind: ZoneKind): number =>
  kind === 'home' ? s.vacantR : kind === 'shop' ? s.vacantC : s.vacantI;

export const demandOf = (s: GameState, kind: ZoneKind): number =>
  kind === 'home' ? s.demandR : kind === 'shop' ? s.demandC : s.demandI;

export const driftOf = (s: GameState, kind: ZoneKind): number =>
  kind === 'home' ? s.driftR : kind === 'shop' ? s.driftC : s.driftI;

/** Parcels of a zone holding one merged building. See `GameState.mergedR`. */
export const mergedOf = (s: GameState, kind: ZoneKind): number =>
  kind === 'home' ? s.mergedR : kind === 'shop' ? s.mergedC : s.mergedI;

/**
 * Plots a zone is standing on: one per building, plus one more for every parcel
 * that has merged.
 *
 * The quantity every land number in this file is now counted in. A building
 * count stopped being the same thing as a plot count the moment two buildings
 * could become one, and the two diverge in opposite directions — merging drops
 * the count and holds the land — so a readout that means "how full is the city"
 * has to say plots or it will report a merging district emptying out.
 */
export const plotsOf = (s: GameState, kind: ZoneKind): number =>
  countOf(s, kind) + mergedOf(s, kind);

/** Which of the generator's zones a build kind draws its plots from. */
export const zoneOf = (kind: ZoneKind): Zone =>
  kind === 'home' ? ZONE.residential : kind === 'shop' ? ZONE.commercial : ZONE.industrial;

/** The three zones, in the order the HUD and the renderer walk them. */
export const ZONE_KINDS: readonly ZoneKind[] = ['home', 'shop', 'industry'];

/** Buildings of a zone that still stand: its count, less the ones written off. */
export const standingOf = (s: GameState, kind: ZoneKind): number =>
  Math.max(0, countOf(s, kind) - abandonedOf(s, kind));

/** How many buildings a cohort accounts for. Always equals `standingOf`. */
export const cohortTotal = (levels: LevelCohort): number => {
  let n = 0;
  for (let l = 0; l < levels.length; l++) n += levels[l] ?? 0;
  return n;
};

/**
 * The level of the k-th building of a zone, from the cohorts alone.
 *
 * The whole reason cohorts work. Buildings take levels in build order, oldest
 * first, so slot 0 is in the top cohort and the newest slots are at level 0 —
 * which means a slot's level is a pure function of its index and four counts,
 * with nothing stored per building and nothing to keep in step. Slots past the
 * standing stock are the abandoned ones and report -1: they hold their plot,
 * but they hold no level.
 */
export const levelAt = (levels: LevelCohort, slot: number): number => {
  if (slot < 0) return -1;
  let seen = 0;
  for (let l = levels.length - 1; l >= 0; l--) {
    seen += levels[l] ?? 0;
    if (slot < seen) return l;
  }
  return -1;
};

/** First slot index of each level, oldest level first. Written into `out`. */
export const cohortStart = (levels: LevelCohort, out: number[]): number[] => {
  let seen = 0;
  for (let l = levels.length - 1; l >= 0; l--) {
    out[l] = seen;
    seen += levels[l] ?? 0;
  }
  return out;
};

/**
 * A cohort measured in level-0 buildings — what it is worth, not how many it is.
 *
 * One ladder for all three zones (see LEVEL_SCALE), so this is the number every
 * per-building constant in the game multiplies: jobs, trips, output and the
 * income multiplier all scale with it, which is what keeps ZONE_SHARE's
 * equilibrium true at the top of the skyline as well as the bottom.
 */
export const cohortScale = (levels: LevelCohort): number => {
  let n = 0;
  for (let l = 0; l < levels.length; l++) n += (levels[l] ?? 0) * (LEVEL_SCALE[l] ?? 1);
  return n;
};

/**
 * A zone's earning weight: what its buildings are worth, less the share empty.
 *
 * Level-scaled, so this is what the income multiplier reads and the only thing
 * that does. See LEVEL_SCALE for why jobs and trips deliberately do not.
 */
export const effectiveOf = (s: GameState, kind: ZoneKind): number =>
  cohortScale(levelsOf(s, kind)) * occupancyOf(s, kind);

/**
 * Buildings of a cohort standing on a merged parcel — the top two levels.
 *
 * The invariant tying `mergedR` to the cohorts: a zone's standing merged
 * buildings are `min(mergedR, standing)`, because merged parcels are the oldest
 * slots and ruins are taken from the newest end. The two disagree only while a
 * merged parcel is boarded up, which is what makes `mergedR` state of its own.
 */
export const mergedCohort = (levels: LevelCohort): number => {
  let n = 0;
  for (let l = MERGE_LEVEL; l < levels.length; l++) n += levels[l] ?? 0;
  return n;
};

/** A cohort measured in plots — the land under it, not the count of it. */
export const cohortFootprint = (levels: LevelCohort): number => {
  let n = 0;
  for (let l = 0; l < levels.length; l++) n += (levels[l] ?? 0) * (LEVEL_FOOTPRINT[l] ?? 1);
  return n;
};

/**
 * Plots a zone's *standing* buildings cover. Ruins are excluded, and they hold
 * one plot each whatever they were: only a merged parcel holds two, and a ruin
 * on one is counted by `plotsOf` through the merged parcel count instead.
 */
export const standingPlotsOf = (s: GameState, kind: ZoneKind): number =>
  cohortFootprint(levelsOf(s, kind));

/**
 * A cohort measured against a per-level ladder — SHOP_JOBS, INDUSTRY_OUTPUT and
 * their siblings. What the buildings are worth in whatever the ladder counts.
 */
export const cohortAgainst = (levels: LevelCohort, ladder: readonly number[]): number => {
  let n = 0;
  for (let l = 0; l < levels.length; l++) n += (levels[l] ?? 0) * (ladder[l] ?? 0);
  return n;
};

/**
 * What a zone's open buildings are worth against a per-level ladder.
 *
 * The ruins are already out — they hold no level, so no cohort counts them —
 * and the empty share comes off, because a shop nobody is in serves nobody.
 */
export const openOf = (s: GameState, kind: ZoneKind, ladder: readonly number[]): number =>
  cohortAgainst(levelsOf(s, kind), ladder) * occupancyOf(s, kind);

/**
 * A zone's trading weight: how much of its *land* is actually open.
 *
 * Per plot rather than per building, which is the same statement it always was
 * and now needs saying differently. A shop employs a neighbourhood and serves
 * the trips its neighbourhood generates whatever is stacked on top of it, so
 * the number of shops a city needs grows with its population — that is what
 * makes commercial land fillable and the annexation gate reachable. Counting
 * buildings used to say that; since two shops can merge into one it says the
 * opposite, and a merging high street would halve the city's jobs overnight.
 * Ruins are excluded and the empty share is taken off: neither trades.
 *
 * The per-level ladders in config.ts are this number spelled out a level at a
 * time, and `openOf` is what reads them; this is the same quantity with the
 * ladder held at one, which is what the plot counts and the HUD want.
 */
export const activeOf = (s: GameState, kind: ZoneKind): number =>
  standingPlotsOf(s, kind) * occupancyOf(s, kind);

/**
 * The average level of the city's housing, in level-0 buildings.
 *
 * The size term the demand model divides by. See `demandScale`.
 */
export const cityScale = (s: GameState): number => {
  // Per plot, not per building. A merged tower is worth twice a plot's weight
  // on both sides of this ratio, so measuring it per building would double the
  // size term the moment a district merged — and DEMAND_SCALE was calibrated
  // against a district's *land*, which merging does not change.
  const plots = cohortFootprint(s.homeLevels);
  if (plots <= 0) return 1;
  return Math.max(1, cohortScale(s.homeLevels) / plots);
};

// ----------------------------------------------------------------- occupancy

/**
 * Where a zone's occupancy is heading.
 *
 * Two inputs. Happiness is the dominant one, running the target linearly from
 * OCCUPANCY_FLOOR at nobody-is-happy to OCCUPANCY_FULL at everybody-is: an
 * unhappy city does not merely stop attracting people, it loses the ones in the
 * houses it has already built, and past HAPPINESS_MIN_OCCUPANCY it loses them
 * fast enough to start boarding plots up. The zone's own demand is the smaller
 * modifier, so a zone in surcharge keeps most of its tenants rather than
 * emptying.
 *
 * The demand term modifies the range *above* the floor rather than the floor
 * itself, and the clamp below is what says so. Added outside it, a zone that
 * was miserable and oversupplied at once read 0.047 against a floor of 0.08 —
 * so OCCUPANCY_FLOOR, whose whole job is the trickle of income a written-off
 * city climbs back on, was quietly paying out 40% less than it promises. A city
 * that had spent itself down to one standing home earned 0.014 a second where
 * the floor is set for 0.024: two and a half hours to the cheapest service in
 * the game rather than the forty-eight minutes it is priced at.
 */
export const occupancyTarget = (s: GameState, kind: ZoneKind): number => {
  const mood = Math.max(0, Math.min(1, s.happiness));
  const wanted =
    OCCUPANCY_FLOOR +
    (OCCUPANCY_FULL - OCCUPANCY_FLOOR) * mood +
    OCCUPANCY_DEMAND * clampDemand(demandOf(s, kind));
  // Power is a *cap* rather than a third term, and multiplying rather than
  // subtracting is what makes it one: a city short of power cannot fill its
  // buildings however happy it is, and a city with power to spare gains nothing
  // from the surplus. Applied to all three zones — a shop with no power does not
  // trade either — and floored by POWER_FLOOR, which is what keeps the loop from
  // having a fixed point at nothing.
  //
  // Outside the floor rather than inside it, and the two are not interchangeable:
  // a cap that could not reach under OCCUPANCY_FLOOR would make a blackout
  // invisible in a city that is also unhappy, which is the one case POWER_FLOOR's
  // own comment says is left to rot on purpose. What is killing that city is the
  // unhappiness, and the power term is not there to insure against it.
  return Math.max(OCCUPANCY_FLOOR, Math.min(1, wanted)) * powerCap(s);
};

/** Fraction of the gap occupancy closes over `dt`. Same form as `demandStep`. */
export const occupancyStep = (dt: number): number =>
  1 - Math.exp(-Math.max(0, dt) / OCCUPANCY_TAU);

/** Whether a zone is sitting empty enough to start its vacancy clock. */
export const isVacant = (s: GameState, kind: ZoneKind): boolean =>
  occupancyOf(s, kind) < OCCUPANCY_EMPTY;

/**
 * Whether a zone has been empty long enough to start writing buildings off.
 *
 * Never the *last* one standing, and that is the same rule OCCUPANCY_FLOOR is:
 * a neglected city should feel like one that has stopped growing, not one that
 * has been switched off. The floor kept occupancy off zero and stopped short of
 * this, because occupancy is a share of a stock and a stock of nothing has no
 * share. A zone written off to the last building holds no level, houses nobody
 * and earns *exactly* zero — and with residents at zero the rent line is zero,
 * happiness has nothing to be about, the occupancy target sits under
 * OCCUPANCY_EMPTY forever and `isRecovering` never opens. Measured on a city of
 * six ruined homes and fifteen shops: twelve simulated hours, income 0.00e+0 at
 * every one of them, and nothing the player could press.
 *
 * One home left standing is 0.32 residents at the occupancy floor and about
 * 0.026 a second, which is a hospital in an hour and a half. Slow enough to
 * read as the consequence it is, and not a save you have to throw away.
 *
 * Found while calibrating LAND_VALUE_SPREAD: the discount-chasing policy in
 * tools/economy.calibrate.mjs sits on the edge of this for three and a half
 * hours of a 24-hour run, and a 2.7% change in the ledger decided which side of
 * it the run landed on. The cliff is what made the constant unmeasurable.
 */
export const isAbandoning = (s: GameState, kind: ZoneKind): boolean =>
  isVacant(s, kind) && vacantOf(s, kind) >= ABANDON_SECONDS && standingOf(s, kind) > 1;

/** Whether a zone has ruins to bring back and the occupancy to justify it. */
export const isRecovering = (s: GameState, kind: ZoneKind): boolean =>
  !isVacant(s, kind) && abandonedOf(s, kind) > 0;

/**
 * Buildings a zone writes off per second, once it is past ABANDON_SECONDS.
 *
 * Against the stock it may actually lose rather than the whole of it, so the
 * rate goes to zero as the zone approaches its last building instead of
 * stopping dead against the guard in `isAbandoning`. A rate that ignored the
 * floor would bank drift the pass could never spend.
 */
export const abandonRate = (s: GameState, kind: ZoneKind): number =>
  Math.max(0, standingOf(s, kind) - 1) / ABANDON_SPREAD_SECONDS;

/** Buildings a zone brings back per second. Four times the rate it lost them. */
export const recoverRate = (s: GameState, kind: ZoneKind): number =>
  countOf(s, kind) / RECOVER_SPREAD_SECONDS;

// ----------------------------------------------------------------- levelling

/**
 * Whether the city as a whole is in a state that lets buildings climb.
 *
 * Two of the three gates: the zone is wanted, and the city is worth expanding
 * into. The third — education — is per *level* rather than per zone, so it is
 * applied in `promotableAt` where the level is known.
 */
export const canLevelUp = (s: GameState, kind: ZoneKind): boolean =>
  occupancyOf(s, kind) >= LEVEL_UP_OCCUPANCY && s.happiness >= LEVEL_UP_HAPPINESS;

/** Buildings of a zone that could climb if the gates are open. */
export const promotable = (s: GameState, kind: ZoneKind): number => {
  const levels = levelsOf(s, kind);
  let n = 0;
  for (let l = 0; l < LEVELS - 1; l++) n += levels[l] ?? 0;
  return n;
};

/**
 * Share of the city's housing land within reach of education, in [0, 1].
 *
 * Schools and universities pooled, because a level's requirement is a statement
 * about how educated the city is rather than about which building did it. Same
 * convention as the service coverages, and the same denominator: the housing
 * plots the education stands among, so it does not move when the city levels,
 * merges or empties out. See `coverage`.
 */
export const educationCoverage = (s: GameState): number => {
  const plots = housingPlots(s);
  if (plots <= 0) return 1;
  let reached = 0;
  for (const service of EDUCATION_SERVICES) reached += covered(s, service);
  return Math.min(1, reached / plots);
};

/**
 * What the city's schooling is worth to its industry, as a multiplier.
 *
 * One expression, read at every call site that charges the industrial term, so
 * the ledger, the inspector and the HUD cannot disagree about what a school is
 * worth. No new save field and no new lag: education already lags, through the
 * staffing ramp its coverage is multiplied by, so a school opened this instant
 * is worth nothing yet and ramps in exactly as its coverage does.
 *
 * **Applied at the `income` call site rather than inside `bonuses` itself**, and
 * the difference is `ledgerScale`: `bonuses` is shared with the upkeep model,
 * where it keeps the wage bill a constant *share* of a ledger that climbs the
 * level ladder twice. Folding the skill in there would raise the payroll by the
 * same factor it raised the income, and the city would hand back most of what
 * it had just been given — which is the one thing "it should be worth building
 * schools for" rules out. So the skill is a net gain, and the deliberate
 * consequence is that a fully taught city runs a slightly smaller upkeep share
 * than an ignorant one. Bounded by SKILL_YIELD, so it is a few points and not a
 * regime change.
 *
 * 1 at no coverage, so every constant in this file keeps the meaning it was
 * measured with.
 */
export const workforceSkill = (s: GameState): number => 1 + SKILL_YIELD * educationCoverage(s);

/** Buildings a zone promotes per second, with every gate open. */
export const promoteRate = (s: GameState, kind: ZoneKind): number =>
  canLevelUp(s, kind) ? promotable(s, kind) / LEVEL_UP_SECONDS : 0;

// ------------------------------------------------------------------ capacity

/** Civic buildings, of every kind — the three that gate happiness and the two
 *  that gate levelling. */
export const civicBuildings = (s: GameState): number =>
  s.hospitals + s.police + s.fire + s.schools + s.universities + s.depots;

/**
 * Housing land, in *plots*. Civic buildings no longer come out of it: they stand
 * on 2x2 sites reserved before the housing list is drawn, so the two can never
 * collide and this number does not move when a hospital opens.
 *
 * Plots, not buildings, and the distinction is the whole of the merging change.
 * A district sells 24 residential plots however they are grouped; what varies is
 * how many buildings stand on them, from 24 detached houses down to about 13
 * once every pair that can merge has. Bounding buildings instead would let a
 * merging district buy back the plots it had just consumed.
 */
export const homeCapacity = (s: GameState): number => zonePlots(s, ZONE.residential);

export const shopCapacity = (s: GameState): number => zonePlots(s, ZONE.commercial);
export const industryCapacity = (s: GameState): number => zonePlots(s, ZONE.industrial);

/**
 * Sellable plots the city owns and has zoned to nothing.
 *
 * Only the frontier district ever holds any: freezing allocates a district's
 * remainder, so every settled district holds all 82 of its plots in one zone or
 * another. So this is bounded by one district's pool however large the city
 * gets, which is what keeps it out of the annexation gate's way — see
 * `plotCapacity`.
 */
export const scrubPlots = (s: GameState): number =>
  Math.max(
    0,
    s.districts * SELLABLE_PER_DISTRICT -
      homeCapacity(s) -
      shopCapacity(s) -
      industryCapacity(s),
  );

/** A zone's plot capacity, through one key. */
export const capacityOf = (s: GameState, kind: ZoneKind): number =>
  kind === 'home' ? homeCapacity(s) : kind === 'shop' ? shopCapacity(s) : industryCapacity(s);

/**
 * Whether a zone has a plot free in the next open parcel.
 *
 * Buildings are laid down parcel by parcel and a merged parcel takes both of
 * its plots with it, so "is there room" is exactly "have the plots run out" —
 * `plotsOf` counts merged parcels twice, which is what makes this one
 * comparison rather than a walk over the parcel list.
 */
export const hasFreePlot = (s: GameState, kind: ZoneKind): boolean =>
  plotsOf(s, kind) < capacityOf(s, kind);

/**
 * Whether the next parcel of a zone could merge, given how many of its
 * buildings have been standing at the level below since the pass began.
 *
 * Two conditions, and the second is the interesting one. There has to be an
 * unmerged two-plot parcel left at all; and the two buildings on it have to be
 * the ones ready to climb. Merging always takes the *next* pair, so the plots
 * ahead of it in the list are unpairable singles that will never merge — they
 * sit at the front holding level-1 buildings forever, and the pair behind them
 * only climbs once there are enough level-1 buildings to cover both.
 */
export const canMergeParcel = (s: GameState, kind: ZoneKind, ready: number): boolean => {
  const merged = mergedOf(s, kind);
  const book = parcelBook(zoneOf(kind), s);
  if (merged >= book.pairs(s.districts)) return false;
  return ready >= book.pairFront(merged) + 2;
};

/** Parcels of a zone that could ever merge. The ceiling on `mergedR`. */
export const mergeCapacity = (s: GameState, kind: ZoneKind): number =>
  parcelBook(zoneOf(kind), s).pairs(s.districts);

/**
 * Park land. Courtyard plots — the interior of a deep block — so it is the one
 * capacity that costs the city no frontage at all.
 */
export const parkCapacity = (s: GameState): number =>
  s.districts * BUILDABLE_PARKS_PER_DISTRICT;

/** 2x2 civic sites the city owns, of every type. */
export const civicSiteCapacity = (s: GameState): number =>
  s.districts * CIVIC_SITES_PER_DISTRICT;

/** 3x3 university sites the city owns. One a district, always. */
export const universitySiteCapacity = (s: GameState): number =>
  s.districts * UNIVERSITY_SITES_PER_DISTRICT;

/** Every plot the city can put something on, every kind of site included. */
export const plotCapacity = (s: GameState): number =>
  homeCapacity(s) +
  shopCapacity(s) +
  industryCapacity(s) +
  // Unzoned land counts. It is land the city bought and has not decided about,
  // and leaving it out would make the annexation gate a share of whatever the
  // surveyor happened to have zoned — a city that zoned a third of its frontier
  // and built it would read as nearly full and annex on the strength of eight
  // buildings. Counting it keeps the gate what it has always been: the share of
  // the land the city owns that has something working on it. Only the frontier
  // district ever carries any, so the drag is one district's worth at most.
  scrubPlots(s) +
  civicSiteCapacity(s) +
  universitySiteCapacity(s);

/**
 * A civic building is development too, so it counts against the same total.
 *
 * Parks deliberately do not, on either side of the ratio. Courtyard land was
 * never for sale, so counting it would silently re-scale a gate that was
 * measured against the sellable plots of a district — a tier that reached 72.3%
 * build-out would drop to 68.1% and fall under ANNEX_MIN_OCCUPANCY the moment
 * parks existed, gating a player out of annexing for not buying an amenity.
 * Development is what the city sells; a park is what it keeps.
 *
 * Landmarks are out for the same reason and it is worth stating, because unlike
 * a park a landmark is bought rather than kept and a reader will expect it here.
 * Adding their two squares a district to `plotCapacity` would drop every
 * existing city's build-out by about 2% and move the annexation gate under
 * players who have never opened the tab. They are an amenity that happens to be
 * expensive, not land the city is selling.
 *
 * The city hall is out on the same rule, and it is the clearest case of all:
 * there is one of them in a whole city, so counting it would move the gate by a
 * different amount at every district count.
 */
export const plotsUsed = (s: GameState): number =>
  plotsOf(s, 'home') + plotsOf(s, 'shop') + plotsOf(s, 'industry') + civicBuildings(s);

/**
 * Share of the city's plots with something on them.
 *
 * Named `developed` rather than `occupancy` since buildings gained an occupancy
 * of their own: this one is about land, `occupancyR` and its siblings are about
 * tenancy, and a reader who conflates the two gets the annexation gate wrong in
 * both directions. Abandoned buildings count here — they are still standing on
 * the plot — which is exactly why the annexation trigger uses `activeDeveloped`
 * rather than this.
 */
export const developed = (s: GameState): number => plotsUsed(s) / plotCapacity(s);

/** Buildings the city has written off, across every zone. */
export const abandonedBuildings = (s: GameState): number =>
  s.abandonedR + s.abandonedC + s.abandonedI;

/**
 * Share of the city's plots with something *working* on them.
 *
 * What annexation triggers on, and the distinction is the whole point: a ruin
 * holds its plot but earns nothing and houses nobody, so counting it would let
 * a city expand because it was full of the buildings it had given up on.
 * Expanding because the city is full of ruins is exactly backwards.
 */
export const activeDeveloped = (s: GameState): number =>
  Math.max(0, plotsUsed(s) - abandonedBuildings(s)) / plotCapacity(s);

/**
 * Residents housed, cohort by cohort, less the share of housing sitting empty.
 *
 * This replaces `homes x tierOf(s).capacity`. Three things fall out of it that
 * the old form could not express: a mixed-age skyline houses a mix of
 * populations, an unhappy city loses residents without losing a building, and
 * an abandoned house holds nobody because it holds no level.
 */
export const residents = (s: GameState): number => population(s) * s.occupancyR;

/**
 * The housing land the city has actually built on, in plots.
 *
 * The denominator every coverage uses, and the whole of Part 0's repair. It has
 * three properties in a row that no count of *people* has:
 *
 *   - level-invariant. A plot is a plot whether a bungalow or an arcology
 *     stands on it, so promoting the whole city leaves every coverage exactly
 *     where it was. Residents per plot run 4 -> 300, a 75x swing, against civic
 *     land that is fixed at six 2x2 sites a district — so a per-resident
 *     denominator meant need scaled with density and supply scaled with land,
 *     and the gap opened as the player succeeded. Measured before the fix: a
 *     maxed-out city reached 34% happiness at 1 district and 34% at 25, and
 *     could never reach 40% at any size;
 *   - merge-invariant. `plotsOf` counts a merged parcel twice, so the pair of
 *     houses that became one tower still holds two plots. A denominator in
 *     *buildings* would halve when a district merged and coverage would jump
 *     for free — which is exactly what recreation used to do, see
 *     PLOTS_PER_PARK;
 *   - occupancy-invariant. A boarded-up house still holds its land, so an
 *     emptying city does not read as a covered one. Against `residents` that
 *     loop oscillates indefinitely: nobody left to fail sends happiness up,
 *     which refills the houses, which collapses coverage again.
 *
 * Developed plots rather than the 24 a district *owns*, and that is the one
 * judgement call in the formula. The land reading breaks the opening in two
 * places: a fresh city would own 24 plots before it built anything, so every
 * coverage would read 0 rather than 1, happiness would sit under
 * HAPPINESS_MIN_BUILD and the housing gate would refuse to open the first house
 * that could earn the hospital that lifts it — the deadlock `coverage` has
 * always guarded against. And `serviceAllowed`'s "one ahead of need" guard
 * would be dead on arrival: a one-district city could open both its hospitals
 * before a single resident existed. Against developed land both properties
 * survive, and a built-out city has developed exactly the 24 a district owns —
 * so the ceiling this is measured at is unchanged either way.
 */
export const housingPlots = (s: GameState): number => plotsOf(s, 'home');

/**
 * The population the city's housing is *built for*, empty or not.
 *
 * No longer a coverage denominator — see `housingPlots` — but still what
 * `residents` is a share of, and still the honest statement of what the housing
 * stock holds when it is full.
 */
export const population = (s: GameState): number => {
  let people = 0;
  for (let l = 0; l < s.homeLevels.length; l++) {
    people += (s.homeLevels[l] ?? 0) * (LEVEL_HOUSING[l] ?? 0);
  }
  return people;
};

// --------------------------------------------------------------------- rank

/**
 * What the city is, on the ladder in `RANKS`.
 *
 * Derived, never stored, and that is not an implementation detail: a stored
 * rank would be one more thing an offline catch-up could get out of step with a
 * watched session, and one more field a save from an older balance pass would
 * carry a stale answer in. As a function of counts, a returning player opens on
 * whatever rank their city now implies and the two paths agree by construction.
 *
 * The walk stops at the first rung the city fails, which is what makes the rank
 * the *lower* of what the two thresholds say — both columns of `RANKS` climb,
 * so a city that fails one rung fails every rung above it.
 *
 * `population` rather than `residents`: the housing stock is what the city has
 * built, and a city that has just emptied out under a punitive tax has not been
 * demoted. A rank read through the occupancy integrator would flicker.
 */
export const cityRank = (s: GameState): CityRank => {
  const people = population(s);
  let index = 0;
  for (let i = 1; i < RANKS.length; i++) {
    const rank = RANKS[i] as CityRank;
    if (s.districts < rank.districts || people < rank.population) break;
    index = i;
  }
  return RANKS[index] as CityRank;
};

/** The next rung, or null at the top. What the treasury strip counts toward. */
export const nextRank = (s: GameState): CityRank | null =>
  (RANKS[cityRank(s).index + 1] as CityRank | undefined) ?? null;

/** Which rung a gated thing needs. A lookup, named so a caller reads as English. */
export const rankAt = (gate: RankGate): number => RANK_GATES[gate];

/** Whether the city has climbed far enough for one of the gated things. */
export const rankAllows = (s: GameState, gate: RankGate): boolean =>
  cityRank(s).index >= rankAt(gate);

/**
 * Why a rank gate is holding a button shut, phrased for the HUD.
 *
 * The existing voice, which is "Needs 14 districts" — so this is "Needs a town"
 * and not "Rank 1 required". Null when the city has climbed far enough, so it
 * composes with the other blockers by falling through.
 */
export const rankBlocker = (s: GameState, gate: RankGate): string | null => {
  if (rankAllows(s, gate)) return null;
  const needed = RANKS[rankAt(gate)] as CityRank | undefined;
  return needed ? `Needs a ${needed.name.toLowerCase()}` : null;
};

// ---------------------------------------------------------------- ascension

/**
 * What the cities before this one are worth to it, as a multiplier on income.
 *
 * Sublinear on purpose — see LEGACY_YIELD, which carries the sizing and the
 * argument for violating the "achievements grant nothing" rule.
 *
 * Applied beside `incomeMultiplier` rather than inside `bonuses`, and the
 * distinction is `ledgerScale`: `bonuses` is shared with the upkeep model,
 * where it keeps the wage bill a constant share of a ledger that climbs the
 * level ladder twice. A legacy is not a property of the city's buildings, it is
 * a property of the player's history — the same kind of thing the tax rate and
 * the mood are, and those are deliberately outside the upkeep scaling too. The
 * consequence is stated rather than hidden: a legacy city runs a smaller upkeep
 * share than a first one, exactly as a taught city does. See `workforceSkill`,
 * which makes the same trade for the same reason.
 *
 * Takes the one field it reads rather than the whole state, which is the
 * honest signature: it says in the type that a legacy is not a property of the
 * city, and it lets a caller price a legacy the city does not have yet — which
 * is exactly what the HUD's button and the calibrator's table both do.
 */
export const legacyMultiplier = (s: Pick<GameState, 'legacy'>): number =>
  1 + LEGACY_YIELD * Math.sqrt(Math.max(0, s.legacy));

/**
 * What ascending now would leave behind, in districts.
 *
 * The districts the city currently holds, and nothing else. Not `earned`, not
 * the population, not the elapsed time: those all grow with how long a run is
 * left going, and a carryover that did would reward patience rather than
 * progress. See `GameState.legacy`.
 */
export const legacyGain = (s: GameState): number => s.districts;

/**
 * Whether the city may be given up and founded again.
 *
 * On the rank ladder like everything else that unlocks, at the rung the
 * calibrator says a played run reaches in about two hours — see RANK_GATES.
 * Early enough that a player who wants the loop can have it, late enough that
 * "found it again" is a decision rather than a reflex.
 */
export const canAscend = (s: GameState): boolean => rankAllows(s, 'ascend');

/** Why the ascend button is off, phrased for the HUD. */
export const ascendBlocker = (s: GameState): string | null => rankBlocker(s, 'ascend');

/**
 * How far the city is through the rung it is climbing, in [0, 1].
 *
 * The lesser of the two shares, because the rank is the lesser of the two
 * thresholds — a city with the people and not the land is as far from the next
 * rung as its land says. Null at the top of the ladder, where there is nothing
 * to be a share of.
 */
export const rankProgress = (s: GameState): number | null => {
  const next = nextRank(s);
  if (!next) return null;
  const from = RANKS[next.index - 1] as CityRank;
  const share = (now: number, was: number, needs: number): number =>
    needs <= was ? 1 : Math.max(0, Math.min(1, (now - was) / (needs - was)));
  return Math.min(
    share(s.districts, from.districts, next.districts),
    share(population(s), from.population, next.population),
  );
};

// ------------------------------------------------------------------ services

export type ServiceKey = Service['key'];

export const serviceCount = (s: GameState, key: ServiceKey): number =>
  key === 'hospital' ? s.hospitals
  : key === 'police' ? s.police
  : key === 'fire' ? s.fire
  : key === 'school' ? s.schools
  : key === 'transit' ? s.depots
  : key === 'waste' ? s.wasteDepots
  : s.universities;

/** How much of a type's payroll is actually filled, in [0, 1]. See `staffStep`. */
export const staffing = (s: GameState, key: ServiceKey): number =>
  key === 'hospital' ? s.hospitalStaff
  : key === 'police' ? s.policeStaff
  : key === 'fire' ? s.fireStaff
  : key === 'school' ? s.schoolStaff
  : key === 'transit' ? s.depotStaff
  : key === 'waste' ? s.wasteStaff
  : s.universityStaff;

/**
 * Sites of one type the city has land for.
 *
 * Two answers, because there are two kinds of site. The *five* 2x2 types share
 * one city-wide list by a fixed interleave — hospitals take 5k, police 5k+1,
 * fire 5k+2, schools 5k+3 and depots 5k+4 — so with 6 sites a district the first
 * district gets 2/1/1/1/1 and they even out from there. A university stands on
 * its own 3x3 list, one to a district, and does not touch the interleave at all.
 *
 * The divisor is `CIVIC_SERVICES.length` and it is the one number in this file
 * that must never move for convenience. Adding a sixth 2x2 type would change it
 * and move every hospital, police station, fire station, school and depot in the
 * city onto a different square — a returning player would watch their city
 * rearrange itself around a save that had not changed. Anything new that wants a
 * 2x2 square gets a list of its own sliced after these, the way the city hall
 * does and the way `landmarksSmall` is sliced before them.
 */
export const siteCapacity = (s: GameState, key: ServiceKey): number => {
  if (key === 'university') return universitySiteCapacity(s);
  const sites = civicSiteCapacity(s);
  const offset = CIVIC_SERVICES.findIndex((service) => service.key === key);
  if (offset < 0) return 0;
  return Math.max(0, Math.ceil((sites - offset) / CIVIC_SERVICES.length));
};

/**
 * How many of a service the city is allowed to own.
 *
 * One ahead of need, never five. Without this the opening hour is "dump every
 * penny into permanent coverage before there is anyone to cover", which buys
 * a maxed happiness bar the city has not earned and removes the only pressure
 * services are supposed to apply. The land supply caps it as well, because a
 * building with no site has nowhere to stand.
 *
 * Need is measured in housing plots now rather than in residents, so the
 * allowance stops climbing when the city climbs — which is the point: the sites
 * were never going to appear, and an allowance that promised buildings the land
 * could not hold was only ever describing the ceiling that Part 0 removed.
 */
export const serviceAllowed = (s: GameState, service: Service): number =>
  Math.min(
    Math.floor(housingPlots(s) / service.plots) + 1,
    siteCapacity(s, service.key),
  );

/** How many of a service the city's housing land would need for full cover. */
export const serviceNeeded = (s: GameState, service: Service): number =>
  Math.ceil(housingPlots(s) / service.plots);

/**
 * Housing plots a service actually reaches, staffing included.
 *
 * Plots rather than residents, and the rename of `Service.capacity` to
 * `Service.plots` is there so a caller cannot read this as people by accident.
 *
 * One special case, and it is the free-transport policy: the same depots reach
 * a third further when nobody has to pay to board, because people ride when it
 * is free. It belongs here rather than in a transit-only read so that the
 * services panel, the coverage the labour term uses and the riders the fares
 * are taken from all say the same number.
 */
export const covered = (s: GameState, service: Service): number => {
  const reach = serviceCount(s, service.key) * staffing(s, service.key) * service.plots;
  return service.key === 'transit' && faresWaived(s) ? reach * (1 + FREE_TRANSPORT_REACH) : reach;
};

/** The transit service, or undefined if the table is ever built without one. */
export const TRANSIT = SERVICES.find((service) => service.key === 'transit');

/** Share of the city's housing stock a transit network reaches, in [0, 1]. */
export const transitCoverage = (s: GameState): number =>
  TRANSIT ? coverage(s, TRANSIT) : 0;

/**
 * People actually on the buses: the residents living on the land the network
 * reaches.
 *
 * The one place a coverage is turned back into people, and it has to be. Every
 * other service is sized to the housing stock it stands among whether or not it
 * is full — see `housingPlots` — but a fare is paid by somebody on a bus, and an
 * empty district's depot carries nobody. Multiplying `residents` by the covered
 * share says exactly that, and at full coverage it is still `residents`, which
 * is what FARE_PER_RIDER was calibrated against.
 */
export const riders = (s: GameState): number =>
  TRANSIT ? residents(s) * transitCoverage(s) : 0;

/**
 * Fare income, per second, before tax.
 *
 * The first civic building in this game that earns anything at all. Every other
 * one gates — coverage feeds happiness, or education decides how tall the city
 * may build — so a reader arriving here with that rule in hand will assume the
 * depot gates too, and it does not. Free transport takes this to exactly zero,
 * which is the whole of what the policy costs.
 */
export const fareIncome = (s: GameState): number =>
  faresWaived(s) ? 0 : riders(s) * FARE_PER_RIDER;

// ------------------------------------------------------------------- traffic

/**
 * Trips the city's residents put on the road each second, before transit.
 *
 * Residents rather than matched worker/job pairs — see TRIPS_PER_RESIDENT for
 * the measurement that forces it. Nothing else generates a trip here: freight
 * and the shops' own deliveries are real and are deliberately not modelled,
 * because they would be a second term calibrated against the same road supply
 * for no decision the player can act on.
 */
export const trips = (s: GameState): number => residents(s) * TRIPS_PER_RESIDENT;

/**
 * Share of the city's trips the transit network is carrying, in [0, 1].
 *
 * Two factors, and they say different things through the same buses. The
 * coverage is how much of the city the network reaches — and already rises with
 * free transport, because `covered` gives transit FREE_TRANSPORT_REACH — and the
 * ridership term is the people already covered choosing the bus once it costs
 * nothing. Clamped, so a doctored constant cannot take more trips off the road
 * than the city makes.
 */
export const transitShare = (s: GameState): number => busShare(s, transitCoverage(s));

/**
 * The same read against a *hypothetical* coverage, so the happiness panel can
 * price one more depot without building it.
 *
 * Split out rather than duplicated, because two expressions for what a bus
 * carries would be two things to keep in step — the same reasoning `bonuses`
 * carries for being one expression rather than a copy in `income` and one in
 * `ledgerScale`.
 */
const busShare = (s: GameState, reach: number): number =>
  Math.min(
    // TRANSIT_MAX_SHARE rather than 1, and it costs an existing city nothing:
    // it is TRANSIT_ROAD_SHARE x (1 + FREE_TRANSPORT_RIDERSHIP), which is
    // exactly what the bus term alone could already reach, so the clamp only
    // ever binds on the network added to it. See TRANSIT_MAX_SHARE.
    TRANSIT_MAX_SHARE,
    TRANSIT_ROAD_SHARE *
      Math.max(0, Math.min(1, reach)) *
      (faresWaived(s) ? 1 + FREE_TRANSPORT_RIDERSHIP : 1) +
      NETWORK_ROAD_SHARE * networkService(s),
  );

/** Trips actually on the road: what the network does not carry. */
export const roadTrips = (s: GameState): number => trips(s) * (1 - transitShare(s));

/**
 * How jammed the city's streets are, in [0, 1].
 *
 * A city-wide scalar, and that is a property of the generator rather than a
 * simplification — see ROAD_CELLS_PER_DISTRICT. Every district has the same 81
 * road cells and the same 3+3 through-lines, so there is no district-to-district
 * variation to read and a per-district congestion number would be a fabrication.
 *
 * Density is discounted by `cityScale ** CONGESTION_DENSITY_EXPONENT` rather
 * than divided out, which is the whole calibration: raw trips per road cell
 * swing 150x over the level ladder and full normalisation inverts the sign. See
 * the exponent's own comment for the table.
 *
 * Derived rather than integrated, and deliberately: it has no lag of its own
 * because everything it reads already has one. Residents come through
 * `occupancyR`, which is integrated; transit coverage comes through the staffing
 * ramp, which is integrated; and what congestion feeds is happiness, which is
 * integrated. A fourth lag on top would be a lag on a lag.
 *
 * One consequence is worth stating because nothing else in the happiness model
 * has it: this **closes a feedback loop that used to be open**. Every other term
 * happiness reads — coverage, parks, landmarks, the tax rate — is independent of
 * how full the city is, so happiness drove occupancy and nothing drove back.
 * Traffic reads `residents`, which is occupancy, so the two are now a coupled
 * pair: more residents, more traffic, less mood, fewer residents. It is negative
 * feedback and self-damping, so it converges rather than oscillating — but it is
 * the reason a 60-second catch-up step and 600 tenth-second ticks now differ by
 * about 1% on a large city's income where they used to agree to the last figure.
 * See test/history.test.ts, which carries the measurement.
 */
export const congestion = (s: GameState): number => congestionAt(s, transitShare(s));

/** Congestion against a given share of trips carried, so a purchase can be priced. */
const congestionAt = (s: GameState, carried: number): number => {
  const road = ROAD_CELLS_PER_DISTRICT * Math.max(1, s.districts);
  const density = cityScale(s) ** CONGESTION_DENSITY_EXPONENT;
  const onRoad = trips(s) * (1 - Math.max(0, Math.min(1, carried)));
  const per = onRoad / road / Math.max(1e-9, density);
  return Math.max(0, Math.min(1, per / CONGESTION_SCALE));
};

/**
 * What congestion would read with one more depot open and fully staffed.
 *
 * The marginal reading `happinessFix` needs, and it is built the same way every
 * other option in that list is: one more building at full staffing against the
 * coverage the city has now. Goes to zero once the network is complete, so a
 * covered city never has "open a depot" named at it.
 */
export const congestionWithDepot = (s: GameState): number => {
  const plots = housingPlots(s);
  if (!TRANSIT || plots <= 0) return congestion(s);
  return congestionAt(s, busShare(s, (covered(s, TRANSIT) + TRANSIT.plots) / plots));
};

/**
 * What congestion costs the happiness target, in points. Never negative.
 *
 * The sign is here rather than at the call site so a reader of
 * `happinessTarget` sees one bracket of things added and this among them.
 */
export const congestionMood = (s: GameState): number => -CONGESTION_MOOD * congestion(s);

// ------------------------------------------------------------- the network

/** How many lines of a kind the city has, through one key. */
export const lineCount = (s: GameState, key: TransitLine['key']): number =>
  key === 'tram' ? s.tramLines : s.railLines;

/**
 * Districts the network reaches, as a share of the ones the city owns.
 *
 * The geometry lives in `networkedDistricts`, which memoises against the counts
 * it depends on — this is read from `demandTargets` ten times a second and must
 * not walk the line list to answer.
 *
 * Zero rather than one for a city with no land, which is the same convention
 * `landmarkCoverage` takes and the opposite of a service coverage: a coverage
 * is the share a service *fails* and it fails nothing when nothing is built,
 * where this is a thing the city has earned and an empty one has not.
 */
export const networkReach = (s: GameState): number => {
  const districts = Math.max(0, s.districts);
  if (districts <= 0) return 0;
  return Math.min(1, networkedDistricts(s.tramLines, s.railLines, districts) / districts);
};

/**
 * Districts of traffic the lines can carry, as a share of the ones the city
 * owns.
 *
 * The second half of what a network is, and the whole of what separates the two
 * rungs: `TransitLine.carries` is in districts, a tram carries a fraction of one
 * and a train carries several, so a city of trams runs out of capacity long
 * before it runs out of places to go.
 */
export const networkCapacity = (s: GameState): number => {
  const districts = Math.max(1, s.districts);
  let carried = 0;
  for (const line of TRANSIT_LINES) carried += lineCount(s, line.key) * line.carries;
  return Math.min(1, carried / districts);
};

/**
 * What the network actually serves, in [0, 1]. The one number everything reads.
 *
 * The lesser of what it reaches and what it can carry, and the `min` is the
 * design rather than an economy. Track to a district the trains cannot serve is
 * track; capacity with nowhere to run it is rolling stock in a shed. Multiplying
 * the two instead would charge a half-and-half network a quarter, which is the
 * same double-jeopardy the food cap avoided in section 8 of NOTES.md: two
 * shortfalls, one bar, and no way to tell which is biting. With `min`, the
 * panel shows both numbers and the smaller one names the next purchase.
 *
 * Derived, never integrated: everything it feeds already lags. Congestion feeds
 * happiness, which is integrated; the export lift feeds industrial demand,
 * which is integrated. A fourth lag would be a lag on a lag — the argument
 * `congestion` makes in its own comment.
 */
export const networkService = (s: GameState): number =>
  Math.min(networkReach(s), networkCapacity(s));

/**
 * How many lines of a kind the city may lay.
 *
 * The pair list and nothing else, and it takes `canBuildLandmark`'s position
 * rather than `serviceAllowed`'s for the same reason that one gives: a line
 * joins districts rather than serving people, so there is no *need* for it to
 * run one ahead of. The land is the only bound it has, and it is a tight one —
 * a district offers exactly one pair of each kind, so the whole network is
 * bounded by the district count however rich the city gets.
 *
 * A "one ahead of need" clamp was tried on top and taken out again. Need would
 * have had to be the larger of the two halves `networkService` reads — the
 * lines that carry the city and the lines that reach it — and the reaching half
 * is the district count less one, which is the pair list. So the clamp bound
 * nothing anywhere except on a rail-only city at exactly the point the player
 * was still buying reach, where it read as the game refusing a purchase that
 * was working.
 */
export const lineAllowed = (s: GameState, line: TransitLine): number =>
  linePairCapacity(line.key, s.districts);

/** What the next line of a kind costs. Compounded over its own count, like every
 *  other civic curve, and not demand-priced: nobody haggles over a railway. */
export const lineCost = (s: GameState, line: TransitLine): number =>
  line.base * line.growth ** lineCount(s, line.key);

export const canBuildLine = (s: GameState, line: TransitLine): boolean =>
  rankAllows(s, line.key) &&
  lineCount(s, line.key) < lineAllowed(s, line) &&
  s.cash >= lineCost(s, line);

/** The two districts the k-th line of a kind joins, for the renderer and the HUD. */
export const lineRoute = (s: GameState, key: TransitLine['key'], k: number) =>
  linePairAt(key, k, s.districts);

export interface TransitLineReading {
  readonly line: TransitLine;
  readonly built: number;
  readonly allowed: number;
  readonly cost: number;
}

/** The whole network block, in one read, for the HUD. */
export const transitLineReadings = (s: GameState): readonly TransitLineReading[] =>
  TRANSIT_LINES.map((line) => ({
    line,
    built: lineCount(s, line.key),
    allowed: lineAllowed(s, line),
    cost: lineCost(s, line),
  }));

// --------------------------------------------------------------------- crime

/** The police service, or undefined if the table is ever built without one. */
export const POLICE = SERVICES.find((service) => service.key === 'police');

/**
 * How crowded the city's housing is, in [0, 1].
 *
 * Residents per housing plot against CRIME_CROWDING_FULL, which is the middle
 * rung of the ladder. Measured across the five rungs of a built-out district:
 * 0.05, 0.21, 0.92, 1.00, 1.00 — so crowding is nothing in a village of
 * detached houses, is noticeable in a town of terraces and is the whole of what
 * it can be once towers go up. That is the ramp the term wants: what is being
 * measured is how many people share a street, and the two rungs above towers
 * are about height rather than about that.
 *
 * Residents rather than `population`, unlike a rank: crowding is about the
 * people who are actually there, and a half-empty tower is a half-crowded
 * street. It is the one place in this file where the occupancy integrator
 * *should* feed a reading.
 */
export const crimeCrowding = (s: GameState): number => {
  const plots = housingPlots(s);
  if (plots <= 0) return 0;
  return Math.min(1, residents(s) / plots / CRIME_CROWDING_FULL);
};

/**
 * Share of the city's workforce with nowhere to go, in [0, 1].
 *
 * Against the workforce, which is the reading the name promises and the one
 * this could not have until JOBS_LADDER existed. The objection it used to carry
 * was real: with jobs flat per plot and workers per resident, a built-out
 * level-4 district held 14,573 workers against 2,646 jobs, so `1 - jobs/workers`
 * read 96% at every city size and would have been a level term wearing an
 * unemployment label. The ladder is what answers it — the same district now
 * holds 15,840 against 10,115 — so the honest ratio is finally an honest ratio.
 *
 * It could not stay on `demandScale` in any case, and that is the other half of
 * why this moved. Once the scale grew with the city (see `demandScale`), a
 * jobless city read `workers / population`, which is WORKING_SHARE and nothing
 * else: idleness capped at 0.55 however idle the city was, and
 * `crimePressure`'s whole invariant — CRIME_FROM_CROWDING and
 * CRIME_FROM_IDLENESS summing to 1 so a maximally crowded, wholly idle city
 * reads exactly 1 — became unreachable. A quantity that cannot reach its own
 * bound is not the quantity the constants above it were solved against.
 *
 * The floor is the grace, and it is the only thing left of the old denominator.
 * A city with fewer workers than DEMAND_SCALE is measured against DEMAND_SCALE
 * instead, so a one-house city with no shops yet reads under a percent idle
 * rather than wholly idle, and crime does not charge a village for being a
 * village. Above it the floor never binds and the reading is the plain ratio.
 *
 * `workers` rather than `reachableWorkers`, and the difference is worth
 * stating: a bus route delivers a worker to a job that exists, and it does not
 * create one. Measuring idleness against the reachable force would have made
 * opening a depot *raise* the reported unemployment, which is exactly backwards
 * as a statement about what a depot is for.
 *
 * Zero for a city with nobody in it, so a fresh save is not idle — it is empty.
 */
export const unemployment = (s: GameState): number => {
  const force = workers(s);
  if (force <= 0) return 0;
  return Math.max(0, Math.min(1, (force - jobs(s)) / Math.max(force, DEMAND_SCALE)));
};

/**
 * How much crime the city would have with no police at all, in [0, 1].
 *
 * The part police do not answer, and the whole of what makes this a quantity
 * rather than an abstraction — see CRIME_FROM_CROWDING and CRIME_FROM_IDLENESS,
 * which sum to 1 so a maximally crowded and wholly idle city reads exactly 1.
 */
export const crimePressure = (s: GameState): number =>
  Math.min(
    1,
    CRIME_FROM_CROWDING * crimeCrowding(s) +
      // The idleness half, less whatever the libraries answer. On the *pressure*
      // rather than on `crime`, which is what keeps a library from being charged
      // against the police: they answer the crime that happens, and this is a
      // reason for less of it to happen. Crowding is untouched and cannot be
      // touched — that is the level ladder. See LIBRARY_CRIME_RELIEF.
      CRIME_FROM_IDLENESS *
        unemployment(s) *
        (1 - LIBRARY_CRIME_RELIEF * libraryCoverage(s)),
  );

/**
 * How much crime the city actually has, in [0, 1].
 *
 * Pressure times the share of the housing the police do *not* reach, and the
 * multiplication is the load-bearing part in three directions at once:
 *
 *   - it is not `1 - policeCoverage`, which is the abstraction this feature
 *     exists to remove. A quiet, employed village with no police station has
 *     almost no crime, and a crowded idle city with the same coverage has a
 *     great deal;
 *   - it is answerable. Full police coverage takes it to exactly zero whatever
 *     the pressure, which is what keeps the happiness ceiling reachable — see
 *     CRIME_MOOD, and `test/services.test.ts` -> "the happiness ceiling";
 *   - it has no geometry, and does not pretend to. `coverage` is a plot count
 *     over the housing land, with nothing anywhere deciding *which* plots — the
 *     rule `zones.ts` states about the coverage overlay — so this is a share of
 *     the city rather than a map of it.
 *
 * Not scaled by `shortfallShare`, exactly as congestion is not, and the reason
 * is the same one congestion gives: the grace is about a *service* a city is
 * too small to have needed yet, and a city is never too small to have its own
 * crime. It was tried the other way and measured out as unnecessary as well as
 * inconsistent — `unemployment` is normalised by `demandScale`, so a
 * one-house city reads 0.7% idle rather than the "wholly idle" a naive
 * jobs-over-workers ratio would have given it, and its pressure comes out at
 * 0.027. There was nothing to excuse.
 */
export const crime = (s: GameState): number => {
  if (!POLICE) return 0;
  // Two halves of one quantity: the level the police do not reach, and the
  // calls they do not answer in time. The second is `crime`'s rather than a
  // seventh modifier in the happiness bracket, because a modifier would charge
  // police coverage twice — once as this level and once as that rate — which is
  // exactly what the police re-calibration refused in writing. See
  // UNANSWERED_CRIME.
  return Math.max(
    0,
    Math.min(1, crimePressure(s) * (1 - coverage(s, POLICE)) + unansweredCrime(s)),
  );
};

/** What crime costs the happiness target, in points. Never positive. */
export const crimeMood = (s: GameState): number => -CRIME_MOOD * crime(s);

// ------------------------------------------------------------------- garbage

/**
 * What the city puts out each second, in bags.
 *
 * Residents, trading premises and working industry — the three the brief names
 * and the three `income` already reads, so the rubbish a city makes and the
 * money it makes are read off the same numbers. `effectiveOf` and `activeOf`
 * rather than the raw counts, which is what makes a boarded-up shop stop
 * putting bins out.
 */
export const garbageRate = (s: GameState): number =>
  (residents(s) * GARBAGE_PER_RESIDENT +
    effectiveOf(s, 'shop') * GARBAGE_PER_SHOP +
    activeOf(s, 'industry') * GARBAGE_PER_WORKS) *
  // Less whatever the recycling network keeps out of the stream. At *source*
  // rather than as a second collector, which is what makes the waste depot
  // stack with the bus rather than compete with it — see WASTE_RECYCLING.
  (1 - WASTE_RECYCLING * recyclingCoverage(s));

/** The waste service, or undefined if the table is ever built without one. */
export const WASTE = SERVICES.find((service) => service.key === 'waste');

/** Share of the city's housing land a recycling network reaches, in [0, 1]. */
export const recyclingCoverage = (s: GameState): number =>
  WASTE && housingPlots(s) > 0 ? Math.min(1, covered(s, WASTE) / housingPlots(s)) : 0;

/**
 * How much rubbish there is to shift, per housing plot, in [0, 1].
 *
 * Per housing plot for the reason every coverage in this file is: it is the one
 * denominator that is level-invariant, merge-invariant and occupancy-invariant,
 * so a city that promotes every building does not suddenly read as cleaner.
 * Read on a square root against GARBAGE_SATURATION — see that constant for the
 * curve and the measured ramp.
 */
export const garbageLoad = (s: GameState): number => {
  const plots = housingPlots(s);
  if (plots <= 0) return 0;
  const per = garbageRate(s) / plots;
  return Math.min(1, (per / GARBAGE_SATURATION) ** GARBAGE_CURVE);
};

/**
 * Share of the city's rubbish somebody comes for, in [0, 1].
 *
 * The transit depot, and it is the depot because the depot is the municipal
 * yard: it is where the city keeps the vehicles that go out on a round, and a
 * council that runs its buses out of one runs its bin lorries out of it too.
 * That gives the depot a second reason to exist and costs the balance nothing,
 * because TRANSIT carries `weight: 0` — the building was already the least
 * motivated of the five and this is the first happiness argument it has.
 *
 * A list of one, and it stayed a list of one when the land question was
 * answered. The sixth CIVIC_SERVICES entry exists now — the waste depot — and
 * it deliberately does *not* join this sum: `garbageCollection` is a plot count
 * over the housing land clamped at 1, and one finished collector already covers
 * the city, so a second at the same reach is worth everything at half-built and
 * nothing at all once the first is done. Two collectors would be two buttons
 * buying one number. The waste depot lowers `garbageRate` at source instead,
 * which stacks rather than competes — see WASTE_RECYCLING, and NOTES.md section
 * 12 for the table that decided it.
 *
 * So the list is still the shape a second collector would slot into, and the
 * measurement is why nothing did.
 *
 * Plots-covered rather than a radius, and that is the trap avoided rather than
 * a shortcut taken. `covered(s, service)` is a plot *count*; nothing anywhere
 * decides which plots it is, so a circle drawn round a depot would put a number
 * on screen the services panel does not have. See the comment on the coverage
 * overlay in `zones.ts`, which states the same rule from the other side.
 */
export const GARBAGE_COLLECTORS: readonly ServiceKey[] = ['transit'];

export const garbageCollection = (s: GameState): number => {
  const plots = housingPlots(s);
  if (plots <= 0) return 1;
  let reached = 0;
  for (const key of GARBAGE_COLLECTORS) {
    const service = SERVICES.find((entry) => entry.key === key);
    if (service) reached += covered(s, service);
  }
  return Math.min(1, reached / plots);
};

/**
 * How much rubbish is lying about, in [0, 1].
 *
 * Same shape as `crime`, and for the same reasons: the load has sources, the
 * collection answers all of it, neither half pretends to a geometry the game
 * does not have, and neither is excused by `shortfallShare` — a village makes
 * its own rubbish whether or not it is big enough to have needed a depot.
 *
 * `Math.max(0, …)` on both so a covered city reads +0 rather than -0. A sign
 * on a zero is invisible everywhere except in a test that asserts equality,
 * and that is exactly where it would be found.
 */
export const garbage = (s: GameState): number =>
  Math.max(0, garbageLoad(s) * (1 - garbageCollection(s)));

/** What uncollected rubbish costs the happiness target, in points. */
export const garbageMood = (s: GameState): number => -GARBAGE_MOOD * garbage(s);

/**
 * Share of the city's housing land a service reaches, capped at all of it.
 *
 * A city with no housing reads as fully covered rather than as fully
 * neglected: this is the share of the housing a service fails, and it fails
 * nothing when nothing has been built. Without that the game deadlocks on its
 * own tutorial — happiness would be 0 before the first house, the housing gate
 * would refuse to open it, and there would be no income to buy the hospital
 * that lifts the gate. See `housingPlots` for why the denominator is the land
 * the city has developed rather than the people standing on it.
 */
export const coverage = (s: GameState, service: Service): number => {
  const plots = housingPlots(s);
  if (plots <= 0) return 1;
  return Math.min(1, covered(s, service) / plots);
};

export interface ServiceReading {
  readonly service: Service;
  readonly built: number;
  readonly allowed: number;
  readonly needed: number;
  readonly covered: number;
  readonly coverage: number;
}

/** The whole services block, in one read, for the HUD. */
export const serviceReadings = (s: GameState): readonly ServiceReading[] =>
  SERVICES.map((service) => ({
    service,
    built: serviceCount(s, service.key),
    allowed: serviceAllowed(s, service),
    needed: serviceNeeded(s, service),
    covered: Math.min(covered(s, service), housingPlots(s)),
    coverage: coverage(s, service),
  }));

/**
 * Share of the city's housing land within reach of a park, capped at all of it.
 *
 * Measured against land rather than residents, which is the whole reason this
 * term is worth having — and is the term the three service coverages were
 * rebuilt to copy in Part 0. Park land is fixed at 4 plots to 24 housing plots a
 * district and a rezone adds none of it while multiplying residents by up to
 * 75x, so a per-resident denominator would be satisfied at level 0 by two parks
 * and unreachable at level 3 by every park in the city.
 *
 * Against *plots* rather than the homes it used to count, so it now shares one
 * denominator with everything else. Per home the term was level-invariant but
 * not merge-invariant: the same land read 83% as 24 detached houses and 100% as
 * the 12 towers they merged into. An empty city reads as covered for the same
 * reason an unserved one does: there is nothing it fails.
 */
export const recreationCoverage = (s: GameState): number => {
  const plots = housingPlots(s);
  if (plots <= 0) return 1;
  return Math.min(1, (s.parks * PLOTS_PER_PARK) / plots);
};

// -------------------------------------------------------------------- culture

/** How many of a culture type the city has, through one key. */
export const cultureCount = (s: GameState, key: Culture['key']): number =>
  key === 'library' ? s.libraries : s.theatres;

/**
 * How many of a culture type the city's land allows.
 *
 * One site a district shared by two types on a fixed interleave, so the
 * arithmetic is `siteCapacity`'s with a divisor of two — and it is the same
 * arithmetic for the same reason: a fixed interleave is the only assignment
 * that survives a reload, because the save holds a count and the position has
 * to fall out of the ordinal. The first district's site is the library's, the
 * second's is the theatre's, and they alternate from there.
 */
export const cultureAllowed = (s: GameState, culture: Culture): number => {
  const sites = Math.max(0, s.districts) * CULTURE_SITES_PER_DISTRICT;
  const offset = CULTURE.findIndex((entry) => entry.key === culture.key);
  if (offset < 0) return 0;
  return Math.max(0, Math.ceil((sites - offset) / CULTURE.length));
};

/**
 * Share of the city's housing land one culture type reaches, in [0, 1].
 *
 * The plots-covered form every *service* uses rather than the landmarks'
 * world-space reach — see `Culture.plots` for why. Zero rather than one for a
 * city with no housing, which is `landmarkCoverage`'s convention and the
 * opposite of a service's: a service coverage is the share it *fails* and it
 * fails nothing when nothing is built, where this is a thing the city has
 * earned and an empty one has not.
 */
export const cultureCoverage = (s: GameState, culture: Culture): number => {
  const plots = housingPlots(s);
  if (plots <= 0) return 0;
  return Math.min(1, (cultureCount(s, culture.key) * culture.plots) / plots);
};

/** The two rows, by name, so a reader has one thing to look up. */
export const LIBRARY = CULTURE.find((entry) => entry.key === 'library');
export const THEATRE = CULTURE.find((entry) => entry.key === 'theatre');

/** Share of the city's housing land within reach of a library, in [0, 1]. */
export const libraryCoverage = (s: GameState): number =>
  LIBRARY ? cultureCoverage(s, LIBRARY) : 0;

/** Share of the city's housing land within reach of a theatre, in [0, 1]. */
export const theatreCoverage = (s: GameState): number =>
  THEATRE ? cultureCoverage(s, THEATRE) : 0;

/** What the next building of a culture type costs. Not demand-priced. */
export const cultureCost = (s: GameState, culture: Culture): number =>
  culture.base * culture.growth ** cultureCount(s, culture.key);

export const canBuildCulture = (s: GameState, culture: Culture): boolean =>
  cultureCount(s, culture.key) < cultureAllowed(s, culture) &&
  s.cash >= cultureCost(s, culture);

/** Why a culture button is off. Land only, exactly as `landmarkBlocker` is. */
export function cultureBlocker(s: GameState, culture: Culture): string | null {
  return cultureCount(s, culture.key) >= cultureAllowed(s, culture) ? 'No sites left' : null;
}

export interface CultureReading {
  readonly culture: Culture;
  readonly built: number;
  readonly allowed: number;
  readonly cost: number;
  readonly coverage: number;
}

/** The whole culture block, in one read, for the HUD. */
export const cultureReadings = (s: GameState): readonly CultureReading[] =>
  CULTURE.map((culture) => ({
    culture,
    built: cultureCount(s, culture.key),
    allowed: cultureAllowed(s, culture),
    cost: cultureCost(s, culture),
    coverage: cultureCoverage(s, culture),
  }));

/** How many of a landmark type the city has, through one key. */
export const landmarkCount = (s: GameState, key: Landmark['key']): number =>
  key === 'museum' ? s.museums : s.stadiums;

/** Landmark sites the city owns of one type. One of each per district. */
export const landmarkSiteCapacity = (s: GameState, key: Landmark['key']): number =>
  s.districts *
  (key === 'museum' ? LANDMARK_SMALL_SITES_PER_DISTRICT : LANDMARK_LARGE_SITES_PER_DISTRICT);

/**
 * Share of the city's housing land within reach of a landmark, in [0, 1].
 *
 * The game's first area-of-effect, and it is a *scalar* rather than a per-
 * building modifier. That is the whole design decision — see LANDMARKS. A
 * landmark covers the housing plots inside its reach; this is the share of the
 * developed housing plots under at least one of them; happiness gains that
 * share times LANDMARK_MOOD.
 *
 * Zero rather than one for a city with no housing, which is the opposite of
 * every service coverage and is right for the same reason they are one: a
 * service coverage is the share it *fails* and it fails nothing when nothing is
 * built, where this is a bonus and an empty city has not earned it.
 *
 * The geometry lives in `landmarkPlotsCovered`, which memoises against the
 * counts it depends on — this is read from `happinessTarget` ten times a second
 * and must not walk a thousand plots to answer.
 */
export const landmarkCoverage = (s: GameState): number => {
  const plots = housingPlots(s);
  if (plots <= 0) return 0;
  return Math.min(1, landmarkPlotsCovered(s.museums, s.stadiums, plots, s) / plots);
};

export interface LandmarkReading {
  readonly landmark: Landmark;
  readonly built: number;
  readonly allowed: number;
  readonly cost: number;
}

/** The whole landmarks block, in one read, for the HUD. */
export const landmarkReadings = (s: GameState): readonly LandmarkReading[] =>
  LANDMARKS.map((landmark) => ({
    landmark,
    built: landmarkCount(s, landmark.key),
    allowed: landmarkSiteCapacity(s, landmark.key),
    cost: landmarkCost(s, landmark),
  }));

// ---------------------------------------------------------------------- port

/** How many terminals of one kind the city has, through one key. */
export const terminalCount = (s: GameState, key: Terminal['key']): number =>
  key === 'cruise' ? s.cruiseTerminals : s.cargoTerminals;

/**
 * Berths the city owns: one of each kind per coastal district.
 *
 * The land gate, and the only thing bounding a port. Zero until the city
 * annexes a district with the sea against it, which is what "the port unlocks
 * on a coastal district" means in counts — see `portDistrict`.
 */
export const terminalCapacity = (s: GameState): number => coastalDistricts(s.districts);

/** Whether the city has reached water at all. What the panel is gated on. */
export const hasCoast = (s: GameState): boolean => terminalCapacity(s) > 0;

/**
 * Visitors the cruise terminals are landing, per second.
 *
 * Happiness is a multiplier here rather than a floor, which is what makes this
 * different from every other line in the ledger: `incomeMultiplier` bottoms out
 * at HAPPINESS_FLOOR because people still pay rent in a city they dislike, and
 * nobody at all sails to one for a holiday.
 */
export const visitors = (s: GameState): number =>
  berthsLanding(s) * residents(s) * VISITORS_PER_RESIDENT * Math.max(0, Math.min(1, s.happiness));

/**
 * Berths' worth of arrivals the city has, quay and runway together.
 *
 * The airport lands visitors on the same path a cruise terminal does rather
 * than on a second one, which is what keeps `visitors` a single expression and
 * keeps the happiness scaling — the term that makes tourism the one income line
 * in the game that goes to *zero* in a miserable city rather than to
 * HAPPINESS_FLOOR. Nobody's holiday is somewhere grim, and that is as true of a
 * flight as of a cruise, and of a coach.
 *
 * Three sources, one expression. The road is the third and it is the only one
 * with no building of its own: it rides on `landmarkCoverage`, so a city that
 * has been buying museums for the mood has been buying tourism as well without
 * being told. See `visitorSources`, which is what the Trade tab splits out.
 */
export const berthsLanding = (s: GameState): number =>
  s.cruiseTerminals +
  (s.airport ? AIRPORT_VISITORS : 0) +
  // And the road, which is the third source and folded in the same way rather
  // than opened beside it. Landmarks rather than a terminal, so a landlocked
  // city under HIGHWAY_MIN_DISTRICTS has tourism at all — see ROAD_VISITORS.
  ROAD_VISITORS * landmarkCoverage(s) +
  // And the terminus, which is the fourth and the network's own route to
  // commercial demand: a visitor shops, and `demandTargets.c` reads
  // `visitors x VISITOR_TRIPS`. See RAIL_VISITORS for why it is the shoppers
  // channel rather than the labour one.
  RAIL_VISITORS * networkService(s) +
  // And the theatre, which is the fifth and the smallest. Folded in here for
  // the reason all four of the others are: one arrivals expression, one place
  // for the happiness scaling to live. See THEATRE_VISITORS.
  THEATRE_VISITORS * theatreCoverage(s);

/** What those visitors spend, per second, before tax. */
export const cruiseIncome = (s: GameState): number => visitors(s) * VISITOR_SPEND;

/**
 * Where the visitors came from, in people.
 *
 * A split of one number rather than three numbers that have to agree: the
 * shares are the berth counts and `visitors` is berths times everything else,
 * so this is that product divided back up. A panel that computed each source
 * separately would be a second arrivals model, and the first thing to go wrong
 * with it would be the happiness scaling on one of the three.
 */
export interface VisitorSources {
  readonly quay: number;
  readonly air: number;
  readonly road: number;
  readonly rail: number;
  readonly stage: number;
  readonly total: number;
}

export const visitorSources = (s: GameState): VisitorSources => {
  const berths = berthsLanding(s);
  const total = visitors(s);
  if (berths <= 0) return { quay: 0, air: 0, road: 0, rail: 0, stage: 0, total: 0 };
  const per = total / berths;
  return {
    quay: per * s.cruiseTerminals,
    air: per * (s.airport ? AIRPORT_VISITORS : 0),
    road: per * ROAD_VISITORS * landmarkCoverage(s),
    rail: per * RAIL_VISITORS * networkService(s),
    stage: per * THEATRE_VISITORS * theatreCoverage(s),
    total,
  };
};

/**
 * The share of the city's shopping the visitors are doing, in [0, 1].
 *
 * For the panel, and it is the number that says whether tourism is worth
 * anything: the trips themselves are inside `demandTargets.c` where nothing can
 * read them, and "12% of the shopping" is a fact a player can act on where
 * "0.04 of a demand point" is not.
 */
export const visitorShare = (s: GameState): number => {
  const locals = residents(s) * SPEND_PER_RESIDENT;
  const guests = visitors(s) * VISITOR_TRIPS;
  return guests + locals <= 0 ? 0 : guests / (guests + locals);
};

export interface TerminalReading {
  readonly terminal: Terminal;
  readonly built: number;
  readonly allowed: number;
  readonly cost: number;
}

/** The whole port block, in one read, for the HUD. */
export const terminalReadings = (s: GameState): readonly TerminalReading[] =>
  TERMINALS.map((terminal) => ({
    terminal,
    built: terminalCount(s, terminal.key),
    allowed: terminalCapacity(s),
    cost: terminalCost(s, terminal),
  }));

// ------------------------------------------------------------------ estates

/**
 * Whether the city has reached the size at which it may build outside itself.
 *
 * A rank now, and it *replaces* HIGHWAY_MIN_DISTRICTS rather than stacking on
 * it: two gates on one button would be two numbers saying one thing. The
 * constant stays because it is what HIGHWAY_COST and AIRPORT_BASE are priced
 * from, and the rank that replaces it asks for the same 14 districts — see
 * RANKS, whose Conurbation rung is set to exactly that so the timing the
 * highway was calibrated at is the timing it keeps. What the rank adds is the
 * population column, which at 14 districts is long since cleared.
 *
 * Separate from `canBuildHighway` so the panel can say "not yet" and "not
 * enough cash" as two different things.
 */
export const highwayAllowed = (s: GameState): boolean => rankAllows(s, 'highway');

export const highwayCost = (): number => HIGHWAY_COST;

export const canBuildHighway = (s: GameState): boolean =>
  !s.highway && highwayAllowed(s) && s.cash >= HIGHWAY_COST;

/**
 * Parcels the city may take in the band, which is nothing until the road is in.
 *
 * Two bounds, and each says something different. The road is the progression
 * gate; the district count paces the band the way it paces the landmark sites,
 * so a city that has just built the highway does not find thirty-eight parcels
 * waiting; and ESTATE_CELLS is the ground itself — the band is a fixed strip
 * with the water already taken out of it, so it is the one bound that cannot be
 * bought past.
 */
export const estateCapacity = (s: GameState): number =>
  s.highway ? Math.min(ESTATE_CELLS, s.districts) : 0;

export const estateCost = (s: GameState): number => ESTATE_BASE * ESTATE_GROWTH ** s.estates;

export const canBuildEstate = (s: GameState): boolean =>
  s.estates < estateCapacity(s) && s.cash >= estateCost(s);

/**
 * Industrial land the city works outside its own streets, in plots, less the
 * share standing empty.
 *
 * Shares `occupancyI` with the works inside the city rather than integrating an
 * occupancy of its own. They are the same industry facing the same demand, and
 * a second lagged signal would be a second thing to save, a second thing to
 * migrate and a second thing that could disagree with the first for reasons
 * nobody could see.
 */
export const estatePlots = (s: GameState): number => s.estates * ESTATE_PLOTS;

export const estateActive = (s: GameState): number => estatePlots(s) * s.occupancyI;

/**
 * The mean level weight of an industrial plot inside the city.
 *
 * What an estate is built to, and the reason it is not simply worth
 * ESTATE_YIELD forever: LEVEL_SCALE spans 1 to 600, so a flat weight would make
 * the estates the whole economy at the bottom of the ladder and a rounding
 * error at the top. An estate has no level of its own to climb — no education
 * gate, no merge, no fourth cohort in the save — so it is built to whatever
 * standard the city's own works are built to. They are the same firms.
 *
 * One rather than zero for a city with no industry at all, so the first estate
 * is worth something to a city that has never zoned a works.
 */
export const industryScale = (s: GameState): number => {
  const plots = cohortFootprint(s.industryLevels);
  if (plots <= 0) return 1;
  return Math.max(1, cohortScale(s.industryLevels) / plots);
};

/** What the estates are worth to the ledger, in level-0 industrial buildings. */
export const estateEarning = (s: GameState): number =>
  estateActive(s) * ESTATE_YIELD * industryScale(s);

/** Goods the estates make. Per plot and level-flat, exactly as INDUSTRY_OUTPUT is. */
export const estateSupply = (s: GameState): number =>
  estateActive(s) * ESTATE_YIELD * INDUSTRIAL_OUTPUT;

/** Hands the estates need. Fewer per plot than in the city — see JOBS_PER_ESTATE_PLOT. */
export const estateJobs = (s: GameState): number => estateActive(s) * JOBS_PER_ESTATE_PLOT;

export function highwayBlocker(s: GameState): string | null {
  if (s.highway) return 'Built';
  return rankBlocker(s, 'highway');
}

/**
 * Whether the city could have an airport at all: the road, and the ground.
 *
 * The road is the progression gate, and it is the estates' gate rather than one
 * of its own because it is the same gate — the airport stands at the end of the
 * same spur, on land the city does not own, and a second district count for the
 * same road would be two numbers saying one thing.
 *
 * The ground is the other half and is a property of the seed: the band is a
 * fixed strip with the water already taken out of it, and a seed that drowned
 * every candidate runway leaves the city with nowhere to put one. See
 * `airportCell`.
 */
export const airportAllowed = (s: GameState): boolean => s.highway && AIRPORT_SITED;

/** Flat: there is one airport, so there is no n to compound over. */
export const airportCost = (): number => AIRPORT_BASE;

export const canBuildAirport = (s: GameState): boolean =>
  !s.airport && airportAllowed(s) && s.cash >= airportCost();

export function airportBlocker(s: GameState): string | null {
  if (s.airport) return 'Built';
  if (!s.highway) return 'No highway yet';
  return AIRPORT_SITED ? null : 'Nowhere to put one';
}

export function estateBlocker(s: GameState): string | null {
  if (!s.highway) return 'No highway yet';
  return s.estates >= estateCapacity(s) ? 'No parcels left' : null;
}

/**
 * One line of the happiness panel: something the city can be short of, what it
 * is called when it is the binding one, and what it is worth.
 *
 * Recreation is not a `Service` — no staffing ramp, no 2x2 site, no population
 * capacity, and a denominator in homes rather than residents — but it is a
 * happiness term, and the panel has to be able to name it. This is the shape
 * the two have in common and nothing more.
 */
export interface HappinessTerm {
  readonly key: ServiceKey | 'recreation' | 'congestion' | 'crime' | 'garbage';
  readonly coverLabel: string;
  readonly weight: number;
  /**
   * The raw share, exactly as `coverage` and `recreationCoverage` report it.
   *
   * Deliberately *not* discounted by `shortfallShare`, which is the one place
   * this could have gone. A coverage means one thing everywhere in this game —
   * the share of the city's housing land a service reaches — and the services
   * panel, the ticker's "coverage fell to" line and this one all have to say
   * the same number about the same buildings. What a small city is excused is a
   * property of its happiness, so it lives in `happinessTarget` and nowhere
   * else.
   */
  readonly coverage: number;
  /**
   * True for a term that is a *modifier* on earned coverage rather than one of
   * the weights that sum to 1.
   *
   * Congestion is the only one, and it is in this list rather than beside it so
   * the panel can name it and `bindingTerm` can pick it. What makes that sound
   * is that a modifier's cost is already in the same units: `weight x (1 -
   * coverage)` is exactly CONGESTION_MOOD x congestion, which is exactly what it
   * takes off the target. What the flag says is that the four weights still sum
   * to 1 without it, and that `shortfallShare` does not apply — a small city is
   * excused a service it has not needed yet, and is not excused its own traffic.
   */
  readonly modifier?: boolean;
}

/**
 * Share of a coverage shortfall a city this size is charged for, in [0, 1].
 *
 * The continuous form of the rule `coverage` states at zero plots: a service
 * fails nobody when nothing has been built, and it barely fails anybody when
 * eleven twelfths of the city it would serve does not exist yet. Reaches 1 at
 * COVERAGE_GRACE_PLOTS and stays there, so every number this file's constants
 * were measured against is untouched.
 */
export const shortfallShare = (s: GameState): number =>
  Math.min(1, housingPlots(s) / COVERAGE_GRACE_PLOTS);

/**
 * Every term happiness is made of, services first, then recreation, then the
 * one modifier the panel can name.
 *
 * The first three are the weights, and they sum to exactly 1. Congestion,
 * crime and rubbish are `modifier: true` and are not among them — they are here
 * so the panel has a row for each and `bindingTerm` can pick one, which is the
 * whole of what makes a depot and a police station mood purchases. See
 * `HappinessTerm.modifier`.
 *
 * Police is no longer in the weighted half and is in the modifier half twice
 * over: it answers crime, and the depot beside it answers both congestion and
 * rubbish. That is the shape the re-calibration was for — a service is worth
 * what the problem it solves costs, rather than worth a number in a table.
 */
export const happinessTerms = (s: GameState): readonly HappinessTerm[] => [
  ...HAPPINESS_SERVICES.map((service) => ({
    key: service.key,
    coverLabel: service.coverLabel,
    weight: service.weight,
    coverage: coverage(s, service),
  })),
  {
    key: 'recreation' as const,
    coverLabel: 'Parks per plot',
    weight: RECREATION_WEIGHT,
    coverage: recreationCoverage(s),
  },
  {
    key: 'congestion' as const,
    // Stated as the good thing rather than the bad one, so every row in the
    // panel reads the same way round: a high number is a city doing well.
    coverLabel: 'Roads clear',
    weight: CONGESTION_MOOD,
    coverage: 1 - congestion(s),
    modifier: true,
  },
  {
    key: 'crime' as const,
    coverLabel: 'Streets safe',
    weight: CRIME_MOOD,
    coverage: 1 - crime(s),
    modifier: true,
  },
  {
    key: 'garbage' as const,
    coverLabel: 'Bins emptied',
    weight: GARBAGE_MOOD,
    coverage: 1 - garbage(s),
    modifier: true,
  },
];

/**
 * Weighted coverage less what is currently on fire, in [0, 1]. Where
 * `s.happiness` is heading.
 *
 * The fire term is a flat subtraction rather than another weighted coverage
 * because it is not a service level — it is an event, and it should hurt while
 * it is happening and stop hurting the moment it is out.
 *
 * Written as one minus the weighted *shortfall* rather than as the weighted
 * coverage it used to be, which is the same number by two routes — the four
 * weights sum to exactly 1 — and only the shortfall form can be scaled by
 * `shortfallShare`. Summed by hand rather than through `happinessTerms`
 * because this runs ten times a second and the four objects that read nicer
 * are four objects a tick.
 */
export const happinessTarget = (s: GameState): number => {
  const share = shortfallShare(s);
  let short = RECREATION_WEIGHT * (1 - recreationCoverage(s));
  for (const service of HAPPINESS_SERVICES) short += service.weight * (1 - coverage(s, service));
  const covered = 1 - share * short;
  // The tax term joins the fire term as a *modifier* on earned coverage rather
  // than as a fifth weight. The four weights sum to exactly 1 and go on doing
  // so; what a tax rate changes is how the city feels about the coverage it has,
  // which is a different statement from how much that coverage is worth.
  //
  // Landmarks are the third modifier and are here for exactly that reason. They
  // are an area-of-effect over housing land, not a service the city is covered
  // by, and adding them to the weighted sum would have re-opened a calibration
  // that has held for three cycles. See LANDMARK_MOOD.
  //
  // Congestion is the fourth, and the first that is a cost rather than a
  // purchase. It is not scaled by `shortfallShare` — that grace is about a
  // service a city is too small to have needed yet, and a city too small to
  // have needed a hospital has too few residents to jam its own streets, so the
  // term is already small there on its own.
  //
  // Crime and rubbish are the fifth and sixth, and the first two that replace a
  // weight rather than sitting on top of one. Police used to carry 0.26 in the
  // weighted sum; it carries nothing now and `crimeMood` carries it instead —
  // see the police row in SERVICES for the arithmetic and for why charging both
  // was rejected. Neither is scaled by `shortfallShare`, exactly as congestion
  // is not: the grace is about a service a city has not needed yet, and a city
  // is never too small to have its own crime or its own bins.
  const policy =
    taxStep(s).mood +
    (faresWaived(s) ? FREE_TRANSPORT_MOOD : 0) +
    LANDMARK_MOOD * landmarkCoverage(s) +
    congestionMood(s) +
    crimeMood(s) +
    garbageMood(s);
  return Math.max(0, Math.min(1, covered + policy) - FIRE_UNHAPPINESS * s.fires.length);
};

/**
 * The term holding happiness back hardest — the one whose shortfall costs the
 * most weighted points. Naming it is the entire value of the panel: a bare
 * percentage tells the player nothing they can act on, and with a fourth term
 * in the sum a panel that could only ever name a *service* would leave a
 * park-less city stuck at 82% with three green lines and no explanation.
 */
/**
 * The purchase that would lift happiness most, and what it costs.
 *
 * `bindingTerm` says what is *short*; this says what to press, and the two are
 * not the same answer. The binding term is whichever shortfall costs the most
 * weighted points, which early on is always the hospital — so a city sitting at
 * 60 in the bank was told "Health coverage 0%" about a building costing 130
 * while the 45 park that would also have helped sat unmentioned. A panel that
 * can only name a problem the player cannot afford to solve is a panel that
 * names nothing.
 *
 * So: every happiness lever the city has the *land* for, scored by what one more
 * of it would add to the target, and the best of the ones it can pay for wins.
 * With nothing affordable it falls back to the cheapest lever there is, because
 * "save 130 for a hospital" is still an instruction and "Health coverage 0%" is
 * not.
 *
 * Parks are in the list on equal terms with the three services. They are the
 * fourth happiness term and the cheapest by a wide margin, which is exactly the
 * combination the old panel could never surface.
 */
export interface HappinessFix {
  /** The button this names, worded as the button words it. */
  readonly label: string;
  readonly cost: number;
  readonly affordable: boolean;
  /** What one more would add to the happiness target, in points. */
  readonly lift: number;
}

export const happinessFix = (s: GameState): HappinessFix | null => {
  const plots = housingPlots(s);
  if (plots <= 0) return null;
  // Every lift is scaled by the same share, so this cannot reorder the options
  // — it is here so `lift` goes on meaning what it says it means. On a city
  // under COVERAGE_GRACE_PLOTS an unscaled lift would promise a park eighteen
  // points it would not deliver.
  const share = shortfallShare(s);
  const options: HappinessFix[] = [];

  for (const service of HAPPINESS_SERVICES) {
    if (serviceCount(s, service.key) >= serviceAllowed(s, service)) continue;
    // One more building at full staffing, against the coverage the city has
    // now — the honest marginal reading, and it goes to zero on a covered
    // service so a green line never gets named.
    const now = coverage(s, service);
    const then = Math.min(1, (covered(s, service) + service.plots) / plots);
    const cost = serviceCost(s, service);
    options.push({
      label: service.buildLabel,
      cost,
      affordable: s.cash >= cost,
      lift: share * service.weight * (then - now),
    });
  }

  // The depot, and the reason congestion was worth building at all. TRANSIT
  // carries `weight: 0`, so it is not in HAPPINESS_SERVICES and the loop above
  // never sees it — but a jammed city has a purchase that fixes it, and a panel
  // that could not name that purchase would be naming a problem with no answer.
  //
  // It answers rubbish as well now, and the two lifts are summed rather than
  // listed twice: one button cannot be two rows, and what the player wants to
  // know is what pressing it is worth. See `garbageCollection` for why the
  // depot is the yard the bin lorries come out of.
  if (TRANSIT && serviceCount(s, 'transit') < serviceAllowed(s, TRANSIT)) {
    const cost = serviceCost(s, TRANSIT);
    const cleaner = { ...s, depots: s.depots + 1, depotStaff: 1 };
    options.push({
      label: TRANSIT.buildLabel,
      cost,
      affordable: s.cash >= cost,
      // Not scaled by `share`: congestion is a modifier and is not excused for
      // a small city — see `happinessTarget`.
      lift:
        CONGESTION_MOOD * (congestion(s) - congestionWithDepot(s)) +
        GARBAGE_MOOD * (garbage(s) - garbage(cleaner)),
    });
  }

  // And the police station, for exactly the reason the depot is here: police
  // carry `weight: 0` since crime became a quantity, so the loop above never
  // sees them either — and a city being robbed has a purchase that stops it.
  if (POLICE && serviceCount(s, 'police') < serviceAllowed(s, POLICE)) {
    const cost = serviceCost(s, POLICE);
    // One more station at full staffing, which is the same marginal reading
    // every other option in this list uses.
    const safer = { ...s, police: s.police + 1, policeStaff: 1 };
    options.push({
      label: POLICE.buildLabel,
      cost,
      affordable: s.cash >= cost,
      lift: CRIME_MOOD * (crime(s) - crime(safer)),
    });
  }

  if (s.parks < parkCapacity(s)) {
    const now = recreationCoverage(s);
    const then = Math.min(1, ((s.parks + 1) * PLOTS_PER_PARK) / plots);
    const cost = parkCost(s);
    options.push({
      label: 'Open park',
      cost,
      affordable: s.cash >= cost,
      lift: share * RECREATION_WEIGHT * (then - now),
    });
  }

  const worth = options.filter((option) => option.lift > 0);
  if (worth.length === 0) return null;
  const paid = worth.filter((option) => option.affordable);
  if (paid.length > 0) {
    return paid.reduce((best, option) => (option.lift > best.lift ? option : best));
  }
  return worth.reduce((best, option) => (option.cost < best.cost ? option : best));
};

export const bindingTerm = (s: GameState): HappinessTerm => {
  const terms = happinessTerms(s);
  // The grace applies to the four weighted coverages and not to the modifier,
  // exactly as `happinessTarget` applies it. It used not to matter here — a
  // factor common to every term cannot reorder them — and it does now that a
  // term it does *not* scale is in the list beside them.
  const share = shortfallShare(s);
  let worst = terms[0] as HappinessTerm;
  let cost = -1;
  for (const term of terms) {
    const lost = term.weight * (1 - term.coverage) * (term.modifier === true ? 1 : share);
    if (lost > cost) {
      cost = lost;
      worst = term;
    }
  }
  return worst;
};

/**
 * The tax setting the city is *on*, which is not always the one it has stored.
 *
 * Neutral until there is a city hall, because a rate is policy and policy needs
 * somebody to set it. The stored field is left exactly as the player left it —
 * overwriting it would lose a choice they made and could not see being lost —
 * so a hall bought later puts the city straight back on its own rate.
 *
 * Clamped as well, so a doctored save picks a real step.
 */
export const taxStep = (s: GameState): (typeof TAX_STEPS)[number] => {
  const wanted = hasPolicy(s) ? s.taxRate : TAX_NEUTRAL;
  const at = Math.max(0, Math.min(TAX_STEPS.length - 1, Math.floor(wanted)));
  return TAX_STEPS[at] as (typeof TAX_STEPS)[number];
};

/**
 * What the city's tax rate does to the appetite for premises, in [-1, 1].
 *
 * Derived from TAX_STEPS' own income multipliers rather than typed as a third
 * column, so a rate cannot say one thing to the ledger and another to demand.
 * Normalised on each side of neutral separately, because the table is not
 * symmetric: there is one step below neutral and two above it, so "as far down
 * as this game goes" is Low and "as far up" is Punitive, and both read as the
 * full 1. A city on Standard reads exactly 0, which is what keeps a fresh save's
 * targets where they were.
 *
 * Measured across the table: Low -1.00, Standard 0.00, High +0.50, Punitive
 * +1.00. Against DEMAND_TERMS' weights that is worth +0.30 / 0 / -0.15 / -0.30
 * of commercial demand and +0.35 / 0 / -0.175 / -0.35 of industrial — so the
 * rate is now the single largest lever in the table, in both directions, which
 * is what "a real strategic choice rather than a mood dial" has to mean.
 */
export const taxPressure = (s: GameState): number => {
  const rate = taxStep(s).income;
  if (rate === 1) return 0;
  let span = 0;
  for (const step of TAX_STEPS) {
    const reach = rate > 1 ? step.income - 1 : 1 - step.income;
    if (reach > span) span = reach;
  }
  if (span <= 0) return 0;
  return rate > 1 ? (rate - 1) / span : -((1 - rate) / span);
};

/**
 * What happiness does to the ledger. Floored, never zeroed: a neglected city
 * should feel like one that has stopped growing, not one that has been fined.
 */
export const incomeMultiplier = (s: GameState): number =>
  HAPPINESS_FLOOR + (1 - HAPPINESS_FLOOR) * Math.max(0, Math.min(1, s.happiness));

/**
 * Fraction of the gap a lagged signal closes over `dt` seconds.
 *
 * Same exponential form as `demandStep`, and for the same reason: it saturates
 * at 1 for any step size, so a 60-second offline catch-up step lands exactly
 * where sixty one-second ticks would.
 */
const lagStep = (dt: number, tau: number): number => 1 - Math.exp(-Math.max(0, dt) / tau);

export const staffStep = (dt: number): number => lagStep(dt, CIVIC_RAMP_SECONDS);
export const happinessStep = (dt: number): number => lagStep(dt, HAPPINESS_TAU);

/**
 * Staffing after one more building of a type lands.
 *
 * A weighted average, not a reset: the four hospitals that were already running
 * do not send their staff home because a fifth opened. Because it is the honest
 * average, `built x staffing` — the effective number of buildings — comes out
 * unchanged, so coverage holds exactly where it was and then climbs to take in
 * the new one. It never steps down, which is better than the "dips slightly"
 * this was specified as and follows from the same rule rather than softening it.
 */
export const staffAfterBuild = (current: number, built: number): number =>
  built <= 0 ? 0 : (current * built) / (built + 1);

// ---------------------------------------------------------------------- fire

/**
 * Buildings a fire can start in.
 *
 * Civic buildings are excluded, and not for realism. Destroying one would have
 * to unwind its staffing scalar — which is a per-*type* average, so there is no
 * honest way to take one building back out of it — and a burning fire station
 * is a joke that costs the save file a special case. The three earning types
 * are the ones the player builds, loses and rebuilds.
 */
export const burnableBuildings = (s: GameState): number => s.homes + s.shops + s.industry;

/** How many of one kind the city has. The denominator an ignition draws against. */
export const burnableOf = countOf;

/**
 * Share of residents the fire service reaches. The one input suppression reads.
 *
 * Walked rather than looked up so the fire service's position in SERVICES is
 * not a second thing to keep in step; a table with no fire service in it at all
 * would mean nothing to fail rather than a crash.
 */
export const fireCoverage = (s: GameState): number => {
  for (const service of SERVICES) if (service.key === 'fire') return coverage(s, service);
  return 1;
};

/**
 * Expected ignitions per second, over the whole city.
 *
 * Per hour in the constant because that is the scale a player experiences it
 * at; per second here because that is the scale the integrator runs at.
 */
export const ignitionRate = (s: GameState): number =>
  (BASE_IGNITION_PER_BUILDING_HOUR * burnableBuildings(s) * (1 - FIRE_SUPPRESSION * fireCoverage(s))) /
  3600;

/**
 * Share of the city's housing land one response's service reaches.
 *
 * Walked rather than looked up, for the reason `fireCoverage` gives: a table
 * built without that service in it should mean nothing to fail rather than a
 * crash.
 */
const responseCoverage = (s: GameState, row: EmergencyResponse): number => {
  for (const service of SERVICES) if (service.key === row.service) return coverage(s, service);
  return 1;
};

/**
 * Seconds from the thing happening to it being over, at the city's coverage.
 *
 * The generalised form of what fire has always done, and the three functions
 * below it are the rest. Read fresh every tick rather than stamped on the fire
 * or the call, so a station that opens while something is burning actually
 * shortens the fire it was too late to prevent — and so does one that opens
 * while a call is waiting.
 */
export const responseSeconds = (s: GameState, row: EmergencyResponse): number =>
  row.slow + (row.fast - row.slow) * responseCoverage(s, row);

/** Whether a thing starting now would go unanswered: the threshold. */
export const missesDeadline = (s: GameState, row: EmergencyResponse): boolean =>
  responseSeconds(s, row) > row.deadline;

/** When it resolves, one way or the other. */
export const responseResolvesAt = (s: GameState, row: EmergencyResponse): number =>
  Math.min(responseSeconds(s, row), row.deadline);

/**
 * The coverage the threshold sits at, in [0, 1].
 *
 * Derived rather than typed, so the figure three comments and a test quote —
 * fire's 21.4% — cannot drift from the constants it is made of. Solves
 * `slow + (fast - slow) x c = deadline` for c.
 */
export const responseThreshold = (row: EmergencyResponse): number => {
  const span = row.slow - row.fast;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (row.slow - row.deadline) / span));
};

/**
 * Seconds from ignition to the fire being out, at the city's current coverage.
 *
 * The fire row of the shared model, kept as its own name because three
 * comments, a test and the HUD all say `extinguishSeconds`. Every fire constant
 * is exactly where it was — see RESPONSES, which is the table they now sit in.
 */
export const extinguishSeconds = (s: GameState): number =>
  responseSeconds(s, FIRE_RESPONSE);

/**
 * Whether a fire started now would take the building with it.
 *
 * The threshold the whole mechanic turns on: the response has to arrive inside
 * BURN_OUT_SECONDS or there is nothing left to save.
 */
export const wouldBurnOut = (s: GameState): boolean => missesDeadline(s, FIRE_RESPONSE);

/** When a fire resolves, one way or the other. */
export const resolvesAt = (s: GameState): number => responseResolvesAt(s, FIRE_RESPONSE);

// ----------------------------------------------------------------- the calls

/**
 * Calls coming in per second, over the whole city.
 *
 * `ignitionRate`'s shape with the suppression term the other way round, and the
 * difference is the whole of what separates the two services. A fire station
 * stops fires *starting*, so FIRE_SUPPRESSION multiplies the rate; a police
 * station does not stop crime happening, so what multiplies this is
 * `crimePressure` — the crowding and the idleness the city has made for itself
 * — and nothing the police do reaches it at all. What police coverage buys is
 * the answer, which is `responseSeconds`.
 */
export const callRate = (s: GameState): number =>
  (BASE_CALL_PER_BUILDING_HOUR * burnableBuildings(s) * crimePressure(s)) / 3600;

/**
 * How much of the crime slate is calls nobody is coming to, in [0, 1].
 *
 * Zero unless the response misses the deadline, which is what keeps the
 * happiness ceiling exactly where it was: a fully covered city answers every
 * call in ANSWER_MIN, so this reads 0 however many calls are open and `crime`
 * comes out identical to the number it read before this existed.
 *
 * A share of the *cap* rather than of the calls open, because the cap is the
 * only denominator that does not move: a share of the open calls would read 1
 * for a single unanswered call and 1 again for eight of them.
 */
export const unansweredCalls = (s: GameState): number => {
  if (!missesDeadline(s, POLICE_RESPONSE)) return 0;
  return Math.min(1, s.calls.length / POLICE_RESPONSE.active);
};

/** What those calls add to the crime slate. See UNANSWERED_CRIME. */
export const unansweredCrime = (s: GameState): number =>
  UNANSWERED_CRIME * unansweredCalls(s);

/** Fires burning in one kind of building right now. */
export const burningOf = (s: GameState, kind: ZoneKind): number => {
  let n = 0;
  for (const fire of s.fires) if (fire.kind === kind) n++;
  return n;
};

/**
 * Share of a zone that is currently on fire, in [0, 1].
 *
 * A share rather than a count now that buildings differ: which cohort the
 * burning building sits in is not recorded — a fire stores an ordinal, not a
 * level — so taking a proportion of the zone's earnings off is the honest read
 * and the only one that cannot go negative. Measured against the standing
 * stock, because a ruin was earning nothing to begin with.
 */
export const alight = (s: GameState, kind: ZoneKind): number => {
  const standing = standingOf(s, kind);
  return standing <= 0 ? 0 : Math.min(1, burningOf(s, kind) / standing);
};

/** Whether this exact building is already alight. Ignition never doubles up. */
export const isBurning = (s: GameState, kind: ZoneKind, index: number): boolean =>
  s.fires.some((fire) => fire.kind === kind && fire.index === index);

// ---------------------------------------------------------- the rival city

/**
 * Whether the city's goods agreement is actually in force.
 *
 * Read instead of `s.goodsTrade` everywhere it matters, exactly as
 * `faresWaived` is read instead of `s.freeTransport`: the stored flag is the
 * player's *choice* and this is whether the city can act on it. Keeping the two
 * apart is what lets a setting survive a save that predates the city hall.
 */
export const goodsTraded = (s: GameState): boolean => hasPolicy(s) && s.goodsTrade;

/**
 * How established the city next door is, in [0, 1].
 *
 * Derived and never stored, which is the whole of why it survives an offline
 * catch-up: it is a function of `s.elapsed` and `s.districts`, both of which
 * only ever rise, so a twelve-hour absence lands on exactly the rival a watched
 * session would have. A stored rival scalar would be a fourth exception to "the
 * save is counts" — and unlike the three that exist, it would be bounded by a
 * clock rather than by districts, a static table or a fixed ring, which is the
 * one thing every one of them is bounded by something *other* than.
 *
 * Two factors, and between them they are the shape that makes a rival a feature
 * rather than a tax:
 *
 *   - it *arrives*. `age / (1 + age)` against RIVAL_SETTLE_SECONDS saturates
 *     rather than clamping, so there is no moment at which the rival suddenly
 *     is one;
 *   - it is *outgrown*. A city that has annexed its way to
 *     RIVAL_MATCH_DISTRICTS has made the place next door a suburb, and the term
 *     goes to zero — so the answer the player was always going to reach for is
 *     the answer.
 *
 * The treaty is the faster answer and is the one that makes this pushable back
 * against inside an hour. See GOODS_TRADE_ANSWER.
 */
export const rivalStrength = (s: GameState): number => {
  const age = Math.max(0, s.elapsed) / RIVAL_SETTLE_SECONDS;
  const arrived = age / (1 + age);
  const outgrown = Math.min(1, Math.max(0, s.districts - 1) / Math.max(1, RIVAL_MATCH_DISTRICTS - 1));
  const answered = goodsTraded(s) ? GOODS_TRADE_ANSWER : 0;
  return Math.max(0, arrived * (1 - outgrown) * (1 - answered));
};

/**
 * What the rival takes off one zone's demand target, signed. Never positive.
 *
 * Additive, in the same bracket `demandLift` adds into, because that is where
 * it *is*: the two `rival` rows are DEMAND_TERMS entries like every other term,
 * so `demandTargets` carries it without a line of its own and the HUD's
 * breakdown names it without a case of its own. This is the readable accessor
 * for a caller that wants the one term rather than the sum — the trade panel,
 * which has to say what the place next door is costing before a player will
 * spend anything on answering it.
 */
export const rivalDemand = (s: GameState, kind: ZoneKind): number => {
  if (kind === 'home') return 0;
  const weight = kind === 'shop' ? RIVAL_COMMERCIAL_DEMAND : RIVAL_INDUSTRIAL_DEMAND;
  return -weight * rivalStrength(s);
};

// --------------------------------------------------------------------- trade

/** The power arrangement the city is *on*, which is not always the one it stored. */
export const powerTradeStep = (s: GameState): PowerTrade => {
  const wanted = hasPolicy(s) ? s.powerTrade : POWER_TRADE_NEUTRAL;
  const at = Math.max(0, Math.min(POWER_TRADES.length - 1, Math.floor(wanted)));
  return POWER_TRADES[at] as PowerTrade;
};

/**
 * Power the city buys in, per second.
 *
 * A share of what it draws rather than a flat block, and that is what keeps the
 * agreement useful at every size: POWER_PER_PLANT is multiplied by `cityScale`,
 * so a fixed import would be the whole grid at one district and a rounding
 * error at forty-nine.
 */
export const powerImported = (s: GameState): number => {
  const share = powerTradeStep(s).imports;
  return share <= 0 ? 0 : share * powerDemand(s);
};

/**
 * Power the city has spare and can find a buyer for, per second.
 *
 * Imports are excluded from the surplus on purpose: a city that bought a unit
 * and sold it back would be a money printer, and both halves of the switch
 * cannot be on at once anyway — POWER_TRADES is one index.
 */
export const powerSurplus = (s: GameState): number => {
  const draw = powerDemand(s);
  // Capped at a share of the city's own draw — see POWER_EXPORT_CAP, which is
  // what stops an over-plotted small city selling eleven times what it uses.
  return Math.max(0, Math.min(ownPowerSupply(s) - draw, POWER_EXPORT_CAP * draw));
};

/**
 * What selling the surplus earns, per second, before tax.
 *
 * Short-circuited on the step rather than multiplied by zero, and both of these
 * are: `powerSurplus` and `powerImported` each walk the three cohorts through
 * `powerDemand`, and `income` and `upkeep` run ten times a second on a path
 * that is already the hottest in the game. A city with no treaty pays nothing
 * for having the mechanism.
 */
export const powerTradeIncome = (s: GameState): number => {
  const sells = powerTradeStep(s).sells;
  return sells <= 0 ? 0 : sells * powerSurplus(s);
};

/** What buying power costs, per second. Joins the wage bill, not the ledger. */
export const powerTradeCost = (s: GameState): number => {
  const step = powerTradeStep(s);
  return step.imports <= 0 || step.price <= 0 ? 0 : step.price * step.imports * powerDemand(s);
};

/**
 * What a goods agreement costs to keep, per second.
 *
 * A share of the ledger rather than a flat fee, for the reason `civicPayroll`
 * is: a flat fee is a decision for the first hour and a rounding error after
 * it. Indexed to the same yardstick the wage bill is, so a treaty is worth the
 * same fraction of a village's income as of a metropolis's.
 */
export const tradeUpkeep = (s: GameState): number =>
  goodsTraded(s) ? GOODS_TRADE_UPKEEP * ledgerScale(s) * housingPlots(s) : 0;

// -------------------------------------------------------------------- demand

/**
 * The outside world's appetite for what the city makes — the tap that gets the
 * cycle turning when every counter is still zero.
 */
export const exportMarket = (s: GameState): number =>
  (EXPORT_BASE + EXPORT_PER_DISTRICT * (s.districts - 1)) *
  // The cargo berths lift the tap rather than opening a second one beside it,
  // so there is still one number the outside world's appetite is made of and
  // one place to look when industrial demand is wrong. See CARGO_EXPORT_LIFT.
  //
  // Air freight is the second lift and it *adds* inside the same bracket rather
  // than multiplying it. That is what keeps it from double-counting against a
  // cargo terminal: a city with both has one tap raised twice, not two taps for
  // the same goods — and a multiplicative form would have made the airport worth
  // most to the city that least needs it. See AIRPORT_EXPORT_LIFT.
  //
  // The goods agreement is the third, and it adds in the same bracket for the
  // same reason: it is a treaty about the goods the berths and the runway carry
  // rather than a fourth kind of goods. See GOODS_TRADE_LIFT.
  (1 +
    CARGO_EXPORT_LIFT * s.cargoTerminals +
    (s.airport ? AIRPORT_EXPORT_LIFT : 0) +
    (goodsTraded(s) ? GOODS_TRADE_LIFT : 0) +
    // The freight line is the fourth, and adds in the same bracket for the same
    // reason the airport does: it is a way of shifting the goods the city
    // already makes, not a fourth kind of goods. See NETWORK_EXPORT_LIFT.
    NETWORK_EXPORT_LIFT * networkService(s));

export const jobs = (s: GameState): number =>
  openOf(s, 'shop', SHOP_JOBS) +
  openOf(s, 'industry', INDUSTRY_JOBS) +
  // The estates employ people too, and they are the one employer the city has
  // that stands on land it does not own — so they are added here rather than
  // folded into the industrial cohort, which is what the plot totals and the
  // annexation gate are counted from.
  estateJobs(s);

/**
 * The imbalance that counts as "saturated", at the city's current level mix
 * *and* at its current size.
 *
 * DEMAND_SCALE on its own is a constant, and a constant could only ever be
 * right at one level: residents span 4 to 1,200 a plot, so a scale set for
 * detached housing pins every signal the moment the city has towers in it —
 * which is exactly what the old build did, for about 21 hours of any 24 spent
 * playing it, and what its own comment said could only be fixed by dividing by
 * a size term rather than a constant. `cityScale` is that size term. It
 * measures the imbalance in level-0 buildings, so a district out of balance
 * reads the same whatever is standing on it — and the arc survives it, because
 * workers climb with a plot's capacity and jobs climb with its square root.
 *
 * It is the wrong *kind* of size term on its own, and that was the bug that
 * made the demand panel unreadable past the first few districts. Every quantity
 * this divides is a city-wide total: `jobs` walks the whole commercial and
 * industrial stock, `reachableWorkers` the whole population, `openOf` every shop
 * in every district. All of them grow with the city. `DEMAND_SCALE * cityScale`
 * does not — it is one district's labour pool whether the city has one district
 * or forty-nine — so the signal measured an absolute imbalance against a fixed
 * yardstick, and an absolute imbalance grows with the city by construction.
 *
 * Measured, on land split at FRONTAGE_TARGET's own ratio and built out
 * uniformly at megastructures — a city in perfect proportion at every size,
 * differing only in how much of it there is:
 *
 *   districts   R plots     jobs     workers    scale       R       C       I
 *           1        24      584      15,840   90,000  -0.295  -0.070  -0.067
 *           3        72    1,826      47,520   90,000  -0.633  -0.046  -0.009
 *           5       120    3,068      79,200   90,000  -0.971  -0.010  +0.048
 *           8       192    4,968     126,720   90,000  -1.000  +0.047  +0.130
 *          12       288    7,452     190,080   90,000  -1.000  +0.111  +0.245
 *          49     1,176   30,392     776,160   90,000  -1.000  +0.790  +1.000
 *
 * The scale column is the finding. Nothing about that city's *proportions*
 * changes down the table and every signal diverges anyway: residential pins at
 * the floor by the eighth district with forty-one still to annex, and industry
 * reaches the ceiling by the last. A player reading the demand panel in a
 * twelve-district city was reading their district count. It is also what the
 * screenshots that opened this pass show — thirteen districts, R -97%, C +43%,
 * I +49% — and what ZONE_SHARE's comment recorded as 990 pinned minutes of
 * 1,440 and blamed on the land supply. The land was not the problem: that city
 * held 2.40 commercial plots per housing plot against the 1.88 its own frontage
 * calls for, so it was over-supplied with commerce and still read C +1.
 *
 * So the yardstick has to grow with the city, and `population` is the one to
 * grow it by: every term here is ultimately a count of people or of what people
 * do — workers, shoppers, trips — so the imbalance that saturates a signal is
 * one whole city's worth of them. A signal now reads the city's *proportions*,
 * which is what a demand panel is for, and every row of that table collapses
 * onto the first.
 *
 * The `max` is the floor, and it is what keeps the opening exactly where it was.
 * The two arms cross at 75 housing plots — three districts' residential
 * frontage — so every reading the opening minute was calibrated against, RENT
 * and HOME_BASE and the ten-minute commercial surcharge among them, is taken on
 * the left arm and cannot move. Without it a two-house city would divide by
 * eight people and read every signal pinned, which is this same bug standing on
 * its head. Measured, the anchor is also where the band wants to be: at a floor
 * of one district a settled city reads R +0.10 / C +0.28 / I +0.11 and doubling
 * its commerce moves residential demand by 0.03, which is a mechanic the player
 * cannot feel; at five districts' worth the first five districts drift by 0.22
 * before the term engages. Three is where both stop being true.
 *
 * `population` rather than `residents`, so the yardstick is the housing the city
 * has *built* rather than the people currently in it. A scale that shrank as a
 * city emptied would amplify every signal exactly when the city could least
 * answer it, which is the shape of a death spiral rather than of a measurement.
 *
 * `unemployment` divides by this too, and had the same bug for the same reason:
 * a twelve-district city read 86% of its workforce idle where the same city one
 * district wide read 13%.
 */
export const demandScale = (s: GameState): number =>
  Math.max(DEMAND_SCALE * cityScale(s), population(s));

export const workers = (s: GameState): number => residents(s) * WORKING_SHARE;

/**
 * Workers an employer can actually hire: the labour force, plus the reach a
 * transit network adds to it.
 *
 * The demand-side half of what a depot buys. A resident two districts from the
 * nearest works is not labour that works can draw on, and a network is what
 * turns them into it — so a covered city has up to a quarter more workers
 * available than its population alone accounts for (TRANSIT_WORKFORCE).
 */
export const reachableWorkers = (s: GameState): number =>
  workers(s) *
  (1 +
    TRANSIT_WORKFORCE * transitCoverage(s) +
    // The network's own labour term, and it is 0. Two channels through one set
    // of vehicles is one thing counted twice, and the measurement that decides
    // it is in tools/phase7.calibrate.mjs — see NETWORK_WORKFORCE, which
    // carries the reading and the reason.
    NETWORK_WORKFORCE * networkService(s));

/**
 * Spare labour the network can deliver to a new employer.
 *
 * The term transport feeds into the cycle, and it is deliberately on the
 * commercial and industrial side rather than on income: a district with people
 * in it and nowhere for them to work is an argument for premises, and a bus
 * route is what makes that argument reach. Zero for a job-rich city — a young
 * one has no spare labour — and zero with no depots, so it turns on exactly
 * when the two conditions that justify it are both true.
 *
 * Multiplied by the coverage as well as counted through it, because the network
 * has to reach the *employer* too, not only the worker.
 */
export const labourReach = (s: GameState): number =>
  Math.max(0, reachableWorkers(s) - jobs(s)) * transitCoverage(s) * TRANSIT_LABOUR_DRAW;

// -------------------------------------------------------------------- zoning

/**
 * The district the surveyor works on: the newest one.
 *
 * Every district but this one is frozen. That is not a rule about surveying so
 * much as a rule about lists: a zone's plots are the districts concatenated, so
 * a list may only grow at its end, and the frontier's segment is the end.
 * Rezoning district 0 under a city of twelve would insert plots before district
 * 1's and shift every home past them onto different ground.
 *
 * What it buys is worth more than what it costs: a district's split is written
 * while it is the frontier and fixed when the next arrives, so the zoning map
 * ends up a record of what the city wanted when each district was new.
 */
export const frontierDistrict = (s: GameState): number => Math.max(0, s.districts - 1);

/** How full a zone is, against the land it currently holds. What `SURVEY_FILL` reads. */
export const zoneFill = (s: GameState, kind: ZoneKind): number => {
  const capacity = capacityOf(s, kind);
  if (capacity <= 0) return 1;
  return plotsOf(s, kind) / capacity;
};

/**
 * Whether the surveyor will zone one more parcel to a zone, right now.
 *
 * A predicate on the state, checked every tick like `autoAnnex`, rather than a
 * periodic pass — and that is what closes the stall the derived price curve
 * would otherwise open. With a clock there is always something to wait for: a
 * survey lowers the price of the next building, so a player who stops building
 * for twenty seconds is paid for it. With no clock the survey lands on the same
 * tick as the purchase that earned it and there is no interval to sit out.
 *
 * Three conditions, and the middle one is the load-bearing one:
 *
 *   - the city has to actually want the type, past SURVEY_DEMAND rather than
 *     merely above zero, so a city drifting near balance does not slowly rezone
 *     itself into whatever it last happened to want;
 *   - the zone has to be *built out* past SURVEY_FILL. One survey then takes it
 *     from `n / A` to `n / (A + 1)`, which is under the gate, so the gate shuts
 *     itself and reopens only when the player builds again. A stall therefore
 *     harvests exactly one parcel of price and no more, whatever it waits;
 *   - and there has to be land. Residential and commercial share one pool from
 *     opposite ends, so what bounds them is their two counts together.
 */
export const willSurvey = (s: GameState, kind: ZoneKind): boolean => {
  if (s.districts <= 0) return false;
  if (demandOf(s, kind) < SURVEY_DEMAND) return false;
  if (zoneFill(s, kind) < SURVEY_FILL) return false;
  const at = frontierDistrict(s);
  return kind === 'industry' ? worksSpare(s, at) > 0 : sharedSpare(s, at) > 0;
};

/**
 * Whether the surveyor will take a parcel *back* from a zone, right now.
 *
 * The other half, and the half that lets a split invert rather than ratchet. A
 * zone that only ever gains land can only move toward whatever the city wanted
 * first, and the freeze would then make that permanent — so a district that
 * spent its opening hour zoning commerce could never become a housing district
 * however hard the demand argued. Releasing is what makes "the split can invert"
 * true rather than aspirational.
 *
 * Three conditions, and the third is what keeps it safe:
 *
 *   - the city has to be *oversupplied* past SURVEY_DEMAND, symmetrically with
 *     surveying, so land does not slosh back and forth around zero;
 *   - the zone has to be above its floor. ZONE_FLOOR is the stop: no amount of
 *     sustained negative demand zones a type out of a district, because a
 *     district with nowhere to live can never recover the demand that would fix
 *     it;
 *   - and the parcel being given up has to be **empty**. Buildings fill a zone
 *     from the front and the frontier district's parcels are the back of the
 *     list, so the last parcel is the last thing built on — releasing it while
 *     something stands there would take the ground out from under a building.
 *     This is the condition that makes releasing safe at all.
 *
 * What it releases goes back to the shared pool for the other zone to take, and
 * the parcel keeps its identity: residential's k-th parcel is the k-th of the
 * pool whether it has been given up and taken back once or never. So a plot
 * released and re-zoned is the same plot, not a new one.
 */
export const willRelease = (s: GameState, kind: ZoneKind): boolean => {
  if (s.districts <= 0) return false;
  if (demandOf(s, kind) > -SURVEY_DEMAND) return false;
  return canGiveUp(s, kind);
};

/**
 * What a district's split would be if it were zoned to the city's own
 * equilibrium, in pool parcels.
 *
 * ZONE_SHARE solves the tier-0 job/worker balance at R 0.48 / C 0.31 / I 0.21,
 * and laid over the plots residential and commerce actually contest that is
 * about 42 housing plots against 27 of commerce. Worth saying plainly because it
 * is the answer to a question this whole cycle started from: the budget the game
 * already solves wants *more housing than commerce*, and the 24-against-45 a
 * district used to sell was inverted against it — the split was solved on zoned
 * land and then decided by which of it happened to front a street.
 *
 * What reads this is `annexZoning`, and only for the half-step: a new district
 * opens halfway between what the city has been choosing and this, so a run's
 * character carries forward without locking itself in. Inheriting outright would
 * be a feedback loop — the first hour's zoning would decide the fortieth
 * district's — and starting at neutral would throw the choice away every time.
 */
export const neutralZoning = (index: number): DistrictZoning => {
  const land = districtLand(index);
  const share = ZONE_SHARE.residential / (ZONE_SHARE.residential + ZONE_SHARE.commercial);
  const home = Math.round(land.limits.shared * share);
  return {
    home,
    shop: land.limits.shared - home,
    // Industry takes its whole reserve, because ZONE_SHARE would ask for more
    // than the reserve holds: 0.21 of 82 plots is 17, and INDUSTRY_RESERVE caps
    // it at 13. So "neutral" for industry is simply all of it, which is also
    // exactly what a district sold before zoning floated.
    industry: land.limits.works,
  };
};

/**
 * The two zones that contest the shared pool, in the order they read it.
 *
 * Industry is not one of them and cannot be — see INDUSTRY_RESERVE for the
 * contradiction three claimants on one pool run into.
 */
const POOL_ZONES: readonly ZoneKind[] = ['home', 'shop'];

export interface Transfer {
  readonly to: ZoneKind;
  readonly from: ZoneKind;
}

/**
 * Whether one pool zone should take a parcel off the other, right now.
 *
 * The rule a *shared* pool actually needs, and the one absolute thresholds
 * cannot express. A district opens with its whole pool allocated, so "housing is
 * short" is not on its own a thing the surveyor can act on — there is no spare
 * land to zone, only commercial land to take. Waiting for commerce to go
 * genuinely oversupplied before housing may grow means the split moves on the
 * rare tick when one zone is short *and* the other is in surplus, and mostly
 * sits still: measured over 24 hours, two opposite play patterns ended 29.3R /
 * 38.7C and 31.8R / 36.3C a district, which is a difference nobody would notice.
 *
 * So the pool goes to whichever zone wants it more, by a margin. Three
 * conditions, and they are the same three surveying has:
 *
 *   - the *gap* between the two signals has to clear SURVEY_DEMAND, not each
 *     signal separately. That is what makes it a contest rather than two
 *     independent appetites;
 *   - the zone gaining has to be built out past SURVEY_FILL, so the gate still
 *     shuts behind every move and a stall is still worth exactly one parcel;
 *   - and the zone losing has to have an empty parcel at the end of its run.
 *     Buildings fill from the front and the frontier's parcels are the back of
 *     the list, so this is the condition that keeps a transfer from taking the
 *     ground out from under a building.
 *
 * Floors bound it on the losing side exactly as they bound a release.
 */
export const willTransfer = (s: GameState): Transfer | null => {
  if (s.districts <= 0) return null;
  for (const to of POOL_ZONES) {
    const from = to === 'home' ? 'shop' : 'home';
    if (demandOf(s, to) - demandOf(s, from) < SURVEY_DEMAND) continue;
    if (zoneFill(s, to) < SURVEY_FILL) continue;
    // Spare pool is taken first and needs no victim — `willSurvey` has already
    // had its turn by the time this runs, so reaching here means there is none.
    if (canGiveUp(s, from)) return { to, from };
  }
  return null;
};

/** Whether a zone's last parcel is above its floor and has nothing on it. */
const canGiveUp = (s: GameState, kind: ZoneKind): boolean => {
  const at = frontierDistrict(s);
  const zoning = zoningAt(s, at);
  const taken = kind === 'home' ? zoning.home : kind === 'shop' ? zoning.shop : zoning.industry;
  if (taken <= 0) return false;
  const land = districtLand(at);
  const table =
    kind === 'industry' ? land.worksFront
    : kind === 'shop' ? land.sharedBack
    : land.sharedFront;
  const size = (table[taken] as number) - (table[taken - 1] as number);
  return plotsOf(s, kind) <= capacityOf(s, kind) - size;
};

/**
 * The zoning a district opens on: halfway between the city's own and neutral.
 *
 * Halfway rather than inherited, and the difference is what keeps a run from
 * deciding itself in its first hour. A city that has been surveying commerce
 * hard opens its next district leaning commercial — the character carries — but
 * pulled a step back toward ZONE_SHARE's equilibrium, so the next district's
 * surveyor has room to disagree with the last one's. Inheriting outright is a
 * feedback loop; opening at neutral throws the choice away on every expansion.
 *
 * The city's own split is read as a mean over the districts it already holds, in
 * parcels rather than plots so the two sides of the average are the same unit.
 */
export const annexZoning = (s: GameState): DistrictZoning => {
  const index = s.districts;
  const neutral = neutralZoning(index);
  if (s.districts <= 0) return neutral;
  let home = 0;
  let shop = 0;
  let industry = 0;
  for (let i = 0; i < s.districts; i++) {
    const at = zoningAt(s, i);
    home += at.home;
    shop += at.shop;
    industry += at.industry;
  }
  const limits = districtLand(index).limits;
  const half = (mine: number, theirs: number, cap: number): number =>
    Math.max(0, Math.min(cap, Math.round((mine / s.districts + theirs) / 2)));
  const openHome = half(home, neutral.home, limits.shared);
  return {
    home: openHome,
    shop: half(shop, neutral.shop, limits.shared - openHome),
    industry: half(industry, neutral.industry, limits.works),
  };
};

/**
 * The split a district opens on when the city has never zoned anything: the one
 * every district sold before zoning floated.
 *
 * A fresh city therefore opens on exactly the land it opened on before any of
 * this existed — 24 housing, 45 commercial, 13 industrial — which is what keeps
 * the opening minute, `RENT`, `HOME_BASE` and every pacing guard meaning what
 * they meant. What changed is that it is now a *starting point* rather than a
 * constant: the surveyor moves it both ways from here.
 *
 * Opening at the floors was built first and is a soft-lock. A district zoned
 * 8 / 8 / 4 fills in a couple of minutes and then sits there: residential demand
 * reads -0.28 with eight homes up and no services, commerce is deeply
 * oversupplied at eight shops against thirty residents, and industry reaches
 * +0.09 against a SURVEY_DEMAND of 0.35. Nothing clears the gate, so nothing is
 * ever zoned, so the city stops at twenty plots with no way out.
 */
export const defaultZoning = (index: number): DistrictZoning => openZoning(index);

export interface DemandTargets {
  readonly r: number;
  readonly c: number;
  readonly i: number;
}

/** The hospital entry, looked up once. See TRANSIT for the pattern; POLICE is
 *  already exported above, because `crime` reads it. */
const HOSPITAL = SERVICES.find((service) => service.key === 'hospital');

/**
 * What one DEMAND_TERMS entry is reading, in [0, 1] for a coverage and
 * [-1, 1] for the tax pressure.
 *
 * Every one of these already exists and is already read somewhere else — that
 * is the point of the table. A service term this could not answer would be a
 * coverage the happiness panel could not name either.
 */
const demandReading = (s: GameState, key: DemandTerm['key']): number =>
  key === 'police' ? (POLICE ? coverage(s, POLICE) : 0)
  : key === 'hospital' ? (HOSPITAL ? coverage(s, HOSPITAL) : 0)
  : key === 'recreation' ? recreationCoverage(s)
  : key === 'transit' ? transitCoverage(s)
  : key === 'landmark' ? landmarkCoverage(s)
  : key === 'education' ? educationCoverage(s)
  : key === 'rival' ? rivalStrength(s)
  : taxPressure(s);

/** What one term contributes to its zone's target, signed. */
const demandTermValue = (s: GameState, term: DemandTerm): number =>
  term.weight * (term.centred ? demandReading(s, term.key) - 0.5 : demandReading(s, term.key));

/**
 * What the table adds to one zone's demand target: services, the tax rate, and
 * the city next door.
 *
 * Zero — every term, all three zones — while the city has no housing, and that
 * gate is the whole of what keeps the opening where it was. `coverage` reads 1
 * against no housing because it is the share a service *fails* and it fails
 * nothing when nothing is built; so an ungated table would hand a fresh save
 * +0.225 of residential demand on its first tick, and the bootstrap off the
 * export tap that the opening minute is built on would be gone. It is the same
 * special case `coverage` itself carries, one level up.
 *
 * A sum rather than a walk over objects, because `demandTargets` runs ten times
 * a second and this is called three times inside it. `demandTerms` is the
 * allocating form and it is the HUD's, not the simulation's.
 */
export const demandLift = (s: GameState, kind: ZoneKind): number => {
  if (housingPlots(s) <= 0) return 0;
  let sum = 0;
  for (const term of DEMAND_TERMS) {
    if (term.zone === kind) sum += demandTermValue(s, term);
  }
  return sum;
};

export interface DemandTermReading {
  readonly term: DemandTerm;
  /** What the term is reading, before its weight. */
  readonly reading: number;
  /** What it is contributing to the target, signed. */
  readonly value: number;
}

/**
 * The whole demand breakdown, in one read, for the HUD.
 *
 * The reason this exists rather than three numbers: a signal that moves because
 * a museum opened and a signal that moves because the tax rate went punitive
 * look identical on a bar, and the mechanic is only worth having if the player
 * can see which one it was. Same shape and same job as `happinessTerms`, which
 * names the term binding happiness for exactly the same reason.
 *
 * Empty while the city has no housing, matching `demandLift` — a panel showing
 * seven terms all reading zero would be worse than showing none.
 */
export const demandTerms = (s: GameState, kind: ZoneKind): readonly DemandTermReading[] => {
  if (housingPlots(s) <= 0) return [];
  return DEMAND_TERMS.filter((term) => term.zone === kind).map((term) => ({
    term,
    reading: demandReading(s, term.key),
    value: demandTermValue(s, term),
  }));
};

/**
 * Where each demand signal is heading, right now.
 *
 * The three form a cycle — industry makes jobs, jobs bring residents, residents
 * become shoppers, shops want commerce, commerce makes jobs — so the order the
 * player builds in is what decides which button is cheap next. Nothing here is
 * integrated; `Game.step` does that, because integration is mutation.
 *
 * Residential is additionally capped by happiness. A city with no hospital
 * cannot want more people however many jobs it has going spare, and that is the
 * whole tutorial: the demand bar flatlines, the discount never arrives, and the
 * services block says why.
 */
export const demandTargets = (s: GameState): DemandTargets => {
  const scale = demandScale(s);
  // The service terms are added *inside* clampDemand and on the target, never on
  // the integrated signal: `Game.step` stays the only thing that integrates, and
  // the bounds stay the bounds they always were. See DEMAND_TERMS.
  return {
    // Against the workers an employer can reach rather than the raw labour
    // force: a network that has already put people within reach of a job has
    // met some of the demand another house would have met.
    //
    // The happiness ceiling survives the new terms, and has to: a city with no
    // hospital cannot want more people however covered it is in police, and that
    // is the tutorial. Services now push at the target from underneath as well,
    // which is the change — but they can never lift it past what mood allows.
    r: Math.min(
      s.happiness,
      clampDemand((jobs(s) - reachableWorkers(s)) / scale + demandLift(s, 'home')),
    ),
    // The rival arrives through `demandLift` with everything else — it is two
    // DEMAND_TERMS rows, not a special case. Housing has no rival row: a rival
    // competes for trade, and people live where they work.
    c: clampDemand(
      (residents(s) * SPEND_PER_RESIDENT +
        // Visitors shop, and that is the whole of how tourism reaches the
        // ledger now: not as a line of its own — one outside the income
        // bracket is 0.0003% of a mature city's ledger — but as demand for
        // premises, which reaches income through SHOP_BONUS exactly as every
        // resident's spending does. See VISITOR_TRIPS.
        visitors(s) * VISITOR_TRIPS -
        openOf(s, 'shop', SHOP_TRIPS) +
        labourReach(s)) /
        scale +
        demandLift(s, 'shop'),
    ),
    i: clampDemand(
      (openOf(s, 'shop', SHOP_SUPPLY) +
        exportMarket(s) -
        openOf(s, 'industry', INDUSTRY_OUTPUT) -
        estateSupply(s) +
        labourReach(s)) /
        scale +
        demandLift(s, 'industry'),
    ),
  };
};

/**
 * Fraction of the gap to close over `dt` seconds.
 *
 * Exponential, not linear. `d += (target - d) * dt / TAU` overshoots the moment
 * dt approaches TAU and diverges past it, and catch-up steps whole minutes at a
 * time against a 25-second constant. This form saturates at 1 for any step size,
 * which is the only reason offline progress is safe to run coarsely.
 */
export const demandStep = (dt: number): number => 1 - Math.exp(-Math.max(0, dt) / DEMAND_TAU);

// ------------------------------------------------------------------- pricing

/**
 * What demand does to a price: a discount when the city wants the type, a
 * surcharge when it is already oversupplied.
 *
 * The input is clamped rather than trusted, so a doctored save carrying
 * `demandR: 50` buys nothing cheaper than a legitimate one at full demand.
 */
export const priceModifier = (d: number): number => {
  const bounded = clampDemand(d);
  return bounded >= 0 ? 1 - PRICE_DISCOUNT_MAX * bounded : 1 + PRICE_SURCHARGE_MAX * -bounded;
};

/**
 * Prices compound over *plots taken*, not buildings owned.
 *
 * Identical to the old curve for a city that has never merged, and it has to be
 * — every constant in this file was calibrated against "what filling a
 * district's 24 plots costs". Compounding over the building count instead would
 * make every merge a discount on the next purchase: two houses become one, the
 * exponent drops by one, and a city that had consumed exactly as much land as
 * before would find housing cheaper for having grown.
 */
/**
 * What filling one district's whole allotment of a zone multiplies its price by.
 *
 * The curve's anchor, and the two zones that contest the shared pool share it:
 * 23.2 for a district of housing and 23.2 for a district of commerce, so what
 * the surveyor decides is how much land each gets rather than what a plot on it
 * costs. They used to read 23.2 against 363.7, which is a 16x charge on
 * commerce for being the wider frontage and the reason a built city could never
 * answer its own commercial demand — see DISTRICT_FILL_MULTIPLE, which is where
 * that number now comes from.
 *
 * Industry keeps its own, `1.14 ** 13` or 5.5. It draws on a reserve rather
 * than the pool, so its allotment cannot grow and its multiple cannot run away.
 */
export const ZONE_FILL_MULTIPLE = {
  home: DISTRICT_FILL_MULTIPLE,
  shop: DISTRICT_FILL_MULTIPLE,
  industry: INDUSTRY_GROWTH ** FRONTAGE_TARGET.industrial,
} as const;

/**
 * How many districts' worth of a zone the city has filled, as a real number.
 *
 * The exponent the cost curve now compounds over, and the whole of what
 * "derived from the allotment" means: each district contributes the *share* of
 * its own allotment that is built on, so filling any district multiplies the
 * price by `ZONE_FILL_MULTIPLE` whatever that district's allotment happens to
 * be. A district zoned 22 commercial plots and one zoned 52 cost the same amount
 * to fill; what differs is how much land you got for it.
 *
 * Per district rather than city-wide, and that is what makes annexation
 * price-neutral. A new district appends a term whose numerator is zero, so
 * nothing already priced can move — where a city-wide allotment would have made
 * every existing plot's price jump the moment the average changed. Measured on
 * the city-wide form: a commerce-led city annexing at halfway-to-neutral paid
 * x2.42 on its next shop and a housing-led one got a x0.02 windfall, which is a
 * 98% discount for starving commerce and then expanding.
 *
 * At the split every district sold before this existed, every allotment is the
 * old constant and this is exactly `plots / 24`, `plots / 45`, `plots / 13`. So
 * the curve is `BASE * 1.14 ** n` to the last digit and no constant in this file
 * had to move.
 *
 * Summed in one pass and exponentiated once, because a `Math.pow` per district
 * on the tick path is a microsecond a call and auto-development calls it
 * twenty-odd times a tick.
 */
export const zoneFillMultiples = (s: GameState, kind: ZoneKind): number => {
  let taken = plotsOf(s, kind);
  if (taken <= 0) return 0;
  const zone = zoneOf(kind);
  let districts = 0;
  for (let i = 0; i < s.districts && taken > 0; i++) {
    const allotment = districtZonePlots(s, i, zone);
    if (allotment <= 0) continue;
    const here = Math.min(taken, allotment);
    districts += here / allotment;
    taken -= here;
  }
  // Land the city has built on and since rezoned away from — the surveyor can
  // release a parcel only when it is empty, so this is bounded by a doctored
  // save rather than by play. Charged at the last district's rate so the curve
  // stays strictly increasing in plots taken.
  if (taken > 0) districts += taken / Math.max(1, SELLABLE_PER_DISTRICT);
  return districts;
};

/** The compounded part of a zone's price, before demand touches it. */
const compoundedCost = (s: GameState, kind: ZoneKind, base: number): number =>
  base * Math.exp(Math.log(ZONE_FILL_MULTIPLE[kind]) * zoneFillMultiples(s, kind));

export const homeCost = (s: GameState): number =>
  compoundedCost(s, 'home', HOME_BASE) * priceModifier(s.demandR);
export const shopCost = (s: GameState): number =>
  compoundedCost(s, 'shop', SHOP_BASE) * priceModifier(s.demandC);
export const industryCost = (s: GameState): number =>
  compoundedCost(s, 'industry', INDUSTRY_BASE) * priceModifier(s.demandI);

/**
 * Parks are not demand-priced either, and earn nothing at all. What they buy is
 * the recreation term, which is 18% of happiness, which multiplies every penny
 * the city does earn.
 */
export const parkCost = (s: GameState): number => PARK_BASE * PARK_GROWTH ** s.parks;

/**
 * What the next landmark of a type costs.
 *
 * Compounded over the type's own count, like every other civic curve, and
 * deliberately *not* demand-modified: a landmark is not a zone and there is no
 * signal that says the city wants another one.
 */
export const landmarkCost = (s: GameState, landmark: Landmark): number =>
  landmark.base * landmark.growth ** landmarkCount(s, landmark.key);

export const terminalCost = (s: GameState, terminal: Terminal): number =>
  terminal.base * terminal.growth ** terminalCount(s, terminal.key);

/** Services are not demand-priced: nobody haggles over a hospital. */
export const serviceCost = (s: GameState, service: Service): number =>
  service.base * service.growth ** serviceCount(s, service.key);

export const annexCost = (s: GameState): number => ANNEX_BASE * ANNEX_GROWTH ** (s.districts - 1);

// -------------------------------------------------------------------- income

// -------------------------------------------------------------- land value

/**
 * What one housing plot's centrality does to its rent.
 *
 * The game's first spatially varying input, and the shape of it is the whole
 * design. `citygen` scores each block 1 at its district's middle and 0 at its
 * furthest corner; a plot inherits its block's score; and rent is multiplied by
 * `1 + LAND_VALUE_SPREAD x (score - the city's mean score)`. Centred on the
 * mean rather than on a constant, so the factor redistributes rent across the
 * build order and adds none — see LAND_VALUE_SPREAD for why that matters more
 * than the spread itself does.
 *
 * Floored at zero. The spread is a constant rather than save data so it cannot
 * arrive out of range, but a multiplier that could go negative is a rent that
 * could go negative, and that is worth one comparison to rule out for good.
 */
const valueOf = (score: number, base: number): number =>
  Math.max(0, 1 + LAND_VALUE_SPREAD * (score - base));

/**
 * The city's rent multiplier: the mean land value over the housing it has built.
 *
 * A cohort-level mean, not a per-building modifier, and that is the line this
 * feature deliberately does not cross. `LevelCohort` in state.ts says
 * per-instance state earns its cost the moment a spatially varying input
 * arrives; this is that input, and it still does not, because the k-th home's
 * plot is a pure function of its ordinal and the seed and so the mean over the
 * first n of them is a pure function of counts. The door is ajar rather than
 * open: what would push it the rest of the way is an input that varies per
 * building *and* cannot be summarised — a per-building age, a per-building
 * tenant, anything the city cannot recompute from `{ homes, mergedR }`.
 *
 * One for a city with no housing, so the opening is unaffected by a term about
 * where housing is.
 *
 * O(1). `income` runs ten times a second and this is two prefix-table reads —
 * see `LandValue` in layout.ts, which is why it is not a memo.
 */
export const landValue = (s: GameState): number => {
  const plots = plotsOf(s, 'home');
  if (plots <= 0) return 1;
  return valueOf(
    housingCentralityMean(plots, s),
    housingCentralityBase(s),
  );
};

/**
 * What one parcel's land is worth, for the inspector.
 *
 * The number that genuinely differs between two identical houses now, which is
 * why `buildingIncome` takes a plot at all. Averaged over the parcel rather than
 * read off its first plot: a merged tower stands on two, and they can sit in
 * different blocks.
 */
export const parcelLandValue = (s: GameState, plot: number, plots = 1): number => {
  const span = Math.max(1, Math.floor(plots));
  let score = 0;
  for (let i = 0; i < span; i++) score += housingCentrality(plot + i, s);
  return valueOf(score / span, housingCentralityBase(s));
};

/**
 * What the city's premises add to every plot of housing it owns.
 *
 * One expression rather than two, because `income` and `ledgerScale` both need
 * it and a copy in each is a copy that drifts. What varies between them is the
 * arguments: `income` passes the burning share taken off, and `ledgerScale`
 * deliberately does not — a fire furloughs nobody.
 */
const bonuses = (shops: number, industry: number, districts: number): number =>
  1 + SHOP_BONUS * shops + INDUSTRY_BONUS * industry + DISTRICT_BONUS * (districts - 1);

/**
 * Cash per second, with everything currently on fire earning nothing.
 *
 * A burning home houses nobody who pays rent and a burning shop trades with
 * nobody, so both come out of the ledger for as long as they are alight — which
 * is what makes a slow fire service cost money rather than just look bad. The
 * subtraction is floored: a doctored save cannot burn more buildings than the
 * city owns and turn income negative.
 */
export const income = (s: GameState): number => {
  const people = residents(s) * (1 - alight(s, 'home'));
  const shops = effectiveOf(s, 'shop') * (1 - alight(s, 'shop'));
  // The estates are not in the cohort and cannot catch fire — they are outside
  // the city and outside the fire model — so they are added after the burning
  // share comes off rather than before it.
  // The skill multiplies the industrial term and nothing else. It reaches the
  // estates too, and that is a decision rather than an oversight: the estates
  // *are* the city's industry — `estateEarning` already multiplies by
  // `industryScale`, the mean level weight of city industry, because they are
  // the same firms with a road between them — so a workforce that has been to
  // school is the same workforce out past the highway. Excluding them would
  // mean an educated city's industry got better everywhere except where it had
  // most recently expanded, which is the opposite of the intended shape.
  const industry =
    (effectiveOf(s, 'industry') * (1 - alight(s, 'industry')) + estateEarning(s)) *
    workforceSkill(s);
  return (
    (people *
      RENT *
      // Where the housing is, not just how much of it there is. A mean over the
      // plots the city has built, normalised so a built-out city earns exactly
      // what flat rent earned — see `landValue`. Inside the rent bracket and
      // nowhere else: fares are paid by riders and tourism by visitors, and
      // neither of them cares which street the payer lives on.
      landValue(s) *
      bonuses(shops, industry, s.districts) *
      incomeMultiplier(s) +
      // Fares. Outside the bracket above rather than inside it, because they
      // are not rent: a fare does not scale with the shop multiplier or the
      // district bonus, and it is taken from the people on the buses rather
      // than from the people in the houses. It *is* taxed, like everything else
      // the city takes in.
      fareIncome(s) +
      // Tourism, outside the bracket for the same reason and carrying its own
      // happiness term — see `visitors`, where the mood is a multiplier rather
      // than the floor `incomeMultiplier` applies to rent.
      cruiseIncome(s) +
      // And what the grid sells. Outside the bracket for the same reason fares
      // are: a unit of surplus power is not rent, so it does not scale with the
      // shop multiplier or the district bonus. It *is* taxed, like everything
      // else the city takes in. Zero unless the export agreement is on and the
      // city's own plants are making more than it draws — see `powerSurplus`.
      powerTradeIncome(s)) *
    // The tax rate multiplies the whole ledger, which is why the happiness it
    // costs is worth more than it looks: happiness multiplies this same line
    // through `incomeMultiplier`, so the two terms compound against each other.
    taxStep(s).income *
    // And what the cities before this one left behind. Out here with the tax
    // rate rather than inside `bonuses`, because it is a property of the
    // player's history rather than of this city's buildings — see
    // `legacyMultiplier`. Exactly 1 on a first founding, so every constant in
    // this file keeps the meaning it was measured with.
    legacyMultiplier(s)
  );
};

// -------------------------------------------------------------------- power

/**
 * What one *building* draws at each level, in level-0 plots.
 *
 * The footprint times the level's own capacity ratio raised to POWER_EXPONENT.
 * The footprint is there for the reason SHOP_JOBS carries it — a merged building
 * stands on two plots and draws for both — and the exponent puts it among the
 * sub-linear ladders rather than beside the flat ones: JOBS_LADDER climbs at
 * 0.5 and TRADE_LADDER at 0.65, and this at POWER_EXPONENT. A taller plot draws
 * more, employs more and trades more, each at its own rate, and none of them as
 * fast as it houses.
 *
 * Derived from LEVEL_CAPACITY rather than typed, so the two can never drift.
 */
export const POWER_LADDER = LEVEL_CAPACITY.map(
  (capacity, l) =>
    (LEVEL_FOOTPRINT[l] ?? 1) *
    (capacity / (LEVEL_CAPACITY[0] ?? 1)) ** POWER_EXPONENT,
) as readonly number[];

/** What one zone's standing stock draws. Ruins hold no level and so draw nothing. */
const zoneDraw = (s: GameState, kind: ZoneKind, per: number): number =>
  cohortAgainst(levelsOf(s, kind), POWER_LADDER) * per;

/**
 * What the city draws, per second, in level-0 plots.
 *
 * Standing stock rather than occupied stock, and that is the load-bearing
 * choice: an empty house still draws its share because the grid is sized to the
 * building, and if draw fell with occupancy a brownout would cure itself and
 * there would be no decision in it. A *ruin* draws nothing, because it holds no
 * level and so appears in no cohort.
 *
 * The estates draw too. They are industrial plots on land the city does not own,
 * so they are added here rather than folded into the cohort — the same place and
 * for the same reason `estateJobs` is added to `jobs` — and they are built to the
 * standard of the city's own works, which is what `industryScale` says.
 */
export const powerDemand = (s: GameState): number =>
  zoneDraw(s, 'home', POWER_PER_PLOT.residential) +
  zoneDraw(s, 'shop', POWER_PER_PLOT.commercial) +
  zoneDraw(s, 'industry', POWER_PER_PLOT.industrial) +
  estatePlots(s) * POWER_PER_PLOT.industrial * industryScale(s) ** POWER_EXPONENT;

/**
 * What the city can make, per second.
 *
 * POWER_BASE is the grid it starts connected to and never loses — see that
 * constant for why a fresh city must not be short of a resource it has no way to
 * make yet. Plants are scaled by `cityScale` for the reason the estates are
 * scaled by `industryScale`: a plant has no level of its own to climb, so it is
 * built to the standard of the city around it.
 *
 * Staffing is a factor, so a plant that opened this instant is not carrying the
 * grid yet — the same ninety-second ramp every civic building has, and the same
 * thing an unpaid wage bill takes back.
 */
/**
 * What the city's own grid makes, per second: the base and its plants.
 *
 * Split out from `powerSupply` because the export agreement sells the *surplus*
 * and a city that bought a unit and sold it back would be a money printer. See
 * `powerSurplus`, which is the only caller that wants this rather than the
 * total.
 */
export const ownPowerSupply = (s: GameState): number =>
  POWER_BASE + s.plants * s.plantStaff * POWER_PER_PLANT * cityScale(s);

/**
 * Everything on the grid, per second: the city's own plants and whatever the
 * import agreement is buying in.
 *
 * The one `powerRatio` reads, so an imported unit browns the city out exactly
 * as a generated one does not — which is the whole of what the agreement buys.
 */
export const powerSupply = (s: GameState): number => ownPowerSupply(s) + powerImported(s);

/**
 * Supply over draw. Above 1 the city has power to spare.
 *
 * Derived, never integrated, and that is a decision rather than an omission:
 * occupancy already lags on a 120-second constant and demand on 25, so a third
 * lagged signal feeding the first would make the whole loop sluggish and
 * impossible to read. The ratio moves the instant a plant opens; what takes two
 * minutes to answer is the occupancy it caps.
 *
 * One for a city that draws nothing, so an empty map is not short of anything.
 */
export const powerRatio = (s: GameState): number => {
  const draw = powerDemand(s);
  if (draw <= 0) return 1;
  // The import inlined rather than read through `powerSupply`, because that
  // would ask `powerDemand` — a walk over three cohorts — for a second time on
  // a path `Game.step` runs ten times a second.
  const imports = s.powerTrade === POWER_TRADE_NEUTRAL ? 0 : powerTradeStep(s).imports * draw;
  return (ownPowerSupply(s) + imports) / draw;
};

/**
 * What a shortfall does to occupancy: a cap, proportional, with a floor.
 *
 * The whole shape of the feature. A browned-out city empties gradually and
 * visibly rather than flipping to zero income, so the failure is legible and
 * reversible — and POWER_FLOOR is what stops the loop having a fixed point at
 * nothing. See that constant for why 0.35 and not less: at OCCUPANCY_FULL it
 * lands at 0.322 against an OCCUPANCY_EMPTY of 0.25, so a blacked-out but happy
 * city loses its residents and keeps its buildings.
 */
export const powerCap = (s: GameState): number =>
  POWER_FLOOR + (1 - POWER_FLOOR) * Math.max(0, Math.min(1, powerRatio(s)));

/** Plant sites the city owns: one a district, and every one buildable. */
export const plantCapacity = (s: GameState): number =>
  s.districts * POWER_SITES_PER_DISTRICT;

export const plantCost = (s: GameState): number =>
  POWER_PLANT_BASE * POWER_PLANT_GROWTH ** s.plants;

export const canBuildPlant = (s: GameState): boolean =>
  s.plants < plantCapacity(s) && s.cash >= plantCost(s);

/** Why the plant button is off. Land is the only gate a plant has. */
export function plantBlocker(s: GameState): string | null {
  return s.plants >= plantCapacity(s) ? 'No sites left' : null;
}

// ---------------------------------------------------------------- city hall

/**
 * Whether the city has anybody to set policy.
 *
 * The one gate the city hall is, named once so that the three things it gates
 * read alike. `taxStep` falls back to TAX_NEUTRAL without it, `freeTransport`
 * to fares-on, and `Game.step` runs no auto-development — every one of which is
 * exactly what a fresh city already gets, so the opening is unchanged.
 */
export const hasPolicy = (s: GameState): boolean => s.cityHall;

/**
 * Whether free transport is actually in force.
 *
 * Read instead of `s.freeTransport` everywhere it matters — the depot's reach,
 * the fares, the mood — because the stored flag is the player's *choice* and
 * this is whether the city can act on it. Keeping the two apart is what lets a
 * v8 city's setting survive intact rather than being overwritten on load.
 */
export const faresWaived = (s: GameState): boolean => s.cityHall && s.freeTransport;

/** Flat: there is one city hall, so there is no n to compound over. */
export const cityHallCost = (): number => CITY_HALL_BASE;

export const canBuildCityHall = (s: GameState): boolean =>
  !s.cityHall && rankAllows(s, 'cityHall') && s.cash >= cityHallCost();

/** Why the city hall button is off. Built, too small a place, or money. */
export function cityHallBlocker(s: GameState): string | null {
  if (s.cityHall) return 'Built';
  return rankBlocker(s, 'cityHall');
}

/**
 * Why a policy control is off, phrased for the HUD.
 *
 * The same blocker-reason idiom every other disabled control in this HUD
 * follows: a string when the control is dead for a reason worth saying, null
 * when it is live.
 */
export function policyBlocker(s: GameState): string | null {
  return hasPolicy(s) ? null : 'Needs a city hall';
}

// ------------------------------------------------------------------ upkeep

/**
 * `1 + g + ... + g^(n-1)`, the compounded total of `n` buildings.
 *
 * The same sum every cost curve in this file implies and none of them had to
 * state, because a purchase only ever asks what the *next* one costs. Upkeep
 * asks what all of them cost at once, so the closed form is worth having: a
 * 49-district city may own 59 buildings of a type and this runs ten times a
 * second.
 */
const compounded = (growth: number, n: number): number =>
  n <= 0 ? 0 : growth === 1 ? n : (growth ** n - 1) / (growth - 1);

/**
 * What a plot of this city is worth against a plot of a fresh one, in the terms
 * the ledger is actually made of.
 *
 * The yardstick the wage bill is indexed to, and the measurement is the whole
 * reason it is not simply `cityScale`. A flat rate per building was tried first
 * and falls away to nothing, which the brief for this feature predicted; scaling
 * by `cityScale` alone was tried second and *also* falls away, which it did not.
 * Measured on cities built out to their own frontage with every service the land
 * allows, a bill scaled by `cityScale` is 4.6% of the ledger at one district of
 * apartments and 0.0% at forty-nine of megastructures — three orders of
 * magnitude of drift, and a decision that only exists for the first hour.
 *
 * The reason is that the ledger climbs the level ladder *twice*. Rent is
 * `residents x RENT x (1 + SHOP_BONUS x shops + ...)`, and both brackets grow
 * with LEVEL_SCALE — once through the people paying and once through the
 * premises multiplying what they pay — so income is quadratic in a term
 * `cityScale` only covers once. This is the product of the two, so it is exactly
 * as quadratic as the thing it is chasing: measured, the upkeep share is
 * identical to three significant figures at apartments, towers and
 * megastructures. See tools/upkeep.calibrate.mjs.
 *
 * Four terms are deliberately absent, and they are absent for one reason: a
 * bill that fell with the things that make a city poorer would cancel exactly
 * the pressure it exists to apply. Mood and the tax rate are policy, and a city
 * cannot furlough its hospitals by taxing itself. A fire sends nobody home.
 * And *occupancy* is out on the same rule, which is why this reads the cohorts
 * rather than `effectiveOf` — a half-empty city owes the same wages on a
 * smaller income, so the share climbs as the city struggles, which is what
 * makes the bankruptcy rule reachable at all.
 *
 * One for a fresh city, since `cityScale` and `bonuses` are each one there — so
 * UPKEEP_RATE keeps its meaning as a payback period measured at the opening.
 */
export const ledgerScale = (s: GameState): number =>
  cityScale(s) *
  bonuses(
    cohortScale(s.shopLevels),
    cohortScale(s.industryLevels) + estatePlots(s) * ESTATE_YIELD * industryScale(s),
    s.districts,
  );

/**
 * The city's whole civic payroll, in cash of opening price.
 *
 * Split out from `upkeep` and given the growth as an argument for one reason:
 * tools/upkeep.calibrate.mjs sweeps UPKEEP_GROWTH, and a sweep that reimplemented
 * this sum would be measuring a second copy of the formula rather than the one
 * the game charges.
 *
 * Staffing is a factor, and it is the term that keeps the bankruptcy rule from
 * deadlocking: an unpaid payroll is a cheaper payroll, so a city that cannot pay
 * stops paying, its coverage falls to what it can afford, and its income
 * recovers against a smaller bill. See UPKEEP_ARREARS_TAU.
 */
export const civicPayroll = (s: GameState, growth = UPKEEP_GROWTH): number => {
  let payroll = 0;
  for (const service of SERVICES) {
    payroll +=
      service.base *
      compounded(growth, serviceCount(s, service.key)) *
      staffing(s, service.key);
  }
  // The city hall is on the payroll and is the one entry with no staffing term,
  // because it has no staffing scalar to have: it is a boolean, and there is
  // nothing to average a second one into. What that costs is that arrears cannot
  // make the hall cheaper the way they make a hospital cheaper — measured, it is
  // 15.1% of a one-district city's bill and 2.0% of its gross income, falling to
  // 0.2% and 0.0% at forty-nine — and UPKEEP_KEEP_SHARE is what guarantees the
  // treasury grows underneath it either way. A flat cost against a payroll that
  // grows with the city, so it is a real line early and a rounding error late,
  // which is the right way round for the building that unlocks the away switch.
  if (s.cityHall) payroll += CITY_HALL_BASE;
  // Plants are on the payroll and *do* have a staffing scalar, unlike the hall,
  // so an unpaid wage bill browns the city out — which is the one place two of
  // these features touch. The guard is that the loop is bounded at both ends:
  // POWER_FLOOR holds occupancy at a third whatever the grid is doing, and
  // UPKEEP_KEEP_SHARE keeps the treasury growing whatever the arrears are. See
  // test/power.test.ts, where the pair is run together and has to climb out.
  payroll +=
    POWER_PLANT_BASE * compounded(growth, s.plants) * s.plantStaff;
  // The airport, at a figure of its own rather than at what it cost to open —
  // see AIRPORT_PAYROLL, which is the one building in the game where the two
  // are unrelated. Like the hall it has no staffing scalar and so cannot be
  // made cheaper by arrears; unlike the hall it is the dearest single thing the
  // city runs.
  if (s.airport) payroll += AIRPORT_PAYROLL;
  return payroll;
};

/**
 * What one civic type costs to run, per second. The breakdown `upkeep` sums.
 *
 * Priced off `Service.base` rather than as a column of its own, so a university
 * costs more to run than a police station without a second table to keep in step
 * with the first. What that buys is stated plainly because it is lopsided: a
 * university opens at 7,200 against a hospital's 130, so at the ceiling the land
 * allows it is 85% of the whole bill. That is the intended reading rather than a
 * defect — the university is the building that unlocks the top of the skyline,
 * and it is now the one with a running cost worth thinking about — but it does
 * mean the other five types are a tenth of the wage bill between them, and a
 * later cycle that wants coverage itself to be the budget decision will need a
 * measured `upkeep` column rather than this derivation.
 */
export const serviceUpkeep = (s: GameState, service: Service): number =>
  UPKEEP_RATE *
  service.base *
  compounded(UPKEEP_GROWTH, serviceCount(s, service.key)) *
  staffing(s, service.key) *
  ledgerScale(s);

/**
 * The whole wage bill, per second.
 *
 * Deliberately a read of its own rather than a term inside `income`. `income`
 * is what the city's buildings *earn* — the shop multiplier, the fares, the
 * tourism — and the inspector, the estates panel and `buildingIncome` all mean
 * exactly that when they read it. What the city is left with is `netIncome`,
 * and the two must not be conflated: charging upkeep inside `income` would make
 * every marginal-value readout in the HUD quietly wrong.
 */
/**
 * Everything the city pays out per second: the wage bill and its treaties.
 *
 * The two treaty lines are outside `civicPayroll` rather than inside it,
 * because they are not wages — a payroll is indexed to the ledger by
 * `ledgerScale` and staffed buildings are what it counts, where an imported
 * unit of power is bought at a price and a trade mission is a running cost. But
 * they *are* upkeep in every sense that matters here: they are what a shortfall
 * fails to pay, they are what `upkeepReserve` holds back, and they are the
 * difference between the gross and the net the dock shows.
 */
export const upkeep = (s: GameState): number => {
  // One `ledgerScale`, not two: it is a walk over the cohorts and both the wage
  // bill and the trade mission are indexed to it. `tradeUpkeep` is the same
  // expression for a caller that wants the line on its own.
  const scale = ledgerScale(s);
  return (
    UPKEEP_RATE * civicPayroll(s) * scale +
    powerTradeCost(s) +
    (goodsTraded(s) ? GOODS_TRADE_UPKEEP * scale * housingPlots(s) : 0)
  );
};

/** What the treasury actually gains per second. The number the dock shows. */
export const netIncome = (s: GameState): number => income(s) - upkeep(s);

/**
 * Fraction of a payroll lost over `dt` at a given unpaid share of the bill.
 *
 * The same exponential form as `demandStep` and `happinessStep`, and here for
 * the same reason: catch-up steps whole minutes and the linear form
 * `x -= x * dt / TAU` goes negative the moment `dt` passes TAU. This saturates
 * at 1 for any step size, so an hour of arrears taken in one step leaves the
 * same staffing as an hour taken in thirty-six thousand ticks.
 *
 * `shortfall` is the share of the bill that went unpaid, so it scales the rate
 * rather than the target: a city a penny short of its wages barely moves, and
 * one paying nothing at all empties its payroll on UPKEEP_ARREARS_TAU.
 */
export const arrearsStep = (dt: number, shortfall: number): number =>
  1 - Math.exp((-Math.max(0, shortfall) * Math.max(0, dt)) / UPKEEP_ARREARS_TAU);

/**
 * Cash the automatic passes hold back when the ledger is running negative.
 *
 * Zero for a solvent city, which is every city that has not overbought — so this
 * changes nothing about how auto-development behaves until the moment it would
 * otherwise dig the hole deeper. See UPKEEP_RESERVE_SECONDS.
 */
export const upkeepReserve = (s: GameState): number =>
  Math.max(0, -netIncome(s)) * UPKEEP_RESERVE_SECONDS;

// ------------------------------------------------------------------ can-build

export const canBuildHome = (s: GameState): boolean =>
  hasFreePlot(s, 'home') && s.happiness >= HAPPINESS_MIN_BUILD && s.cash >= homeCost(s);

export const canBuildShop = (s: GameState): boolean =>
  hasFreePlot(s, 'shop') && s.cash >= shopCost(s);

export const canBuildIndustry = (s: GameState): boolean =>
  hasFreePlot(s, 'industry') && s.cash >= industryCost(s);

export const canBuildPark = (s: GameState): boolean =>
  s.parks < parkCapacity(s) && s.cash >= parkCost(s);

/**
 * Whether the city may open another landmark of a type.
 *
 * Land and money, and no "one ahead of need" clamp of the kind `serviceAllowed`
 * carries: a landmark covers land rather than people, so there is no need for it
 * to run ahead of. The site list is the only bound it has.
 */
export const canBuildLandmark = (s: GameState, landmark: Landmark): boolean =>
  rankAllows(s, landmark.key) &&
  landmarkCount(s, landmark.key) < landmarkSiteCapacity(s, landmark.key) &&
  s.cash >= landmarkCost(s, landmark);

export const canBuildTerminal = (s: GameState, terminal: Terminal): boolean =>
  terminalCount(s, terminal.key) < terminalCapacity(s) && s.cash >= terminalCost(s, terminal);

export const canBuildService = (s: GameState, service: Service): boolean =>
  serviceCount(s, service.key) < serviceAllowed(s, service) && s.cash >= serviceCost(s, service);

export const canAnnex = (s: GameState): boolean =>
  s.districts < MAX_DISTRICTS &&
  activeDeveloped(s) >= ANNEX_MIN_OCCUPANCY &&
  s.cash >= annexCost(s);

/**
 * Whether the city will take the next district on its own this tick.
 *
 * Everything the button needs plus two reserves, so the automatic pass spends a
 * surplus rather than the treasury. A player who wants the land before the
 * surplus is there presses the button; that is the override.
 *
 * The second reserve is `upkeepReserve`, and it is the half that answers to the
 * wage bill rather than to the price. Annexing does not raise upkeep on its own
 * — a district is land, not a payroll — but it stretches the services the city
 * already runs across more of it, and a city already failing to make its wages
 * has no business buying anything at all. Zero for a solvent city, so this is
 * inert until it matters.
 */
export const willAutoAnnex = (s: GameState): boolean =>
  canAnnex(s) && s.cash >= annexCost(s) * (1 + AUTO_ANNEX_RESERVE) + upkeepReserve(s);

/**
 * Why the city is not expanding, phrased for the HUD.
 *
 * Three answers now rather than two, because with annexation automatic "why has
 * nothing happened" is a question the player asks without having clicked
 * anything — and "you cannot afford it yet" is a real answer to it, where
 * before it was implied by a disabled button next to a price.
 */
export function annexBlocker(s: GameState): string | null {
  if (s.districts >= MAX_DISTRICTS) return 'City limits reached';
  if (activeDeveloped(s) < ANNEX_MIN_OCCUPANCY) {
    return `Needs ${Math.round(ANNEX_MIN_OCCUPANCY * 100)}% developed`;
  }
  if (s.cash < annexCost(s)) return 'Saving for the next district';
  return null;
}

/**
 * Why the home button is off, phrased for the HUD.
 *
 * Same shape as `annexBlocker` so the HUD has one pattern to
 * follow rather than two: a string when the button is dead for a reason worth
 * saying, null when it is only a matter of money.
 */
export function homeBlocker(s: GameState): string | null {
  if (!hasFreePlot(s, 'home')) return 'No housing land left';
  if (s.happiness < HAPPINESS_MIN_BUILD) return 'Residents are leaving';
  return null;
}

/**
 * What one building of a kind and level adds to the ledger per second, holding
 * the rest of the city exactly as it is.
 *
 * Marginal, and it has to be: the three zones earn in two different ways. A
 * home earns rent from the people in it; a shop or a works earns nothing of its
 * own and multiplies what the homes earn. Quoting a shop's "income" as a share
 * of a multiplier would be true and useless, so this is what taking the
 * building away would cost — the number a player can actually act on.
 *
 * Every term but the level is city-wide, which is why the inspector says so.
 */
export const buildingIncome = (
  s: GameState,
  kind: ZoneKind,
  level: number,
  /**
   * The parcel this building stands on, as a flat housing-plot index and a
   * plot count. Optional, and only read for housing: it is what makes two
   * identical houses worth different amounts. Omitted, a home is quoted at the
   * city's mean land value, which is what it was worth before this existed.
   */
  parcel?: { readonly plot: number; readonly plots: number },
): number => {
  if (level < 0) return 0;
  const mood = incomeMultiplier(s);
  if (kind === 'home') {
    const bonuses =
      1 +
      SHOP_BONUS * effectiveOf(s, 'shop') +
      // The same skill multiplier `income` charges, so the card and the ledger
      // quote one number rather than two.
      INDUSTRY_BONUS * effectiveOf(s, 'industry') * workforceSkill(s) +
      DISTRICT_BONUS * (s.districts - 1);
    const land =
      parcel === undefined
        ? landValue(s)
        : parcelLandValue(s, parcel.plot, parcel.plots);
    return (LEVEL_HOUSING[level] ?? 0) * s.occupancyR * RENT * land * bonuses * mood;
  }
  const share =
    kind === 'shop' ? SHOP_BONUS : INDUSTRY_BONUS * workforceSkill(s);
  return (
    residents(s) * RENT * share * (LEVEL_SCALE[level] ?? 1) * occupancyOf(s, kind) * mood
  );
};

/**
 * Why one building is not climbing, phrased for the inspector.
 *
 * Same shape as `annexBlocker` and `homeBlocker`: a string when there is a
 * reason worth saying, null when the building is simply waiting its turn in the
 * promotion wave. Ordered by how permanent the answer is, so the one thing a
 * player can never fix comes first — a plot with no neighbour is capped at the
 * level below MERGE_LEVEL forever, and saying "needs 60% education" to such a
 * building would be a lie of omission.
 */
export function promotionBlocker(
  s: GameState,
  kind: ZoneKind,
  level: number,
  /** Plots in this building's parcel. One means it can never merge. */
  parcelPlots: number,
): string | null {
  if (level < 0) return 'Abandoned';
  if (level >= LEVELS - 1) return 'At its top level';
  if (level + 1 >= MERGE_LEVEL && parcelPlots < 2) return 'No neighbour to merge with';
  const taught = LEVEL_EDUCATION[level + 1] ?? 0;
  if (educationCoverage(s) < taught) {
    return `Needs ${Math.round(taught * 100)}% education`;
  }
  if (occupancyOf(s, kind) < LEVEL_UP_OCCUPANCY) return 'Too empty to expand';
  if (s.happiness < LEVEL_UP_HAPPINESS) return 'City is too unhappy';
  return null;
}

/** Why the park button is off. Land is the only gate a park has. */
/**
 * Why the city cannot open another landmark of a type, phrased for the HUD.
 *
 * Land only, the same as `serviceBlocker`: the price is on the button and the
 * button is disabled, so "you cannot afford it" is already said twice. What is
 * worth saying is the thing the player cannot fix with money.
 */
export function landmarkBlocker(s: GameState, landmark: Landmark): string | null {
  // The rank first: it is the answer the player can do least about in the next
  // minute, and the blocker line says the most permanent thing first
  // everywhere else in this file — see `promotionBlocker`.
  const rank = rankBlocker(s, landmark.key);
  if (rank) return rank;
  return landmarkCount(s, landmark.key) >= landmarkSiteCapacity(s, landmark.key)
    ? 'No sites left'
    : null;
}

export function terminalBlocker(s: GameState, terminal: Terminal): string | null {
  if (!hasCoast(s)) return 'No coast yet';
  return terminalCount(s, terminal.key) >= terminalCapacity(s) ? 'No berths left' : null;
}

/**
 * Why a line cannot be laid, phrased for the HUD.
 *
 * Rank first, then land, in the order `landmarkBlocker` states and for the same
 * reason: the most permanent thing first. The land answer is worth wording as
 * districts rather than as "sites", because that is what a line actually runs
 * out of — a district offers exactly one pair of each kind, so the honest thing
 * to tell a player with a complete network is to go and annex.
 */
export function lineBlocker(s: GameState, line: TransitLine): string | null {
  const rank = rankBlocker(s, line.key);
  if (rank) return rank;
  if (linePairCapacity(line.key, s.districts) <= 0) return 'Nowhere to run it yet';
  return lineCount(s, line.key) >= lineAllowed(s, line) ? 'Every district joined' : null;
}

export function parkBlocker(s: GameState): string | null {
  return s.parks >= parkCapacity(s) ? 'No courtyards left' : null;
}

/**
 * Why a civic button is off. Land runs out before the population gate does.
 *
 * No rank on any of the six, and the university is the one that was tried and
 * measured out. It looks like the archetypal late building — 7,200 to found,
 * one 3x3 site a district, the second education rung — and it is nothing of the
 * kind. `educationCoverage` is schools *plus* universities over the housing
 * plots they stand among, and `siteCapacity` gives a five-district city six
 * schools against 169 housing plots: 90 plots covered, 0.53. LEVEL_EDUCATION's
 * second rung is 0.60. So the university is what a city needs to reach level 2
 * housing at all, which arrives inside the first hour — and a rank on it is a
 * deadlock rather than a gate, because the population a rank asks for is the
 * population level 2 was going to provide. Measured in
 * tools/ranks.calibrate.mjs, which prints the run that stalls.
 */
export function serviceBlocker(s: GameState, service: Service): string | null {
  if (serviceCount(s, service.key) >= siteCapacity(s, service.key)) return 'No sites left';
  if (serviceCount(s, service.key) >= serviceAllowed(s, service)) return 'Not needed yet';
  return null;
}

