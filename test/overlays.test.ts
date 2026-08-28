import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Zones, ZONE_MODES, type ZoneMode } from '../src/render/zones';
import { LEVELS, MAX_DISTRICTS } from '../src/sim/config';
import { homeCapacity, industryCapacity, shopCapacity } from '../src/sim/economy';
import { CityLayout } from '../src/sim/layout';
import { createState, type GameState } from '../src/sim/state';
import { housedOn, making, served, trading, zoning } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/** Every mode but `off`, which draws nothing by definition. */
const DRAWN: readonly ZoneMode[] = ZONE_MODES.map((mode) => mode.key).filter((key) => key !== 'off');

const bare = (): GameState => state({ ...zoning(MAX_DISTRICTS) });

/** A 49-district city with every plot developed at `level`. */
function full(level: number): GameState {
  const land = bare();
  return state({
    ...zoning(MAX_DISTRICTS),
    ...housedOn(homeCapacity(land), level),
    ...trading(shopCapacity(land), level),
    ...making(industryCapacity(land), level),
    ...served(),
  });
}

const zones = (): { zones: Zones; scene: THREE.Scene } => {
  const scene = new THREE.Scene();
  return { zones: new Zones(scene, new CityLayout()), scene };
};

describe('the overlay set', () => {
  it('names a mode for every key, and no key twice', () => {
    const keys = ZONE_MODES.map((mode) => mode.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toBe('off');
    for (const mode of ZONE_MODES) {
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.note.length).toBeGreaterThan(0);
    }
  });

  it('has no pollution mode, because there is no pollution number', () => {
    // The one mode the brief asked for that the simulation cannot honestly
    // carry — see NOTES.md section 9, where it is written up as the feature it
    // would have to be first.
    expect(ZONE_MODES.map((mode) => mode.key)).not.toContain('pollution');
  });

  it('cycles forwards and backwards through every mode', () => {
    const { zones: z } = zones();
    // A cycle from `off` lands on the *next* mode, so the round trip is the
    // list rotated by one and back to where it started.
    const keys = ZONE_MODES.map((mode) => mode.key);
    const forwards: ZoneMode[] = [];
    for (let i = 0; i < keys.length; i++) forwards.push(z.cycle());
    expect(forwards).toEqual([...keys.slice(1), 'off']);
    expect(z.current).toBe('off');
    // And round again the other way, which is what Shift-Z is for.
    const back: ZoneMode[] = [];
    for (let i = 0; i < keys.length; i++) back.push(z.cycle(true));
    expect(back).toEqual([...keys].reverse());
    expect(z.current).toBe('off');
  });

  it('draws nothing at all when it is off', () => {
    // An empty city, because a *fully built* one has no unbuilt plots left to
    // draw a pad on — which is a fact worth knowing and is asserted below.
    const { zones: z } = zones();
    z.set('plan');
    expect(z.sync(bare())).toBe(true);
    expect(z.instances).toBeGreaterThan(0);
    z.set('off');
    expect(z.sync(bare())).toBe(false);
    expect(z.instances).toBe(0);
    expect(z.enabled).toBe(false);
  });
});

describe('what each mode costs', () => {
  /**
   * The instance counts the design was sized against.
   *
   * An empty 49-district city has every zoned plot unbuilt, which is the worst
   * case for the plot pads: 4,018 of them, one InstancedMesh, one draw call.
   * The traffic mode is the other shape entirely — it follows the road cells,
   * which are 81 a district by construction and do not move as the city builds.
   */
  it('draws one instance per unbuilt plot, and one per road cell', () => {
    const { zones: z } = zones();
    const empty = bare();

    z.set('plan');
    z.sync(empty);
    const plots = z.instances;
    expect(plots).toBe(4_018);

    z.set('traffic');
    z.sync(empty);
    // 81 road cells a district, every district — see ROAD_CELLS_PER_DISTRICT.
    expect(z.instances).toBe(81 * MAX_DISTRICTS);

    // The plot pads shrink as the city builds on the land; the roads do not.
    z.set('plan');
    z.sync(full(LEVELS - 1));
    expect(z.instances).toBeLessThan(plots / 4);
    // A city built out at level 0 has nothing unbuilt left at all.
    z.sync(full(0));
    expect(z.instances).toBe(0);
    z.set('traffic');
    z.sync(full(LEVELS - 1));
    expect(z.instances).toBe(81 * MAX_DISTRICTS);
  });

  it('rebuilds once and then not again, in every mode', () => {
    // The stamp guard, which is the whole reason an overlay over four thousand
    // plots is affordable at all. Every mode has to carry whatever *it* reads
    // in its stamp: a mode reading a number the stamp did not cover would paint
    // once and never notice it had changed.
    const s = full(1);
    for (const mode of DRAWN) {
      const { zones: z } = zones();
      z.set(mode);
      expect(z.sync(s), `${mode} should build`).toBe(true);
      expect(z.sync(s), `${mode} should not rebuild`).toBe(false);
      expect(z.sync(s), `${mode} should not rebuild`).toBe(false);
    }
  });

  it('notices the number its own mode reads', () => {
    const s = full(1);
    const cases: Array<[ZoneMode, Partial<GameState>]> = [
      ['plan', { homes: s.homes - 1 }],
      ['demand', { demandC: (s.demandC ?? 0) + 0.5 }],
      ['coverage', { hospitals: 0, hospitalStaff: 0 }],
      ['order', { mergedC: s.mergedC + 1 }],
    ];
    for (const [mode, patch] of cases) {
      const { zones: z } = zones();
      z.set(mode);
      expect(z.sync(s)).toBe(true);
      expect(z.sync({ ...s, ...patch }), `${mode} should notice its own input`).toBe(true);
    }
    // Traffic follows congestion and the district count, and nothing else.
    const { zones: z } = zones();
    z.set('traffic');
    expect(z.sync(s)).toBe(true);
    expect(z.sync({ ...s, depots: 400, depotStaff: 1 })).toBe(true);
  });
});

describe('the per-slot overlay the buildings take', () => {
  it('is null when the overlay is off and a function otherwise', () => {
    const { zones: z } = zones();
    const s = full(1);
    expect(z.overlay(s)).toBeNull();
    for (const mode of DRAWN) {
      z.set(mode);
      const source = z.overlay(s);
      expect(source, mode).not.toBeNull();
      expect(typeof source?.('home', 0)).toBe('number');
    }
  });

  it('varies by slot for the modes about built land, and not for the others', () => {
    const s = full(0);
    const readings = (mode: ZoneMode): number[] => {
      const { zones: z } = zones();
      z.set(mode);
      const source = z.overlay(s);
      if (!source) return [];
      return [0, 20, 200, 900].map((slot) => source('home', slot));
    };
    // Zoning and demand state which zone a building is in, so every home reads
    // the same — which is exactly why `setOverlay` used to be one hex.
    expect(new Set(readings('plan')).size).toBe(1);
    expect(new Set(readings('demand')).size).toBe(1);
    // Land value and build order differ from one building to the next, which is
    // the change: `bodyColor` already took a hex per instance.
    expect(new Set(readings('value')).size).toBeGreaterThan(1);
    expect(new Set(readings('order')).size).toBeGreaterThan(1);
  });

  it('says nothing about a plot its mode has nothing to say about', () => {
    const { zones: z } = zones();
    z.set('value');
    const source = z.overlay(full(0));
    expect(source).not.toBeNull();
    // Land value multiplies rent, and rent is paid by residents. A shop's plot
    // has a centrality the ledger has never read, so it reads as unmeasured.
    const shop = source?.('shop', 0);
    const works = source?.('industry', 0);
    expect(shop).toBe(works);
    expect(shop).not.toBe(source?.('home', 0));
  });
});
