import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from '../src/sim/config';
import {
  createSkyReading,
  dayPhase,
  DUSK_PHASE,
  MAX_SUN_ELEVATION,
  RESTING_PHASE,
  MIN_SUN_ELEVATION,
  sampleSky,
  sunAzimuth,
  sunElevation,
} from '../src/render/daylight';

/** A spread that lands on every keyframe boundary and between all of them. */
const phases = (steps: number): number[] =>
  Array.from({ length: steps }, (_, i) => i / steps);

describe('day phase', () => {
  it('is a pure function of elapsed', () => {
    for (const elapsed of [0, 1, 37.5, 240, 479.9, 1_000, 86_400]) {
      expect(dayPhase(elapsed)).toBe(dayPhase(elapsed));
    }
  });

  it('opens the game at the resting keyframe, which is midday', () => {
    expect(dayPhase(0)).toBe(RESTING_PHASE);
    expect(RESTING_PHASE).toBe(0);
    // Midday exactly: the sun is at the top of its arc at phase 0.
    expect(sunElevation(RESTING_PHASE)).toBeCloseTo(MAX_SUN_ELEVATION, 12);
  });

  it('stays in [0, 1) and wraps cleanly at the day boundary', () => {
    for (let i = 0; i < 4_000; i++) {
      const elapsed = i * 3.37;
      const phase = dayPhase(elapsed);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
      // The whole point of a cycle: one day later is the same time of day.
      expect(dayPhase(elapsed + DAY_SECONDS)).toBeCloseTo(phase, 9);
    }
  });

  it('approaches 1 from below and lands back on 0', () => {
    expect(dayPhase(DAY_SECONDS - 1e-6)).toBeGreaterThan(0.999);
    expect(dayPhase(DAY_SECONDS)).toBe(0);
    expect(dayPhase(DAY_SECONDS * 12)).toBe(0);
  });

  /** Not reachable today, but a doctored save is exactly where it would be. */
  it('survives a nonsense clock rather than running the sun backwards', () => {
    expect(dayPhase(-30)).toBeGreaterThanOrEqual(0);
    expect(dayPhase(-30)).toBeLessThan(1);
    expect(dayPhase(Number.NaN)).toBe(RESTING_PHASE);
    expect(dayPhase(Number.POSITIVE_INFINITY)).toBe(RESTING_PHASE);
  });
});

describe('the sun', () => {
  /**
   * The clamp is not cosmetic. Shadow length is height / tan(elevation), so a
   * sun anywhere near the horizon throws shadows the 150-unit shadow box cannot
   * hold, and the city loses its shadows at the hour they read best.
   */
  it('never drops below the elevation clamp, at any phase', () => {
    for (const phase of phases(2_000)) {
      expect(sunElevation(phase)).toBeGreaterThanOrEqual(MIN_SUN_ELEVATION);
      expect(sunElevation(phase)).toBeLessThanOrEqual(MAX_SUN_ELEVATION + 1e-12);
    }
  });

  it('spends most of the night sitting on the clamp, and reaches noon once', () => {
    const sampled = phases(1_000).map(sunElevation);
    const pinned = sampled.filter((e) => e === MIN_SUN_ELEVATION).length;
    expect(pinned).toBeGreaterThan(300);
    expect(Math.max(...sampled)).toBeCloseTo(MAX_SUN_ELEVATION, 4);
  });

  it('is low at the dusk keyframe but well clear of the clamp', () => {
    const dusk = sunElevation(DUSK_PHASE);
    expect(dusk).toBeGreaterThan(MIN_SUN_ELEVATION * 2);
    expect(dusk).toBeLessThan(MAX_SUN_ELEVATION / 2);
  });

  it('makes one full turn of azimuth a day', () => {
    expect(sunAzimuth(1) - sunAzimuth(0)).toBeCloseTo(Math.PI * 2, 12);
  });
});

describe('the sky reading', () => {
  const reading = createSkyReading();

  it('hands back a unit vector pointing at the sun', () => {
    for (const phase of phases(500)) {
      const sky = sampleSky(phase, reading);
      expect(Math.hypot(sky.dirX, sky.dirY, sky.dirZ)).toBeCloseTo(1, 12);
      // Above the horizon at every hour, because the elevation is clamped.
      expect(sky.dirY).toBeGreaterThan(0);
    }
  });

  it('keeps every ramped value inside its range and wraps continuously', () => {
    for (const phase of phases(720)) {
      const sky = sampleSky(phase, reading);
      expect(sky.night).toBeGreaterThanOrEqual(0);
      expect(sky.night).toBeLessThanOrEqual(1);
      expect(sky.keyIntensity).toBeGreaterThan(0);
      for (const hex of [sky.keyColor, sky.skyColor, sky.groundColor, sky.background]) {
        expect(Number.isInteger(hex)).toBe(true);
        expect(hex).toBeGreaterThanOrEqual(0);
        expect(hex).toBeLessThanOrEqual(0xffffff);
      }
    }
    // The seam is the one place a keyframe table can tear: the last span runs
    // past 1 back onto the first keyframe rather than to a negative width.
    const before = { ...sampleSky(0.9999, reading) };
    const after = sampleSky(0, reading);
    expect(after.night).toBeCloseTo(before.night, 2);
    expect(after.keyIntensity).toBeCloseTo(before.keyIntensity, 2);
  });

  it('is darkest around midnight and brightest at midday', () => {
    // The table was rotated so phase 0 is midday, which moved midnight from
    // 0.31 to 0.50 — half a day from the frame the game opens on, as it should
    // be. Both are keyframes rather than interpolated points.
    const midnight = { ...sampleSky(0.50, reading) };
    const midday = { ...sampleSky(RESTING_PHASE, reading) };
    expect(midnight.night).toBe(1);
    expect(midday.night).toBe(0);
    expect(midday.keyIntensity).toBeGreaterThan(midnight.keyIntensity * 4);
    expect(midday.elevation).toBeGreaterThan(midnight.elevation);
  });

  /**
   * The sodium hour survived the lift. It is the best-looking moment in the
   * game and the one thing in the table that was already right; what changed is
   * that it is no longer the *only* frame anybody sees, so it moved off phase 0
   * rather than being retuned.
   */
  it('keeps the sodium dusk exactly where it was, at its new phase', () => {
    const dusk = sampleSky(DUSK_PHASE, reading);
    expect(DUSK_PHASE).toBe(0.19);
    expect(dusk.keyColor).toBe(0xffce96);
    // Warm, low and still the warmest key in the table below midday.
    expect(dusk.night).toBeGreaterThan(0.4);
    expect(dusk.elevation).toBeLessThan(MAX_SUN_ELEVATION / 2);
    expect(dusk.elevation).toBeGreaterThan(MIN_SUN_ELEVATION * 2);
  });

  /**
   * The lift, stated as a test. The old table's brightest background was
   * `0x46618a` — darker than most skies are at dusk — which is why the whole
   * city read as permanently overcast whatever the clock said.
   */
  it('reaches a daylight sky rather than a merely-less-dark one', () => {
    const midday = sampleSky(RESTING_PHASE, reading);
    const channel = (hex: number, shift: number): number => (hex >> shift) & 0xff;
    for (const shift of [16, 8, 0]) {
      expect(channel(midday.background, shift)).toBeGreaterThan(0x8f);
      expect(channel(midday.skyColor, shift)).toBeGreaterThan(0xb0);
    }
    expect(midday.hemiIntensity).toBeGreaterThan(1.5);
    expect(midday.night).toBe(0);
  });
});
