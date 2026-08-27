/**
 * Things that happen, for the ticker to say.
 *
 * The city already does plenty the player never sees. A fire starts in a
 * district the camera is not looking at, twelve homes become apartments while
 * the Treasury tab is open, the housing button goes dead for a reason written
 * on a label nobody is reading. All of it is legible somewhere in the HUD and
 * none of it announces itself, so the game is quietly full of consequences you
 * only notice afterwards.
 *
 * Three rules make this cheap enough to be worth having:
 *
 *   - **the ticker reports the state you came back to, not the history you
 *     missed.** Emission is off for the length of a `catchUp` — a twelve-hour
 *     absence would flood a sixteen-entry buffer, and the "while you were away"
 *     sheet already lists every one of these categories with an exact count —
 *     and the edge-triggered watchers are re-armed afterwards, so anything still
 *     wrong when the player looks says so once. See `Game.rearm`;
 *   - **events are not state.** Nothing here reaches `GameState`, nothing is
 *     saved, and nothing is derived *from* an event. They are a byproduct of
 *     the simulation, emitted where the `AwayReport` counters are already
 *     bumped, and if the buffer were dropped on the floor the city would be
 *     identical. That is what keeps "the save is counts" true;
 *   - **the buffer is bounded.** A ring of EVENT_BUFFER, so a tab left running
 *     for a day holds the same sixteen entries a tab opened a minute ago does;
 *   - **runs coalesce.** A promotion wave is one line — "12 homes became
 *     apartments" — rather than twelve, because twelve lines is a buffer full
 *     of one fact.
 *
 * `core/` imports nothing, which is why `EventZone` is spelled out here rather
 * than taken from `ZoneKind`. The two are the same three strings and assign to
 * each other in both directions with no import; importing the simulation's type
 * would point the dependency the wrong way for the sake of three words.
 */

/** The three zones an event can be about. Structurally `ZoneKind`. */
export type EventZone = 'home' | 'shop' | 'industry';

/**
 * One thing that happened.
 *
 * A discriminated union rather than a bag of optional fields, so a consumer that
 * handles a kind has the data that kind carries and a kind added later cannot be
 * silently ignored. `at` is simulated seconds — `GameState.elapsed` — because
 * that is the only clock the simulation has and the only one that survives a
 * catch-up step being a minute long.
 */
export type GameEvent =
  | { readonly kind: 'fire-started'; readonly at: number; readonly zone: EventZone; readonly count: number }
  | { readonly kind: 'fire-out'; readonly at: number; readonly zone: EventZone; readonly count: number }
  | { readonly kind: 'fire-lost'; readonly at: number; readonly zone: EventZone; readonly count: number }
  /**
   * The housing button is dead for a reason, and the player has the money.
   *
   * The cash test is the whole point of the event. "You cannot afford it" is
   * already on the button next to a price; "residents are leaving" is a state
   * the player can act on and has no other way to be told about.
   */
  | { readonly kind: 'blocked'; readonly at: number; readonly reason: string; readonly count: number }
  /**
   * A cohort climbed a rung.
   *
   * Merging is one of these rather than a kind of its own, and the count is the
   * buildings that *result*: climbing to MERGE_LEVEL takes two buildings off one
   * parcel and puts one back, so "13 shops became retail park" is what happened
   * and "26 shops merged" is the same fact told in the units of the rung below.
   * One category fewer, and the ladder reads the same way at every rung.
   */
  | {
      readonly kind: 'level-up';
      readonly at: number;
      readonly zone: EventZone;
      /** The level climbed *to*. The HUD names it. */
      readonly level: number;
      readonly count: number;
    }
  | { readonly kind: 'abandoned'; readonly at: number; readonly zone: EventZone; readonly count: number }
  | { readonly kind: 'recovered'; readonly at: number; readonly zone: EventZone; readonly count: number }
  | { readonly kind: 'annexed'; readonly at: number; readonly districts: number; readonly count: number }
  /**
   * The surveyor zoned more land to a type the city was short of.
   *
   * The one event that reports a change to the *map* rather than to what is
   * standing on it, and the reason it is worth a line: a player who watches
   * commercial land appear where scrub was and is told nothing has to work out
   * from a price chip that the city rezoned itself. `plots` is what the zone
   * holds afterwards, because "commercial land now 31 plots" is a fact the
   * player can act on where "one parcel surveyed" is trivia.
   */
  | {
      readonly kind: 'surveyed';
      readonly at: number;
      readonly zone: EventZone;
      readonly plots: number;
      readonly count: number;
    }
  /**
   * A service that was covering the whole city no longer is.
   *
   * Emitted on the crossing rather than on the level, because the level is
   * already a row in the services panel and the crossing is the moment it
   * stopped being true. `service` is a `ServiceKey`; the HUD looks up the name,
   * for the same reason the zone is a key rather than a label.
   */
  /**
   * The grid stopped covering the load.
   *
   * Edge-triggered like `coverage` and for the same reason — it is a condition
   * that becomes true and stays true — and it is the one event in this list a
   * player cannot work out from anywhere else on screen without opening a tab.
   * `cap` is what the shortfall is costing, in the units they watch: how full
   * the city is allowed to get.
   */
  | {
      readonly kind: 'brownout';
      readonly at: number;
      readonly ratio: number;
      readonly cap: number;
      readonly count: number;
    }
  | {
      readonly kind: 'coverage';
      readonly at: number;
      readonly service: string;
      readonly coverage: number;
      readonly count: number;
    };

export type GameEventKind = GameEvent['kind'];

/**
 * Entries the buffer holds at once.
 *
 * Sixteen, and the bound is on the *simulation's* side of the handover rather
 * than on the screen's. A frame is a tenth of a second of ticks at most, and
 * nothing in the game can produce sixteen distinct events in a tenth of a
 * second once runs coalesce — MAX_ACTIVE_FIRES is six and there are three zones
 * — so in practice this never truncates. What it is for is the case where the
 * host stops draining: a backgrounded tab, a paused debugger, a frame loop that
 * threw. Without it that is an array that grows until the tab dies.
 */
export const EVENT_BUFFER = 16;

/**
 * Seconds within which two of the same thing are one thing.
 *
 * A promotion wave promotes a cohort over LEVEL_UP_SECONDS, so a district of 24
 * homes climbs at about one building every twelve seconds and a large city far
 * faster. Thirty seconds is comfortably longer than the gap inside a wave and
 * comfortably shorter than the wave itself, so a run merges into one line and
 * two separate waves stay two lines.
 *
 * Measured against the gap rather than the wave on purpose: coalescing "since
 * the last one" rather than "since the first" means a steady run merges however
 * long it lasts, and a run that stops and restarts reads as two things — which
 * is what it is.
 */
export const EVENT_COALESCE_SECONDS = 30;

/**
 * How far a coverage has to fall before the ticker says it has.
 *
 * A deadband, and it is here rather than in config.ts because it is a rule about
 * when to *say* something rather than about what the city does — nothing in the
 * simulation reads it.
 *
 * Coverage crosses 1 constantly in a growing city: a house goes up, the share
 * dips, a hospital opens, it recovers. Measured on an hour of auto-development,
 * a bare `>= 1` test announced the hospital three separate times at 0.90, 0.99
 * and 0.96 — and 0.99 is not news. Announcing only past 0.95, and re-arming only
 * at a full 1, is the same Schmitt trigger the trend arrows use a deadband for:
 * the line is worth reading because it is not printed every time the number
 * wobbles.
 */
export const EVENT_COVERAGE_LOST = 0.95;

/**
 * Whether two events are the same thing happening again.
 *
 * Everything but `at` and `count`, which are exactly the two fields a merge
 * writes. Written as a switch rather than a shallow compare so that a kind added
 * later has to say what makes it distinct instead of defaulting to "any two are
 * the same".
 */
function sameSubject(a: GameEvent, b: GameEvent): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'fire-started':
    case 'fire-out':
    case 'fire-lost':
    case 'abandoned':
    case 'recovered':
    // Two surveys into the same zone are the same subject, so a frontier that
    // rezones twice in a wave says so once with a count and the *latest* plot
    // total rather than twice with two.
    case 'surveyed':
      return a.zone === (b as typeof a).zone;
    case 'level-up':
      return a.zone === (b as typeof a).zone && a.level === (b as typeof a).level;
    case 'blocked':
      return a.reason === (b as typeof a).reason;
    case 'coverage':
      return a.service === (b as typeof a).service;
    case 'brownout':
      // One shortfall is one shortfall however deep it gets. The line is
      // re-armed by the grid catching up, not by a second push.
      return true;
    case 'annexed':
      // Never. Each district is its own milestone, and "2 districts annexed"
      // would be the one line a player most wants two of.
      return false;
  }
}

/**
 * A bounded ring of things that happened, coalescing runs as they arrive.
 *
 * Two of these, and the second is not an oversight. The simulation owns one and
 * the HUD owns another, because coalescing has to happen on *both* sides of the
 * handover: the HUD drains every frame, so by the time the second building of a
 * wave climbs the first has already been taken and there is nothing left in the
 * simulation's log to merge it into. Measured, a single log coalesced nothing at
 * all — twenty minutes of a levelling city produced 47 lines each saying one
 * building had climbed.
 *
 * So `Game` pushes into one and drains it, and the HUD pushes what it drained
 * into its own and never drains that. One class, one merge rule, one bound.
 * `drain` is what the simulation's is for; `entries` and `expire` are what the
 * HUD's is for; neither instance uses both halves, and that is fine — the
 * alternative is two classes that have to agree about what "the same thing
 * happening again" means.
 */
export class EventLog {
  private items: GameEvent[] = [];
  /** Lifetime count, so a test can tell "nothing emitted" from "nothing kept". */
  private emitted = 0;
  /**
   * Written out rather than declared as a constructor parameter property.
   *
   * The tools run these modules straight through Node's type-stripping loader,
   * which erases annotations and refuses anything that *emits* — and a parameter
   * property is a field declaration hiding in a signature. Nothing in `sim/` or
   * `core/` may use one, or `npm run economy:calibrate` stops at the import.
   */
  private readonly limit: number;

  constructor(limit = EVENT_BUFFER) {
    this.limit = limit;
  }

  /**
   * Records one event, merging it into the tail if it is the same thing again.
   *
   * Merging keeps the *latest* time rather than the first, so an ongoing wave
   * stays fresh on screen and a finished one ages out. The count is what
   * accumulates, which is what makes the line read as "12 homes became
   * apartments" rather than as twelve lines saying "a home did".
   */
  push(event: GameEvent): void {
    this.emitted++;
    // Backwards over the whole buffer rather than at the tail alone, which is
    // the difference between coalescing and not. Three zones promote at once
    // and their waves interleave — measured, a tail-only merge produced 47
    // separate "one building climbed" lines in twenty minutes because no two
    // consecutive events were ever the same zone. Sixteen entries is a short
    // enough walk to do on every push.
    for (let i = this.items.length - 1; i >= 0; i--) {
      const held = this.items[i] as GameEvent;
      if (!sameSubject(held, event)) continue;
      if (event.at - held.at > EVENT_COALESCE_SECONDS) break;
      // Merged in place, so the line keeps its position and its count ticks up
      // rather than the entry jumping to the bottom of the ticker each time.
      this.items[i] = {
        ...held,
        at: Math.max(held.at, event.at),
        count: held.count + event.count,
      } as GameEvent;
      return;
    }
    this.items.push(event);
    // Oldest first out. A shift on an array of sixteen is cheaper than the ring
    // arithmetic that would avoid it, and this runs at most once per push.
    if (this.items.length > this.limit) this.items.shift();
  }

  /**
   * Everything held, in the order it happened. For the side that displays.
   *
   * A live view rather than a copy: the HUD reads this every paint and a fresh
   * array ten times a second is garbage for nothing. Nobody outside writes to
   * it — the type says so, and the class is the only thing that can.
   */
  get entries(): readonly GameEvent[] {
    return this.items;
  }

  /**
   * Drops everything that happened before `at`.
   *
   * The display side's other half. A ticker that never forgot would be a log,
   * and a log is a different feature — what this is for is telling the player
   * what just happened.
   */
  expire(at: number): void {
    let write = 0;
    for (const item of this.items) {
      if (item.at >= at) this.items[write++] = item;
    }
    this.items.length = write;
  }

  /** Everything waiting, handed over and cleared. */
  drain(): GameEvent[] {
    if (this.items.length === 0) return [];
    const taken = this.items;
    this.items = [];
    return taken;
  }

  /** How many are waiting. */
  get size(): number {
    return this.items.length;
  }

  /** How many pushes this log has ever seen, merges included. */
  get total(): number {
    return this.emitted;
  }

  clear(): void {
    this.items = [];
    this.emitted = 0;
  }
}
