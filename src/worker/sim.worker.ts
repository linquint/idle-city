/**
 * The simulation, in a thread of its own.
 *
 * Everything this file does is transport. It owns a `Game`, it applies what
 * arrives, and it posts the state back when the state moved — and there is
 * deliberately nothing else in it, because every line here is a line that
 * cannot be tested without a worker.
 *
 * ---
 *
 * **What it must not import, and why it is checked.** `save.ts` reaches for
 * `globalThis.localStorage`, which does not exist in a Worker. It is wrapped in
 * a `try` that returns null, so a worker that called `save()` would not throw —
 * it would silently stop persisting, with no error anywhere and no way to
 * notice short of losing a city. So persistence stays entirely on the main
 * thread: this side never sees `SAVE_KEY`, `LEGACY_SAVE_KEYS` or `migrate`, and
 * `tools/worker.test.mjs` walks the import graph from this file and fails if
 * `save.ts` is ever reachable from it. The main thread loads, hands the state
 * in through `open`, takes the state back out with every reply, writes it, and
 * tells this side what timestamp it used — which is what `markSaved` is for.
 *
 * **The clock stays on the main thread.** `advance(dt)` arrives per frame with
 * the delta the frame loop measured, rather than this side running a timer of
 * its own. That is not tidiness: `requestAnimationFrame` stops in a hidden tab
 * and `visibilitychange` then credits the absence through `catchUp`, and a
 * worker ticking on `setInterval` would keep running through the same absence
 * and then have it credited a second time. The tick schedule is a number in
 * `src/sim`, and this change does not move one.
 */
import type { GameEvent } from '../core/events.ts';
import { applyCommand, type SimReply, type SimRequest } from '../sim/commands.ts';
import { Game } from '../sim/game.ts';
import { createState } from '../sim/state.ts';

let game = new Game(createState());
/**
 * Whether anything worth sending has happened since the last reply.
 *
 * The whole of the message-rate answer. `advance` is called sixty times a
 * second and the simulation ticks ten, so five frames in six change nothing at
 * all — and a reply for one of those would be a 2.3 kB structured clone for a
 * state the main thread already has. `elapsed` is what a tick moves and a
 * command is the only other thing that can move the state, so between them
 * they are exactly the set of frames worth a message.
 */
let sent = -1;

/**
 * The worker's own `postMessage`, which takes one argument.
 *
 * Cast rather than typed off `DedicatedWorkerGlobalScope`, because that
 * interface arrives with `@types/node`'s absent worker lib and the project's
 * `types: ["vite/client"]` deliberately does not pull the whole DOM worker
 * surface in for one signature. What is actually being asserted is that `self`
 * here is a worker scope, which it is by construction — this file is only ever
 * loaded as one.
 */
const post = (reply: SimReply): void => {
  (self as unknown as { postMessage: (data: SimReply) => void }).postMessage(reply);
};

/** The state and whatever has happened, as one message. */
function flush(): void {
  const events: GameEvent[] = game.drainEvents();
  if (game.state.elapsed === sent && events.length === 0) return;
  sent = game.state.elapsed;
  post({ kind: 'state', state: game.state as never, events });
}

self.addEventListener('message', (event: MessageEvent<SimRequest>) => {
  const request = event.data;
  switch (request.kind) {
    case 'open':
      // A fresh `Game` rather than a mutation, so the constructor's own copies
      // of the cohorts, the record and the chart happen exactly as they do on
      // the main thread. `reset` and an ascension come through here too.
      game = new Game(request.state);
      sent = -1;
      flush();
      return;
    case 'advance':
      game.advance(request.dt);
      flush();
      return;
    case 'do':
      applyCommand(game, request.command);
      // Forced, because a purchase moves the state without moving `elapsed` and
      // the player is waiting to see it.
      sent = -1;
      flush();
      return;
    case 'catchUp': {
      const report = game.catchUp(request.seconds);
      const events: GameEvent[] = game.drainEvents();
      sent = game.state.elapsed;
      // One message rather than two, so the report and the state it describes
      // cannot be applied a frame apart.
      post({ kind: 'away', id: request.id, report, state: game.state as never, events });
      return;
    }
  }
});
