import { describe, expect, it } from 'vitest';
import { applyCommand, type Command } from '../src/sim/commands';
import { LANDMARKS, POWER_TRADES, SERVICES, TAX_STEPS, TERMINALS } from '../src/sim/config';
import { Game, type AwayReport } from '../src/sim/game';
import { LocalGame } from '../src/sim/local';
import { createState, type GameState } from '../src/sim/state';
import { atRank, housed, making, served, trading, zoning } from './levels';
import { RANK_GATES } from '../src/sim/config';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/**
 * A city with money, land and room left in every capacity.
 *
 * Lightly built on purpose: `served()` fills a district's civic sites and a
 * park capacity, and this has to be a city where a purchase that is refused is
 * refused *for its own reasons* rather than because there is nowhere left to
 * put it.
 */
const rich = (patch: Partial<GameState> = {}): GameState =>
  state({
    ...zoning(20),
    // At the rank the highway needs, because half the purchases below are
    // rank-gated and a fixture a rung under where its author thought it was
    // fails as a refused command in a test about message shapes.
    ...atRank(RANK_GATES.highway + 1, 20),
    ...trading(160),
    ...making(40),
    // Deep enough that nothing below is refused for want of money, and it takes
    // a great deal: a Metropolis-rank city has 167 towers and the next house
    // costs 8.1e19, because HOME_GROWTH compounds and this fixture is standing
    // most of the way up the ladder to clear the rank gates. What is being
    // tested is which *messages* land; the price curve is a different test.
    cash: 1e24,
    happiness: 0.9,
    occupancyR: 1,
    cityHall: true,
    ...patch,
  });

describe('a command is the whole of what the player can ask for', () => {
  it('names every purchase the panel has a button for', () => {
    // The check that stops a button being added and the command for it being
    // forgotten — which on the worker path would be a button that did nothing
    // at all rather than a compile error.
    const game = new Game(rich());
    const before = { ...game.state };
    const built: Command[] = [
      { kind: 'home' },
      { kind: 'shop' },
      { kind: 'industry' },
      { kind: 'park' },
      { kind: 'plant' },
    ];
    for (const command of built) {
      expect(applyCommand(game, command), command.kind).toBe(true);
    }
    expect(game.state.homes).toBe(before.homes + 1);
    expect(game.state.shops).toBe(before.shops + 1);
    expect(game.state.industry).toBe(before.industry + 1);
    expect(game.state.parks).toBe(before.parks + 1);
    expect(game.state.plants).toBe(before.plants + 1);
    // And the hall, which a city that already has one refuses — so it is asked
    // of one that does not.
    const bare = new Game(rich({ cityHall: false }));
    expect(applyCommand(bare, { kind: 'cityHall' })).toBe(true);
    expect(bare.state.cityHall).toBe(true);
  });

  it('annexes when the city has earned it, and refuses when it has not', () => {
    // The gate is the simulation's, not the boundary's: a city with land it has
    // not developed is refused here exactly as it is refused by the button.
    const early = new Game(state({ ...zoning(20), ...housed(24), cash: 1e12 }));
    expect(applyCommand(early, { kind: 'annex' })).toBe(false);
    const ready = new Game(
      state({ ...zoning(3), ...housed(72), ...trading(135), ...making(39), cash: 1e12 }),
    );
    expect(applyCommand(ready, { kind: 'annex' })).toBe(true);
    expect(ready.state.districts).toBe(4);
  });

  it('resolves a table row from its key rather than carrying the row', () => {
    // The one thing this layer exists to get right. A `Landmark` and a
    // `Service` are frozen rows out of `config.ts`; structured-clone would copy
    // one across the boundary and the copy would fail every `===` the
    // simulation makes against the table. So a command names a key.
    const game = new Game(rich());
    for (const landmark of LANDMARKS) {
      expect(applyCommand(game, { kind: 'landmark', key: landmark.key })).toBe(true);
    }
    expect(game.state.museums).toBe(1);
    expect(game.state.stadiums).toBe(1);
    for (const service of SERVICES) {
      expect(applyCommand(game, { kind: 'service', key: service.key }), service.key).toBe(true);
    }
    expect(game.state.hospitals).toBe(1);
    expect(game.state.police).toBe(1);
    expect(game.state.depots).toBe(1);
    expect(game.state.universities).toBe(1);
  });

  it('refuses a key no table has, rather than throwing across the boundary', () => {
    // A message can arrive from anywhere — a stale tab, a replayed queue, a
    // build that has moved on. A command naming a landmark this build does not
    // have has to be a no-op, not an exception on the simulation thread.
    const game = new Game(rich());
    const before = game.state.museums;
    expect(
      applyCommand(game, { kind: 'landmark', key: 'observatory' as never }),
    ).toBe(false);
    expect(applyCommand(game, { kind: 'terminal', key: 'ferry' as never })).toBe(false);
    expect(applyCommand(game, { kind: 'service', key: 'library' as never })).toBe(false);
    expect(game.state.museums).toBe(before);
  });

  it('carries every policy switch, and each one still refuses without a hall', () => {
    const game = new Game(rich({ cityHall: false }));
    for (const command of [
      { kind: 'autoDevelop', on: true },
      { kind: 'freeTransport', on: true },
      { kind: 'goodsTrade', on: true },
    ] as const) {
      applyCommand(game, command);
    }
    // The simulation decides, exactly as it did before there was a boundary:
    // `setAutoDevelop` and friends refuse without a hall and this changes
    // nothing about that.
    expect(game.state.autoDevelop).toBe(false);
    expect(game.state.freeTransport).toBe(false);
    expect(game.state.goodsTrade).toBe(false);

    const withHall = new Game(rich());
    for (const command of [
      { kind: 'autoDevelop', on: true },
      { kind: 'freeTransport', on: true },
      { kind: 'goodsTrade', on: true },
      { kind: 'taxRate', step: TAX_STEPS.length - 1 },
      { kind: 'powerTrade', step: POWER_TRADES.length - 1 },
    ] as const) {
      applyCommand(withHall, command);
    }
    expect(withHall.state.autoDevelop).toBe(true);
    expect(withHall.state.freeTransport).toBe(true);
    expect(withHall.state.goodsTrade).toBe(true);
    expect(withHall.state.taxRate).toBe(TAX_STEPS.length - 1);
    expect(withHall.state.powerTrade).toBe(POWER_TRADES.length - 1);
  });

  it('carries the one thing the main thread tells the simulation', () => {
    // `markSaved` runs the other way from everything else: the main thread owns
    // persistence now, so it writes the file and then tells the simulation what
    // timestamp it used. Without this, `secondsAway` would measure from
    // whenever the state happened to have been created.
    const game = new Game(state());
    applyCommand(game, { kind: 'markSaved', at: 1_700_000_000_000 });
    expect(game.state.savedAt).toBe(1_700_000_000_000);
  });

  it('throws the city away, and founds it again', () => {
    const game = new Game(rich());
    expect(game.state.homes).toBeGreaterThan(0);
    applyCommand(game, { kind: 'reset' });
    expect(game.state.homes).toBe(0);
    expect(game.state.districts).toBe(1);

    const foundable = new Game(
      state({ ...atRank(RANK_GATES.ascend, 6), ...trading(40), ...served(), cash: 5_000 }),
    );
    expect(applyCommand(foundable, { kind: 'ascend' })).toBe(true);
    expect(foundable.state.foundings).toBe(2);
  });

  it('reaches every purchase past the highway, in the order the city unlocks them', () => {
    const game = new Game(
      rich({ ...zoning(30), ...atRank(RANK_GATES.highway + 1, 30) }),
    );
    expect(applyCommand(game, { kind: 'highway' })).toBe(true);
    expect(game.state.highway).toBe(true);
    expect(applyCommand(game, { kind: 'estate' })).toBe(true);
    expect(game.state.estates).toBe(1);
    expect(applyCommand(game, { kind: 'airport' })).toBe(true);
    expect(game.state.airport).toBe(true);
    for (const terminal of TERMINALS) {
      applyCommand(game, { kind: 'terminal', key: terminal.key });
    }
    expect(game.state.cruiseTerminals + game.state.cargoTerminals).toBeGreaterThan(0);
  });
});

describe('the simulation in this thread', () => {
  it('is the same game, behind the shape the boundary needs', () => {
    // The fallback is not a second simulation. It holds the `Game` the game has
    // always used and adds only the shape: commands arrive as data and the away
    // report is announced rather than returned.
    const inner = new Game(rich());
    const local = new LocalGame(inner);
    expect(local.state).toBe(inner.state);
    local.send({ kind: 'home' });
    expect(local.state.homes).toBe(inner.state.homes);
  });

  it('announces every state change, so the frame loop knows to sync', () => {
    const local = new LocalGame(new Game(rich()));
    let moved = 0;
    local.onState = () => void moved++;
    local.advance(0.2);
    local.send({ kind: 'park' });
    expect(moved).toBe(2);
  });

  it('announces an absence rather than returning it', () => {
    // The one method whose shape had to move: `catchUp` returned an
    // `AwayReport` and cannot across a thread boundary. Locally it is announced
    // synchronously, so the two paths differ in latency and in nothing else —
    // which is what lets `main.ts` do its persist inside the handler and have
    // the ordering hold either way.
    const local = new LocalGame(new Game(rich()));
    const seen: AwayReport[] = [];
    local.onAway = (report) => void seen.push(report);
    local.catchUp(3_600);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.seconds).toBe(3_600);
    expect(seen[0]?.timeline.length).toBeGreaterThan(0);
  });

  it('drains events exactly once, as the game always did', () => {
    const local = new LocalGame(new Game(rich({ cash: 1e12 })));
    local.send({ kind: 'home' });
    for (let i = 0; i < 40; i++) local.advance(0.1);
    const first = local.drainEvents();
    expect(first.length).toBeGreaterThan(0);
    expect(local.drainEvents()).toHaveLength(0);
  });

  it('needs no worker, no DOM and no timer of its own', () => {
    // The acceptance criterion for the whole change, stated as a test rather
    // than as a comment: this file runs under `environment: 'node'` with
    // nothing shimmed, which is only possible because the boundary is where it
    // is. tools/worker.test.mjs asserts the other half — that nothing under
    // test/ reaches for a worker at all.
    expect(typeof (globalThis as { Worker?: unknown }).Worker).toBe('undefined');
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
    const local = new LocalGame(new Game(state({ ...housed(24) })));
    for (let i = 0; i < 100; i++) local.advance(0.1);
    expect(local.state.elapsed).toBeCloseTo(10, 5);
  });
});

describe('what a catch-up produces is what watching would have', () => {
  it('credits an absence identically whichever side of the boundary runs it', () => {
    // `catchUp` is exactly what the worker is for — a twelve-hour absence is a
    // long loop and it has no business on the thread that draws. What must not
    // change is the answer, so this runs the same absence through a bare `Game`
    // and through the boundary and compares the city that comes out.
    const bare = new Game(rich({ autoDevelop: true }));
    const behind = new LocalGame(new Game(rich({ autoDevelop: true })));
    const direct = bare.catchUp(6 * 3_600);
    let relayed: AwayReport | null = null;
    behind.onAway = (report) => void (relayed = report);
    behind.catchUp(6 * 3_600);
    expect(relayed).not.toBeNull();
    const report = relayed as unknown as AwayReport;
    expect(report.seconds).toBe(direct.seconds);
    expect(report.forfeited).toBe(direct.forfeited);
    expect(report.timeline.length).toBe(direct.timeline.length);
    for (const key of ['cash', 'earned', 'homes', 'shops', 'industry', 'elapsed'] as const) {
      expect(behind.state[key], key).toBe(bare.state[key]);
    }
  });
});
