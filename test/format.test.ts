import { describe, expect, it } from 'vitest';
import { fmt, fmtDuration, fmtInt } from '../src/core/format';

describe('fmt', () => {
  it('keeps a decimal on small change and drops it on large', () => {
    expect(fmt(0)).toBe('0.0');
    expect(fmt(9.44)).toBe('9.4');
    expect(fmt(999)).toBe('999');
  });

  it('steps through the short scale', () => {
    expect(fmt(1_000)).toBe('1.00K');
    expect(fmt(12_345)).toBe('12.3K');
    expect(fmt(1e9)).toBe('1.00B');
    expect(fmt(1e33)).toBe('1.00Dc');
  });

  it('never runs off the end of its own unit table', () => {
    // 1.14 ** 3185 is reachable: the last home on the last plot of a full city.
    for (const n of [1e66, 1e100, 1.14 ** 3185, Number.MAX_VALUE]) {
      const text = fmt(n);
      expect(text).not.toContain('undefined');
      expect(text.length).toBeLessThan(12);
    }
    expect(fmt(1e66)).toBe('1.00e66');
  });

  it('handles the values that break naive formatters', () => {
    expect(fmt(Infinity)).toBe('∞');
    expect(fmt(NaN)).toBe('—');
    expect(fmt(-1500)).toBe('-1.50K');
  });

  it('formats whole counts without a decimal', () => {
    expect(fmtInt(1)).toBe('1');
    expect(fmtInt(999)).toBe('999');
    expect(fmtInt(12_345)).toBe('12.3K');
  });
});

describe('fmtDuration', () => {
  it('reads the way a person would say it', () => {
    expect(fmtDuration(45)).toBe('45s');
    expect(fmtDuration(90)).toBe('1m 30s');
    expect(fmtDuration(3600 * 6 + 60 * 12)).toBe('6h 12m');
    expect(fmtDuration(-5)).toBe('0s');
  });
});
