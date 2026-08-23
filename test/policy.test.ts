import { describe, expect, it } from 'vitest';
import {
  HAPPINESS_TAU,
  LEVELS,
  MAX_DISTRICTS,
  TAX_NEUTRAL,
  TAX_STEPS,
} from '../src/sim/config';
import { happinessTarget, income, taxStep } from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { migrate } from '../src/sim/save';
import { createState, type GameState } from '../src/sim/state';
import { housed, served, trading } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });
const at = (patch: Partial<GameState> = {}): Game => new Game(state(patch));

/** A city with services, money coming in, and nothing else moving. */
const running = (patch: Partial<GameState> = {}): Partial<GameState> => ({
  ...housed(12),
  ...trading(8),
  ...served(),
  happiness: 1,
  occupancyR: 1,
  occupancyC: 1,
  ...patch,
});

describe('the tax rate', () => {
  it('is a small number of discrete steps, neutral in the middle', () => {
    expect(TAX_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(TAX_STEPS.length).toBeLessThanOrEqual(6);
    expect(TAX_STEPS[TAX_NEUTRAL]?.income).toBe(1);
    expect(TAX_STEPS[TAX_NEUTRAL]?.mood).toBe(0);
    // Monotone in both directions: a higher rate always earns more and always
    // costs more mood, or the control would have a step nobody would ever pick.
    for (let i = 1; i < TAX_STEPS.length; i++) {
      expect(TAX_STEPS[i]?.income ?? 0).toBeGreaterThan(TAX_STEPS[i - 1]?.income ?? 0);
      expect(TAX_STEPS[i]?.mood ?? 0).toBeLessThan(TAX_STEPS[i - 1]?.mood ?? 0);
    }
  });

  it('multiplies the ledger and nothing else', () => {
    const neutral = state(running({ taxRate: TAX_NEUTRAL }));
    for (let i = 0; i < TAX_STEPS.length; i++) {
      const step = TAX_STEPS[i] as (typeof TAX_STEPS)[number];
      const taxed = state(running({ taxRate: i }));
      expect(income(taxed)).toBeCloseTo(income(neutral) * step.income, 9);
    }
  });

  it('moves the happiness target without touching the weights', () => {
    // A modifier on earned coverage, like the fire term — not a fifth weight.
    const neutral = state(running({ taxRate: TAX_NEUTRAL }));
    const base = happinessTarget(neutral);
    for (let i = 0; i < TAX_STEPS.length; i++) {
      const step = TAX_STEPS[i] as (typeof TAX_STEPS)[number];
      const taxed = state(running({ taxRate: i }));
      expect(happinessTarget(taxed)).toBeCloseTo(Math.max(0, Math.min(1, base + step.mood)), 9);
    }
  });

  it('is clamped rather than trusted, however it arrives', () => {
    expect(taxStep(state({ taxRate: -4 }))).toBe(TAX_STEPS[0]);
    expect(taxStep(state({ taxRate: 900 }))).toBe(TAX_STEPS[TAX_STEPS.length - 1]);
    const game = at();
    game.setTaxRate(99);
    expect(game.state.taxRate).toBe(TAX_STEPS.length - 1);
    game.setTaxRate(-99);
    expect(game.state.taxRate).toBe(0);
  });

  it('defaults to neutral for a save that predates it', () => {
    const back = migrate({ version: 5, homes: 4, districts: 1 }, 0);
    expect(back?.taxRate).toBe(TAX_NEUTRAL);
    // And a doctored one lands on a step that exists.
    expect(migrate({ taxRate: 42 }, 0)?.taxRate).toBe(TAX_STEPS.length - 1);
    expect(migrate({ taxRate: -3 }, 0)?.taxRate).toBe(0);
  });

  it('applies identically in one long step and in many short ones', () => {
    // Both terms are read inside `step`: income multiplies a rate, and the mood
    // term shifts a lagged target. Neither can be step-size dependent, and this
    // is the test that says so at the coarsest step the game takes.
    //
    // The city is deliberately finished: at the city limits so it cannot annex,
    // at the top level so nothing can promote, and fully covered so nothing
    // decays. What is left moving is the two things the tax rate touches.
    for (let rate = 0; rate < TAX_STEPS.length; rate++) {
      const patch = {
        ...housed(6, LEVELS - 1),
        ...trading(6, LEVELS - 1),
        ...served(),
        districts: MAX_DISTRICTS,
        taxRate: rate,
        cash: 0,
        happiness: 0.5,
      };
      const away = at(patch);
      const watched = at(patch);
      away.catchUp(3_600);
      for (let i = 0; i < 3_600; i++) watched.catchUp(1);
      expect(Math.abs(away.state.cash - watched.state.cash)).toBeLessThan(
        Math.max(1, watched.state.cash * 0.01),
      );
      expect(away.state.happiness).toBeCloseTo(watched.state.happiness, 6);
    }
  });

  it('buys income with mood rather than handing out both', () => {
    // The trade the control exists to offer, measured on a settled city: the
    // top step earns more per second and settles lower on the happiness bar.
    const low = at(running({ taxRate: 0, happiness: 0.5 }));
    const high = at(running({ taxRate: TAX_STEPS.length - 1, happiness: 0.5 }));
    for (let i = 0; i < 20; i++) {
      low.catchUp(HAPPINESS_TAU);
      high.catchUp(HAPPINESS_TAU);
    }
    expect(high.state.happiness).toBeLessThan(low.state.happiness);
    expect(income(high.state)).toBeGreaterThan(income(low.state));
  });
});
