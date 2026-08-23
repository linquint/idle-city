import {
  ANNEX_BASE,
  ANNEX_GROWTH,
  ANNEX_MIN_OCCUPANCY,
  AUTO_ANNEX_RESERVE,
  BASE_IGNITION_PER_BUILDING_HOUR,
  BURN_OUT_SECONDS,
  CIVIC_RAMP_SECONDS,
  CIVIC_SERVICES,
  ABANDON_SECONDS,
  ABANDON_SPREAD_SECONDS,
  DEMAND_SCALE,
  DEMAND_TAU,
  DISTRICT_BONUS,
  EXPORT_BASE,
  EXPORT_PER_DISTRICT,
  EXTINGUISH_MAX,
  EXTINGUISH_MIN,
  FARE_PER_RIDER,
  FREE_TRANSPORT_MOOD,
  FREE_TRANSPORT_REACH,
  FIRE_SUPPRESSION,
  FIRE_UNHAPPINESS,
  HAPPINESS_FLOOR,
  HAPPINESS_MIN_BUILD,
  HAPPINESS_TAU,
  HOME_BASE,
  HOME_GROWTH,
  INDUSTRY_BASE,
  INDUSTRY_BONUS,
  INDUSTRY_GROWTH,
  INDUSTRY_JOBS,
  INDUSTRY_OUTPUT,
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
  SHOP_GROWTH,
  SHOP_JOBS,
  SHOP_SUPPLY,
  SHOP_TRIPS,
  SPEND_PER_RESIDENT,
  TAX_STEPS,
  TRANSIT_LABOUR_DRAW,
  TRANSIT_WORKFORCE,
  WORKING_SHARE,
  type Service,
} from './config.ts';
import { ZONE, type Zone } from './citygen.ts';
import {
  BUILDABLE_COMMERCIAL_PER_DISTRICT,
  BUILDABLE_INDUSTRIAL_PER_DISTRICT,
  BUILDABLE_PARKS_PER_DISTRICT,
  BUILDABLE_RESIDENTIAL_PER_DISTRICT,
  CIVIC_SITES_PER_DISTRICT,
  parcelBook,
  UNIVERSITY_SITES_PER_DISTRICT,
} from './layout.ts';
import type { GameState, LevelCohort, ZoneKind } from './state.ts';

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
 */
export const occupancyTarget = (s: GameState, kind: ZoneKind): number => {
  const mood = Math.max(0, Math.min(1, s.happiness));
  const wanted =
    OCCUPANCY_FLOOR +
    (OCCUPANCY_FULL - OCCUPANCY_FLOOR) * mood +
    OCCUPANCY_DEMAND * clampDemand(demandOf(s, kind));
  return Math.max(0, Math.min(1, wanted));
};

/** Fraction of the gap occupancy closes over `dt`. Same form as `demandStep`. */
export const occupancyStep = (dt: number): number =>
  1 - Math.exp(-Math.max(0, dt) / OCCUPANCY_TAU);

/** Whether a zone is sitting empty enough to start its vacancy clock. */
export const isVacant = (s: GameState, kind: ZoneKind): boolean =>
  occupancyOf(s, kind) < OCCUPANCY_EMPTY;

/** Whether a zone has been empty long enough to start writing buildings off. */
export const isAbandoning = (s: GameState, kind: ZoneKind): boolean =>
  isVacant(s, kind) && vacantOf(s, kind) >= ABANDON_SECONDS && standingOf(s, kind) > 0;

/** Whether a zone has ruins to bring back and the occupancy to justify it. */
export const isRecovering = (s: GameState, kind: ZoneKind): boolean =>
  !isVacant(s, kind) && abandonedOf(s, kind) > 0;

/** Buildings a zone writes off per second, once it is past ABANDON_SECONDS. */
export const abandonRate = (s: GameState, kind: ZoneKind): number =>
  standingOf(s, kind) / ABANDON_SPREAD_SECONDS;

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
export const homeCapacity = (s: GameState): number =>
  s.districts * BUILDABLE_RESIDENTIAL_PER_DISTRICT;

export const shopCapacity = (s: GameState): number =>
  s.districts * BUILDABLE_COMMERCIAL_PER_DISTRICT;
export const industryCapacity = (s: GameState): number =>
  s.districts * BUILDABLE_INDUSTRIAL_PER_DISTRICT;

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
  const book = parcelBook(zoneOf(kind), s.districts);
  if (merged >= book.pairs(s.districts)) return false;
  return ready >= book.pairFront(merged) + 2;
};

/** Parcels of a zone that could ever merge. The ceiling on `mergedR`. */
export const mergeCapacity = (s: GameState, kind: ZoneKind): number =>
  parcelBook(zoneOf(kind), s.districts).pairs(s.districts);

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
  civicSiteCapacity(s) +
  universitySiteCapacity(s);

/**
 * A civic building is development too, so it counts against the same total.
 *
 * Parks deliberately do not, on either side of the ratio. Courtyard land was
 * never for sale, so counting it would silently re-scale a gate that was
 * measured against the 65 sellable plots of a district — a tier that reached
 * 72.3% build-out would drop to 68.1% and fall under ANNEX_MIN_OCCUPANCY the
 * moment parks existed, gating a player out of annexing for not buying an
 * amenity. Development is what the city sells; a park is what it keeps.
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

// ------------------------------------------------------------------ services

export type ServiceKey = Service['key'];

export const serviceCount = (s: GameState, key: ServiceKey): number =>
  key === 'hospital' ? s.hospitals
  : key === 'police' ? s.police
  : key === 'fire' ? s.fire
  : key === 'school' ? s.schools
  : key === 'transit' ? s.depots
  : s.universities;

/** How much of a type's payroll is actually filled, in [0, 1]. See `staffStep`. */
export const staffing = (s: GameState, key: ServiceKey): number =>
  key === 'hospital' ? s.hospitalStaff
  : key === 'police' ? s.policeStaff
  : key === 'fire' ? s.fireStaff
  : key === 'school' ? s.schoolStaff
  : key === 'transit' ? s.depotStaff
  : s.universityStaff;

/**
 * Sites of one type the city has land for.
 *
 * Two answers, because there are two kinds of site. The four 2x2 types share one
 * city-wide list by a fixed interleave — hospitals take 4k, police 4k+1, fire
 * 4k+2, schools 4k+3 — so with 6 sites a district the first district gets
 * 2/2/1/1 and they even out from there. A university stands on its own 3x3 list,
 * one to a district, and does not touch the interleave at all.
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
  return service.key === 'transit' && s.freeTransport ? reach * (1 + FREE_TRANSPORT_REACH) : reach;
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
  s.freeTransport ? 0 : riders(s) * FARE_PER_RIDER;

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
  readonly key: ServiceKey | 'recreation';
  readonly coverLabel: string;
  readonly weight: number;
  readonly coverage: number;
}

/** Every term happiness is made of, services first. The weights sum to 1. */
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
];

/**
 * Weighted coverage less what is currently on fire, in [0, 1]. Where
 * `s.happiness` is heading.
 *
 * The fire term is a flat subtraction rather than another weighted coverage
 * because it is not a service level — it is an event, and it should hurt while
 * it is happening and stop hurting the moment it is out.
 */
export const happinessTarget = (s: GameState): number => {
  const covered =
    HAPPINESS_SERVICES.reduce((sum, service) => sum + service.weight * coverage(s, service), 0) +
    RECREATION_WEIGHT * recreationCoverage(s);
  // The tax term joins the fire term as a *modifier* on earned coverage rather
  // than as a fifth weight. The four weights sum to exactly 1 and go on doing
  // so; what a tax rate changes is how the city feels about the coverage it has,
  // which is a different statement from how much that coverage is worth.
  const policy = taxStep(s).mood + (s.freeTransport ? FREE_TRANSPORT_MOOD : 0);
  return Math.max(0, Math.min(1, covered + policy) - FIRE_UNHAPPINESS * s.fires.length);
};

/**
 * The term holding happiness back hardest — the one whose shortfall costs the
 * most weighted points. Naming it is the entire value of the panel: a bare
 * percentage tells the player nothing they can act on, and with a fourth term
 * in the sum a panel that could only ever name a *service* would leave a
 * park-less city stuck at 82% with three green lines and no explanation.
 */
export const bindingTerm = (s: GameState): HappinessTerm => {
  const terms = happinessTerms(s);
  let worst = terms[0] as HappinessTerm;
  let cost = -1;
  for (const term of terms) {
    const lost = term.weight * (1 - term.coverage);
    if (lost > cost) {
      cost = lost;
      worst = term;
    }
  }
  return worst;
};

/** The tax setting the city is on. Clamped, so a doctored save picks a real one. */
export const taxStep = (s: GameState): (typeof TAX_STEPS)[number] => {
  const at = Math.max(0, Math.min(TAX_STEPS.length - 1, Math.floor(s.taxRate)));
  return TAX_STEPS[at] as (typeof TAX_STEPS)[number];
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
 * Seconds from ignition to the fire being out, at the city's current coverage.
 *
 * Read fresh every tick rather than stamped on the fire, so a station that
 * opens while something is burning actually shortens the fire it was too late
 * to prevent.
 */
export const extinguishSeconds = (s: GameState): number =>
  EXTINGUISH_MAX + (EXTINGUISH_MIN - EXTINGUISH_MAX) * fireCoverage(s);

/**
 * Whether a fire started now would take the building with it.
 *
 * The threshold the whole mechanic turns on: the response has to arrive inside
 * BURN_OUT_SECONDS or there is nothing left to save.
 */
export const wouldBurnOut = (s: GameState): boolean => extinguishSeconds(s) > BURN_OUT_SECONDS;

/** When a fire resolves, one way or the other. */
export const resolvesAt = (s: GameState): number =>
  Math.min(extinguishSeconds(s), BURN_OUT_SECONDS);

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

// -------------------------------------------------------------------- demand

/**
 * The outside world's appetite for what the city makes — the tap that gets the
 * cycle turning when every counter is still zero.
 */
export const exportMarket = (s: GameState): number =>
  EXPORT_BASE + EXPORT_PER_DISTRICT * (s.districts - 1);

export const jobs = (s: GameState): number =>
  openOf(s, 'shop', SHOP_JOBS) + openOf(s, 'industry', INDUSTRY_JOBS);

/**
 * The imbalance that counts as "saturated", at the city's current level mix.
 *
 * DEMAND_SCALE on its own is a constant, and a constant could only ever be
 * right at one level: residents span 4 to 300 a plot, so a scale set for
 * detached housing pins every signal the moment the city has towers in it —
 * which is exactly what the old build did, for about 21 hours of any 24 spent
 * playing it, and what its own comment said could only be fixed by dividing by
 * a size term rather than a constant. This is that size term. It measures the
 * imbalance in level-0 buildings, so a district out of balance reads the same
 * whatever is standing on it — and the arc survives it, because jobs are per
 * plot while workers are per resident.
 */
export const demandScale = (s: GameState): number => DEMAND_SCALE * cityScale(s);

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
  workers(s) * (1 + TRANSIT_WORKFORCE * transitCoverage(s));

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

export interface DemandTargets {
  readonly r: number;
  readonly c: number;
  readonly i: number;
}

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
  return {
    // Against the workers an employer can reach rather than the raw labour
    // force: a network that has already put people within reach of a job has
    // met some of the demand another house would have met.
    r: Math.min(s.happiness, clampDemand((jobs(s) - reachableWorkers(s)) / scale)),
    c: clampDemand(
      (residents(s) * SPEND_PER_RESIDENT -
        openOf(s, 'shop', SHOP_TRIPS) +
        labourReach(s)) /
        scale,
    ),
    i: clampDemand(
      (openOf(s, 'shop', SHOP_SUPPLY) +
        exportMarket(s) -
        openOf(s, 'industry', INDUSTRY_OUTPUT) +
        labourReach(s)) /
        scale,
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
export const homeCost = (s: GameState): number =>
  HOME_BASE * HOME_GROWTH ** plotsOf(s, 'home') * priceModifier(s.demandR);
export const shopCost = (s: GameState): number =>
  SHOP_BASE * SHOP_GROWTH ** plotsOf(s, 'shop') * priceModifier(s.demandC);
export const industryCost = (s: GameState): number =>
  INDUSTRY_BASE * INDUSTRY_GROWTH ** plotsOf(s, 'industry') * priceModifier(s.demandI);

/**
 * Parks are not demand-priced either, and earn nothing at all. What they buy is
 * the recreation term, which is 18% of happiness, which multiplies every penny
 * the city does earn.
 */
export const parkCost = (s: GameState): number => PARK_BASE * PARK_GROWTH ** s.parks;

/** Services are not demand-priced: nobody haggles over a hospital. */
export const serviceCost = (s: GameState, service: Service): number =>
  service.base * service.growth ** serviceCount(s, service.key);

export const annexCost = (s: GameState): number => ANNEX_BASE * ANNEX_GROWTH ** (s.districts - 1);

// -------------------------------------------------------------------- income

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
  const industry = effectiveOf(s, 'industry') * (1 - alight(s, 'industry'));
  return (
    (people *
      RENT *
      (1 + SHOP_BONUS * shops + INDUSTRY_BONUS * industry + DISTRICT_BONUS * (s.districts - 1)) *
      incomeMultiplier(s) +
      // Fares. Outside the bracket above rather than inside it, because they
      // are not rent: a fare does not scale with the shop multiplier or the
      // district bonus, and it is taken from the people on the buses rather
      // than from the people in the houses. It *is* taxed, like everything else
      // the city takes in.
      fareIncome(s)) *
    // The tax rate multiplies the whole ledger, which is why the happiness it
    // costs is worth more than it looks: happiness multiplies this same line
    // through `incomeMultiplier`, so the two terms compound against each other.
    taxStep(s).income
  );
};

// ------------------------------------------------------------------ can-build

export const canBuildHome = (s: GameState): boolean =>
  hasFreePlot(s, 'home') && s.happiness >= HAPPINESS_MIN_BUILD && s.cash >= homeCost(s);

export const canBuildShop = (s: GameState): boolean =>
  hasFreePlot(s, 'shop') && s.cash >= shopCost(s);

export const canBuildIndustry = (s: GameState): boolean =>
  hasFreePlot(s, 'industry') && s.cash >= industryCost(s);

export const canBuildPark = (s: GameState): boolean =>
  s.parks < parkCapacity(s) && s.cash >= parkCost(s);

export const canBuildService = (s: GameState, service: Service): boolean =>
  serviceCount(s, service.key) < serviceAllowed(s, service) && s.cash >= serviceCost(s, service);

export const canAnnex = (s: GameState): boolean =>
  s.districts < MAX_DISTRICTS &&
  activeDeveloped(s) >= ANNEX_MIN_OCCUPANCY &&
  s.cash >= annexCost(s);

/**
 * Whether the city will take the next district on its own this tick.
 *
 * Everything the button needs plus a reserve, so the automatic pass spends a
 * surplus rather than the treasury. A player who wants the land before the
 * surplus is there presses the button; that is the override.
 */
export const willAutoAnnex = (s: GameState): boolean =>
  canAnnex(s) && s.cash >= annexCost(s) * (1 + AUTO_ANNEX_RESERVE);

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
export const buildingIncome = (s: GameState, kind: ZoneKind, level: number): number => {
  if (level < 0) return 0;
  const mood = incomeMultiplier(s);
  if (kind === 'home') {
    const bonuses =
      1 +
      SHOP_BONUS * effectiveOf(s, 'shop') +
      INDUSTRY_BONUS * effectiveOf(s, 'industry') +
      DISTRICT_BONUS * (s.districts - 1);
    return (LEVEL_HOUSING[level] ?? 0) * s.occupancyR * RENT * bonuses * mood;
  }
  const share = kind === 'shop' ? SHOP_BONUS : INDUSTRY_BONUS;
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
export function parkBlocker(s: GameState): string | null {
  return s.parks >= parkCapacity(s) ? 'No courtyards left' : null;
}

/** Why a civic button is off. Land runs out before the population gate does. */
export function serviceBlocker(s: GameState, service: Service): string | null {
  if (serviceCount(s, service.key) >= siteCapacity(s, service.key)) return 'No sites left';
  if (serviceCount(s, service.key) >= serviceAllowed(s, service)) return 'Not needed yet';
  return null;
}

