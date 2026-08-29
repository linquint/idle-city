import './style.css';

import { SettingsStore } from './core/settings';
import { registerServiceWorker } from './pwa';
import { CityLayout } from './sim/layout';
import { load, save, secondsAway } from './sim/save';
import { createState } from './sim/state';
import { createSimulation } from './worker/client';
import { View } from './render/view';
import { FpsMeter } from './ui/fps';
import { Hud } from './ui/hud';

const AUTOSAVE_SECONDS = 10;
/** Below this, returning to the tab is not "being away" and needs no report. */
const REPORT_THRESHOLD_SECONDS = 120;

const canvas = document.getElementById('stage');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing #stage canvas');

const layout = new CityLayout();

// Loaded here and *only* here. `save.ts` reaches for `globalThis.localStorage`,
// which does not exist in a Worker — and it is wrapped in a `try` that returns
// null, so a worker that saved would silently stop saving with no error
// anywhere. So persistence stays on this side of the boundary in its entirety:
// this module loads, hands the state to the simulation, takes it back with
// every reply, writes it, and tells the simulation what timestamp it used.
// tools/worker.test.mjs walks the worker's import graph and fails if `save.ts`
// is ever reachable from it.
const saved = load();

// A worker if the browser will have one, and this thread if not. The two are
// the same interface and run the same `applyCommand`; what differs is that one
// of them answers a tenth of a second later. See src/worker/client.ts.
const game = createSimulation(saved ?? createState());

// Read before the view is built, because the view's construction depends on it
// — the motion preference decides how long a growth animation runs and whether
// the traffic moves at all. It comes from its own storage key and is not part
// of the save: `reset()` and `ascend()` throw the city away and leave this
// exactly as it was, which is what a preference should do. See core/settings.
const settings = new SettingsStore();
const view = new View(canvas, layout, settings.value);

// A renderer instrument, fed from the frame loop rather than from the HUD:
// `Hud` reads the simulation, and frame rate is not a simulation number.
const fps = new FpsMeter();

/**
 * Everything a display preference reaches.
 *
 * Applied here rather than inside the store, so the store stays a value that
 * knows nothing about a renderer — the same separation the overlay and the
 * camera already have, where the view owns the state and the HUD is a
 * subscriber. Run once at startup as well as on every change, so the panel's
 * defaults and what is actually on screen cannot disagree on the first frame.
 */
function applySettings(): void {
  view.apply(settings.value);
  fps.setVisible(settings.value.fps);
}
settings.onChange = () => applySettings();
applySettings();

/**
 * Whether the save is owed a write as soon as the simulation answers.
 *
 * A `reset` and an ascension both throw the city away, and both are commands
 * now — so on the worker path the state that matters does not exist yet when
 * the button's handler runs. Persisting there would write the *old* city, and a
 * player who closed the tab in the tenth of a second before the reply would
 * find it still there. So the write waits for the state that caused it.
 */
let saveOnNextState = false;

const hud = new Hud(game, layout, {
  onReset: () => void (saveOnNextState = true),
  // Dev-only time travel. The report comes back through `onAway`, which is the
  // same path the real absence takes.
  onSkip: (seconds) => game.catchUp(seconds),
  // Dismissing the card is the same act as clearing the selection, so the
  // outline in the world goes with it rather than being left behind.
  onDeselect: () => view.select(null),
  // The overlay is the view's, so the picker asks rather than deciding — and
  // the view hands back what it settled on, which is what the chips mark.
  onZoneMode: (mode) => view.setZoneMode(mode),
  zoneMode: () => view.zoneMode,
  // The camera is the view's in exactly the way the overlay is.
  onStreet: () => view.toggleStreet(),
  street: () => view.street,
  // And the tour, which is a camera in exactly the way street level is.
  onTour: () => view.toggleTour(),
  touring: () => view.touring,
  // Not a hook, because it is not a request: the panel reads the store to mark
  // its controls and writes to it, and this module is subscribed to the same
  // store. Nothing about it reaches `game`.
  settings,
});

// And the other direction: the Z key belongs to the view, so a cycle there has
// to move the picker or the two controls would disagree about what is showing.
view.onZoneMode = (mode) => hud.markOverlay(mode);
view.onStreet = (street) => hud.markStreet(street);
// The tour ends on any input, most of which the view sees and the HUD does not,
// so the switch follows what the view reports rather than what was clicked.
view.onTour = (stop) => hud.markTour(stop !== null, stop?.name ?? '');

// Selection is view state and stays there: the view owns what was clicked, the
// HUD owns what is said about it, and neither writes it anywhere.
view.onSelect = (ref) => hud.inspect(ref);

/**
 * Writes the save and stamps the clock it will be measured from. Every
 * catch-up must be followed by one, or the same absence gets credited twice.
 */
function persist(): void {
  // The state written is the last one the simulation sent, which on the worker
  // path is at most one tick — a tenth of a second — behind what it holds. A
  // reload therefore loses at most that, against a save that is written every
  // ten seconds anyway.
  game.send({ kind: 'markSaved', at: save(game.state) });
}

/**
 * An absence, credited and then written down.
 *
 * A hook rather than a return value, because a `catchUp` across a thread
 * boundary cannot be one — and the ordering is what matters rather than the
 * shape: every catch-up has to be followed by a `persist`, or the same absence
 * is credited twice on the next load. Doing it here means that holds on both
 * paths, since the local simulation calls this synchronously from inside
 * `catchUp` and the worker calls it when the reply lands.
 */
game.onState = () => {
  if (!saveOnNextState) return;
  saveOnNextState = false;
  persist();
};

game.onAway = (report) => {
  persist();
  if (report.seconds >= REPORT_THRESHOLD_SECONDS) hud.showAway(report);
  hud.paint();
};

// Time away is credited before the first frame, so the city the player returns
// to is already the one their absence earned.
if (saved) game.catchUp(secondsAway(saved));

let sinceSave = 0;
let last = performance.now();

let running = true;

function frame(now: number): void {
  if (!running) return;
  requestAnimationFrame(frame);

// Last, and after the first frame is already scheduled. Everything about
// offline play was true before this — no server, a `localStorage` save, twelve
// hours of `catchUp` — except that a cold load still needed the network for the
// document itself. See src/pwa.ts.
registerServiceWorker();

  // A backgrounded tab can hand back an enormous delta. Clamping here keeps the
  // simulation honest; the real catch-up happens on visibilitychange.
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;

  game.advance(dt);
  view.sync(game.state);
  view.render(dt);
  hud.tick(dt);
  fps.sample(dt);

  sinceSave += dt;
  if (sinceSave >= AUTOSAVE_SECONDS) {
    sinceSave = 0;
    persist();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    persist();
    return;
  }
  // requestAnimationFrame is throttled or stopped while hidden, so the clock is
  // the only reliable record of how long the tab spent in the background.
  const away = secondsAway(game.state);
  last = performance.now();
  if (away < 2) return;
  // The report, the persist and the repaint all happen in `onAway` above, so
  // the ordering is the same whichever thread ran the catch-up.
  game.catchUp(away);
});

window.addEventListener('pagehide', () => persist());

requestAnimationFrame(frame);

// Without this, every hot update in dev leaks a WebGL context, a render loop
// and a set of window listeners until the tab gives up.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    running = false;
    persist();
    view.dispose();
    fps.dispose();
  });
}
