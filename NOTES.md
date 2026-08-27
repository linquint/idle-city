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
| zone body meshes | 15, +9 shared parts = 24 (asserted) | 20, +9 = **29**, over `BUILDING_MESH_BUDGET` |
| `ParcelBook`s | 3 | 4 |
| demand signals | 3 | 4 |
| per-zone save fields | 7 families × 3 | 7 families × 4 |
| files referencing `ZoneKind`/`ZONE_KINDS` | 10 files, 93 references | all of them widen |
| references to the three zone strings | 185 | all reviewed |

**Verdict: not viable this cycle.** It is a generator change wearing a feature's
clothes.

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
