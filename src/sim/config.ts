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
 * How far a plot's centrality may move its rent, either way.
 *
 * `citygen` has always scored every block 1 at its district's middle and 0 at
 * its furthest corner, and rent has always ignored it. This is the coefficient
 * that stops it doing so: a housing plot's rent is multiplied by
 * `1 + LAND_VALUE_SPREAD x (centrality - the city's mean centrality)`, so the
 * mean multiplier over a fully built city is exactly 1.
 *
 * That normalisation is the load-bearing part rather than a tidiness. RENT,
 * HOME_BASE and the first tier's capacity together set how long the first house
 * takes to pay for itself, which is the number the opening minute lives or dies
 * on; if the centrality factor changed what a built-out city earns, all three
 * would be re-opened. It redistributes rent across the build order and does not
 * add or remove any.
 *
 * Measured over the plot lists themselves (tools/landvalue.calibrate.mjs). A
 * housing plot's centrality runs 0.14 to 1.00 with a city-wide mean of 0.36 and
 * a standard deviation of 0.14 to 0.17, so what a spread is worth on a plot is:
 *
 *   spread   worst plot   best plot    typical
 *   0.2           -4.4%      +12.8%     +-2.8%
 *   0.4           -8.9%      +25.5%     +-5.6%
 *   0.8          -17.8%      +51.0%    +-11.3%
 *   1.6          -35.6%     +102.1%    +-22.5%
 *
 * The bound on the other side is lumpiness, and it is what keeps this small.
 * The build order is shuffled inside a district but the plots offered *first*
 * are systematically off-centre — district 0's opening four sit at 0.178
 * against its own mean of 0.300 — so the running mean starts below the
 * normaliser and climbs to it. That is a swing in the *whole city's* income,
 * arriving against a demand loop calibrated on flat rent and shown on no bar in
 * the HUD. Past the first half-district, where there is an economy for it to be
 * a swing in, the worst it ever reads:
 *
 *   spread    1 district   12 districts   49 districts
 *   0.2            +0.4%          -1.5%          -1.4%
 *   0.4            +0.8%          -2.9%          -2.8%
 *   0.8            +1.7%          -5.8%          -5.7%
 *   1.6            +3.4%         -11.7%         -11.3%
 *
 * 0.4 is the value that leaves the inspector something to say — a quarter more
 * rent on the best plot in the city than on an identical house at the rim, and
 * the difference between two neighbours worth about 6% — while the ledger swing
 * stays under 3%. At 0.8 the swing is 6%, which is an eighth of
 * PRICE_DISCOUNT_MAX arriving for reasons the player cannot see; at 0.2 the
 * inspector's number rounds to nothing on most plots.
 *
 * Closed-loop over 24 hours (tools/economy.calibrate.mjs), against the same
 * build with the spread at zero: auto-develop's first annex moves 1.64h ->
 * 1.67h and its first service 25.6m -> 27.0m, and the disciplined policy the
 * same, both inside 2%. The discount-chaser moves 3.87h -> 4.98h, or +29%, and
 * that number is reported rather than tuned away: it is the policy that buys
 * six houses at the rim of one district and then nothing but shops, so its whole
 * ledger rests on exactly the plots this term marks down and it is the most
 * exposed reading the model can produce. Its 24-hour city is identical at every
 * spread — 97R / 91C / 65I / 50 civic, 9 districts — so what moved is how long
 * the discount-chaser spends in the hole it dug, which is the term working.
 *
 * One consequence is worth stating because it is visible. The normaliser is the
 * mean over the land the city *owns*, so annexing moves it: a district built out
 * on its own reads exactly 1, and once the city is four districts wide the same
 * housing reads 0.975. The middle of the city moved, and the old middle is no
 * longer it. Normalising against a constant measured over every seed would avoid
 * that and would cost the exactness at build-out, which is the more valuable of
 * the two.
 */
export const LAND_VALUE_SPREAD = 0.4;

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

// ------------------------------------------------------------------ upkeep

/**
 * Cash a civic building costs to run each second, per unit of what it cost to
 * open and per unit of what a plot of the city is worth.
 *
 * Civic buildings used to cost capital once and nothing afterwards, which made
 * "buy every service the land allows" strictly correct and left the Treasury tab
 * with nothing to say. This is the running cost that turns coverage into a
 * budget: `upkeep` is charged against the treasury every tick, `netIncome` is
 * what the dock reports, and what a city cannot pay comes out of its staffing.
 *
 * Priced off `Service.base` rather than as a column of its own, so a university
 * costs more to run than a police station without a second table to keep in step
 * with the first — and see `serviceUpkeep` for what that costs, because it is
 * lopsided. Multiplied by `ledgerScale`, which is the term that keeps the bill
 * from falling away as the city climbs, and which carries the two weaker scale
 * terms that were measured and rejected first.
 *
 * With `ledgerScale` at 1 for a fresh city, the constant is a payback period:
 * 1/UPKEEP_RATE seconds, or 111 minutes, for a building to have spent its own
 * opening price on wages at the opening's premises.
 *
 * Measured (tools/upkeep.calibrate.mjs), as a share of gross income on cities
 * built out to their own frontage with every service the land allows. The rows
 * are identical to three significant figures at apartments, towers and
 * megastructures, which is the scale term doing its job, so one table covers the
 * whole ladder:
 *
 *   rate       1 district   12 districts   49 districts
 *   5.0e-5           3.7%           4.1%           6.1%
 *   1.5e-4          11.0%          12.3%          18.3%
 *   5.0e-4          36.5%          40.9%          60.9%
 *   1.5e-3         109.5%         122.7%         182.8%
 *
 * 5.0e-5 is too quiet to be a decision — a fully served city hands back 96% of
 * its ledger and the tab may as well not exist. 1.5e-3 is the other failure:
 * more than the city earns, so the correct play is to run with no hospital in it
 * and the whole coverage model inverts. 5.0e-4 is playable and takes over half
 * the ledger at scale, which makes coverage the only decision in the game rather
 * than one of them. 1.5e-4 leaves services worth buying and worth counting.
 *
 * Closed-loop over 24 hours, the wage bill ends at 16.6% of gross under
 * auto-develop, 16.2% under the discount-chaser and 16.8% under the disciplined
 * policy, and no policy spends a second unable to make its wages. What it costs
 * the pacing is small and worth stating: auto-develop's first annex moves 1.63h
 * -> 1.64h and its 24-hour treasury 5.4e10 -> 2.6e10, with the same 28 homes and
 * one shop fewer. See tools/economy.calibrate.mjs for the rest of that diff.
 */
export const UPKEEP_RATE = 1.5e-4;

/**
 * How a type's upkeep compounds over the buildings it already has.
 *
 * Gentler than CIVIC_GROWTH (1.35) and that is a hard constraint rather than a
 * preference: at 1.35 the n-th hospital's wage bill would climb exactly as fast
 * as its price, so a city that could afford to open its second could never
 * afford to run it.
 *
 * How much gentler is the thing that was measured, and the answer is: barely.
 * The city's income grows quadratically in the district count while a compounded
 * payroll grows exponentially in it, so anything with real curvature in it stops
 * being a share of the ledger and becomes the whole of it. At the configured
 * rate, as a share of gross income:
 *
 *   growth     1 district   12 districts   49 districts
 *   1.00            10.9%          11.0%          10.9%
 *   1.01            10.9%          11.6%          14.0%
 *   1.02            11.0%          12.3%          18.3%
 *   1.04            11.0%          13.8%          32.7%
 *   1.08            11.0%          17.4%         120.6%
 *
 * 1.08 was the first guess and is not survivable — a full map pays more in wages
 * than it earns before it has done anything wrong. 1.00 is flat, and flat is the
 * safe answer, but it says nothing: the twentieth hospital costs the same to run
 * as the first, which is the "buy everything" problem again one level down.
 *
 * 1.02 is the value that keeps both. A district's six 2x2 sites cost 6.31x one
 * building's wages against the 14.4x they cost to open, so hoarding is dearer
 * than it looks and never dear enough to close; and across the whole map the
 * share drifts 11.0% -> 18.3%, which is a legible brake on sprawl rather than a
 * wall. It sits beside ANNEX_GROWTH as the second thing expansion costs.
 */
export const UPKEEP_GROWTH = 1.02;

/**
 * Seconds for unpaid wages to empty a civic building's payroll.
 *
 * The bankruptcy rule, and it is a decay rather than a demolition on purpose.
 * Cash cannot go below zero, so something has to give when net income does —
 * and staffing is the one quantity that can give reversibly: it is already an
 * integrated scalar with a ramp (CIVIC_RAMP_SECONDS), so the same machinery that
 * opens a hospital closes it, and the same machinery reopens it. Destroying
 * buildings instead would be permanent loss, which is the fastest way to make
 * someone close an idle game.
 *
 * It is also what makes the rule self-limiting. Upkeep is charged against
 * *staffed* buildings, so a city that cannot pay stops paying: staffing falls,
 * the wage bill falls with it, and the city settles at the coverage it can
 * afford rather than at zero. Income then recovers, staffing ramps back at
 * CIVIC_RAMP_SECONDS, and the equilibrium moves up. A city that cannot afford
 * its only hospital keeps a fraction of a hospital.
 *
 * Self-limiting is not the same as escapable, and the difference cost this
 * feature a constant: the fixed point this settles at still owes more than the
 * city earns, so the treasury sits at nothing forever unless something else
 * guarantees a surplus. UPKEEP_KEEP_SHARE is that something, and it carries the
 * measurement.
 *
 * 180 against the 90 of the ramp: twice as slow to lose a payroll as to fill
 * one, for the same reason RECOVER_SPREAD_SECONDS is four times faster than
 * ABANDON_SPREAD_SECONDS — coming back has to be quicker than falling over, or
 * one bad minute costs ten good ones. Scaled by the *share* of the bill that
 * went unpaid, so a city a penny short loses almost nothing and one paying
 * nothing at all loses the payroll on this constant.
 */
export const UPKEEP_ARREARS_TAU = 180;

/**
 * Seconds of shortfall the automatic passes hold back before they spend.
 *
 * `autoDevelop` and `willAutoAnnex` both reserve against *net* income rather
 * than gross, or a city left to run itself would spend into a brownout: every
 * service it opened would raise the wage bill it was already failing to pay,
 * and the player would come back to a city with full coverage on paper and no
 * staff in any of it.
 *
 * A minute of the shortfall, which is also the hysteresis that keeps the pair
 * from oscillating. Without it a city sitting at exactly zero net would buy,
 * fall into arrears, decay staffing until it was solvent again, and buy again —
 * a limit cycle nobody watching could read. AUTO_ANNEX_RESERVE already does the
 * same job for the treasury; this is the rate's half of it.
 */
export const UPKEEP_RESERVE_SECONDS = 60;

/**
 * The share of what the city takes in that its wage bill may never touch.
 *
 * The floor that stops the bankruptcy rule from being a deadlock, and it is the
 * same shape as OCCUPANCY_FLOOR and HAPPINESS_FLOOR for the same reason: a
 * neglected city should feel like one that has stopped growing, not one that has
 * been switched off.
 *
 * What it says is that wages are budgeted out of *revenue*, never out of
 * reserves. That is a stronger rule than "cash cannot go negative" and both of
 * the weaker readings were built and measured first:
 *
 *   - paying wages out of the treasury and flooring cash at zero settles at a
 *     fixed point that still owes more than the city earns. Staffing falls until
 *     the ramp back up balances the arrears decay, and that balance sits at a
 *     *positive* shortfall — so every penny of income goes on wages forever.
 *     Measured on a city holding a hospital and a university it could not pay
 *     for: staffing settled at 84%, net at -0.35/s, and the treasury at 0.00 for
 *     six simulated hours with no way out of it;
 *   - keeping a tenth of each *tick's* income is no better, because the next
 *     tick's bill eats it. The same city holds a flat 0.02 in the bank forever.
 *
 * Against revenue it accumulates: the treasury grows at UPKEEP_KEEP_SHARE times
 * gross income however deep the arrears are, so the way back is slow and visible
 * rather than closed. The same city banks 92 an hour and can buy its way out.
 *
 * The consequence worth stating, because it is a design decision and not a side
 * effect: a *rich* city that has over-bought coverage browns out too. It cannot
 * spend its treasury on wages it does not earn, so hoarding cash is no defence
 * against having bought more services than the city can carry — which is the
 * whole decision this feature exists to create.
 *
 * The two readouts disagree while it bites: the dock shows a negative net and
 * the treasury creeps up anyway, because part of the bill is going unpaid. What
 * is being paid instead is staffing, and the services panel is where that shows.
 */
export const UPKEEP_KEEP_SHARE = 0.1;

// -------------------------------------------------------------- landmarks

export interface Landmark {
  /** Matches the GameState counter and the coverage key. */
  readonly key: 'museum' | 'stadium';
  readonly name: string;
  readonly buildLabel: string;
  readonly base: number;
  readonly growth: number;
  /** Plots per side of the site it stands on. One of each per district. */
  readonly span: 2 | 3;
  /**
   * How far its influence reaches from its own centre, in world units.
   *
   * The one number that decides what a landmark is worth, and it is measured
   * rather than chosen — see LANDMARK_MOOD for the curve it was read off.
   */
  readonly reach: number;
}

/**
 * The city's special buildings: one to a district of each size, on the squares
 * FRONTAGE_TARGET holds back for them.
 *
 * Landmarks are the game's first area-of-effect, and the shape of that effect is
 * the whole design. Per-building happiness does not exist here and must not be
 * introduced: levels are cohorts, so a per-instance modifier would mean
 * per-instance state, a save that grows with the city, and the end of "positions
 * derive from counts". What a landmark does instead is cover *land* — the
 * housing plots inside `reach` of it — and the share of the city's housing
 * under at least one landmark is a single scalar. See `landmarkCoverage`.
 *
 * Two sizes so the choice is a real one. A museum is cheap, fits the 2x2 square
 * every district already claims, and covers its own neighbourhood; a stadium
 * costs three times as much, needs the 3x3, and reaches half again as far.
 * Neither earns anything: what they buy is mood, which is the one thing a city
 * short of civic land cannot buy any other way.
 *
 * The two reaches were swept together rather than picked, against the share of
 * housing land each covers with one landmark on every site it has:
 *
 *   districts        1      4     10     25     49
 *   museums only   46%    33%    49%    49%    47%
 *   stadiums only  63%    83%    80%    85%    86%
 *   both           63%    92%    88%    91%    92%
 *
 * so a museum is worth about half a district and a stadium most of one, and
 * neither type alone gets the city past the mid-eighties — the last stretch
 * needs both, which is what keeps the cheap one worth buying after the dear one
 * exists. Against 3x the price the stadium is 1.8x the coverage, so museums are
 * the better value and stadiums are what finishes the job.
 *
 * The one-district city is the exception and is left as it is: a stadium's 38
 * contains a museum's 24 at that size, so the museum adds nothing until the
 * city is two districts wide. Reaches large enough to avoid that would cover
 * the whole map from one site.
 *
 * Coverage is smooth in the count rather than stepped — at ten districts, one
 * stadium covers 15%, three 36%, five 54% and ten 80% — so every purchase moves
 * the number and none of them is a cliff.
 */
export const LANDMARKS: readonly Landmark[] = [
  { key: 'museum',  name: 'Museums',  buildLabel: 'Open museum',   base: 4_000,  growth: 1.6, span: 2, reach: 24 },
  { key: 'stadium', name: 'Stadiums', buildLabel: 'Build stadium', base: 12_000, growth: 1.7, span: 3, reach: 38 },
];

/**
 * What a fully landmarked city adds to its happiness.
 *
 * A *modifier* on earned coverage, exactly as the tax mood and
 * FREE_TRANSPORT_MOOD are, and not a fifth weight. The four happiness weights
 * were calibrated to sum to exactly 1 and go on doing so — adding a fifth would
 * re-open that calibration to buy something a modifier states more honestly.
 * What a landmark changes is how the city feels about the coverage it has, not
 * how much that coverage is worth.
 *
 * 0.12 against the numbers it sits beside: free transport is worth 0.05, the
 * punitive tax rate costs 0.14, and a fire costs 0.05 while it burns. So a
 * fully landmarked city can run one tax step harder than it otherwise could, or
 * absorb two fires, and a neglected one is lifted clear of HAPPINESS_MIN_BUILD
 * (0.35) without a single service. It is deliberately worth less than the
 * cheapest service weight (recreation, 0.18): a landmark should not be a way to
 * skip the hospital.
 *
 * Since coverage tops out at 1 and this is added on top, a city that has already
 * earned 1.00 gains nothing — which is the right shape. Landmarks buy happiness
 * *early*, standing in for services not yet built, and stop mattering once the
 * city is properly served.
 */
export const LANDMARK_MOOD = 0.12;

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

// ---------------------------------------------------------------------- port

/**
 * One half of a port. Two of them, and they buy different things.
 *
 * The same shape as a SERVICE or a LANDMARK — a count, a site, an exponential
 * cost — because it is the same kind of thing, and because a one-off flat price
 * would be meaningless in an economy this exponential: by the time a city has
 * reached the coast it is earning more in a second than any fixed number is
 * worth. What bounds them instead is land: one berth of each per *coastal*
 * district, and a full city owns a handful of those.
 *
 * Bases are set against LANDMARKS, which is the nearest thing already priced:
 * a cruise terminal is between a museum and a stadium, a cargo terminal past
 * both, and the growth is steeper than either because a waterfront runs out of
 * berths long before a district runs out of squares.
 */
export interface Terminal {
  readonly key: 'cruise' | 'cargo';
  readonly name: string;
  readonly buildLabel: string;
  readonly base: number;
  readonly growth: number;
}

export const TERMINALS: readonly Terminal[] = [
  {
    key: 'cruise',
    name: 'Cruise',
    buildLabel: 'Open cruise terminal',
    base: 20_000,
    growth: 1.8,
  },
  {
    key: 'cargo',
    name: 'Cargo',
    buildLabel: 'Build cargo terminal',
    base: 28_000,
    growth: 1.8,
  },
];

/**
 * Visitors a cruise terminal lands, as a share of the city's own population.
 *
 * Tied to residents rather than to a flat rate, and for the reason FARE_PER_RIDER
 * is: a constant would be the opening hour's whole economy and a mature city's
 * rounding error. What a berth is worth has to grow with the place it serves,
 * because the reason anybody sails there is the place.
 *
 * Scaled by happiness on top, which is the mechanic rather than the flavour: it
 * is the only income line in the game that goes to *zero* in a miserable city
 * rather than merely to HAPPINESS_FLOOR. Nobody's holiday is somewhere grim.
 */
export const VISITORS_PER_RESIDENT = 0.03;

/**
 * What a visitor spends per second, against RENT's 0.14 a resident.
 *
 * Five times what somebody who lives there pays, and still a small line,
 * because there are far fewer of them. Set against the transit fares rather
 * than against rent, because that is the family it belongs to: both are trade
 * income and both sit outside the multipliers rent goes through, so both are a
 * far smaller share of a built-out city's ledger than of a young one's.
 *
 * Measured (tools/water.calibrate.mjs) on a city built out to its own frontage,
 * with a full transit network for comparison. One cruise berth is worth about
 * what the whole fare line is, at every size and at every rung of the ladder:
 *
 *   12 districts, 1 berth    fares 0.34% of the ledger, cruise 0.35%
 *   25 districts, 4 berths   fares 0.16%, cruise 0.17% each
 *   49 districts, 6 berths   fares 0.08%, cruise 0.09% each
 *
 * So a finished waterfront is worth something over half a percent of a mature
 * ledger, which is the same order as everything else the city can buy that is
 * not a building. What makes it worth buying is not the size of the line.
 */
export const VISITOR_SPEND = 0.7;

/**
 * What one cargo terminal adds to the export tap, as a fraction of it.
 *
 * It lifts EXPORT_BASE and EXPORT_PER_DISTRICT rather than sitting beside them,
 * so there is still exactly one number the outside world's appetite is made of
 * and one place to look when industrial demand is wrong. A parallel term would
 * be a second export market that nothing else in the model knew about.
 *
 * Worth stating plainly: this matters most to a young city and least to an old
 * one. The export tap is measured in level-0 plots while `demandScale` grows
 * with the level ladder, so what a berth moves the industrial target by falls
 * away as the city climbs. Measured, before `clampDemand`:
 *
 *   12 districts   +0.29 on detached housing, +0.07 on apartments, +0.02 on towers
 *   49 districts   +0.98, +0.24, +0.06 for the same three
 *
 * That is the right way round rather than a shortfall — a port is how a city's
 * industry gets going, not how a finished one stays busy — and the land gate
 * keeps the strong end honest: a city that has only just reached the water owns
 * exactly one berth, so the +0.29 is a lift and not a pin. Against
 * TRANSIT_LABOUR_DRAW's measured 0.14, one berth early is the larger of the two
 * levers a player has on industrial demand.
 */
export const CARGO_EXPORT_LIFT = 0.4;

// ------------------------------------------------------------------ estates

/**
 * What one industrial estate is worth, in the industrial plots a district
 * sells.
 *
 * An estate is one large parcel off a highway with a shed on it — nine plots
 * across and nothing but the shed inside — so it stands in for nine of the
 * small works the street grid sells. Counting it in *plots* rather than giving
 * it a scale of its own is what lets every term the demand model already has
 * take it without a special case: jobs, output and the income multiplier are
 * all per industrial plot, at every level, by ZONE_SHARE's own design.
 *
 * The in-district industrial land is untouched by all of this and stays exactly
 * where it is. An estate is where a city puts industry it has no room for, not
 * a replacement for the works on Mill Street.
 */
export const ESTATE_PLOTS = 9;

/**
 * How much more each of those plots makes, and earns, than one inside the city.
 *
 * The reason to build out of town: room to lay a shed out properly. Output and
 * the income multiplier take it; jobs do not — see JOBS_PER_ESTATE_PLOT.
 *
 * There is no happiness penalty to set against it, and that is a decision
 * rather than an oversight: nothing in `happinessTarget` reads industry at all,
 * so a penalty would have to be invented — and inventing one would be a balance
 * change to the in-district industrial zone, which is not what this is.
 *
 * What it is worth, measured at tower housing where the labour market clears:
 * a full band is +19% of the ledger at 14 districts and +10% at 49 — against
 * the shop multiplier's 35 to 46%, so it is a major line and not the game. On
 * the demand side it pushes industrial demand *down* by 0.28 and 0.52 of a
 * point, which at MAX_DISTRICTS takes a signal that was pinned at its upper
 * bound and puts it back in the middle of its range. That is the right
 * direction: a band of works is supply, and a built-out city is short of it.
 */
export const ESTATE_YIELD = 1.4;

/**
 * Hands one estate plot needs, against JOBS_PER_INDUSTRIAL's 20 inside the city.
 *
 * The number that makes an estate a different thing from a works on Mill
 * Street rather than a bigger one, and it is what a shed on open ground with a
 * yard around it actually is: more output, fewer people. So the two kinds of
 * industry buy different things — the works inside the city pull residents in
 * through the jobs they make, and the estates bring goods and money.
 *
 * Measured, and the drift is what the number was set from. Jobs land on
 * residential demand and a whole band of them lands hard. Taken at the rung
 * where the labour market actually clears — tower housing, see WORKING_SHARE —
 * and before `clampDemand`, because a built-out city sits on its bounds under
 * this model already:
 *
 *              full band's raw R drift    at 14 districts    at 49
 *   20 jobs    (JOBS_PER_INDUSTRIAL)              +0.44      +0.82
 *    6 jobs                                       +0.13      +0.25
 *
 * At 20 the band pushed a signal already sitting at +0.73 straight through its
 * bound, leaving the housing discount stuck there with nothing left to say. At
 * 6 it is a lift a player can watch move, and the top of the range stays inside
 * the bounds at every rung of the ladder.
 * See tools/estates.calibrate.mjs; the industrial side of the same drift is in
 * ESTATE_YIELD's own measurement.
 */
export const JOBS_PER_ESTATE_PLOT = 6;

/**
 * How many districts the city must own before it may build outside its limits.
 *
 * The progression gate, and a count rather than a share because there is no
 * land to measure: an estate stands on ground the city does not own and never
 * will. Fourteen puts the highway a little past the port, which opens on the
 * tenth to sixteenth annexation depending on the seed — the two are separate
 * features and neither gates the other, but they should not both arrive in the
 * same afternoon.
 *
 * Worth stating plainly, because it is a property of the annexation gate rather
 * than of this number: the calibrator's best policy reaches ten districts in
 * *336* simulated hours and stalls there at 66.5% developed against a 70% gate.
 * So both the port and the estates sit past its horizon, and so does most of
 * the run up to MAX_DISTRICTS. That is a pacing question about
 * ANNEX_MIN_OCCUPANCY and the cost curves, and moving this number would hide it
 * rather than answer it.
 */
export const HIGHWAY_MIN_DISTRICTS = 14;

/**
 * What a parcel off the highway costs.
 *
 * Derived rather than picked, and the derivation is the whole ordering between
 * the two kinds of industry: an estate opens at what the city's *last*
 * in-district works would cost with every industrial plot it owns built on. So
 * filling your own industrial land is always the cheaper move and the band is
 * what you buy when there is none left — which is exactly the fiction, and it
 * is why the in-district industrial zone did not have to be weakened to make
 * room for this one.
 *
 * It is still the better deal at the margin once it opens, and it has to be or
 * nobody would ever take it: a parcel is nine plots at ESTATE_YIELD, so it buys
 * about 12.6 works' worth of output for the price of one, against an in-district
 * curve that has already compounded 182 times. What the player is buying past
 * that point is a fresh curve.
 */
const ESTATE_ANCHOR_WORKS = FRONTAGE_TARGET.industrial * HIGHWAY_MIN_DISTRICTS;
export const ESTATE_BASE = INDUSTRY_BASE * INDUSTRY_GROWTH ** ESTATE_ANCHOR_WORKS;

/**
 * How hard a parcel compounds.
 *
 * Gentler than the landmarks or the port because the band holds far more of
 * them: at 1.35 over the twenty-six parcels this build's seed leaves dry, the
 * last one costs about 1,800 times the first — the same spread INDUSTRY_GROWTH
 * covers in fifty-seven buildings. Steeper and the back half of the band would
 * be content nobody reaches; flatter and the whole band is one purchase.
 */
export const ESTATE_GROWTH = 1.35;

/**
 * What the road out of town costs: exactly what the last district did.
 *
 * Derived against the annexation curve rather than against the parcels, because
 * that is the decision it stands beside — a player at the gate is choosing
 * between one more district of their own land and the road to somebody else's.
 * Anchoring it to a parcel instead would have priced the enabler above the
 * feature: an estate opens at what a fully built city's last works costs, which
 * at fourteen districts is eleven times the price of the fourteenth.
 */
export const HIGHWAY_COST = ANNEX_BASE * ANNEX_GROWTH ** (HIGHWAY_MIN_DISTRICTS - 1);

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
