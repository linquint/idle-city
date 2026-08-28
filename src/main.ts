import './style.css';

import { Game } from './sim/game';
import { CityLayout } from './sim/layout';
import { load, save, secondsAway } from './sim/save';
import { createState } from './sim/state';
import { View } from './render/view';
import { FpsMeter } from './ui/fps';
import { Hud } from './ui/hud';

const AUTOSAVE_SECONDS = 10;
/** Below this, returning to the tab is not "being away" and needs no report. */
const REPORT_THRESHOLD_SECONDS = 120;

const canvas = document.getElementById('stage');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing #stage canvas');

const layout = new CityLayout();
const saved = load();
const game = new Game(saved ?? createState());
const view = new View(canvas, layout);

// A renderer instrument, fed from the frame loop rather than from the HUD:
// `Hud` reads the simulation, and frame rate is not a simulation number.
const fps = new FpsMeter();

const hud = new Hud(game, layout, {
  onReset: () => persist(),
  onSkip: (seconds) => {
    hud.showAway(game.catchUp(seconds));
    hud.paint();
  },
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
});

// And the other direction: the Z key belongs to the view, so a cycle there has
// to move the picker or the two controls would disagree about what is showing.
view.onZoneMode = (mode) => hud.markOverlay(mode);
view.onStreet = (street) => hud.markStreet(street);

// Selection is view state and stays there: the view owns what was clicked, the
// HUD owns what is said about it, and neither writes it anywhere.
view.onSelect = (ref) => hud.inspect(ref);

/**
 * Writes the save and stamps the clock it will be measured from. Every
 * catch-up must be followed by one, or the same absence gets credited twice.
 */
function persist(): void {
  game.markSaved(save(game.state));
}

// Time away is credited before the first frame, so the city the player returns
// to is already the one their absence earned.
if (saved) {
  const report = game.catchUp(secondsAway(saved));
  persist();
  if (report.seconds >= REPORT_THRESHOLD_SECONDS) hud.showAway(report);
}

let sinceSave = 0;
let last = performance.now();

let running = true;

function frame(now: number): void {
  if (!running) return;
  requestAnimationFrame(frame);

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
  const report = game.catchUp(away);
  persist();
  if (report.seconds >= REPORT_THRESHOLD_SECONDS) hud.showAway(report);
  hud.paint();
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
