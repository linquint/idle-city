import { MAX_DISTRICTS, TIERS } from './config';
import { homeCapacity, shopCapacity } from './economy';
import { createState, SAVE_VERSION, type GameState } from './state';

export const SAVE_KEY = 'idle-city/save/v1';

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
    homes: Math.max(0, Math.floor(num(r['homes'], 0))),
    shops: Math.max(0, Math.floor(num(r['shops'], 0))),
    tier,
    districts,
    earned: Math.max(0, num(r['earned'], 0)),
    autoDevelop: r['autoDevelop'] === true,
    savedAt: num(r['savedAt'], now),
  };

  // A shrunken district count (a balance change, or a doctored save) must never
  // leave buildings pointing at plots that no longer exist.
  state.homes = Math.min(state.homes, homeCapacity(state));
  state.shops = Math.min(state.shops, shopCapacity(state));
  return state;
}

export function load(now = Date.now()): GameState | null {
  const s = storage();
  if (!s) return null;
  const text = s.getItem(SAVE_KEY);
  if (!text) return null;
  try {
    return migrate(JSON.parse(text), now);
  } catch {
    return null;
  }
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
