import {
  AWAY_COALESCE_SECONDS,
  AWAY_EVENT_BUFFER,
  EventLog,
  EVENT_COVERAGE_LOST,
  type GameEvent,
} from '../core/events.ts';
import { ACHIEVEMENTS, ACHIEVEMENT_TEST_SECONDS } from './achievements.ts';
import {
  HISTORY_COARSE_SECONDS,
  HISTORY_FINE_SECONDS,
  advance as advanceTier,
  emptyHistory,
} from './history.ts';
import { districtLand } from './layout.ts';
import { hash01, mixSeed } from '../core/rng.ts';
import {
  CATCHUP_MAX_ABANDONED,
  CATCHUP_MAX_ANNEXES,
  CATCHUP_MAX_SURVEYS,
  SURVEY_SECONDS,
  CATCHUP_MAX_LOSSES,
  CATCHUP_MAX_STEPS,
  CATCHUP_STEP_SECONDS,
  IGNITION_HAZARD_CAP,
  MAX_ACTIVE_CALLS,
  MAX_ACTIVE_FIRES,
  POLICE_RESPONSE,
  LEVEL_EDUCATION,
  LEVELS,
  MERGE_LEVEL,
  OFFLINE_CAP_SECONDS,
  SERVICES,
  UPKEEP_KEEP_SHARE,
  POWER_TRADES,
  TAX_STEPS,
  TICK_RATE,
  type Landmark,
  type Service,
  type Terminal,
  type TransitLine,
  type Culture,
} from './config.ts';
import {
  annexCost,
  canAscend,
  legacyGain,
  arrearsStep,
  burnableBuildings,
  burnableOf,
  canAnnex,
  annexZoning,
  frontierDistrict,
  willSurvey,
  willRelease,
  willTransfer,
  capacityOf,
  airportCost,
  canBuildAirport,
  canBuildCityHall,
  canBuildHome,
  canBuildPlant,
  canBuildIndustry,
  canBuildPark,
  canBuildService,
  canBuildEstate,
  canBuildHighway,
  canBuildShop,
  canBuildTerminal,
  canBuildLine,
  lineCost,
  canBuildCulture,
  cultureCost,
  canMergeParcel,
  cityHallCost,
  civicBuildings,
  coverage,
  clampDemand,
  demandStep,
  demandTargets,
  educationCoverage,
  estateCost,
  happinessStep,
  happinessTarget,
  hasPolicy,
  highwayCost,
  homeBlocker,
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
  plantCost,
  canBuildLandmark,
  landmarkCost,
  powerCap,
  powerDemand,
  powerRatio,
  promoteRate,
  recoverRate,
  abandonRate,
  recreationCoverage,
  residents,
  housingPlots,
  resolvesAt,
  responseResolvesAt,
  missesDeadline,
  callRate,
  standingOf,
  cohortTotal,
  countOf,
  serviceCost,
  serviceCount,
  serviceNeeded,
  shopCost,
  staffAfterBuild,
  staffStep,
  terminalCost,
  netIncome,
  upkeep,
  upkeepReserve,
  willAutoAnnex,
  wouldBurnOut,
  ZONE_KINDS,
} from './economy.ts';
import {
  createState,
  type Call,
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
 * The call process's own stream.
 *
 * A different salt rather than a shared cursor, and that is what keeps the two
 * emergencies independent: on one stream, a city that had a fire would find its
 * next call drawn from a different place in the sequence than a city that had
 * not, and the two mechanics would be silently coupled through the hash.
 */
const CALL_STREAM = 0x2b91c7;

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

/** The same exponential waiting time, on the call stream. */
const callWait = (cursor: number): number =>
  -Math.log(1 - hash01(mixSeed(CALL_STREAM, cursor)));

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
  /**
   * `elapsed` at the moment the absence started.
   *
   * The origin the timeline is read against. A `GameEvent` carries an absolute
   * `at` — it is `GameState.elapsed`, the only clock the simulation has — so
   * turning one into "+2h14m into the absence" needs the other end of the
   * interval, and this is it.
   */
  startedAt: number;
  /**
   * What happened, in the order it happened.
   *
   * The half of the report the totals cannot carry. A total is what an absence
   * *added up to*; this is what it consisted of, and the two answer different
   * questions — "you lost two buildings" against "at +6h40m two homes burned
   * down while the fire station was unstaffed".
   *
   * Bounded by AWAY_EVENT_BUFFER and coalesced at AWAY_COALESCE_SECONDS, so a
   * twelve-hour absence is a readable list rather than a log. Never saved: it
   * is a byproduct of one `catchUp` call and dies with the sheet.
   */
  timeline: readonly GameEvent[];
  /**
   * Entries the away log ran out of room for, oldest first.
   *
   * Measured, and the reason this field exists rather than a comment claiming
   * the bound is headroom: a twelve-hour absence of a *mid-size* city produces
   * 117 distinct entries at AWAY_COALESCE_SECONDS and a large one 132, against
   * a ring of 64. Widening the window barely helps — 30 minutes still leaves 70
   * and 82 — because what dominates is `level-up`, which has fifteen distinct
   * (zone, level) subjects and genuinely does happen all day.
   *
   * So the ring truncates for any city with something going on, and the sheet
   * has to say so. Showing the newest sixty-four and nothing else would be
   * claiming that was the whole absence.
   */
  dropped: number;
  earned: number;
  /**
   * Cash auto-development handed straight back out. Reported because it is the
   * only honest way to show it: the numbers cannot be reconstructed after the
   * fact now that a price depends on the demand at the moment of purchase.
   */
  spent: number;
  /**
   * Wages the city paid its civic buildings while nobody was watching.
   *
   * The third outgoing, and it has to be here for the ledger to close: `earned`
   * is gross, so `earned - spent - wages` is the change in the treasury and any
   * two of the three cannot account for the fourth. It is also the one line that
   * explains a returning player's browned-out services — a city that could not
   * make its wages comes back with staffing it did not lose to anything visible.
   */
  wages: number;
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
  /** Power plants opened while away. Reported for the reason services are. */
  plants: number;
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
   * What the police were called to, and how that went.
   *
   * The same three lines as the fires and reported for the same reason: an
   * absence that raised the crime bar and said nothing about why is an absence
   * the player cannot learn from. The difference is that no building is ever
   * named — a missed call costs the crime it carried and nothing else.
   */
  callsRaised: number;
  callsAnswered: number;
  callsMissed: number;
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
  /**
   * Parcels the surveyor rezoned while nobody was watching.
   *
   * Reported for the same reason abandonment is: a player who comes back to a
   * different-looking frontier and no explanation has been robbed. Capped at
   * CATCHUP_MAX_SURVEYS for the length of the absence, so the number is small
   * enough to be a line rather than a list.
   */
  surveyed: number;
}

/** What one pass of auto-development put on the ground. */
interface AutoBuilt {
  homes: number;
  shops: number;
  industry: number;
  parks: number;
  services: number;
  plants: number;
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
   * Lifetime wages paid. Differenced by `catchUp` exactly as `autoSpend` is, and
   * for the same reason: `step` has no notion of who is watching.
   */
  private wagesPaid = 0;
  /**
   * Lifetime fire tallies. `catchUp` differences them the same way it does
   * `autoSpend`, which keeps `step` free of any notion of who is watching.
   */
  private firesStarted = 0;
  private firesExtinguished = 0;
  private firesLost = 0;
  private callsRaised = 0;
  private callsAnswered = 0;
  private callsMissed = 0;
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
  /**
   * Surveys a single `catchUp` may make. Unlimited while the player is watching.
   *
   * The same guard the other three carry, and the one the brief for this feature
   * asked for by name: a twelve-hour absence must not return a city whose zoning
   * nobody watched change. Generous, because the surveyor is self-limiting —
   * every survey shuts its own gate until the player builds again.
   */
  private surveysLeft = Number.POSITIVE_INFINITY;
  /** Surveys made, for the away sheet. */
  private surveyed = 0;
  /** Reused by `promote`, which runs every tick and must not allocate. */
  private readonly scratch: number[] = new Array<number>(LEVELS).fill(0);
  /**
   * Things that happened, for the ticker.
   *
   * Not state, and the distinction is load-bearing: nothing here reaches
   * `GameState`, nothing is saved, and no simulation read consults it. Dropping
   * the whole log on the floor would leave an identical city. See
   * `core/events.ts`.
   */
  private readonly log = new EventLog();
  /**
   * The second log, and the one an absence is reported through.
   *
   * The ticker is silent for the length of a `catchUp` and that is right — see
   * `recording`, which argues it at length. What that reasoning was right about
   * is the *ticker*: a sixteen-entry ring drained every frame cannot carry
   * twelve hours, and replaying it under the away sheet would say the same
   * facts twice and push the live events out.
   *
   * It was wrong about the *sheet*. The sheet is modal, has the player's whole
   * attention, and lists twenty totals — and a total is what added up, not what
   * happened. "You earned 4.2M and lost two buildings" and "at +2h14m the grid
   * went short, at +6h40m two homes burned down" are different reports, and the
   * second one is the one that explains the first.
   *
   * So: the same class, the same merge rule, and a bound and a window of its
   * own. `Game.recording` still gates the ticker; this records regardless and
   * is cleared at the top of every `catchUp`.
   */
  private readonly awayLog = new EventLog(AWAY_EVENT_BUFFER, AWAY_COALESCE_SECONDS);
  /** Whether the away log is recording. True only inside a `catchUp`. */
  private away = false;
  /**
   * Whether events are being recorded at all.
   *
   * Off for the length of a `catchUp` call, and that is the one interesting
   * design question this feature had. A twelve-hour absence emits thousands of
   * events, and the two honest options were a summary event per category or
   * nothing at all. Nothing at all wins because the summary already exists: the
   * "while you were away" sheet is modal, has the player's attention, and lists
   * every one of these categories with an exact count. A ticker replaying the
   * same facts underneath it would say them twice and worse — and the second
   * copy would push the *live* events out of a sixteen-entry buffer before the
   * player had finished reading the first.
   */
  private recording = true;
  /**
   * The last housing blocker announced, so the ticker says it once.
   *
   * `homeBlocker` returns the same string on every tick it is true, and the
   * event is about the *transition*. Coalescing would collapse the repeats into
   * one line with a count of thirty-six thousand, which is a different lie.
   */
  private blocked: string | null = null;
  /** Which services were covering the whole city last tick. Same reasoning. */
  private readonly covering = new Set<string>();
  /** Whether the grid was covering the load last tick. Same reasoning again. */
  private lit = true;
  /**
   * Simulated seconds banked toward the next pass over the achievement table.
   *
   * On the instance rather than in the save — see ACHIEVEMENT_TEST_SECONDS for
   * why this one does not have to be step-size invariant when `surveyClock`
   * does. A reload starts it at zero, which only means the first pass happens
   * sooner, and the record it writes is a pure function of the state either way.
   */
  private achievementClock = 0;

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
    // The achievement record is the fourth field that is not a number, and it
    // is copied for exactly the reason the three cohorts are: two games built
    // from one patch object would otherwise share it and unlock each other's
    // rows.
    this.inner.unlocked = { ...state.unlocked };
    // And the chart, for the same reason again: two games spread from one patch
    // would otherwise write into one another's rings.
    this.inner.history = {
      fine: { ...state.history.fine },
      coarse: { ...state.history.coarse },
    };
  }

  get state(): Readonly<GameState> {
    return this.inner;
  }

  /**
   * Everything that has happened since the last time anybody asked.
   *
   * Draining rather than reading, so two consumers cannot both act on one event
   * and a consumer that stops asking cannot leave the buffer growing. The HUD is
   * the only caller.
   */
  drainEvents(): GameEvent[] {
    return this.log.drain();
  }

  /**
   * The one place an event is recorded, so `catchUp` can silence the ticker.
   *
   * Two logs, and exactly one of them is recording at any moment: the ticker
   * while the player is watching, the away log while they are not. Written as
   * two independent tests rather than an if/else so that a future third
   * consumer does not have to reopen the question.
   */
  private emit(event: GameEvent): void {
    if (this.recording) this.log.push(event);
    if (this.away) this.awayLog.push(event);
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
    // Gross in, wages out, in that order and against the same state. `earned`
    // is the gross line — it is what the city took, and what it then spent on
    // wages is spending, exactly as auto-development's purchases are.
    const arrears = this.payWages(upkeep(s) * dt, gain);
    // Staffing before happiness before demand: happiness reads coverage, and
    // the residential ceiling reads happiness. Integrating them out of order
    // would leave each one a tick behind the thing it is supposed to follow.
    this.integrateStaffing(dt, arrears);
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
    // The calls next, in the same order and for the same reason: resolve what
    // was open at the top of the tick against the coverage that was standing,
    // then take the new ones. They come after the fires rather than before
    // because `crime` is read by `integrateHappiness` above and a call raised
    // here is a call the *next* tick's mood answers — which is the same one
    // tick of lag every event in this loop has.
    this.resolveCalls();
    this.raiseCalls(dt);
    // The surveyor before annexation, so a district that is about to freeze gets
    // the last word on its own split before the next one arrives and fixes it.
    this.survey(dt);
    // Annexation before auto-development, so a district that arrives this tick
    // is land the same tick can start building on rather than land that waits a
    // tenth of a second — the same reasoning fires already follow.
    this.autoAnnex();
    // Policy, and policy needs a city hall. Gated on the effect rather than on
    // the stored flag, so a save that arrives with the switch on keeps it on and
    // starts developing the moment the hall is built — see `hasPolicy`.
    if (s.autoDevelop && hasPolicy(s)) this.autoDevelop(8);
    // Last, and after auto-development, so what the ticker reports is the tick's
    // settled state rather than a state the same tick went on to change.
    this.watchTransitions();
    // And last of all, the record. Same reasoning as the ticker's, one step
    // further: an achievement about the tick's settled state must be tested
    // after everything that could settle it, including the purchase
    // auto-development just made.
    this.checkAchievements(dt);
    // And the chart, which reads the settled tick for the same reason. It is a
    // pure readout — nothing in the loop above consults it — so it is last.
    this.recordHistory(dt);
  }

  /**
   * Banks `dt` into both tiers of the chart and samples whichever have come due.
   *
   * `residents` rather than `population`, and `income` rather than `netIncome`:
   * the chart is about the city that exists, not the one its housing was built
   * for, and about what the buildings take in before the wage bill — which is
   * the line the Treasury tab calls gross and the one a player watching a graph
   * of "income" means.
   *
   * Read once and handed to both tiers, because they are two views of the same
   * instant and computing `income(s)` twice a minute for the sake of symmetry
   * would be two walks of the cohorts for one number.
   */
  private recordHistory(dt: number): void {
    const s = this.inner;
    const fine = s.history.fine;
    const coarse = s.history.coarse;
    // Neither tier is due on the overwhelming majority of ticks, so the sample
    // is built only once one of them is — `income` and `residents` are cohort
    // walks and this runs ten times a second.
    if (
      fine.clock + dt < HISTORY_FINE_SECONDS &&
      coarse.clock + dt < HISTORY_COARSE_SECONDS
    ) {
      fine.clock += Math.max(0, dt);
      coarse.clock += Math.max(0, dt);
      return;
    }
    const sample = {
      population: residents(s),
      income: income(s),
      happiness: s.happiness,
    };
    advanceTier(fine, dt, HISTORY_FINE_SECONDS, sample);
    advanceTier(coarse, dt, HISTORY_COARSE_SECONDS, sample);
  }

  /**
   * Records any achievement the city has newly earned.
   *
   * Only the rows still locked are walked, so the pass shrinks as the table
   * fills and costs nothing at all for a city that has earned everything.
   * Banked rather than run per tick — see ACHIEVEMENT_TEST_SECONDS.
   *
   * The record is written whether or not anyone is watching; only the *event*
   * is silenced during a catch-up, exactly as every other category is. So a
   * twelve-hour absence comes back with the rows it earned already ticked and
   * the ticker reporting the state it came back to rather than the history it
   * missed — see `recording`.
   */
  private checkAchievements(dt: number): void {
    const s = this.inner;
    this.achievementClock += Math.max(0, dt);
    if (this.achievementClock < ACHIEVEMENT_TEST_SECONDS) return;
    // Reset rather than decremented. This is a refresh rhythm, not an
    // accumulator spending whole passes: a 60-second catch-up step earns one
    // pass, because sixty passes over an unchanged state would find the same
    // answer sixty times.
    this.achievementClock = 0;
    for (const achievement of ACHIEVEMENTS) {
      if (s.unlocked[achievement.key] !== undefined) continue;
      if (!achievement.test(s)) continue;
      s.unlocked[achievement.key] = s.elapsed;
      this.emit({
        kind: 'unlocked',
        at: s.elapsed,
        key: achievement.key,
        name: achievement.name,
        count: 1,
      });
    }
  }

  /**
   * Re-arms the edge-triggered watchers after a silent catch-up.
   *
   * Without this a condition that went true while the player was away is
   * absorbed and never announced, because the edge it fires on has already been
   * crossed. Measured on a *one-second* absence, which is what a reload costs: a
   * city whose grid had gone short came back capped at 37% occupancy with an
   * empty ticker and nothing on the default tab to say why.
   *
   * The rule this leaves is a good one to state plainly: **the ticker reports
   * the state you came back to, not the history you missed.** Anything that went
   * wrong and righted itself while you were away says nothing — that is what the
   * "while you were away" sheet is for — and anything still wrong when you look
   * says so once. The coverages are re-armed by assuming everything was covered
   * when you left, which is exactly what makes "still short now" the thing that
   * fires.
   */
  private rearm(): void {
    this.blocked = null;
    this.lit = true;
    this.covering.clear();
    for (const service of SERVICES) this.covering.add(service.key);
  }

  /**
   * The two events that are about a line being crossed rather than a thing
   * being done.
   *
   * Everything else here is emitted where it happens — a fire starts, a parcel
   * merges — and these two have no such moment: they are conditions that become
   * true and stay true. So they are edge-triggered against what was last
   * announced, because the alternative is a line that says "residents are
   * leaving x 36,000" after an hour of it being the case.
   */
  private watchTransitions(): void {
    const s = this.inner;
    // Three tests in a deliberate order. The *state* is whether housing is
    // blocked at all, so it clears the moment it is not; the reason is what has
    // to change for the line to be worth printing again; and the cash test only
    // gates the announcement, because "you cannot afford it" is already on the
    // button next to a price.
    //
    // Ordering them the other way round was measured and is wrong: with the cash
    // test outermost the condition flickers every time auto-development spends
    // the treasury, and one hour announced "residents are leaving" seven times.
    const reason = homeBlocker(s);
    if (reason === null) this.blocked = null;
    else if (reason !== this.blocked && s.cash >= homeCost(s)) {
      this.blocked = reason;
      this.emit({ kind: 'blocked', at: s.elapsed, reason, count: 1 });
    }

    // The grid, on the same edge-triggered rule the coverages are on: it is a
    // condition that becomes true and stays true, so the event is the crossing.
    // Re-armed only by the ratio getting back over 1, so a city sitting short
    // says so once rather than once a tick.
    const ratio = powerRatio(s);
    if (ratio >= 1) this.lit = true;
    else if (this.lit && powerDemand(s) > 0) {
      this.lit = false;
      this.emit({ kind: 'brownout', at: s.elapsed, ratio, cap: powerCap(s), count: 1 });
    }

    // A city with no housing reads as fully covered — `coverage` is the share a
    // service *fails* and it fails nothing when nothing is built — so without
    // this a fresh game would announce all six services falling short the
    // instant the first house went up. They were never covering anything.
    if (housingPlots(s) <= 0) {
      this.covering.clear();
      return;
    }
    for (const service of SERVICES) {
      const reach = coverage(s, service);
      // Armed at a full 1 and fired past EVENT_COVERAGE_LOST, so the line is not
      // printed every time the number wobbles across the top of its range.
      if (reach >= 1) {
        this.covering.add(service.key);
        continue;
      }
      if (reach >= EVENT_COVERAGE_LOST || !this.covering.delete(service.key)) continue;
      this.emit({
        kind: 'coverage',
        at: s.elapsed,
        service: service.key,
        coverage: reach,
        count: 1,
      });
    }
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
        this.emit({ kind: 'fire-lost', at: s.elapsed, zone: fire.kind, count: 1 });
      } else {
        // Past the loss budget the fire still ends, it just ends well. The
        // alternative — leaving it burning — would hand a returning player a
        // city permanently on fire, which is worse than the thing being guarded
        // against.
        this.firesExtinguished++;
        this.emit({ kind: 'fire-out', at: s.elapsed, zone: fire.kind, count: 1 });
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

  /**
   * Closes every call whose clock has run out, and says which way it went.
   *
   * `resolveFires`'s shape with the consequence taken out, and the missing
   * consequence is the design rather than an omission: a fire the brigade
   * misses costs a building, and a call the police miss costs the crime it
   * carried while it sat. Nothing is destroyed, because `abandonedR` has
   * already settled what permanent loss does to an idle game.
   *
   * The response time is read fresh here too, so a station opened while a call
   * is waiting turns a missed call into an answered one — the property fire's
   * own comment defends and the one that makes buying a station mid-crisis
   * worth doing.
   */
  private resolveCalls(): void {
    const s = this.inner;
    if (s.calls.length === 0) return;
    const limit = responseResolvesAt(s, POLICE_RESPONSE);
    const missed = missesDeadline(s, POLICE_RESPONSE);

    let write = 0;
    for (let i = 0; i < s.calls.length; i++) {
      const call = s.calls[i] as Call;
      if (s.elapsed - call.startedAt < limit) {
        s.calls[write++] = call;
        continue;
      }
      // Only the miss is announced. An answered call is the system working,
      // and a log that said so would be the one stream loud enough to fragment
      // every other — see the `call-missed` note in `events.ts`. Both halves
      // are still counted, because the away sheet reports both.
      if (missed) {
        this.callsMissed++;
        this.emit({ kind: 'call-missed', at: s.elapsed, zone: call.kind, count: 1 });
      } else {
        this.callsAnswered++;
      }
    }
    s.calls.length = write;
    this.pruneCalls();
  }

  /** A call about a building the city no longer owns stops being a call. */
  private pruneCalls(): void {
    const s = this.inner;
    let write = 0;
    for (const call of s.calls) {
      if (call.index < burnableOf(s, call.kind)) s.calls[write++] = call;
    }
    s.calls.length = write;
  }

  /**
   * Accumulates call pressure and spends it.
   *
   * `igniteFires` exactly: a hazard integrated at `rate x dt` and spent against
   * exponential waiting times, which is the one form of a Poisson process that
   * gives the same answer at any step size. A Bernoulli trial per tick would
   * make a 60-second catch-up a different distribution from 600 tenth-second
   * ticks, and the away report would describe a city the player never had.
   */
  private raiseCalls(dt: number): void {
    const s = this.inner;
    const rate = callRate(s);
    if (rate <= 0 || burnableBuildings(s) <= 0) return;
    s.callHazard = Math.min(IGNITION_HAZARD_CAP, s.callHazard + rate * dt);

    for (let guard = 0; guard < IGNITION_GUARD; guard++) {
      const wait = callWait(s.callCursor);
      if (s.callHazard < wait) break;
      s.callHazard -= wait;
      s.callCursor++;
      this.raise();
    }
  }

  /**
   * Takes one call, about a building drawn in proportion to how many there are.
   *
   * The draws are spent even when the call cannot be placed — the same rule
   * `ignite` states and for the same reason: a city sitting at
   * MAX_ACTIVE_CALLS for an hour would otherwise bank an hour of pressure and
   * let all of it go the moment a slot opened.
   *
   * Two calls to the same building are allowed where two fires are not. A house
   * cannot burn down twice; a street where something happens twice is a street
   * with a problem, and refusing the second draw would quietly cap the rate at
   * one call per building.
   */
  private raise(): void {
    const s = this.inner;
    const kindRoll = hash01(mixSeed(CALL_STREAM, s.callCursor));
    s.callCursor++;
    const slotRoll = hash01(mixSeed(CALL_STREAM, s.callCursor));
    s.callCursor++;
    if (s.calls.length >= MAX_ACTIVE_CALLS) return;

    const pick = kindRoll * burnableBuildings(s);
    const kind: ZoneKind =
      pick < s.homes ? 'home' : pick < s.homes + s.shops ? 'shop' : 'industry';
    const of = burnableOf(s, kind);
    if (of <= 0) return;
    const index = Math.min(of - 1, Math.floor(slotRoll * of));

    s.calls.push({ kind, index, startedAt: s.elapsed });
    this.callsRaised++;
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
    this.emit({ kind: 'fire-started', at: s.elapsed, zone: kind, count: 1 });
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
  private integrateStaffing(dt: number, arrears = 0): void {
    const s = this.inner;
    const k = staffStep(dt);
    // Two forces on one scalar: the ramp pulls it toward fully staffed, and
    // unpaid wages pull it back toward empty. Applied in that order, so a city
    // that pays its bill this tick sees no decay at all and a city paying none
    // of it loses ground however hard the ramp pulls. Both are the exponential
    // form, so the pair is safe at a 60-second catch-up step.
    const kept = 1 - arrearsStep(dt, arrears);
    const fill = (staff: number, built: number): number =>
      built > 0 ? (staff + (1 - staff) * k) * kept : 0;
    s.hospitalStaff = fill(s.hospitalStaff, s.hospitals);
    s.policeStaff = fill(s.policeStaff, s.police);
    s.fireStaff = fill(s.fireStaff, s.fire);
    s.schoolStaff = fill(s.schoolStaff, s.schools);
    s.universityStaff = fill(s.universityStaff, s.universities);
    s.depotStaff = fill(s.depotStaff, s.depots);
    s.wasteStaff = fill(s.wasteStaff, s.wasteDepots);
    // Plants ramp like everything else on the payroll, so a plant opened this
    // instant is not yet carrying the grid — and an unpaid wage bill takes it
    // back the same way. See `powerSupply`, which reads this.
    s.plantStaff = fill(s.plantStaff, s.plants);
  }

  /**
   * Pays what the treasury can cover and reports the share left owing.
   *
   * Cash is floored rather than allowed to run a deficit, which is the whole of
   * the bankruptcy rule: the city cannot owe money, so what it fails to pay is
   * taken out of its staffing instead — see UPKEEP_ARREARS_TAU for why that and
   * not a demolition. The return is a *share* rather than an amount, because the
   * decay is a rate and a rate scaled by an absolute shortfall would mean
   * something different at every city size.
   *
   * Charged against this tick's *revenue* rather than against the treasury, and
   * capped at 1 - UPKEEP_KEEP_SHARE of it. That cap is the difference between a
   * brownout and a deadlock — see UPKEEP_KEEP_SHARE, which carries the two
   * weaker rules that were measured first and the fixed points they settle at.
   * Reserves are never spent on wages, so the treasury grows by at least a tenth
   * of gross however deep the arrears run.
   */
  private payWages(due: number, gross: number): number {
    const s = this.inner;
    if (!(due > 0)) return 0;
    const payable = Math.max(0, gross) * (1 - UPKEEP_KEEP_SHARE);
    const paid = Math.max(0, Math.min(due, payable, s.cash));
    s.cash -= paid;
    this.wagesPaid += paid;
    return 1 - paid / due;
  }

  /**
   * Eases happiness toward the coverage the city currently has.
   *
   * Read once at the top of the step, like every other integrator in this loop,
   * and that is worth a note because it used not to be. The opening grace was a
   * clock — a flat floor under the aim that let go all at once at 120 seconds —
   * so the aim was the one target here that was discontinuous in *time*, and a
   * step straddling that instant had to be integrated in two halves or it took
   * the whole step on whichever side of the cliff it landed. Measured back then:
   * an hour of a new city taken as one catch-up step rezoned four parcels away
   * from the same hour watched, against a tolerance of one.
   *
   * COVERAGE_GRACE_PLOTS moved the grace onto the city's size, which only moves
   * when a building lands, so the aim is continuous in time again and the split
   * went with it.
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
      // One event for the whole run, not one per building. A pass already moves
      // a cohort at a time, and `EventLog` merges consecutive passes on the same
      // rung — so a wave that takes five minutes is still one line.
      this.emit({
        kind: 'level-up',
        at: this.inner.elapsed,
        zone: kind,
        level: l + 1,
        count: take,
      });
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
    // A merge is a promotion to MERGE_LEVEL, so it is reported as one rather
    // than as a category of its own — see `GameEvent`. The count is the building
    // that results, which is what the ticker's other rungs count too.
    this.emit({ kind: 'level-up', at: s.elapsed, zone: kind, level: MERGE_LEVEL, count: 1 });
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
    // Never the last one standing — see `isAbandoning`, which carries the
    // measurement. Bounded here as well as gated there, because a 60-second
    // catch-up step arrives with a budget of tens and the gate only says
    // whether the pass may run at all.
    const spare = Math.max(0, standingOf(s, kind) - 1);
    let moved = 0;
    for (let l = 0; l < LEVELS && moved < spare; l++) {
      const take = Math.min(budget - moved, spare - moved, levels[l] ?? 0, this.abandonsLeft);
      if (take <= 0) continue;
      levels[l] = (levels[l] ?? 0) - take;
      setAbandoned(s, kind, abandonedOf(s, kind) + take);
      this.abandonsLeft -= take;
      this.abandoned += take;
      moved += take;
      this.emit({ kind: 'abandoned', at: s.elapsed, zone: kind, count: take });
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
    this.emit({ kind: 'recovered', at: s.elapsed, zone: kind, count: take });
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

  /**
   * A landmark takes one of the squares reserved for its size and pays nothing
   * back directly. What it buys is the mood of the housing around it — see
   * `landmarkCoverage`, which resolves "around it" against the layout rather
   * than storing anything per building.
   */
  buildLandmark(landmark: Landmark): boolean {
    const s = this.inner;
    if (!canBuildLandmark(s, landmark)) return false;
    s.cash -= landmarkCost(s, landmark);
    if (landmark.key === 'museum') s.museums++;
    else s.stadiums++;
    return true;
  }

  /**
   * A library or a theatre, on the culture square its district reserves.
   *
   * Neither carries mood, which is the whole of what makes them two buildings
   * rather than one: a library answers the idleness half of `crimePressure` and
   * a theatre lands an audience on `berthsLanding`. See CULTURE, which costs
   * the fourth-weight and bracket-modifier readings that were refused.
   */
  buildCulture(culture: Culture): boolean {
    const s = this.inner;
    if (!canBuildCulture(s, culture)) return false;
    s.cash -= cultureCost(s, culture);
    if (culture.key === 'library') s.libraries++;
    else s.theatres++;
    return true;
  }

  /**
   * A line joins two districts, on the k-th pair `linePairAt` enumerates.
   *
   * Nothing about where it runs is stored: the count is the whole of it, and
   * the route falls out of the ordinal, the district count and the seed exactly
   * as a landmark's site falls out of its ordinal. What it buys is freight —
   * `exportMarket` — and quieter roads, and neither is a happiness weight: the
   * three sum to exactly 1 and the network lands in the modifier bracket
   * through congestion, which is the route every mood term since the police
   * re-calibration has taken. See TRANSIT_LINES.
   */
  buildLine(line: TransitLine): boolean {
    const s = this.inner;
    if (!canBuildLine(s, line)) return false;
    s.cash -= lineCost(s, line);
    if (line.key === 'tram') s.tramLines++;
    else s.railLines++;
    return true;
  }

  /**
   * A terminal takes one of the berths the city's coastal districts carry.
   *
   * The two halves pay back in different currencies and neither is rent: a
   * cruise terminal lands visitors who spend, scaled by how much they enjoyed
   * it, and a cargo terminal lifts the export tap industrial demand is drawn
   * against. See TERMINALS.
   */
  buildTerminal(terminal: Terminal): boolean {
    const s = this.inner;
    if (!canBuildTerminal(s, terminal)) return false;
    s.cash -= terminalCost(s, terminal);
    if (terminal.key === 'cruise') s.cruiseTerminals++;
    else s.cargoTerminals++;
    return true;
  }

  /**
   * A power plant, on the 2x2 square its district reserves for one.
   *
   * Civic-shaped — a count, a staffing ramp, a cost curve and a wage bill — and
   * not a `Service`: it has no coverage and carries no happiness weight. What it
   * buys is the one thing a city can otherwise run out of. See `powerCap`.
   */
  buildPlant(): boolean {
    const s = this.inner;
    if (!canBuildPlant(s)) return false;
    s.cash -= plantCost(s);
    // Re-averaged rather than reset, exactly as a civic building's payroll is:
    // the plants already running do not send their crews home because a new one
    // opened, so the grid holds and then climbs to take the new one in.
    s.plantStaff = staffAfterBuild(s.plantStaff, s.plants);
    s.plants++;
    return true;
  }

  /**
   * The city hall: one 2x2 square in district 0, and the right to have policies.
   *
   * It earns nothing, covers nothing and carries no happiness weight — the four
   * happiness weights sum to exactly 1 and re-opening that calibration to buy a
   * UI gate would be a bad trade. What it buys is the Taxes tab and the
   * auto-develop switch. See `hasPolicy`.
   */
  buildCityHall(): boolean {
    const s = this.inner;
    if (!canBuildCityHall(s)) return false;
    s.cash -= cityHallCost();
    s.cityHall = true;
    return true;
  }

  /**
   * The airport, at the end of the same road the estates line.
   *
   * The second thing the city builds on land it does not own, and the first that
   * gives an inland city a reason to care about happiness beyond its own
   * ledger: what it buys is arrivals on the existing tourism path, scaled by
   * mood exactly as a cruise berth's are. See AIRPORT_VISITORS.
   */
  buildAirport(): boolean {
    const s = this.inner;
    if (!canBuildAirport(s)) return false;
    s.cash -= airportCost();
    s.airport = true;
    return true;
  }

  /**
   * The road out of town. Bought once, and what it buys is the right to build
   * on land the city does not own — see HIGHWAY_MIN_DISTRICTS.
   */
  buildHighway(): boolean {
    const s = this.inner;
    if (!canBuildHighway(s)) return false;
    s.cash -= highwayCost();
    s.highway = true;
    return true;
  }

  /**
   * One parcel in the band beyond the city edge.
   *
   * Industry, and counted as industry everywhere it matters — jobs, goods and
   * the income multiplier — but never as *land*, because the city does not own
   * the ground it stands on. The in-district industrial plots are untouched by
   * this and stay exactly where they are.
   */
  buildEstate(): boolean {
    const s = this.inner;
    if (!canBuildEstate(s)) return false;
    s.cash -= estateCost(s);
    s.estates++;
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
    } else if (service.key === 'waste') {
      s.wasteStaff = staffAfterBuild(s.wasteStaff, s.wasteDepots);
      s.wasteDepots++;
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
    // The outgoing district's split is fixed before the new one exists, because
    // freezing appends to what is still the end of the plot lists. One tick
    // later it would be inserting into the middle of them.
    this.freeze(frontierDistrict(s));
    s.districts++;
    // And the new district opens halfway between what the city has been choosing
    // and ZONE_SHARE's own equilibrium. Inheriting outright would be a feedback
    // loop that let the first hour's zoning decide the fortieth district's;
    // opening at neutral would throw the choice away on every expansion.
    const opened = annexZoning(s);
    s.surveyedR.push(opened.home);
    s.surveyedC.push(opened.shop);
    s.surveyedI.push(opened.industry);
    this.annexed++;
    this.emit({ kind: 'annexed', at: s.elapsed, districts: s.districts, count: 1 });
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

  /**
   * Zones one more parcel to whichever zones are short of land, on the frontier.
   *
   * No clock and no RNG. `willSurvey` is a predicate on the state, so this is a
   * loop over the three zones and nothing else — the same shape `autoAnnex` has,
   * and for the same reason: a condition that is true is acted on now rather
   * than on the next tick of some other rhythm. It is bounded without a guard,
   * because a survey drops its own zone under SURVEY_FILL and shuts the gate
   * behind it; the counter below is only for the length of a `catchUp`.
   */
  private survey(dt: number): void {
    const s = this.inner;
    // Banked rather than run per tick. A pass per tick is a rate that depends on
    // the step size, which is the one thing offline catch-up cannot have — see
    // SURVEY_SECONDS. Whole passes are spent out of the bank and the remainder
    // stays for next time, so sixty ticks of a second and one step of a minute
    // make the same number of moves.
    s.surveyClock += Math.max(0, dt);
    let passes = Math.floor(s.surveyClock / SURVEY_SECONDS);
    if (passes <= 0) return;
    s.surveyClock -= passes * SURVEY_SECONDS;
    // Bounded for the same reason CATCHUP_MAX_STEPS is: an absurd `dt` from a
    // clock that jumped must not turn into an unbounded loop.
    passes = Math.min(passes, CATCHUP_MAX_SURVEYS);
    for (let pass = 0; pass < passes; pass++) this.surveyPass();
  }

  /** One pass of the surveyor: at most one move per zone, plus one transfer. */
  private surveyPass(): void {
    const s = this.inner;
    for (const kind of ZONE_KINDS) {
      if (this.surveysLeft <= 0) return;
      // Both directions, checked in one pass. They are mutually exclusive by
      // construction — one wants demand past +SURVEY_DEMAND and the other past
      // -SURVEY_DEMAND — so the order inside the loop decides nothing.
      const by = willSurvey(s, kind) ? 1 : willRelease(s, kind) ? -1 : 0;
      if (by === 0) continue;
      this.surveysLeft--;
      this.zone(kind, by);
      this.surveyed++;
      this.emit({
        kind: 'surveyed',
        at: s.elapsed,
        zone: kind,
        plots: capacityOf(s, kind),
        count: 1,
      });
    }

    // And last, the contest. A district opens with its pool fully allocated, so
    // for most of its life the only way housing grows is by taking commercial
    // land and the other way about — which the absolute gates above cannot ask
    // for, because neither zone need be in surplus for one to want it more.
    // After them, so spare land is always spent before anything is taken.
    if (this.surveysLeft <= 0) return;
    const swap = willTransfer(s);
    if (swap === null) return;
    this.surveysLeft--;
    this.zone(swap.from, -1);
    this.zone(swap.to, 1);
    this.surveyed++;
    this.emit({
      kind: 'surveyed',
      at: s.elapsed,
      zone: swap.to,
      plots: capacityOf(s, swap.to),
      count: 1,
    });
  }

  /** Moves the frontier district's parcel count for one zone. */
  private zone(kind: ZoneKind, by: number): void {
    const s = this.inner;
    const at = frontierDistrict(s);
    const list = kind === 'home' ? s.surveyedR : kind === 'shop' ? s.surveyedC : s.surveyedI;
    while (list.length <= at) list.push(0);
    list[at] = Math.max(0, (list[at] ?? 0) + by);
  }

  /**
   * Fixes a district's split, spending whatever it never zoned.
   *
   * Called from `annex`, at the one moment a district stops being the frontier.
   * The remainder is not stranded and must not be: land the city bought and left
   * unzoned would be deleted on every expansion and would sit in the annexation
   * gate's denominator forever. So the pool is emptied — pro rata to the split
   * the district already has, so freezing *amplifies* the choice that was made
   * rather than introducing a new one — and industry's unused reserve goes the
   * same way, into the shared pool the other two draw from.
   *
   * It has to happen here rather than continuously, and that is the theorem one
   * layer down: commerce fills the pool from the back, so a pool whose size moved
   * with the industrial count would move every commercial plot in the district
   * each time industry surveyed. The freeze is the one moment the district's
   * segment is still the end of the list, so it is the one moment anything can
   * be appended to it without moving what is already there.
   */
  private freeze(index: number): void {
    const s = this.inner;
    const limits = districtLand(index).limits;
    const home = s.surveyedR[index] ?? 0;
    const shop = s.surveyedC[index] ?? 0;
    let spare = limits.shared - home - shop;
    if (spare <= 0) return;
    // Pro rata to what the district already chose, with a bare split going half
    // and half — a district that surveyed nothing has expressed no preference,
    // and the neutral reading of no preference is the middle.
    const taken = home + shop;
    const toHome = taken > 0 ? Math.round((spare * home) / taken) : Math.round(spare / 2);
    s.surveyedR[index] = home + toHome;
    s.surveyedC[index] = shop + (spare - toHome);
  }

  /** Records when the game was last persisted, so time away can be measured. */
  markSaved(at: number): void {
    this.inner.savedAt = at;
  }

  /**
   * The three policy setters, and all three refuse without a city hall.
   *
   * Refusing here as well as gating the effect is the same belt-and-braces
   * `setTaxRate`'s clamp already is: the HUD disables these controls, and the
   * simulation is what decides whether it is allowed to. A refusal leaves the
   * stored value alone rather than resetting it, so nothing a player chose under
   * an older build is lost by loading a newer one.
   */
  setAutoDevelop(on: boolean): void {
    if (!hasPolicy(this.inner)) return;
    this.inner.autoDevelop = on;
  }

  /**
   * Moves the city to one of TAX_STEPS. Clamped rather than trusted, so a HUD
   * bug cannot put the simulation on a rate that does not exist.
   */
  setTaxRate(step: number): void {
    if (!hasPolicy(this.inner)) return;
    this.inner.taxRate = Math.max(0, Math.min(TAX_STEPS.length - 1, Math.floor(step)));
  }

  /** Fares off, reach up, mood up. A trade, not an upgrade — see the constants. */
  setFreeTransport(on: boolean): void {
    if (!hasPolicy(this.inner)) return;
    this.inner.freeTransport = on;
  }

  /**
   * Where the city buys and sells power. An index into POWER_TRADES.
   *
   * Same shape and same gate as `setTaxRate`: a treaty is policy, and policy
   * needs somebody to sign it. Clamped rather than trusted, so a caller cannot
   * put the save on a step that is not in the table.
   */
  setPowerTrade(step: number): void {
    if (!hasPolicy(this.inner)) return;
    this.inner.powerTrade = Math.max(0, Math.min(POWER_TRADES.length - 1, Math.floor(step)));
  }

  /** The goods agreement: a lift on the export tap, and most of the rival's answer. */
  setGoodsTrade(on: boolean): void {
    if (!hasPolicy(this.inner)) return;
    this.inner.goodsTrade = on;
  }

  reset(): void {
    this.inner = createState();
    this.accumulator = 0;
    this.autoSpend = 0;
    this.wagesPaid = 0;
    this.firesStarted = 0;
    this.firesExtinguished = 0;
    this.firesLost = 0;
    this.callsRaised = 0;
    this.callsAnswered = 0;
    this.callsMissed = 0;
    this.abandoned = 0;
    this.recovered = 0;
    this.annexed = 0;
    this.merged = 0;
    this.lossesLeft = Number.POSITIVE_INFINITY;
    this.abandonsLeft = Number.POSITIVE_INFINITY;
    this.annexesLeft = Number.POSITIVE_INFINITY;
    this.recording = true;
    this.log.clear();
    this.blocked = null;
    this.covering.clear();
    this.lit = true;
    this.achievementClock = 0;
    // `createState` already handed the new state empty rings; this says so
    // explicitly next to the other per-run counters rather than relying on it.
    this.inner.history = emptyHistory();
  }

  /**
   * Gives the city up and founds another one on the same seed.
   *
   * Cheaper than it sounds, and the reason is worth stating: SEED is a
   * compile-time constant, so every city this game has ever drawn is already on
   * the same map. The water, the street walks, the plot lists and the
   * annexation spiral are identical across runs by construction — there is no
   * world generation here at all, only a `reset` and two numbers that survive
   * it. `test/ascension.test.ts` asserts the property the whole feature rests
   * on: a city founded twice draws the same map as one founded once.
   *
   * Built on top of `reset` rather than inside it, because `reset` is correct
   * as it stands: "clear the city" means clear it, and a reset that quietly
   * kept a multiplier would be a reset that lied. So this calls it and then
   * re-seeds exactly the two fields that are allowed to survive:
   *
   *   - `foundings`, because a city that has been founded three times is on its
   *     third founding whatever else is true of it;
   *   - `legacy`, because it is the whole feature. It is what the city being
   *     given up is worth to the one replacing it.
   *
   * Everything else goes, and two of them are worth naming because a player
   * will notice. The awards go: `unlocked` keys to `elapsed`, which restarts,
   * so a carried record would timestamp a city that no longer exists — and the
   * rows re-earn quickly in a city that earns faster. The history rings go for
   * the same reason: they are a chart of a city, and this is a different one.
   */
  ascend(): boolean {
    if (!canAscend(this.inner)) return false;
    const foundings = this.inner.foundings + 1;
    const legacy = this.inner.legacy + legacyGain(this.inner);
    this.reset();
    this.inner.foundings = foundings;
    this.inner.legacy = legacy;
    return true;
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
    const built: AutoBuilt = { homes: 0, shops: 0, industry: 0, parks: 0, services: 0, plants: 0 };

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
      // Nothing that adds to the payroll while the payroll is already more than
      // the city earns. The cash reserve below is a buffer and this is the rule
      // it cannot express: a city sitting on a treasury would clear the reserve
      // and go on buying coverage it has no income to staff, which is exactly
      // the brownout an away player comes back to. Housing, commerce and
      // industry stay on the table — they are how it earns its way out.
      const solvent = netIncome(s) >= 0;
      for (const service of SERVICES) {
        if (!solvent) break;
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
      // Power is a shortfall like any other and belongs in the same pool, and it
      // is the one an away city most needs: a brownout caps occupancy, and a
      // city left developing itself into one would come back emptier than it was
      // left with nothing on screen to say why. Ahead of the rest by price alone
      // — the pool is cheapest-first — which is the right order anyway, since a
      // service covering land nobody is living on buys nothing.
      if (powerRatio(s) < 1 && canBuildPlant(s)) {
        shortfalls.push({
          cost: plantCost(s),
          buy: () => {
            s.plantStaff = staffAfterBuild(s.plantStaff, s.plants);
            s.plants++;
            built.plants++;
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
      // The third floor, and the one upkeep added: spend out of what is left
      // *after* the wage bill is covered, not out of the treasury. Without it an
      // away city buys the coverage it cannot staff, and the player comes back
      // to full services with nobody in them. Zero for a solvent city, so this
      // is inert until the ledger turns — see `upkeepReserve`.
      if (best.cost > s.cash - upkeepReserve(s)) break;
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
      elapsed: this.inner.elapsed,
      cash: this.inner.cash,
      homes: this.inner.homes,
      shops: this.inner.shops,
      industry: this.inner.industry,
      parks: this.inner.parks,
      services: civicBuildings(this.inner),
      plants: this.inner.plants,
      spend: this.autoSpend,
      wages: this.wagesPaid,
      districts: this.inner.districts,
      surveyed: this.surveyed,
      started: this.firesStarted,
      extinguished: this.firesExtinguished,
      lost: this.firesLost,
      called: this.callsRaised,
      answered: this.callsAnswered,
      missed: this.callsMissed,
      abandoned: this.abandoned,
      recovered: this.recovered,
      merged: this.merged,
    };

    // The hard guard, for the length of this call and no longer. However many
    // fires resolve badly across a twelve-hour absence, the city comes back at
    // most one building smaller; the rest are put out instead and still counted.
    // Silent for the length of this call. See `recording` for why the away
    // sheet is the better place for an absence to be reported.
    this.recording = false;
    // Cleared rather than appended to: a timeline is a byproduct of *one*
    // catch-up call and dies with the sheet that showed it. Two absences in one
    // session are two reports.
    this.awayLog.clear();
    this.away = true;
    this.lossesLeft = CATCHUP_MAX_LOSSES;
    // The same guard for decay. However long the absence, the city comes back
    // at most CATCHUP_MAX_ABANDONED plots darker than it was left.
    this.abandonsLeft = CATCHUP_MAX_ABANDONED;
    this.annexesLeft = CATCHUP_MAX_ANNEXES;
    this.surveysLeft = CATCHUP_MAX_SURVEYS;

    // Fixed steps, not a fixed step count: coarse steps let auto-development
    // buy against a demand curve that has already jumped to its asymptote.
    const steps = Math.min(
      CATCHUP_MAX_STEPS,
      Math.max(1, Math.ceil(credited / CATCHUP_STEP_SECONDS)),
    );
    const dt = credited / steps;
    for (let i = 0; i < steps; i++) this.step(dt);
    this.recording = true;
    this.away = false;
    this.rearm();
    this.lossesLeft = Number.POSITIVE_INFINITY;
    this.abandonsLeft = Number.POSITIVE_INFINITY;
    this.annexesLeft = Number.POSITIVE_INFINITY;
    this.surveysLeft = Number.POSITIVE_INFINITY;

    const s = this.inner;
    return {
      seconds: credited,
      forfeited: wanted - credited,
      startedAt: before.elapsed,
      // A live view of the log's own array, in the order things happened. Not
      // saved, not read back, and gone the moment the next catch-up clears it —
      // exactly what every other event in this game is.
      timeline: this.awayLog.entries,
      dropped: this.awayLog.dropped,
      // What auto-development spent was earned first, so from the player's side
      // it is all collections. This is the actual outgoing, not a replay of the
      // cost curve — cost now depends on the demand at the moment of purchase.
      // Wages are the other outgoing and are added back for the same reason: the
      // city took the money in before it paid it out again.
      earned:
        s.cash -
        before.cash +
        (this.autoSpend - before.spend) +
        (this.wagesPaid - before.wages),
      spent: this.autoSpend - before.spend,
      wages: this.wagesPaid - before.wages,
      homes: s.homes - before.homes,
      shops: s.shops - before.shops,
      industry: s.industry - before.industry,
      parks: s.parks - before.parks,
      services: civicBuildings(s) - before.services,
      plants: s.plants - before.plants,
      firesStarted: this.firesStarted - before.started,
      firesExtinguished: this.firesExtinguished - before.extinguished,
      firesLost: this.firesLost - before.lost,
      callsRaised: this.callsRaised - before.called,
      callsAnswered: this.callsAnswered - before.answered,
      callsMissed: this.callsMissed - before.missed,
      abandoned: this.abandoned - before.abandoned,
      recovered: this.recovered - before.recovered,
      merges: this.merged - before.merged,
      districts: s.districts - before.districts,
      surveyed: this.surveyed - before.surveyed,
    };
  }
}
