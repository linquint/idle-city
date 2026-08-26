/**
 * Every tunable in the game lives here. Nothing in this file imports anything,
 * so balance can be changed without touching a line of simulation or render
 * code — and the tests can assert against the same constants the game uses.
 */

/** Changing this reseeds every street layout in the game. */
export const SEED = 20260823;

/** World units per plot. */
export const CELL = 4;

/**
 * Plots per side of a district. A district is the unit of expansion.
 *
 * Widened from 12 to 13 to make room for a 3x3 university, and from 13 to 15 to
 * make room for landmarks and for the land the next few features will want.
 *
 * The 13 -> 15 step is not additive, and the measurement is the reason the span
 * moved rather than the budget being re-cut. A district's land was fully spoken
 * for at 13: over 400 on-target districts every one of the 100 plots was
 * claimed — 63 for sale, 24 civic, 9 university, 4 courtyard — with 0.00 free
 * 3x3 squares and 0.05 free 2x2s, and those 2x2s were the park courtyards. A
 * landmark could not stand anywhere without taking land from something else.
 *
 * 15 rather than 14, because 14 does not solve it either: it holds 121 plots,
 * and after a 3x3 and a 2x2 landmark site that leaves one spare plot. 15 holds
 * 144 and leaves twelve. Measured over 3,000 seeds a side, the plot count is
 * 121 at 62.1% (span 14) and 144 at 62.9% (span 15) — both stronger modes than
 * the 100 at 47.7% that span 13 sampled for, so the rejection sampler got
 * cheaper rather than dearer.
 *
 * What the step costs is commercial land, and that cost is structural rather
 * than a choice: `zoneBlocks` lays shops along block rings and a ring is
 * exactly the frontage, so the commercial count is invariant *per span* — 31 at
 * 13, 38 at 14, 45 at 15, at 100% of seeds each. There is no seed at 15 that
 * offers 31. See FRONTAGE_TARGET for the tuple that follows and for what it
 * re-opened.
 */
export const DISTRICT_SPAN = 15;

/**
 * Streets are not a fixed grid. Each axis is walked in seeded steps inside this
 * range, so blocks come out anywhere from 2x2 to 6x6. A gap of 2 would leave
 * single-plot blocks, which read as a bug rather than as a lane.
 */
export const ROAD_GAP_MIN = 3;
export const ROAD_GAP_MAX = 7;

/**
 * Buildable plots every district must end up with.
 *
 * Irregular spacing means seed A and seed B carve out different amounts of
 * land, and `homeCapacity`/`shopCapacity` multiply a single per-district
 * constant by the district count — so districts that disagree would either
 * strand plots or hand out plots that do not exist. Generation rejection-samples
 * until it hits this number exactly.
 *
 * Measured, not guessed, and re-measured for every span this has moved through.
 * The count is always a product of the two axes' non-road line counts, so it
 * takes only a handful of values. Over 3,000 raw (pre-sampling) attempts:
 *
 *   span 13   81, 90, 99, 100, 110, 121      mode 100 at 47.7%
 *   span 14   100, 110, 120, 121, 132, 144   mode 121 at 62.1%
 *   span 15   110, 120, 121, 132, 144        mode 144 at 62.9%
 *
 * 144 is therefore the cheapest target to sample for at the span the district
 * now spans, and a better mode than 100 ever was. See
 * tools/citygen.calibrate.mjs.
 */
export const TARGET_PLOTS = 144;

/**
 * What one district must offer once every reservation has taken its share.
 *
 * Every building fronts a street, so only the road-adjacent plots of a
 * district's 144 are ever for sale, and the site passes claim squares out of
 * those before housing sees them. Two 3x3s are reserved first — the university
 * and the large landmark — then every 2x2 the district still has is claimed and
 * reserved, then the three build lists are what remains. The land adds up
 * exactly:
 *
 *   24 + 45 + 13 for sale
 *    + 9 x 4  2x2 squares   (6 civic, 1 small landmark, 2 spare)
 *    + 2 x 9  3x3 squares   (1 university, 1 large landmark)
 *    + 4      courtyard parks
 *    + 4      courtyard spare
 *   = 144
 *
 * so a district carries twelve deliberately empty plots — two 2x2 squares and
 * four courtyard plots — which is the land the next few features get to use
 * without this budget being re-cut under them again.
 *
 * Measured over 20,000 street plans under exactly this reservation order, and
 * the tuple is the one the numbers picked rather than one they were fitted to:
 *
 *   - commercial frontage: 45, at 100% of seeds. Invariant per span, because
 *     `zoneBlocks` lays shops along block rings and a ring is exactly the
 *     frontage. It was 31 at span 13 and there is no seed at 15 that offers 31;
 *   - residential and industrial split the rest variably, and the 2x2 count
 *     with them. 24/45/13/9 is the most reachable tuple that holds residential
 *     at 24, at 2.63% — about 1 in 38 attempts, against the 3.28% the span-13
 *     tuple reached. At FRONTAGE_MAX_ATTEMPTS the chance of exhausting them is
 *     1.2e-6 a district.
 *
 * Residential staying at exactly 24 is the load-bearing part and the reason
 * this tuple was chosen over the four more-reachable ones above it. Coverage is
 * denominated in housing plots (see `Service.plots`), so every PLOTS_PER_*
 * constant was solved against 24 housing plots a district — moving it would
 * re-open the whole of that calibration for nothing. The land grew around
 * housing rather than under it.
 *
 * What the wider district *did* re-open is commerce and industry: 31 -> 45 and
 * 8 -> 13 plots a district, so `shopCapacity` is up 45% and `industryCapacity`
 * 62%. Everything priced or cleared against those was re-derived — SHOP_BASE,
 * SHOP_GROWTH, INDUSTRY_BASE, INDUSTRY_GROWTH, SHOP_THROUGHPUT, SUPPLY_DRAW,
 * INDUSTRIAL_OUTPUT and EXPORT_PER_DISTRICT — and each carries its own
 * measurement.
 *
 * `homeCapacity` multiplies a per-district constant by the district count, so a
 * variable split would either strand land or sell plots that do not exist. The
 * fix is the one this codebase already uses one level down: reject and reseed.
 * `districtPlanAt` samples district seeds until the district lands on the tuple
 * below. Taking the guaranteed minimum instead would not be a game.
 */
export const FRONTAGE_TARGET = {
  residential: 24,
  commercial: 45,
  industrial: 13,
  /**
   * 2x2 quads a district claims, all of them reserved before the build lists
   * are drawn. Six go to civic, one to a small landmark, and the rest are spare
   * — reserving the whole claim rather than only the squares something stands
   * on is what keeps `homeCapacity` independent of build order.
   */
  squares: 9,
  /** 2x2 civic sites per district. 6 x 4 = 24 plots, mostly dead interior. */
  civicSites: 6,
  /** 2x2 landmark sites per district, taken from the same claim. */
  landmarkSmallSites: 1,
  /** 3x3 university quads per district. Exactly one, reserved before the rest. */
  universitySites: 1,
  /** 3x3 landmark quads per district. Reserved alongside the university. */
  landmarkLargeSites: 1,
} as const;

/**
 * Zoning budget, as fractions of a district's buildable plots.
 *
 * These are not a tidy 50/30/20 and must not be "cleaned up" into one. They
 * solve the tier-0 job/worker equilibrium — 14 residents per housing plot, 8
 * jobs per commercial plot, 20 per industrial plot — so that jobs match
 * workers: 14R = 8C + 20I with R + C + I = 1, at I = 0.21. Rounding them to
 * 0.50/0.30/0.20 leaves 7.0 workers chasing 6.4 jobs and breaks the demand loop
 * the moment industry is wired into the economy.
 *
 * Re-checked at the new top when the ladder grew to five rungs, because the
 * split is solved at level 0 and every rung above it walks away from the
 * solution. The labour market clears at 25.5 residents a plot (14 /
 * WORKING_SHARE), and a plot holds 2.2 / 8.8 / 38.5 / 165 / 660 workers as it
 * climbs — so a young city is job-rich and pulls people in, and a mature one is
 * worker-rich and has to go and find them work. That arc is the design.
 *
 * A district built out at one level, measured through `demandTargets` at the
 * wider district's 24 / 45 / 13 frontage:
 *
 *   level              w/j    demand R      C      I
 *   detached housing  0.09       +1.00  -0.89  +0.41
 *   apartments        0.34       +0.34  -0.10  +0.10
 *   towers            1.56       -0.06  +0.10  +0.02
 *   arcologies        6.69       -0.15  +0.15  +0.01
 *   megastructures   26.76       -0.17  +0.16   0.00
 *
 * The fifth rung adds a hundredth of a demand point to a signal already
 * settled, which is `demandScale` doing its job: it divides by `cityScale`, so
 * the imbalance a built city can reach and the scale it is read against climb
 * together. The ratios above are therefore still the ones to solve, and they
 * did not move.
 *
 * What the rung *does* move is a mixed city. Over 24 hours the discount-chasing
 * policy — which buys housing and lets commerce lag — now pins residential at
 * -1 for 1,145 of 1,440 minutes where it pinned nothing before: it reaches
 * 146,000 residents against 74 shops. That is the surcharge doing what it is
 * for rather than a broken ratio, and it is the one thing to watch if the
 * ladder ever gains a sixth rung. See tools/economy.calibrate.mjs.
 */
export const ZONE_SHARE = {
  residential: 0.48,
  commercial: 0.31,
  industrial: 0.21,
} as const;

/** Rings of districts around the centre: 7x7 grid of districts. */
export const MAX_DISTRICTS = 49;

/**
 * Residents one *plot* of housing holds, per building level.
 *
 * The four numbers the old global rezoning tiers carried, kept exactly: a
 * level-0 house holds 4, an apartment block 16, a tower 70, an arcology 300.
 * Keeping them means every constant that was solved against those capacities —
 * RENT against the opening minute, WORKING_SHARE against the labour market —
 * still means what it meant.
 *
 * The fifth rung is 1,200, and it is the ladder's own opening ratio rather than
 * a new number: 4 -> 16 is x4, and the two above it are x4.4 and x4.3, so the
 * mean would put the top at 1,290. x4 is taken instead because the rung already
 * widens the range every demand signal is read over — DEMAND_SCALE is a
 * constant and the imbalance a built city can reach scales with this ladder, so
 * 4 -> 1,200 is a 300x spread where 4 -> 300 was 75x. Measured, the drift that
 * buys is reported against ZONE_SHARE.
 *
 * Per plot, and that qualifier is what merging cost this comment. A tower
 * covers two plots (LEVEL_FOOTPRINT), so the *building* holds 140 and the land
 * under it still holds 70 a plot. Reading these as per-building instead would
 * halve the population of every merged district. See LEVEL_HOUSING.
 *
 * This used to warn that the ladder was "the denominator of every coverage in
 * the game". It is not, and has not been since Part 0: coverage is measured
 * against housing *plots* (see `Service.plots` and `housingPlots`), so it is
 * immune to what stands on them. A denominator that climbed 4 -> 300 while the
 * civic land stayed fixed is the bug that comment was describing rather than a
 * property worth protecting. What this ladder still sets is the population,
 * and through it RENT, the labour market and every demand target.
 */
export const LEVEL_CAPACITY = [4, 16, 70, 300, 1_200] as const;

/** How many levels a building can climb through. */
export const LEVELS = LEVEL_CAPACITY.length;

/**
 * Plots a building covers at each level.
 *
 * The ones and the twos are the whole of the merging mechanic: levels 0 and 1
 * stand on a single plot, climbing to level 2 merges a building with its
 * neighbour, and everything above it grows upward on that same footprint. It
 * stops at two because two is what the land offers — see `parcelOrder` in
 * layout.ts, which carries the measurement. A [1, 1, 2, 4] ladder was measured
 * and is not buildable: a district holds 0.0 residential quads, so the fifth
 * rung takes a 2 like the two below it rather than opening a quad tier that
 * nothing could ever stand on.
 */
export const LEVEL_FOOTPRINT = [1, 1, 2, 2, 2] as const;

/**
 * The first level that stands on a merged parcel.
 *
 * Derived rather than typed, so the ladder above is the only place the shape of
 * the mechanic is stated. Promotion *to* this level is the merge; everything
 * above it grows on the footprint the merge bought.
 */
export const MERGE_LEVEL = LEVEL_FOOTPRINT.findIndex((f) => f > 1);

/**
 * Residents one *building* holds at each level: its plots times what a plot of
 * that level holds.
 *
 * Derived rather than typed for the same reason LEVEL_SCALE is: the ladder and
 * the footprint are each stated once, and a change to either cannot leave the
 * other behind.
 */
export const LEVEL_HOUSING = LEVEL_CAPACITY.map(
  (c, l) => c * (LEVEL_FOOTPRINT[l] ?? 1),
) as readonly number[];

/**
 * What a building at each level *earns*, in level-0 buildings.
 *
 * An income ladder and nothing else, and the "nothing else" is load-bearing.
 * The obvious generalisation — one ladder for capacity, jobs, trips and output
 * alike — was built and measured, and it breaks the game in two places:
 *
 *   - a level-2 shop serving 17.5x the trips means the city needs 17.5x fewer
 *     shops, so commercial land can never be filled. Measured over 24 hours,
 *     auto-develop stalled at 7 shops of 31 and 65.2% developed against a 70%
 *     annexation gate, and no policy annexed even once in a day;
 *   - jobs scaling with capacity freezes the job/worker ratio at whatever it is
 *     at level 0, which deletes the arc WORKING_SHARE is built around: young
 *     cities are job-rich and pull people in, mature ones are worker-rich and
 *     have to go and find them work.
 *
 * So levels raise what a building is worth to the ledger, and leave the number
 * of people it employs and the number of customers it serves per plot alone.
 * A district still needs more shops as its towers fill, which is what fills the
 * land, and the land filling is what makes annexation reachable.
 *
 * Derived from LEVEL_CAPACITY rather than typed out, so the two can never drift,
 * and multiplied by the footprint for the same reason LEVEL_HOUSING is: this is
 * what one *building* earns, and a merged one is standing on two plots.
 */
export const LEVEL_SCALE = LEVEL_CAPACITY.map(
  (c, l) => (c / LEVEL_CAPACITY[0]) * (LEVEL_FOOTPRINT[l] ?? 1),
) as readonly number[];

/** What the zoning readout calls a level, and the verb on the build button. */
export const LEVEL_NAMES = [
  'detached housing',
  'apartments',
  'towers',
  'arcologies',
  'megastructures',
] as const;

/**
 * What each zone calls its levels.
 *
 * Names rather than numbers, because "retail park" says what a level-2 shop is
 * and "level 2" says only that it is above level 1. Commerce and industry climb
 * the same rungs housing does and merge at the same one, so a level-2 shop is a
 * pair of shopfronts knocked together and a level-2 works is a plant that has
 * taken the yard next door — which is what these names are trying to say.
 *
 * One entry per level, and the tests assert that: a ladder with a rung the HUD
 * cannot name is a ladder the player cannot read.
 */
export const ZONE_LEVEL_NAMES = {
  home: LEVEL_NAMES,
  shop: ['corner shops', 'high street', 'retail park', 'exchange', 'trade towers'],
  industry: ['workshops', 'factory', 'plant', 'refinery', 'combines'],
} as const;

// --------------------------------------------------------------- occupancy

/**
 * Seconds for occupancy to close ~63% of the gap to its target.
 *
 * Slower than demand (25s) and than happiness (45s) on purpose: people move
 * house on a longer clock than a price moves or a mood turns. Same exponential
 * form as both, and for the same reason — it saturates at 1 for any step size,
 * so a 60-second offline catch-up step lands where 60 one-second ticks would.
 */
export const OCCUPANCY_TAU = 120;

/**
 * What share of its capacity a perfectly happy zone fills.
 *
 * Not 1. A city at literally full occupancy has no slack for anyone to move
 * into, and a bar pinned at 100% tells the player nothing. 0.92 leaves the top
 * of the gauge as headroom the demand term can reach into.
 */
export const OCCUPANCY_FULL = 0.92;

/** How far a zone's own demand can pull its occupancy target either way. */
export const OCCUPANCY_DEMAND = 0.15;



/**
 * What share of a zone stays put however bad things get.
 *
 * The occupancy twin of HAPPINESS_FLOOR, and there for the same reason it is:
 * a neglected city should feel like one that has stopped growing, not one that
 * has been switched off. Without a floor, occupancy reaches zero, residents
 * reach zero, and income reaches *exactly* zero — measured, a city that spent
 * its treasury on shops and no services ended a 24-hour run with 33 in the bank
 * and no way to earn the 130 a hospital costs. That is a soft-lock, which is
 * worse than the loss the floor is protecting against.
 *
 * 0.08 is well under OCCUPANCY_EMPTY, so the vacancy clock still runs and
 * buildings still get boarded up. What it buys is a trickle of income to climb
 * back with: 8% of a zone at the happiness floor is about 4% of peak earnings.
 */
export const OCCUPANCY_FLOOR = 0.08;

/** Below this occupancy a zone is sitting empty and starts its vacancy clock. */
export const OCCUPANCY_EMPTY = 0.25;

/**
 * The happiness at which a zone starts emptying out fast enough to rot.
 *
 * Derived rather than chosen, because it is a consequence of the other three:
 * occupancy runs linearly from OCCUPANCY_FLOOR at happiness 0 to
 * OCCUPANCY_FULL at happiness 1, so this is simply where that line crosses
 * OCCUPANCY_EMPTY. Naming it is still worth it — it is the number the HUD and
 * the tests mean by "the city is losing people" — but it must not be tuned on
 * its own or the three constants stop agreeing.
 *
 * The line used to start at a *threshold* — occupancy zero at happiness 0.30,
 * ramping up from there — and that turned out to double-count unhappiness. The
 * ledger already scales with happiness through HAPPINESS_FLOOR, so a city at
 * 0.34 happiness was earning 0.55 of its rate on 5% of its residents: 3% of
 * peak. Measured, that made the opening a 45-minute stall where the old build
 * had a two-minute one, and the tutorial the happiness gate is supposed to be
 * became a wait. A floor-plus-range keeps the mechanic — an unhappy city really
 * does lose the people in the houses it built — without charging for it twice.
 */
export const HAPPINESS_MIN_OCCUPANCY =
  (OCCUPANCY_EMPTY - OCCUPANCY_FLOOR) / (OCCUPANCY_FULL - OCCUPANCY_FLOOR);

/**
 * Seconds a zone must sit below OCCUPANCY_EMPTY before anything is written off.
 *
 * The whole difference between a dip and a decline. Five minutes is long enough
 * that a bad minute costs nothing — occupancy moves on a 120s constant, so a
 * transient cannot hold the zone under the line for anything like this long —
 * and short enough that a genuinely emptied city visibly rots.
 */
export const ABANDON_SECONDS = 300;

/**
 * Seconds for a fully vacant zone to write off its whole standing stock, and to
 * bring it all back.
 *
 * Rates rather than counts, so the pace scales with the city: a 24-home
 * district loses one home every 50 seconds, a 1,176-home one loses one a
 * second. Recovery is four times faster than decay, which is not symmetry for
 * its own sake — coming back has to feel like relief, and an idle game that
 * makes you wait as long to repair as you waited to break is one you quit.
 */
export const ABANDON_SPREAD_SECONDS = 1_200;
export const RECOVER_SPREAD_SECONDS = 300;

/**
 * Abandonments a single `catchUp` call may make, however long the absence.
 *
 * The same guard CATCHUP_MAX_LOSSES puts on fire, at three rather than one
 * because these are recoverable: a returning player can see three boarded-up
 * plots and get them back, where a building lost to fire is gone. Without it a
 * twelve-hour absence from an unhappy city returns a ruin nobody watched form.
 */
export const CATCHUP_MAX_ABANDONED = 3;

// ----------------------------------------------------------------- levelling

/**
 * The three gates a building has to pass to climb a level, all at once.
 *
 * Occupancy says the building is wanted, happiness says the city is worth
 * expanding into, and education (LEVEL_EDUCATION) says the people are trained
 * for what the next level is. Any one of them short holds the cohort still —
 * they are an AND, not a weighted score, because a weighted score would let a
 * city buy its way past a gate it has not actually cleared.
 *
 * 0.65 and 0.55 are set against what coverage a city can actually reach: a
 * fully served city with parks settles at happiness 1 and occupancy 0.92, and
 * one with the three services but no parks at 0.82 and 0.68. So the park-less
 * city still grows, slowly, and a city short of a whole service (0.60 or less)
 * does not.
 */
export const LEVEL_UP_OCCUPANCY = 0.65;
export const LEVEL_UP_HAPPINESS = 0.55;

/**
 * Seconds for a zone to promote its entire eligible stock by one level.
 *
 * A rate, like abandonment, so a big city climbs faster in absolute terms and
 * at the same pace per building. Five minutes a level and five levels to climb
 * puts a fully gated district about twenty-five minutes from detached housing
 * to megastructures — against the old rezone, which was one button and 3,000
 * cash.
 * The pacing lever moved from the treasury to the happiness panel, which is the
 * point of the change.
 */
export const LEVEL_UP_SECONDS = 300;

/**
 * Education coverage a building needs before it may climb *to* each level.
 *
 * Indexed by the level being climbed to, so level 0 asks for nothing.
 *
 * Education gates levelling and is deliberately *not* a happiness term. The
 * four happiness weights were calibrated to sum to exactly 1 last cycle, and a
 * fifth would re-open that whole calibration for nothing — coverage would buy a
 * little more income and the skyline would be unaffected. As a gate it does
 * something happiness cannot: it decides how tall the city is allowed to get.
 * Do not "tidy" it into the happiness sum.
 *
 * Measured against what the two education types can actually reach. Education
 * is land-denominated like every other coverage now (see `Service.plots`), so
 * these rungs mean the same thing at every level rather than sliding out of
 * reach as the city climbs — which is what they used to do:
 *
 *   - 0.35 to reach level 1 means the city needs a school at all. Coverage
 *     without one is zero, so the first promotion is gated on the first school;
 *   - 0.60 to reach level 2 is covered by schools alone, which is what makes
 *     schools the route through the middle of the game: 62.5% at one district,
 *     75% once the site interleave evens out;
 *   - 0.85 to reach level 3 is covered by neither type alone — schools top out
 *     at 78% and a university reaches 75% — so the top of the skyline needs the
 *     university *and* the schools already standing, which is what pooling the
 *     two in `educationCoverage` is for;
 *   - 1 to reach level 4 is education with no slack left in it. The land always
 *     holds enough to get there — a district's school and university sites
 *     between them reach 33 plots against its 24, and the ratio only improves
 *     as the interleave evens out — but it takes both types built out rather
 *     than the two buildings 0.85 needs. In a one-district city the two rungs
 *     coincide, because one school and one university are all the land has.
 */
export const LEVEL_EDUCATION = [0, 0.35, 0.6, 0.85, 1] as const;

/**
 * Cash per resident per second.
 *
 * RENT, HOME_BASE and the first tier's capacity together set how long the first
 * house takes to pay for itself, which is the single number the opening minute
 * lives or dies on. At 8 / 4 / 0.14 it is about fourteen seconds: long enough to
 * feel like a decision, short enough that nobody sits watching an empty plot.
 */
export const RENT = 0.14;

/**
 * Each shop adds this share of base income.
 *
 * Retuned with the commercial price curve below, not after it — the two are one
 * change. At 90 / 1.22 the first ten shops cost 2,579 and bought 1.80x base
 * income, which is 1,433 of treasury for each 1.0 of multiplier. At 9 / 1.18
 * those same ten shops cost 212, so leaving the bonus at 0.18 would have been a
 * twelve-fold discount on the strongest income multiplier in the game and the
 * whole opening would have collapsed into "buy shops, ignore everything else".
 * 0.05 puts the price of a multiplier back at 423 — still cheaper than it was,
 * because it should be, but a third of the way rather than a twelfth.
 *
 * Chosen by sweeping 0.03 to 0.09 against three measured targets and taking the
 * only value that clears all of them (see tools/economy.calibrate.mjs):
 *
 *   - share of income attributable to the shop multiplier, at 1h / 6h / 24h.
 *     Was 61/60/60 greedy and 57/66/68 disciplined — already over the 60% line
 *     before this change. Now 39/39/36 and 28/39/39, with auto-develop at 9%.
 *   - time to first rezone and first annex, against the pre-change build.
 *     Greedy 56.8m -> 59.8m (+5%) and 1.63h -> 1.43h (-12%); disciplined 54.8m
 *     -> 52.0m (-5%) and 1.28h -> 1.41h (+10%). All inside +-20%. At 0.07 the
 *     greedy first annex ran 25% early and at 0.09 the first rezone ran 21%
 *     early; at 0.03 the greedy first rezone ran 24% late.
 *   - no demand signal newly pinned. See the note in DEMAND_SCALE: the endgame
 *     pinning under greedy and disciplined predates this change and is a limit
 *     of a constant scale, not of the price. It got shorter, not longer.
 */
export const SHOP_BONUS = 0.05;

/** Each district past the first adds this share of base income (civic economies of scale). */
export const DISTRICT_BONUS = 0.05;

export const HOME_BASE = 8;
export const HOME_GROWTH = 1.14;

/**
 * Commerce opens a third above what a house costs and compounds at exactly the
 * same rate.
 *
 * The matched growth is what the wider district cost this pair, and it is the
 * repair rather than a simplification. A shop used to compound faster than a
 * house — 1.18 against 1.14 — which was affordable over 31 commercial plots and
 * is not over 45: measured, filling one district's commerce went from 8,409 to
 * 85,784, or 67.6x what its housing costs. The exponent is what exploded, so
 * the exponent is what was fixed, and the whole gap moved onto the base.
 *
 * What that buys is a price *order* that never inverts. A shop is 1.375 houses
 * at the first of each and at the forty-fifth, where before the ratio ran from
 * 1.13 to 8x. Curves that cross are the failure mode here: 9 / 1.11 was
 * measured first, and because it undercuts housing from the fifth building on,
 * the discount-chasing policy bought fifteen shops, four homes and no hospital,
 * then sat at 18% happiness for the rest of the day with eleven in the bank —
 * a livelock, not a stall. See test/economy.test.ts, which asserts the order at
 * every step.
 *
 * 11 rather than 9, and that is the one number set against a target rather than
 * against the curve. SHOP_BONUS is the strongest income multiplier in the game,
 * and the constant it is judged by is what ten shops cost per 1.0 of it: 1,433
 * two cycles ago, 423 after the last rebalance. At base 9 the matched curve put
 * it at 348 and the greedy livelock above followed; at 11 it is 425, which is
 * the number that was aimed at.
 *
 * Filling one district's commerce now costs 28,496 against housing's 1,269, or
 * 22.5x over 88% more plots. Commerce is the expensive half of a district by
 * *count* rather than by curve, which is a bound the plot split can be read off
 * rather than a coincidence of two exponents.
 */
export const SHOP_BASE = 11;
export const SHOP_GROWTH = 1.14;

/**
 * Industry opens dear and compounds at the same rate as everything else.
 *
 * The same repair the commercial curve took, for the same reason: a district
 * holds 13 industrial plots now against 8, and 240 / 1.2 filled them for 11,639
 * against the 3,960 the old eight cost. 120 / 1.14 fills the thirteen for 3,851
 * — the pacing the constants around it were measured against — and matching
 * HOME_GROWTH means the price order across the three zones is fixed by the base
 * alone: a house opens at 8, a shop at 11, a works at 120, and that ordering
 * holds at every building rather than up to some crossover.
 *
 * Industry being the dearest thing to start is the whole of its identity here.
 * Measured over 24 hours, every policy still builds it out — 37 under
 * auto-develop, 65 greedy — so the demand loop is still what gates the zone
 * rather than the price.
 */
export const INDUSTRY_BASE = 120;
export const INDUSTRY_GROWTH = 1.14;

/**
 * Each industrial building adds this share of base income.
 *
 * Lower than SHOP_BONUS on purpose: industry's real payoff is the jobs it
 * creates and therefore the residential demand it unlocks. A type that earned
 * nothing at all and was not civic would simply never be worth a plot.
 */
export const INDUSTRY_BONUS = 0.11;

export const ANNEX_BASE = 60_000;
export const ANNEX_GROWTH = 3.4;

/**
 * You must have built out this share of your land before the city annexes more.
 *
 * Left at 0.7 through the change that made annexation automatic, and measured
 * rather than assumed. Demand-neutral build-out, holding every home at one
 * level — a player who never buys into a surcharge. Re-measured through the
 * land-denominated coverage, the fifth level and the wider district:
 *
 *                    span 13   span 15
 *   detached housing   69.6%     64.2%
 *   apartments         68.6%     67.4%
 *   towers             67.1%     69.3%
 *   arcologies         65.7%     69.7%
 *   megastructures        —      69.1%
 *
 * Every rung sat under the gate before and every rung still does, so this is the
 * shape rather than a regression: a demand-neutral player does not annex. The
 * top three rungs sit closer to it than they did, which is the wider district's
 * extra commercial land counting on both sides of the ratio.
 *
 * Annexation in an actual run got slower, and it is worth stating plainly rather
 * than tuned away: a district is 44% bigger, so filling one to the gate takes
 * 62 buildings rather than 49. Auto-develop's first annex moved 1.25h -> 1.63h
 * and the discount-chasing policy's 2.46h -> 4.91h, both against a run that
 * still reaches 5 and 9 districts inside a day. ANNEX_BASE is the lever if that
 * ever needs pulling back.
 *
 * It is deliberate: a city of towers is worker-rich, its residential demand
 * runs negative, and filling the last of its housing means paying the surcharge
 * to do it. Expansion past the middle game is a decision rather than a
 * formality.
 *
 * Raising it is the obvious response and the wrong one — 0.8 would put three of
 * the four levels under. Lowering it to 0.65 would clear all four and is the
 * lever to reach for if the endgame ever wants to expand on its own; the reason
 * it is not pulled here is that "the endgame costs something" is the intended
 * shape, and ANNEX_BASE is the pacing lever. See tools/economy.calibrate.mjs.
 */
export const ANNEX_MIN_OCCUPANCY = 0.7;

/**
 * How much more than the price the city wants in hand before it expands itself.
 *
 * The whole difference between the automatic pass and the button. Annexation
 * spends the treasury, and a city that emptied it the instant it could afford
 * to would leave a returning player unable to buy anything at all. Waiting for
 * a quarter again on top means the automatic pass only fires out of surplus,
 * and the button is there for a player who has looked at the number and wants
 * the land now — which is what "manual override" is actually for.
 */
export const AUTO_ANNEX_RESERVE = 0.25;

/**
 * Districts a single `catchUp` call may annex, however long the absence.
 *
 * The same guard fire and abandonment already have, and the one that matters
 * most here: a twelve-hour absence with a full treasury would otherwise chain
 * -annex, and the player would come back to a city several times the size of
 * the one they left with no memory of any of it happening. Two is enough to
 * feel like the city got on with things and few enough to still recognise.
 */
export const CATCHUP_MAX_ANNEXES = 2;

/** Starting treasury. */
export const START_CASH = 40;

/**
 * Seconds in one day/night cycle.
 *
 * Eight minutes, and driven by `elapsed` rather than by a clock of its own, so
 * the time of day is already in the save and already advances through
 * `catchUp` — come back after an hour away and the sun has moved seven and a
 * half days, exactly as if you had watched. A cycle short enough to see all of
 * inside one session, long enough that midday is not a strobe.
 */
export const DAY_SECONDS = 480;

/** Simulation ticks per second, independent of frame rate. */
export const TICK_RATE = 10;

/** Offline earnings stop accruing past this many hours away. */
export const OFFLINE_CAP_SECONDS = 12 * 3600;

/**
 * Seconds of simulated time per catch-up step.
 *
 * Demand is a feedback loop now, so the step size is no longer free. The old
 * `credited / 24` put 1800 seconds in a step at the 12-hour cap: the smoothing
 * below survives that, but auto-development would then compound against a
 * demand curve that had already jumped to its asymptote, buying a whole city
 * against a signal that in real time would have moved under it. 60s is well
 * inside DEMAND_TAU, so the curve the away city develops against is the one the
 * player would have watched.
 */
export const CATCHUP_STEP_SECONDS = 60;

/**
 * Backstop on the loop above. At the 12-hour cap the fixed step needs 720
 * iterations; this leaves headroom without letting a raised cap turn a return
 * from holiday into a frozen tab.
 */
export const CATCHUP_MAX_STEPS = 1_024;

// -------------------------------------------------------------- demand model

/**
 * Seconds for a demand signal to close ~63% of the gap to its target.
 *
 * The signal is integrated, not derived, which is the whole point: the order
 * you build in matters because the city takes time to notice. 25s is roughly
 * two purchases at the opening pace — long enough that spamming one button
 * runs into its own surcharge before the discount catches up, short enough that
 * a player watching the trend arrow is not waiting on a minute-long lag.
 */
export const DEMAND_TAU = 25;

/**
 * The imbalance, in people or trips, at which a demand signal saturates.
 *
 * The labour pool of one district built out at ZONE_SHARE's own design point:
 * 43 residential plots x 14 workers. "Saturated" therefore means "a whole
 * district out of balance" rather than an arbitrary number, and the constant
 * stays derived from the same equilibrium the zoning budget is.
 *
 * Measured over 24 hours: nothing pins under idle or auto-develop, and
 * auto-develop ends at R +0.57 / C -0.02 / I -0.02 — lively, and well short of
 * the bounds.
 *
 * Not a constant scale, and this is the constant it is built out of rather than
 * the scale itself: `demandScale` multiplies it by `cityScale`, the mean
 * LEVEL_SCALE a housing plot carries. The imbalance a built city can reach
 * scales with the level ladder, which now spans 4 to 1,200 residents a plot —
 * 300x — and no single constant covers that: a scale set for megastructures
 * would leave the opening hour flat, and one set for the opening pins
 * everything above towers. Dividing by the size term is what keeps one number
 * meaningful at both ends, and it is why the fifth rung moved a built-out
 * district's demand by 0.01. See ZONE_SHARE for the measurement, and
 * tools/economy.calibrate.mjs for the runs.
 */
export const DEMAND_SCALE = 300;

/**
 * Share of residents in the labour force.
 *
 * ZONE_SHARE solves 14R = 8C + 20I for *workers* per residential plot, so the
 * labour market clears when tier capacity x WORKING_SHARE = 14 — that is, at
 * about 25 residents a plot, partway between apartments (16) and towers (70).
 * Below it the city is job-rich and residential demand runs positive; above it
 * worker-rich and it runs negative. That arc is deliberate: young cities pull
 * people in, mature ones have to go and find them work.
 */
export const WORKING_SHARE = 0.55;

/** Jobs per built plot. The two numbers ZONE_SHARE was derived from. */
export const JOBS_PER_COMMERCIAL = 8;
export const JOBS_PER_INDUSTRIAL = 20;

/**
 * What one commercial or industrial *building* is worth to the labour market
 * and to the goods cycle at each level.
 *
 * The commerce-and-industry answer to LEVEL_CAPACITY, and the ladder is the
 * footprint rather than the income scale. That is not a shortcut; it is the only
 * ladder that survives the two measurements in LEVEL_SCALE. Scaling trips with
 * *capacity* means a level-2 shop serves 17.5x the trade, the city needs 17.5x
 * fewer shops, commercial land can never be filled and the annexation gate can
 * never be reached — measured, auto-develop stalled at 7 shops of 31. Scaling
 * with footprint says the honest thing instead: a retail park is two shopfronts
 * knocked together, so it employs two shopfronts' worth and serves two
 * shopfronts' worth of trips.
 *
 * The consequence worth stating plainly, because it is what keeps ZONE_SHARE
 * true: jobs, trips, supply and output are all constant *per plot* at every
 * level. Merging changes how many buildings a district holds and never how much
 * land they cover, so the tier-0 equilibrium 14R = 8C + 20I is the equilibrium
 * at every level, not just the first. What levels buy commerce and industry is
 * LEVEL_SCALE — a retail park earns 17.5x a corner shop's keep per plot — and
 * the land still fills, which is the pair of things the old build could not have
 * at once.
 */
export const SHOP_JOBS = LEVEL_FOOTPRINT.map((f) => JOBS_PER_COMMERCIAL * f) as readonly number[];
export const INDUSTRY_JOBS = LEVEL_FOOTPRINT.map(
  (f) => JOBS_PER_INDUSTRIAL * f,
) as readonly number[];

/**
 * Shopping trips generated per resident, against trips one shop can serve.
 *
 * Calibrated so commerce clears at the *frontage* a district actually sells,
 * which is what the wider district moved. The labour market clears at 25.5
 * residents a housing plot (see WORKING_SHARE), so a district's 24 housing
 * plots hold 612 residents and generate 306 trips — and its 45 commercial plots
 * serve 45 x 7 = 315. It was 31 plots x 11 = 341 against the same 306.
 *
 * Throughput fell rather than spend rising because that is what the extra land
 * means: a district with 45 shops in it has smaller shops, not richer
 * residents. The point is that the land budget and the demand model agree about
 * what a finished district looks like — otherwise the annexation gate asks for
 * plots the demand model is surcharging.
 */
export const SPEND_PER_RESIDENT = 0.5;
export const SHOP_THROUGHPUT = 7;

/** Trips one shop serves at each level. Per plot, as SHOP_JOBS explains. */
export const SHOP_TRIPS = LEVEL_FOOTPRINT.map((f) => SHOP_THROUGHPUT * f) as readonly number[];

/**
 * Goods one shop pulls from industry, against what one industrial plot makes.
 *
 * Left alone across the wider district, and measured rather than assumed to be
 * safe. Industry is structurally *under*supplied against the demand its shops
 * and the export tap generate, which is what keeps industrial demand positive
 * and industry worth building: at span 13 a district's supply covered 36% of
 * its draw (8 plots x 9 against 31 shops x 4 plus 74 of export), and at span 15
 * it covers 46% (13 x 9 against 45 x 4 plus 74). The ratio moved toward balance
 * rather than away from it, so the term needed no retune — see
 * tools/economy.calibrate.mjs, where industrial demand pins under no policy.
 */
export const SUPPLY_DRAW = 4;
export const INDUSTRIAL_OUTPUT = 9;

/** Goods one shop draws and one works makes, per level. Per plot, as above. */
export const SHOP_SUPPLY = LEVEL_FOOTPRINT.map((f) => SUPPLY_DRAW * f) as readonly number[];
export const INDUSTRY_OUTPUT = LEVEL_FOOTPRINT.map(
  (f) => INDUSTRIAL_OUTPUT * f,
) as readonly number[];

/**
 * The external tap on industrial demand.
 *
 * Without it a fresh save sits at zero demand everywhere with nothing to
 * bootstrap from: no residents means no shoppers, no shops means no jobs, and
 * the cycle never starts. It grows with annexed land and with nothing else.
 *
 * Deliberately not with elapsed time. A tap that grew on the clock would make
 * every demand target a moving one, and the step-size invariance that makes
 * offline catch-up safe would then only hold to the accuracy of the tap — the
 * property worth testing is the integrator's, not the target's. It would also
 * leave a parked city drifting into a permanent industrial discount.
 */
export const EXPORT_BASE = 60;
export const EXPORT_PER_DISTRICT = 14;

// ------------------------------------------------------------------- pricing

/**
 * How far demand may move a price, as a fraction of the compounded base.
 *
 * These being *constants* is the guardrail the whole price model rests on. The
 * floor stays base x growth**n x (1 - PRICE_DISCOUNT_MAX), which is still
 * exponential in n, so no amount of demand can make the next building cheaper
 * than the last. Let the discount scale with anything unbounded, or let it
 * reach 1, and the curve inverts and the city builds itself for free.
 *
 * The surcharge is deliberately the larger of the two: it is what stops
 * "press whichever button is cheapest" from being the dominant strategy.
 *
 * The band between them, (1 + surcharge) / (1 - discount), is 2.9 — nine homes,
 * six shops or six works of compounding. That is the most a demand swing can
 * ever be worth, and it is deliberately smaller than the run of buildings it
 * takes to move demand that far.
 */
export const PRICE_DISCOUNT_MAX = 0.45;
export const PRICE_SURCHARGE_MAX = 0.6;

// ------------------------------------------------------------------ services

export interface Service {
  /** Matches the GameState counter, the staffing scalar and the coverage key. */
  readonly key: 'hospital' | 'police' | 'fire' | 'school' | 'university' | 'transit';
  readonly name: string;
  readonly buildLabel: string;
  /** How the HUD names this service's coverage when it is the binding one. */
  readonly coverLabel: string;
  /**
   * Housing *plots* one of these covers, once it is fully staffed.
   *
   * Land, not people, and that is the repair Part 0 of this cycle was. Coverage
   * used to divide by residents, and residents per plot climb 4 -> 300 as
   * buildings level while civic land stays at six 2x2 sites a district split
   * five ways — about 1.2 buildings of each type, forever. Need scaled with
   * density and supply scaled with land, so the gap opened as the player
   * succeeded: a city with every housing plot at the top level and every
   * service built to the cap the land allows reached 34% happiness at 1
   * district and 34% at 25, and could never reach 40% at any size.
   *
   * The repo had already solved this once for parks and written down why — see
   * PLOTS_PER_PARK. Housing plots are the denominator that survives, because
   * they do not move for levels (a merged tower stands on the two plots its
   * pair held), for merges (`plotsOf` counts a merged parcel twice) or for
   * occupancy (a boarded-up house still holds its land).
   *
   * See `coverage` in economy.ts for why the denominator is the housing plots
   * the city has *developed* rather than the 24 a district owns.
   */
  readonly plots: number;
  readonly base: number;
  /** Price growth per building. Steeper for the one that is a landmark. */
  readonly growth: number;
  /**
   * Share of the happiness score, or 0 for the two that gate levels instead.
   *
   * The three that are non-zero sum to 1 with RECREATION_WEIGHT and must go on
   * doing so. Education is deliberately not among them — see LEVEL_EDUCATION.
   */
  readonly weight: number;
  /** Plots per side of the site this stands on. */
  readonly span: 2 | 3;
}

/**
 * Civic buildings earn nothing at all. They gate: coverage feeds happiness,
 * happiness multiplies income, caps residential demand and stops housing
 * outright below HAPPINESS_MIN_BUILD — or, for the two education types, it
 * decides how tall the city is allowed to build.
 *
 * Five of the six stand on a 2x2 site, of which a district has six, so those
 * types share 1.2 buildings a district. The university is the exception: its own
 * 3x3 site, exactly one to a district, which is what makes it a landmark rather
 * than another row in the panel.
 *
 * A city that never builds one still works, it just runs at the floor and never
 * gets past detached housing — neglect reads as a ceiling on what the city can
 * become, not as a punishment for playing.
 *
 * ---
 *
 * The `plots` column is what Part 0 of this cycle re-derived, and it is derived
 * rather than picked. Two numbers set it: 1.2 sites of each 2x2 type per
 * district, against 24 housing plots per district. A type whose every allowed
 * building is standing therefore covers `1.2 x plots / 24` of the city, so
 * `plots = 20` is exactly full coverage and exactly half coverage at half the
 * buildings. That is the hospital, and it is the anchor.
 *
 * The other two happiness services come off the weight ordering rather than
 * being chosen: `plots_i = 20 x w_hospital / w_i`, so a service worth less to
 * happiness needs less of the city's civic land to satisfy. That reproduces the
 * ordering the old `capacity` column had — 900 / 1200 / 1500 is within 8% of
 * inverse-proportional to 0.34 / 0.26 / 0.22 — and the slack it leaves police
 * and fire is what the one-district city needs: the six sites interleave
 * 2/1/1/1/1, so at one district police and fire have a single building each
 * against 24 plots and would read 83% and 87% at the hospital's 20.
 *
 * `serviceAllowed` then does the rest of the work, and it is why the three do
 * not have to be equal to read alike: the allowance is `need + 1` clamped by the
 * land, so a service with more reach per building is simply allowed fewer of
 * them. Measured over every district count from 1 to MAX_DISTRICTS with every
 * allowed building standing and staffed, the worst reading of any of the three
 * is 100%; at half the allowed buildings they average 53% / 55% / 55%. See
 * test/services.test.ts, which asserts the >= 95% floor so a later change to the
 * site interleave cannot quietly reopen the ceiling.
 */
export const SERVICES: readonly Service[] = [
  { key: 'hospital',   name: 'Hospitals',   buildLabel: 'Open hospital',       coverLabel: 'Health coverage',    plots: 20, base: 130,    growth: 1.35, weight: 0.34, span: 2 },
  { key: 'police',     name: 'Police',      buildLabel: 'Open police station', coverLabel: 'Police coverage',    plots: 26, base: 210,    growth: 1.35, weight: 0.26, span: 2 },
  { key: 'fire',       name: 'Fire',        buildLabel: 'Open fire station',   coverLabel: 'Fire coverage',      plots: 31, base: 320,    growth: 1.35, weight: 0.22, span: 2 },
  /**
   * Schools take the fourth slot in the 2x2 interleave, and 15 is the only
   * integer that keeps LEVEL_EDUCATION's design intact at both ends of the map.
   * Schools alone have to clear the 0.60 rung and miss the 0.85 one, at one
   * district (a single school against 24 plots, so plots/24) and at scale (1.2
   * schools against 24, so 1.2 x plots/24). That is plots in [14.4, 20.4) and
   * [12, 17): 15 or 16, and 15 leaves the wider margin under 0.85.
   *
   * Measured: schools alone read 62.5% at 1 district, 62.5% at 2 and 3, 78% at
   * 4 and 75% from 10 up — through the middle of LEVEL_EDUCATION everywhere,
   * and never at its top.
   */
  { key: 'school',     name: 'Schools',     buildLabel: 'Open school',         coverLabel: 'School coverage',    plots: 15, base: 180,    growth: 1.35, weight: 0,    span: 2 },
  /**
   * The transit depot: the fifth 2x2 type, and the first civic building in the
   * game that *earns*.
   *
   * Every other civic building gates — coverage feeds happiness, or it decides
   * how tall the city may build — and a reader who has learned that rule will
   * assume this one gates too. It does not: it takes fares, it raises the
   * labour a district can reach, and it carries no happiness weight at all.
   * See FARE_PER_RIDER and TRANSIT_WORKFORCE for the two, and the weight of 0
   * below for the third: the four happiness weights were calibrated to sum to
   * exactly 1 two cycles ago, and a fifth would re-open that calibration to buy
   * something transport already has two better routes to.
   *
   * 24 against a hospital's 20: a network reaches further than a building, and
   * "a district that has bought one depot should feel covered by it" is now
   * exactly what the number says — one depot, 24 plots, the 24 plots of a
   * district. The 2,200 residents this used to read stated the same intent
   * against a denominator that moved 75x under it.
   */
  { key: 'transit',    name: 'Transit',     buildLabel: 'Open depot',          coverLabel: 'Transit coverage',   plots: 24, base: 260,    growth: 1.35, weight: 0,    span: 2 },
  /**
   * Three quarters of a district's housing taught by one building, on nine
   * plots, one to a district, at forty times a school's opening price and
   * compounding half again as fast.
   *
   * It used to say "five schools' worth of teaching", and against a residents
   * denominator that was true — 3,500 against 700. Against land it is not, and
   * it must not be: there are 1.2 school sites to a district and exactly one
   * university site, so a university worth five schools would reach 75 plots,
   * three districts of housing, and education would be a thing you bought once.
   *
   * 18 is what the pool needs instead. `educationCoverage` sums schools and
   * universities, so neither type alone clears LEVEL_EDUCATION's top rung —
   * schools reach 62.5-78%, a university 75% — and together they always do.
   * The top of the skyline is still the university's to unlock; what changed is
   * that it unlocks it alongside the schools rather than instead of them.
   */
  { key: 'university', name: 'Universities', buildLabel: 'Found university',   coverLabel: 'University coverage', plots: 18, base: 7_200, growth: 1.9,  weight: 0,    span: 3 },
];

/** The three that feed happiness. Their weights and RECREATION_WEIGHT sum to 1. */
export const HAPPINESS_SERVICES: readonly Service[] = SERVICES.filter((s) => s.weight > 0);

/** The two that feed education, which gates levelling rather than happiness. */
export const EDUCATION_SERVICES: readonly Service[] = SERVICES.filter(
  (s) => s.key === 'school' || s.key === 'university',
);

/** The five that share the 2x2 civic sites, in interleave order. */
export const CIVIC_SERVICES: readonly Service[] = SERVICES.filter((s) => s.span === 2);

/** Civic buildings compound like everything else, and faster than housing. */
export const CIVIC_GROWTH = 1.35;

/**
 * Seconds for a new civic building to reach full effect.
 *
 * A hospital covers nobody the instant its roof goes on; it hires. Without the
 * ramp, opening one snaps happiness — and therefore income and the whole
 * residential demand ceiling — inside a single tick, which reads as a bug
 * rather than as a service opening. 90s is long enough to see and short enough
 * that the purchase still feels like it did something.
 *
 * Staffing is stored per *type*, not per building, and re-averaged when one
 * lands: a fifth hospital drops the type's staffing to 4/5. That is the honest
 * average, so the four already running keep their cover and only the new one
 * ramps — coverage holds and climbs rather than stepping down.
 */
export const CIVIC_RAMP_SECONDS = 90;

/**
 * Seconds for happiness to close ~63% of the gap to its coverage.
 *
 * The staffing ramp already stops a *new* building from snapping the number,
 * but nothing else does: a rezone quadruples the population between one tick
 * and the next and coverage falls off a cliff under it. Residents do not change
 * their minds that fast. Same exponential form as DEMAND_TAU, and the same
 * reason — it survives a 60-second offline catch-up step without overshooting.
 */
export const HAPPINESS_TAU = 45;

/**
 * What a city with no services at all still earns.
 *
 * 0.55 is the number the opening minute was re-checked against: the first house
 * pays for itself in 26 seconds instead of 14, which is slower but still inside
 * "a decision rather than a wait" — the pacing guard in test/game.test.ts still
 * clears its floor of eight homes in the first minute.
 */
export const HAPPINESS_FLOOR = 0.55;

/**
 * Below this, nobody new will move in and the home button says so.
 *
 * This is the tutorial, and it has no text: housing stalls, the happiness panel
 * names the term that is short, and the player works out why.
 *
 * The fix used to be exactly one purchase: a hospital was worth 0.4 on its own
 * and cleared 0.35 by itself. Recreation's 0.18 comes out of the three service
 * weights, so a hospital is now 0.34 — a hair under — and the fix is two
 * purchases rather than one. It is still short and still signposted: at twelve
 * homes the panel names the police station (0.34 + 0.26 = 0.60), and the park
 * it names next is 45 rather than 210 and gets there on its own too (0.34 +
 * 0.18 x 5/12 = 0.42). Both routes are cheaper than the single hospital was.
 *
 * An empty city is at 1, not 0 — coverage is the share of residents a service
 * reaches, and with no residents there is nobody it fails. Happiness then lags
 * down from there as the first houses fill (HAPPINESS_TAU), which is what buys
 * the opening enough room to earn the hospital that lifts the gate. Measured
 * against a player who buys the moment they can: the gate first bites at 47s
 * and 11 homes, and the first hospital opens at 116s. The stall is not dead
 * time — shops and industry are both still buildable through it.
 */
export const HAPPINESS_MIN_BUILD = 0.35;

// ------------------------------------------------------------------ parks

/**
 * Housing plots one park keeps happy.
 *
 * Against land, not residents, and that is the whole design of the term — this
 * is the one coverage the repo got right first time, and the one Part 0 made
 * every other coverage copy. A rezone multiplies residents by up to 75x and adds
 * exactly zero park land, so a per-resident denominator would be trivial at
 * detached housing and unreachable at arcologies: a happiness term that means
 * two different things at two ends of the same game.
 *
 * Plots rather than *homes*, which is the one thing that moved. Per home the
 * term was level-invariant but not merge-invariant: 24 detached houses want 4.8
 * parks against the 4 a district has, and the same land merged into 12 towers
 * wants 2.4 — so recreation jumped from 83% to 100% the moment a district
 * merged, having built nothing. Six is the ratio the land already states: four
 * park plots to twenty-four housing plots a district, so a district's parks
 * cover its housing exactly and half of them cover half of it.
 */
export const PLOTS_PER_PARK = 6;

/**
 * Recreation's share of happiness. With the three services above it sums to 1.
 *
 * The smallest of the four, deliberately. A park is the cheapest of the
 * amenities and its land is the interior of a block that nothing else can use,
 * so it should not be worth as much as a hospital — but a city that never
 * builds one is capped at 0.82, which is a visible ceiling rather than a
 * punishment, and still miles clear of HAPPINESS_MIN_BUILD.
 */
export const RECREATION_WEIGHT = 0.18;

/**
 * Parks earn nothing and compound gently.
 *
 * Priced against the civic curve rather than against housing, because that is
 * what a park competes with for the same cash. A district holds 4 parks against
 * about 2.33 buildings of any one civic type, so a matching *growth* is the one
 * that compounds at the same rate per district: 4 x ln(1.18) = 0.66 against
 * 2.33 x ln(1.35) = 0.70. Base 45 puts the first district's four parks at 235
 * all told — about a third of what filling its housing costs, which makes
 * recreation an early purchase rather than an endgame one.
 */
export const PARK_BASE = 45;
export const PARK_GROWTH = 1.18;

// ----------------------------------------------------------------- transport

/**
 * Cash per covered rider per second.
 *
 * Against RENT's 0.14 a resident: a fare is about a seventh of what the same
 * person pays in rent, so a depot covering its own district adds roughly 14% to
 * the ledger. Enough that the first one is worth buying for the money alone,
 * far short of making transport the way a city earns.
 *
 * Riders are capped at the people who actually live there rather than at the
 * housing stock, which is the one place transport differs from every other
 * coverage: a hospital is sized to the houses it stands among whether or not
 * they are full, and a bus is only paid by somebody on it.
 */
export const FARE_PER_RIDER = 0.02;

/**
 * How much further a fully covered workforce can reach for a job.
 *
 * The second thing a depot does, and the one that feeds the demand cycle rather
 * than the ledger: a network turns residents into workers an employer can
 * actually hire, so a covered district has a quarter more labour available than
 * its population alone would suggest. That spare labour is then an argument for
 * premises — see `demandTargets`, where it lifts commercial and industrial
 * demand rather than income.
 */
export const TRANSIT_WORKFORCE = 0.25;

/**
 * How much of the spare labour a network reaches counts as an argument for
 * premises.
 *
 * A coefficient rather than the raw pool, because the raw pool is enormous. A
 * mature worker-rich city has thousands of workers with nowhere to work, and
 * `demandScale` is a district's labour pool — so feeding the whole surplus in
 * doubles commercial demand and pins it. Measured over 24 hours: at 1.0 the
 * discount-chasing policy sat at +1 commercial for 628 minutes of the run,
 * against a build that pinned nothing at all. At 0.35 the term is worth about
 * 0.14 of a demand point to that same city — a lift a player can see on the
 * bar, and nothing pins.
 */
export const TRANSIT_LABOUR_DRAW = 0.35;

/**
 * What free transport does, and what it costs.
 *
 * A policy trade, not a strict upgrade: fares fall to zero — which is most of a
 * depot's direct return — and in exchange the same depots reach a third further
 * because people ride when it is free, and the city is measurably happier for
 * it. What the coverage buys is labour reach, which lifts commercial and
 * industrial demand; what the mood buys is income through the multiplier and
 * headroom under HAPPINESS_MIN_BUILD.
 *
 * The mood term is added to the happiness *target*, exactly as the tax term and
 * the fire term are, and for the same reason: the four happiness weights sum to
 * 1 and go on doing so. This is a modifier on the coverage a city has earned,
 * not a fifth thing to be covered by.
 */
export const FREE_TRANSPORT_REACH = 0.33;
export const FREE_TRANSPORT_MOOD = 0.05;

// -------------------------------------------------------------------- policy

/**
 * What the city may set its tax rate to.
 *
 * Four discrete steps rather than a slider, and that is a decision about what
 * the control feeds rather than about taste. The rate moves happiness, which is
 * a lagged signal on a 45-second constant — a slider invites a player to drag
 * it, which would push a stream of values into an integrator that answers none
 * of them for the best part of a minute, and the reading they get back would
 * be of wherever the drag happened to stop rather than of what they chose. Four
 * named steps are also readable at a glance, which a percentage is not.
 *
 * `income` multiplies the ledger. `mood` is added to the happiness *target*, in
 * the same way the fire term is subtracted from it: it is a modifier on the
 * coverage the city has earned, not a fifth weight. The four happiness weights
 * were calibrated to sum to exactly 1 and still do.
 *
 * The multipliers are far wider than they look, because happiness is expensive.
 * It is worth 45% of the ledger through HAPPINESS_FLOOR, it moves occupancy
 * across a 0.84 range, and occupancy moves the shop multiplier on top — so the
 * three compound and a tenth of a point of mood costs roughly a fifth of the
 * income. A first pass at 1.18 for eight points was measured and was *strictly
 * worse* than neutral on a fully covered city, which is a control with three
 * dead options on it.
 *
 * Measured on two cities settled for half an hour, against the neutral step:
 *
 *                    fully covered        short of a hospital and its parks
 *   Low               x0.92  h 1.00        x1.15  h 0.77
 *   High              x1.13  h 0.94        x1.08  h 0.63
 *   Punitive          x1.15  h 0.86        x1.02  h 0.55
 *
 * Which is the trade the control exists to offer, and it points both ways: a
 * covered city has mood to sell and should raise the rate, and a struggling one
 * is better off buying mood back — Low is what lifts a neglected city over
 * HAPPINESS_MIN_BUILD when it cannot yet afford the hospital that would.
 */
export const TAX_STEPS = [
  { label: 'Low', income: 0.92, mood: 0.08 },
  { label: 'Standard', income: 1, mood: 0 },
  { label: 'High', income: 1.3, mood: -0.06 },
  { label: 'Punitive', income: 1.6, mood: -0.14 },
] as const;

/** The step a fresh city starts on, and the one a save without a rate defaults to. */
export const TAX_NEUTRAL = TAX_STEPS.findIndex((step) => step.mood === 0);

// ---------------------------------------------------------------------- fire

/**
 * Chance a single building catches fire, per building per hour, before any
 * suppression.
 *
 * Set against what a player actually sees rather than against anything real. A
 * young district of 20 buildings gets one fire an hour — often enough that the
 * fire station stops being an abstract coverage number, rare enough that it is
 * an event rather than a chore. A built-out 49-district city of 2,842 buildings
 * would reach 142 an hour uncovered, which is what MAX_ACTIVE_FIRES is for.
 */
export const BASE_IGNITION_PER_BUILDING_HOUR = 0.05;

/**
 * How much of the ignition rate full fire coverage takes away.
 *
 * Not 1. A city that had bought its way out of fires entirely would never see
 * one again, and the fire station would go back to being a number — 6% of the
 * base rate leaves a well-covered city the occasional fire, which at full
 * coverage is put out in EXTINGUISH_MIN and never costs a building.
 */
export const FIRE_SUPPRESSION = 0.94;

/**
 * Fires burning at once, at most.
 *
 * Six is a cap on the *simulation*, not just on the renderer: it is what stops
 * a twelve-hour absence from a large uncovered city returning a hundred
 * simultaneous fires, and it bounds every loop that walks the list.
 */
export const MAX_ACTIVE_FIRES = 6;

/**
 * Seconds to put a fire out, at zero coverage and at full coverage.
 *
 * The response time is the whole of what fire coverage buys. Everything else —
 * whether the building survives, how long it earns nothing, how long happiness
 * carries the hit — falls out of this one number.
 */
export const EXTINGUISH_MAX = 90;
export const EXTINGUISH_MIN = 20;

/**
 * How long a building survives burning.
 *
 * Sits between the two extinguish times on purpose, which is what turns
 * coverage into a threshold the player can feel: response time is
 * EXTINGUISH_MAX + (EXTINGUISH_MIN - EXTINGUISH_MAX) x coverage, so it drops
 * under 75 seconds at 21.4% fire coverage. Below that every fire costs a
 * building; above it, none do.
 */
export const BURN_OUT_SECONDS = 75;

/**
 * Happiness lost per fire currently burning.
 *
 * Six at once is 0.30 off the top, which a fully covered city (1.00) and even a
 * park-less one (0.82, see SERVICES) both absorb without falling through
 * HAPPINESS_MIN_BUILD. A fire should cost a city its momentum, not brick its
 * housing — being unable to rebuild *because* things burned down is the exact
 * spiral an idle game must not have.
 */
export const FIRE_UNHAPPINESS = 0.05;

/**
 * Buildings a single `catchUp` call may destroy, however long the absence.
 *
 * The hard guard. Measured on one uncovered district left for the full
 * twelve-hour cap: 31 fires start and every one of them resolves past
 * BURN_OUT_SECONDS, so without this the player comes back to a city 31
 * buildings smaller — more than half of the 58 it owns — having watched none
 * of it. One is a message; thirty-one is a bug report. The fires that would
 * have been losses are put out instead, and `AwayReport` carries the count
 * either way.
 */
export const CATCHUP_MAX_LOSSES = 1;

/**
 * Ceiling on accumulated ignition pressure, in expected fires.
 *
 * A backstop, not a tuning knob. Ignition integrates a hazard and spends it in
 * a loop, so a doctored save carrying an absurd hazard is the one input that
 * could spin. 64 is far above anything the rate can reach in a single 60-second
 * catch-up step — the largest city manages about 2.4 — so it never binds in
 * play.
 */
export const IGNITION_HAZARD_CAP = 64;
