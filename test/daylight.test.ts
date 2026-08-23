import { describe, expect, it } from 'vitest';
import { DAY_SECONDS } from '../src/sim/config';
import {
  createSkyReading,
  dayPhase,
  DUSK_PHASE,
  MAX_SUN_ELEVATION,
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

  it('opens the game at the dusk keyframe', () => {
    expect(dayPhase(0)).toBe(DUSK_PHASE);
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
    expect(dayPhase(Number.NaN)).toBe(DUSK_PHASE);
    expect(dayPhase(Number.POSITIVE_INFINITY)).toBe(DUSK_PHASE);
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
    const midnight = { ...sampleSky(0.31, reading) };
    const midday = { ...sampleSky(0.81, reading) };
    expect(midnight.night).toBe(1);
    expect(midday.night).toBe(0);
    expect(midday.keyIntensity).toBeGreaterThan(midnight.keyIntensity * 4);
    expect(midday.elevation).toBeGreaterThan(midnight.elevation);
  });

  /** The whole reason phase 0 is dusk: the game still opens looking like itself. */
  it('holds the shipped dusk palette at phase 0', () => {
    const dusk = sampleSky(DUSK_PHASE, reading);
    expect(dusk.keyColor).toBe(0xffce96);
    expect(dusk.keyIntensity).toBeCloseTo(2.1, 12);
    expect(dusk.skyColor).toBe(0x5e7fa8);
    expect(dusk.background).toBe(0x0b111b);
  });
});
