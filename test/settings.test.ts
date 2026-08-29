import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  SettingsStore,
  load,
  persist,
  readSettings,
  resolveMotion,
  systemPrefersReducedMotion,
  type Settings,
} from '../src/core/settings';
import { SHADOW_STEPS } from '../src/render/world';
import { Buildings } from '../src/render/buildings';
import { CityLayout } from '../src/sim/layout';
import { Game } from '../src/sim/game';
import { SAVE_KEY, save } from '../src/sim/save';
import { createState, type GameState } from '../src/sim/state';
import { RANK_GATES } from '../src/sim/config';
import { atRank, housedOn, served, trading } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/**
 * A `localStorage` that exists only for one test.
 *
 * Vitest runs in `environment: 'node'`, where `globalThis.localStorage` is
 * undefined and `settings.ts` therefore takes its "no storage" branch — which
 * is itself worth a case. Standing one in for the persistence tests is the only
 * way to exercise the other branch without a browser, and it is a fair stand-in
 * because the code under test only ever calls `getItem`, `setItem` and
 * `removeItem`.
 */
function fakeStorage(): { store: Map<string, string>; restore: () => void } {
  const store = new Map<string, string>();
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
  return {
    store,
    restore: () => {
      if (had) Object.defineProperty(globalThis, 'localStorage', had);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    },
  };
}

describe('a preference is not simulation', () => {
  it('lives under its own key, nowhere near the save', () => {
    expect(SETTINGS_KEY).toBe('idle-city/settings/v1');
    // The one assertion that stops this ever becoming a save migration. A
    // shadow toggle must never be a reason to bump SAVE_KEY, and a save
    // migration must never be a reason to reset somebody's fog.
    expect(SETTINGS_KEY).not.toBe(SAVE_KEY);
    expect(SETTINGS_KEY.startsWith('idle-city/save/')).toBe(false);
  });

  it('is not a field on GameState, in any form', () => {
    const keys = Object.keys(createState(0));
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      expect(keys, key).not.toContain(key);
    }
    for (const key of ['shadows', 'fog', 'motion', 'fps', 'settings', 'quality']) {
      expect(keys, key).not.toContain(key);
    }
  });

  it('is not written by a save, and a save does not write it', () => {
    const fake = fakeStorage();
    try {
      persist({ ...DEFAULT_SETTINGS, shadows: 'off', fog: false });
      save(state({ ...housedOn(24) }), 0);
      // Two keys, two owners. The save did not touch the preferences and the
      // preferences did not touch the save.
      expect(fake.store.has(SETTINGS_KEY)).toBe(true);
      expect(fake.store.has(SAVE_KEY)).toBe(true);
      expect(load().shadows).toBe('off');
      expect(load().fog).toBe(false);
    } finally {
      fake.restore();
    }
  });

  it('survives a reset and an ascension, because neither knows it exists', () => {
    const fake = fakeStorage();
    try {
      persist({ ...DEFAULT_SETTINGS, shadows: 'low', motion: 'reduced', fps: false });
      const game = new Game(state({ ...housedOn(240), ...trading(200), ...served(), districts: 14 }));

      game.reset();
      expect(game.state.homes).toBe(0);
      expect(load()).toEqual({ ...DEFAULT_SETTINGS, shadows: 'low', motion: 'reduced', fps: false });

      const rich = new Game(
        state({ ...atRank(RANK_GATES.ascend, 6), ...trading(40), ...served(), cash: 5_000 }),
      );
      expect(rich.ascend()).toBe(true);
      expect(rich.state.foundings).toBeGreaterThan(1);
      expect(load()).toEqual({ ...DEFAULT_SETTINGS, shadows: 'low', motion: 'reduced', fps: false });
    } finally {
      fake.restore();
    }
  });
});

describe('what a machine that has never set one gets', () => {
  it('gives every setting a defined value', () => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      expect(value, key).toBeDefined();
    }
    // And the reader agrees with the defaults on every shape of nothing.
    for (const junk of [null, undefined, 7, 'yes', [1, 2, 3], {}, { shadows: 'ultra' }]) {
      expect(readSettings(junk)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('reads with no storage at all, which is what a private window is', () => {
    // `environment: 'node'` has no localStorage, so this is the real branch
    // rather than a simulated one.
    expect(typeof globalThis.localStorage).toBe('undefined');
    expect(load()).toEqual(DEFAULT_SETTINGS);
    // And writing is silent rather than fatal, which is the whole contract.
    expect(() => persist({ ...DEFAULT_SETTINGS, fog: false })).not.toThrow();
  });

  it('keeps the fields it knows and drops the ones it does not', () => {
    const read = readSettings({
      shadows: 'low',
      fog: false,
      motion: 'full',
      fps: false,
      // A field from a build that does not exist yet, and one that never will.
      volume: 0.8,
      shadowsUltra: true,
    });
    expect(read).toEqual({ shadows: 'low', fog: false, motion: 'full', fps: false });
    // Field by field against the defaults, so a half-written file is not fatal.
    expect(readSettings({ fog: false })).toEqual({ ...DEFAULT_SETTINGS, fog: false });
    expect(readSettings({ shadows: 'off', motion: 'nonsense' })).toEqual({
      ...DEFAULT_SETTINGS,
      shadows: 'off',
    });
  });
});

describe('the defaults are what master rendered', () => {
  it('sets the shadow map to exactly what World has always constructed', () => {
    // The literals `World` carried before there was a panel: `shadowMap.enabled
    // = true`, `PCFSoftShadowMap`, `mapSize.set(2048, 2048)`.
    expect(DEFAULT_SETTINGS.shadows).toBe('high');
    expect(SHADOW_STEPS.high).toEqual({
      enabled: true,
      size: 2048,
      type: THREE.PCFSoftShadowMap,
      // Everything the layer has always cast, including the dressing.
      dressing: true,
    });
    // And the cheaper steps move texels and filter, never the frustum span —
    // the fixed span is what keeps texel density constant however far the city
    // spreads, and a step that widened it would make a big city worse.
    expect(SHADOW_STEPS.low.size).toBeLessThan(SHADOW_STEPS.high.size);
    expect(SHADOW_STEPS.low.enabled).toBe(true);
    expect(SHADOW_STEPS.off.enabled).toBe(false);
  });

  it('leaves the fog on, the readout on, and motion following the machine', () => {
    expect(DEFAULT_SETTINGS.fog).toBe(true);
    expect(DEFAULT_SETTINGS.fps).toBe(true);
    expect(DEFAULT_SETTINGS.motion).toBe('system');
    // `system` resolves to precisely the `matchMedia` read `prefersReducedMotion`
    // used to make inline — which in node, with no matchMedia, is false.
    expect(resolveMotion('system')).toBe(systemPrefersReducedMotion());
    expect(resolveMotion('full')).toBe(false);
    expect(resolveMotion('reduced')).toBe(true);
  });

  it('builds the same building layer with the defaults as without any', () => {
    // The one setting that touches existing behaviour. A layer built the way
    // `View` builds it under DEFAULT_SETTINGS has to be the layer master built
    // from its own inline `matchMedia` read — and the observable difference
    // between reduced and full motion is whether cages are drawn at all.
    const asDefault = new Buildings(
      new THREE.Scene(),
      new CityLayout(),
      resolveMotion(DEFAULT_SETTINGS.motion),
    );
    const asMaster = new Buildings(new THREE.Scene(), new CityLayout());
    for (const layer of [asDefault, asMaster]) layer.sync(state({ ...housedOn(24) }), 0);
    asDefault.update(0.1);
    asMaster.update(0.1);
    expect(asDefault.scaffolds).toBe(asMaster.scaffolds);
    expect(asDefault.scaffolds).toBeGreaterThan(0);
  });
});

describe('the store', () => {
  let fake: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    fake = fakeStorage();
  });
  afterEach(() => {
    fake.restore();
  });

  it('opens on the defaults and persists the first change', () => {
    const store = new SettingsStore();
    expect(store.value).toEqual(DEFAULT_SETTINGS);
    expect(fake.store.has(SETTINGS_KEY)).toBe(false);
    store.set('shadows', 'off');
    expect(store.value.shadows).toBe('off');
    // The whole object, so a later build reading a field this one did not
    // change still finds it.
    expect(JSON.parse(fake.store.get(SETTINGS_KEY) ?? '{}')).toEqual({
      ...DEFAULT_SETTINGS,
      shadows: 'off',
    });
  });

  it('announces a change once, and says nothing when nothing moved', () => {
    const store = new SettingsStore();
    const seen: Settings[] = [];
    store.onChange = (settings) => void seen.push(settings);
    store.set('fog', false);
    store.set('fog', false);
    store.set('fog', true);
    expect(seen.map((s) => s.fog)).toEqual([false, true]);
  });

  it('resolves motion for its consumers rather than making them do it', () => {
    const store = new SettingsStore();
    expect(store.reducedMotion).toBe(systemPrefersReducedMotion());
    store.set('motion', 'reduced');
    expect(store.reducedMotion).toBe(true);
    store.set('motion', 'full');
    expect(store.reducedMotion).toBe(false);
  });

  it('comes back on the next session exactly as it was left', () => {
    const first = new SettingsStore();
    first.set('shadows', 'low');
    first.set('fog', false);
    first.set('fps', false);
    const second = new SettingsStore();
    expect(second.value).toEqual({ ...DEFAULT_SETTINGS, shadows: 'low', fog: false, fps: false });
  });

  it('survives a file somebody edited by hand', () => {
    fake.store.set(SETTINGS_KEY, '{ not json');
    expect(new SettingsStore().value).toEqual(DEFAULT_SETTINGS);
    fake.store.set(SETTINGS_KEY, JSON.stringify({ shadows: 42, fog: 'yes', motion: null }));
    expect(new SettingsStore().value).toEqual(DEFAULT_SETTINGS);
  });
});
