/**
 * Every tunable in the game lives here. Nothing in this file imports anything,
 * so balance can be changed without touching a line of simulation or render
 * code — and the tests can assert against the same constants the game uses.
 */

/** Changing this reseeds every street layout in the game. */
export const SEED = 20260823;

/** World units per plot. */
export const CELL = 4;

/** Plots per side of a district. A district is the unit of expansion. */
export const DISTRICT_SPAN = 12;

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
 * Measured, not guessed. Over 1000 seeds the raw (pre-sampling) count takes
 * five values — 72, 80, 81, 90, 100 — with a median and mode of 90 (51.3%),
 * mean 89.66, stddev 6.71. 90 is therefore both the empirical median and the
 * cheapest target to sample for. See tools/citygen.calibrate.mjs.
 */
export const TARGET_PLOTS = 90;

/**
 * What one district must offer once frontage and civic land are taken out.
 *
 * Every building fronts a street, so only the 72 road-adjacent plots of a
 * district's 90 are ever for sale, and `civicSites` claims 2x2 quads out of
 * those before housing sees them. Neither number falls where the brief for this
 * change assumed. Measured by enumerating all 240 street plans the generator
 * can produce (60 skeletons x 4 rail sides — the complete space, not a sample):
 *
 *   - road-adjacent plots: 72 of 90, invariant;
 *   - of those, commercial is invariant at 28, because `zoneBlocks` lays shops
 *     along block rings and a ring is exactly the frontage;
 *   - residential and industrial split the remaining 44 *variably* — R lands on
 *     one of {25, 26, 28, 29, 31, 33, 34} and I on {19, 18, 16, 15, 13, 11, 10}.
 *     30/14 never occurs; it is the mean of the two distributions, not a value
 *     either one takes.
 *
 * `homeCapacity` multiplies a per-district constant by the district count, so a
 * variable split would either strand land or sell plots that do not exist. The
 * fix is the one this codebase already uses one level down: reject and reseed.
 * `districtPlanAt` samples district seeds until the district lands on the triple
 * below, which 8.8% of accepted layouts do — about 11 tries, and it still leaves
 * 32 distinct street plans in play. Taking the guaranteed minimum instead would
 * mean 9 residential and 3 industrial plots a district, which is not a game.
 */
export const FRONTAGE_TARGET = {
  residential: 19,
  commercial: 28,
  industrial: 11,
  /** 2x2 civic quads per district. 7 x 4 = 28 plots, mostly dead interior. */
  civicSites: 7,
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

export interface Tier {
  /** Shown in the zoning readout. */
  readonly name: string;
  /** Verb on the build button while this tier is active. */
  readonly buildLabel: string;
  /** Residents housed per building. */
  readonly capacity: number;
  /** Footprint width in world units (must stay under CELL). */
  readonly width: number;
  /** Height in world units. */
  readonly height: number;
  /** Pitched roofs read as houses; flat roofs read as blocks. */
  readonly pitched: boolean;
  /** Tall tiers get an aircraft warning light, which is what sells their scale. */
  readonly beacon: boolean;
}

export const TIERS: readonly Tier[] = [
  { name: 'detached housing', buildLabel: 'Build home',            capacity: 4,   width: 2.2, height: 1.6,  pitched: true,  beacon: false },
  { name: 'apartments',       buildLabel: 'Build apartment block', capacity: 16,  width: 2.6, height: 4.6,  pitched: false, beacon: false },
  { name: 'towers',           buildLabel: 'Raise tower',           capacity: 70,  width: 2.8, height: 11.5, pitched: false, beacon: true  },
  { name: 'arcologies',       buildLabel: 'Seal arcology',         capacity: 300, width: 3.0, height: 22.0, pitched: false, beacon: true  },
];

/**
 * Cash per resident per second.
 *
 * RENT, HOME_BASE and the first tier's capacity together set how long the first
 * house takes to pay for itself, which is the single number the opening minute
 * lives or dies on. At 8 / 4 / 0.14 it is about fourteen seconds: long enough to
 * feel like a decision, short enough that nobody sits watching an empty plot.
 */
export const RENT = 0.14;

/** Each shop adds this share of base income. */
export const SHOP_BONUS = 0.18;

/** Each district past the first adds this share of base income (civic economies of scale). */
export const DISTRICT_BONUS = 0.05;

export const HOME_BASE = 8;
export const HOME_GROWTH = 1.14;

export const SHOP_BASE = 90;
export const SHOP_GROWTH = 1.22;

/**
 * Industry is priced between a shop and a rezone, and compounds more slowly
 * than commerce does. There are only 19 industrial plots to a district against
 * 28 commercial ones, so a steeper curve would price the zone out before the
 * demand loop ever had a chance to ask for it.
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

export const REZONE_BASE = 3_000;
export const REZONE_GROWTH = 26;

/** Rezoning is a district-wide programme; it needs a district worth building on. */
export const REZONE_MIN_HOMES = 12;

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
 * auto-develop ends at R +0.65 / C -0.03 / I -0.02 — lively, and well short of
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
  /** Share of the happiness score. The three sum to 1. */
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
  { key: 'hospital', name: 'Hospitals', buildLabel: 'Open hospital',      coverLabel: 'Health coverage', capacity: 900,  base: 130, weight: 0.4  },
  { key: 'police',   name: 'Police',    buildLabel: 'Open police station', coverLabel: 'Police coverage', capacity: 1_200, base: 210, weight: 0.35 },
  { key: 'fire',     name: 'Fire',      buildLabel: 'Open fire station',   coverLabel: 'Fire coverage',   capacity: 1_500, base: 320, weight: 0.25 },
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
 * names the service that is short, and the player works out why. One hospital
 * is worth 0.4 on its own, so the fix is always exactly one purchase away.
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
