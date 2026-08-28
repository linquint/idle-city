/**
 * What the city looked like, over time.
 *
 * Three series — population, income and happiness — sampled on simulated time
 * into a fixed ring, and held in the save. The last part is the interesting
 * one and is what the whole file is arranged around: an away city has to come
 * back with a chart of the time it was away, so the buffer cannot live in the
 * HUD. That makes it the second exception to "the save is counts", after
 * `surveyedR`, and like that one it is bounded by something other than the city:
 * `HISTORY_SAMPLES` entries a tier, forever, at one district or at forty-nine.
 *
 * ---
 *
 * **Why two tiers.** OFFLINE_CAP_SECONDS is twelve hours. A single two-hour ring
 * would be completely overwritten by one ordinary absence — every sample in it
 * would post-date the moment the player left, and the chart they came back to
 * would be a chart of the last two hours of a twelve-hour catch-up rather than
 * of the absence. So there are two: a fine tier at HISTORY_FINE_SECONDS covering
 * two hours, for the session you are in, and a coarse tier at
 * HISTORY_COARSE_SECONDS covering sixty, for the life of the city.
 *
 * **Why an encoding.** The entire 49-district save is 1,386 bytes. A 240-sample
 * by 3-series buffer written as JSON numbers is 7,170 — five times the rest of
 * the save, for a readout. Measured on a realistic growth series:
 *
 *     raw JSON numbers        7,170 B
 *     quantised numbers       2,947 B
 *     base36, joined          1,863 B
 *     3-char packed base36    1,708 B
 *
 * So a sample is a fixed-width base36 string and a series is those strings
 * concatenated: no separators, no per-sample object, and the offset of sample
 * `i` is `i * WIDTH`. Three significant figures is more than a chart three
 * hundred pixels wide can show, and happiness is a share, so it gets one
 * character over 0..35 rather than three.
 *
 * **Why it is banked.** Sampling on the frame loop would make the save depend on
 * the frame rate. Sampling per tick would make it depend on the tick size, so a
 * 60-second catch-up step and 600 tenth-second ticks would produce different
 * series. Seconds accumulate in `clock` and whole intervals are spent out of it,
 * which is the same trick `surveyClock`, `fireHazard` and `driftR` all use, and
 * the reason it is in the save rather than on `Game`: a reload must not shift
 * the sampling phase.
 *
 * **Why it degrades rather than throws.** A string of the wrong length, a
 * character outside base36, a head index pointing nowhere: all of it decodes to
 * an empty ring. A save is untrusted input and a chart is a readout — losing one
 * is not worth refusing to open a city over.
 */
import type { GameState } from './state.ts';

/**
 * Samples one tier holds.
 *
 * A hundred and twenty, which is both tiers' length and is not a coincidence:
 * the tiers differ in their *interval*, not in their size, so the chart is the
 * same shape whichever is showing and the toggle changes the axis rather than
 * the picture.
 */
export const HISTORY_SAMPLES = 120;

/** Simulated seconds between fine samples. 120 of them is two hours. */
export const HISTORY_FINE_SECONDS = 60;

/**
 * Simulated seconds between coarse samples. 120 of them is sixty hours.
 *
 * Comfortably longer than OFFLINE_CAP_SECONDS' twelve, which is the property
 * that matters: one maximum-length absence writes 24 coarse samples and leaves
 * the other 96 standing, so the long view survives being away.
 */
export const HISTORY_COARSE_SECONDS = 1800;

/** Characters one population or income sample takes: two of mantissa, one of exponent. */
const VALUE_WIDTH = 3;

/**
 * What the exponent character is offset by.
 *
 * The character holds `exponent + EXPONENT_BIAS` in [0, 35], so the range is
 * 1e-12 to about 9.99e23. Income spans 54/s at the opening to 9.04e9/s at 49
 * districts of megastructures, and population tops out near 7e5, so the whole
 * game sits in the middle of it with fourteen orders of magnitude of headroom
 * above and twelve below.
 */
const EXPONENT_BIAS = 12;
const EXPONENT_MAX = 35;

/** Steps a happiness character is quantised to: 0..35, one base36 digit. */
const MOOD_STEPS = 35;

/** The largest value the encoding can hold. Anything above it is pinned here. */
export const HISTORY_VALUE_MAX = 9.99e23;

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

/** One base36 digit for `n` in [0, 35]. */
const digit = (n: number): string =>
  BASE36[Math.max(0, Math.min(35, Math.round(n)))] as string;

/** The value of one base36 digit, or -1 if the character is not one. */
const digitValue = (c: string): number => BASE36.indexOf(c);

/**
 * Two base36 characters for `n` in [0, 1295].
 *
 * The mantissa is 100..999, so this never uses the top fifth of its range —
 * paying a character for the alignment is worth more than the density, because
 * a fixed width is what makes `series[i * WIDTH]` the whole of the indexing.
 */
const pair = (n: number): string => {
  const v = Math.max(0, Math.min(1295, Math.round(n)));
  return `${digit(Math.floor(v / 36))}${digit(v % 36)}`;
};

const pairValue = (a: string, b: string): number => {
  const hi = digitValue(a);
  const lo = digitValue(b);
  if (hi < 0 || lo < 0) return -1;
  return hi * 36 + lo;
};

/**
 * One value as three base36 characters: three significant figures and a decade.
 *
 * Everything that is not a positive finite number becomes zero, and zero is
 * spelled `000` — a mantissa of 0 is otherwise unreachable, since a real
 * mantissa is always 100 or more, so the code is free and unambiguous. A value
 * past the top of the range is pinned rather than wrapped: a chart that showed
 * an enormous number as a tiny one would be worse than one that showed it as the
 * largest number it can draw.
 */
export function encodeValue(v: number): string {
  if (!Number.isFinite(v)) {
    // Infinity is the one non-finite input with an honest reading: it is bigger
    // than anything, so it pins at the top. NaN has none and reads as nothing.
    return Number.isNaN(v) || v < 0 ? '000' : encodeValue(HISTORY_VALUE_MAX);
  }
  if (v <= 0) return '000';

  let exponent = Math.floor(Math.log10(v));
  let mantissa = Math.round(v / 10 ** exponent * 100);
  // The rounding can carry: 9.999 rounds to 1000, which is a decade up.
  if (mantissa >= 1000) {
    mantissa = 100;
    exponent++;
  }
  const shifted = exponent + EXPONENT_BIAS;
  if (shifted < 0) return '000';
  if (shifted > EXPONENT_MAX) return `${pair(999)}${digit(EXPONENT_MAX)}`;
  return `${pair(mantissa)}${digit(shifted)}`;
}

/** The inverse. A malformed triple reads as zero, like every other bad input. */
export function decodeValue(code: string): number {
  if (code.length !== VALUE_WIDTH) return 0;
  const mantissa = pairValue(code[0] as string, code[1] as string);
  const exponent = digitValue(code[2] as string);
  if (mantissa <= 0 || exponent < 0) return 0;
  return (mantissa / 100) * 10 ** (exponent - EXPONENT_BIAS);
}

/** Happiness as one base36 character over 0..35. A share needs nothing more. */
export const encodeMood = (v: number): string =>
  digit(Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)) * MOOD_STEPS);

export const decodeMood = (code: string): number => {
  const n = digitValue(code);
  return n < 0 ? 0 : n / MOOD_STEPS;
};

/** One reading of the city, in the units the chart draws. */
export interface HistorySample {
  readonly population: number;
  readonly income: number;
  readonly happiness: number;
}

/**
 * One tier's ring, as it sits in the save.
 *
 * Three strings, a head and a bank. `head` is where the *next* sample goes, so
 * the oldest sample is at `head` once the ring is full and at 0 while it is
 * still filling — which is exactly what `length / WIDTH < HISTORY_SAMPLES`
 * distinguishes. No count field, because the strings carry it.
 */
export interface HistoryTier {
  /** Index the next sample is written at, in [0, HISTORY_SAMPLES). */
  head: number;
  /** Simulated seconds banked toward the next sample. See the file note. */
  clock: number;
  /** Fixed-width base36, VALUE_WIDTH per sample. */
  population: string;
  income: string;
  /** One character per sample. */
  happiness: string;
}

export interface History {
  readonly fine: HistoryTier;
  readonly coarse: HistoryTier;
}

export const emptyTier = (): HistoryTier => ({
  head: 0,
  clock: 0,
  population: '',
  income: '',
  happiness: '',
});

export const emptyHistory = (): History => ({ fine: emptyTier(), coarse: emptyTier() });

/** How many samples a tier is holding. Derived from the strings, never stored. */
export const tierLength = (tier: HistoryTier): number =>
  Math.min(HISTORY_SAMPLES, Math.floor(tier.happiness.length));

/**
 * Writes one character-run at `slot`, growing the string while the ring is
 * still filling and overwriting once it is full.
 *
 * A string rather than an array because that is what the save holds, and the
 * churn is one allocation per sample per series — sixty simulated seconds
 * apart, which is nothing.
 */
function write(held: string, slot: number, code: string, width: number): string {
  const at = slot * width;
  if (at >= held.length) return held + code;
  return held.slice(0, at) + code + held.slice(at + width);
}

/**
 * Records one sample into a tier, advancing the head.
 *
 * Exported for the tests; `advance` below is what the simulation calls.
 */
export function push(tier: HistoryTier, sample: HistorySample): void {
  const slot = tier.head % HISTORY_SAMPLES;
  tier.population = write(tier.population, slot, encodeValue(sample.population), VALUE_WIDTH);
  tier.income = write(tier.income, slot, encodeValue(sample.income), VALUE_WIDTH);
  tier.happiness = write(tier.happiness, slot, encodeMood(sample.happiness), 1);
  tier.head = (slot + 1) % HISTORY_SAMPLES;
}

/**
 * Banks `dt` into a tier and spends whole intervals out of it.
 *
 * The same shape `Game.survey` uses, and step-size invariant for the same
 * reason: a 60-second catch-up step banks sixty seconds and spends every
 * interval it has bought, where a sample-per-tick would make the series depend
 * on how the loop happened to be driven.
 *
 * Bounded by the ring, because a passing tick is not worth more than one lap:
 * an absurd `dt` from a clock that jumped would otherwise spin the ring
 * thousands of times to arrive at exactly the state one lap leaves it in.
 */
export function advance(
  tier: HistoryTier,
  dt: number,
  interval: number,
  sample: HistorySample,
): number {
  tier.clock += Math.max(0, dt);
  let passes = Math.floor(tier.clock / interval);
  if (passes <= 0) return 0;
  tier.clock -= passes * interval;
  passes = Math.min(passes, HISTORY_SAMPLES);
  for (let i = 0; i < passes; i++) push(tier, sample);
  return passes;
}

/**
 * A tier's samples in the order they happened, oldest first.
 *
 * Allocating, and deliberately the HUD's rather than the simulation's: nothing
 * in `sim/` reads a chart back. The chart asks for this when the Graphs tab is
 * open and not otherwise.
 */
export function readTier(tier: HistoryTier): HistorySample[] {
  const held = tierLength(tier);
  const out: HistorySample[] = [];
  // While the ring is still filling the oldest sample is at 0; once it has
  // wrapped, the oldest is whatever `head` is about to overwrite.
  const start = held < HISTORY_SAMPLES ? 0 : tier.head % HISTORY_SAMPLES;
  for (let i = 0; i < held; i++) {
    const slot = (start + i) % HISTORY_SAMPLES;
    out.push({
      population: decodeValue(tier.population.slice(slot * VALUE_WIDTH, slot * VALUE_WIDTH + VALUE_WIDTH)),
      income: decodeValue(tier.income.slice(slot * VALUE_WIDTH, slot * VALUE_WIDTH + VALUE_WIDTH)),
      happiness: decodeMood(tier.happiness.charAt(slot)),
    });
  }
  return out;
}

/**
 * Rebuilds a tier from untrusted JSON, or hands back an empty one.
 *
 * Every failure is the same failure — the ring is dropped — because a partly
 * believable chart is worse than no chart. What is checked: the three strings
 * are strings of the right *shape* (a whole number of samples, agreeing with
 * each other, and no longer than the ring), every character is base36, and the
 * head is inside the ring. A malformed sample inside an otherwise legal string
 * is left to `decodeValue`, which reads it as zero.
 */
export function migrateTier(raw: unknown, interval: number): HistoryTier {
  const empty = emptyTier();
  if (typeof raw !== 'object' || raw === null) return empty;
  const r = raw as Record<string, unknown>;
  const population = r['population'];
  const income = r['income'];
  const happiness = r['happiness'];
  if (typeof population !== 'string' || typeof income !== 'string' || typeof happiness !== 'string') {
    return empty;
  }
  const held = happiness.length;
  if (held > HISTORY_SAMPLES) return empty;
  if (population.length !== held * VALUE_WIDTH || income.length !== held * VALUE_WIDTH) return empty;
  if (!isBase36(population) || !isBase36(income) || !isBase36(happiness)) return empty;

  const head = Math.floor(numberOr(r['head'], 0));
  const clock = numberOr(r['clock'], 0);
  return {
    // A ring that is still filling writes at its end, whatever the save says;
    // only a full one has a head that could be anywhere.
    head: held < HISTORY_SAMPLES ? held : Math.max(0, Math.min(HISTORY_SAMPLES - 1, head)),
    // A bank past one interval would spend a sample on the first tick for time
    // that never passed.
    clock: Math.max(0, Math.min(interval, clock)),
    population,
    income,
    happiness,
  };
}

const numberOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const isBase36 = (s: string): boolean => /^[0-9a-z]*$/.test(s);

/** Rebuilds both tiers. A save with no history at all opens with empty rings. */
export function migrateHistory(raw: unknown): History {
  if (typeof raw !== 'object' || raw === null) return emptyHistory();
  const r = raw as Record<string, unknown>;
  return {
    fine: migrateTier(r['fine'], HISTORY_FINE_SECONDS),
    coarse: migrateTier(r['coarse'], HISTORY_COARSE_SECONDS),
  };
}

/**
 * Which tier the chart is showing.
 *
 * View state as far as the HUD is concerned, but the *name* belongs here with
 * the intervals it selects between, so the panel and the ring cannot disagree
 * about what "coarse" means.
 */
export type HistoryTierKey = 'fine' | 'coarse';

export const HISTORY_INTERVALS: Record<HistoryTierKey, number> = {
  fine: HISTORY_FINE_SECONDS,
  coarse: HISTORY_COARSE_SECONDS,
};

/** What the toggle calls each tier, and the span each one covers. */
export const HISTORY_TIER_LABELS: Record<HistoryTierKey, string> = {
  fine: '2 hours',
  coarse: '60 hours',
};

/** One tier of a state's history, by key. */
export const tierOf = (s: Readonly<GameState>, key: HistoryTierKey): HistoryTier =>
  key === 'fine' ? s.history.fine : s.history.coarse;
