import type { GameEvent } from '../core/events.ts';
import type { Command, GameFacade, SimReply, SimRequest } from '../sim/commands.ts';
import { Game, type AwayReport } from '../sim/game.ts';
import { LocalGame } from '../sim/local.ts';
import type { GameState } from '../sim/state.ts';

/**
 * The simulation, on the other side of a `postMessage`.
 *
 * What the main thread holds is a *snapshot*: the state as of the last reply,
 * which is at most one tick — a tenth of a second — behind what the worker
 * holds. Everything on this side reads that snapshot, and the whole of the
 * design rests on the snapshot being cheap, which it is because the save is
 * counts. Measured on a full 49-district city with every cohort populated, a
 * full `unlocked` record and six fires burning:
 *
 *   state as JSON        2,260 bytes
 *   structuredClone         30 us  ->  0.30 ms/s at the 10 Hz reply rate
 *   JSON round-trip         24 us  ->  0.24 ms/s
 *
 * A state that grew with the city would not clone in thirty microseconds and
 * none of this would be affordable. `SharedArrayBuffer` is therefore not needed
 * and is not used, which matters more than it sounds: SAB requires COOP and
 * COEP response headers and GitHub Pages cannot set them, so a design that
 * reached for it would be a design that could not be deployed.
 */
export class WorkerGame implements GameFacade {
  onAway: ((report: AwayReport) => void) | null = null;
  onState: (() => void) | null = null;

  /**
   * The last state the worker sent.
   *
   * Read by everything on this thread — the renderer, the HUD, the save — and
   * written by nothing but a reply. It is a *copy*, which is a real difference
   * from the local path where `state` is the simulation's own object: nothing
   * on this side can accidentally reach in and change the city, which is a
   * property the view layer has always been careful to have and now has by
   * construction.
   */
  private snapshot: GameState;
  private readonly pending: GameEvent[] = [];
  private nextAway = 1;

  constructor(
    private readonly worker: Worker,
    opening: GameState,
  ) {
    this.snapshot = opening;
    this.worker.addEventListener('message', (event: MessageEvent<SimReply>) => {
      const reply = event.data;
      this.snapshot = reply.state;
      for (const one of reply.events) this.pending.push(one);
      if (reply.kind === 'away') this.onAway?.(reply.report);
      this.onState?.();
    });
    this.post({ kind: 'open', state: opening });
  }

  private post(request: SimRequest): void {
    this.worker.postMessage(request);
  }

  get state(): Readonly<GameState> {
    return this.snapshot;
  }

  /**
   * Everything that has happened since the last time anybody asked.
   *
   * Buffered here rather than in the worker, because the events arrive with the
   * replies and the HUD drains on its own schedule. Same contract as
   * `Game.drainEvents`: draining rather than reading, so two consumers cannot
   * both act on one event.
   */
  drainEvents(): GameEvent[] {
    if (this.pending.length === 0) return [];
    return this.pending.splice(0, this.pending.length);
  }

  /**
   * One frame of wall clock, forwarded.
   *
   * Sixty small messages a second — a tagged number each — against ten replies,
   * because the worker answers only for a frame that moved the state. The
   * asymmetry is the point: the expensive direction is the state coming back,
   * and it comes back at the rate the simulation actually ticks.
   */
  advance(dt: number): void {
    this.post({ kind: 'advance', dt });
  }

  catchUp(seconds: number): void {
    this.post({ kind: 'catchUp', seconds, id: this.nextAway++ });
  }

  send(command: Command): void {
    this.post({ kind: 'do', command });
  }

  /** Re-seeds the worker's city. What a `reset` and an ascension need. */
  open(state: GameState): void {
    this.snapshot = state;
    this.post({ kind: 'open', state });
  }
}

/**
 * The simulation, in a worker if this browser will have one and here if not.
 *
 * Three ways to end up on the main thread and all of them are ordinary: a
 * browser or an embedding that blocks workers outright, a Content-Security
 * -Policy that forbids the script, and `?noworker` in the URL, which is there
 * because the two paths have to be comparable by hand as well as by
 * measurement. None of them is an error worth showing a player — the game they
 * get is the game this repository shipped before any of this existed.
 */
export function createSimulation(opening: GameState): GameFacade {
  if (!wantsWorker()) return new LocalGame(new Game(opening));
  try {
    // `new URL(..., import.meta.url)` is the form Vite recognises: it emits the
    // worker as a chunk of its own and rewrites the URL to the built file. A
    // string path would be a path that is right at the dev server and wrong in
    // the build, or the other way round.
    const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    return new WorkerGame(worker, opening);
  } catch {
    // Constructing a Worker throws on a blocked script rather than firing an
    // error event, so this is the whole of the fallback.
    return new LocalGame(new Game(opening));
  }
}

function wantsWorker(): boolean {
  if (typeof Worker === 'undefined') return false;
  try {
    return !new URLSearchParams(location.search).has('noworker');
  } catch {
    return true;
  }
}
