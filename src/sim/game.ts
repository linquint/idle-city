import { OFFLINE_CAP_SECONDS, TICK_RATE } from './config';
import {
  annexCost,
  canAnnex,
  canBuildHome,
  canBuildShop,
  canRezone,
  homeCost,
  income,
  rezoneCost,
  shopCost,
} from './economy';
import { createState, type GameState } from './state';

export interface AwayReport {
  /** Seconds credited, already clamped to OFFLINE_CAP_SECONDS. */
  seconds: number;
  /** Seconds that were dropped because the cap bit. */
  forfeited: number;
  earned: number;
  homes: number;
  shops: number;
}

const TICK = 1 / TICK_RATE;

/**
 * The simulation. It owns the numbers and nothing else — no DOM, no three.js,
 * no timers. The host drives it with `advance(dt)`; the renderer and HUD only
 * ever read `state`.
 */
export class Game {
  private inner: GameState;
  private accumulator = 0;

  constructor(state: GameState = createState()) {
    this.inner = state;
  }

  get state(): Readonly<GameState> {
    return this.inner;
  }

  /**
   * Advances by wall-clock `dt`, in fixed ticks. Fixed steps keep a 30fps
   * machine and a 144fps machine on identical economies.
   */
  advance(dt: number): void {
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator >= TICK) {
      this.step(TICK);
      this.accumulator -= TICK;
    }
  }

  private step(dt: number): void {
    const s = this.inner;
    const gain = income(s) * dt;
    s.cash += gain;
    s.earned += gain;
    s.elapsed += dt;
    if (s.autoDevelop) this.autoDevelop(8);
  }

  // ---------------------------------------------------------------- actions

  buildHome(): boolean {
    const s = this.inner;
    if (!canBuildHome(s)) return false;
    s.cash -= homeCost(s);
    s.homes++;
    return true;
  }

  buildShop(): boolean {
    const s = this.inner;
    if (!canBuildShop(s)) return false;
    s.cash -= shopCost(s);
    s.shops++;
    return true;
  }

  /**
   * Tier replacement: the plot count never changes, only what stands on it.
   * That is what keeps an exponential economy inside a world you can render.
   */
  rezone(): boolean {
    const s = this.inner;
    if (!canRezone(s)) return false;
    s.cash -= rezoneCost(s);
    s.tier++;
    return true;
  }

  /** The expansion axis: more land, more plots, a permanent civic bonus. */
  annex(): boolean {
    const s = this.inner;
    if (!canAnnex(s)) return false;
    s.cash -= annexCost(s);
    s.districts++;
    return true;
  }

  /** Records when the game was last persisted, so time away can be measured. */
  markSaved(at: number): void {
    this.inner.savedAt = at;
  }

  setAutoDevelop(on: boolean): void {
    this.inner.autoDevelop = on;
  }

  reset(): void {
    this.inner = createState();
    this.accumulator = 0;
  }

  /**
   * Spends surplus cash on whichever plot is cheapest, up to `budget` purchases.
   * Deliberately never rezones or annexes — those are the player's calls.
   */
  private autoDevelop(budget: number): { homes: number; shops: number } {
    const s = this.inner;
    let homes = 0;
    let shops = 0;
    for (let i = 0; i < budget; i++) {
      const h = canBuildHome(s) ? homeCost(s) : Infinity;
      const p = canBuildShop(s) ? shopCost(s) : Infinity;
      if (h === Infinity && p === Infinity) break;
      if (h <= p) {
        this.buildHome();
        homes++;
      } else {
        this.buildShop();
        shops++;
      }
    }
    return { homes, shops };
  }

  /**
   * Credits time away. Income is constant between purchases, so this could be
   * one multiplication — but stepping it in chunks lets auto-development
   * compound the way it would have if you had been watching.
   */
  catchUp(seconds: number, chunks = 24): AwayReport {
    const wanted = Math.max(0, seconds);
    const credited = Math.min(wanted, OFFLINE_CAP_SECONDS);
    const before = { cash: this.inner.cash, homes: this.inner.homes, shops: this.inner.shops };

    const dt = credited / chunks;
    for (let i = 0; i < chunks; i++) this.step(dt);

    const s = this.inner;
    return {
      seconds: credited,
      forfeited: wanted - credited,
      earned: s.cash - before.cash + this.spentSince(before),
      homes: s.homes - before.homes,
      shops: s.shops - before.shops,
    };
  }

  /**
   * Cash handed straight back out by auto-development during a catch-up.
   * Reported as earnings, because from the player's side it was.
   */
  private spentSince(before: { cash: number; homes: number; shops: number }): number {
    const s = this.inner;
    let spent = 0;
    for (let i = before.homes; i < s.homes; i++) {
      spent += homeCost({ ...s, homes: i });
    }
    for (let i = before.shops; i < s.shops; i++) {
      spent += shopCost({ ...s, shops: i });
    }
    return spent;
  }
}
