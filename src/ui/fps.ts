/**
 * A frame-rate readout, and nothing else.
 *
 * Deliberately not part of `Hud`: `Hud` is a read-only subscriber to the
 * *simulation*, and this reads the *renderer*. The two have no numbers in
 * common — the game runs on fixed ticks and does not care what the frame loop
 * manages — so folding this into the HUD would put a renderer clock inside the
 * one class whose whole contract is that it only ever reads `GameState`.
 */

/**
 * Frames the average is taken over.
 *
 * An instantaneous 1/dt is unreadable: at 60fps a single 3ms jitter swings the
 * number by 15, so the readout spends its life flickering between two values
 * that mean the same thing. Thirty frames is half a second at 60fps — long
 * enough to settle, short enough that a stall still shows up while it is
 * happening rather than a second after it has passed.
 */
const WINDOW = 30;

/** Standard EMA weight for a window of N samples. 2/31 ≈ 0.0645 here. */
const ALPHA = 2 / (WINDOW + 1);

/**
 * The readout averages *frame times* and inverts once, rather than averaging
 * 1/dt. Averaging the reciprocal is not the same number: one 250ms hitch in a
 * run of 60fps frames pulls a mean of reciprocals down by a fraction of a
 * frame, but pulls the reciprocal of the mean — which is what "frames per
 * second over this window" actually means — down to about 40. The second is
 * the honest answer, and it is the one a hitch should show.
 */
export class FpsMeter {
  private readonly node: HTMLElement;
  private frameTime = 0;
  /** Last value written to the DOM. -1 so the first sample always writes. */
  private shown = -1;
  private visible = true;

  constructor(parent: HTMLElement = document.body) {
    const node = document.createElement('div');
    node.className = 'fps';
    // A dev instrument, not information. A screen reader announcing a number
    // that changes every few frames would bury everything the HUD says.
    node.setAttribute('aria-hidden', 'true');
    node.textContent = '—— fps';
    parent.append(node);
    this.node = node;
  }

  /**
   * Feeds one frame's wall-clock delta, in seconds.
   *
   * The DOM write is conditional on purpose. `textContent =` invalidates
   * layout, so writing it unconditionally every frame adds a layout pass per
   * frame to the very thing the counter exists to measure — the instrument
   * would be reporting its own cost. Rounded to whole frames, it writes a
   * handful of times a second on a steady machine and not at all on a locked
   * one.
   */
  sample(dt: number): void {
    // Hidden costs nothing at all rather than costing an invisible write: this
    // is the one thing in the frame loop whose whole job is to not perturb the
    // frame loop, and an instrument that kept averaging while switched off
    // would still be measuring itself.
    if (!this.visible || !(dt > 0)) return;
    this.frameTime = this.frameTime === 0 ? dt : this.frameTime + (dt - this.frameTime) * ALPHA;
    const fps = Math.round(1 / this.frameTime);
    if (fps === this.shown) return;
    this.shown = fps;
    this.node.textContent = `${fps} fps`;
  }

  /**
   * Shows or hides the readout.
   *
   * `hidden` rather than a class, because the node's only job is to carry a
   * number and there is no layout to preserve. The average is thrown away on
   * the way out and the last-written value with it, so switching it back on
   * shows what the frame loop is doing *now* rather than a number from before
   * the player went away and came back.
   */
  setVisible(on: boolean): void {
    if (on === this.visible) return;
    this.visible = on;
    this.node.hidden = !on;
    this.frameTime = 0;
    this.shown = -1;
    if (!on) this.node.textContent = '—— fps';
  }

  dispose(): void {
    this.node.remove();
  }
}
