import { LEVELS, MAX_ACTIVE_FIRES, MAX_DISTRICTS, OCCUPANCY_FULL, SERVICES } from './config';
import {
  burnableOf,
  clampDemand,
  cohortTotal,
  happinessTarget,
  homeCapacity,
  industryCapacity,
  parkCapacity,
  serviceAllowed,
  shopCapacity,
} from './economy';
import {
  cohortOf,
  createState,
  SAVE_VERSION,
  type Fire,
  type FireKind,
  type GameState,
  type LevelCohort,
} from './state';

export const SAVE_KEY = 'idle-city/save/v5';

/**
 * Keys this game has written in the past, newest first.
 *
 * A version bump changes where the save lives, and a player who comes back to a
 * new build has not agreed to lose their city — so a v5 miss falls back through
 * the older keys and lets `migrate` bring whatever it finds forward.
 */
const LEGACY_SAVE_KEYS = [
  'idle-city/save/v4',
  'idle-city/save/v3',
  'idle-city/save/v2',
  'idle-city/save/v1',
] as const;

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

/** Staffing and happiness are shares. A save claiming 9 gets 1. */
const share = (v: unknown, fallback: number): number =>
  Math.max(0, Math.min(1, num(v, fallback)));

/**
 * Rebuilds one zone's level cohort from untrusted JSON.
 *
 * Three shapes arrive here. A v5 save has the array, which is read a level at a
 * time and never past LEVELS — a save claiming a fifth level simply does not
 * have one to claim. A v4 save has no array but does have a global `tier`, and
 * the honest reading of "the whole city is towers" is a cohort with every
 * standing building at that level, which is what `fallback` carries in. Anything
 * older has neither and starts where a fresh city does, at level 0.
 *
 * Whatever arrives is then reconciled to `standing` rather than trusted, because
 * the sum is the one invariant the rest of the game reads: buildings are trimmed
 * from the newest end — lowest level first, the same rule abandonment and
 * demolition use — and any shortfall is topped up at level 0.
 */
function migrateCohort(raw: unknown, standing: number, fallback: number): LevelCohort {
  const levels = cohortOf();
  if (Array.isArray(raw)) {
    for (let l = 0; l < LEVELS; l++) levels[l] = count(raw[l]);
  } else {
    levels[Math.min(LEVELS - 1, Math.max(0, Math.floor(fallback)))] = standing;
  }

  let over = cohortTotal(levels) - standing;
  for (let l = 0; l < LEVELS && over > 0; l++) {
    const take = Math.min(over, levels[l] ?? 0);
    levels[l] = (levels[l] ?? 0) - take;
    over -= take;
  }
  levels[0] = (levels[0] ?? 0) + Math.max(0, standing - cohortTotal(levels));
  return levels;
}

const FIRE_KINDS: readonly FireKind[] = ['home', 'shop', 'industry'];

/**
 * Rebuilds the fire list from untrusted JSON.
 *
 * Three separate things a save could be lying about, and every one of them has
 * a cheap answer: an entry that is not a fire at all is dropped, a fire on a
 * building the city no longer owns is dropped — a v3 save owns none of them, a
 * doctored one may claim home 900 of 19 — and a list claiming four hundred
 * fires is cut to MAX_ACTIVE_FIRES. `startedAt` is clamped into the past
 * because a fire stamped in the future would never age and so never go out.
 */
function migrateFires(raw: unknown, state: GameState): Fire[] {
  if (!Array.isArray(raw)) return [];
  const fires: Fire[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (fires.length >= MAX_ACTIVE_FIRES) break;
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const kind = FIRE_KINDS.find((k) => k === e['kind']);
    if (kind === undefined) continue;
    const index = Math.floor(num(e['index'], -1));
    if (index < 0 || index >= burnableOf(state, kind)) continue;
    const key = `${kind}:${index}`;
    // One building, one fire. Two entries on the same plot would double the
    // happiness hit and take the income off twice.
    if (seen.has(key)) continue;
    seen.add(key);
    fires.push({ kind, index, startedAt: Math.min(state.elapsed, Math.max(0, num(e['startedAt'], 0))) });
  }
  return fires;
}

/**
 * Rebuilds a state from untrusted JSON. Anything missing, malformed or out of
 * range is clamped rather than rejected: a save that has fallen behind a
 * balance change should still open, just legally.
 */
export function migrate(raw: unknown, now = Date.now()): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const base = createState(now);
  const version = Math.max(0, Math.floor(num(r['version'], 0)));
  const districts = Math.min(MAX_DISTRICTS, Math.max(1, Math.floor(num(r['districts'], 1))));
  // v4's one global tier. Dropped as a field, but not as information: it is
  // what every building in a v4 city stood at, so it seeds the cohorts below.
  const tier = Math.min(LEVELS - 1, Math.max(0, Math.floor(num(r['tier'], 0))));

  const state: GameState = {
    version: SAVE_VERSION,
    cash: Math.max(0, num(r['cash'], base.cash)),
    elapsed: Math.max(0, num(r['elapsed'], 0)),
    homes: count(r['homes']),
    shops: count(r['shops']),
    // A v1 save has none of these; every one defaults to nothing built and no
    // demand, which is exactly the state a fresh city starts in.
    industry: count(r['industry']),
    // Filled in below, once the counts and the write-offs they answer to are
    // legal — a cohort has to sum to something before it can be summed to it.
    homeLevels: cohortOf(),
    shopLevels: cohortOf(),
    industryLevels: cohortOf(),
    // Not zero. A save carrying no occupancy at all is every save written
    // before this version, and zero would read as a city in the middle of
    // being abandoned the instant it opened — the vacancy clock would start on
    // the first tick and the player would watch their city rot for no reason
    // they could see. A v4 city's residents were `homes x capacity`, which is
    // implicitly full, so the faithful default is the value a happy city
    // settles at rather than either extreme.
    occupancyR: share(r['occupancyR'], OCCUPANCY_FULL),
    occupancyC: share(r['occupancyC'], OCCUPANCY_FULL),
    occupancyI: share(r['occupancyI'], OCCUPANCY_FULL),
    // A vacancy clock is seconds, so it is floored at zero and nothing else: a
    // save claiming an enormous one only gets to abandon at the usual rate, and
    // the first tick above OCCUPANCY_EMPTY resets it anyway.
    vacantR: Math.max(0, num(r['vacantR'], 0)),
    vacantC: Math.max(0, num(r['vacantC'], 0)),
    vacantI: Math.max(0, num(r['vacantI'], 0)),
    // Clamped against the building counts below, once those are legal.
    abandonedR: count(r['abandonedR']),
    abandonedC: count(r['abandonedC']),
    abandonedI: count(r['abandonedI']),
    // Fractional buildings, so the band is the one `spendDrift` works in. A
    // save outside it would hand the city a free promotion on the first tick.
    driftR: Math.max(-1, Math.min(1, num(r['driftR'], 0))),
    driftC: Math.max(-1, Math.min(1, num(r['driftC'], 0))),
    driftI: Math.max(-1, Math.min(1, num(r['driftI'], 0))),
    // A v3 save has no parks, which is exactly the state a city that never
    // built one is in. Clamped to the land below, like every other count.
    parks: count(r['parks']),
    // v2 called them clinics, schools and stations and stood them on single
    // residential plots. They are the same slot — the building the city buys to
    // raise happiness — so the counts carry across by weight rather than being
    // silently deleted, and the clamps below make whatever arrives legal.
    hospitals: count(r['hospitals'] ?? r['clinics']),
    // v2's `schools` were what became police stations, and a v5 save has a
    // `schools` of its own that means something else entirely. Version is the
    // only thing that can tell them apart, so the old alias is read only from a
    // save old enough to have meant it.
    police: count(r['police'] ?? (version <= 2 ? r['schools'] : undefined)),
    fire: count(r['fire'] ?? r['stations']),
    // A save older than v5 has neither, which is the state a city that never
    // built one is in.
    schools: count(version >= 5 ? r['schools'] : undefined),
    universities: count(r['universities']),
    hospitalStaff: share(r['hospitalStaff'], 0),
    policeStaff: share(r['policeStaff'], 0),
    fireStaff: share(r['fireStaff'], 0),
    schoolStaff: share(r['schoolStaff'], 0),
    universityStaff: share(r['universityStaff'], 0),
    // Filled in below, once the counts it is computed from are legal.
    happiness: 0,
    demandR: demand(r['demandR']),
    demandC: demand(r['demandC']),
    demandI: demand(r['demandI']),
    // Filled in below, once the building counts they point at are legal.
    fires: [],
    // A v3 save has neither, and nothing but zero is a safe default: a negative
    // cursor would index the hash stream backwards and a negative hazard would
    // owe the city a fire it never has to pay.
    fireCursor: Math.max(0, Math.floor(num(r['fireCursor'], 0))),
    fireHazard: Math.max(0, num(r['fireHazard'], 0)),
    districts,
    earned: Math.max(0, num(r['earned'], 0)),
    autoDevelop: r['autoDevelop'] === true,
    savedAt: num(r['savedAt'], now),
  };

  // Buildings before civic counts: `serviceAllowed` is measured against the
  // population, so homes have to be legal before it can be trusted. Civic
  // buildings no longer take housing land, so unlike v2 the order is this way
  // round — there is no zone left for the two to fight over.
  state.homes = Math.min(state.homes, homeCapacity(state));
  state.shops = Math.min(state.shops, shopCapacity(state));
  state.industry = Math.min(state.industry, industryCapacity(state));
  state.parks = Math.min(state.parks, parkCapacity(state));

  // Write-offs cannot outnumber the buildings they are write-offs of, and the
  // cohorts are then reconciled to what is left standing. This order is forced:
  // `standing` is `count - abandoned`, so both have to be legal first.
  state.abandonedR = Math.min(state.abandonedR, state.homes);
  state.abandonedC = Math.min(state.abandonedC, state.shops);
  state.abandonedI = Math.min(state.abandonedI, state.industry);
  state.homeLevels = migrateCohort(r['homeLevels'], state.homes - state.abandonedR, tier);
  state.shopLevels = migrateCohort(r['shopLevels'], state.shops - state.abandonedC, tier);
  state.industryLevels = migrateCohort(
    r['industryLevels'],
    state.industry - state.abandonedI,
    tier,
  );

  // A doctored save with 400 hospitals gets the one its population is allowed,
  // and a save carried over from a smaller district count never keeps a
  // building whose site no longer exists. `serviceAllowed` folds both in.
  for (const service of SERVICES) {
    const allowed = serviceAllowed(state, service);
    if (service.key === 'hospital') state.hospitals = Math.min(state.hospitals, allowed);
    else if (service.key === 'police') state.police = Math.min(state.police, allowed);
    else if (service.key === 'fire') state.fire = Math.min(state.fire, allowed);
    else if (service.key === 'school') state.schools = Math.min(state.schools, allowed);
    else state.universities = Math.min(state.universities, allowed);
  }

  // After the building counts are legal, because a fire is only legal if the
  // building it is burning still exists.
  state.fires = migrateFires(r['fires'], state);

  // Happiness defaults to the coverage the city actually has rather than to a
  // fixed number: handing a returning player the fresh-city 1 would be ninety
  // seconds of free housing every time they reloaded. Computed after the fires
  // land, so a city that was on fire when it was saved reopens unhappy.
  state.happiness = share(r['happiness'], happinessTarget(state));
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
