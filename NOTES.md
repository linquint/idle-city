# Phase 3 design notes

Two features that touch the zoning budget or the district plan, written up
before any code as asked. Both recommend one option; neither is implemented.

Every number below is measured against this build (`tools/*.calibrate.mjs` and
short probes over `src/sim`), not estimated.

---

## 7. Offices split out from retail

### What the brief asks

Commerce means shops. Splitting offices out gives it two tiers: a far denser job
count than `JOBS_PER_COMMERCIAL`'s 8, and a different trip profile — offices draw
commuters, not shoppers.

### Option A — a fourth zone in `citygen`

**`ZONE_SHARE`'s equilibrium does not merely move; it stops being expressible.**

The split solves the tier-0 job/worker equilibrium `14R = 8C + 20I` with
`R + C + I = 1`. Re-solving it with a fourth share `O` at office density `d`,
holding `I` at 0.21:

| d | O | R | C | I |
| --- | --- | --- | --- | --- |
| 16 | 0.05 | 0.496 | 0.244 | 0.21 |
| 16 | 0.10 | 0.515 | 0.175 | 0.21 |
| 24 | 0.05 | 0.515 | 0.225 | 0.21 |
| 24 | 0.08 | 0.536 | 0.174 | 0.21 |
| 40 | 0.08 | 0.595 | 0.115 | 0.21 |

against today's R 0.48 / C 0.31 / I 0.21. At the density that makes offices worth
having — three times a shop's, so 24 — an 8% office share cuts the commercial
share by 44%.

That is where it stops. **The commercial count is not a free parameter.**
`zoneBlocks` lays shops along block rings and a ring *is* the frontage, so a
district produces 45 commercial plots at span 15 at 100% of seeds — it was 31 at
span 13 and 38 at span 14, and there is no seed at 15 that offers anything else.
A commercial share of 0.174 cannot be asked for. Getting it would take one of:

- **changing `zoneBlocks`.** The generator is frozen, and the reason is in the
  config: the commercial invariant is what everything from `SHOP_THROUGHPUT` to
  `EXPORT_PER_DISTRICT` is priced against;
- **changing `DISTRICT_SPAN`.** That re-opens `SHOP_BASE`, `SHOP_GROWTH`,
  `INDUSTRY_BASE`, `INDUSTRY_GROWTH`, `SHOP_THROUGHPUT`, `SUPPLY_DRAW`,
  `INDUSTRIAL_OUTPUT` and `EXPORT_PER_DISTRICT`, each of which carries its own
  measurement. The last span change was a cycle of work on its own.

The rest of the cost, for completeness:

| | today | with a fourth zone |
| --- | --- | --- |
| frontage numbers rejection-sampled | 4 (24/45/13/9) at 2.63% acceptance | 5, at a joint acceptance the sampler has not been measured for |
| zone body meshes | 12, +8 shared parts, +15 models = 35 (asserted, plus the cage) | 16, +8, +20 = **44**, over `BUILDING_MESH_BUDGET` |
| `ParcelBook`s | 3 | 4 |
| demand signals | 3 | 4 |
| per-zone save fields | 7 families × 3 | 7 families × 4 |
| files referencing `ZoneKind`/`ZONE_KINDS` | 10 files, 93 references | all of them widen |
| references to the three zone strings | 185 | all reviewed |

**Verdict: not viable this cycle.** It is a generator change wearing a feature's
clothes.

> Re-measured after every zone's first rung was modelled, which moved the mesh
> row above: the ladder is now twelve bodies rather than fifteen (no modelled
> rung has a body mesh), eight shared parts rather than nine (the hipped roof
> had no other wearer) and fifteen models. The conclusion is unchanged and
> firmer each time. A fourth zone now costs *four* bodies **and** five models,
> because a first rung with no models of its own is the one thing the renderer
> no longer knows how to draw — offices sharing the shops' five would be exactly
> the outcome the split exists to avoid, an office that reads as a shop. Against
> a budget that has three times spent its headroom on the rungs the city is
> actually made of, and a fifth frontage number the sampler has never been
> measured for.

### Option B — a second building type on the commercial frontage

Offices as their own count and cohort, drawing from `districtPlan.commercial`,
with their own job density, trip profile and cost curve. No `citygen` change, no
`ZONE_SHARE` change, no plot budget change, no fifth frontage number, and the
mesh budget grows by one body ladder only if offices get their own silhouette.

**But the brief's sketch has a siting problem it does not mention, and it is the
same one the power plants hit.** "Two counts sharing one land supply" and
"positions are a pure function of counts" are in tension:

> A building's plot must be recoverable from the counts alone. If shops fill the
> commercial list front-to-back and offices fill it back-to-front, then the plot
> a shop stands on depends on how many offices exist — so building an office
> moves shops that are already standing. If instead each type indexes only its
> own ordinal, the two must occupy **disjoint, fixed** subsets of the list, and
> then they do not share a supply at all.

Three ways out:

**B1 — fixed per-district split.** Offices take the last *N* of each district's
45-plot commercial run; shops take the first 45 − *N*. Both are pure functions of
their own ordinal; nothing ever moves; capacity is still one constant times the
district count. What is lost is that the land split becomes a *design* constant
rather than a live player decision.

**B2 — shared supply, with shops indexed through an office book.** There is
precedent: `ParcelBook.unmergedPlot(u, merged)` already makes a building's plot a
function of *another* count, and buildings do shuffle when a parcel merges. The
difference is that a merge is a promotion and the shuffle is masked by the growth
animation; a shop hopping to a different street because an office opened three
districts away is not.

**B3 — offices outside the commercial frontage entirely** (a reserved square, or
land beyond the city like the estates). There are no 2x2 squares left — this
cycle spent both spares on the city hall and the power plant — so this means
either widening `FRONTAGE_TARGET.squares` (a generator change) or putting
offices out of town, which is the wrong fiction for the densest jobs in the city.

### Recommendation

**Option B1.** It delivers what the feature is actually for — two job densities,
two trip profiles, two demand targets over one commercial *zone* — for a blast
radius of roughly: one new count and cohort, one new `ParcelBook` slice, one
demand signal, one cost curve, one body ladder, and a handful of capacity reads.
Nothing in `citygen`, nothing in `ZONE_SHARE`, nothing in the plot budget, and no
existing building moves.

The one thing to be explicit about with the reviewer: B1 does **not** give the
player a live choice about how commercial land is divided. If that decision is
the point of the feature rather than the two demand signals, then the honest
answer is B2 with buildings that visibly relocate, and that is a bigger and
uglier change than the brief implies.

What would still need measuring before coding:

- the office density. `JOBS_PER_COMMERCIAL` is 8, and the equilibrium table above
  shows what densities do to the job/worker balance even when the *land* split is
  fixed. Offices add jobs without adding trips, so they push residential demand
  up and commercial demand down;
- *N*, the office share of the 45. It sets how far the equilibrium can move;
- `SHOP_TRIPS` versus an office trip profile. An office draws commuters, so its
  contribution to `demandTargets.c` should be through `labourReach`-like terms
  rather than through `SPEND_PER_RESIDENT`;
- a re-run of `npm run economy:calibrate`, because commerce is 45 of a district's
  82 sellable plots and anything that changes what fills them changes the
  annexation gate.

---

## 8. Farms on outer-ring districts

### Which ring

The spiral is not tidy — the water takes positions, so ring sizes vary by seed.
Measured on this build's seed:

| ring | districts | annexations | annex price at the boundary |
| --- | --- | --- | --- |
| 0 | 1 | 1 | 6.00e4 |
| 1 | 8 | 2–9 | 2.04e5 |
| 2 | 12 | 10–21 | 3.64e9 |
| 3 | 7 | 22–28 | 8.69e15 |
| 4 | 13 | 29–41 | 4.57e19 |
| 5 | 8 | 42–49 | 3.70e26 |

`ring 3+` is 28 of the 49 districts but opens at the **22nd** annexation.
`tools/economy.calibrate.mjs`'s best policy reaches ten districts in 336
simulated hours, so ring 3 is past the horizon of anything that has been
measured — farms there would be content almost nobody sees, in the same way
`HIGHWAY_MIN_DISTRICTS`' own comment admits the estates are.

**Recommend `ring >= 2`.** It opens at the tenth annexation, covers 40 of 49
districts, and leaves the whole early and middle game — the first nine districts,
where every constant in `config.ts` was calibrated — completely untouched.

### What it does to the annexation curve

`ANNEX_GROWTH` is 3.4 and knows nothing about what a district contains, so a
district that is mostly farms costs the same as one that is mostly housing and
returns less of what the player wants. Two things soften it, and one is worth
checking rather than assuming:

- the annexation gate is a **share** (`ANNEX_MIN_OCCUPANCY`, 0.7 of
  `activeDeveloped`), not a count. Farm plots that are cheap to fill would make
  the *next* gate easier to reach, not harder — a farm district could be a
  stepping stone rather than a tax. That has to be measured: if farms are cheap
  and count in `plotCapacity`, ring 2 could make expansion accelerate;
- `DISTRICT_BONUS` (0.05 of base income per district past the first) is paid
  whatever the district holds, so a farm district is never worthless.

If it still reads badly, the lever is `ANNEX_BASE`, not a per-ring price — a
price that varied by ring would make the cost curve depend on the seed.

### Which zone the land comes from

Commercial is out: 45 is the ring invariant and the whole of the argument above.
Residential is out: 24 is the denominator every `Service.plots` was solved
against, and the config calls that "the load-bearing part". **Industrial is the
answer**, as the brief expects — but the cost is larger than it looks, because
industry is already the short side of the goods cycle. A district draws
45 × 4 + 60 = 240 and supplies 13 × 9 = 117, or 49%.

Taking farm land out of the 13:

| rule | 10 districts | 22 districts | 49 districts |
| --- | --- | --- | --- |
| ring 2+, 8 of 13 | −6% industrial | −36% | −50% |
| ring 3+, 8 of 13 | 0% | −3% | −35% |
| ring 2+, all 13 | −10% | −59% | −82% |

So `ring 2+, 8 of 13` halves the city's industrial land by the time the map is
full. Industrial demand runs positive already; halving supply pushes it harder
positive, which is a direction the model tolerates (industrial demand pins under
no policy today) but only up to `clampDemand`. **This needs an
`npm run economy:calibrate` run before and after, and `ESTATE_YIELD`'s own
measurement re-checked** — the estates exist precisely because a built-out city
is short of industry, and farms make them more valuable rather than less.

Taking **all 13** is not viable: at 49 districts the city would hold 117
industrial plots, which is one district's worth for the whole map.

### Are the capacity reads cheap enough?

Yes, and the pattern already exists. `coastalDistricts(districts)` counts
districts with a property behind `scanCoastal` — appended, remembered, bounded by
the count — and `terminalCapacity` reads it every tick. Measured at
`MAX_DISTRICTS`, per call and then per simulated second at `TICK_RATE`:

| | per call | per simulated second |
| --- | --- | --- |
| naive walk over 49 districts | 0.309 µs | 0.0031 ms |
| the `coastalDistricts` memo | 0.047 µs | 0.0005 ms |

Even the naive form is three thousandths of a millisecond a second, so this is
not a performance question — it is a consistency one. **Follow `scanCoastal`
exactly**: `outerDistricts(districts)`, appended and remembered, with the same
"bounded on every read so `reset` works" property its comment describes.

`homeCapacity` and friends stay multiplications; only `industryCapacity` becomes
`13 × districts − FARM_PLOTS × outerDistricts(districts)`, which is still O(1)
after the scan.

### What farms actually do

"Low income" alone is a worse shop, as the brief says. The proposal:

**Farms feed a food ratio that caps residential demand**, on the same shape as
power but landing somewhere else:

- `foodDemand` is per resident — people eat, buildings do not — so unlike power
  it scales with occupancy and with the level ladder through `residents` alone.
  No exponent: a megastructure's residents eat what an arcology's do;
- `foodSupply` is `farmPlots × FOOD_PER_PLOT`, plus a `FOOD_BASE` import the city
  starts with and grows out of, exactly as `POWER_BASE` and `EXPORT_BASE` do —
  without it a fresh city is short of something it has no land to make;
- the ratio caps `demandTargets.r`, the way happiness already does:
  `r: Math.min(s.happiness, foodCap(s), clampDemand(...))`.

Capping **residential demand** rather than occupancy is the important choice.
Power already caps occupancy, and a second multiplier on the same scalar would be
double jeopardy and unreadable — two shortfalls, one bar, no way to tell which is
biting. Residential demand is a different lever: a city that cannot feed itself
stops *attracting* people, and keeps the ones it has. That also makes the
death-spiral guard nearly free, because the loop never touches income:

- fewer farms → residential demand capped → housing gets no discount and the
  city stops growing;
- residents do not fall, income does not fall, and the farms are still
  affordable.

The floor is `clampDemand`'s own −1, and the failure mode is a city that has
stopped growing rather than one that is shrinking — which is exactly the shape
`HAPPINESS_MIN_BUILD` already uses, and which the config calls "the tutorial, and
it has no text".

### What would need measuring before coding

- `FOOD_PER_PLOT` and `FOOD_BASE`, against the ring the farms start at: a city
  should first go short of food somewhere in ring 2, not on its first
  annexation;
- the industrial re-balance above, through `npm run economy:calibrate`;
- whether farm plots belong in `plotCapacity` — see the annexation-gate question,
  which cuts both ways and has to be settled by a run rather than by an argument;
- a `tools/farms.calibrate.mjs` in the shape of `power.calibrate.mjs`: the ring
  table, what the land can feed at each rung, and a played-for-real run showing
  when the shortfall first arrives.

### A cheaper alternative worth one line

If the industrial cost turns out to be too large, farms could take **courtyard**
land instead — a district has 8 interior plots, 4 of them parks and 4 spare, and
courtyard costs the city no frontage at all (`PLOTS_PER_PARK`'s own argument).
Four plots a district is small for something meant to be low-density, and it
would put fields inside blocks rather than at the city's edge, so the fiction is
worse. It is the fallback, not the plan.


---

# Phase 4 design notes

Two write-ups asked for by the Phase 4 brief, in the same shape as the two
above: measured, argued, and **not implemented**. The first is a feature the
brief listed and the code cannot honestly carry yet; the second is a change the
brief explicitly asked to be written up rather than built.

Every number below is measured against this build (`tools/*.calibrate.mjs` and
short probes over `src/sim`), not estimated.

---

## 9. Pollution

> **Since this was written**, crime and rubbish were built to the template it
> lays out below — derived, never stored, entering happiness as modifiers
> alongside `congestionMood` rather than as extra weights, and answered by a
> building so the ceiling stays reachable. What they did *not* take from it is
> the spatial field, and the reason is the one this section's own second hard
> question raises: their sources are crowding, idleness, residents, shops and
> works, every one of them a city-wide scalar, so a field driven by them would
> paint the same number on every plot. Pollution's source is *industrial land*,
> which clusters — that is what still makes it the bigger feature, and what is
> written up below still stands for it.
>
> One thing measured while building them is worth adding to the list at the
> foot of this section: the happiness *ceiling* was never the hard part.
> `crime` and `garbage` are both pressure times an *uncovered* service, so a
> city with its police and its depots built reads exactly zero on each however
> bad it would otherwise be, and the ceiling comes out identical before and
> after to six decimal places at every district count and level. What a
> modifier of this shape actually moves is everything *below* the ceiling — a
> half-served city of towers dropped 0.10 — which is where a game is played
> and which is not what the ceiling test measures.

### Why it is not in the overlay set

The Phase 4 brief listed pollution as an overlay mode alongside land value,
coverage, build order and traffic. The other four read numbers the simulation
already has. **There is no pollution number anywhere in `src/sim`**, and an
overlay over a number that does not exist would be a picture of nothing.

So it is out of the overlay framework, and it should stay out until it is a
simulation feature with a calibration of its own. What follows is what that
feature would have to be.

### It is derivable in-invariant, which is the good news

Nothing about pollution needs the save to grow. Every source is already a pure
function of counts and the seed:

- **industry.** The k-th works stands on the k-th industrial plot, and where
  that is falls out of `citygen`'s zoning and the build order — the same
  property `landmarkCoverage` already relies on to resolve "around it" against
  the layout rather than storing anything;
- **estates.** `estateCell` is a pure function of the ordinal and the seed;
- **traffic.** `congestion` is a city-wide scalar and its road supply is
  `ROAD_CELLS_PER_DISTRICT x districts`, both derived.

So a falloff field over industrial cells, estate cells and the road network is
recomputable on load and needs nothing new in `GameState`. That is the same
machinery feature F's land-value overlay uses and the same machinery a spatial
version of congestion would need, which is why the brief was right to say the
two share a falloff and should be sequenced together.

### What it would cost, and the two hard questions

**Where it lands.** The happiness bracket already carries four modifiers — the
tax step, free transport, landmarks and now congestion — against four weights
that sum to exactly 1. A fifth modifier is cheap to add and expensive to size:
congestion took CONGESTION_MOOD 0.14, matched to the punitive tax rate, and it
turned out (see `TRANSIT_ROAD_SHARE`) that a modifier which cannot be bought
back to nearly zero moves the happiness *ceiling* the whole game is calibrated
against. Pollution has the same shape and the same trap. Whatever it costs, a
city that has done everything available to it must be able to get back to ~1.

**Whether it is spatial at all.** This is the question, and it is the same one
congestion answered in the negative. A field over industrial cells is genuinely
spatial — industry clusters, `zoneBlocks` scores blocks on rail proximity and
area, and `test/citygen` asserts at most 4 connected industrial clusters a
district — so unlike traffic there *is* district-to-district variation to read.
But happiness is a city-wide scalar and `LevelCohort` is the reason: a
per-building modifier is exactly the input `state.ts` says would push the save
off cohorts and onto instances. So pollution would have to be summarised the way
land value is — a mean over the housing plots, computed from a prefix table —
and the overlay would draw the field while the ledger read the mean.

That is a real feature with a real design. It is not an overlay mode.

### What would need measuring before coding

- the field itself: industrial plots per district and their clustering, at every
  district count, in the shape `tools/landvalue.calibrate.mjs` prints centrality;
- what a falloff radius does to the share of housing plots affected — the
  number that decides whether pollution is a thing you zone around or a thing
  you suffer;
- the mood cost against the four modifiers already in the bracket, and the
  ceiling test in `test/services.test.ts`, which is what caught congestion's
  sizing;
- whether the estates make it worse enough to be a real cost of the highway.
  They are outside the city and the housing is inside it, so the honest answer
  may be "almost not at all", which would be worth knowing before building it.

---

## 10. Education on the promotion *rate*

### What the brief asked

Feature E gave education a second job — `SKILL_YIELD` on the industrial term of
the ledger — and explicitly ruled out touching `LEVEL_EDUCATION`, which gates
how tall the city may build. It then asked, if there were a case for education
affecting the promotion **rate** rather than the gate, for it to be written up
here and not implemented. There is a case. It is not a good enough one.

### The case for it

`promoteRate` is `promotable(s, kind) / LEVEL_UP_SECONDS` with three gates in
front of it, and the gates are all binary: occupancy over LEVEL_UP_OCCUPANCY,
happiness over LEVEL_UP_HAPPINESS, education over `LEVEL_EDUCATION[level]`. So
the whole of what education does to the skyline is decide *whether* a rung is
open, and a city at 61% coverage climbs to the 0.60 rung at exactly the speed a
city at 100% does. A rate term would say the obvious thing instead: a
better-taught city builds up faster, not merely higher.

It would also give the two education types something to do between rungs.
LEVEL_EDUCATION's rungs are 0.35 / 0.60 / 0.85 (and 0 at the bottom), so a city
sitting at 0.62 has bought coverage that buys it nothing at all until it reaches
0.85 — a dead zone a third of the range wide.

### Why it is not implemented

**It double-counts.** Coverage already decides the rung. Multiplying the rate by
the same coverage means the same number is read twice on the same decision, in
the same direction, and the second reading is invisible: a player watching a
promotion wave has no way to tell a fast wave from an early one. `DEMAND_TERMS`
carries exactly this problem in its own comment — the transit term was cut from
0.35 to 0.30 when commerce gained a transit term of its own, because "a depot
that lifted commercial demand through both channels at full strength would be
worth more than a depot is."

**LEVEL_UP_SECONDS is a pacing constant, not a dial.** `promote` drains the
bottom cohort first so the city climbs as a wave, and the wave's *shape* is what
LEVEL_UP_SECONDS states — a district of 24 homes at about one building every
twelve seconds. Multiplying the rate by up to 2x would make the wave twice as
fast for a fully taught city and re-open a constant that the skyline's whole
mixed-age look rests on.

**The dead zone is the feature.** A rung you cannot yet reach is what makes the
next school worth buying. Smoothing it into a rate would remove the one moment
in the education curve that is legible: the tick where the city starts building
towers.

### If it were built anyway

The cheapest honest form is a *floor-and-lift* on the rate rather than a
multiplier on it: `promoteRate x (RATE_FLOOR + (1 - RATE_FLOOR) x coverage)`,
with RATE_FLOOR near 0.8, so a fully taught city climbs a quarter faster than a
barely taught one and LEVEL_UP_SECONDS keeps its meaning as the *fastest* wave
rather than the only one. That bounds the change to something a pacing run can
measure, and it is the only version worth putting through
`tools/economy.calibrate.mjs`.

---

# Phase 6 design notes

Three write-ups. One is a decision Prompt D2 deliberately deferred rather than
took; the other two are the blocked memos, and both of them turn out to rest on
numbers that have moved since the brief was written — so each opens by
re-measuring the thing it is about.

Every number below is measured against this build.

---

## D2's third option — making the fire's plot the plot that empties

The demolition animation shipped as option 2: a building falls down where the
flames were, and the plot that actually empties is the newest one in the zone.
Option 3 — making them the same plot — was written up as its own item, and this
is it.

### What the lie is worth measuring first

At 20 districts, the plot a fire is on and the plot the count drops at:

| fire on slot | flames at | distance to the plot that empties |
| --- | --- | --- |
| 12 | (20, 28) | 388 |
| 412 | (148, 40) | 486 |
| 800 | (-224, 72) | 217 |
| 276 | (140, -92) | 558 |

World units, on a map about 700 across. So the building that silently vanishes
is typically most of a city away from the fire, which is why option 1 —
animating the collapse where the count drops — was never viable: it is a
building falling over on the far side of the map from the flames.

### The save cost is not the blocker

Recording which plots are gone, as a hole list per zone:

| holes recorded | save (JSON) | delta |
| --- | --- | --- |
| 0 | 1,505 B | — |
| 1 | 1,518 B | +13 |
| 10 | 1,544 B | +39 |
| 100 | 1,899 B | +394 |
| 1,000 | 6,356 B | +4,851 |

Bounded above by the plot count — 4,018 at 49 districts — so even the
pathological case is about twenty kilobytes. It would be a fourth save
exception and it would grow with *buildings* rather than with a table or with
districts, which is the line `LevelCohort` draws. But it is not what stops this.

### What stops it is that slot order *is* build order

`levelAt(levels, slot)` walks the cohort from the top level down and answers
"this slot holds level l". That is correct only because the oldest buildings
hold the highest levels and the oldest buildings are the lowest slots. The whole
cohort representation is that one identity.

Punch a hole at slot k and two things can happen, and both are worse than the
lie:

- **the hole is refilled.** The next house built lands on slot k, which is an
  *old* slot, and inherits whatever level the cohort walk says stands there. A
  building bought this second appears as a tower. Avoiding that needs a
  separate age-to-slot permutation in the save, which is per-building state by
  another name;
- **the hole is never refilled.** Then fire loss is permanent and `homeCapacity`
  falls with every fire — which contradicts the position `abandonedR`'s own
  comment already takes ("permanent loss is the fastest way to make someone
  close an idle game for good"), and is a balance change rather than an
  animation.

### And the downstream cost, for completeness

| what | today | with holes |
| --- | --- | --- |
| `place(zone, slot, merged, z)` | binary search over parcels, O(log n) | the k-th *non-hole* plot: a second structure and a rank query |
| `housingCentralityMean(n, z)` | one prefix-sum read, on `income`'s 10 Hz path | prefix sum less the holes below n; `landValue` becomes a function of the hole set |
| `pairs(districts)` | a running total, precomputed | must exclude every pair containing a hole |
| `ZoneLayer` | "a level is a contiguous run of slots" | false; `SlotRanges.resolve` stops being one addition and the append fast path stops being expressible |

**Verdict: not a parcel-book change.** The brief framed it as "the parcel book
supporting removal of an arbitrary index", and the parcel book is the easy part.
What it actually asks for is a different representation of what a building is,
and that is a multi-session rewrite of the middle of the game rather than the
honest version of an animation.

**What was shipped instead** is option 2 with the dishonesty moved somewhere it
reads as a story rather than as a bug: the building at the fire's plot collapses
and is then *rebuilt*, which is a true account of what the simulation did — the
city really is one building's worth of stock smaller, at the far end of the
build list. See `src/render/collapse.ts`.

---

## Memo 4 — Library and theatre

### The weights have already moved, and it changes the question

The brief describes four happiness weights — health 0.34, police 0.26, fire
0.22, recreation 0.18 — summing to exactly 1. That is no longer the model.
Phase 5's crime work took police out entirely, so today:

| term | weight |
| --- | --- |
| health (`hospital`) | 0.46 |
| fire | 0.30 |
| recreation (`RECREATION_WEIGHT`) | 0.24 |
| police | **0** — crime is a quantity now |
| **sum** | **1.00** |

So the calibration the brief protects is still live and still sums to 1, but it
is a *three*-term model, and health is 46% of it. A culture weight would be a
fourth term rather than a fifth, and it would be taking its share from three
terms rather than four — a bigger re-normalisation than the brief assumed, not
a smaller one.

### The land wall is unchanged

`FRONTAGE_TARGET.squares` is 9 and every one is spoken for: 6 civic, 1 small
landmark, 1 city hall, 1 power plant. The four spare plots a district holds are
courtyard plots with no frontage and they are what parks are built on. A sixth
`CIVIC_SERVICES` entry moves `siteCapacity`'s divisor and relocates every
hospital, police station, fire station, school and depot in every existing save.
Same wall as the prison and the recycling centre in Memo 1, same four options.

### The question that actually decides it

The brief's own escape — culture as a modifier on earned coverage, like
`LANDMARK_MOOD` — is not an escape from a design question, it is the answer to
one. `config.ts` already says what a landmark is for:

> Landmarks buy happiness *early*, standing in for services not yet built, and
> stop mattering once the city is properly served.

That is, precisely and completely, what a cheap library and theatre would do.
`LANDMARK_MOOD` is 0.12, deliberately less than the cheapest service weight so
that a landmark cannot be a way to skip the hospital, and it stops paying at
full coverage. A "small happiness weight" for culture that worked any
differently would be a second answer to a question the game has already
answered.

**So: culture is a cheaper tier of landmark, and the feature is two rows in
`LANDMARKS`.** Not a new system, not a fourth weight, not a sixth civic type.

### What those two rows cost

The existing table, for scale:

| | base | growth | span | reach |
| --- | --- | --- | --- | --- |
| museum | 4,000 | 1.6 | 2 | 24 |
| stadium | 12,000 | 1.7 | 3 | 38 |

A library and a theatre would sit under the museum — call it 900 and 2,200,
growth 1.5, reach 14 and 18. And there is exactly one thing to resolve before
writing them, which the brief does not mention:

**`landmarkSiteCapacity` gives one small site per district and one large one.**
A third span-2 landmark competes for the *same* single small site, so a city
that builds a library builds it instead of a museum. That is either the feature
— a real choice between four cheap culture buildings and one expensive one —
or a bug, and it has to be decided before the rows are written. Three options,
in increasing cost:

1. **Share the site, and say so.** One small-landmark site a district, four
   things that can stand on it. Zero land change, zero migration, and it makes
   the tier a decision rather than a checklist. `landmarkSiteCapacity` becomes
   one number shared across every span-2 landmark and `canBuildLandmark`
   compares against the sum.
2. **A second small site per district**, taken from the two courtyard plots the
   parks do not use — which are not 2x2 squares, so this does not work without
   re-cutting the plan. It is the prison's problem again.
3. **Give culture its own site class**, which is a tenth square and the divisor
   change the whole memo exists to avoid.

**Recommendation: (1).** It is the only one that costs no land, needs no
migration, and makes the tier mean something. What it needs measuring first is
`landmarkPlotsCovered` at four small landmarks a district rather than one — the
reach geometry is memoised against the counts and this widens the key.

**Still blocked on**: whether sharing the site is acceptable, which is a design
call rather than a measurement.

---

## Memo 5 — Demographics, cemetery, and health as a stock

### The model, measured

```
population(s)   = Σ homeLevels[l] × LEVEL_HOUSING[l]     // housing capacity
residents(s)    = population(s) × occupancyR             // capacity × fill
occupancyR      → chases occupancyTarget on OCCUPANCY_TAU = 120s
occupancyTarget = max(FLOOR, min(1, FLOOR + (FULL − FLOOR)×happiness
                                        + DEMAND×demand)) × powerCap
                  FLOOR 0.08, FULL 0.92, EMPTY 0.25
```

There are no people in this simulation. There is housing capacity and a fill
ratio, and `occupancyR` is already a migration model: an integrated lagged
quantity that rises when the city is happy, falls when it is not, and has a
vacancy clock and abandonment underneath it.

What reads it back, which is the size of the thing being proposed for
replacement: 21 references across `economy.ts`, `game.ts` and `save.ts`, and
`residents` is called from 14 places including the traffic layer and the HUD.
Four of those readers are load-bearing rather than incidental —
`isVacant`/`abandonRate`, `canLevelUp` and `promotionBlocker` (which refuses to
promote a zone under `LEVEL_UP_OCCUPANCY`), `effectiveOf` (which is what
`income` multiplies), and every coverage denominator's occupancy-invariance
argument.

### Health as a stock double-counts, and the weights say so louder than before

Hospitals already reach residents by a calibrated path:

```
hospitals → coverage → happiness → occupancyTarget → occupancyR → residents
```

A second path from the same purchase to the same output means a hospital pays
twice, and the happiness ceiling test will not catch it because the second path
is outside the happiness bracket entirely.

And the re-normalisation is now worse than the brief thought. Health is 0.46 of
a three-term model. Take it out and what is left is fire 0.30 and recreation
0.24, re-normalised to 0.556 and 0.444 — a **two-term** happiness model, where
half of it is a service most cities buy for the fire *risk* rather than for the
mood. Phase 5's crime work has already spent the one weight that could afford to
leave. There is no second one.

**Verdict: do not make health a stock.** Not "not yet" — the seat it would take
is occupied by the thing that makes the whole model add up.

### The question that decides the other two

> Is `occupancyR` being replaced, or wrapped?

**Wrapped.** The argument is the same one that decided Memo 4, and it is the
stronger of the two.

A *replacement* — age cohorts with births, deaths and migration producing
`residents` — is a second migration model beside the one that already exists,
and the existing one is good: lagged, bounded, legible, and hooked into
abandonment, ruins, recovery, the vacancy clock, income and every coverage
denominator. Two models of the same thing either disagree or one of them is
decoration. Replacing it is a multi-session rewrite of the centre of the game
and should be planned as one.

A *wrapper* — demographics as a readout **over** the occupancy model, where
births and deaths are derived flows that *explain* the number rather than
produce it — is a much smaller feature, and it composes with everything:

- **it needs no new save state at all.** `residents(s)` is already a pure
  function of counts; an age distribution over it can be too, as long as it is a
  function of `residents` and `elapsed` rather than an integrated stock. Five
  city-wide age buckets derived from a static table is a *readout*, and the
  file that would hold it is a sibling of `achievements.ts` — bounded by the
  table, delete it and the city is identical;
- **it cannot double-count**, because it produces nothing. A hospital changes
  life expectancy in the *readout* and changes residents through the path it
  already has, and those are the same fact stated twice rather than two
  effects;
- **it survives the `LevelCohort` objection cleanly.** That comment names "a
  per-building age" as the input that would push the save off cohorts and onto
  instances. Resident age is not per-building — but only while it stays a
  city-wide distribution. A per-district one would not survive it, and the
  wrapper form makes that impossible rather than merely discouraged.

What the wrapper cannot do is the thing that would make demographics a
*mechanic*: a city that ages badly and loses people to it. That is the honest
cost of the recommendation, and it is worth paying, because the mechanic
version is `occupancyR` with more steps.

### The cemetery

Blocked on land (Memo 1) and on demographics existing. Under the wrapper reading
it stays blocked on land and gains nothing to be blocked on — a cemetery whose
demographics are a readout has nothing to consume, so it would be a civic
building with a happiness effect, which is a sixth `CIVIC_SERVICES` entry and
the whole of Memo 1's problem. Nothing to prompt.

### Suggested order, if this is taken up

1. Demographics as a readout over `residents`, in its own file, with the
   `LevelCohort` argument written into its header the way `achievements.ts`
   writes its three rules.
2. Nothing else. Health stays a weight, and the cemetery waits for a land
   answer that is not this memo's to give.
