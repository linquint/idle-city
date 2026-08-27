/**
 * Measures what centrality does to rent, so LAND_VALUE_SPREAD can be set from
 * numbers rather than from a feel. Same contract as the other calibrators: it
 * prints, it does not assert, and what it prints belongs in the config comments.
 *
 * Three questions, and the third is the one that bounds the constant.
 *
 *   - what the spread *is*: the distribution of centrality over the housing
 *     plots a city actually sells, and the rent multiplier that follows from it
 *     at a range of candidate spreads. This is what the inspector will show;
 *   - whether it is really a redistribution: the mean multiplier over a fully
 *     built city has to be exactly 1, or RENT, HOME_BASE and the first tier's
 *     capacity are all re-opened;
 *   - how lumpy it makes the ledger. The build order is shuffled inside a
 *     district, but the plots offered *first* are systematically off-centre, so
 *     the running mean starts below the normaliser and climbs to it. That swing
 *     is a change in the whole city's income arriving for reasons no bar in the
 *     HUD shows, against a demand loop calibrated on flat rent — and it is what
 *     keeps the spread small.
 *
 *   node tools/landvalue.calibrate.mjs
 */
import { LAND_VALUE_SPREAD } from '../src/sim/config.ts';
import {
  BUILDABLE_RESIDENTIAL_PER_DISTRICT,
  housingCentrality,
  housingCentralityBase,
  housingCentralityMean,
} from '../src/sim/layout.ts';

/** District counts to read the field at: one, the port's, and the whole map. */
const SIZES = [1, 4, 12, 25, 49];
/** Candidate spreads, from "nobody would notice" to "the rim is a slum". */
const SPREADS = [0.2, 0.4, 0.8, 1.6];

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const signed = (n) => `${n >= 0 ? '+' : '-'}${(Math.abs(n) * 100).toFixed(1)}%`;

/** Every housing plot's centrality, for a city of `districts`. */
function scores(districts) {
  const n = districts * BUILDABLE_RESIDENTIAL_PER_DISTRICT;
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = housingCentrality(i, districts);
  return out;
}

console.log(`land value at spread ${LAND_VALUE_SPREAD}\n`);

console.log('the field: centrality over the housing plots a city sells');
console.log('  districts   plots    mean     min     max      sd');
for (const districts of SIZES) {
  const c = scores(districts);
  const base = housingCentralityBase(districts);
  const sd = Math.sqrt(c.reduce((a, v) => a + (v - base) ** 2, 0) / c.length);
  console.log(
    `  ${String(districts).padStart(9)}${String(c.length).padStart(8)}` +
      `${base.toFixed(4).padStart(8)}${Math.min(...c).toFixed(3).padStart(8)}` +
      `${Math.max(...c).toFixed(3).padStart(8)}${sd.toFixed(4).padStart(8)}`,
  );
}
console.log('');

/**
 * What each candidate spread is worth on a plot, read on the full map — which
 * is the widest the field ever gets, so it bounds every smaller city too.
 */
{
  const districts = 49;
  const c = scores(districts);
  const base = housingCentralityBase(districts);
  const sd = Math.sqrt(c.reduce((a, v) => a + (v - base) ** 2, 0) / c.length);
  console.log('per plot, at 49 districts: what the inspector would say');
  console.log('  spread   worst plot   best plot     typical');
  for (const spread of SPREADS) {
    console.log(
      `  ${spread.toFixed(2).padStart(6)}` +
        `${signed(spread * (Math.min(...c) - base)).padStart(13)}` +
        `${signed(spread * (Math.max(...c) - base)).padStart(12)}` +
        `${`+-${(spread * sd * 100).toFixed(1)}%`.padStart(12)}`,
    );
  }
  console.log('');
}

/**
 * The property the whole normalisation exists for: a built-out city earns
 * exactly what flat rent earned it. Reported per size rather than asserted,
 * because this file prints — test/economy.test.ts is where it is a claim.
 */
console.log('build-out: the mean multiplier over every plot the city owns');
for (const districts of SIZES) {
  const plots = districts * BUILDABLE_RESIDENTIAL_PER_DISTRICT;
  const mean = housingCentralityMean(plots, districts);
  const base = housingCentralityBase(districts);
  console.log(
    `  ${String(districts).padStart(2)} districts   multiplier ` +
      `${(1 + LAND_VALUE_SPREAD * (mean - base)).toFixed(12)}`,
  );
}
console.log('');

/**
 * The bound. How far the running mean wanders from the normaliser as a city
 * builds out, which is how much the whole ledger moves for reasons the player
 * cannot see — and where it is worst, since the answer is "at the very start".
 */
const worstDrift = (districts, from) => {
  const plots = districts * BUILDABLE_RESIDENTIAL_PER_DISTRICT;
  const base = housingCentralityBase(districts);
  let worst = 0;
  for (let n = Math.max(1, from); n <= plots; n++) {
    const drift = housingCentralityMean(n, districts) - base;
    if (Math.abs(drift) > Math.abs(worst)) worst = drift;
  }
  return worst;
};

/**
 * Two readings, because the first plot is not the same claim as the ledger.
 *
 * "From the first plot" is what a one-home city reads and is trivially the
 * worst the number ever gets. "Past the first half-district" is the one that
 * bounds the constant: by then the city has an economy for the swing to be a
 * swing *in*, and a demand loop calibrated on flat rent to answer to.
 */
console.log('lumpiness: how far the running multiplier wanders from 1 while building out');
for (const [label, from] of [['from the first plot', 1], ['past the first 12 plots', 12]]) {
  console.log(`  ${label}`);
  for (const spread of SPREADS) {
    const cells = SIZES.map((districts) =>
      signed(spread * worstDrift(districts, from)).padStart(15),
    );
    console.log(`    spread ${spread.toFixed(2)}${cells.join('')}`);
  }
  console.log(`    ${' '.repeat(11)}${SIZES.map((d) => `${d} districts`.padStart(15)).join('')}`);
}
console.log('');

/**
 * What annexing does to housing that is already standing.
 *
 * The one honest cost of normalising against the land the city *owns* rather
 * than against a constant: the mean moves when the map does, so a district
 * built out under one normaliser is read against another. Worth a number rather
 * than a hand-wave.
 */
console.log('annexation: what district 0\'s built-out housing reads as the city grows');
{
  const plots = BUILDABLE_RESIDENTIAL_PER_DISTRICT;
  for (const districts of SIZES) {
    const mean = housingCentralityMean(plots, districts);
    const base = housingCentralityBase(districts);
    console.log(
      `  at ${String(districts).padStart(2)} districts   ` +
        `${pct(mean)} central against a ${pct(base)} city   ` +
        `multiplier ${(1 + LAND_VALUE_SPREAD * (mean - base)).toFixed(4)}`,
    );
  }
}
