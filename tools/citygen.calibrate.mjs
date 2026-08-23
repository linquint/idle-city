/**
 * Measures the raw distribution of buildable plots per district, before
 * rejection sampling narrows it. TARGET_PLOTS in src/sim/config.ts is the
 * median this prints; do not set it from a guess.
 *
 *   node tools/citygen.calibrate.mjs [samples]
 */
import { generateAttempt, generateDistrict, MAX_ATTEMPTS } from '../src/sim/citygen.ts';
import { DISTRICT_SPAN, TARGET_PLOTS, ZONE_SHARE } from '../src/sim/config.ts';

const SAMPLES = Number(process.argv[2] ?? 1000);
const seedOf = (i) => (0x9e3779b9 + i * 2654435761) | 0;

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  return {
    min: s[0],
    median: s[s.length >> 1],
    max: s[s.length - 1],
    mean: +mean.toFixed(2),
    stddev: +sd.toFixed(2),
  };
};

const raw = [];
const histogram = new Map();
for (let i = 0; i < SAMPLES; i++) {
  const { buildable } = generateAttempt(seedOf(i));
  raw.push(buildable);
  histogram.set(buildable, (histogram.get(buildable) ?? 0) + 1);
}

console.log(`district span ${DISTRICT_SPAN}, ${SAMPLES} seeds\n`);
console.log('raw buildable plots per district (no rejection sampling)');
console.log(' ', JSON.stringify(stats(raw)));
console.log('  histogram:');
for (const [plots, n] of [...histogram].sort((a, b) => a[0] - b[0])) {
  const pct = ((n / SAMPLES) * 100).toFixed(1);
  console.log(`    ${String(plots).padStart(3)}  ${String(n).padStart(4)}  ${pct.padStart(5)}%  ${'#'.repeat(Math.round(n / SAMPLES * 60))}`);
}

// First-try acceptance and convergence, at the target the constant is set to.
const attempts = [];
let firstTry = 0;
let worst = 0;
const t0 = performance.now();
for (let i = 0; i < SAMPLES; i++) {
  const { attempts: n } = generateDistrict(seedOf(i));
  attempts.push(n);
  if (n === 1) firstTry++;
  worst = Math.max(worst, n);
}
const ms = performance.now() - t0;

console.log(`\nrejection sampling at TARGET_PLOTS = ${TARGET_PLOTS} (tolerance 0)`);
console.log(' ', JSON.stringify(stats(attempts)), 'attempts');
console.log(`  first try:      ${((firstTry / SAMPLES) * 100).toFixed(1)}%`);
console.log(`  worst case:     ${worst} attempts (cap ${MAX_ATTEMPTS})`);
console.log(`  within 8:       ${((attempts.filter((a) => a <= 8).length / SAMPLES) * 100).toFixed(2)}%`);
console.log(`  per district:   ${(ms / SAMPLES).toFixed(3)} ms`);

const budget = (share) => Math.round(TARGET_PLOTS * share);
console.log(
  `\nzone budget at ${TARGET_PLOTS} plots: R ${TARGET_PLOTS - budget(ZONE_SHARE.commercial) - budget(ZONE_SHARE.industrial)}` +
    ` / C ${budget(ZONE_SHARE.commercial)} / I ${budget(ZONE_SHARE.industrial)}`,
);
