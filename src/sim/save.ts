import { MAX_DISTRICTS, TIERS } from './config';
import {
  clampDemand,
  homeCapacity,
  industryCapacity,
  residentialPlots,
  shopCapacity,
} from './economy';
import { createState, SAVE_VERSION, type GameState } from './state';

export const SAVE_KEY = 'idle-city/save/v2';

/**
 * Keys this game has written in the past, newest first.
 *
 * A version bump changes where the save lives, and a player who comes back to a
 * new build has not agreed to lose their city — so a v2 miss falls back through
 * the older keys and lets `migrate` bring whatever it finds forward.
 */
const LEGACY_SAVE_KEYS = ['idle-city/save/v1'] as const;

/** Storage can be absent (private mode, sandboxes) — the game must still run. */
function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    const probe = '__idle-city_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const count = (v: unknown): number => Math.max(0, Math.floor(num(v, 0)));

/** Demand is a bounded signal; a save claiming otherwise would buy free plots. */
const demand = (v: unknown): number => clampDemand(num(v, 0));

/**
 * Rebuilds a state from untrusted JSON. Anything missing, malformed or out of
 * range is clamped rather than rejected: a save that has fallen behind a
 * balance change should still open, just legally.
 */
export function migrate(raw: unknown, now = Date.now()): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const base = createState(now);
  const districts = Math.min(MAX_DISTRICTS, Math.max(1, Math.floor(num(r['districts'], 1))));
  const tier = Math.min(TIERS.length - 1, Math.max(0, Math.floor(num(r['tier'], 0))));

  const state: GameState = {
    version: SAVE_VERSION,
    cash: Math.max(0, num(r['cash'], base.cash)),
    elapsed: Math.max(0, num(r['elapsed'], 0)),
    homes: count(r['homes']),
    shops: count(r['shops']),
    // A v1 save has none of these; every one defaults to nothing built and no
    // demand, which is exactly the state a fresh city starts in.
    industry: count(r['industry']),
    schools: count(r['schools']),
    clinics: count(r['clinics']),
    stations: count(r['stations']),
    demandR: demand(r['demandR']),
    demandC: demand(r['demandC']),
    demandI: demand(r['demandI']),
    tier,
    districts,
    earned: Math.max(0, num(r['earned'], 0)),
    autoDevelop: r['autoDevelop'] === true,
    savedAt: num(r['savedAt'], now),
  };

  // Civic buildings first, and against each other: they share the residential
  // zone with housing, and `homeCapacity` subtracts them. Clamping homes before
  // the civic counts were legal would leave a save with a house on a school.
  let civicRoom = residentialPlots(state);
  const fitCivic = (built: number): number => {
    const kept = Math.min(built, civicRoom);
    civicRoom -= kept;
    return kept;
  };
  state.schools = fitCivic(state.schools);
  state.clinics = fitCivic(state.clinics);
  state.stations = fitCivic(state.stations);

  // A shrunken district count (a balance change, or a doctored save) must never
  // leave buildings pointing at plots that no longer exist.
  state.homes = Math.min(state.homes, homeCapacity(state));
  state.shops = Math.min(state.shops, shopCapacity(state));
  state.industry = Math.min(state.industry, industryCapacity(state));
  return state;
}

export function load(now = Date.now()): GameState | null {
  const s = storage();
  if (!s) return null;
  for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS]) {
    const text = s.getItem(key);
    if (!text) continue;
    try {
      const state = migrate(JSON.parse(text), now);
      if (state) return state;
    } catch {
      // A corrupt entry under one key is not a reason to ignore an older one
      // that might still be readable.
    }
  }
  return null;
}

/**
 * Writes the save and returns the timestamp it was stamped with. The caller is
 * expected to hand that back to the game, so `secondsAway` has something to
 * measure from — this function deliberately does not reach in and mutate it.
 */
export function save(state: Readonly<GameState>, now = Date.now()): number {
  const s = storage();
  if (s) {
    try {
      s.setItem(SAVE_KEY, JSON.stringify({ ...state, savedAt: now }));
    } catch {
      // Quota, or a browser locked down mid-session. Losing a save is not worth
      // a crash: the game keeps running and the next autosave may well succeed.
    }
  }
  return now;
}

/** Seconds elapsed since the save was written, floored at zero for clock skew. */
export function secondsAway(state: Readonly<GameState>, now = Date.now()): number {
  return Math.max(0, (now - state.savedAt) / 1000);
}
