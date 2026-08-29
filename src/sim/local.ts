import type { GameEvent } from '../core/events.ts';
import { applyCommand, type Command, type GameFacade } from './commands.ts';
import { Game, type AwayReport } from './game.ts';
import type { GameState } from './state.ts';

/**
 * The simulation, in this thread, behind the same surface the worker presents.
 *
 * The fallback, and it has to exist rather than being a nicety: a Worker can be
 * blocked outright — a strict Content-Security-Policy, an extension, an
 * embedding that forbids one — and the answer to that has to be a game that
 * runs, not a blank canvas. It is also what `npm test` gets, and what the dev
 * server gets when `?noworker` is in the URL.
 *
 * Everything here is a straight delegation. There is no second simulation and
 * no shadow state: this holds the *same* `Game` the game has always used, and
 * the only thing it adds is the shape of the boundary — commands arrive as data
 * and the away report is announced rather than returned. Both paths therefore
 * run the same `applyCommand`, which is what stops the fallback from being a
 * parallel implementation that quietly drifts.
 */
export class LocalGame implements GameFacade {
  onAway: ((report: AwayReport) => void) | null = null;
  onState: (() => void) | null = null;

  constructor(private readonly game: Game) {}

  get state(): Readonly<GameState> {
    return this.game.state;
  }

  drainEvents(): GameEvent[] {
    return this.game.drainEvents();
  }

  advance(dt: number): void {
    this.game.advance(dt);
    // Announced every frame rather than only when a tick ran, because there is
    // nothing to save by not: the caller is about to sync against a state it
    // already holds by reference. The worker path is where the distinction
    // earns anything, and it makes it there.
    this.onState?.();
  }

  catchUp(seconds: number): void {
    const report = this.game.catchUp(seconds);
    // Synchronously, which is the only difference between the two paths that a
    // caller can observe — and the reason `main.ts` does its persist inside the
    // handler rather than after the call.
    this.onAway?.(report);
    this.onState?.();
  }

  send(command: Command): void {
    applyCommand(this.game, command);
    this.onState?.();
  }
}
