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
 * Widened from 12 to make room for a 3x3 university. At 12 the land budget has
 * no solution: a 3x3 reserved before the 2x2 civic pass leaves
 * 90 - 18 - 28 - 11 - 6x4 - 9 = 0 courtyard plots on the only tuple that is
 * reachable often enough to sample for, which deletes park land outright. 13
 * is the smallest span that fits the university, six civic sites and the four
 * courtyards parks stand on at the same time. See FRONTAGE_TARGET.
 */
export const DISTRICT_SPAN = 13;

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
 * Measured, not guessed, and re-measured for the wider district. Over 4000 raw
 * (pre-sampling) attempts at DISTRICT_SPAN 13 the count takes six values — 81,
 * 90, 99, 100, 110, 121 — with a mode of 100 at 47.3%, ahead of 110 at 38.6%.
 * 100 is therefore the cheapest target to sample for, exactly as 90 was at span
 * 12 (51.3%). Worst inner sampling over 4000 seeds is 15 attempts against a
 * MAX_ATTEMPTS of 64. See tools/citygen.calibrate.mjs.
 */
export const TARGET_PLOTS = 100;

/**
 * What one district must offer once frontage, civic land and the university are
 * taken out.
 *
 * Every building fronts a street, so only the 84 road-adjacent plots of a
 * district's 100 are ever for sale, and the site passes claim quads out of
 * those before housing sees them. A university is reserved first (one 3x3),
 * then `civicSites` takes 2x2 quads out of what is left, then the three build
 * lists are what remains. The land adds up exactly:
 *
 *   24 + 31 + 8 for sale + 6 x 4 civic + 1 x 9 university + 4 courtyard = 100
 *
 * Measured by reserving one 3x3 and running the existing 2x2 pass over 20,000
 * street plans, then tallying the tuple that falls out:
 *
 *   - road-adjacent plots: 84 of 100, invariant;
 *   - commercial frontage: 31, invariant, because `zoneBlocks` lays shops along
 *     block rings and a ring is exactly the frontage;
 *   - residential and industrial split the rest variably, so the tuple below is
 *     reached by 3.28% of plans — about 1 in 30 attempts, and at
 *     FRONTAGE_MAX_ATTEMPTS the probability of exhausting them is 3.9e-8.
 *
 * The industrial 8 is what the university costs. Nothing else in this tuple is
 * a cut: residential grew 19 -> 24 and commerce 28 -> 31 with the wider
 * district, so an existing save gains housing land rather than losing it. The
 * alternative at span 12 was a tuple with zero courtyards, which would have
 * deleted park land — see DISTRICT_SPAN.
 *
 * `homeCapacity` multiplies a per-district constant by the district count, so a
 * variable split would either strand land or sell plots that do not exist. The
 * fix is the one this codebase already uses one level down: reject and reseed.
 * `districtPlanAt` samples district seeds until the district lands on the tuple
 * below. Taking the guaranteed minimum instead would not be a game.
 */
export const FRONTAGE_TARGET = {
  residential: 24,
  commercial: 31,
  industrial: 8,
  /** 2x2 civic quads per district. 6 x 4 = 24 plots, mostly dead interior. */
  civicSites: 6,
  /** 3x3 university quads per district. Exactly one, reserved before the rest. */
  universitySites: 1,
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
 */
export const ZONE_SHARE = {
  residential: 0.48,
  commercial: 0.31,
  industrial: 0.21,
} as const;

/** Rings of districts around the centre: 7x7 grid of districts. */
export const MAX_DISTRICTS = 49;

/**
 * Residents one home houses, per building level.
 *
 * The four numbers the old global rezoning tiers carried, kept exactly: a
 * level-0 house holds 4, an apartment block 16, a tower 70, an arcology 300.
 * Keeping them means every constant that was solved against those capacities —
 * RENT against the opening minute, WORKING_SHARE against the labour market —
 * still means what it meant. What changed is *who* holds them: a level is a
 * property of a cohort of buildings now, not of the whole city at once.
 */
export const LEVEL_CAPACITY = [4, 16, 70, 300] as const;

/** How many levels a building can climb through. */
export const LEVELS = LEVEL_CAPACITY.length;

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
 * Derived from LEVEL_CAPACITY rather than typed out, so the two can never drift.
 */
export const LEVEL_SCALE = LEVEL_CAPACITY.map((c) => c / LEVEL_CAPACITY[0]) as readonly number[];

/** What the zoning readout calls a level, and the verb on the build button. */
export const LEVEL_NAMES = ['detached housing', 'apartments', 'towers', 'arcologies'] as const;

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
 * at the same pace per building. Five minutes a level and four levels to climb
 * puts a fully gated district about twenty minutes from detached housing to
 * arcologies — against the old rezone, which was one button and 3,000 cash.
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
 * Zero throughout until there is anything that supplies education.
 */
export const LEVEL_EDUCATION = [0, 0, 0, 0] as const;

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
 * Commerce opens at about what a house costs and compounds a little faster.
 *
 * 9 against HOME_BASE's 8 is a 12.5% gap at the first of each; by the twentieth
 * a shop is 246 against a home's 110, which is 2.2x — "a bit faster", not a
 * different curve. It was 11.3x at the first and 43.7x at the twentieth, which
 * is what made commerce a thing you unlocked rather than a thing you chose.
 *
 * The number to keep an eye on is not this pair but the *plot ratio* it
 * compounds over. A district sells 28 commercial plots against 19 residential —
 * 47% more — so the faster curve runs over 47% more buildings, and filling one
 * district's commerce still costs 5,098 against housing's 632, or 8.1x. That
 * ratio is inverted against ZONE_SHARE (R 0.48, C 0.31), which was solved on
 * *zoned* land; only 19 of a district's 43 zoned residential plots front a
 * street, while all 28 commercial ones do. Pricing has to be judged against the
 * frontage split, and the 8.1x is what says commerce is still the expensive
 * half of a district even at these numbers — it was 169x before.
 *
 * One thing this genuinely changes: the demand surcharge starts biting. It used
 * to be inert in the opening ten minutes (worst +0%, 2 shops open under a
 * discount-chasing player) and peaked at +31% across a whole day. Now that
 * player has 12 shops open inside ten minutes and is paying +20% for them, and
 * the run peak is +56% against PRICE_SURCHARGE_MAX's +60% ceiling. The
 * surcharge is what stops "buy shops, ignore everything else" now, and it is
 * doing that four points short of saturating — so the cap still bites and is
 * still not the binding constraint. Raising it would be a change to the model
 * rather than a repair.
 */
export const SHOP_BASE = 9;
export const SHOP_GROWTH = 1.18;

/**
 * Industry is priced between a shop and a rezone.
 *
 * It used to compound more slowly than commerce as well; bringing SHOP_GROWTH
 * down to 1.18 has left 1.2 marginally the steeper of the two, which is fine
 * and is not worth a retune: a district holds 11 industrial plots against 28
 * commercial, so the steeper curve runs over less than half the buildings and
 * a full district's industry still costs a fraction of its commerce. Measured
 * over 24 hours after the commercial rebalance, every policy still builds
 * industry out — 9 under auto-develop, 59 disciplined, 65 greedy — so the
 * demand loop is still what gates the zone rather than the price.
 */
export const INDUSTRY_BASE = 240;
export const INDUSTRY_GROWTH = 1.2;

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
 * You must have built out this share of your land before you may annex more.
 *
 * Left at 0.7 through the change that took interior plots off the market, which
 * shrank a district from 90 sellable plots to 65 (58 for sale plus 7 civic
 * sites) — the gate went from 63 buildings to 46. Re-measured rather than
 * assumed, and deliberately not retuned:
 *
 *   - Demand-neutral build-out of one district, per tier: 53.8% at detached
 *     housing, 72.3% at apartments, 83.1% at towers, 70.8% at arcologies.
 *   - Tier 0 now falls 16 points short rather than 1, because the residential
 *     zone lost 24 plots to frontage and commerce lost none: 19 homes house 76
 *     people, and 76 people are served by 4 shops. That puts a rezone firmly
 *     before the first annex, which is the ordering the game should teach.
 *   - The first annex lands at 1.25h disciplined and 1.61h greedy, against 3.8h
 *     and 1.8h before. It arrived earlier, but not because of this gate: at 1h
 *     an attentive player is at 94% developed with 63.7K banked, so what they
 *     are waiting on is ANNEX_BASE, not occupancy.
 *
 * Raising it is the obvious response and the wrong one: 0.8 would put both
 * apartments (72.3%) and arcologies (70.8%) under the gate, so the tiers where
 * a player most wants more land would be the tiers that cannot reach it. The
 * pacing lever here is ANNEX_BASE. See tools/economy.calibrate.mjs.
 */
export const ANNEX_MIN_OCCUPANCY = 0.7;

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
 * The honest limit of a *constant* scale, also measured: under the two policies
 * that rezone to arcologies and annex five or six districts inside a day,
 * residential pins at -1 and commercial at +1 for about 21 of the 24 hours. The
 * imbalance a built city can reach scales with tier capacity, which spans 4 to
 * 300, and no single constant covers a 75x range — a scale set for arcologies
 * would leave the opening hour flat. Fixing it properly means dividing by a
 * size term rather than a constant, which is a change to the model the brief
 * specifies rather than a calibration. See tools/economy.calibrate.mjs.
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
 * Shopping trips generated per resident, against trips one shop can serve.
 *
 * Calibrated so commerce clears exactly at the zoning budget: 43 plots x 14
 * residents x 0.5 trips = 301 trips, and 28 commercial plots x 11 = 308. The
 * point is that the land budget and the demand model agree about what a
 * finished district looks like — otherwise the annexation gate asks for plots
 * the demand model is surcharging.
 */
export const SPEND_PER_RESIDENT = 0.5;
export const SHOP_THROUGHPUT = 11;

/**
 * Goods one shop pulls from industry, against what one industrial plot makes.
 *
 * Same calibration: 28 shops x 4 plus a base export of 60 is 172, and 19
 * industrial plots x 9 is 171.
 */
export const SUPPLY_DRAW = 4;
export const INDUSTRIAL_OUTPUT = 9;

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
  readonly key: 'hospital' | 'police' | 'fire';
  readonly name: string;
  readonly buildLabel: string;
  /** How the HUD names this service's coverage when it is the binding one. */
  readonly coverLabel: string;
  /** Residents one of these covers, once it is fully staffed. */
  readonly capacity: number;
  readonly base: number;
  /** Share of the happiness score. These three plus RECREATION_WEIGHT sum to 1. */
  readonly weight: number;
}

/**
 * Civic buildings earn nothing at all. They gate: coverage feeds happiness,
 * happiness multiplies income, caps residential demand and stops housing
 * outright below HAPPINESS_MIN_BUILD. A city that never builds one still works,
 * it just runs at the floor — neglect reads as a ceiling on what the city can
 * become, not as a punishment for playing.
 *
 * Each stands on a 2x2 site, of which a district has seven, so the three types
 * share about 2.3 buildings a district. Capacities are set against that supply
 * rather than against a population: at towers a district holds 1,330 people and
 * its share of the sites covers all of them, while arcologies (5,700 a district)
 * outrun the land. Measured over 24 hours of discount-chasing, that endgame
 * settles at 53% happiness — a real squeeze, and still comfortably clear of
 * HAPPINESS_MIN_BUILD, so housing is never bricked by land the city cannot buy.
 */
export const SERVICES: readonly Service[] = [
  { key: 'hospital', name: 'Hospitals', buildLabel: 'Open hospital',      coverLabel: 'Health coverage', capacity: 900,  base: 130, weight: 0.34 },
  { key: 'police',   name: 'Police',    buildLabel: 'Open police station', coverLabel: 'Police coverage', capacity: 1_200, base: 210, weight: 0.26 },
  { key: 'fire',     name: 'Fire',      buildLabel: 'Open fire station',   coverLabel: 'Fire coverage',   capacity: 1_500, base: 320, weight: 0.22 },
];

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
 * Homes one park keeps happy.
 *
 * Against *homes*, not residents, and that is the whole design of the term. The
 * land ratio is fixed at four park plots to nineteen housing plots a district,
 * whatever stands on them — a rezone multiplies residents by up to 75x and adds
 * exactly zero park land. A per-resident denominator would therefore be trivial
 * at detached housing and unreachable at arcologies, which is a happiness term
 * that means two different things at two ends of the same game. Per home it is
 * tier-invariant: 19 homes want 3.8 parks and a district has 4.
 */
export const HOMES_PER_PARK = 5;

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
