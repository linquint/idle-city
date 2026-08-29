/**
 * What the player has chosen about how the game *looks*, and nowhere else.
 *
 * These are not simulation and they are deliberately kept out of `GameState`.
 * The save is what the city *is* — counts, and three bounded exceptions that
 * each argue for themselves — and a shadow-map size is not something the city
 * is. Two consequences fall straight out of that and both are the point:
 *
 *   - **its own key.** `SAVE_KEY` is `idle-city/save/v12` and `LEGACY_SAVE_KEYS`
 *     walks back eleven versions, every one of them a migration someone had to
 *     write. A preference has no business in that chain: a shadow toggle must
 *     never be a reason to bump the save version, and a save migration must
 *     never be a reason to reset somebody's fog;
 *   - **it survives everything.** `reset()` throws the city away and `ascend()`
 *     founds a new one over the same seed. Neither touches this, because
 *     neither knows it exists. A player who has turned shadows off has turned
 *     shadows off, not turned them off *for this city*.
 *
 * The defaults are what the game did before there was a panel. Every one of
 * them is checked against that in test/settings.test.ts, because "adds a
 * settings panel" and "quietly changes what a fresh install renders" would be
 * the same commit otherwise.
 */

/** Where preferences live. Its own key, its own version. See the header. */
export const SETTINGS_KEY = 'idle-city/settings/v1';

/**
 * How much the shadow map is worth.
 *
 * Three steps rather than a slider, because there are only two decisions in
 * here — how many texels and which filter — and a slider over two decisions is
 * a slider that lies about how much control it offers. `high` is what the game
 * has always done. What each step actually sets is in `SHADOW_STEPS`.
 */
export type ShadowQuality = 'high' | 'low' | 'off';

/**
 * What the player wants of the animation, including the option not to say.
 *
 * Three states and not two, and the third is the default: `system` follows
 * `prefers-reduced-motion`, which is the setting the player already made once,
 * somewhere else, for every application on their machine. An override is
 * offered because the OS switch is coarse — it is the same switch that turns
 * off parallax in a photo gallery — and someone who set it for that may still
 * want traffic on their streets. Overriding it is their call to make; guessing
 * on their behalf is not.
 */
export type MotionSetting = 'system' | 'full' | 'reduced';

export interface Settings {
  readonly shadows: ShadowQuality;
  /** The haze the city sits in. Off leaves the horizon a hard edge. */
  readonly fog: boolean;
  readonly motion: MotionSetting;
  /** The frame-rate readout in the corner. A dev instrument, off by choice. */
  readonly fps: boolean;
  // A volume control belongs here and there is nothing for it to control.
  // `grep -rn "Audio\|AudioContext\|\.mp3\|\.ogg\|volume" src/` returns nothing
  // whatsoever: this game makes no sound, so a slider would move a number that
  // reaches no code. Sound is its own feature with its own asset budget and its
  // own consequences for what a service worker has to precache, and building
  // half of it inside a settings panel would be the wrong half. When it lands,
  // it lands here, as one more readonly field with a default that reproduces
  // silence.
}

/**
 * What the game did before any of this existed.
 *
 * Every value here is a *measurement* of master rather than a taste: `high` is
 * `PCFSoftShadowMap` at 2048 because that is what `World` has always set, `fog`
 * is on because `scene.fog` has always held the haze, `motion` is `system`
 * because `prefersReducedMotion()` read `matchMedia` and nothing else, and
 * `fps` is on because `FpsMeter` appended itself to the body unconditionally.
 * A fresh install renders what it rendered.
 */
export const DEFAULT_SETTINGS: Settings = {
  shadows: 'high',
  fog: true,
  motion: 'system',
  fps: true,
};

const SHADOW_VALUES: readonly ShadowQuality[] = ['high', 'low', 'off'];
const MOTION_VALUES: readonly MotionSetting[] = ['system', 'full', 'reduced'];

/**
 * Storage can be absent — private mode, a sandbox, a Worker — and the game must
 * still run.
 *
 * The same defensive shape `save.ts` uses, and a separate copy of it on
 * purpose: importing the save's helper would tie a preference's lifetime to the
 * save's, which is the coupling this whole file exists to avoid.
 */
function storage(): Storage | null {
  try {
    const store = globalThis.localStorage;
    const probe = '__idle-city_settings_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

const oneOf = <T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T =>
  typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;

const flag = (raw: unknown, fallback: boolean): boolean =>
  typeof raw === 'boolean' ? raw : fallback;

/**
 * Whatever is on disk, read field by field against the defaults.
 *
 * Nothing is trusted and nothing is required. A file from a future version with
 * a field this build has never heard of loses that field and keeps the rest; a
 * file with `shadows: "ultra"` gets `high`; a file that is not an object at all
 * gets the defaults. There is no migration chain here and there should never be
 * one — the whole reason this is not in the save is that a preference can
 * always be answered by "then they get the default", which is a sentence the
 * save can never say about a city.
 */
export function readSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const from = raw as Record<string, unknown>;
  return {
    shadows: oneOf(from['shadows'], SHADOW_VALUES, DEFAULT_SETTINGS.shadows),
    fog: flag(from['fog'], DEFAULT_SETTINGS.fog),
    motion: oneOf(from['motion'], MOTION_VALUES, DEFAULT_SETTINGS.motion),
    fps: flag(from['fps'], DEFAULT_SETTINGS.fps),
  };
}

/** Whether the machine itself asks for less motion. */
export const systemPrefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** What a motion setting means on this machine, right now. */
export const resolveMotion = (setting: MotionSetting): boolean =>
  setting === 'system' ? systemPrefersReducedMotion() : setting === 'reduced';

/**
 * The preferences, held, persisted and announced.
 *
 * A store rather than a module-level singleton, because the tests want one they
 * can build and throw away and the renderer wants one it can be handed. There
 * is exactly one in the running game and `main.ts` owns it, the same way it
 * owns the `Game` and the `View`.
 */
export class SettingsStore {
  private current: Settings;

  /**
   * Told when anything changes, so the renderer can follow.
   *
   * One hook for the whole object rather than one per field: every consumer
   * re-reads what it cares about and the ones that did not change do nothing,
   * which is cheaper to get right than four subscriptions and is called once a
   * click rather than once a frame.
   */
  onChange: ((settings: Readonly<Settings>) => void) | null = null;

  constructor(initial: Settings = load()) {
    this.current = initial;
  }

  get value(): Readonly<Settings> {
    return this.current;
  }

  /** Whether the animation should be held back, resolving `system`. */
  get reducedMotion(): boolean {
    return resolveMotion(this.current.motion);
  }

  /** Writes one field, persists the lot, and announces it. A no-op if unchanged. */
  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    if (this.current[key] === value) return;
    this.current = { ...this.current, [key]: value };
    persist(this.current);
    this.onChange?.(this.current);
  }
}

/** What is on disk, or the defaults. Never throws, whatever is in there. */
export function load(): Settings {
  const store = storage();
  if (!store) return DEFAULT_SETTINGS;
  try {
    const raw = store.getItem(SETTINGS_KEY);
    return raw === null ? DEFAULT_SETTINGS : readSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Writes the preferences. Silent when there is nowhere to write them. */
export function persist(settings: Settings): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A full quota is not worth breaking a frame over. The player's shadows
    // stay off for this session and come back on the next one, which is a far
    // better outcome than a thrown exception on the click that set them.
  }
}
