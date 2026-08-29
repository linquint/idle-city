/**
 * Achievements: a record of what the city has done.
 *
 * They grant nothing. Not "nothing for now" — nothing, on purpose. Every bonus
 * in this game is a multiplier on a ledger that already compounds to 9e9/s, so
 * an achievement that paid out would be a multiplier handed to the player for
 * doing what they were going to do anyway, and the compounding would eat the
 * decision it was supposed to reward. What these are for is the other half of a
 * long idle game: a way to look back at a city and see the shape of how it got
 * here.
 *
 * Three rules, and the first is the one everything else falls out of:
 *
 *   - **a test is a pure read over `GameState` and nothing else.** No layout
 *     handed in, no renderer, no wall clock, no counter living on `Game`. That
 *     is what makes an achievement survive a reload: a save that arrives having
 *     already earned something unlocks it on its first tick, and a twelve-hour
 *     offline catch-up unlocks exactly what watching would have. A test reading
 *     a lifetime tally on the `Game` instance would silently stop working the
 *     moment the tab was closed, because those tallies start again at zero;
 *   - **the table is static and the record is bounded by it.** `unlocked` maps
 *     a key to the `elapsed` it fired at, so it holds at most one entry per row
 *     below. It grows with the *table*, never with the city — the line
 *     `LevelCohort` draws, and this stays on the right side of it;
 *   - **nothing here is read back by the simulation.** Delete the record and
 *     the city is identical. Achievements are a readout, exactly as the event
 *     log is, and the only thing that separates them is that this one persists.
 *
 * ---
 *
 * Three of the rows the brief for this feature asked for are *transitions*
 * rather than states, and cannot be written under the first rule: "survive a
 * fire with no losses", "recover a boarded-up building" and "pay for an
 * annexation without the reserve" are all things that happen at an instant and
 * leave nothing behind in the save that says they did. Testing them would mean
 * either a counter on `Game` (which does not survive a reload) or a second save
 * field per row (which is the growth this file is arranged to avoid).
 *
 * So each is written as the *state* that produces it, and named for what it
 * actually tests rather than for the event it stands in for — see `fire-held`,
 * `recovering` and `funded`. The difference is at most a tick, and the reading
 * stays honest.
 *
 * ---
 *
 * Some rows are `hidden`, and the flag changes nothing about any of the above:
 * a hidden row is tested on the same pass, records the same entry in `unlocked`
 * and grants the same nothing. What it changes is the *panel*, and only until
 * it fires — see `visibleReadings` and `achievementDenominator` for why the
 * count has to move with it rather than sit above it.
 */
import {
  CIVIC_SERVICES,
  FRONTAGE_TARGET,
  HAPPINESS_SERVICES,
  LEVELS,
  MAX_ACTIVE_FIRES,
  MAX_DISTRICTS,
  MERGE_LEVEL,
  TAX_STEPS,
} from './config.ts';
import {
  annexCost,
  coverage,
  goodsTraded,
  plotsOf,
  educationCoverage,
  hasCoast,
  isRecovering,
  powerRatio,
  powerTradeStep,
  recreationCoverage,
  taxStep,
  wouldBurnOut,
  ZONE_KINDS,
} from './economy.ts';
import type { GameState, ZoneKind } from './state.ts';

/** Which section of the panel a row belongs in. */
export type AchievementGroup = 'growth' | 'land' | 'civic' | 'money' | 'adversity';

/** The groups in the order the panel shows them, and what it calls each. */
export const ACHIEVEMENT_GROUPS: readonly { key: AchievementGroup; name: string }[] = [
  { key: 'growth', name: 'Growth' },
  { key: 'land', name: 'Land' },
  { key: 'civic', name: 'Civic' },
  { key: 'money', name: 'Money' },
  { key: 'adversity', name: 'Adversity' },
];

export interface Achievement {
  /** Stable, and it has to be: it is the key the save records. Never rename one. */
  readonly key: string;
  readonly group: AchievementGroup;
  readonly name: string;
  /** What it took, for the locked rows. Written as an instruction, not a riddle. */
  readonly note: string;
  /**
   * Whether the city has done it.
   *
   * A pure read over the state handed in. Anything else — a layout, a renderer,
   * a tally on `Game`, `Date.now()` — breaks offline catch-up and save
   * determinism, and `test/achievements.test.ts` asserts the purity by running
   * every test twice against the same frozen state.
   */
  readonly test: (s: GameState) => boolean;
  /**
   * Whether the panel shows the row before it fires.
   *
   * Optional and absent everywhere it is false, so every row that was here
   * before this existed is byte-identical to what it was — which is what keeps
   * `test/achievements.test.ts`'s "no payout" assertion able to stay a strict
   * key-set check on the ordinary rows.
   *
   * It is a *display* flag and nothing more. A hidden row is tested on the same
   * pass as every other, records the same entry in `unlocked`, is announced by
   * the same ticker line when it fires, and grants the same nothing. Once fired
   * it is an ordinary row forever: full name, full note, its timestamp, and it
   * never goes back into hiding.
   */
  readonly hidden?: true;
}

/**
 * How happy a fully covered city has to read before "Model city" fires.
 *
 * Not 1. Happiness is integrated exponentially toward its target — see
 * `happinessStep` — so it approaches 1 and never arrives, and a row testing for
 * exactly 1 would be a row nobody can ever unlock. This is one part in a hundred
 * short of the asymptote, which a covered city crosses within a few minutes of
 * its last park.
 */
export const FULL_HAPPINESS = 0.99;

/** Buildings of one zone standing at `level` or above. */
const atLeastLevel = (s: GameState, kind: ZoneKind, level: number): number => {
  const levels = kind === 'home' ? s.homeLevels : kind === 'shop' ? s.shopLevels : s.industryLevels;
  let n = 0;
  for (let l = level; l < LEVELS; l++) n += levels[l] ?? 0;
  return n;
};

/** Buildings anywhere in the city standing at `level` or above. */
const anyAtLeastLevel = (s: GameState, level: number): boolean =>
  ZONE_KINDS.some((kind) => atLeastLevel(s, kind, level) > 0);

/** Parcels merged, across every zone. */
const merges = (s: GameState): number => s.mergedR + s.mergedC + s.mergedI;

/**
 * Housing measured in plots rather than in buildings.
 *
 * The milestone rows below count land, and they have to. A count of *buildings*
 * falls when a district merges — two houses become one tower on the same two
 * plots — so a city that passed a thousand homes and then knocked its pairs
 * through would have the row taken back off it, and at the top of the ladder a
 * full 49-district map holds only 588 buildings on its 1,176 housing plots. It
 * would be a milestone the finished city could not hold.
 *
 * `plotsOf` counts a merged parcel twice, which is the same property
 * `housingPlots` and PLOTS_PER_PARK are both built on: land is what does not
 * move when the city levels, merges or empties out.
 */
const homePlots = (s: GameState): number => plotsOf(s, 'home');

/** Ruins standing, across every zone. */
const ruins = (s: GameState): number => s.abandonedR + s.abandonedC + s.abandonedI;

/**
 * The income multiplier of the harshest rate in the table.
 *
 * Read off TAX_STEPS rather than typed, so the row cannot come to mean a
 * different rate than the one the panel calls punitive if a step is ever added
 * above it.
 */
const PUNITIVE_INCOME = TAX_STEPS.reduce((top, step) => Math.max(top, step.income), 0);

/**
 * The table.
 *
 * Ordered by group and then by what it takes, so the panel reads as a ladder
 * inside each section rather than as a list. Keys are lowercase and hyphenated
 * and are the one thing here that is load-bearing — they are what `unlocked`
 * records, so renaming one silently re-locks it for every existing save.
 */
export const ACHIEVEMENTS: readonly Achievement[] = [
  // ------------------------------------------------------------------ growth
  {
    key: 'first-home',
    group: 'growth',
    name: 'Somewhere to live',
    note: 'Build the first house.',
    test: (s) => s.homes >= 1,
  },
  {
    key: 'homes-10',
    group: 'growth',
    name: 'A street',
    note: 'Build out ten plots of housing.',
    test: (s) => homePlots(s) >= 10,
  },
  {
    key: 'homes-100',
    group: 'growth',
    name: 'A neighbourhood',
    note: 'Build out a hundred plots of housing.',
    test: (s) => homePlots(s) >= 100,
  },
  {
    key: 'homes-1000',
    group: 'growth',
    name: 'A city proper',
    note: 'Build out a thousand plots of housing.',
    test: (s) => homePlots(s) >= 1000,
  },
  {
    key: 'first-merge',
    group: 'growth',
    name: 'Knocked through',
    note: 'Merge two neighbours onto one parcel.',
    test: (s) => merges(s) >= 1,
  },
  {
    key: 'first-tower',
    group: 'growth',
    name: 'Above the roofline',
    note: 'Raise anything to towers.',
    test: (s) => anyAtLeastLevel(s, MERGE_LEVEL),
  },
  {
    key: 'top-level',
    group: 'growth',
    name: 'Megastructure',
    note: 'Raise anything to the top of the ladder.',
    test: (s) => anyAtLeastLevel(s, LEVELS - 1),
  },
  {
    key: 'dormitory',
    group: 'growth',
    name: 'Nowhere to go',
    hidden: true,
    // A district's worth of housing is what the generator lays out for one —
    // read off FRONTAGE_TARGET rather than typed, so the row still means "a
    // whole district of it" if the plan ever moves.
    note: `House a district — ${FRONTAGE_TARGET.residential} plots — with not one shop or works in the city.`,
    test: (s) =>
      homePlots(s) >= FRONTAGE_TARGET.residential && s.shops === 0 && s.industry === 0,
  },

  // -------------------------------------------------------------------- land
  {
    key: 'districts-2',
    group: 'land',
    name: 'Across the tracks',
    note: 'Annex a second district.',
    test: (s) => s.districts >= 2,
  },
  {
    key: 'districts-5',
    group: 'land',
    name: 'A borough',
    note: 'Own five districts.',
    test: (s) => s.districts >= 5,
  },
  {
    key: 'districts-14',
    group: 'land',
    name: 'Metropolis',
    note: 'Own fourteen districts.',
    test: (s) => s.districts >= 14,
  },
  {
    key: 'districts-max',
    group: 'land',
    name: 'City limits',
    note: `Own all ${MAX_DISTRICTS} districts.`,
    test: (s) => s.districts >= MAX_DISTRICTS,
  },
  {
    key: 'coastal',
    group: 'land',
    name: 'Reached the water',
    note: 'Annex a district with the sea against it.',
    // A pure function of the district count and the seed, which is a pure
    // function of the state — the same thing `terminalCapacity` reads.
    test: (s) => hasCoast(s),
  },
  {
    key: 'highway',
    group: 'land',
    name: 'The road out',
    note: 'Build the highway.',
    test: (s) => s.highway,
  },
  {
    key: 'airport',
    group: 'land',
    name: 'Cleared for landing',
    note: 'Open the airport.',
    test: (s) => s.airport,
  },
  {
    key: 'first-estate',
    group: 'land',
    name: 'Out of town',
    note: 'Break ground on the first estate.',
    test: (s) => s.estates >= 1,
  },

  // ------------------------------------------------------------------- civic
  {
    key: 'first-hospital',
    group: 'civic',
    name: 'Bedside manner',
    note: 'Open the first hospital.',
    test: (s) => s.hospitals >= 1,
  },
  {
    key: 'city-hall',
    group: 'civic',
    name: 'Somebody in charge',
    note: 'Build the city hall.',
    test: (s) => s.cityHall,
  },
  {
    key: 'all-civic',
    group: 'civic',
    name: 'Full complement',
    note: 'One of every civic type standing at once.',
    // The five that share the 2x2 interleave. The university is on its own 3x3
    // list and is a different kind of thing — see `siteCapacity`.
    test: (s) =>
      CIVIC_SERVICES.every((service) =>
        service.key === 'hospital' ? s.hospitals >= 1
        : service.key === 'police' ? s.police >= 1
        : service.key === 'fire' ? s.fire >= 1
        : service.key === 'school' ? s.schools >= 1
        : s.depots >= 1,
      ),
  },
  {
    key: 'educated',
    group: 'civic',
    name: 'Taught to the last plot',
    note: 'Reach 100% education coverage.',
    test: (s) => s.homes > 0 && educationCoverage(s) >= 1,
  },
  {
    key: 'model-city',
    group: 'civic',
    name: 'Model city',
    note: 'Every service and every park covering a city at full happiness.',
    test: (s) =>
      s.homes > 0 &&
      s.happiness >= FULL_HAPPINESS &&
      recreationCoverage(s) >= 1 &&
      HAPPINESS_SERVICES.every((service) => coverage(s, service) >= 1),
  },
  {
    key: 'bread-and-circuses',
    group: 'civic',
    name: 'Bread and circuses',
    hidden: true,
    note: 'Stand a museum and a stadium in a city with no hospital in it.',
    test: (s) => s.museums >= 1 && s.stadiums >= 1 && s.hospitals === 0,
  },
  {
    key: 'brownout-export',
    group: 'civic',
    name: 'Selling what you have not got',
    hidden: true,
    note: 'Hold the export agreement while your own grid is short.',
    // `powerTradeStep` rather than `s.powerTrade`, so a city that set the
    // agreement and then lost its hall reads as being on neutral — which is
    // what it is actually running. `powerSurplus` caps the sale at zero in this
    // state, which is the joke: the agreement is signed and sells nothing.
    test: (s) => powerTradeStep(s).sells > 0 && powerRatio(s) < 1,
  },

  // ------------------------------------------------------------------- money
  {
    key: 'earned-1k',
    group: 'money',
    name: 'First thousand',
    note: 'Take 1K in lifetime earnings.',
    test: (s) => s.earned >= 1e3,
  },
  {
    key: 'earned-1m',
    group: 'money',
    name: 'First million',
    note: 'Take 1M in lifetime earnings.',
    test: (s) => s.earned >= 1e6,
  },
  {
    key: 'earned-1b',
    group: 'money',
    name: 'First billion',
    note: 'Take 1B in lifetime earnings.',
    test: (s) => s.earned >= 1e9,
  },
  {
    key: 'funded',
    group: 'money',
    name: 'Funded',
    note: 'Own more than one district with the next one already paid for.',
    // The state form of "annexed without leaning on the reserve": the city has
    // expanded and the treasury is already good for the following district. The
    // event itself — a manual annexation inside AUTO_ANNEX_RESERVE — leaves
    // nothing in the save, so this is the honest reading of it. See the note at
    // the top of this file.
    test: (s) => s.districts >= 2 && s.cash >= annexCost(s),
  },
  {
    key: 'empty-treaty',
    group: 'money',
    name: 'A treaty about nothing',
    hidden: true,
    note: 'Keep a goods agreement with nothing anywhere to export.',
    // `goodsTraded` rather than the stored flag, for the reason
    // `punitive-and-happy` reads `taxStep`: without a hall the policy is not in
    // force, and the row is about paying `tradeUpkeep` for a tap on nothing.
    test: (s) => goodsTraded(s) && s.industry === 0 && s.estates === 0,
  },

  // --------------------------------------------------------------- adversity
  {
    key: 'fire-held',
    group: 'adversity',
    name: 'Held the line',
    note: 'Have a building alight with a brigade fast enough to save it.',
    // `wouldBurnOut` is the test `resolveFires` itself makes when a fire runs
    // out its clock, so this is exactly the state in which a fire ends with the
    // building still standing — read a tick or so before it does.
    test: (s) => s.fires.length > 0 && !wouldBurnOut(s),
  },
  {
    key: 'recovering',
    group: 'adversity',
    name: 'Back in business',
    note: 'Bring a boarded-up zone back to occupancy.',
    // Same shape as `fire-held`: the state that produces the recovery, not the
    // instant the count moves.
    test: (s) => ruins(s) > 0 && ZONE_KINDS.some((kind) => isRecovering(s, kind)),
  },
  {
    key: 'punitive-and-happy',
    group: 'adversity',
    name: 'They pay it gladly',
    note: 'Run the punitive rate with happiness above 80%.',
    test: (s) => taxStep(s).income === PUNITIVE_INCOME && s.happiness > 0.8,
  },
  {
    key: 'all-boarded',
    group: 'adversity',
    name: 'Every window boarded',
    hidden: true,
    note: 'Have housing, commerce and industry all boarded up at once.',
    test: (s) => s.abandonedR > 0 && s.abandonedC > 0 && s.abandonedI > 0,
  },
  {
    key: 'fully-alight',
    group: 'adversity',
    name: 'Everything is fine',
    hidden: true,
    note: `Have all ${MAX_ACTIVE_FIRES} fires the city can hold burning at the same time.`,
    test: (s) => s.fires.length >= MAX_ACTIVE_FIRES,
  },
];

/**
 * Rows the panel shows a city that has found no secrets — the denominator a
 * fresh install counts against.
 *
 * The *visible* rows, not every row, and that is the whole of the leak. The
 * label is read constantly and is the only place in the game that states how
 * many awards exist; counting the hidden ones in it would tell a player exactly
 * how many secrets there are and — the moment the visible list is complete —
 * that they are missing some. Knowing there are two left to find is most of the
 * way to finding them, and it turns a discovery into a checklist.
 *
 * So the count only ever covers what can be worked toward, and a hidden row
 * joins it by *firing*. See `achievementDenominator`, which is what the label
 * actually reads: it is this plus the hidden rows this city has found, so the
 * fraction moves from n/27 to n+1/28 on the tick a secret lands. Both halves
 * move together, which says "you found something that was not on the list"
 * without ever saying how many more there are.
 *
 * Still `ACHIEVEMENTS.length` for a table with no hidden rows in it, which is
 * what it was before there were any.
 */
export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.filter((a) => !a.hidden).length;

/**
 * Simulated seconds between passes over the table.
 *
 * A pass per tick would be `ACHIEVEMENT_COUNT` predicates ten times a second —
 * some of them, like `model-city`, walking every happiness service — for a
 * screen nobody has open. Once a second is far finer than a player can perceive
 * on a readout with no gameplay effect, and only the rows still locked are
 * walked, so the cost falls to nothing as a city fills the table in.
 *
 * Banked on `Game` rather than in the save, unlike `surveyClock`, and the
 * difference is deliberate: the surveyor's bank decides *what the city does*, so
 * it has to be step-size invariant to the tick. This decides only when a
 * readout is refreshed. The one thing it can move is the `elapsed` an unlock is
 * stamped with, by at most this many seconds, and nothing reads that back.
 */
export const ACHIEVEMENT_TEST_SECONDS = 1;

/** How many the city has unlocked, hidden rows included once they have fired. */
export const unlockedCount = (s: GameState): number => {
  let n = 0;
  for (const achievement of ACHIEVEMENTS) {
    if (s.unlocked[achievement.key] !== undefined) n++;
  }
  return n;
};

/** Whether a row is one the panel has to show this city. */
const shows = (s: GameState, achievement: Achievement): boolean =>
  !achievement.hidden || s.unlocked[achievement.key] !== undefined;

/**
 * What the tab label counts against for *this* city.
 *
 * The visible table plus whatever secrets this city has already turned up. See
 * ACHIEVEMENT_COUNT for why it is not simply the length of the table.
 */
export const achievementDenominator = (s: GameState): number => {
  let n = ACHIEVEMENT_COUNT;
  for (const achievement of ACHIEVEMENTS) {
    if (achievement.hidden && s.unlocked[achievement.key] !== undefined) n++;
  }
  return n;
};

/** Whether one row has fired, and when. `undefined` while it is still locked. */
export const unlockedAt = (s: GameState, key: string): number | undefined => s.unlocked[key];

export interface AchievementReading {
  readonly achievement: Achievement;
  /** Simulated seconds at which it fired, or null while locked. */
  readonly at: number | null;
}

/** The whole table with its record applied, in one read. Hidden rows included. */
export const achievementReadings = (s: GameState): readonly AchievementReading[] =>
  ACHIEVEMENTS.map((achievement) => ({
    achievement,
    at: s.unlocked[achievement.key] ?? null,
  }));

/**
 * The rows the panel is allowed to draw, in table order.
 *
 * A hidden row that has not fired is *absent* rather than blanked: a greyed row
 * with its text taken out is still a row, and a player counting them knows both
 * that a secret exists and roughly where in the ladder it sits. Nothing to
 * count is the only version of hidden that holds.
 *
 * Once fired it is an ordinary reading in its ordinary place — full name, full
 * note, its timestamp — and it stays there forever, because `unlocked` is only
 * ever written to.
 */
export const visibleReadings = (s: GameState): readonly AchievementReading[] =>
  achievementReadings(s).filter((reading) => shows(s, reading.achievement));
