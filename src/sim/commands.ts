import type { GameEvent } from '../core/events.ts';
import {
  CULTURE,
  LANDMARKS,
  SERVICES,
  TERMINALS,
  TRANSIT_LINES,
  type Landmark,
  type Service,
  type Terminal,
  type TransitLine,
  type Culture,
} from './config.ts';
import type { AwayReport, Game } from './game.ts';
import type { GameState } from './state.ts';

/**
 * Everything the player can ask the simulation to do, as data.
 *
 * The whole of what it takes to put `Game` behind a thread boundary, and it is
 * deliberately *not* a general RPC over the class. A `Landmark` and a `Service`
 * are frozen table rows out of `config.ts` — structured-clone would copy them
 * across the boundary and the copies would fail every `===` the simulation
 * makes against the table. So a command names a *key*, and `applyCommand`
 * resolves it back to the real row on the far side. That is the one thing this
 * layer exists to get right.
 *
 * Data rather than a function call for a second reason: it is the same message
 * whether it is posted to a worker or handed to a `Game` in this thread, which
 * is what lets the no-worker fallback run the same path rather than a parallel
 * one.
 */
export type Command =
  /** The nine purchases that take no argument. */
  | { readonly kind: 'home' }
  | { readonly kind: 'shop' }
  | { readonly kind: 'industry' }
  | { readonly kind: 'park' }
  | { readonly kind: 'plant' }
  | { readonly kind: 'cityHall' }
  | { readonly kind: 'airport' }
  | { readonly kind: 'highway' }
  | { readonly kind: 'estate' }
  | { readonly kind: 'annex' }
  | { readonly kind: 'ascend' }
  | { readonly kind: 'reset' }
  /** The five that name a row of a config table. See the note above. */
  | { readonly kind: 'landmark'; readonly key: Landmark['key'] }
  | { readonly kind: 'terminal'; readonly key: Terminal['key'] }
  | { readonly kind: 'service'; readonly key: Service['key'] }
  | { readonly kind: 'line'; readonly key: TransitLine['key'] }
  | { readonly kind: 'culture'; readonly key: Culture['key'] }
  /** The five policy switches. */
  | { readonly kind: 'autoDevelop'; readonly on: boolean }
  | { readonly kind: 'freeTransport'; readonly on: boolean }
  | { readonly kind: 'goodsTrade'; readonly on: boolean }
  | { readonly kind: 'taxRate'; readonly step: number }
  | { readonly kind: 'powerTrade'; readonly step: number }
  /** And the one thing the *main thread* tells the simulation. See `markSaved`. */
  | { readonly kind: 'markSaved'; readonly at: number };

/**
 * Runs one command against a game.
 *
 * A pure dispatcher with no worker anywhere in it, which is the point: the
 * message format and the mapping from a message to a `Game` method are testable
 * in plain Node, and `test/worker.test.ts` does exactly that. If this needed a
 * worker to be tested, the boundary would be in the wrong place.
 *
 * Returns whatever the method returned, so a caller that wants to know whether
 * a purchase landed still can. Nothing in the worker path reads it — the state
 * that comes back is the answer — but the local path is the same code.
 */
export function applyCommand(game: Game, command: Command): boolean {
  switch (command.kind) {
    case 'home':
      return game.buildHome();
    case 'shop':
      return game.buildShop();
    case 'industry':
      return game.buildIndustry();
    case 'park':
      return game.buildPark();
    case 'plant':
      return game.buildPlant();
    case 'cityHall':
      return game.buildCityHall();
    case 'airport':
      return game.buildAirport();
    case 'highway':
      return game.buildHighway();
    case 'estate':
      return game.buildEstate();
    case 'annex':
      return game.annex();
    case 'ascend':
      return game.ascend();
    case 'reset':
      game.reset();
      return true;
    case 'landmark': {
      // Resolved against the table rather than trusted, for the reason the type
      // above gives: the row that crossed the boundary would be a copy.
      const row = LANDMARKS.find((entry) => entry.key === command.key);
      return row !== undefined && game.buildLandmark(row);
    }
    case 'terminal': {
      const row = TERMINALS.find((entry) => entry.key === command.key);
      return row !== undefined && game.buildTerminal(row);
    }
    case 'service': {
      const row = SERVICES.find((entry) => entry.key === command.key);
      return row !== undefined && game.buildService(row);
    }
    case 'line': {
      const row = TRANSIT_LINES.find((entry) => entry.key === command.key);
      return row !== undefined && game.buildLine(row);
    }
    case 'culture': {
      const row = CULTURE.find((entry) => entry.key === command.key);
      return row !== undefined && game.buildCulture(row);
    }
    case 'autoDevelop':
      game.setAutoDevelop(command.on);
      return true;
    case 'freeTransport':
      game.setFreeTransport(command.on);
      return true;
    case 'goodsTrade':
      game.setGoodsTrade(command.on);
      return true;
    case 'taxRate':
      game.setTaxRate(command.step);
      return true;
    case 'powerTrade':
      game.setPowerTrade(command.step);
      return true;
    case 'markSaved':
      game.markSaved(command.at);
      return true;
  }
}

// ------------------------------------------------------------- the boundary

/** What the main thread sends. */
export type SimRequest =
  /** The city to run. Sent once, and again after a `reset` or an ascension. */
  | { readonly kind: 'open'; readonly state: GameState }
  /** One frame of wall clock. See `advance`: the clock stays on the main thread. */
  | { readonly kind: 'advance'; readonly dt: number }
  | { readonly kind: 'do'; readonly command: Command }
  /** An absence to credit. `id` pairs the reply with the call that asked. */
  | { readonly kind: 'catchUp'; readonly seconds: number; readonly id: number };

/** What comes back. */
export type SimReply =
  /** The city, whenever it moved. Nothing is sent for a frame that changed nothing. */
  | { readonly kind: 'state'; readonly state: GameState; readonly events: readonly GameEvent[] }
  /** An away report, with the state it left behind. */
  | {
      readonly kind: 'away';
      readonly id: number;
      readonly report: AwayReport;
      readonly state: GameState;
      readonly events: readonly GameEvent[];
    };

/**
 * The surface the HUD is written against.
 *
 * `Game` satisfies it as it stands, which is the whole design: the panel did
 * not have to learn anything about threads, and the class that has run this
 * game since the first commit is still a legal thing to hand it.
 *
 * The one method whose *shape* had to move is `catchUp`. It returned an
 * `AwayReport` and cannot across a thread boundary, so it announces through
 * `onAway` instead — which the local implementation calls synchronously, so the
 * two paths differ in latency and in nothing else.
 */
export interface GameFacade {
  readonly state: Readonly<GameState>;
  drainEvents(): GameEvent[];
  advance(dt: number): void;
  catchUp(seconds: number): void;
  /** Told when an absence has been credited. Null until somebody wants it. */
  onAway: ((report: AwayReport) => void) | null;
  /** Told when the state moved, so the frame loop knows to sync. */
  onState: (() => void) | null;
  send(command: Command): void;
}
