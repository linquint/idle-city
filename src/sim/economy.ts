import {
  ANNEX_BASE,
  ANNEX_GROWTH,
  ANNEX_MIN_OCCUPANCY,
  CIVIC_GROWTH,
  DEMAND_SCALE,
  DEMAND_TAU,
  DISTRICT_BONUS,
  EXPORT_BASE,
  EXPORT_PER_DISTRICT,
  HAPPINESS_FLOOR,
  HOME_BASE,
  HOME_GROWTH,
  INDUSTRIAL_OUTPUT,
  INDUSTRY_BASE,
  INDUSTRY_BONUS,
  INDUSTRY_GROWTH,
  JOBS_PER_COMMERCIAL,
  JOBS_PER_INDUSTRIAL,
  MAX_DISTRICTS,
  PRICE_DISCOUNT_MAX,
  PRICE_SURCHARGE_MAX,
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
  COMMERCIAL_PER_DISTRICT,
  INDUSTRIAL_PER_DISTRICT,
  RESIDENTIAL_PER_DISTRICT,
} from './layout.ts';
import type { GameState } from './state.ts';

/** Pure reads over a state. No mutation lives in this file. */

export const tierOf = (s: GameState) => TIERS[Math.min(s.tier, TIERS.length - 1)]!;

/**
 * The band every demand signal lives in. Exported because three places have to
 * agree on it: the targets, the integrator, and whatever a save file claims.
 */
export const clampDemand = (n: number): number => Math.max(-1, Math.min(1, n));

// ------------------------------------------------------------------ capacity

/** Civic buildings, of every kind. They stand on residential land. */
export const civicBuildings = (s: GameState): number => s.schools + s.clinics + s.stations;

/** Residential land, before civic buildings take their share of it. */
export const residentialPlots = (s: GameState): number =>
  s.districts * RESIDENTIAL_PER_DISTRICT;

/**
 * A school is a house that will never be built. Subtracting civic buildings
 * here rather than counting them separately is what gives services a real
 * price in land instead of a free footprint, and it is the reason `migrate`
 * has to clamp civic counts before it clamps homes.
 */
export const homeCapacity = (s: GameState): number =>
  Math.max(0, residentialPlots(s) - civicBuildings(s));

/** Room left in the residential zone for another service. */
export const civicCapacity = (s: GameState): number =>
  Math.max(0, residentialPlots(s) - s.homes);

export const shopCapacity = (s: GameState): number => s.districts * COMMERCIAL_PER_DISTRICT;
export const industryCapacity = (s: GameState): number => s.districts * INDUSTRIAL_PER_DISTRICT;

/** Every buildable plot the city owns, civic land included. */
export const plotCapacity = (s: GameState): number =>
  residentialPlots(s) + shopCapacity(s) + industryCapacity(s);

/** A civic building is development too, so it counts against the same total. */
export const plotsUsed = (s: GameState): number =>
  s.homes + s.shops + s.industry + civicBuildings(s);

export const occupancy = (s: GameState): number => plotsUsed(s) / plotCapacity(s);

export const residents = (s: GameState): number => s.homes * tierOf(s).capacity;

// ------------------------------------------------------------------ services

export type ServiceKey = Service['key'];

export const serviceCount = (s: GameState, key: ServiceKey): number =>
  key === 'school' ? s.schools : key === 'clinic' ? s.clinics : s.stations;

/** How many of a service the current population would need for full cover. */
export const serviceNeeded = (s: GameState, service: Service): number =>
  Math.ceil(residents(s) / service.capacity);

/** Share of the population a service reaches, capped at everybody. */
export const coverage = (s: GameState, service: Service): number =>
  Math.min(1, (serviceCount(s, service.key) * service.capacity) / Math.max(1, residents(s)));

export interface ServiceReading {
  readonly service: Service;
  readonly built: number;
  readonly needed: number;
  readonly coverage: number;
}

/** The whole services block, in one read, for the HUD. */
export const serviceReadings = (s: GameState): readonly ServiceReading[] =>
  SERVICES.map((service) => ({
    service,
    built: serviceCount(s, service.key),
    needed: serviceNeeded(s, service),
    coverage: coverage(s, service),
  }));

/** Weighted coverage, in [0, 1]. The weights are the ones in SERVICES. */
export const happiness = (s: GameState): number =>
  SERVICES.reduce((sum, service) => sum + service.weight * coverage(s, service), 0);

/**
 * What happiness does to the ledger. Floored, never zeroed: a neglected city
 * should feel like one that has stopped growing, not one that has been fined.
 */
export const incomeMultiplier = (s: GameState): number =>
  HAPPINESS_FLOOR + (1 - HAPPINESS_FLOOR) * happiness(s);

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
  r: Math.min(happiness(s), clampDemand((jobs(s) - workers(s)) / DEMAND_SCALE)),
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

/** Services are not demand-priced: nobody haggles over a clinic. */
export const serviceCost = (s: GameState, service: Service): number =>
  service.base * CIVIC_GROWTH ** serviceCount(s, service.key);

export const rezoneCost = (s: GameState): number => REZONE_BASE * REZONE_GROWTH ** s.tier;
export const annexCost = (s: GameState): number => ANNEX_BASE * ANNEX_GROWTH ** (s.districts - 1);

// -------------------------------------------------------------------- income

export const income = (s: GameState): number =>
  residents(s) *
  RENT *
  (1 + SHOP_BONUS * s.shops + INDUSTRY_BONUS * s.industry + DISTRICT_BONUS * (s.districts - 1)) *
  incomeMultiplier(s);

// ------------------------------------------------------------------ can-build

export const nextTier = (s: GameState) => TIERS[s.tier + 1];

export const canBuildHome = (s: GameState): boolean =>
  s.homes < homeCapacity(s) && s.cash >= homeCost(s);

export const canBuildShop = (s: GameState): boolean =>
  s.shops < shopCapacity(s) && s.cash >= shopCost(s);

export const canBuildIndustry = (s: GameState): boolean =>
  s.industry < industryCapacity(s) && s.cash >= industryCost(s);

export const canBuildService = (s: GameState, service: Service): boolean =>
  civicBuildings(s) < civicCapacity(s) && s.cash >= serviceCost(s, service);

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

/** Why the rezone button is off, phrased for the HUD. */
export function rezoneBlocker(s: GameState): string | null {
  if (nextTier(s) === undefined) return 'Zoning maxed';
  if (s.homes < REZONE_MIN_HOMES) return `Rezone needs ${REZONE_MIN_HOMES} homes`;
  return null;
}
