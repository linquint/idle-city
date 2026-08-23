import { hash01, mixSeed } from '../core/rng.ts';
import {
  CATCHUP_MAX_ABANDONED,
  CATCHUP_MAX_ANNEXES,
  CATCHUP_MAX_LOSSES,
  CATCHUP_MAX_STEPS,
  CATCHUP_STEP_SECONDS,
  IGNITION_HAZARD_CAP,
  MAX_ACTIVE_FIRES,
  LEVEL_EDUCATION,
  LEVELS,
  MERGE_LEVEL,
  OFFLINE_CAP_SECONDS,
  SERVICES,
  TAX_STEPS,
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
  canMergeParcel,
  civicBuildings,
  clampDemand,
  demandStep,
  demandTargets,
  educationCoverage,
  happinessStep,
  happinessTarget,
  homeCost,
  ignitionRate,
  income,
  industryCost,
  isAbandoning,
  isBurning,
  isRecovering,
  abandonedOf,
  isVacant,
  levelsOf,
  mergedOf,
  driftOf,
  occupancyOf,
  vacantOf,
  occupancyStep,
  occupancyTarget,
  parkCost,
  promoteRate,
  recoverRate,
  abandonRate,
  recreationCoverage,
  housingPlots,
  resolvesAt,
  standingOf,
  cohortTotal,
  countOf,
  serviceCost,
  serviceCount,
  serviceNeeded,
  shopCost,
  staffAfterBuild,
  staffStep,
  willAutoAnnex,
  wouldBurnOut,
  ZONE_KINDS,
} from './economy.ts';
import {
  createState,
  type Fire,
  type GameState,
  type LevelCohort,
  type ZoneKind,
} from './state.ts';

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

/**
 * The four per-zone writers.
 *
 * `economy.ts` is pure reads by design, so its `occupancyOf`/`vacantOf` and
 * friends have no setters to pair with — these are them, and they live here
 * because this is the file that is allowed to mutate. Written as a lookup
 * rather than three copies of the same `if` chain at every call site.
 */
const setOccupancy = (s: GameState, kind: ZoneKind, v: number): void => {
  if (kind === 'home') s.occupancyR = v;
  else if (kind === 'shop') s.occupancyC = v;
  else s.occupancyI = v;
};

const setVacant = (s: GameState, kind: ZoneKind, v: number): void => {
  if (kind === 'home') s.vacantR = v;
  else if (kind === 'shop') s.vacantC = v;
  else s.vacantI = v;
};

const setAbandoned = (s: GameState, kind: ZoneKind, v: number): void => {
  if (kind === 'home') s.abandonedR = v;
  else if (kind === 'shop') s.abandonedC = v;
  else s.abandonedI = v;
};

const setDrift = (s: GameState, kind: ZoneKind, v: number): void => {
  if (kind === 'home') s.driftR = v;
  else if (kind === 'shop') s.driftC = v;
  else s.driftI = v;
};

const setMerged = (s: GameState, kind: ZoneKind, v: number): void => {
  if (kind === 'home') s.mergedR = v;
  else if (kind === 'shop') s.mergedC = v;
  else s.mergedI = v;
};

const setCount = (s: GameState, kind: ZoneKind, v: number): void => {
  if (kind === 'home') s.homes = v;
  else if (kind === 'shop') s.shops = v;
  else s.industry = v;
};

/** Adds one building to a zone, at level 0. The only way a cohort grows. */
const addBuilding = (levels: LevelCohort): void => {
  levels[0] = (levels[0] ?? 0) + 1;
};

/** Takes one building out of a zone, newest — that is, lowest — level first. */
const removeBuilding = (levels: LevelCohort): void => {
  for (let l = 0; l < levels.length; l++) {
    if ((levels[l] ?? 0) <= 0) continue;
    levels[l] = (levels[l] ?? 0) - 1;
    return;
  }
};

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
  /**
   * Net change in each zone's building count.
   *
   * Net, and signed, because a count can now fall without anything being lost:
   * two buildings that merge are one building fewer standing on the same land.
   * `merges` below is the half of that story the player is owed — a city that
   * came back with two fewer homes and five merges grew.
   */
  homes: number;
  shops: number;
  industry: number;
  parks: number;
  services: number;
  /** Parcels merged while away, across every zone. */
  merges: number;
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
  /**
   * Buildings boarded up while away, and buildings brought back.
   *
   * Reported for the same reason fires are: a player who returns to a city with
   * dark plots in it and no explanation has been robbed, and one who is told
   * "four homes abandoned" has been handed the argument for a hospital. Both
   * halves, because "and two came back" is the half that says it is fixable.
   */
  abandoned: number;
  recovered: number;
  /** Districts the city took on its own while nobody was watching. */
  districts: number;
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
  /** Lifetime decay tallies. `catchUp` differences them like the fire ones. */
  private abandoned = 0;
  private recovered = 0;
  private annexed = 0;
  /** Lifetime parcels merged. Differenced by `catchUp` like the tallies above. */
  private merged = 0;
  /**
   * Buildings this run of the simulation may still destroy.
   *
   * Infinite while the player is watching — a fire you saw burn down is a
   * consequence, not a theft. `catchUp` narrows it to CATCHUP_MAX_LOSSES for
   * the length of one call, which is the guard that stops a twelve-hour
   * absence from silently demolishing a city.
   */
  private lossesLeft = Number.POSITIVE_INFINITY;
  /**
   * Buildings this run may still write off. Infinite while the player is
   * watching — a district you saw empty out is a consequence you can act on —
   * and CATCHUP_MAX_ABANDONED for the length of one catch-up call.
   */
  private abandonsLeft = Number.POSITIVE_INFINITY;
  /** Districts this run may still take on its own. See `autoAnnex`. */
  private annexesLeft = Number.POSITIVE_INFINITY;
  /** Reused by `promote`, which runs every tick and must not allocate. */
  private readonly scratch: number[] = new Array<number>(LEVELS).fill(0);

  constructor(state: GameState = createState()) {
    this.inner = state;
    // The cohorts are the only fields of a state that are not a number, and an
    // array handed in is an array the caller still holds a reference to. Two
    // games built from one patch object would otherwise share a skyline and
    // silently promote each other's buildings. Copied rather than documented:
    // the simulation owns its numbers, and that has to include these.
    this.inner.homeLevels = [...state.homeLevels];
    this.inner.shopLevels = [...state.shopLevels];
    this.inner.industryLevels = [...state.industryLevels];
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
    // Occupancy after both, because its target reads happiness and demand; the
    // level pass after occupancy, because every one of its gates reads it.
    this.integrateOccupancy(dt);
    this.integrateLevels(dt);
    // Fires after the integrators and before auto-development: income above
    // was charged against the fires that were burning at the top of the tick,
    // and auto-development should get to rebuild inside the same tick a
    // building was lost in rather than a tenth of a second later.
    this.resolveFires();
    this.igniteFires(dt);
    // Annexation before auto-development, so a district that arrives this tick
    // is land the same tick can start building on rather than land that waits a
    // tenth of a second — the same reasoning fires already follow.
    this.autoAnnex();
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
  private demolish(kind: ZoneKind): void {
    const s = this.inner;
    setCount(s, kind, Math.max(0, countOf(s, kind) - 1));
    // The count and the cohort are two views of one thing, so they move
    // together or the invariant breaks. A ruin is taken first — the newest
    // plots are the ruins, and the newest plot is the one the count drops.
    if (abandonedOf(s, kind) > 0) setAbandoned(s, kind, abandonedOf(s, kind) - 1);
    else removeBuilding(levelsOf(s, kind));
    // Merged parcels are the oldest slots, so the building that just went is
    // only one of them when it was the last thing standing. Clamping says that
    // in one line and cannot leave more merged parcels than there are buildings
    // to stand on them.
    setMerged(s, kind, Math.min(mergedOf(s, kind), countOf(s, kind)));
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
    const kind: ZoneKind =
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
    s.schoolStaff = s.schools > 0 ? s.schoolStaff + (1 - s.schoolStaff) * k : 0;
    s.universityStaff =
      s.universities > 0 ? s.universityStaff + (1 - s.universityStaff) * k : 0;
    s.depotStaff = s.depots > 0 ? s.depotStaff + (1 - s.depotStaff) * k : 0;
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
    // The happiness ceiling is a hard constraint, not another target: annexing
    // land stretches the same services across more of it and coverage falls
    // under the city's feet, and residential demand has to be under the new
    // ceiling that same tick rather than easing down through a discount it is
    // no longer entitled to.
    //
    // Against happiness, not against `target.r` — `target.r` is already
    // capped by it, and clamping to the target would snap the signal onto its
    // target every tick it was falling, which is the lag the whole model is
    // built out of.
    s.demandR = Math.min(s.demandR, s.happiness);
  }

  // ------------------------------------------------------------- occupancy

  /**
   * Eases each zone toward the occupancy its mood and its demand justify, and
   * runs the vacancy clock underneath it.
   *
   * The clock is a plain integral of time spent below the line and resets the
   * moment the zone climbs back over it, which is the whole of what makes
   * abandonment need *sustained* vacancy: a dip that lasts a minute leaves
   * nothing behind, because a minute is not ABANDON_SECONDS and the counter is
   * back at zero before it could have been.
   */
  private integrateOccupancy(dt: number): void {
    const s = this.inner;
    const k = occupancyStep(dt);
    for (const kind of ZONE_KINDS) {
      // A zone with nothing standing is held rather than integrated. There is
      // nothing to be occupied, so the number means nothing — but it is what
      // the *first* building of that zone will open at, and a zone that had
      // decayed to zero while empty would hand the player a house that takes
      // two minutes to let. Its vacancy clock is not running either.
      if (standingOf(s, kind) <= 0) {
        setVacant(s, kind, 0);
        continue;
      }
      const target = occupancyTarget(s, kind);
      const moved = occupancyOf(s, kind) + (target - occupancyOf(s, kind)) * k;
      // Clamped as well as stepped, for the reason every other integrator here
      // is: the step preserves [0, 1] only if the state arrived inside it, and
      // a doctored save is exactly where it would not have.
      setOccupancy(s, kind, Math.max(0, Math.min(1, moved)));
      setVacant(s, kind, isVacant(s, kind) ? vacantOf(s, kind) + dt : 0);
    }
  }

  // -------------------------------------------------------------- levelling

  /**
   * Moves buildings between cohorts: back from the ruins, down into them, or up
   * a level.
   *
   * Exactly one of the three runs per zone per pass, in that priority. Recovery
   * first, because a city should finish repairing itself before it starts
   * growing again; abandonment next, because a zone past its vacancy clock has
   * no business promoting anything; promotion last, on what is left.
   *
   * All three spend out of one fractional accumulator so the pass is step-size
   * invariant. `floor(rate * dt)` would round a tenth-of-a-second tick's worth
   * to zero and never do anything at all, and a Bernoulli trial per tick would
   * make sixty one-second ticks a different distribution from one sixty-second
   * catch-up step. Banking the remainder gives the same answer at any step.
   */
  private integrateLevels(dt: number): void {
    const s = this.inner;
    for (const kind of ZONE_KINDS) {
      // Deliberately *not* clamped before it is spent. A 60-second catch-up
      // step banks sixty seconds of rate and has to spend all of it, or the
      // step size decides how fast the city grows — which is the exact
      // dependence this accumulator exists to remove. Nothing can bank while a
      // gate is shut, because a shut gate makes the rate zero rather than
      // making the accumulation illegal, so there is no hoard to release.
      setDrift(s, kind, driftOf(s, kind) + this.driftRate(kind) * dt);
      this.spendDrift(kind);
    }
  }

  /** Buildings per second the zone is moving, signed: up positive, down negative. */
  private driftRate(kind: ZoneKind): number {
    const s = this.inner;
    if (isRecovering(s, kind)) return recoverRate(s, kind);
    if (isAbandoning(s, kind)) return -abandonRate(s, kind);
    return promoteRate(s, kind);
  }

  /**
   * Spends whole buildings out of the accumulator.
   *
   * One sweep, not a loop of single moves. The difference matters: a 60-second
   * catch-up step banks tens of promotions, and promoting them one at a time
   * would walk a building from level 0 to level 3 inside a single pass, because
   * every call after the first would find it sitting in the cohort above.
   * `promote` therefore takes a budget and makes one ordered pass with it.
   *
   * A short move — fewer buildings than the budget asked for — means the zone
   * ran out of anything to move, so the remainder is dropped rather than banked
   * against some future tick that might have something.
   */
  private spendDrift(kind: ZoneKind): void {
    const s = this.inner;
    let drift = driftOf(s, kind);
    if (drift >= 1) {
      const budget = Math.floor(drift);
      const moved = isRecovering(s, kind)
        ? this.recover(kind, budget)
        : this.promote(kind, budget);
      drift = moved < budget ? 0 : drift - moved;
    } else if (drift <= -1) {
      const budget = Math.floor(-drift);
      const moved = this.abandon(kind, budget);
      drift = moved < budget ? 0 : drift + moved;
    }
    setDrift(s, kind, drift);
  }

  /**
   * Climbs up to `budget` buildings one level each, in one pass.
   *
   * Bottom cohort first, and that ordering is the mechanic rather than an
   * implementation detail. Promoting the *highest* eligible cohort first — the
   * obvious reading of "climb a level" — races one building to the top while
   * everything else sits at level 0: measured, a single arcology appeared
   * inside thirty seconds while twenty-three houses never moved. Draining the
   * bottom cohort first makes the city climb as a wave, which is what
   * LEVEL_UP_SECONDS is a statement about and what gives the skyline its
   * mixed-age look.
   *
   * Bottom-up needs the snapshot to hold "never more than one level per
   * building per pass": level l + 1 is read after level l has been written, so
   * without `before` the buildings that just arrived there would be eligible to
   * move again inside the same pass. The scratch buffer is reused because this
   * runs on every tick.
   */
  private promote(kind: ZoneKind, budget: number): number {
    const levels = levelsOf(this.inner, kind);
    const before = this.scratch;
    for (let l = 0; l < LEVELS; l++) before[l] = levels[l] ?? 0;

    let left = budget;
    for (let l = 0; l < LEVELS - 1 && left > 0; l++) {
      if (!this.educated(l + 1)) continue;
      // The one rung that is not a rung: climbing to MERGE_LEVEL takes two
      // buildings off one parcel and puts one back, so it is spent a parcel at
      // a time rather than in a single subtraction.
      if (l + 1 === MERGE_LEVEL) {
        while (left > 0 && this.merge(kind, before)) left--;
        continue;
      }
      const take = Math.min(left, before[l] ?? 0);
      if (take <= 0) continue;
      levels[l] = (levels[l] ?? 0) - take;
      levels[l + 1] = (levels[l + 1] ?? 0) + take;
      left -= take;
    }
    return budget - left;
  }

  /**
   * Merges the next parcel: two neighbours at MERGE_LEVEL - 1 become one
   * building at MERGE_LEVEL, standing on both their plots.
   *
   * `before` is the pass's snapshot and is spent as well as read, which is what
   * keeps the two rules of the promotion pass true at once: a building that
   * climbed to MERGE_LEVEL - 1 in this same pass is not eligible to be merged
   * by it, and no pair is merged twice.
   *
   * One merge costs *one* of the pass's budget, not two. The budget is a rate of
   * promotions and a merge is one promotion — one parcel climbing. Charging two
   * would deadlock any zone whose drift never banks a whole second one, since a
   * short pass drops its remainder rather than carrying it.
   */
  private merge(kind: ZoneKind, before: number[]): boolean {
    const s = this.inner;
    const ready = before[MERGE_LEVEL - 1] ?? 0;
    if (ready < 2 || !canMergeParcel(s, kind, ready)) return false;
    const levels = levelsOf(s, kind);
    levels[MERGE_LEVEL - 1] = (levels[MERGE_LEVEL - 1] ?? 0) - 2;
    levels[MERGE_LEVEL] = (levels[MERGE_LEVEL] ?? 0) + 1;
    before[MERGE_LEVEL - 1] = ready - 2;
    setMerged(s, kind, mergedOf(s, kind) + 1);
    // Two buildings became one. Every readout that assumed a count only rises
    // is wrong from here, which is why land is measured in plots: `plotsOf`
    // adds the merged parcel back and comes out exactly where it started.
    setCount(s, kind, countOf(s, kind) - 1);
    this.merged++;
    return true;
  }

  /**
   * Writes up to `budget` buildings off, taken from the newest cohort.
   *
   * Newest means lowest level, because buildings take levels in build order —
   * so the plots that go dark are the ones at the growing edge of the city and
   * the decay reads as spreading inward rather than as random gaps.
   */
  private abandon(kind: ZoneKind, budget: number): number {
    const s = this.inner;
    const levels = levelsOf(s, kind);
    let moved = 0;
    for (let l = 0; l < LEVELS && moved < budget; l++) {
      const take = Math.min(budget - moved, levels[l] ?? 0, this.abandonsLeft);
      if (take <= 0) continue;
      levels[l] = (levels[l] ?? 0) - take;
      setAbandoned(s, kind, abandonedOf(s, kind) + take);
      this.abandonsLeft -= take;
      this.abandoned += take;
      moved += take;
    }
    return moved;
  }

  /**
   * Brings up to `budget` ruins back. Nothing here is lost for good.
   *
   * A ruin comes back as whatever its parcel can hold. Ruins are the newest
   * slots and merged parcels are the oldest, so the only ruins standing on a
   * merged parcel are the ones a zone reaches once every unmerged building is
   * already boarded up — and those reopen at MERGE_LEVEL, because the parcel
   * under them is still two plots. Handing them back at level 0 would put a
   * detached house on a merged parcel, which is a shape the land cannot hold.
   */
  private recover(kind: ZoneKind, budget: number): number {
    const s = this.inner;
    const take = Math.min(budget, abandonedOf(s, kind));
    if (take <= 0) return 0;
    const levels = levelsOf(s, kind);
    const standing = cohortTotal(levels);
    const onMerged = Math.max(0, Math.min(mergedOf(s, kind), standing + take) - standing);
    levels[MERGE_LEVEL] = (levels[MERGE_LEVEL] ?? 0) + onMerged;
    levels[0] = (levels[0] ?? 0) + (take - onMerged);
    setAbandoned(s, kind, abandonedOf(s, kind) - take);
    this.recovered += take;
    return take;
  }

  /**
   * Whether the city's schooling reaches far enough to justify this level.
   *
   * The third gate, and the one that is not about money or mood: a city with
   * every service and a full skyline of tenants still cannot raise a tower
   * until it has taught anybody. Pooled across schools and universities, so
   * this asks how educated the city is rather than which building did it.
   */
  private educated(level: number): boolean {
    return educationCoverage(this.inner) >= (LEVEL_EDUCATION[level] ?? 0);
  }

  // ---------------------------------------------------------------- actions

  buildHome(): boolean {
    const s = this.inner;
    if (!canBuildHome(s)) return false;
    s.cash -= homeCost(s);
    s.homes++;
    addBuilding(s.homeLevels);
    return true;
  }

  buildShop(): boolean {
    const s = this.inner;
    if (!canBuildShop(s)) return false;
    s.cash -= shopCost(s);
    s.shops++;
    addBuilding(s.shopLevels);
    return true;
  }

  buildIndustry(): boolean {
    const s = this.inner;
    if (!canBuildIndustry(s)) return false;
    s.cash -= industryCost(s);
    s.industry++;
    addBuilding(s.industryLevels);
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
    } else if (service.key === 'fire') {
      s.fireStaff = staffAfterBuild(s.fireStaff, s.fire);
      s.fire++;
    } else if (service.key === 'school') {
      s.schoolStaff = staffAfterBuild(s.schoolStaff, s.schools);
      s.schools++;
    } else if (service.key === 'transit') {
      s.depotStaff = staffAfterBuild(s.depotStaff, s.depots);
      s.depots++;
    } else {
      s.universityStaff = staffAfterBuild(s.universityStaff, s.universities);
      s.universities++;
    }
  }

  /**
   * The expansion axis: more land, more plots, a permanent civic bonus.
   *
   * The manual override. It asks only what `canAnnex` asks, so a player who has
   * looked at the price and wants the land can take it before the automatic
   * pass would — which waits for AUTO_ANNEX_RESERVE on top.
   */
  annex(): boolean {
    const s = this.inner;
    if (!canAnnex(s)) return false;
    s.cash -= annexCost(s);
    s.districts++;
    this.annexed++;
    return true;
  }

  /**
   * Takes the next district when the city has earned it and can comfortably
   * pay, without anyone pressing anything.
   *
   * Capped for the length of a catch-up call and unlimited while the player is
   * watching, exactly like fire losses and abandonment: a district that arrives
   * while you are looking at it is a thing that happened, and eight that
   * arrived while you were asleep are a city you do not recognise.
   *
   * Looped rather than run once, because one purchase can unlock the next: the
   * gate is a *share*, and annexing does not change how much is built, only
   * what it is a share of. The cap is what bounds the loop.
   */
  private autoAnnex(): void {
    while (this.annexesLeft > 0 && willAutoAnnex(this.inner)) {
      const cost = annexCost(this.inner);
      this.annexesLeft--;
      if (!this.annex()) return;
      // Recorded like any other outgoing the city makes on its own. `catchUp`
      // differences `autoSpend` to work out what was earned, so cash that left
      // the treasury unrecorded would read as income that never arrived.
      this.autoSpend += cost;
    }
  }

  /** Records when the game was last persisted, so time away can be measured. */
  markSaved(at: number): void {
    this.inner.savedAt = at;
  }

  setAutoDevelop(on: boolean): void {
    this.inner.autoDevelop = on;
  }

  /**
   * Moves the city to one of TAX_STEPS. Clamped rather than trusted, so a HUD
   * bug cannot put the simulation on a rate that does not exist.
   */
  setTaxRate(step: number): void {
    this.inner.taxRate = Math.max(0, Math.min(TAX_STEPS.length - 1, Math.floor(step)));
  }

  /** Fares off, reach up, mood up. A trade, not an upgrade — see the constants. */
  setFreeTransport(on: boolean): void {
    this.inner.freeTransport = on;
  }

  reset(): void {
    this.inner = createState();
    this.accumulator = 0;
    this.autoSpend = 0;
    this.firesStarted = 0;
    this.firesExtinguished = 0;
    this.firesLost = 0;
    this.abandoned = 0;
    this.recovered = 0;
    this.annexed = 0;
    this.merged = 0;
    this.lossesLeft = Number.POSITIVE_INFINITY;
    this.abandonsLeft = Number.POSITIVE_INFINITY;
    this.annexesLeft = Number.POSITIVE_INFINITY;
  }

  /**
   * Spends surplus cash on whichever plot is cheapest, up to `budget` purchases.
   * Deliberately never annexes — `autoAnnex` owns that, and owns it whether or
   * not auto-development is switched on, because expansion is now the city's
   * own business rather than an opt-in.
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
            addBuilding(s.homeLevels);
            built.homes++;
          },
        });
      }
      if (s.demandC >= 0 && canBuildShop(s)) {
        options.push({
          cost: shopCost(s),
          buy: () => {
            s.shops++;
            addBuilding(s.shopLevels);
            built.shops++;
          },
        });
      }
      if (s.demandI >= 0 && canBuildIndustry(s)) {
        options.push({
          cost: industryCost(s),
          buy: () => {
            s.industry++;
            addBuilding(s.industryLevels);
            built.industry++;
          },
        });
      }
      for (const service of SERVICES) {
        // Housing land rather than residents, because that is what a service is
        // now short of. The two only differ for a city that has built houses
        // nobody is in, which is exactly the city that should still be allowed
        // to buy the hospital that would bring them back.
        if (housingPlots(s) <= 0 || serviceCount(s, service.key) >= serviceNeeded(s, service)) continue;
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
      districts: this.inner.districts,
      started: this.firesStarted,
      extinguished: this.firesExtinguished,
      lost: this.firesLost,
      abandoned: this.abandoned,
      recovered: this.recovered,
      merged: this.merged,
    };

    // The hard guard, for the length of this call and no longer. However many
    // fires resolve badly across a twelve-hour absence, the city comes back at
    // most one building smaller; the rest are put out instead and still counted.
    this.lossesLeft = CATCHUP_MAX_LOSSES;
    // The same guard for decay. However long the absence, the city comes back
    // at most CATCHUP_MAX_ABANDONED plots darker than it was left.
    this.abandonsLeft = CATCHUP_MAX_ABANDONED;
    this.annexesLeft = CATCHUP_MAX_ANNEXES;

    // Fixed steps, not a fixed step count: coarse steps let auto-development
    // buy against a demand curve that has already jumped to its asymptote.
    const steps = Math.min(
      CATCHUP_MAX_STEPS,
      Math.max(1, Math.ceil(credited / CATCHUP_STEP_SECONDS)),
    );
    const dt = credited / steps;
    for (let i = 0; i < steps; i++) this.step(dt);
    this.lossesLeft = Number.POSITIVE_INFINITY;
    this.abandonsLeft = Number.POSITIVE_INFINITY;
    this.annexesLeft = Number.POSITIVE_INFINITY;

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
      abandoned: this.abandoned - before.abandoned,
      recovered: this.recovered - before.recovered,
      merges: this.merged - before.merged,
      districts: s.districts - before.districts,
    };
  }
}
