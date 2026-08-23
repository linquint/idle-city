import { hash01, mixSeed } from '../core/rng.ts';
import {
  CATCHUP_MAX_LOSSES,
  CATCHUP_MAX_STEPS,
  CATCHUP_STEP_SECONDS,
  IGNITION_HAZARD_CAP,
  MAX_ACTIVE_FIRES,
  OFFLINE_CAP_SECONDS,
  SERVICES,
  TICK_RATE,
  type Service,
} from './config.ts';
import {
  annexCost,
  burnableBuildings,
  burnableOf,
  canAnnex,
  canBuildHome,
  canBuildIndustry,
  canBuildPark,
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
  ignitionRate,
  income,
  industryCost,
  isBurning,
  parkCost,
  recreationCoverage,
  residents,
  resolvesAt,
  rezoneCost,
  serviceCost,
  serviceCount,
  serviceNeeded,
  shopCost,
  staffAfterBuild,
  staffStep,
  wouldBurnOut,
} from './economy.ts';
import { createState, type Fire, type FireKind, type GameState } from './state.ts';

/**
 * Salt for the fire stream.
 *
 * Fires draw off their own cursor rather than off the layout seed, so the two
 * can never correlate — a city whose fires lined up with its street plan would
 * burn the same plots in every district.
 */
const FIRE_STREAM = 0x1f5e3d;

/**
 * Waiting time, in expected fires, before the ignition after `cursor`.
 *
 * `-ln(U)` is the exponential waiting time of a Poisson process and has mean 1,
 * so hazard measured in expected fires is spent exactly one fire at a time.
 * Peeked rather than consumed: the cursor only advances when a fire actually
 * starts, so the same threshold is waiting there on the next tick however the
 * steps are sized. `1 - hash01(..)` lands in (0, 1], which keeps the log finite.
 */
const ignitionWait = (cursor: number): number =>
  -Math.log(1 - hash01(mixSeed(FIRE_STREAM, cursor)));

/** Backstop on the ignition loop. Well above what IGNITION_HAZARD_CAP can spend. */
const IGNITION_GUARD = IGNITION_HAZARD_CAP * 4;

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
  parks: number;
  services: number;
  /**
   * What burned, and how it went.
   *
   * Reported rather than left to be noticed. A player who comes back to a city
   * one building smaller and no explanation has been robbed; one who is told
   * "three fires, two put out, one building lost" has been given the argument
   * for a fire station.
   */
  firesStarted: number;
  firesExtinguished: number;
  firesLost: number;
}

/** What one pass of auto-development put on the ground. */
interface AutoBuilt {
  homes: number;
  shops: number;
  industry: number;
  parks: number;
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
  /**
   * Lifetime fire tallies. `catchUp` differences them the same way it does
   * `autoSpend`, which keeps `step` free of any notion of who is watching.
   */
  private firesStarted = 0;
  private firesExtinguished = 0;
  private firesLost = 0;
  /**
   * Buildings this run of the simulation may still destroy.
   *
   * Infinite while the player is watching — a fire you saw burn down is a
   * consequence, not a theft. `catchUp` narrows it to CATCHUP_MAX_LOSSES for
   * the length of one call, which is the guard that stops a twelve-hour
   * absence from silently demolishing a city.
   */
  private lossesLeft = Number.POSITIVE_INFINITY;

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
    // Fires after the integrators and before auto-development: income above
    // was charged against the fires that were burning at the top of the tick,
    // and auto-development should get to rebuild inside the same tick a
    // building was lost in rather than a tenth of a second later.
    this.resolveFires();
    this.igniteFires(dt);
    if (s.autoDevelop) this.autoDevelop(8);
  }

  // ------------------------------------------------------------------ fire

  /**
   * Puts out — or loses — every fire that has run its course.
   *
   * The response time is read fresh each tick rather than stamped on the fire
   * when it started, so a station opened while something is burning genuinely
   * shortens the fire it was too late to prevent. Compacted in place: the list
   * is six entries long at most and this runs ten times a second.
   */
  private resolveFires(): void {
    const s = this.inner;
    if (s.fires.length === 0) return;
    const limit = resolvesAt(s);
    const fatal = wouldBurnOut(s);

    let write = 0;
    for (let i = 0; i < s.fires.length; i++) {
      const fire = s.fires[i] as Fire;
      if (s.elapsed - fire.startedAt < limit) {
        s.fires[write++] = fire;
        continue;
      }
      if (fatal && this.lossesLeft > 0) {
        this.lossesLeft--;
        this.demolish(fire.kind);
        this.firesLost++;
      } else {
        // Past the loss budget the fire still ends, it just ends well. The
        // alternative — leaving it burning — would hand a returning player a
        // city permanently on fire, which is worse than the thing being guarded
        // against.
        this.firesExtinguished++;
      }
    }
    s.fires.length = write;
    this.pruneFires();
  }

  /**
   * Takes one building of a kind off the books.
   *
   * The count is the whole of what a building is, so this is the whole of what
   * losing one means. One honest consequence: plots are the *front* of each
   * zone's build order, so the plot that empties is the last one in the list
   * rather than the one the flames were on. Recording which plot burned would
   * mean putting a position in the save, which is the one thing this codebase
   * will not do — the fire is over by the time the count moves, and a city one
   * building smaller is the part the player is owed.
   */
  private demolish(kind: FireKind): void {
    const s = this.inner;
    if (kind === 'home') s.homes = Math.max(0, s.homes - 1);
    else if (kind === 'shop') s.shops = Math.max(0, s.shops - 1);
    else s.industry = Math.max(0, s.industry - 1);
  }

  /** A fire whose building no longer exists stops being a fire. */
  private pruneFires(): void {
    const s = this.inner;
    let write = 0;
    for (const fire of s.fires) {
      if (fire.index < burnableOf(s, fire.kind)) s.fires[write++] = fire;
    }
    s.fires.length = write;
  }

  /**
   * Accumulates ignition pressure and spends it.
   *
   * The Poisson process, in the one form that survives being run at two step
   * sizes. A Bernoulli trial per tick does not: sixty trials at one second and
   * one trial at sixty are different distributions, so catch-up would
   * systematically disagree with watching and the away report would be a lie.
   * Integrating `rate x dt` into a hazard and spending it against exponential
   * waiting times gives the same answer at any step size — and because the
   * threshold is a pure function of the cursor, it is still sitting there
   * unspent on the next tick.
   */
  private igniteFires(dt: number): void {
    const s = this.inner;
    const rate = ignitionRate(s);
    if (rate <= 0 || burnableBuildings(s) <= 0) return;
    s.fireHazard = Math.min(IGNITION_HAZARD_CAP, s.fireHazard + rate * dt);

    for (let guard = 0; guard < IGNITION_GUARD; guard++) {
      const wait = ignitionWait(s.fireCursor);
      if (s.fireHazard < wait) break;
      s.fireHazard -= wait;
      s.fireCursor++;
      this.ignite();
    }
  }

  /**
   * Starts one fire, in a building drawn in proportion to how many there are.
   *
   * The draws are spent even when the fire cannot be placed — the list is full,
   * or that building is already alight. Spending them is what keeps the hazard
   * bounded: a city sitting at MAX_ACTIVE_FIRES for an hour would otherwise
   * bank an hour of pressure and let it all go the moment a slot opened.
   */
  private ignite(): void {
    const s = this.inner;
    const kindRoll = hash01(mixSeed(FIRE_STREAM, s.fireCursor));
    s.fireCursor++;
    const slotRoll = hash01(mixSeed(FIRE_STREAM, s.fireCursor));
    s.fireCursor++;
    if (s.fires.length >= MAX_ACTIVE_FIRES) return;

    const pick = kindRoll * burnableBuildings(s);
    const kind: FireKind =
      pick < s.homes ? 'home' : pick < s.homes + s.shops ? 'shop' : 'industry';
    const of = burnableOf(s, kind);
    if (of <= 0) return;
    const index = Math.min(of - 1, Math.floor(slotRoll * of));
    if (isBurning(s, kind, index)) return;

    s.fires.push({ kind, index, startedAt: s.elapsed });
    this.firesStarted++;
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

  /** A park pays nothing back directly. What it buys is the recreation term. */
  buildPark(): boolean {
    const s = this.inner;
    if (!canBuildPark(s)) return false;
    s.cash -= parkCost(s);
    s.parks++;
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
    this.firesStarted = 0;
    this.firesExtinguished = 0;
    this.firesLost = 0;
    this.lossesLeft = Number.POSITIVE_INFINITY;
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
    const built: AutoBuilt = { homes: 0, shops: 0, industry: 0, parks: 0, services: 0 };

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
      // Recreation is a happiness term like the other three, so a shortfall in
      // it belongs in the same priority pool. Without this an away city would
      // be capped at 0.82 by the one amenity auto-development could not see,
      // and "stops an away city coming back at the happiness floor" would only
      // be three-quarters true.
      if (s.homes > 0 && recreationCoverage(s) < 1 && canBuildPark(s)) {
        shortfalls.push({
          cost: parkCost(s),
          buy: () => {
            s.parks++;
            built.parks++;
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
      parks: this.inner.parks,
      services: civicBuildings(this.inner),
      spend: this.autoSpend,
      started: this.firesStarted,
      extinguished: this.firesExtinguished,
      lost: this.firesLost,
    };

    // The hard guard, for the length of this call and no longer. However many
    // fires resolve badly across a twelve-hour absence, the city comes back at
    // most one building smaller; the rest are put out instead and still counted.
    this.lossesLeft = CATCHUP_MAX_LOSSES;

    // Fixed steps, not a fixed step count: coarse steps let auto-development
    // buy against a demand curve that has already jumped to its asymptote.
    const steps = Math.min(
      CATCHUP_MAX_STEPS,
      Math.max(1, Math.ceil(credited / CATCHUP_STEP_SECONDS)),
    );
    const dt = credited / steps;
    for (let i = 0; i < steps; i++) this.step(dt);
    this.lossesLeft = Number.POSITIVE_INFINITY;

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
      parks: s.parks - before.parks,
      services: civicBuildings(s) - before.services,
      firesStarted: this.firesStarted - before.started,
      firesExtinguished: this.firesExtinguished - before.extinguished,
      firesLost: this.firesLost - before.lost,
    };
  }
}
