// Short scale, up to 10^63. An exponential economy runs off the end of any
// table you care to write, so past the last one the formatter says so plainly
// rather than printing a fourteen-digit mantissa next to a suffix.
const UNITS = [
  '', 'K', 'M', 'B', 'T',
  'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
  'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'ODc', 'NDc',
  'Vg',
] as const;

/** Compact number formatting for the ledger: 9.4 -> "9.4", 12345 -> "12.3K". */
export function fmt(n: number): string {
  if (Number.isNaN(n)) return '—';
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 ? n.toFixed(1) : Math.floor(n).toString();

  let value = n;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }

  // Repeated division drifts: 1e33 lands on 999.9999999999999, which rounds to
  // the literal string "1000.0No". Promote anything that would print as four
  // digits rather than let it out.
  const ROUNDS_UP = 999.95;
  if (value >= ROUNDS_UP && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  if (value >= ROUNDS_UP) return n.toExponential(2).replace('e+', 'e');

  return value.toFixed(value < 10 ? 2 : 1) + UNITS[unit];
}

/** Whole counts never want a decimal: 1 -> "1", 12345 -> "12.3K". */
export function fmtInt(n: number): string {
  return n < 1000 ? Math.floor(n).toString() : fmt(n);
}

/** "6h 12m" — used by the offline-progress report. */
export function fmtDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
