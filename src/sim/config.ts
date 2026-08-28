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
 * Road cells a district carves out, and the reason congestion is a scalar.
 *
 * Derived, not chosen, and not choosable: the rejection sampler in `citygen`
 * accepts only a plan with exactly TARGET_PLOTS buildable plots, and a plan on a
 * DISTRICT_SPAN grid has `span^2` cells — so every district in every city has
 * exactly this many road cells, and exactly three full row lines and three full
 * column lines. Measured over all 49 districts of the default seed: 81 road
 * cells each, 3 and 3 each, 18 distinct line *placements* between them.
 *
 * Placement varies; supply does not. That is what makes traffic a city-wide
 * number rather than a map — see `congestion`, which multiplies this by the
 * district count and stops there. Getting spatial congestion would mean
 * changing the generator, which re-opens every per-district constant from
 * SHOP_BASE to EXPORT_PER_DISTRICT.
 */
export const ROAD_CELLS_PER_DISTRICT = DISTRICT_SPAN * DISTRICT_SPAN - TARGET_PLOTS;

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
 *    + 9 x 4  2x2 squares   (6 civic, 1 small landmark, 1 city hall, 1 power)
 *    + 2 x 9  3x3 squares   (1 university, 1 large landmark)
 *    + 4      courtyard parks
 *    + 4      courtyard spare
 *   = 144
 *
 * so a district now carries four deliberately empty plots, all of them courtyard.
 * It carried twelve when the span widened: the city hall took one of the two
 * spare 2x2 squares and the power plant took the other, which is exactly what
 * they were held back for. There is no 2x2 slack left, and the next feature that
 * wants a square has to say where it is coming from.
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
   * are drawn. Six go to civic, one to a small landmark, one to the city hall
   * and one to a power plant — reserving the whole claim rather than only the
   * squares something stands on is what keeps `homeCapacity` independent of
   * build order. There is nothing spare in it any more.
   */
  squares: 9,
  /** 2x2 civic sites per district. 6 x 4 = 24 plots, mostly dead interior. */
  civicSites: 6,
  /** 2x2 landmark sites per district, taken from the same claim. */
  landmarkSmallSites: 1,
  /**
   * 2x2 city hall sites per district, sliced after the civic six.
   *
   * One per *district* for a building there is only ever one of in the whole
   * city, and that is not waste — it is what keeps the plot budget uniform. The
   * build lists are what is left after the reservations, `districtPlan` has no
   * idea which district it is planning, and `onTarget` pins the same tuple for
   * every one of them. Reserving the square only in district 0 would give that
   * district one fewer housing plot than the rest and `homeCapacity` would stop
   * being a multiplication.
   *
   * It comes out of the two squares a district already holds empty rather than
   * out of CIVIC_SERVICES, which is the rule: adding a sixth entry to that table
   * changes the divisor in `siteCapacity` and moves every hospital, police
   * station, fire station, school and depot in the city onto a different site.
   * A returning player would watch their city rearrange itself.
   */
  cityHallSites: 1,
  /**
   * 2x2 power plant sites per district, sliced after the city hall.
   *
   * The last of the nine, and worth stating plainly: this spends the slack.
   * A district reserved twelve empty plots when the span widened — two 2x2
   * squares and four courtyard plots — and the note on that said they were the
   * land the next few features would get to use without the budget being re-cut.
   * The city hall took one square and this takes the other, so what is left is
   * four courtyard plots and nothing else. A tenth square would move
   * FRONTAGE_TARGET.squares, which moves the sampler's acceptance rate, which is
   * a district-generation change rather than a feature.
   *
   * One a district is not a coincidence either — it is the constraint that sets
   * POWER_EXPONENT. See that constant for the table.
   */
  powerSites: 1,
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
 * wider district's 24 / 45 / 13 frontage, before TRADE_LADDER and after:
 *
 *   level              w/j    flat trade ladder       sqrt trade ladder
 *                             demand R      C      I    R      C      I
 *   detached housing  0.09       +1.00  -0.82  +0.39  +1.00  -0.82  +0.39
 *   apartments        0.34       +0.31  -0.09  +0.10  +0.31  -0.34  +0.15
 *   towers            1.49       -0.05  +0.09  +0.02  -0.05  -0.08  +0.06
 *   arcologies        6.39       -0.14  +0.13  +0.01  -0.14  +0.04  +0.03
 *   megastructures   25.55       -0.16  +0.14   0.00  -0.16  +0.09  +0.01
 *
 * The residential column does not move at all, and that is the whole of the
 * split TRADE_LADDER is: jobs stay flat, so the labour market this budget
 * solves is untouched at every rung. What moves is commerce, from a curve that
 * ran -0.82 to +0.14 to one that runs -0.82 to +0.09 through a shallower
 * middle — and, far more importantly, the *land* those numbers imply. See
 * TRADE_LADDER for the ratio the flat ladder was asking the district for.
 *
 * `demandScale` is why the fifth rung adds a hundredth of a point to a signal
 * already settled: it divides by `cityScale`, so the imbalance a built city can
 * reach and the scale it is read against climb together. The ratios above are
 * therefore still the ones to solve, and they did not move.
 *
 * What the rung *does* move is a mixed city. Over 24 hours the discount-chasing
 * policy — which buys housing and lets commerce lag — pins residential at -1
 * for 990 of 1,440 minutes and commerce at +1 for 1,035, reaching 141,000
 * residents against 91 shops. That is not the surcharge working: it is a city
 * that wants 85.71 commercial plots per housing plot standing on land that
 * sells 1.88 of them. The ladder halves the ask; the land supply is the other
 * half and is not this constant's to fix. See tools/economy.calibrate.mjs.
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
 * Both are still true, and they are true about *different ladders*, which is
 * what the flat answer missed. The first is an argument about how fast trade
 * may climb, not about whether it may: at exponent 1 the land can never be
 * filled and at exponent 0 the city wants 45.7x the commercial land a district
 * holds. TRADE_LADDER is the middle, and its exponent is set by where the
 * wanted ratio crosses the land rather than by either failure. The second is an
 * argument about jobs and admits no middle at all — SHOP_JOBS and INDUSTRY_JOBS
 * stay flat, and the arc survives at every rung.
 *
 * So levels raise what a building is worth to the ledger, leave the number of
 * people it employs per plot alone, and raise the trade it carries sub-linearly.
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

/**
 * What a fully educated workforce adds to the city's industrial yield.
 *
 * Education's second job, and the whole difficulty is *where* it can go. It
 * cannot go on the goods side: INDUSTRY_OUTPUT feeds `demandTargets.i`
 * negatively — it is supply against the export tap — so a skill bonus that
 * raised output would make an educated city stop wanting industry, and the next
 * works would cost a surcharge for having built schools. Worse, DEMAND_TERMS
 * already carries a +0.20 education term on industrial demand, so the two would
 * be pulling in opposite directions through the same coverage.
 *
 * So it goes on the income side, and specifically on the industrial term inside
 * `bonuses` at the `income` call site. See `workforceSkill` for why that call
 * site rather than inside `bonuses` itself.
 *
 * Sized against the measurement rather than picked — see
 * tools/education.calibrate.mjs. The industrial term is the *second* multiplier
 * in the rent bracket everywhere on the map: at 12 districts of towers it
 * carries 38.8% of the bracket against commerce's 61.1%, and the ordering holds
 * at every size and every level. At 0.30 a fully taught city earns 11.6% more,
 * and the industrial term climbs from 0.64 of the shop term to 0.83 of it — so
 * it closes the gap without passing it, which is the bound the design asks for:
 * commerce is the city's main multiplier and education must not quietly become
 * a better one. 0.58 is where the two would meet; 0.80 overtakes outright, and
 * the calibrator marks it.
 *
 * The lift is almost perfectly flat across the map — 11.1% at one district,
 * 11.6% at forty-nine, and within half a point at every rung of the ladder —
 * because it multiplies a term that is itself a stable share of the bracket.
 * That is the right shape for a bonus that is bought once and kept.
 *
 * Worth building schools for, then, without being the reason to. Two schools
 * and a university already pay for themselves through LEVEL_EDUCATION; this is
 * what makes the third one worth staffing.
 */
export const SKILL_YIELD = 0.3;

export const ANNEX_BASE = 60_000;
export const ANNEX_GROWTH = 3.4;

/**
 * You must have built out this share of your land before the city annexes more.
 *
 * Left at 0.7 through the change that made annexation automatic, and measured
 * rather than assumed. Demand-neutral build-out, holding every home at one
 * level — a player who never buys into a surcharge. Re-measured through the
 * land-denominated coverage, the fifth level, the wider district and the grid:
 *
 *                    span 13   span 15   with power
 *   detached housing   69.6%     64.2%       69.7%
 *   apartments         68.6%     67.4%       69.7%
 *   towers             67.1%     69.3%       69.1%
 *   arcologies         65.7%     69.7%       68.5%
 *   megastructures        —      69.1%       69.1%
 *
 * Every rung sat under the gate before and every rung still does, so this is the
 * shape rather than a regression: a demand-neutral player does not annex. The
 * last column is tighter than the one before it — 68.5% to 69.7% against 64.2%
 * to 69.7% — and part of that is a correction to the probe rather than to the
 * game: it now keeps the district lit, and a browned-out one is not
 * demand-neutral. The power cap drags commercial and industrial occupancy down,
 * their targets follow, and the old run bought 176 shops for a district of
 * towers against the 109 it actually wants.
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
 * What one commercial or industrial *building* is worth to the labour market at
 * each level. The footprint, and nothing else.
 *
 * Jobs are the ladder that must not move, and the reason is the arc
 * WORKING_SHARE is built around: workers per housing plot climb 300x while jobs
 * per commercial plot stand still, so a young city is job-rich and pulls people
 * in and a mature one is worker-rich and has to go and find them work. Put a
 * ladder on jobs and that arc is deleted — the job/worker ratio freezes at
 * whatever it is at level 0 and the city is job-rich for its whole life.
 *
 * Measured, because it was tried. With a [1, 2.5, 7, 20, 55] ladder on jobs, a
 * district built out at one level reads residential demand +1.00 at detached
 * housing, *+1.00 again* at apartments, then +0.60 / +0.35 / +0.19. Pinned
 * positive for two rungs and never once negative: the city never becomes
 * worker-rich and residential demand never turns. That is the second of the two
 * failures LEVEL_SCALE's comment records, and it is still exactly as fatal.
 *
 * Trips, supply and output are a different question with a different partner —
 * see TRADE_LADDER, which is the one that moved.
 */
export const SHOP_JOBS = LEVEL_FOOTPRINT.map((f) => JOBS_PER_COMMERCIAL * f) as readonly number[];
export const INDUSTRY_JOBS = LEVEL_FOOTPRINT.map(
  (f) => JOBS_PER_INDUSTRIAL * f,
) as readonly number[];

/**
 * How much more trade a plot carries at each level than a level-0 plot does.
 *
 * The ladder that jobs deliberately do not take. Trips balance against
 * *residents*, which climb LEVEL_CAPACITY's 300x per plot, so a flat trade
 * ladder means the number of commercial plots the city wants per housing plot
 * climbs by the same 300x — from 0.29 at detached housing to 85.71 at
 * megastructures, against the 45 / 24 = 1.88 a district actually sells. A city
 * that climbs the ladder is 45.7x short of commercial land at the top and there
 * is nothing a player can do about it, which is what pins commerce at +1 and
 * housing at -1 the moment the two get even slightly out of step.
 *
 * `demandScale` hides this from a *balanced* district — it divides by
 * `cityScale`, which is the same 300x, so a district built out uniformly reads
 * -0.16 / +0.14 / 0.00 at the top and never pins. The imbalance is what pins,
 * and the imbalance is unfixable while the wanted ratio outruns the land by two
 * orders of magnitude. Measured over 24 hours, the discount-chasing policy sat
 * at R -1 for 990 minutes of 1,440 and C +1 for 1,035, holding 173 residential
 * plots against 91 commercial.
 *
 * So the ladder is neither flat nor proportional, and the exponent is what sets
 * where it lands. Proportional (exponent 1) is the *first* failure in
 * LEVEL_SCALE's comment: a level-2 shop serving 17.5x the trade means the city
 * needs 17.5x fewer shops, commercial land can never be filled, and auto-develop
 * stalled at 7 shops of 31 with the annexation gate unreachable. What decides
 * the exponent is not the drift but the *anchor*: level 0 wants 0.29 commercial
 * plots per housing plot and the land offers 1.88, so a ladder whose drift is
 * under 6.5x never reaches the land at all and commerce is oversupplied at every
 * rung. Measured, jobs held flat throughout:
 *
 *   exponent  ladder                     drift   top wants   x land   C at rungs 0-4
 *   0.00      1, 1, 1, 1, 1               300x       85.71    45.7x   -.82 -.09 +.09 +.13 +.14
 *   0.35      1, 1.6, 2.7, 4.7, 7.5      7.5x        11.43     6.1x   -.82 -.24 -.02 +.09 +.13
 *   0.45      1, 1.9, 3.6, 7.0, 13.0      23x         6.58     3.5x   -.82 -.30 -.05 +.06 +.11
 *   0.50      1, 2.0, 4.2, 8.7, 17.3      17x         4.95     2.6x   -.82 -.34 -.08 +.04 +.09
 *   0.60      1, 2.3, 5.6, 13.3, 30.6    9.8x         2.80     1.5x   -.82 -.41 -.16 -.02 +.05
 *   1.00      1, 4, 17.5, 75, 300           1x        0.29     0.15x  -.82 -.82 -.82 -.82 -.82
 *
 * 0.5 is the square root of the capacity ladder, and it is taken because of
 * where it *crosses*: the wanted ratio passes the land's 1.88 between apartments
 * and towers, which is exactly where the flat ladder crosses it today, so the
 * shape of the early game is unchanged and only the runaway is cut. It holds
 * commercial demand inside +-0.35 at every rung against a flat ladder's -0.82,
 * and its top wants 4.95 commercial plots per housing plot — a ratio a district
 * cannot supply today at 1.88, and the number the zoning work is sized against.
 *
 * The first rung is exactly 1, so nothing about a fresh save moves. That is not
 * a hope: the demand-neutral build-out probe reads 55.1% and 24R / 7C / 11I at
 * detached housing at *every* exponent from 0 to 0.5, which is what a ladder
 * anchored at 1 has to mean and what the probe had to be repaired to show.
 *
 * What it costs, stated plainly, because it is a real loss and not a rounding
 * one. The demand-neutral build-out of one district, per level held:
 *
 *   exponent   detached  apartments   towers  arcologies  megastructures
 *   0 (flat)      55.1%       10.1%    89.9%       78.7%           76.4%
 *   0.35          55.1%       11.2%    47.2%       36.0%           62.9%
 *   0.45          55.1%       11.2%    27.0%       29.2%           47.2%
 *   0.50          55.1%       11.2%    24.7%       24.7%           40.4%
 *
 * Against a 70% annexation gate, a uniform district above apartments used to
 * justify filling itself and now does not. That is the *first* failure in
 * LEVEL_SCALE's comment arriving in a milder form, and it is accepted here for
 * one reason only: the probe measures against a commercial allotment fixed at
 * 45, and a district of towers that wants 8 commercial plots rather than 23 is
 * a district that should be *zoned* for 8. The land supply is the other half of
 * this change and it is not this constant's to fix. If demand-driven zoning
 * does not recover the gate, this exponent is the first thing to bring down —
 * 0.35 and 0.45 are measured above and are the fallbacks, and 0.35's top wants
 * 11.43 commercial plots per housing plot, which is past what a shared pool can
 * offer.
 *
 * What it buys, over 24 hours, is the other half of the same trade. The
 * discount-chasing policy's commercial pin falls from 1,035 minutes of 1,440 to
 * 496 — less than half — while residential holds at 987, because residential
 * pinning is a *mix* failure that no capacity ladder reaches. Auto-develop is
 * unmoved (5 districts, first annex 1.72h against 1.73h) and the disciplined
 * policy is better off (6 districts against 5). See tools/economy.calibrate.mjs.
 */
export const TRADE_EXPONENT = 0.5;

export const TRADE_LADDER = LEVEL_CAPACITY.map(
  (capacity) => (capacity / (LEVEL_CAPACITY[0] ?? 1)) ** TRADE_EXPONENT,
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

/**
 * Trips one shop serves at each level.
 *
 * Two factors and they say different things. The footprint is per *building* —
 * a retail park is two shopfronts knocked together and serves two shopfronts'
 * worth — and TRADE_LADDER is per *plot*: a shopfront on the ground floor of a
 * trade tower serves more trade than a corner shop does. Keeping them as two
 * factors is what keeps the per-plot and per-building readings from drifting,
 * which is the distinction SHOP_JOBS' comment has always defended.
 */
export const SHOP_TRIPS = LEVEL_FOOTPRINT.map(
  (f, l) => SHOP_THROUGHPUT * (TRADE_LADDER[l] ?? 1) * f,
) as readonly number[];

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

/**
 * Goods one shop draws and one works makes, per level.
 *
 * Both take TRADE_LADDER, and taking it as a matched pair is the point: a
 * bigger shop sells more and a bigger works makes more, so the goods cycle's
 * *shape* is left where SUPPLY_DRAW and INDUSTRIAL_OUTPUT put it and only the
 * flat export tap is diluted against it. Measured on a district built out at one
 * level, industrial demand reads +0.39 / +0.15 / +0.06 / +0.02 / +0.01 against a
 * flat ladder's +0.39 / +0.10 / +0.02 / +0.01 / 0.00 — so industry stays worth
 * building a rung or two longer than it used to, which is the direction the
 * estates were built to relieve rather than the one they were built to cause.
 *
 * Estates are the one industrial supply that does *not* take the ladder, and
 * cannot: `estateSupply` reads ESTATE_PLOTS against `industryScale`, and an
 * estate holds no level of its own. So a band of works is worth relatively less
 * to a city high on the ladder than it was — see ESTATE_YIELD, whose own
 * measurement is re-checked against this.
 */
export const SHOP_SUPPLY = LEVEL_FOOTPRINT.map(
  (f, l) => SUPPLY_DRAW * (TRADE_LADDER[l] ?? 1) * f,
) as readonly number[];
export const INDUSTRY_OUTPUT = LEVEL_FOOTPRINT.map(
  (f, l) => INDUSTRIAL_OUTPUT * (TRADE_LADDER[l] ?? 1) * f,
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

/**
 * What the city's *services* do to demand, beyond the mood they buy.
 *
 * Until this table existed, everything the player built reached demand through
 * exactly one channel: happiness, and only as a ceiling on residential. A
 * hospital and a park and a police station were interchangeable to the demand
 * loop — three ways to move one number — so *what* you built changed how happy
 * the city was and never what it wanted next. These are the other channels.
 *
 * Each entry is an additive term on one signal's target, applied before
 * `clampDemand` and inside it, so the bounds are the bounds they always were.
 * `centred` says how the reading is read: a coverage is centred on 0.5, so a
 * half-covered city is neutral and the term cuts both ways; a bonus (a landmark
 * reach, a tax pressure) is read raw from zero, because a city with no landmarks
 * has not earned a penalty for it.
 *
 * The design each weight is carrying, which is the part to preserve if the
 * numbers move:
 *
 *   - **housing follows safety and health.** People move toward a covered city.
 *     Police and hospitals stop being pure mood and become growth, and they are
 *     the two heaviest terms here because they are the two the tutorial is
 *     built on;
 *   - **commerce follows footfall.** Transit brings shoppers and landmarks bring
 *     visitors, so both go on mattering after the happiness they buy has
 *     saturated. Landmarks are the heaviest single positive in the table for
 *     exactly that reason: they are the one thing whose mood contribution caps
 *     out long before the building stops being worth having;
 *   - **industry follows skills.** Schools and universities stop being only a
 *     level gate;
 *   - **tax has a third dimension.** Punitive costs mood already; it should also
 *     drive business away. That is what makes the switch a strategic choice
 *     rather than a dial on one number, and it is why the tax weights are the
 *     largest in the table and negative on both trading zones.
 *
 * Two things this table deliberately does *not* do. It does not touch industry
 * with a transit term — `labourReach` already is one, and counting the network
 * twice on the same signal would be a bigger lift for a depot than a depot does.
 * And it carries no term at all for a city with no housing: every coverage in
 * this game reads 1 against no housing, because a coverage is the share a
 * service *fails* and it fails nothing when nothing is built, so an ungated
 * table would hand a fresh save +0.225 of residential demand on its first tick
 * and the opening would no longer bootstrap off the export tap. See
 * `demandLift`, where the gate lives.
 *
 * What the table did over 24 hours, and it is a trade rather than a win:
 *
 *   policy                  R pinned      C pinned      districts   first annex
 *   auto-develop            0m -> 0m      0m -> 0m        5 -> 6     1.72 -> 1.25h
 *   discount-chasing      987m -> 0m    496m -> 952m      9 -> 9     4.99 -> 6.25h
 *   disciplined             0m -> 0m      0m -> 0m        6 -> 6     1.66 -> 2.15h
 *
 * The residential pin is *gone* — the signal the capacity ladder could not
 * reach, unpinned by a table that was not written to fix it. What did it is the
 * +0.225 a fully covered city now carries on housing, which lifts a
 * discount-chasing city off the -1 bound it used to sit on for 16 hours of every
 * 24. The same mechanism is what made commerce worse: a covered city carries
 * +0.175 on commerce as well, and commerce was already the signal nearest its
 * upper bound.
 *
 * Worth stating plainly, because it is the honest reading of these weights: a
 * coverage term centred on 0.5 becomes a *constant* once the coverage
 * saturates, so most of what it does over a long run is re-centre the
 * equilibrium rather than offer a decision. The decision is in the transition —
 * the hour a city spends going from uncovered to covered — and that is real and
 * visible. If the terms should be about neglect only, centring them on 1
 * instead of 0.5 would leave a covered city exactly where it was and turn every
 * one of these into a penalty for going without; it is a one-character change
 * per row and it is the first thing to reach for if the commercial pin matters
 * more than the residential one did.
 *
 * The other two policies are better off on every axis measured: a district
 * sooner, half an hour earlier to the first annexation, and 89% happiness at one
 * hour against 78%. The discount-chasing policy is slower to start — 6.25 hours
 * to its first annexation against 4.99 — because an uncovered opening now pays a
 * demand penalty it did not before, which is the tutorial doing its job to a
 * policy built to ignore it.
 */
export interface DemandTerm {
  /** What the reading is drawn from. Not unique on its own — `zone` completes it. */
  readonly key: 'police' | 'hospital' | 'recreation' | 'transit' | 'landmark' | 'education' | 'tax';
  readonly zone: 'home' | 'shop' | 'industry';
  /** What the HUD calls it. */
  readonly label: string;
  readonly weight: number;
  /** True for a coverage, read against 0.5. False for a bonus, read from 0. */
  readonly centred: boolean;
}

export const DEMAND_TERMS: readonly DemandTerm[] = [
  { key: 'police',     zone: 'home',     label: 'Police coverage',  weight:  0.20, centred: true },
  { key: 'hospital',   zone: 'home',     label: 'Health coverage',  weight:  0.15, centred: true },
  { key: 'recreation', zone: 'home',     label: 'Parks',            weight:  0.10, centred: true },
  { key: 'transit',    zone: 'shop',     label: 'Transit footfall', weight:  0.25, centred: true },
  { key: 'landmark',   zone: 'shop',     label: 'Landmark reach',   weight:  0.20, centred: false },
  { key: 'education',  zone: 'shop',     label: 'Education',        weight:  0.10, centred: true },
  { key: 'tax',        zone: 'shop',     label: 'Tax rate',         weight: -0.30, centred: false },
  { key: 'education',  zone: 'industry', label: 'Education',        weight:  0.20, centred: true },
  { key: 'tax',        zone: 'industry', label: 'Tax rate',         weight: -0.35, centred: false },
];

/**
 * The most any one term may move a signal, and the most the whole table may.
 *
 * Derived rather than typed, because the property worth asserting is that no
 * single service can pin a signal on its own — `test/services.test.ts` reads
 * these rather than a pair of literals that would rot the moment a weight moved.
 * A centred term spans half its weight either way; a bonus term spans all of it.
 */
export const DEMAND_TERM_MAX = Math.max(
  ...DEMAND_TERMS.map((t) => Math.abs(t.weight) * (t.centred ? 0.5 : 1)),
);

// ------------------------------------------------------------------- zoning

/**
 * The least land a zone keeps in a district, in plots, however unwanted it is.
 *
 * A district still sells exactly 82 plots — that number is geometry, not
 * balance, and it does not move. What moves is the split, and these are the
 * stops at the bottom of it: no amount of sustained negative demand can zone a
 * type out of a district entirely, because a district with nowhere at all to
 * live is a district that can never recover the demand that would fix it.
 *
 * Read as *at least*, not exactly. The pool is drawn in whole parcels — see
 * `districtPool` — so a floor lands on the first parcel boundary at or past
 * these, which is 8 or 9 plots rather than 8 on the nose. Nothing multiplies a
 * per-district constant any more (`homeCapacity` is a sum over districts now),
 * so the exactness that FRONTAGE_TARGET needed is not needed here.
 */
export const ZONE_FLOOR = {
  home: 8,
  shop: 8,
  industry: 4,
} as const;

/**
 * Plots industry may survey on top of its floor, and the whole of its range.
 *
 * Industry does not draw from the shared pool, and cannot: three zones taking
 * prefixes of one pool is a contradiction rather than a tuning problem. If
 * residential can take nearly all of a pool of N, then at (N-1, 1, 0) commerce's
 * first plot is forced onto the one cell residential leaves, at (N-1, 0, 1)
 * industry's first plot is forced onto that same cell, and (0, 1, 1) — two plots
 * surveyed of N — has them both claiming it. Two zones have no such
 * contradiction, because one can fill from each end.
 *
 * So industry takes a reserve of its own and residential and commerce contest
 * the rest. 9 plots on top of a floor of 4 keeps industry's ceiling at the 13 it
 * has today, which is the number every goods constant was measured against.
 *
 * The consequence is worth stating rather than discovering: **an industry-led
 * city is impossible by construction.** Industry tops out at 13 of 82 plots —
 * 16% — where residential and commerce can each reach 61, or 74%. No amount of
 * industrial demand makes industry the dominant zone inside the city. The outlet
 * is the estates, which stand on land the city does not own and are counted
 * apart from every plot total for exactly that reason.
 *
 * What industry gives up is not deleted. A district that surveys 6 of its 13
 * releases the other 7 to residential and commerce when it freezes — see
 * `freezeDistrict`. It cannot be released *live*, because commerce fills the
 * pool from the back and a pool whose size moved with the industrial count would
 * move every commercial plot in the district each time industry surveyed.
 */
export const INDUSTRY_RESERVE = 9;

/**
 * The demand a zone needs before the surveyor will zone it more land.
 *
 * Above the noise a settled city sits at — the disciplined policy ends a day at
 * R -0.36 / C +0.53 / I +0.30 — so a city drifting near balance does not slowly
 * rezone itself into whatever it happened to want last. It has to actually be
 * short.
 */
export const SURVEY_DEMAND = 0.35;

/**
 * How built-out a zone has to be before more of it is worth zoning.
 *
 * The constant that stops the surveyor being a stall. Derived growth means the
 * price of a plot falls when the allotment it is counted against grows, so a
 * player who stops building while the surveyor runs is paid to wait — measured
 * on the unmodified design, waiting five surveys beat building through them by
 * 1.7x at three hours and 23x at twenty-four, because the saving is a fraction
 * of a price that compounds while the forgone income is a flat rate.
 *
 * This closes it, and closes it by construction rather than by balance. A move
 * takes the zone from `n / A` to `n / (A + size)`, so the fill ratio falls
 * strictly and the gate shuts itself; it reopens only when the player builds
 * again. A zone that was already *past* the gate may take a second parcel on the
 * way under it — 20 built of 24 reads 0.833, and one plot more of land reads
 * exactly 0.800 — so the bound is a parcel or two rather than exactly one.
 * Measured, a city that stops building mid-move gains at most four plots and
 * then stops. There is no clock to wait out either: the surveyor is a predicate
 * on the state, checked every tick like `autoAnnex`, not a periodic pass.
 *
 * 0.8 rather than ANNEX_MIN_OCCUPANCY's 0.7 because this gate fires far more
 * often and against a much smaller denominator: a zone at its floor holds 8
 * plots, so 0.7 and 0.8 are 5.6 and 6.4 of them, and the tighter one is what
 * keeps a district from surveying on the strength of two buildings.
 *
 * What the whole of it bought, and it is the debt TRADE_LADDER's comment left
 * open. The demand-neutral build-out of one district, per level held, against a
 * 70% annexation gate:
 *
 *   level              flat ladder   sqrt ladder, fixed land   with zoning
 *   detached housing         55.1%                     55.1%        100.0%
 *   apartments               10.1%                     11.2%          9.0%
 *   towers                   89.9%                     24.7%        102.2%
 *   arcologies               78.7%                     24.7%         94.4%
 *   megastructures           76.4%                     40.4%         92.1%
 *
 * The middle column is what the capacity ladder cost on land fixed at 24 / 45 /
 * 13, and the right is that same ladder against land that follows demand. A
 * district of towers that wants eight commercial plots rather than twenty-three
 * now *zones* itself for eight and fills them, which is the argument the ladder
 * was accepted on. The apartments row is a probe artefact and reads about 10%
 * in all three columns.
 */
export const SURVEY_FILL = 0.8;

/**
 * Seconds between the surveyor's passes.
 *
 * A clock, and it is here for step-size invariance rather than for pacing. The
 * surveyor was built without one — a predicate on the state, acted on every tick
 * like `autoAnnex` — and that is not invariant: a pass per *tick* means a
 * 60-second catch-up step makes one move where six hundred tenth-second ticks
 * make up to six hundred. Measured, an hour away rezoned a district to 11
 * parcels where an hour watched reached 13.
 *
 * So it accumulates, in the shape `fireHazard` and the levelling drift already
 * use: seconds bank up and whole passes are spent out of the bank, which gives
 * the same answer at any step size the loop is run at.
 *
 * The clock does *not* reopen the stall, and the reason is worth being precise
 * about because the first design removed it for exactly that fear. What kills
 * the stall is SURVEY_FILL: a move drops the zone under its own gate, so waiting
 * harvests a parcel or two whenever it happens and no more. The clock decides
 * when that lands, never how much of it there is.
 *
 * 20 seconds against demand's 25: fast enough that a zone that has just filled
 * does not wait a visible beat for the land it has earned, slow enough that the
 * signal it reads has moved between passes.
 */
export const SURVEY_SECONDS = 20;

/**
 * Surveys a single `catchUp` call may make, however long the absence.
 *
 * The same guard CATCHUP_MAX_ANNEXES and CATCHUP_MAX_ABANDONED are, and set for
 * the same reason: a twelve-hour absence must not return a city whose zoning
 * nobody watched change. Larger than either of theirs because a survey is a
 * parcel rather than a district or a building, and because the surveyor is
 * self-limiting — every survey shuts its own gate until the player builds.
 */
export const CATCHUP_MAX_SURVEYS = 8;

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
 * Every number in that paragraph is quoted at twelve homes, and that is not a
 * coincidence — twelve is the smallest city this gate has ever been measured
 * against. COVERAGE_GRACE_PLOTS is what happens below it: a city smaller than
 * the one the gate was calibrated for is charged for its shortfall in
 * proportion, so the gate cannot shut in front of a village that has no way to
 * earn the building it is being asked for.
 *
 * Measured against a player who buys the moment they can: the gate first bites
 * at 1.8 minutes and 11 homes, on a city earning 4.1/s — so the hospital the
 * panel names is 32 seconds of income away, and opens at 2.2 minutes. The stall
 * is not dead time: shops and industry are both still buildable through it.
 */
export const HAPPINESS_MIN_BUILD = 0.35;

/**
 * Housing plots a city has to hold before a coverage shortfall counts in full.
 *
 * `coverage` has always had a special case at the bottom: a city with no
 * housing reads as fully covered, because coverage is the share of the housing
 * a service *fails* and it fails nothing when nothing has been built. That rule
 * is right and it was a step function — one plot of housing took every service
 * from "fails nobody" to "fails everybody", and the city was handed a 130
 * hospital to fix it. This is the same rule made continuous: the shortfall
 * fades in as the city grows, and reaches its full weight here.
 *
 * The step was a soft-lock rather than a stall, and the shape of it is why.
 * Income is quadratic in happiness — it is scaled once by HAPPINESS_FLOOR and
 * again through occupancy — so a collapsed city earns 0.55 x 0.08 / 0.92, or
 * 4.8% of what the same buildings earn happy. Measured on the reported save,
 * one home and one park and one shop: happiness 18%, income 0.08/s, the housing
 * gate shut, and 28 minutes of doing nothing to afford the hospital the panel
 * was naming. Everything the city could still buy — shops, industry — multiplies
 * an income proportional to residents it was no longer allowed to house.
 *
 * The clock this replaces (a flat 120 seconds at HAPPINESS_MIN_BUILD) missed it
 * because a clock measures the player, not the city. It was set from a player
 * who buys housing the instant they can afford it, and that player never needed
 * it; a player who spends the first two minutes reading the panel arrives at
 * second 121 with one house, no income and the gate already shut. Size is the
 * axis the failure was actually on, so size is what the grace is on now.
 *
 * 12 rather than 24, which would have been a whole district's housing: this has
 * to be small enough that every calibration in this file still lands exactly
 * where it was measured. At twelve plots the share is 1 and nothing above it
 * moves at all — the tutorial above still costs two purchases, a hospital at
 * twenty plots still reads 100%, and the whole endgame is untouched. What moves
 * is the first eleven plots, which is the stretch no number here was ever
 * quoted against.
 */
export const COVERAGE_GRACE_PLOTS = 12;

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
 * policy, and no policy spends a second unable to make its wages. Power plants
 * joined the payroll after that measurement and take the same run to 20.6%,
 * which is the number to judge a further addition against. What it costs
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

// ------------------------------------------------------------------- power

/**
 * What one plot draws, per zone, at the bottom of the level ladder.
 *
 * The city's second resource, and the first thing in the game that can be
 * *short*. Power is not a demand signal like R/C/I — it is a ratio of supply to
 * draw, derived rather than integrated, because occupancy already lags on a
 * 120-second constant and a second lag stacked on top of it would make the whole
 * system sluggish and unreadable. See `powerCap`, which is where the ratio lands.
 *
 * Industry draws three times what housing does and commerce half again, which is
 * the one part of this that is a judgement rather than a measurement: a works is
 * the heaviest thing on the grid, a shop lit and refrigerated all day is next,
 * and a house is the unit. What the ratios have to be is *different enough to
 * matter* — a city that zoned nothing but industry should feel the difference —
 * and small enough that the mix does not swamp the level ladder, which is the
 * term that actually decides how much power a city needs.
 *
 * A district at level 0 therefore draws 24 x 1 + 45 x 1.5 + 13 x 3 = 130.5,
 * which is the number POWER_BASE and POWER_PER_PLANT are both set against.
 *
 * Per *plot*, and per plot of what is standing rather than of what is occupied.
 * A boarded-up house draws nothing because it holds no level and so is in no
 * cohort; an empty one draws its full share, because the grid is sized to the
 * building and not to the tenant. That is what keeps a shortfall a shortfall:
 * if draw fell with occupancy the brownout would cure itself and there would be
 * no decision in it.
 */
export const POWER_PER_PLOT = {
  residential: 1,
  commercial: 1.5,
  industrial: 3,
} as const;

/**
 * How much faster than the level ladder a plot's draw climbs.
 *
 * Above 1 by design — "a megastructure is not four arcologies' worth of anything
 * else" — and the interesting part is that the *land* sets the ceiling. A
 * district holds exactly one 2x2 square for a power plant (see
 * FRONTAGE_TARGET.powerSites), so the exponent is only viable if one plant can
 * still carry a district built out at the top of the ladder.
 *
 * Measured, in plants a district needs at POWER_PER_PLANT, against the 1.00 its
 * square holds:
 *
 *   exponent     L0     L1     L2     L3     L4
 *   1.00       0.19   0.19   0.19   0.19   0.19
 *   1.10       0.19   0.21   0.25   0.29   0.33
 *   1.20       0.19   0.25   0.33   0.44   0.58
 *   1.25       0.19   0.26   0.38   0.55   0.78
 *   1.30       0.19   0.28   0.44   0.68   1.03   <- does not fit
 *   1.40       0.19   0.32   0.59   1.05   1.83   <- does not fit
 *
 * So 1.25 is not a taste, it is the last rung that fits: at 1.30 a fully built
 * megastructure district needs more plant than its land can hold and the city
 * browns out permanently at the top of a ladder it was allowed to climb. At 1.00
 * the term does nothing at all — a district needs the same fifth of a plant
 * whatever is standing on it, so the resource would never once be short.
 *
 * What 1.25 buys is a four-fold climb in what a district needs across the
 * ladder, with 22% headroom left at the end of it. The pressure arrives with
 * every promotion wave rather than with expansion, which is the right way round:
 * annexing land brings its own square with it.
 */
export const POWER_EXPONENT = 1.25;

/**
 * What one plant makes, per unit of the standard the city is built to.
 *
 * Scaled by `cityScale` rather than flat, and it is the same argument
 * ESTATE_YIELD's `industryScale` makes: a plant has no level of its own to climb
 * — no education gate, no merge, no cohort in the save — so it is built to
 * whatever standard the city around it is built to. A flat figure would make one
 * plant the whole grid at the bottom of the ladder and a rounding error at the
 * top, which is the shape every constant in this file that ignores the ladder
 * ends up with.
 *
 * 700 is set against the land: a district holds one square, and a district built
 * out at megastructures has to fit inside it with room to spare. At 700 it needs
 * 0.78 of a plant, so a fully built city of forty-nine districts runs at a
 * supply ratio of about 1.29 with every square used. Raising it would leave the
 * land gate never binding at all; lowering it puts the top of the ladder out of
 * reach of the ground it stands on.
 */
export const POWER_PER_PLANT = 700;

/**
 * The grid the city is on before it builds one of its own.
 *
 * Exactly the job EXPORT_BASE does for industrial demand, and there for the same
 * reason: without it a fresh save is short of a resource it has no way to make
 * yet, occupancy is capped at POWER_FLOOR from the first tick, and the opening
 * is a brownout nobody caused. The city starts connected to somebody else's
 * grid and grows out of it.
 *
 * Flat, and deliberately not per-district. A baseline that grew with the map
 * would never be outgrown and the resource would never be short. 400 covers a
 * district at level 0 (130.5) three times over and one at apartments (739) not
 * at all — so the first plant is what the first promotion wave asks for, which
 * is about an hour in. That is the same beat the happiness gate teaches at
 * eleven homes: something the city can suddenly not do, with the reason on
 * screen and the fix one purchase away.
 */
export const POWER_BASE = 400;

/**
 * What share of its occupancy a city with no power at all keeps.
 *
 * The floor under the cap, and the guard on the death spiral the brief names:
 * less power means less occupancy means fewer residents means less income means
 * no plant. Without a floor that loop has a fixed point at zero.
 *
 * 0.35 rather than something smaller, and the number is derived rather than
 * chosen. A blacked-out city that is otherwise perfectly happy sits at
 * OCCUPANCY_FULL x this — 0.92 x 0.35 = 0.322 — and OCCUPANCY_EMPTY is 0.25, so
 * it stays *above* the line where the vacancy clock starts. A brownout therefore
 * costs a city its residents and its income and never its buildings. That is the
 * distinction the whole feature rests on: the resource caps occupancy rather
 * than zeroing income, and a city that empties can be refilled where one that
 * rotted has to be rebuilt.
 *
 * An unhappy browned-out city does still rot, and that is left as it is: what is
 * killing it is the unhappiness, and the power term is not there to insure
 * against every other failure at once.
 */
export const POWER_FLOOR = 0.35;

/**
 * What a plant costs, and how hard it compounds.
 *
 * Steeper than the civic curve rather than gentler, which looks wrong for a
 * building the city *must* have and is not: a plant is bounded by land at one a
 * district, so the count can never run away, and the city's income grows
 * quadratically in the district count while this grows exponentially in it. What
 * a steep curve buys is that the last plants are a real decision at a point in
 * the game where 130 for a hospital is not.
 *
 * Measured (tools/power.calibrate.mjs): a city left to develop itself is first
 * short of power at 83.3 minutes, buys its first plant in the same tick, and
 * never drops below a supply ratio of 0.99 for the rest of a 24-hour run. It
 * ends on four plants of the five squares it owns, with the next one at 3,980
 * against a ledger of 2.39e7 a second — so the price never once decides whether
 * the lights stay on, which for mandatory infrastructure is the property that
 * matters. On the biggest city the map allows the last plant is 5.01e10 against
 * a ledger of 9.04e9 a second: five seconds of income, and still the dearest
 * thing on the panel.
 *
 * What the plants cost to *run* is the larger number: they take the civic wage
 * bill from 16.6% of gross income to 20.6% over the same run.
 */
export const POWER_PLANT_BASE = 900;
export const POWER_PLANT_GROWTH = 1.45;

// -------------------------------------------------------------- city hall

/**
 * What the city hall costs, once, for the only one there will ever be.
 *
 * Flat rather than compounding, because there is nothing to compound over: the
 * save holds a boolean. Every other civic curve in this file exists to price the
 * *n*-th of something, and this has no n.
 *
 * Priced as a milestone rather than against a return. What it buys is the Taxes
 * tab and the auto-develop switch, and neither has a rate you can divide into a
 * price — the tax control is worth anywhere from -8% to +60% of the ledger
 * depending on how well covered the city is, and auto-development is worth
 * whatever the player would otherwise have clicked. So it is set where it sits
 * in the order of things a player buys, which is the ordering this file already
 * states: a home at 8, a shop at 11, a park at 45, a works at 120, a hospital at
 * 130, a school at 180, a police station at 210, a depot at 260, a fire station
 * at 320 — and then this, an order of magnitude past the last of the services
 * and an order short of the first landmark at 4,000.
 *
 * Measured (tools/economy.calibrate.mjs), and the measurement says something
 * the price cannot fix. The hall lands at 1.34 hours under auto-development and
 * 1.36 under the disciplined policy, against a first service at 10.3 and 27.0
 * minutes and a first annexation at 1.73 and 1.65 hours — so it sits where it
 * should, between the tutorial the happiness gate teaches and the first
 * expansion. But it lands there almost regardless of what it costs:
 *
 *   price    hall opens (auto-develop)
 *     400        1.21h
 *     800        1.28h
 *   1,500        1.34h
 *   3,000        1.42h
 *
 * A seven-fold price change moves the unlock by thirteen minutes, because what
 * gates it is the opening's ramp rather than the number: a city that will annex
 * at 1.73 hours has a treasury measured in tens of thousands by then, and
 * anything in this range is a speed bump on the way. So the price is set by
 * where it belongs in the order rather than by a pacing target it cannot hit,
 * and it is worth being explicit that pulling this lever to move the unlock
 * would not work.
 *
 * The discount-chasing policy takes 4.79 hours, which is the same policy that
 * takes 3.72 hours to afford a hospital — the ordering holds for the player who
 * ignores services too.
 *
 * It carries upkeep like every other civic building and no happiness weight at
 * all: the four happiness weights sum to exactly 1 and re-opening that
 * calibration to buy a UI gate would be a bad trade. See `civicPayroll` for what
 * the wage bill costs, which is 2.0% of a one-district city's gross income and
 * 0.0% of a full map's.
 */
export const CITY_HALL_BASE = 1_500;

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
 * against a build that pinned nothing at all. At 0.35 the term was worth about
 * 0.14 of a demand point to that same city — a lift a player can see on the
 * bar, and nothing pins.
 *
 * Cut from 0.35 to 0.30 when DEMAND_TERMS gave commerce a transit term of its
 * own, and the cut is the whole of what stops the network being counted twice.
 * The two say different things through one set of buses — this one carries
 * *workers* to premises and the footfall term carries *shoppers* to shops — but
 * they land on the same signal, and a depot that lifted commercial demand
 * through both channels at full strength would be worth more than a depot is.
 * 0.30 gives back roughly what the footfall term's ceiling adds, and the
 * measurement to watch is the combined transit contribution to commerce rather
 * than either term alone.
 */
export const TRANSIT_LABOUR_DRAW = 0.30;

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

// ------------------------------------------------------------------- traffic

/**
 * Trips one resident puts on the road in a second.
 *
 * Derived from the two shares the rest of the model is already built on rather
 * than typed as a third: WORKING_SHARE is the share of residents who go to
 * work and SPEND_PER_RESIDENT is the shopping trips they generate, so their sum
 * is a resident's day. Typing a number here would be a third statement about
 * what a resident does, free to drift from the two that decide the labour
 * market and the high street.
 *
 * Driven by *residents* rather than by `min(workers, jobs)`, and the
 * measurement is why. Jobs are flat per plot while residents are not, so a
 * mature city is enormously worker-rich — 714,067 workers against 27,924 jobs
 * at 49 districts of megastructures — and commuting per capita collapses as the
 * city grows. Against matched pairs a finished city reads as having almost no
 * traffic at all, which is the opposite of true: a resident with nowhere to
 * commute to still shops, still runs errands, and is still on the road.
 */
export const TRIPS_PER_RESIDENT = WORKING_SHARE + SPEND_PER_RESIDENT;

/**
 * How hard density is discounted when trips are measured against road supply.
 *
 * The one constant in this file that exists purely to stop a signal pinning, and
 * the same job `cityScale` does for demand. Trips against a fixed road supply
 * span a 150x range over the level ladder — 1.14 trips per road cell at level 0
 * against 170.28 at level 4, on a fully built city — which is exactly the
 * failure DEMAND_SCALE's comment describes.
 *
 * Measured, trips per road cell divided by `cityScale ** p` on a fully built
 * city at each level — see tools/traffic.calibrate.mjs, which prints this:
 *
 *     p       L0     L1     L2     L3     L4    L4/L0
 *   0.50    1.14   2.29   4.79   9.92  19.83    17.3x
 *   0.60    1.14   1.99   3.60   6.44  11.21     9.8x
 *   0.75    1.14   1.62   2.34   3.37   4.76     4.2x
 *   0.85    1.14   1.41   1.76   2.19   2.69     2.4x
 *   1.00    1.14   1.14   1.14   1.14   1.14     1.0x
 *
 * The bottom row is worth understanding before choosing anything above it: at
 * p = 1 the ladder is *exactly* flat, and not approximately. Population is
 * `housing plots x cityScale x LEVEL_HOUSING[0]` by construction, so trips
 * driven by residents are exactly proportional to `cityScale` and dividing by
 * it removes density completely. That makes p a clean design dial — how much
 * of a city's density it is charged for — running from "all of it" at 0 to
 * "none of it" at 1, with no perverse region anywhere in between.
 *
 * ---
 *
 * **This corrects the table the brief for this feature carried**, which read
 * 1.15 / 1.62 / 1.94 / 1.88 / 2.37 at p = 0.75 and concluded that full
 * normalisation *inverts* the sign — that towers would reduce congestion. That
 * table was computed with trips as `min(workers, jobs) + shopping`, which is
 * the matched-pairs definition the same brief then says not to use: the two
 * agree at level 0, where jobs are plentiful, and diverge as the city grows
 * worker-rich. Under residents-driven trips there is no inverting region to
 * avoid, and p = 0.75 charges a tower for rather more of its density than the
 * brief's "roughly double" expected — 4.2x end to end rather than 2.1x.
 *
 * 0.75 is kept because it is what was chosen and because it is defensible on
 * its own terms: a tower puts three hundred people on one plot fronting the same
 * street, and charging that four times over is closer to true than twice. What
 * it costs is the top of the ladder, which sits near the clamp — see
 * CONGESTION_SCALE. 0.85 is the value that reproduces the brief's stated intent
 * (2.4x, and a top-of-ladder city reading 0.77 rather than 0.99) and is a
 * one-character change if the pacing wants it.
 */
export const CONGESTION_DENSITY_EXPONENT = 0.75;

/**
 * What counts as a jammed city, in density-adjusted trips per road cell.
 *
 * The divisor that turns the table above into a number in [0, 1]. Set so a
 * mid-ladder, transit-free city reads about half and the top of the ladder
 * stops just short of the clamp. Measured, transit-free, at every district
 * count (the reading does not vary with size — road supply and residents grow
 * together):
 *
 *     L0     L1     L2     L3     L4
 *   0.24   0.34   0.49   0.70   0.99
 *
 * So a city that has never opened a depot goes from "a bit slow" to jammed as
 * it climbs, which is the pressure the feature exists to apply, and a fully
 * covered one reads 0.50 at the top of the ladder against 0.30 with the fares
 * waived. Nothing clamps, but the top of the ladder is close enough to 1 that a
 * larger CONGESTION_DENSITY_EXPONENT would have to come with a larger divisor
 * here — see the exponent's note.
 */
export const CONGESTION_SCALE = 4.8;

/**
 * Share of a city's trips a fully covered transit network takes off the road.
 *
 * The lever, and the point of the whole feature. TRANSIT carries `weight: 0` in
 * SERVICES — the four happiness weights sum to exactly 1 and a fifth would
 * re-open a calibration that has held for three cycles — so a depot has never
 * had a mood story. Congestion gives it one without touching those weights,
 * because it lands in the modifier bracket beside the tax step and LANDMARK_MOOD.
 *
 * Set from the ceiling rather than picked. `test/services.test.ts` asserts that
 * a city which has bought everything the land allows reaches at least 0.95
 * happiness at every size, and that promise predates this feature: neglect is
 * supposed to read as a ceiling on what a city can become, not as a tax on
 * playing well. At 0.5 a maxed 49-district city at the top of the ladder still
 * sat at 0.30 congestion with every depot open, which is -0.042 of mood and
 * 0.93 — so the ceiling would have moved, and a constant that quietly lowers
 * the best a city can ever feel is a constant that has re-opened someone else's
 * calibration.
 *
 * 0.70 is what keeps it: fully covered reads 0.30 jammed at the very top of the
 * ladder, which is -0.042 and lands at 0.958. Everything below the top is
 * better than that. Measured, transit-free against fully covered against fares
 * waived, on a 12-district city — see tools/traffic.calibrate.mjs.
 */
export const TRANSIT_ROAD_SHARE = 0.7;

/**
 * How much more of the city rides when the fares are waived.
 *
 * The second half of what free transport buys, and distinct from
 * FREE_TRANSPORT_REACH: that one makes the same depots *reach* a third further,
 * which is a statement about coverage, and this is a statement about the people
 * already covered choosing the bus over the car.
 *
 * A fully covered city with the fares waived takes 0.70 x 1.35 = 94.5% of its
 * trips off the road, so it reads about 5% jammed at the very top of the ladder
 * and nothing at all below it. That is the brief's "a fully covered city loses
 * nothing", and it is deliberately 94.5% rather than a round 100: a city with
 * no cars on it at all would be a claim, and the last twentieth is the freight
 * and the people who will drive whatever is running.
 */
export const FREE_TRANSPORT_RIDERSHIP = 0.35;

/**
 * Happiness lost to a completely jammed city.
 *
 * Sized against the punitive tax rate's -0.14, which is the largest modifier
 * already in the bracket: sitting in traffic all day should cost a city about
 * what taxing it to the hilt does, and a fully covered network should give
 * essentially all of it back. A modifier rather than a fifth weight, for the
 * reason LANDMARK_MOOD and FREE_TRANSPORT_MOOD are both modifiers — the four
 * weights sum to 1 and go on doing so.
 */
export const CONGESTION_MOOD = 0.14;

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
 * What a fully landmarked city is worth in arrivals, in cruise berths.
 *
 * Road tourism, and it is stated in berths for exactly the reason
 * AIRPORT_VISITORS is: `visitors` is one expression — residents x
 * VISITORS_PER_RESIDENT x happiness, per berth — and a second path beside it
 * would be a second place for the happiness scaling to be got wrong. A coach is
 * a berth that arrives by road.
 *
 * Driven by landmarks rather than by a terminal, which is what makes it worth
 * having at all: a quay needs a coastal district and a runway needs the
 * highway's fourteen, so a landlocked young city has no tourism whatsoever. A
 * museum is buildable from district one. `landmarkCoverage` reads 0.19 at one
 * museum plus one stadium over four districts and 0.92 at four of each, so this
 * ramps in over the same purchases that were already lifting the mood.
 *
 * Two berths at full coverage, against the six a full waterfront holds and the
 * three an airport is worth. A city that has covered itself in landmarks has
 * about a third of a coast, which is the right order for something bought for
 * another reason entirely.
 */
export const ROAD_VISITORS = 2;

/**
 * Shopping trips one visitor generates, against SPEND_PER_RESIDENT's 0.5.
 *
 * The whole of what makes tourism scale, and the reason it needed to. Tourism
 * sits outside the income bracket — rent is multiplied by `bonuses` over shops
 * and industry and a visitor's spend is not — so measured against a ledger that
 * compounds, one cruise berth is 3.4% of income at one district and 0.0003% at
 * forty-nine. A new arrivals path on the same line would be invisible within an
 * hour of play.
 *
 * So visitors are routed into *commerce* instead: they are people in the city
 * doing what people in the city do, and what they do most is shop. That reaches
 * income the way everything else does — through commercial demand, the shops it
 * justifies, and SHOP_BONUS — rather than through a line of its own, and it
 * feeds the R -> C -> I cycle rather than sitting beside it.
 *
 * **Two fifths of a resident's, and the flavour argues for more.** A visitor is
 * in the city *to* spend where a resident also works and sleeps, so three times
 * a resident was the first number tried. It does not survive the measurement,
 * and the reason is worth stating: `visitors` is not a small number. A full
 * waterfront is six berths, the airport is three more and full landmarks are
 * two, and at VISITORS_PER_RESIDENT that is 29% of the resident count standing
 * in the city at any moment. Measured across {1,4,12,25,49} districts x {0..4}
 * levels, with every berth, the runway and every landmark:
 *
 *     trips/visitor   share of the city's shopping   configurations newly pinned
 *          0.10                      5.5%                        0 of 25
 *          0.20                     10.4%                        0 of 25
 *          0.30                     14.8%                        0 of 25
 *          0.50                     22.4%                        3 of 25
 *          1.50                     46.5%                        3 of 25
 *
 * Commerce is the signal nearest its upper bound — DEMAND_TERMS says so in its
 * own comment — so a term that pins it is a term that has taken the decision
 * away rather than added one. 0.20 is the largest value that lifts commercial
 * demand everywhere and pins it nowhere it was not already pinned, and it still
 * hands the most touristed city a tenth of its retail.
 *
 * The honest reading of the number, then, is spend-weight rather than bodies:
 * `visitors` is what the tourism model calibrated as a berth's worth of trade,
 * and this is how much of that trade lands on the high street.
 */
export const VISITOR_TRIPS = 0.2;

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

// ------------------------------------------------------------------ airport

/**
 * What the airport costs to build.
 *
 * Derived against the annexation curve rather than against the port, and the
 * derivation is what makes it a late commitment rather than another button:
 * it is exactly what the *next* district would cost at the moment the highway
 * opens. So a player standing at the end of the road is choosing between one
 * more district of their own land and the thing at the end of it, which is the
 * same decision HIGHWAY_COST is priced against one step earlier — and the
 * airport is 3.4x the road, because it is what the road was for.
 *
 * Pricing it against TERMINALS instead was the obvious alternative and is
 * wrong. A cruise berth opens at 20,000 and there are six of them on a full
 * waterfront; the airport is one building bought once, at a point in the game
 * where 20,000 is a rounding error. What it has to cost is a decision, and the
 * only curve that is still steep where the airport unlocks is the land's.
 */
export const AIRPORT_BASE = ANNEX_BASE * ANNEX_GROWTH ** HIGHWAY_MIN_DISTRICTS;

// --------------------------------------------------------------- ascension

/**
 * What a founding is worth to the next city, and how fast that compounds.
 *
 * `achievements.ts` refuses to grant anything and explains why at length: every
 * bonus in this game is a multiplier on a ledger that already compounds to
 * 9e9/s, so a payout is "a multiplier handed to the player for doing what they
 * were going to do anyway". This feature violates that rule, and the violation
 * is the point rather than an oversight — an achievement fires for playing, and
 * ascension fires for *giving a city up*. The player pays 49 districts and an
 * hour of their life for it. That is a decision, which is exactly the thing the
 * achievements argument says a bonus has to be attached to.
 *
 * What is kept from the argument is the shape. The multiplier is
 * `1 + LEGACY_YIELD * sqrt(legacy)`, and every part of that is doing work:
 *
 *   - `legacy` counts *districts given up*, so one founding contributes at most
 *     MAX_DISTRICTS however long it is left running. A run's contribution is
 *     bounded by the map rather than by the player's patience;
 *   - the square root is what makes it compound slowly. Four full runs are
 *     twice the bonus of one, not four times it. Measured in
 *     tools/ascension.calibrate.mjs, at the ceiling of a full 49-district run
 *     each time: the second city runs at 2.05x, the third at 2.48x, the fifth
 *     at 3.10x, the twentieth at 5.58x and the fiftieth at 8.35x;
 *   - 0.15 is set from the guard the brief names — time to the first
 *     annexation, run by run. Run 1 buys its second district at 1:30:18, run 2
 *     at 49:35, run 3 at 43:05, run 5 at 36:05 and run 20 at 22:47, against a
 *     rule that says run 3 clearing its first district inside a minute means
 *     the multiplier is too strong. The reason it can be as large as it is is
 *     that cash is only half of that gate: `activeDeveloped` has to reach
 *     ANNEX_MIN_OCCUPANCY before a district can be bought at any price, so a
 *     rich second city still has to build its first one out.
 */
export const LEGACY_YIELD = 0.15;

// ------------------------------------------------------------------- ranks

/**
 * What the city is called, and what it has to be to be called it.
 *
 * A rank is derived and never stored — see `cityRank` — so an offline catch-up
 * and a watched session agree by construction, and a save written under an
 * older balance pass opens on whatever rank its counts now imply.
 *
 * Two thresholds a rung, and the city has to clear *both*. That is the whole of
 * why it is not simply a population count: LEVEL_HOUSING spans 4 to 2,400, so
 * one district of arcologies holds 28,800 people on 24 plots. It is dense, and
 * a dense village is still a village. The mirror case is a sprawl of bungalows
 * across half the map, which is large and empty. Neither is a metropolis, and
 * requiring both is the shortest thing that says so.
 */
export interface CityRank {
  /** Position on the ladder. What a gate is expressed in. */
  readonly index: number;
  /** What the treasury strip calls it, and what a blocker names. */
  readonly name: string;
  /** Districts the city must hold. */
  readonly districts: number;
  /** People its housing must be built for — `population`, not `residents`. */
  readonly population: number;
}

/**
 * The ladder.
 *
 * Every threshold is measured rather than round. `tools/ranks.calibrate.mjs`
 * plays the game forward — `autoDevelop`'s own policy by hand until the city
 * hall, the real thing after it — and prints the elapsed time at which each
 * rung falls. The rule it enforces is the one the brief states: a rank that
 * arrives in the first ninety seconds is not a rank.
 *
 *   Village       0:00   every city starts here
 *   Town       1:27:51   the first district is full and climbing
 *   City       1:57:22   three districts, and the ladder past terraces
 *   Conurbation  never   see below
 *   Metropolis   never
 *
 * The two upper rungs are "never" for a reason that predates them, and the
 * calibrator prints it: an auto-developed run plateaus at 5 districts, because
 * the level ladder houses everyone on a third of the land, housing demand goes
 * negative and auto-development will not build into oversupply. Measured
 * identically on master at 4b9dae6 — HIGHWAY_MIN_DISTRICTS was already out of
 * an auto-developer's reach before any of this. So those two are measured
 * against cities built out to their own frontage instead: at 14 districts a
 * city of towers is a Conurbation, and Metropolis wants 28 districts of
 * arcologies.
 *
 * The population column is `population`, not `residents`: a city that has just
 * lost half its people to a bad tax rate has not been demoted to a town, and a
 * rank that flickered with the occupancy integrator would be a rank that
 * unlocked and re-locked a button while the player watched.
 */
export const RANKS: readonly CityRank[] = [
  { index: 0, name: 'Village',     districts: 1,  population: 0 },
  { index: 1, name: 'Town',        districts: 1,  population: 1_200 },
  { index: 2, name: 'City',        districts: 3,  population: 12_000 },
  { index: 3, name: 'Conurbation', districts: HIGHWAY_MIN_DISTRICTS, population: 60_000 },
  { index: 4, name: 'Metropolis',  districts: 28, population: 400_000 },
];

/**
 * What each gated thing needs, as a position on the ladder.
 *
 * Four entries, and every one of them bites — the calibrator prints how long
 * each gate holds a button that the price would otherwise have opened: the city
 * hall by 12:41, the museum by 7:52, the stadium by 33:33. A gate that opened
 * before the price did would be decoration.
 *
 * The brief's other candidates were examined and left alone, because a second
 * gate on the same button is two numbers saying one thing:
 *
 *   - the airport has the highway, and stands at the end of its spur;
 *   - port terminals have `hasCoast`, which is the seed rather than
 *     progression. A coastal city has already paid for its coast by annexing
 *     toward it, and the terminal is what makes that pay;
 *   - power plants were rejected outright rather than found already gated. A
 *     brownout caps occupancy at POWER_FLOOR, so the grid is something a city
 *     needs *before* it is big, and a rank on it would gate the thing that lets
 *     a city reach the rank;
 *   - the university looks like the archetypal late building and is measured
 *     out. See `serviceBlocker`, which carries the numbers: it is what a city
 *     needs to reach level 2 housing, and a rank on it deadlocks the ladder.
 *
 * The highway is the one that was *replaced* rather than left: it had
 * HIGHWAY_MIN_DISTRICTS, the Conurbation rung is set to exactly that number,
 * and `highwayAllowed` now reads the rank. The constant stays, because
 * HIGHWAY_COST and AIRPORT_BASE are priced from it.
 */
export const RANK_GATES = {
  /** Policy, and with it the tax rate, free transport and auto-development. */
  cityHall: 1,
  /** A village with a museum is a village with a museum. */
  museum: 1,
  stadium: 2,
  /** Replaces HIGHWAY_MIN_DISTRICTS as the gate. See `highwayAllowed`. */
  highway: 3,
  /**
   * Founding the city again. Not a building — a rank gate on the one button
   * that takes the city away — but the same ladder answers it, and a second
   * mechanism for "are you big enough yet" would be a second thing to tune.
   */
  ascend: 2,
} as const;

export type RankGate = keyof typeof RANK_GATES;

/**
 * What the airport is worth, in cruise berths.
 *
 * Stated in the unit that already exists rather than in a new one, because the
 * thing it does already exists: `visitors` is residents x
 * VISITORS_PER_RESIDENT x happiness per berth, and the airport is more berths.
 * That keeps the happiness scaling, which is the interesting part — a miserable
 * city gets a runway and no tourists, exactly as it gets a quay and no ships.
 *
 * Three, against the six a full waterfront holds. So an airport is half a coast:
 * enough that an inland city has a tourism line at all, and not so much that a
 * coastal city would rather have had the airport.
 *
 * Measured (tools/water.calibrate.mjs) on an inland city with no berths of any
 * kind, which is the city this exists for: it adds 0.91% of the ledger at the
 * fourteen districts where it unlocks and 0.27% at forty-nine, identically at
 * every rung of the level ladder because both sides scale with residents. That
 * is the same order as the whole fare line and the whole waterfront, which is
 * the family trade income belongs to — see VISITOR_SPEND, which says so of the
 * berths and is right about this too.
 */
export const AIRPORT_VISITORS = 3;

/**
 * What the airport adds to the export tap, as a fraction of it.
 *
 * Air freight, and it lifts EXPORT_BASE the same way CARGO_EXPORT_LIFT does —
 * inside the same bracket, so there is still exactly one number the outside
 * world's appetite is made of and one place to look when industrial demand is
 * wrong.
 *
 * Inside the bracket *additively* is what stops it double-counting against a
 * cargo terminal. The two lifts add rather than multiply, so a city with both
 * gets one tap raised twice rather than two taps for the same goods; and a
 * multiplicative form was the obvious alternative and would have made the
 * airport worth more to a city that already had a waterfront than to the inland
 * city it exists for, which is exactly backwards.
 *
 * 0.25 against a cargo berth's 0.4: less than a berth, because a berth is what
 * bulk goes on and a plane is not. Measured, it multiplies the tap by 1.25 for
 * an inland city at any size — the whole of that city's freight — and by 1.14 at
 * fourteen districts or 1.07 at forty-nine for a city that already owns every
 * quay it can. Worth most to the city that has least, which is the shape the
 * additive form buys and the multiplicative one would have inverted.
 */
export const AIRPORT_EXPORT_LIFT = 0.25;

/**
 * What the airport costs to run, in the units `Service.base` is priced in.
 *
 * The one building whose wage bill is *not* its opening price, and it has to be
 * one or the other. Every civic building is priced off `Service.base` on a
 * curve that opens at 130, so UPKEEP_RATE reads as a payback period; the
 * airport's price comes off ANNEX_GROWTH instead and is 1.7e12 by the time it
 * unlocks, so the same rule would charge more per second than the city earns in
 * a minute.
 *
 * Exactly one university, which is the biggest single entry on the payroll —
 * so an airport is the dearest single thing a city runs and is not in a
 * different category from the rest of it.
 *
 * The number is set against what it *earns* rather than against what it cost,
 * and 24,000 was tried first and is wrong: measured, it charges 2.23% of a
 * fourteen-district city's gross income against the 0.91% the tourism brings in,
 * so the one building that gives an inland city tourism at all would be a
 * building that lost money the day it opened. The export lift would still have
 * justified it, but only through industrial demand, which is not a line the
 * player can read.
 *
 * At 7,200 it is 0.67% of that same ledger against 0.91% of tourism, so it pays
 * its own wages from the first second and the freight lift is upside rather than
 * the whole argument. By a full map it is 0.19% against 0.27%, which is the same
 * arc every trade constant in this file has: a real line when it is new and a
 * rounding error once the city has grown into it.
 */
export const AIRPORT_PAYROLL = 7_200;

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
