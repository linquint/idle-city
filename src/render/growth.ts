const easeOutBack = (t: number): number => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

/**
 * Tracks which instances are mid-animation, and nothing else.
 *
 * The naive version rewrites every building's matrix on every frame of an
 * animation, which is fine at 400 buildings and wasteful at 4,000. Keeping the
 * in-flight indices in a set makes per-frame cost proportional to what is
 * actually moving, not to the size of the city.
 */
export class GrowthSchedule {
  private birth = new Float64Array(0);
  private active = new Set<number>();

  constructor(private duration: number) {}

  /**
   * How long an animation runs, changed under the running game.
   *
   * Mutable so the motion preference can be a switch rather than a restart. It
   * is safe mid-flight because the schedule stores a *birth time* and derives
   * the scale from the age each frame: shortening the duration finishes what is
   * in the air on the next frame rather than leaving it stranded, and
   * lengthening it lets it carry on from wherever it had got to.
   */
  setDuration(seconds: number): void {
    this.duration = seconds;
  }

  ensure(capacity: number): void {
    if (capacity <= this.birth.length) return;
    let n = Math.max(64, this.birth.length);
    while (n < capacity) n *= 2;
    const next = new Float64Array(n);
    // Anything never scheduled must read as having been there forever. Zero
    // would mean "born at t=0", which on the very first frame of a loaded save
    // is *now* — and a whole city would draw itself flat against the ground.
    next.fill(-Infinity);
    next.set(this.birth);
    this.birth = next;
  }

  schedule(index: number, at: number): void {
    this.ensure(index + 1);
    this.birth[index] = at;
    this.active.add(index);
  }

  /**
   * Schedules `[from, to)` as a wave rather than a pop. A backlog of a thousand
   * buildings is capped to `budget` animations so returning from a long absence
   * costs the same as buying one house.
   */
  stage(from: number, to: number, at: number, spread: number, budget: number): void {
    const start = Math.max(from, to - budget);
    const span = to - start;
    if (span <= 0) return;
    const step = Math.min(0.02, spread / span);
    for (let i = start; i < to; i++) this.schedule(i, at + (i - start) * step);
  }

  scaleAt(index: number, now: number): number {
    const age = now - (this.birth[index] ?? -Infinity);
    if (age >= this.duration) return 1;
    if (age <= 0) return 0.001;
    return Math.max(0.001, easeOutBack(age / this.duration));
  }

  /** Writes every in-flight instance and retires the ones that have finished. */
  update(now: number, write: (index: number, scale: number) => void): boolean {
    if (this.active.size === 0) return false;
    for (const index of this.active) {
      const scale = this.scaleAt(index, now);
      write(index, scale);
      if (scale === 1) this.active.delete(index);
    }
    return this.active.size > 0;
  }

  clear(): void {
    this.active.clear();
    this.birth.fill(-Infinity);
  }
}
