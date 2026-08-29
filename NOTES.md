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
| zone body meshes | 8, +8 shared parts, +35 models = 51 (asserted, plus the cage) | 12, +8, +40 = **60**, over `BUILDING_MESH_BUDGET` |
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
>
> Re-measured again after housing's *second* rung was modelled, which moved the
> row a fourth time: eleven bodies and twenty models, and `BUILDING_MESH_BUDGET`
> re-based 36 -> 40. This is the reading that matters for Option A, and it cuts
> against it harder than the last one: the precedent is now that a rung earns
> models by being a rung *players look at*, and the argument for the walk-ups
> was a specific cliff at a specific hour of play. A fourth zone has no such
> argument and would arrive owing five models on the first rung before anyone
> had seen it. The floor for it is 48 against a budget of 40 — and raising the
> budget to cover a zone nobody has asked for is the drift this file exists to
> refuse.
>
> And a fifth time, after housing's *third*: ten bodies and twenty-five models,
> `BUILDING_MESH_BUDGET` 40 -> 44, floor for a fourth zone now 52. The gap is
> widening rather than closing with every cycle, which is the whole point of
> keeping this row. It is worth being explicit that the three moves that landed
> all bought the *same* thing — a rung an existing player already looks at —
> and Option A buys a zone nobody has seen. Those are not comparable spends
> against one budget, and this row is not a running case for the budget being
> soft.
>
> A sixth, after housing's *fourth*: nine bodies and thirty models, 44 -> 48,
> floor for a fourth zone now 56. And one thing genuinely changed with that
> one, so it is recorded rather than folded in: the arcologies came in at
> *negative* triangle cost — a rung above the merge stands on a fixed parcel
> count, so it is worth only the difference between two models, and that
> difference happened to be -14,304 (`lod:calibrate` part 1e). Modelling a rung
> is therefore not uniformly expensive, and the honest version of this row is
> that the *draw calls* are the scarce thing rather than the geometry.
>
> That does not help Option A, and it is worth saying why rather than leaving
> the reader to wonder. A fourth zone's cost here is four bodies and five
> models — all of it draw calls, none of it the part that turned out to be
> cheap — and it still arrives owing a first rung nobody has seen, against a
> generator change and a fifth frontage number the sampler has never been
> measured for. The mesh row is the smallest of Option A's problems and it is
> the only one this note has ever been able to price.
>
> A seventh and last, after housing's *fifth*: eight bodies and thirty-five
> models, 48 -> 52, floor for a fourth zone now 60. Housing is finished — every
> rung modelled, no body mesh at any of them — so this row stops moving for
> that reason and the next thing to move it would be a decision rather than a
> continuation.
>
> One correction to the entry above, since the full ladder is now measured
> (`lod:calibrate` part 1f). "Modelling a rung is not uniformly expensive" was
> right but understated: the ladder *peaks at rung 3* and comes down, because
> above the merge the parcel count is pinned and the models get simpler as they
> climb. The cost of modelling a zone is therefore concentrated almost entirely
> in its **first** rung, where the buildings are. That is bad news for Option A
> rather than good: a fourth zone's unavoidable spend is precisely the
> expensive one, and it buys a rung nobody has asked to look at.

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


---

# Phase 7 design notes

Four write-ups. Two are the memos the brief asked for instead of code
(demographics and road widening), one is the land question four of the eight
features are blocked on, and one is the candidate the emergency-response work
examined and left alone.

Every number below is measured against this build —
`tools/phase7.calibrate.mjs`, `tools/economy.calibrate.mjs` — and not estimated.

---

## 11. The civic land question, and what it costs at every divisor

> **Since this was written**, the reviewer took option A and the waste depot
> shipped as the sixth 2x2 type: `siteCapacity` divides by six, every civic
> `plots` re-derived to the 24 anchor, and `migrate` refunds the buildings the
> new interleave has no site for rather than deleting them. The eleventh square
> shipped too, on the second attempt — see section 16, which records the first
> one failing and section 17, which records what made it work. Two things this
> memo got wrong are worth naming rather than leaving to be re-derived:
>
> - **not every `plots` figure comes off the anchor.** Schools and transit are
>   held by something else — LEVEL_EDUCATION's window and "one depot, one
>   district" — and taking the anchor would have put schools at 18, which is
>   exactly the university's 18. A university reaching no further than a school
>   is a school at forty times the price;
> - **the relocation is worse than the table below says, and the refund is the
>   answer to it.** 49 of the 54 buildings a 12-district city keeps stand on a
>   different square, and 150,771 is handed back for the 18 it sheds.

### Why this is one memo and not four

Four of Phase 7's eight features want a new 2x2 civic type: a library, a
theatre, a waste depot and a recycling centre. `CIVIC_SERVICES` holds five and
`civicSiteFor` interleaves them as `i * n + offset`, so `n` is the divisor —
and the divisor is not a table edit. It decides three separate things at once:
how many sites each type gets, what every `Service.plots` figure has to be, and
which square every existing civic building in every existing save stands on.

### What each divisor does

Sites each type receives, measured:

| types | sites/district/type | 1d | 4d | 12d | 49d |
| --- | --- | --- | --- | --- | --- |
| 5 (today) | 1.20 | 2,1,1,1,1 | 5,5,5,5,4 | 15,15,14,14,14 | 59,59,59,59,58 |
| 6 | 1.00 | 1,1,1,1,1,1 | 4 each | 12 each | 49 each |
| 7 | 0.86 | 1×6, **0** | 4,4,4,3,3,3,3 | 11,11,10,10,10,10,10 | 42 each |
| 8 | 0.75 | 1×6, **0,0** | 3 each | 9 each | 37,37,37,37,37,37,36,36 |
| 9 | 0.67 | 1×6, **0,0,0** | 3,3,3,3,3,3,2,2,2 | 8 each | 33×6, 32,32,32 |

The re-derived `plots` column follows from the rule SERVICES already states —
the hospital is exactly full coverage when every allowed building of its type
is standing, so the anchor is `24n / civicSites`:

| types | hospital | police | fire | school | transit | university |
| --- | --- | --- | --- | --- | --- | --- |
| 5 | 20 | 26 | 31 | 15 | 24 | 18 |
| 6 | 24 | 31 | 37 | 18 | 29 | 18 |
| 7 | 28 | 36 | 43 | 21 | 34 | 18 |
| 8 | 32 | 42 | 50 | 24 | 38 | 18 |
| 9 | 36 | 47 | 56 | 27 | 43 | 18 |

The university column does not move: a 3x3 site, one to a district, never on
the interleave.

### Two guards, and they fail together

**`LEVEL_EDUCATION`'s window.** Schools alone have to clear 0.60 and miss 0.85
at every district count. Swept over every integer `plots` from 1 to 80:

| types | derived | in window? | every integer that works | schools alone read |
| --- | --- | --- | --- | --- |
| 5 | 15 | yes | 15, 16 | 62.5% – 78.1% |
| 6 | 18 | yes | 15, 16, 17, 18, 19, 20 | 75.0% – 75.0% |
| 7 | 21 | **no** | 20 only | 65.6% – 87.5% |
| 8 | 24 | **no** | **none** | 66.7% – 100.0% |
| 9 | 27 | **no** | **none** | 56.3% – 100.0% |

**The >= 0.95 happiness ceiling**, re-run at every district count with every
type at its allowance:

| types | worst service coverage | worst target | where |
| --- | --- | --- | --- |
| 5 | 1.0000 | **0.9583** | 1d |
| 6 | 1.0000 | **0.9583** | 1d |
| 7 | 1.0000 | **0.9475** | 3d, transit 94% |
| 8 | 1.0000 | **0.9177** | 2d, transit 79% |
| 9 | 1.0000 | **0.9380** | 2d, school 56%, transit 90% |

The failures are not the hospital or the fire station — both still read 1.0000
everywhere. It is the **transit row losing sites at small district counts**,
which raises congestion, which lands in the modifier bracket. `TRANSIT_ROAD_SHARE`'s
own comment says a constant that quietly lowers the best a city can ever feel is
a constant that has re-opened someone else's calibration, and this is that,
arriving through the land instead.

So: **six 2x2 types is the last divisor that works, and it is not close.** Seven
breaches both guards, and eight and nine have no legal school constant at all.

### What it costs a save that already exists

A 12-district city with 64 civic buildings at their current allowance, re-read
under each divisor:

| types | buildings that change square | buildings with no site |
| --- | --- | --- |
| 6 | **53** (82.8%) | **6** |
| 7 | 47 | 12 |
| 8 | 40 | 19 |
| 9 | 35 | 24 |

This is the number `cityHallSites` warns about, priced. A returning player
would watch fifty-three buildings move and six disappear.

### The options, costed

**A. Fold new types onto the existing interleave.** Only n=6 survives the
guards, so this buys **exactly one** new type for the price of relocating 83% of
every existing city's civic buildings and refunding six. The migration cannot
pin them: pinning means storing which square each building is on, which is a
position in the save, which is the invariant this whole codebase is arranged
around. It could refund the six as cash, and that is the most honest form — and
it is still a save that opens with a different-looking city.

**B. A site class of its own, carved from courtyard.** The four spare courtyard
plots a district holds are the only land left. They are *not* 2x2 squares — they
are single interior plots, and Memo 4 already found this: a 2x2 square cut from
courtyard means re-cutting the district plan, which is `FRONTAGE_TARGET.squares`
and the sampler's acceptance rate. Same wall as the prison and the recycling
centre.

**C. Culture as a policy or an upgrade rather than a building.** Costs no land
at all. See section 13, which is where this one goes.

**D. Cut what does not fit.** The default, and it is not a failure: three of the
four features that want land turn out to have a better form that needs none.

### Recommendation

**A hybrid: C for culture, one use of A for waste, and D for the fourth.**

- **Library and theatre take option C.** Section 13 costs both readings the
  brief asked for and neither works as a weight or as a modifier. What does work
  is two rows in `LANDMARKS` on the small-landmark site that already exists —
  zero land, zero migration, no divisor change. Memo 4 reached this a cycle ago
  and the numbers still hold.
- **The waste depot takes the one option-A slot, if any feature does.** It is
  the only one of the four that is genuinely a civic building with a coverage:
  it collects, it has a reach, it belongs on the interleave. Six types works, on
  every guard, at every district count.
- **The recycling centre is cut**, and section 12 is why it does not need a site
  in the first place.

**But A's price is a save-compatibility break, and that is a decision for the
project rather than for this cycle.** Fifty-three buildings move and six are
refunded, in every existing save, and no migration avoids it. If the answer is
that returning players must not see that, then the waste depot is cut too and
`GARBAGE_COLLECTORS` stays a list of one — which costs the game nothing it
currently has.

---

## 12. The waste depot and the recycling centre

> **Since this was written**, this shipped exactly as recommended: the bus kept
> the bins, `GARBAGE_COLLECTORS` is still `['transit']`, and the waste depot
> lowers `garbageRate` at source through WASTE_RECYCLING instead of joining the
> collectors. One new civic type rather than two, which is the difference
> between six types and seven. Measured on the build, at 12 districts and the
> top of the ladder with half of each built: 0.970 with nothing, 0.485 with half
> the buses, 0.854 with half the depots, **0.427 with half of both** — the pair
> is the product of two factors, which is the whole argument.

Blocked on section 11, and worth writing down anyway because the measurement
answers the brief's own question about the bus.

### The bus keeps the bins

The brief asks what happens to `transit`'s collection when a real collector
arrives, and asks for both readings before choosing. Measured, a 12-district
city at the top of the ladder, a waste depot modelled as the sixth 2x2 type at
the 24-plot anchor from section 11:

| built | bus only | waste only | both | waste only, bus dropped |
| --- | --- | --- | --- | --- |
| 0% | 0.974 | 0.974 | 0.974 | 0.974 |
| 25% | 0.731 | 0.731 | 0.487 | 0.731 |
| 50% | 0.487 | 0.487 | **0.000** | 0.487 |
| 75% | 0.244 | 0.244 | 0.000 | 0.244 |
| 100% | 0.000 | 0.000 | 0.000 | 0.000 |

`garbageCollection` is a plot count over the housing land, clamped at 1, and one
finished collector already covers the city — `TRANSIT.plots` is 24 against a
district's 24 housing plots. So a second collector at the same reach is worth
everything to a city halfway through its first and **nothing** to one that has
finished it.

Which makes the choice a question about what a depot is rather than a balance
question:

- **keep transit in the array**, and the waste depot is a second way to buy a
  number the bus already buys. The player builds whichever is cheaper and the
  other is a 2x2 square doing nothing;
- **take transit out**, and the depot loses the fourth job `GARBAGE_MOOD` gave
  it last cycle. The worst case is the city that did everything right: a full
  bus network, no waste depot because there was none to build, reading 0.000 the
  night before and 0.974 the morning after — 9.7 points of mood taken from the
  player who bought the building that was answering it. No migration softens it,
  because there is no count to carry across.

**Recommend keeping transit in the array.**

### Then the second collector has to do something else

Which is what the brief already says about the recycling centre and is true a
rung earlier: a collector that only raises `garbageCollection` competes with the
bus for one number, where one that lowers `garbageRate` at source stacks with
it. `garbageRate` is `residents x PER_RESIDENT + shops x PER_SHOP + works x
PER_WORKS`, so a recycling term is a multiplier on that sum and the two
compose exactly — `garbage` is load times uncollected share, and the pair moves
both factors.

So the honest shape is **one new type, not two**: a waste depot that lowers the
rate rather than raising the collection, which is the recycling centre's job
under the depot's name. That is the difference between section 11's six-type row
(which works) and its seven-type row (which does not), and it is why the
recycling centre does not need a site of its own.

### Two things stay out of scope, and the reasons still hold

**Garbage as an accumulating stock.** `GARBAGE_PER_RESIDENT`'s comment rejects
it and the argument is unchanged: a stock is integrated, which is a fourth save
exception bounded by *elapsed time*, which is the exact property the three that
exist were careful not to have. Nothing measured this cycle weakens it. The
counter-case would have to be that a rate cannot express something a settled
city needs, and the ladder measurement — 0.174 at detached houses to 0.974 at
arcologies, never clamped — says the rate has range at both ends.

**Collection radius.** Garbage is a city-wide scalar. A radius makes it spatial,
which is invariant 5, and section 9 above already works through why the
equivalent move on pollution was deferred. One thing that section says is worth
repeating here because it is the whole answer: garbage's sources are residents,
shops and works, every one of them a city-wide scalar, so a field driven by them
would paint the same number on every plot.

---

## 13. Library and theatre

> **Since this was written**, both shipped — on a site class of their own rather
> than by sharing the museum's, because the eleventh square arrived (section
> 17). Two of this memo's conclusions held and one did not:
>
> - the fourth-weight and bracket-modifier readings were both re-costed against
>   the build and both still fail, for exactly the reasons below;
> - **the education split does not work.** A library feeding
>   `educationCoverage` has to clear no rung alone *and* leave schools-plus-
>   library under the 0.85 top rung, and schools already reach 62.5-78%. The
>   library's whole budget is 0.07 of coverage — three plots of reach, which is
>   a building that does nothing. The pool was too full to take a third
>   contributor;
> - so the two got different *existing quantities* instead, which is the brief's
>   own preferred route: a **library** answers the idleness half of
>   `crimePressure` (somewhere to go) and a **theatre** lands an audience on
>   `berthsLanding` (a reason to come). Neither carries mood, so the ceiling is
>   untouched by construction rather than by measurement.

### Both readings, costed

**As a fourth happiness weight.** The three non-zero weights sum to exactly 1
and a fourth takes its share from all three:

| term | today | culture 0.10 | 0.15 | 0.20 | 0.24 |
| --- | --- | --- | --- | --- | --- |
| hospital | 0.46 | 0.414 | 0.391 | 0.368 | 0.350 |
| fire | 0.30 | 0.270 | 0.255 | 0.240 | 0.228 |
| recreation | 0.24 | 0.216 | 0.204 | 0.192 | 0.182 |
| culture | — | 0.100 | 0.150 | 0.200 | 0.240 |

Every cell is a constant with its own measurement, and the damage is worse than
the table shows: `plots_i = 20 x w_hospital / w_i`, so a fourth weight moves the
**plots column** as well, which re-opens `LEVEL_EDUCATION`'s window and the
ceiling test together — section 11's table, arriving from the other side. And
that is before the land: culture as a weight needs a building, which needs a
site, which is the divisor.

**As a modifier in the bracket.** A maxed city sits at 0.9583 at every district
count. With a culture term of each sign:

| sign | size | ceiling |
| --- | --- | --- |
| bonus | +0.08 | 1.0000 (clamped) |
| bonus | +0.12 | 1.0000 (clamped) |
| penalty | −0.08 | **0.8783** |
| penalty | −0.12 | **0.8383** |

A bonus is mostly thrown away — the city is already at 0.9583, so most of +0.08
lands past the clamp. A penalty for going without culture takes the ceiling
under the 0.95 `test/services.test.ts` asserts, and that promise predates all of
this.

So the brief is right that the modifier bracket is the established route, and
the bracket turns out not to have room for this particular term either way.

### What does work, and it needs no land

`LANDMARK_MOOD` is +0.12 and a city that has earned 1.00 gains nothing from it —
and `config.ts` already says why that is the right shape: *landmarks buy
happiness early, standing in for services not yet built, and stop mattering once
the city is properly served.* That is, precisely, what a cheap library and a
cheap theatre would do.

**So culture is a cheaper tier of landmark, and the feature is two rows in
`LANDMARKS`.** Not a new system, not a fourth weight, not a sixth civic type.
Memo 4 above reached this a cycle ago and the arithmetic has not moved. Under
the museum: base 900 and 2,200, growth 1.5, reach 14 and 18.

**Giving the two buildings different jobs.** The brief is right that a library
and a theatre with one effect are one building with two names, and the split it
proposes is the right one — a library reaching education, a theatre reaching
mood. The education half fits without a weight: `EDUCATION_SERVICES` is a
*pool*, `educationCoverage` sums schools and universities over the housing
plots, and a third contributor joins the sum the way `GARBAGE_COLLECTORS` takes
a second collector. The constraint the brief states is the right one and is
measurable: the library's contribution must not alone clear a `LEVEL_EDUCATION`
rung. At 15 plots of reach on one small-landmark site a district, a fully
libraried city reads `1 x 15 / 24 = 0.625`, which clears the 0.60 rung on its
own — so the reach has to be under 14.4 plots, and 12 leaves the margin.

**The one thing still to decide, and it is a design call rather than a
measurement**: `landmarkSiteCapacity` gives one small site per district, so a
library, a theatre and a museum compete for the same square. Memo 4 recommends
sharing it and saying so — one small-landmark site a district, four things that
can stand on it, `canBuildLandmark` comparing against the sum. That costs no
land, needs no migration, and makes the tier a decision rather than a checklist.
What it needs measuring first is `landmarkPlotsCovered` at four small landmarks
a district rather than one, because the reach geometry is memoised against the
counts and this widens the key.

---

## 14. Demographics

**Reported, not implemented**, as the brief asks — and the recommendation is the
one Memo 5 above already reached, with the reasons re-measured against this
build rather than restated.

### What the save would gain, and how it would be bounded

`population(s)` is a pure sum over `homeLevels` against `LEVEL_HOUSING`;
`residents` is that times `occupancyR`. Measured on this build, `GameState`
carries 65 fields and **not one of them is demographic** — no age, no birth, no
death, no migration. (A text search over `src/` finds twenty-five hits for those
words and every one is a save migration or the renderer's growth clock.)

A *replacement* — age cohorts with births, deaths and migration producing
`residents` — gains a bucket array in the save and it is bounded by **elapsed
time**, which is the exact property the three existing exceptions were each
careful not to have: `surveyedR` grows with districts, `unlocked` with a static
table, `history` with a fixed ring. That is a fourth exception of a kind the
codebase has refused four times, and refusing it is not a technicality: a stock
bounded by time is a stock a twelve-hour absence has to integrate, and every
integration in this game had to be re-derived to survive that.

### How births and deaths would stay step-size invariant

The machinery exists and this cycle used it twice. A flow spent per tick is not
step-size invariant; a flow **accumulated** and spent out of a bank is. Births
and deaths would take the shape `driftR` already has — a fractional-people
accumulator per bucket, with whole people spent out of it — and any random draw
would take the shape `fireHazard` and now `callHazard` have: `rate x dt`
integrated into a hazard, spent against exponential waiting times, with a cursor
so a reload continues the same sequence.

That is genuinely solvable. It is also five new save fields per bucket, and the
measurement that would have to be run is `test/history.test.ts`'s: a 60-second
catch-up step against 3,600 one-second steps, agreeing to a stated tolerance.
The existing pair already disagree by 1.24% of income because congestion closed
a feedback loop; a demographic model closes a second one — deaths read the
hospital, the hospital reads happiness, happiness reads residents — and nobody
has measured what two coupled loops do to a coarse step.

### Which consumers change meaning

Every one of these reads `residents` or `population`, and there are 18 call
sites across `economy.ts`, `game.ts` and `save.ts`:

| consumer | what changes |
| --- | --- |
| `income` | rent is per resident; residents stop being capacity × fill |
| the labour market, `WORKING_SHARE` | a *share* of residents becomes a share of the working-age bucket, and `ZONE_SHARE` solves `14R = 8C + 20I` against the old one |
| every coverage denominator | already housing *plots*, so untouched — the one part of this that is free |
| all three `demandTargets` | `demandScale`, `SPEND_PER_RESIDENT`, `labourReach` |
| `crime` | both halves: `crimeCrowding` is residents per plot, `unemployment` is workers over `demandScale` |
| `garbageRate` | per resident |
| `TRIPS_PER_RESIDENT`, `congestion` | per resident |
| `visitors` and every tourism line | `VISITORS_PER_RESIDENT` |
| `RANKS` | the population column, which is `population` and not `residents` on purpose |
| the history ring | its population series |

`WORKING_SHARE` is on the frozen list and the labour market is what `ZONE_SHARE`
solves. So a demographic model does not merely add a readout; it re-opens the
zoning budget.

### What a returning player sees after twelve hours

Under a replacement: a population that has moved for reasons `occupancyR` did
not decide, on top of an `occupancyR` that also moved. `OFFLINE_CAP_SECONDS` is
twelve hours and `CATCHUP_STEP_SECONDS` is 60, so 720 coarse steps of a coupled
birth/death/migration model against an occupancy integrator that is already a
migration model. The away sheet would have to say which of the two moved the
number, and there is no honest way to split it.

Under the wrapper: exactly what they see today, plus a readout that explains it.

### The cheaper alternative, costed

**Age structure as a derived distribution over the existing cohorts.** Buildings
take levels in build order — the oldest slots hold the highest levels, which is
the one identity the whole cohort representation rests on — so cohort boundaries
already encode age. `LevelCohort`'s comment says exactly that: *age is exactly
what a cohort boundary encodes.*

So a distribution over `{ homeLevels, occupancyR, elapsed }` and a static table
is a pure function of counts. It needs **no new save state at all**, it is
bounded by the table the way `achievements.ts` is, and deleting it leaves the
city identical. It cannot double-count, because it produces nothing: a hospital
changes life expectancy in the readout and changes residents through the path it
already has, and those are the same fact stated twice rather than two effects.

What it cannot do is be a *mechanic* — a city that ages badly and loses people
to it. That is the honest cost, and it is worth paying, because the mechanic
version is `occupancyR` with more steps.

### Recommendation

**The wrapper.** Demographics as a readout over `residents`, in its own file, a
sibling of `achievements.ts`, with the `LevelCohort` argument written into its
header. Nothing else: no births, no deaths, no migration, no new save field, and
the existing migration model left as the only one.

And one thing to be explicit about with the reviewer, because it is the whole of
what the recommendation gives up: if the point of the feature is a population
that can *fall for demographic reasons*, the wrapper does not do it and cannot
be extended into doing it. That version is a multi-session rewrite of the centre
of the game and should be planned as one, starting with `ZONE_SHARE`.

---

## 15. Road widening

**Blocked, and reported rather than built** — but the version that fits is
worth costing, and the measurement turns out to answer the question by itself.

### Why the stated feature does not fit

"Widen a street to cut congestion locally" needs per-street or per-district
congestion. `congestion` is one city-wide number *by construction* and the
reason is in `ROAD_CELLS_PER_DISTRICT`: every district has the same 81 road
cells and the same 3+3 through-lines, so there is no district-to-district
variation to read and a per-district congestion number would be a fabrication.
Making it local is per-district state, which is invariants 1 and 5 together, and
`LevelCohort` names the class of change and the price it carries.

`test/traffic.test.ts` already asserts the generator property this rests on —
every district, at every one of the 49 positions, exactly 81 road cells and
exactly three lines on each axis. If that ever stops holding, congestion stops
being honest as a scalar and that test is what says so.

### The version that fits, measured

Road capacity as a city-wide term the player invests in: a multiplier `w` on the
road supply in `congestion`'s denominator. Same button, same fiction, one
scalar, no new spatial state. At 12 districts and the top of the ladder:

| | w=1.0 | w=1.2 | w=1.5 | w=2.0 | w=3.0 |
| --- | --- | --- | --- | --- | --- |
| no transit at all | 0.993 | 0.827 | 0.662 | 0.496 | 0.331 |
| every depot open | 0.298 | 0.248 | 0.199 | 0.149 | 0.099 |
| depots + a full network | 0.055 | 0.045 | 0.036 | 0.027 | 0.018 |

### And that is the answer: it is not worth buying

The brief asks whether widening and transit together leave either worth having.
Measured in points of mood, against a transit-free, unwidened city:

| what the city has bought | jam | mood | worth, vs nothing |
| --- | --- | --- | --- |
| nothing | 0.993 | −0.139 | — |
| every depot | 0.298 | −0.042 | **+0.097** |
| depots + network | 0.055 | −0.008 | **+0.131** |
| nothing, roads x2 | 0.496 | −0.070 | +0.070 |
| nothing, roads x3 | 0.331 | −0.046 | +0.093 |
| depots, roads x2 | 0.149 | −0.021 | +0.118 |
| depots + network, roads x2 | 0.027 | −0.004 | **+0.135** |

Doubling the entire road system is worth +0.070 to a city with no transit,
**+0.021 on top of the depots**, and **+0.004 on top of the depots and the
network**. Four thousandths of a point of mood, for a purchase the player would
have to be told was a major investment.

The reason is arithmetic and worth stating plainly, because it is not a tuning
problem: congestion is `trips x (1 - carried) / road`. Transit multiplies the
numerator; widening divides the denominator. They act on the same quotient, so
what matters is the *product* — and the marginal value of each falls as the
other rises. Two levers on one ratio can never both be worth buying, whatever
either one costs.

### Recommendation

**Do not build it, in either form.** The local version breaks two invariants; the
city-wide version does not, and is worth four thousandths of a point of mood to
a city that has already bought the transport it is competing with. If road
capacity is wanted as a *decision* rather than as a second congestion lever,
the honest place for it is the other side of the ratio — something that changes
`TRIPS_PER_RESIDENT` rather than the road, which is a statement about how people
live rather than about how wide the street is. That is a different feature and
not this one.


---

## 16. The eleventh square — asked for, built, measured, reverted

Section 13 recommended culture as two rows in `LANDMARKS` sharing the one
small-landmark site a district already has. That was put to the reviewer against
two alternatives and the answer was to **enlarge the districts instead**, so
that culture gets a square of its own rather than competing with the museum.

It was built. It does not work, and the reason is not a tuning miss.

### Widening the district is the expensive reading, and the wrong one

Measured over 60,000 raw plans at `DISTRICT_SPAN` 16:

| | span 15 | span 16 |
| --- | --- | --- |
| buildable-plot mode | 144 at 62.9% | 156 at 44.1% |
| commercial frontage | **45**, 100% of seeds | **48**, 100% of seeds |
| `ROAD_CELLS_PER_DISTRICT` | 81 | 100 |
| residential 24 reachable | yes | **no, at any square count** |

Commercial frontage is invariant per span — `zoneBlocks` lays shops along block
rings and a ring *is* the frontage — so widening moves `TARGET_PLOTS`,
`ROAD_CELLS_PER_DISTRICT`, the commercial count *and* residential off the anchor
`SERVICES` calls "the load-bearing part". Four load-bearing constants, and with
them `SHOP_BASE`, `SHOP_GROWTH`, `SHOP_THROUGHPUT`, `SUPPLY_DRAW`,
`EXPORT_PER_DISTRICT`, `CONGESTION_SCALE` and every `Service.plots`.

### The district does not need widening — the sampler was throwing the land away

`onTarget` pins the square **count**, so a plan offering ten or eleven 2x2
squares is rejected today for offering too many. Measured over 200,000 plans at
span 15, squares offered after the two 3x3s are taken:

| squares | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| share | 2.9% | 4.5% | 14.8% | 30.6% | 19.8% | **15.6%** | **8.2%** | 3.4% | 0.1% |

Nearly a quarter of on-target plans already offer more than nine. The tuples
with residential pinned at 24 and commerce at its invariant 45:

| squares | tuple (R/C/I/courtyard) | acceptance |
| --- | --- | --- |
| 9 | 24/45/**13**/8 | 2.481% — what ships |
| 10 | 24/45/11/6 | **0.192%** — a quarter of districts fail to generate |
| 11 | 24/45/**9**/4 | **1.607%** |

Ten is a wall rather than a near miss. Eleven works: `FRONTAGE_MAX_ATTEMPTS`
512 → 1,024 puts the failure rate back where the 512 note left it (6.3e-8 a
district), the expected cost is 62 attempts against 40, and a full 49-district
map generates in 336 ms.

It costs **four industrial plots**, and it has to: residential is pinned,
commerce is invariant per span, and the arithmetic forbids the alternative —
24 + 45 + 13 + 11×4 + 2×9 is 144 exactly, with nothing left for the parks.

### And four industrial plots is what the economy cannot pay

Industry is the densest employer in the game. `ZONE_SHARE` solves
`14R = 8C + 20I`, so cutting industrial land 13 → 9 is 13% of a district's whole
job supply and 31% of the dense third of it:

| | shops | works | total jobs | workers | jobs/worker |
| --- | --- | --- | --- | --- | --- |
| industrial 13 | 360 | 260 | **620** | 53 | 11.74 |
| industrial 9 | 360 | 180 | **540** | 53 | 10.23 |

`demandTargets.r` is `(jobs − reachableWorkers) / scale`, so residential demand
falls with the jobs. Measured, `npm run economy:calibrate` at three horizons:

| policy | 12h | 24h | 48h |
| --- | --- | --- | --- |
| discount-chasing, industrial 13 | R 0.0m | R 0.0m | R 0.0m |
| discount-chasing, industrial 9 | R 0.0m | **R 25.8m** | **R 1,244.4m** |

Residential pins at −1 for twenty of forty-eight hours against a build that pins
nothing under any policy at any horizon. Auto-develop ends 30% smaller as well:
65,909 residents against 93,683, on eight districts against nine.

That is the brief's stop condition, so the change was reverted rather than
tuned. And it is not tunable from here: the constant that would have to move is
`ZONE_SHARE`, which is frozen and is *precisely* the thing the land ratio
realises. This is the same wall section 8 predicted for farms — "halving supply
pushes industrial demand harder positive... this needs an
`npm run economy:calibrate` run before and after" — arriving from the other
direction and failing on residential rather than on industrial.

### What is left

The eleventh square is **available and unaffordable**. Two things would make it
affordable, and neither is this cycle's:

1. **re-solve `ZONE_SHARE` at 24/45/9.** The equilibrium is expressible — it is
   the same solve with a different `I` — but every constant priced against the
   old ratio moves with it, which is the cycle of work `DISTRICT_SPAN`'s own
   comment describes;
2. **give industry back its jobs somewhere else.** The estates already stand on
   land the city does not own and are counted apart from every plot total; a
   district that lost four works plots could be made whole by the band rather
   than by the zoning budget. That is a real feature and it is not a land memo.

Until one of those happens, **culture shares the small-landmark site** — section
13's recommendation, which costs no land, needs no migration, and is the only
form the measurement leaves standing.


---

## 17. What made the eleventh square affordable

Section 16 recorded the eleventh square being built, measured and reverted:
four industrial plots is 13% of a district's job supply, and residential demand
pinned at −1 for 1,244 minutes of a 48-hour run. The reviewer's answer was to
re-solve `ZONE_SHARE` at 24/45/9 and take the square, and that is what shipped.

### `ZONE_SHARE` itself does not move, and could not

This is the part worth writing down, because "re-solve `ZONE_SHARE`" is the
natural way to say it and is not what the fix turns out to be. `ZONE_SHARE` is
the **sampler's input**; the frontage tuple 24/45/9 is its **output**. Changing
the shares changes the tuple they produce, so the thing that was supposed to be
fixed moves out from under the fix. Once the land is fixed, the only free
variable left is **density**.

So the equilibrium is re-solved in the per-plot figures, each by 13/9:

| constant | was | is | what it restores |
| --- | --- | --- | --- |
| `JOBS_PER_INDUSTRIAL` | 20 | **29** | a district supplies **621** jobs, against 620 |
| `INDUSTRIAL_OUTPUT` | 9 | **13** | a district supplies **117** goods, against 117 |
| `INDUSTRY_BASE` | 120 | **173** | filling a district costs **3,724**, against 3,852 |
| `INDUSTRY_GROWTH` | 1.14 | **1.208** | `ZONE_FILL_MULTIPLE` **5.48**, against 5.49 |

The growth had to move with the base, or a district's industry would have got
cheaper for having less of it: `ZONE_FILL_MULTIPLE.industry` is
`INDUSTRY_GROWTH ** FRONTAGE_TARGET.industrial`, so the exponent shrank with the
land and the base had to compensate.

Measured, `npm run economy:calibrate` at three horizons after the whole cycle:

| policy | 12h | 24h | 48h |
| --- | --- | --- | --- |
| auto-develop | R/C/I 0.0m | 0.0m | 0.0m |
| discount-chasing | 0.0m | 0.0m | 0.0m |
| disciplined | 0.0m | 0.0m | 0.0m |
| disciplined + network | 0.0m | 0.0m | 0.0m |

Nothing pins anywhere, against the 25.8 and 1,244 minutes the first attempt
recorded.

### The square went to a class of its own, not to the landmarks

`landmarkSmallSites: 2` was the obvious way to spend it and is wrong. Two small
sites a district doubles the **museum's** allowance, and a museum is an
area-of-effect: measured, museums alone would have covered 83% of a
one-district city and 64% of a full map against the 46% and 47% the reach was
set to. `LANDMARK_MOOD` is deliberately worth less than the cheapest service
weight so that a landmark cannot be a way to skip the hospital, and a museum
covering two thirds of the map is exactly that.

So culture took `cultureSites: 1`, and the museum kept its reach of 24
untouched.

**One landmark constant did have to move anyway.** The re-cut changes which plan
every district accepts, so every site in the city sits somewhere new, and at the
stadium's old reach of 38 it covered 97% of a 25-district city on its own —
which makes the museum pointless once the dear one exists, the opposite of what
`LANDMARKS` is for. 34 puts the worst reading back at 85%:

| | 1d | 4d | 10d | 25d | 49d |
| --- | --- | --- | --- | --- | --- |
| museums only | 38% | 55% | 42% | 43% | 40% |
| stadiums only | 42% | 68% | 76% | 85% | 75% |
| both | 42% | 86% | 87% | 91% | 85% |

### What it cost the test suite, and what that was worth

Six fixtures moved, and every one of them was a real consequence rather than a
loosened standard — worth listing, because the next land change will hit the
same six:

- the plot-book sums gained the culture square. `tools/citygen.test.mjs` read
  140 of 144 until `cultures` joined the accounting, which is exactly the guard
  working;
- the overlay's plot count is derived from `SELLABLE_PER_DISTRICT` rather than
  typed as 4,018;
- the parcel invariant counts `MERGE_LEVEL` and above, because a richer city
  merges and climbs inside one catch-up step;
- the commercial-cluster bound went from 0.6 to 0.7 of a span, on a measured
  9.39 against a diagonal of 21.2;
- the happiness-lag test asserts the *share of the gap closed* rather than an
  equality, because with six civic types stretched twelve ways the target is at
  its clamp and still moving when the lag is measured;
- the response fixture is a served city, because an unserved one collapses
  before the calls it is measuring can fire.

### And one bug the refund introduced

Worth recording because it was invisible until a test took 266 seconds: the
first version of the v15 refund walked from what the city keeps to whatever
number the save file said. A doctored save claiming a billion hospitals ran a
billion-iteration loop **on the load path**. It is bounded by every civic square
there is — generous to every divisor this game has ever had, and still at most
six a district.
