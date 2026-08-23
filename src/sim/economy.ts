import {
  ANNEX_BASE,
  ANNEX_GROWTH,
  ANNEX_MIN_OCCUPANCY,
  BASE_IGNITION_PER_BUILDING_HOUR,
  BURN_OUT_SECONDS,
  CIVIC_GROWTH,
  CIVIC_RAMP_SECONDS,
  DEMAND_SCALE,
  DEMAND_TAU,
  DISTRICT_BONUS,
  EXPORT_BASE,
  EXPORT_PER_DISTRICT,
  EXTINGUISH_MAX,
  EXTINGUISH_MIN,
  FIRE_SUPPRESSION,
  FIRE_UNHAPPINESS,
  HAPPINESS_FLOOR,
  HAPPINESS_MIN_BUILD,
  HAPPINESS_TAU,
  HOME_BASE,
  HOME_GROWTH,
  HOMES_PER_PARK,
  INDUSTRIAL_OUTPUT,
  INDUSTRY_BASE,
  INDUSTRY_BONUS,
  INDUSTRY_GROWTH,
  JOBS_PER_COMMERCIAL,
  JOBS_PER_INDUSTRIAL,
  MAX_DISTRICTS,
  PARK_BASE,
  PARK_GROWTH,
  PRICE_DISCOUNT_MAX,
  PRICE_SURCHARGE_MAX,
  RECREATION_WEIGHT,
  RENT,
  REZONE_BASE,
  REZONE_GROWTH,
  REZONE_MIN_HOMES,
  SERVICES,
  SHOP_BASE,
  SHOP_BONUS,
  SHOP_GROWTH,
  SHOP_THROUGHPUT,
  SPEND_PER_RESIDENT,
  SUPPLY_DRAW,
  TIERS,
  WORKING_SHARE,
  type Service,
} from './config.ts';
import {
  BUILDABLE_COMMERCIAL_PER_DISTRICT,
  BUILDABLE_INDUSTRIAL_PER_DISTRICT,
  BUILDABLE_PARKS_PER_DISTRICT,
  BUILDABLE_RESIDENTIAL_PER_DISTRICT,
  CIVIC_SITES_PER_DISTRICT,
} from './layout.ts';
import type { FireKind, GameState } from './state.ts';

/** Pure reads over a state. No mutation lives in this file. */

export const tierOf = (s: GameState) => TIERS[Math.min(s.tier, TIERS.length - 1)]!;

/**
 * The band every demand signal lives in. Exported because three places have to
 * agree on it: the targets, the integrator, and whatever a save file claims.
 */
export const clampDemand = (n: number): number => Math.max(-1, Math.min(1, n));

// ------------------------------------------------------------------ capacity

/** Civic buildings, of every kind. */
export const civicBuildings = (s: GameState): number => s.hospitals + s.police + s.fire;

/**
 * Housing land. Civic buildings no longer come out of it: they stand on 2x2
 * sites reserved before the housing list is drawn, so the two can never collide
 * and this number does not move when a hospital opens.
 */
export const homeCapacity = (s: GameState): number =>
  s.districts * BUILDABLE_RESIDENTIAL_PER_DISTRICT;

export const shopCapacity = (s: GameState): number =>
  s.districts * BUILDABLE_COMMERCIAL_PER_DISTRICT;
export const industryCapacity = (s: GameState): number =>
  s.districts * BUILDABLE_INDUSTRIAL_PER_DISTRICT;

/**
 * Park land. Courtyard plots — the interior of a deep block — so it is the one
 * capacity that costs the city no frontage at all.
 */
export const parkCapacity = (s: GameState): number =>
  s.districts * BUILDABLE_PARKS_PER_DISTRICT;

/** 2x2 civic sites the city owns, of every type. */
export const civicSiteCapacity = (s: GameState): number =>
  s.districts * CIVIC_SITES_PER_DISTRICT;

/** Every plot the city can put something on, civic sites included. */
export const plotCapacity = (s: GameState): number =>
  homeCapacity(s) + shopCapacity(s) + industryCapacity(s) + civicSiteCapacity(s);

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
  s.homes + s.shops + s.industry + civicBuildings(s);

export const occupancy = (s: GameState): number => plotsUsed(s) / plotCapacity(s);

export const residents = (s: GameState): number => s.homes * tierOf(s).capacity;

// ------------------------------------------------------------------ services

export type ServiceKey = Service['key'];

export const serviceCount = (s: GameState, key: ServiceKey): number =>
  key === 'hospital' ? s.hospitals : key === 'police' ? s.police : s.fire;

/** How much of a type's payroll is actually filled, in [0, 1]. See `staffStep`. */
export const staffing = (s: GameState, key: ServiceKey): number =>
  key === 'hospital' ? s.hospitalStaff : key === 'police' ? s.policeStaff : s.fireStaff;

/**
 * Sites of one type the city has land for.
 *
 * The interleave hands hospitals sites 3k, police 3k+1 and fire 3k+2 out of one
 * city-wide list, so with 7 sites a district the three types get 3/2/2 in the
 * first district and even out from there.
 */
export const siteCapacity = (s: GameState, key: ServiceKey): number => {
  const sites = civicSiteCapacity(s);
  const offset = key === 'hospital' ? 0 : key === 'police' ? 1 : 2;
  return Math.max(0, Math.ceil((sites - offset) / 3));
};

/**
 * How many of a service the city is allowed to own.
 *
 * One ahead of need, never five. Without this the opening hour is "dump every
 * penny into permanent coverage before there is anyone to cover", which buys
 * a maxed happiness bar the city has not earned and removes the only pressure
 * services are supposed to apply. The land supply caps it as well, because a
 * building with no site has nowhere to stand.
 */
export const serviceAllowed = (s: GameState, service: Service): number =>
  Math.min(
    Math.floor(residents(s) / service.capacity) + 1,
    siteCapacity(s, service.key),
  );

/** How many of a service the current population would need for full cover. */
export const serviceNeeded = (s: GameState, service: Service): number =>
  Math.ceil(residents(s) / service.capacity);

/** Residents a service actually reaches, staffing included. */
export const covered = (s: GameState, service: Service): number =>
  serviceCount(s, service.key) * staffing(s, service.key) * service.capacity;

/**
 * Share of the population a service reaches, capped at everybody.
 *
 * An empty city reads as fully covered rather than as fully neglected: this is
 * the share of residents a service fails, and it fails nobody when there is
 * nobody. Without that the game deadlocks on its own tutorial — happiness would
 * be 0 before the first house, the housing gate would refuse to open it, and
 * there would be no income to buy the hospital that lifts the gate.
 */
export const coverage = (s: GameState, service: Service): number => {
  const people = residents(s);
  if (people <= 0) return 1;
  return Math.min(1, covered(s, service) / people);
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
    covered: Math.min(covered(s, service), residents(s)),
    coverage: coverage(s, service),
  }));

/**
 * Share of the city's homes within reach of a park, capped at all of them.
 *
 * Measured against homes rather than residents, which is the whole reason this
 * term is worth having. Park land is fixed at 4 plots to 19 housing plots a
 * district and a rezone adds none of it while multiplying residents by up to
 * 75x — so a per-resident denominator would be satisfied at tier 0 by two parks
 * and unreachable at tier 3 by every park in the city. Per home it means the
 * same thing at every tier. An empty city reads as covered for the same reason
 * an unserved one does: there is nobody it fails.
 */
export const recreationCoverage = (s: GameState): number => {
  if (s.homes <= 0) return 1;
  return Math.min(1, (s.parks * HOMES_PER_PARK) / s.homes);
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
  ...SERVICES.map((service) => ({
    key: service.key,
    coverLabel: service.coverLabel,
    weight: service.weight,
    coverage: coverage(s, service),
  })),
  {
    key: 'recreation' as const,
    coverLabel: 'Parks per home',
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
    SERVICES.reduce((sum, service) => sum + service.weight * coverage(s, service), 0) +
    RECREATION_WEIGHT * recreationCoverage(s);
  return Math.max(0, covered - FIRE_UNHAPPINESS * s.fires.length);
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
export const burnableOf = (s: GameState, kind: FireKind): number =>
  kind === 'home' ? s.homes : kind === 'shop' ? s.shops : s.industry;

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
export const burningOf = (s: GameState, kind: FireKind): number => {
  let n = 0;
  for (const fire of s.fires) if (fire.kind === kind) n++;
  return n;
};

/** Whether this exact building is already alight. Ignition never doubles up. */
export const isBurning = (s: GameState, kind: FireKind, index: number): boolean =>
  s.fires.some((fire) => fire.kind === kind && fire.index === index);

// -------------------------------------------------------------------- demand

/**
 * The outside world's appetite for what the city makes — the tap that gets the
 * cycle turning when every counter is still zero.
 */
export const exportMarket = (s: GameState): number =>
  EXPORT_BASE + EXPORT_PER_DISTRICT * (s.districts - 1);

export const jobs = (s: GameState): number =>
  s.shops * JOBS_PER_COMMERCIAL + s.industry * JOBS_PER_INDUSTRIAL;

export const workers = (s: GameState): number => residents(s) * WORKING_SHARE;

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
export const demandTargets = (s: GameState): DemandTargets => ({
  r: Math.min(s.happiness, clampDemand((jobs(s) - workers(s)) / DEMAND_SCALE)),
  c: clampDemand(
    (residents(s) * SPEND_PER_RESIDENT - s.shops * SHOP_THROUGHPUT) / DEMAND_SCALE,
  ),
  i: clampDemand(
    (s.shops * SUPPLY_DRAW + exportMarket(s) - s.industry * INDUSTRIAL_OUTPUT) / DEMAND_SCALE,
  ),
});

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

export const homeCost = (s: GameState): number =>
  HOME_BASE * HOME_GROWTH ** s.homes * priceModifier(s.demandR);
export const shopCost = (s: GameState): number =>
  SHOP_BASE * SHOP_GROWTH ** s.shops * priceModifier(s.demandC);
export const industryCost = (s: GameState): number =>
  INDUSTRY_BASE * INDUSTRY_GROWTH ** s.industry * priceModifier(s.demandI);

/**
 * Parks are not demand-priced either, and earn nothing at all. What they buy is
 * the recreation term, which is 18% of happiness, which multiplies every penny
 * the city does earn.
 */
export const parkCost = (s: GameState): number => PARK_BASE * PARK_GROWTH ** s.parks;

/** Services are not demand-priced: nobody haggles over a hospital. */
export const serviceCost = (s: GameState, service: Service): number =>
  service.base * CIVIC_GROWTH ** serviceCount(s, service.key);

export const rezoneCost = (s: GameState): number => REZONE_BASE * REZONE_GROWTH ** s.tier;
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
  const tier = tierOf(s);
  const people = Math.max(0, s.homes - burningOf(s, 'home')) * tier.capacity;
  const shops = Math.max(0, s.shops - burningOf(s, 'shop'));
  const industry = Math.max(0, s.industry - burningOf(s, 'industry'));
  return (
    people *
    RENT *
    (1 + SHOP_BONUS * shops + INDUSTRY_BONUS * industry + DISTRICT_BONUS * (s.districts - 1)) *
    incomeMultiplier(s)
  );
};

// ------------------------------------------------------------------ can-build

export const nextTier = (s: GameState) => TIERS[s.tier + 1];

export const canBuildHome = (s: GameState): boolean =>
  s.homes < homeCapacity(s) && s.happiness >= HAPPINESS_MIN_BUILD && s.cash >= homeCost(s);

export const canBuildShop = (s: GameState): boolean =>
  s.shops < shopCapacity(s) && s.cash >= shopCost(s);

export const canBuildIndustry = (s: GameState): boolean =>
  s.industry < industryCapacity(s) && s.cash >= industryCost(s);

export const canBuildPark = (s: GameState): boolean =>
  s.parks < parkCapacity(s) && s.cash >= parkCost(s);

export const canBuildService = (s: GameState, service: Service): boolean =>
  serviceCount(s, service.key) < serviceAllowed(s, service) && s.cash >= serviceCost(s, service);

export const canRezone = (s: GameState): boolean =>
  nextTier(s) !== undefined && s.homes >= REZONE_MIN_HOMES && s.cash >= rezoneCost(s);

export const canAnnex = (s: GameState): boolean =>
  s.districts < MAX_DISTRICTS &&
  occupancy(s) >= ANNEX_MIN_OCCUPANCY &&
  s.cash >= annexCost(s);

/** Why the annex button is off, phrased for the HUD. */
export function annexBlocker(s: GameState): string | null {
  if (s.districts >= MAX_DISTRICTS) return 'City limits reached';
  if (occupancy(s) < ANNEX_MIN_OCCUPANCY) {
    return `Needs ${Math.round(ANNEX_MIN_OCCUPANCY * 100)}% developed`;
  }
  return null;
}

/**
 * Why the home button is off, phrased for the HUD.
 *
 * Same shape as `annexBlocker`/`rezoneBlocker` so the HUD has one pattern to
 * follow rather than two: a string when the button is dead for a reason worth
 * saying, null when it is only a matter of money.
 */
export function homeBlocker(s: GameState): string | null {
  if (s.homes >= homeCapacity(s)) return 'No housing land left';
  if (s.happiness < HAPPINESS_MIN_BUILD) return 'Residents are leaving';
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

/** Why the rezone button is off, phrased for the HUD. */
export function rezoneBlocker(s: GameState): string | null {
  if (nextTier(s) === undefined) return 'Zoning maxed';
  if (s.homes < REZONE_MIN_HOMES) return `Rezone needs ${REZONE_MIN_HOMES} homes`;
  return null;
}
