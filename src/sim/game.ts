import {
  CATCHUP_MAX_STEPS,
  CATCHUP_STEP_SECONDS,
  OFFLINE_CAP_SECONDS,
  SERVICES,
  TICK_RATE,
  type Service,
} from './config.ts';
import {
  annexCost,
  canAnnex,
  canBuildHome,
  canBuildIndustry,
  canBuildService,
  canBuildShop,
  canRezone,
  civicBuildings,
  clampDemand,
  demandStep,
  demandTargets,
  happinessStep,
  happinessTarget,
  homeCost,
  income,
  industryCost,
  residents,
  rezoneCost,
  serviceCost,
  serviceCount,
  serviceNeeded,
  shopCost,
  staffAfterBuild,
  staffStep,
} from './economy.ts';
import { createState, type GameState } from './state.ts';

export interface AwayReport {
  /** Seconds credited, already clamped to OFFLINE_CAP_SECONDS. */
  seconds: number;
  /** Seconds that were dropped because the cap bit. */
  forfeited: number;
  earned: number;
  /**
   * Cash auto-development handed straight back out. Reported because it is the
   * only honest way to show it: the numbers cannot be reconstructed after the
   * fact now that a price depends on the demand at the moment of purchase.
   */
  spent: number;
  homes: number;
  shops: number;
  industry: number;
  services: number;
}

/** What one pass of auto-development put on the ground. */
interface AutoBuilt {
  homes: number;
  shops: number;
  industry: number;
  services: number;
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
  /**
   * Running total of cash auto-development has handed back out. `catchUp`
   * differences it rather than replaying the cost curve, because a replay
   * cannot reproduce the demand each purchase was actually priced against.
   */
  private autoSpend = 0;

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
    // Staffing before happiness before demand: happiness reads coverage, and
    // the residential ceiling reads happiness. Integrating them out of order
    // would leave each one a tick behind the thing it is supposed to follow.
    this.integrateStaffing(dt);
    this.integrateHappiness(dt);
    this.integrateDemand(dt);
    if (s.autoDevelop) this.autoDevelop(8);
  }

  /**
   * Fills the payroll of each civic type, exponentially toward fully staffed.
   *
   * A type with nothing built has no payroll to fill, so it stays at zero — and
   * `staffAfterBuild` is what keeps the ramp honest when a building lands: the
   * scalar is re-averaged down rather than reset, so opening the fifth hospital
   * leaves the four that were running exactly as they were and ramps the new
   * one in from empty.
   */
  private integrateStaffing(dt: number): void {
    const s = this.inner;
    const k = staffStep(dt);
    s.hospitalStaff = s.hospitals > 0 ? s.hospitalStaff + (1 - s.hospitalStaff) * k : 0;
    s.policeStaff = s.police > 0 ? s.policeStaff + (1 - s.policeStaff) * k : 0;
    s.fireStaff = s.fire > 0 ? s.fireStaff + (1 - s.fireStaff) * k : 0;
  }

  /**
   * Eases happiness toward the coverage the city currently has.
   *
   * Clamped as well as stepped, for the same reason the demand signals are: the
   * step preserves [0, 1] only if the state arrived inside it, and a doctored
   * save is exactly where it would not have.
   */
  private integrateHappiness(dt: number): void {
    const s = this.inner;
    const target = happinessTarget(s);
    const moved = s.happiness + (target - s.happiness) * happinessStep(dt);
    s.happiness = Math.max(0, Math.min(1, moved));
  }

  /**
   * Moves each signal a fraction of the way to its target.
   *
   * The fraction is exponential in dt, so a single 60-second catch-up step and
   * sixty one-second ticks land in the same place, and no step size can
   * overshoot. See `demandStep`.
   */
  private integrateDemand(dt: number): void {
    const s = this.inner;
    const target = demandTargets(s);
    const k = demandStep(dt);
    // Clamped as well as stepped. The step alone preserves the band, since it
    // is a convex combination of two values already inside it — but only if the
    // state arrived inside it, and a demand value is exactly the field a
    // doctored save would put out of range.
    s.demandR = clampDemand(s.demandR + (target.r - s.demandR) * k);
    s.demandC = clampDemand(s.demandC + (target.c - s.demandC) * k);
    s.demandI = clampDemand(s.demandI + (target.i - s.demandI) * k);
    // The happiness ceiling is a hard constraint, not another target: a rezone
    // that doubles the population halves coverage under the city's feet, and
    // residential demand has to be under the new ceiling that same tick rather
    // than easing down through a discount it is no longer entitled to.
    //
    // Against happiness, not against `target.r` — `target.r` is already
    // capped by it, and clamping to the target would snap the signal onto its
    // target every tick it was falling, which is the lag the whole model is
    // built out of.
    s.demandR = Math.min(s.demandR, s.happiness);
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

  buildIndustry(): boolean {
    const s = this.inner;
    if (!canBuildIndustry(s)) return false;
    s.cash -= industryCost(s);
    s.industry++;
    return true;
  }

  /** Civic buildings take a 2x2 site and pay nothing back directly. */
  buildService(service: Service): boolean {
    const s = this.inner;
    if (!canBuildService(s, service)) return false;
    s.cash -= serviceCost(s, service);
    this.openService(service);
    return true;
  }

  /** The one place a civic counter moves, so the ramp can never be skipped. */
  private openService(service: Service): void {
    const s = this.inner;
    if (service.key === 'hospital') {
      s.hospitalStaff = staffAfterBuild(s.hospitalStaff, s.hospitals);
      s.hospitals++;
    } else if (service.key === 'police') {
      s.policeStaff = staffAfterBuild(s.policeStaff, s.police);
      s.police++;
    } else {
      s.fireStaff = staffAfterBuild(s.fireStaff, s.fire);
      s.fire++;
    }
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
    this.autoSpend = 0;
  }

  /**
   * Spends surplus cash on whichever plot is cheapest, up to `budget` purchases.
   * Deliberately never rezones or annexes — those are the player's calls.
   *
   * Two floors keep it from playing badly on the player's behalf:
   *
   *   - it will not buy a type whose demand has gone negative, or it builds
   *     straight into oversupply, tanks happiness and hands back a worse city
   *     than the one it was left;
   *   - a service the city is short of is bought ahead of anything else it could
   *     afford. Civic buildings stand on their own reserved sites now, so
   *     housing can no longer crowd them out of the zone — but cheapest-first
   *     still would, since a home is always the cheapest thing on the list.
   *     Priority is what stops an away city coming back at the happiness floor.
   */
  private autoDevelop(budget: number): AutoBuilt {
    const s = this.inner;
    const built: AutoBuilt = { homes: 0, shops: 0, industry: 0, services: 0 };

    for (let i = 0; i < budget; i++) {
      const options: Array<{ cost: number; buy: () => void }> = [];
      const shortfalls: Array<{ cost: number; buy: () => void }> = [];

      if (s.demandR >= 0 && canBuildHome(s)) {
        options.push({
          cost: homeCost(s),
          buy: () => {
            s.homes++;
            built.homes++;
          },
        });
      }
      if (s.demandC >= 0 && canBuildShop(s)) {
        options.push({
          cost: shopCost(s),
          buy: () => {
            s.shops++;
            built.shops++;
          },
        });
      }
      if (s.demandI >= 0 && canBuildIndustry(s)) {
        options.push({
          cost: industryCost(s),
          buy: () => {
            s.industry++;
            built.industry++;
          },
        });
      }
      for (const service of SERVICES) {
        if (residents(s) <= 0 || serviceCount(s, service.key) >= serviceNeeded(s, service)) continue;
        if (!canBuildService(s, service)) continue;
        shortfalls.push({
          cost: serviceCost(s, service),
          buy: () => {
            this.openService(service);
            built.services++;
          },
        });
      }

      const pool = shortfalls.length > 0 ? shortfalls : options;
      const best = pool.reduce<{ cost: number; buy: () => void } | undefined>(
        (cheapest, option) => (cheapest === undefined || option.cost < cheapest.cost ? option : cheapest),
        undefined,
      );
      if (best === undefined) break;
      this.spend(best.cost);
      best.buy();
    }
    return built;
  }

  /** The one place auto-development's outgoings are recorded. */
  private spend(cost: number): void {
    this.inner.cash -= cost;
    this.autoSpend += cost;
  }

  /**
   * Credits time away. Income is constant between purchases, so this could be
   * one multiplication — but stepping it in fixed-size chunks lets both
   * auto-development and the demand loop compound the way they would have if
   * you had been watching.
   */
  catchUp(seconds: number): AwayReport {
    const wanted = Math.max(0, seconds);
    const credited = Math.min(wanted, OFFLINE_CAP_SECONDS);
    const before = {
      cash: this.inner.cash,
      homes: this.inner.homes,
      shops: this.inner.shops,
      industry: this.inner.industry,
      services: civicBuildings(this.inner),
      spend: this.autoSpend,
    };

    // Fixed steps, not a fixed step count: coarse steps let auto-development
    // buy against a demand curve that has already jumped to its asymptote.
    const steps = Math.min(
      CATCHUP_MAX_STEPS,
      Math.max(1, Math.ceil(credited / CATCHUP_STEP_SECONDS)),
    );
    const dt = credited / steps;
    for (let i = 0; i < steps; i++) this.step(dt);

    const s = this.inner;
    return {
      seconds: credited,
      forfeited: wanted - credited,
      // What auto-development spent was earned first, so from the player's side
      // it is all collections. This is the actual outgoing, not a replay of the
      // cost curve — cost now depends on the demand at the moment of purchase.
      earned: s.cash - before.cash + (this.autoSpend - before.spend),
      spent: this.autoSpend - before.spend,
      homes: s.homes - before.homes,
      shops: s.shops - before.shops,
      industry: s.industry - before.industry,
      services: civicBuildings(s) - before.services,
    };
  }
}
