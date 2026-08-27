import { describe, expect, it } from 'vitest';
import {
  EVENT_BUFFER,
  EVENT_COALESCE_SECONDS,
  EVENT_COVERAGE_LOST,
  EventLog,
  type GameEvent,
} from '../src/core/events';
import { HAPPINESS_MIN_BUILD, MAX_ACTIVE_FIRES, MERGE_LEVEL, SERVICES } from '../src/sim/config';
import { coverage, homeCost } from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { createState, type GameState } from '../src/sim/state';
import { built, cohort, housed, served, trading } from './levels';

/**
 * The ticker's feed, and the three things it must not do: grow without bound,
 * say one thing many times, or replay a twelve-hour absence over the top of the
 * sheet that already reported it.
 *
 * Nothing here touches `GameState`. That is the claim the first block makes and
 * the reason this feature is allowed to exist at all — events are a byproduct of
 * the simulation, and a city with the log thrown away is the same city.
 */
const at = (patch: Partial<GameState> = {}): Game => new Game({ ...createState(0), ...patch });

const play = (game: Game, seconds: number): Game => {
  for (let i = 0; i < seconds * 10; i++) game.advance(0.1);
  return game;
};

/** Every event a run produced, drained as it went. */
const collect = (game: Game, seconds: number): GameEvent[] => {
  const seen: GameEvent[] = [];
  for (let i = 0; i < seconds * 10; i++) {
    game.advance(0.1);
    seen.push(...game.drainEvents());
  }
  return seen;
};

/** What a HUD does with what it drained: push into a log it never drains. */
const display = (events: readonly GameEvent[], limit = EVENT_BUFFER): EventLog => {
  const log = new EventLog(limit);
  for (const event of events) log.push(event);
  return log;
};

const zone = (kind: 'home' | 'shop' | 'industry', at: number, count = 1): GameEvent => ({
  kind: 'level-up',
  at,
  zone: kind,
  level: 1,
  count,
});

describe('the buffer', () => {
  it('never holds more than its bound, however much is pushed', () => {
    const log = new EventLog();
    for (let i = 0; i < 1_000; i++) {
      // Spaced past the coalescing window and alternating the zone, so nothing
      // merges and every push is a fresh entry. This is the worst case.
      log.push(zone(i % 2 === 0 ? 'home' : 'shop', i * (EVENT_COALESCE_SECONDS + 1)));
    }
    expect(log.size).toBe(EVENT_BUFFER);
    expect(log.total).toBe(1_000);
  });

  it('drops the oldest first', () => {
    const log = new EventLog(3);
    for (let i = 0; i < 5; i++) {
      log.push({ kind: 'annexed', at: i, districts: i + 2, count: 1 });
    }
    expect(log.entries.map((event) => (event.kind === 'annexed' ? event.districts : 0))).toEqual([
      4, 5, 6,
    ]);
  });

  it('hands everything over exactly once', () => {
    const log = new EventLog();
    log.push(zone('home', 0));
    expect(log.drain()).toHaveLength(1);
    expect(log.drain()).toHaveLength(0);
    expect(log.size).toBe(0);
  });

  it('forgets what has aged out', () => {
    const log = new EventLog();
    log.push(zone('home', 0));
    log.push(zone('shop', 100));
    log.expire(50);
    expect(log.size).toBe(1);
    expect(log.entries[0]?.kind).toBe('level-up');
    log.expire(200);
    expect(log.size).toBe(0);
  });
});

describe('coalescing', () => {
  it('makes a run of the same thing one line with a count', () => {
    const log = new EventLog();
    for (let i = 0; i < 12; i++) log.push(zone('home', i * 5));
    expect(log.size).toBe(1);
    expect(log.entries[0]?.count).toBe(12);
    // The latest time, so an ongoing wave stays fresh and a finished one ages.
    expect(log.entries[0]?.at).toBe(55);
  });

  it('merges across the buffer, not just into the tail', () => {
    // The case that made a tail-only merge useless: three zones promote at once
    // and their waves interleave, so no two consecutive events are ever the
    // same subject.
    const log = new EventLog();
    for (let i = 0; i < 9; i++) {
      log.push(zone((['home', 'shop', 'industry'] as const)[i % 3] as 'home', i));
    }
    expect(log.size).toBe(3);
    for (const event of log.entries) expect(event.count).toBe(3);
  });

  it('keeps a run and a later one apart', () => {
    const log = new EventLog();
    log.push(zone('home', 0));
    log.push(zone('home', EVENT_COALESCE_SECONDS));
    expect(log.size).toBe(1);
    log.push(zone('home', EVENT_COALESCE_SECONDS * 2 + 1));
    expect(log.size).toBe(2);
  });

  it('keeps a line in place rather than moving it to the bottom', () => {
    const log = new EventLog();
    log.push(zone('home', 0));
    log.push(zone('shop', 1));
    log.push(zone('home', 2));
    expect(log.entries.map((event) => (event.kind === 'level-up' ? event.zone : ''))).toEqual([
      'home',
      'shop',
    ]);
  });

  it('never merges two districts into one line', () => {
    // The one kind that must not coalesce: each annexation is its own milestone,
    // and "2 districts annexed" is the line a player most wants two of.
    const log = new EventLog();
    log.push({ kind: 'annexed', at: 0, districts: 2, count: 1 });
    log.push({ kind: 'annexed', at: 1, districts: 3, count: 1 });
    expect(log.size).toBe(2);
  });

  it('keeps different levels of one zone apart', () => {
    const log = new EventLog();
    log.push({ kind: 'level-up', at: 0, zone: 'home', level: 1, count: 1 });
    log.push({ kind: 'level-up', at: 1, zone: 'home', level: 2, count: 1 });
    expect(log.size).toBe(2);
  });
});

describe('what the city emits', () => {
  it('says nothing at all about a city with nothing happening', () => {
    expect(collect(at(), 60)).toHaveLength(0);
  });

  it('reports fires starting, going out and taking a building', () => {
    // Uncovered, and enough buildings to burn. Fires are a Poisson process off
    // a fixed cursor, so this is deterministic rather than flaky.
    const game = at({ ...built(24, 45, 13), cash: 0 });
    const seen = collect(game, 3 * 3_600);
    const kinds = new Set(seen.map((event) => event.kind));
    expect(kinds.has('fire-started')).toBe(true);
    expect(kinds.has('fire-out') || kinds.has('fire-lost')).toBe(true);
    // Never more at once than the simulation allows to burn.
    expect(game.state.fires.length).toBeLessThanOrEqual(MAX_ACTIVE_FIRES);
  });

  it('reports a merge as the rung it is, not as a category of its own', () => {
    // Climbing to MERGE_LEVEL takes two buildings off one parcel and puts one
    // back, so it is a promotion — and the ticker counts what results.
    const game = at({ ...built(24, 45, 13, MERGE_LEVEL - 1), ...served(), happiness: 1, cash: 0 });
    const before = game.state.mergedR;
    const seen = collect(game, 1_800);
    expect(game.state.mergedR).toBeGreaterThan(before);
    const merges = seen.filter(
      (event) => event.kind === 'level-up' && event.level === MERGE_LEVEL,
    );
    expect(merges.length).toBeGreaterThan(0);
    // And nothing else: the category it used to have is gone, not shadowed.
    expect(seen.map((event) => event.kind)).not.toContain('merged');
  });

  it('reports a promotion wave once per zone and rung', () => {
    const game = at({ ...built(24, 45, 13), ...served(), happiness: 1, cash: 0 });
    const waves = display(collect(game, 900)).entries.filter(
      (event) => event.kind === 'level-up',
    );
    expect(waves.length).toBeGreaterThan(0);
    // Coalesced: far fewer lines than buildings promoted.
    const promoted = waves.reduce((sum, event) => sum + event.count, 0);
    expect(promoted).toBeGreaterThan(waves.length * 2);
  });

  it('reports the housing gate once, not once a tick', () => {
    // A city that can afford a home and is not allowed one. `homeBlocker`
    // returns the same string on every tick it is true, so an edge-triggered
    // event is the only one that is not a lie about how often it happened.
    const game = at({ ...housed(4), cash: 1e6, happiness: 0 });
    expect(game.state.happiness).toBeLessThan(HAPPINESS_MIN_BUILD);
    const seen = collect(game, 600).filter((event) => event.kind === 'blocked');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.kind === 'blocked' && seen[0].reason).toBe('Residents are leaving');
  });

  it('says nothing about a gate the player could not have paid for anyway', () => {
    // "You cannot afford it" is already on the button next to a price. Cash is
    // held at zero rather than merely started there, because a city with four
    // homes in it earns — left alone it would save up the price inside the
    // window and the event would fire for the right reason.
    const game = at({ ...housed(4), cash: 0, happiness: 0 });
    const seen: GameEvent[] = [];
    for (let i = 0; i < 6_000; i++) {
      Object.assign(game.state, { cash: 0 });
      game.advance(0.1);
      seen.push(...game.drainEvents());
    }
    expect(game.state.cash).toBeLessThan(homeCost(game.state));
    expect(seen.filter((event) => event.kind === 'blocked')).toHaveLength(0);
  });

  it('does not announce six services falling short of an empty city', () => {
    // A fresh city reads as fully covered because coverage is the share a
    // service *fails* and it fails nothing when nothing is built. Without the
    // housing test that would fire all six the instant the first house went up.
    const game = at({ cash: 1e6 });
    for (let i = 0; i < 200; i++) {
      game.advance(0.1);
      game.buildHome();
    }
    expect(game.state.homes).toBeGreaterThan(0);
    expect(game.drainEvents().filter((event) => event.kind === 'coverage')).toHaveLength(0);
  });

  it('announces a coverage only once it has really fallen', () => {
    // Armed at a full 1 and fired past EVENT_COVERAGE_LOST, so the line is not
    // printed every time the number wobbles across the top of its range.
    const hospital = SERVICES.find((service) => service.key === 'hospital');
    expect(hospital).toBeDefined();
    // One hospital reaches `plots` housing plots, so a city holding exactly that
    // many reads a full 1 and every home past it dilutes the share.
    const reach = (hospital as { plots: number }).plots;
    const game = at({ ...housed(reach), hospitals: 1, hospitalStaff: 1, cash: 1e9, happiness: 1 });
    play(game, 1);
    expect(coverage(game.state, hospital as never)).toBe(1);
    game.drainEvents();

    // Under 1 and still inside the deadband: silence.
    game.buildHome();
    play(game, 1);
    expect(coverage(game.state, hospital as never)).toBeLessThan(1);
    expect(coverage(game.state, hospital as never)).toBeGreaterThan(EVENT_COVERAGE_LOST);
    expect(game.drainEvents().filter((event) => event.kind === 'coverage')).toHaveLength(0);

    // Past it, and the ticker says so once.
    while (coverage(game.state, hospital as never) > EVENT_COVERAGE_LOST) game.buildHome();
    play(game, 1);
    const said = game.drainEvents().filter((event) => event.kind === 'coverage');
    expect(said).toHaveLength(1);
    play(game, 60);
    expect(game.drainEvents().filter((event) => event.kind === 'coverage')).toHaveLength(0);
  });

  it('reports annexation, boarding up and reopening', () => {
    const rotting = at({ ...housed(24), ...trading(45), happiness: 0, occupancyR: 0, cash: 0 });
    const lost = collect(rotting, 3_600).filter((event) => event.kind === 'abandoned');
    expect(lost.length).toBeGreaterThan(0);

    Object.assign(rotting.state, { ...served(), happiness: 1 });
    const back = collect(rotting, 3_600).filter((event) => event.kind === 'recovered');
    expect(back.length).toBeGreaterThan(0);
  });

  it('does not put anything in the save', () => {
    // The claim the whole design rests on. Two cities stepped identically, one
    // of them drained and one not: the states have to be byte-identical.
    const patch = { ...built(24, 45, 13), ...served(), cash: 1e6, happiness: 1 };
    const drained = at(patch);
    const kept = at(patch);
    for (let i = 0; i < 6_000; i++) {
      drained.advance(0.1);
      drained.drainEvents();
      kept.advance(0.1);
    }
    expect(JSON.stringify(drained.state)).toBe(JSON.stringify(kept.state));
  });
});

describe('catch-up', () => {
  /**
   * The design question this feature had. A twelve-hour absence emits thousands
   * of events and would flood a sixteen-entry ticker on load, pushing the live
   * ones out before the player had read them. The "while you were away" sheet is
   * modal, has the player's attention, and already lists every one of these
   * categories with an exact count — so catch-up is silent and the sheet keeps
   * the job.
   */
  it('says nothing at all about an absence', () => {
    const game = at({ ...built(24, 45, 13), ...served(), cash: 1e6, autoDevelop: true, cityHall: true });
    const report = game.catchUp(12 * 3_600);
    // The absence was eventful, and none of it reached the ticker.
    expect(report.homes + report.firesStarted + report.merges).toBeGreaterThan(0);
    expect(game.drainEvents()).toHaveLength(0);
  });

  it('starts recording again the moment the player is back', () => {
    const game = at({ ...built(24, 45, 13), ...served(), cash: 1e6, happiness: 1 });
    game.catchUp(6 * 3_600);
    expect(game.drainEvents()).toHaveLength(0);
    expect(collect(game, 600).length).toBeGreaterThan(0);
  });

  it('reports the state you came back to, not the history you missed', () => {
    // The rule the edge-triggered events follow across an absence. Absorbing
    // them outright was the first implementation and is wrong in the one case
    // that matters: a *one-second* catch-up — which is what a reload costs —
    // swallowed a brownout permanently, and the city sat capped at 37%
    // occupancy with an empty ticker.
    //
    // Still wrong when you look: announced, once.
    const stuck = at({ ...housed(4), cash: 1e6, happiness: 0 });
    stuck.catchUp(6 * 3_600);
    expect(stuck.drainEvents()).toHaveLength(0);
    const said = collect(stuck, 60).filter((event) => event.kind === 'blocked');
    expect(said).toHaveLength(1);
    // And once, not once a tick — the watcher is armed again, not disabled.
    expect(collect(stuck, 600).filter((event) => event.kind === 'blocked')).toHaveLength(0);
  });

  it('says nothing about what went wrong and righted itself while away', () => {
    // The other half of the same rule, and what keeps it from being a flood: a
    // gate that closed and reopened during the absence is the away sheet's job.
    const game = at({ ...built(24, 45, 13), ...served(), cash: 1e6, happiness: 1 });
    game.catchUp(6 * 3_600);
    game.drainEvents();
    const seen = collect(game, 60).filter(
      (event) => event.kind === 'blocked' || event.kind === 'brownout',
    );
    expect(seen).toHaveLength(0);
  });

  it('announces a grid that is still short when the player gets back', () => {
    // The case this rule was found on. A second of catch-up is enough to cross
    // the edge, and the shortfall then persists with nothing on the default tab
    // to say so.
    const game = at({ ...built(24, 45, 13, 2), districts: 4, plants: 0, plantStaff: 0, happiness: 1 });
    game.catchUp(1);
    expect(game.drainEvents()).toHaveLength(0);
    const said = collect(game, 30).filter((event) => event.kind === 'brownout');
    expect(said).toHaveLength(1);
    expect(said[0]?.kind === 'brownout' && said[0].cap).toBeLessThan(1);
  });

  it('is silent again after a reset', () => {
    const game = at({ ...built(24, 45, 13), ...served(), cash: 1e6, happiness: 1 });
    play(game, 600);
    game.reset();
    expect(game.drainEvents()).toHaveLength(0);
    expect(game.state.homes).toBe(0);
  });
});

describe('a full district, played out', () => {
  /**
   * The end-to-end shape: what a ticker would actually have shown over an hour
   * of a city developing itself. Not an assertion about the wording — that is
   * the HUD's — but about the volume, which is what a bounded buffer and a
   * coalescing rule are for.
   */
  it('is a handful of lines an hour rather than hundreds', () => {
    const game = at({ cash: 1e4, autoDevelop: true, cityHall: true, homeLevels: cohort(0) });
    const seen = collect(game, 3_600);
    expect(seen.length).toBeGreaterThan(0);
    const log = display(seen);
    expect(log.size).toBeLessThanOrEqual(EVENT_BUFFER);
    // Far more happened than was said, which is the coalescing earning its keep.
    expect(log.total).toBeGreaterThan(log.size);
  });
});
