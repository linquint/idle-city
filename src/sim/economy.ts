import {
  ANNEX_BASE,
  ANNEX_GROWTH,
  ANNEX_MIN_OCCUPANCY,
  DISTRICT_BONUS,
  HOME_BASE,
  HOME_GROWTH,
  MAX_DISTRICTS,
  RENT,
  REZONE_BASE,
  REZONE_GROWTH,
  REZONE_MIN_HOMES,
  SHOP_BASE,
  SHOP_BONUS,
  SHOP_GROWTH,
  TIERS,
} from './config';
import {
  COMMERCIAL_PER_DISTRICT,
  INDUSTRIAL_PER_DISTRICT,
  RESIDENTIAL_PER_DISTRICT,
} from './layout';
import type { GameState } from './state';

/** Pure reads over a state. No mutation lives in this file. */

export const tierOf = (s: GameState) => TIERS[Math.min(s.tier, TIERS.length - 1)]!;

export const homeCapacity = (s: GameState): number => s.districts * RESIDENTIAL_PER_DISTRICT;
export const shopCapacity = (s: GameState): number => s.districts * COMMERCIAL_PER_DISTRICT;
/**
 * Industrial land is zoned and ordered but nothing builds on it yet, so it is
 * deliberately outside `plotCapacity` — counting it would tell the player their
 * city is a fifth empty and stall annexation behind an occupancy bar that can
 * never fill. The ledger shows it separately instead.
 */
export const industryCapacity = (s: GameState): number => s.districts * INDUSTRIAL_PER_DISTRICT;

export const plotCapacity = (s: GameState): number => homeCapacity(s) + shopCapacity(s);
export const plotsUsed = (s: GameState): number => s.homes + s.shops;
export const occupancy = (s: GameState): number => plotsUsed(s) / plotCapacity(s);

export const residents = (s: GameState): number => s.homes * tierOf(s).capacity;

export const income = (s: GameState): number =>
  residents(s) *
  RENT *
  (1 + SHOP_BONUS * s.shops + DISTRICT_BONUS * (s.districts - 1));

export const homeCost = (s: GameState): number => HOME_BASE * HOME_GROWTH ** s.homes;
export const shopCost = (s: GameState): number => SHOP_BASE * SHOP_GROWTH ** s.shops;
export const rezoneCost = (s: GameState): number => REZONE_BASE * REZONE_GROWTH ** s.tier;
export const annexCost = (s: GameState): number => ANNEX_BASE * ANNEX_GROWTH ** (s.districts - 1);

export const nextTier = (s: GameState) => TIERS[s.tier + 1];

export const canBuildHome = (s: GameState): boolean =>
  s.homes < homeCapacity(s) && s.cash >= homeCost(s);

export const canBuildShop = (s: GameState): boolean =>
  s.shops < shopCapacity(s) && s.cash >= shopCost(s);

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
