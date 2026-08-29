# District

An idle city builder in TypeScript and three.js. Every purchase is a building,
and the world expands district by district as you buy the land.

```bash
npm install
npm run dev
```

## Stack

Vite, TypeScript and three.js. The HUD is plain DOM — there is no UI framework,
so nothing competes with the render loop for the main thread. The whole game
compiles to about 10 kB gzipped on top of three.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck, then a production bundle in `dist/` |
| `npm run preview` | Serve the built bundle |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Simulation tests (vitest), then the generator suite |
| `npm run test:citygen` | District generation acceptance tests (plain Node) |
| `npm run citygen:calibrate` | Plot-count distribution over 1000 seeds |
| `npm run economy:calibrate` | 24h demand/pricing sweep under four policies |
| `npm run upkeep:calibrate` | What the civic wage bill is worth, swept over rate and growth |
| `npm run landvalue:calibrate` | What centrality does to rent, swept over spread |
| `npm run power:calibrate` | What the grid can carry, swept over the demand exponent |

## How it is put together

The one rule everything else follows: **the renderer owns no game state.**

```
src/
  sim/     pure numbers. Never imports three.js.
  render/  read-only subscriber. Owns zero game state.
  ui/      read-only subscriber. Owns zero game state.
  core/    rng, formatting, events. Imports nothing.
```

Nothing in `sim/` or `core/` may use a TypeScript feature that *emits* rather
than annotates — a constructor parameter property is the one that catches people
out. The calibrators run these modules straight through Node's type-stripping
loader, so anything it refuses stops `npm run economy:calibrate` at the import.

`render/` is loaded by two calibrators as well — the pedestrian ceiling and the
draw-call budget are *renderer* measurements and had to be priced somewhere — so
every module in it carries `.ts` extensions on its relative imports, same as
`sim/` does. Those two tools run under `--experimental-transform-types` rather
than the plain interpreter, which is what lets the render layer keep the
parameter properties it uses everywhere. `ui/` is not loaded by anything and
does not follow the rule.

`src/sim` is a plain object and some functions over it. It has no DOM, no
timers, no renderer — which is why the whole simulation is unit-testable in
Node, why offline progress is a loop rather than a special case, and why a save
file is ten fields instead of a scene graph.

Three techniques carry the rest:

**Land follows demand.** A district sells exactly 82 plots — that is geometry,
and it does not move — but how they divide between housing, commerce and
industry is not a compile-time constant any more. A surveyor reads the demand
signals and rezones the *frontier* district; the moment the next one is annexed
its split is fixed, so a city's zoning map ends up a record of what it wanted
when each district was new.

Residential takes a prefix of a district's shared parcels and commerce takes a
suffix, which is the whole of how this stays deterministic: a zone's k-th parcel
is a function of k alone rather than of the other zone's count, so surveying
commerce cannot move a home that is already built. Three zones cannot share one
pool that way — if residential can take nearly all of N, then (N−1,1,0) forces
commerce onto the one cell it leaves, (N−1,0,1) forces industry onto that same
cell, and (0,1,1) has them both claiming it — so industry keeps a reserve of its
own. That makes an industry-led city impossible inside the streets, and the
estates are the outlet.

Only the frontier can be rezoned, and that is a property of lists rather than a
rule about surveying: a zone's plots are the districts concatenated, so a list
may only grow at its end. Rezoning district 0 under a city of twelve would
insert plots before district 1's and shift every home past them onto different
ground.

The pool goes to whichever of the two zones wants it more, by a margin, provided
the one gaining is built out past `SURVEY_FILL` and the one losing has an empty
parcel at the end of its run. That last condition is what keeps a rezone from
taking the ground out from under a building. Floors stop a type being zoned out
of a district entirely.

Prices follow the allotment, per district: each district contributes the share
of its *own* land that is built on, so filling any district costs one district's
multiple whether that district holds eight commercial plots or fifty-five — and
annexation is price-neutral by construction, because a new district appends a
term whose numerator is zero. At the split every district sold before this
existed the curve is `BASE × 1.14 ** n` to fifteen digits, so a v9 save reopens
on exactly the land and exactly the prices it was left on.

**Generated districts.** Streets are not a grid. Each axis of a district is a
seeded walk in steps of 3-7, so blocks come out anywhere from 2x2 to 6x6, and
every non-road cell is labelled into a block with a frontage and a centrality
score. Blocks are then zoned whole — industrial by footprint and closeness to
the rail side, commercial by frontage and centrality with only the perimeter
plots taking shops, residential for the rest. Zoning block-wise rather than
plot-wise is what stops a factory quarter coming out half housing. Irregular
spacing means seeds disagree about how much land they carve out, so generation
rejection-samples until a district hits exactly `TARGET_PLOTS` — the economy
multiplies one per-district constant by the district count, and it has to be
true. `tools/citygen.test.mjs` guards all of it, and `npm run citygen:calibrate`
prints the distribution the target came from.

Only the 108 of those 144 plots that front a street could ever be for sale, and
not all of them are: two 3x3 squares go to the university and a landmark, and
`civicSites` then claims every 2x2 it can find — six for civic buildings, one
for a smaller landmark, one for the city hall and one for a power plant. That
leaves 24 housing, 45 commercial and 13 industrial plots a district, plus eight
interior courtyard plots of which four carry parks. There is no 2x2 slack left:
the district reserved two spare squares when the span widened and this cycle
spent both, so the next feature that wants one has to say where it is coming
from. Because the road-adjacent R/I split is *not*
seed-invariant, `districtPlanAt` rejection-samples the district seed a second
time until it is. Same trick, one level up.

The commercial count is invariant for a different reason: `zoneBlocks` lays
shops along block rings and a ring *is* the frontage, so it is 45 at this span
at 100% of seeds. Widening the district is therefore never additive — it moves
commercial capacity, and everything priced against it has to move too.

**Deterministic placement.** The save says `{ homes: 412 }`, never 412
positions. Which plot the 412th home stands on is a pure function of its index
and a seed, so the same save renders the same city on every device — and a
building placed in district 1 does not move when district 20 is annexed.
`test/layout.test.ts` guards exactly that.

**Levels, not new plots.** A building climbs five rungs — houses, apartments,
towers, arcologies, megastructures — and a promotion changes *what* stands on a
plot rather than how many plots exist, which is how an exponential economy stays
inside a world you can actually draw. Commerce and industry climb the same
rungs. Expansion is the second axis: annexing a district adds land, plots, and a
permanent civic bonus.

**Landmarks are an area of effect without per-building state.** A museum (2x2)
or a stadium (3x3) covers the housing plots inside its reach, and the share of
the city's housing land under at least one landmark is a single scalar that
happiness adds as a modifier — the same way the tax rate and free transport do,
so the four happiness weights still sum to exactly 1. The obvious
implementation, a modifier per building, would mean per-instance state and a
save that grows with the city; the covered share is a pure function of four
counts and the seed. It is memoised against those counts, because
`happinessTarget` runs ten times a second.

**Tourism does not need a coast.** A cruise terminal needs a coastal district
and a seed can leave a city inland for its whole life, so the **airport** is the
other way in. It stands on open ground past the far side of the industrial band,
at the end of the same highway spur the estates line, and it is gated on that
road rather than on a district count of its own — it is the same road, and two
numbers for one gate would be one too many. Where it stands is a pure function
of the seed: on the spur's axis if the ground allows, shifted a runway at a time
along the shore if the water took that site.

What it buys is arrivals on the path that already exists — it is worth
`AIRPORT_VISITORS` cruise berths, happiness scaling and all, so a miserable city
gets a runway and no tourists — plus a lift on the export tap that *adds* inside
the same bracket a cargo terminal's does. Additive is what stops it
double-counting: a city with both has one tap raised twice rather than two taps
for the same goods, and a multiplicative form would have made the airport worth
most to the city that least needs it. Measured, it multiplies an inland city's
tap by 1.25 and a fully-quayed one's by 1.07.

**Land value is a prefix mean, not a per-building field.** `citygen` has always
scored every block 1 at its district's middle and 0 at its furthest corner, and
rent has always ignored it. It does not now: a plot's rent is multiplied by
`1 + LAND_VALUE_SPREAD × (its centrality − the city's mean centrality)`, so a
house on the best plot in the city earns a quarter more than an identical one at
the rim. Centring it on the city's own mean is the load-bearing part — the mean
multiplier over a fully built city is exactly 1, so `RENT`, `HOME_BASE` and the
first tier's capacity all still mean what they meant, and the factor
redistributes rent across the build order rather than adding any.

This is the game's first spatially varying input, and it deliberately stops
short of per-building state. The k-th home's plot is a pure function of its
ordinal and the seed, so the mean over the first n of them is still a pure
function of counts — a prefix sum, read in O(1) because `income` runs ten times
a second. The `LevelCohort` comment in `state.ts` named exactly this as the
condition under which per-instance state would earn its cost; it does not, yet,
and the comment now says why the door is ajar rather than open.

**The ticker is a byproduct, not a record.** Fires, stalled housing, level-up
waves and services slipping below full coverage all used to happen silently
unless you were looking at the right part of the screen. `core/events.ts` is a
typed union and a bounded ring; `Game` pushes into it at the same places the
away-report counters are already bumped; the HUD drains it each paint into a
polite live region. None of it reaches `GameState`, nothing is saved, and no
simulation read consults it — a city with the log thrown away is the same city,
and `test/events.test.ts` asserts exactly that by stepping two games identically
and comparing their states.

Two things make it readable rather than a firehose. Runs **coalesce** — one line
saying "12 homes became apartments" rather than twelve saying one did — and the
merge happens on *both* sides of the handover, because the HUD drains every
frame and by the second building of a wave the first has already been taken.
And **catch-up is silent**: a twelve-hour absence emits thousands of events, and
the "while you were away" sheet is modal, has the player's attention, and
already lists every one of these categories with an exact count. A ticker
replaying it underneath would say the same facts twice and push the live ones
out of a sixteen-entry buffer first.

Silence alone is not enough, though, and the case that proves it is a *reload*.
The edge-triggered lines — housing stalled, the grid gone short, a coverage
slipping — fire on a transition, so a catch-up that crosses one absorbs it
permanently: a one-second absence was enough to leave a city capped at 37%
occupancy with an empty ticker and nothing on the default tab to say why. So
`Game.rearm` re-arms those watchers when the catch-up ends, and the rule the
ticker follows across an absence is **it reports the state you came back to, not
the history you missed**. Anything that went wrong and righted itself while you
were away says nothing; anything still wrong when you look says so once.

**Style is a hash, not a field.** Each zone has three styles at every level — 45
looks in all — and a style is a parameter set rather than a mesh: proportions, a
colour band, how many lit window bands, and which of the shared unit-geometry
detail parts it wears. Which one a building gets is `hash(slot, SEED)`, so it is
stable forever, identical on every device, and nowhere in the save.

### Rendering notes

The city is a handful of `InstancedMesh` draw calls — 15 bodies, one per (zone,
level), and 9 shared detail parts, plus roads, kerbs and land tiles — so a city
of four thousand buildings costs about the same as a city of forty. The 24 is a
budget rather than an accident, and `test/skyline.test.ts` asserts it: the naive
version of the same variety is 45 draw calls for what is fundamentally the same
box.

- `GrowableInstancedMesh` reallocates and copies instance buffers when the city
  outgrows them, doubling capacity so it stays amortised O(1) per instance.
- `GrowthSchedule` keeps only the buildings that are *currently animating* in a
  set, so per-frame cost tracks what is moving rather than how big the city is.
- The shadow map covers a fixed span that follows the camera's focus and snaps
  to a texel grid, so shadow density stays constant as the city spreads and
  shadows do not crawl when the camera drifts.
- **V** drops the camera to street level and brings it back. It is a mode on the
  same orbit rig rather than a second camera — a different set of clamps for the
  same three numbers, so the transition is the existing damping and the play
  camera is untouched. Two invariants hold it up, both from clamps rather than
  from per-frame tests: the pitch stays strictly under a right angle, so the eye
  is always above its own target and therefore above ground; and the target is
  snapped to a road cell on the way in and slid along the frontage after that,
  so a spring arm that shortens on contact with a block always has a street to
  shorten onto.
- Frustum culling is on for the static layers and the bounds are *stated* rather
  than derived: `cityRadius` is what the simulation already says, and asking
  three to rediscover it by walking nine thousand instance matrices every frame
  anything grows is paying a great deal for something already known. Measured, it
  rejects nothing — a mesh holding one (zone, level) across every district
  straddles the map — and it is on because it is correct and costs 51 sphere
  tests a frame.
- Where the street camera *does* pay is detail. Past 150 units from the focus a
  district's buildings keep their roofs and lose their dressing, which at 49
  districts is 69% of the part bank and 21% of every triangle in the scene. The
  test is per district (49 boxes, not 4,000 buildings) and it only engages when
  the camera is within 120 units of what it is looking at: the wide shot wants
  every band and beacon it has, and a mask that fought it would be dimming the
  city to save work nobody was doing.
- Fog depths are measured from the camera, so they track the orbit distance as
  well as the size of the city.
- Road cells work out their own orientation from whether their neighbours are
  roads, so a junction, a straight run and a T-junction where a street meets a
  district boundary all fall out of the same lookup.
- **Z** steps an overlay through off → plan → demand. Both modes recolour the
  city by zone through the same per-instance colour path that already varies
  concrete shade, and draw every zoned plot with nothing on it yet as a flat pad
  — one extra draw call. In demand mode the pads take their colour from the
  zone's current demand instead: green where a discount is live, red where the
  type is oversupplied. Demand is quantised to twenty steps before it reaches
  the rebuild stamp, or the pads would be rebuilt every frame for a signal that
  moves on a 25-second constant.
- Traffic and pedestrians are two readouts of the same trip count. `cars.ts`
  draws the trips that are on the road; `pedestrians.ts` draws the ones that are
  not, which is exactly `trips - roadTrips`. So a city with no depots has empty
  pavements by construction — buying transit is what puts people on the street —
  and neither fleet stores a thing. The walker ceiling is 480 against the car
  fleet's 160, measured at 0.099 µs an instance a frame: a walker is square in
  plan so it needs no rotation, and it is 2.3 shadow-map texels across so it
  stays out of the depth pass.
- Industry is the anti-tower — wide, low and flat, with one stack. Height is how
  the housing tiers say "bigger", so industry competes on footprint instead.
- Civic buildings get 2x2 plots, which is room for a silhouette each rather than
  three colours of the same box: the hospital is pale with a tower, the police
  station low and dark, the fire station squat with a lit bay-door face.
- Land nobody will build on is drawn as courtyard, not left as a hole — block
  interiors, and the civic sites still standing empty.

## Deploying

The game is a static bundle — no server, no API, saves live in `localStorage` —
so GitHub Pages serves it as-is. `.github/workflows/deploy.yml` builds `dist/`
and publishes it on every push to `master`.

The workflow sets the Pages source to **GitHub Actions** itself, so the site
lands at `https://<owner>.github.io/idle-city/` with nothing to click. That
matters beyond convenience: while the source is still **Deploy from a branch**,
GitHub's legacy builder runs on the same push and publishes the repository root
— the unbuilt `index.html`, which loads no bundle and 404s on `/src/main.ts`.
Whichever finishes last wins, and it is usually the legacy one.

If the workflow logs a warning that it could not set the source, set it by hand
under **Settings → Pages → Build and deployment** and re-run the workflow.

`base: './'` in `vite.config.ts` keeps every asset path relative, so the bundle
works at that subpath, at a custom domain, or opened from disk without a
rebuild.

## Supply and demand

Residential, commercial and industrial each carry a demand signal in `[-1, 1]`,
negative meaning oversupplied. They are **integrated, not derived** — the lag is
the mechanic, which is why they live in the save file — and their targets form a
cycle:

```
industry → jobs → residents → shoppers → commerce → jobs
```

so the order you build in decides which button is cheap next. A positive signal
discounts that type's price and a negative one surcharges it, which is what
stops "press whichever button is cheapest" from being the dominant strategy.

**A bigger shop serves a bigger crowd, sub-linearly.** Jobs are flat per plot at
every level and always will be — that is the arc `WORKING_SHARE` describes, and
a ladder on them freezes it — but trips, goods drawn and goods made climb at the
square root of capacity. Flat, they made the city want 0.29 commercial plots per
housing plot at the bottom of the ladder and 85.71 at the top, against the 1.88 a
district sells: 45.7x short of commerce with nothing a player could do about it,
which is what pinned commerce at +1 and housing at -1 the moment the two drifted
apart. What it costs is build-out — a demand-neutral district of towers settles
at 24.7% against a 70% annexation gate where it settled at 89.9% — and the
answer to that is land supply rather than a constant.

**Services reach demand directly, not only through mood.** Until `DEMAND_TERMS`
existed, everything the player built reached the demand loop through exactly one
channel: happiness, and only as a ceiling on housing. A hospital and a park and a
police station were interchangeable to it. Now housing follows safety and health,
commerce follows footfall — transit and landmarks — industry follows schools, and
the tax rate drives business away as well as costing mood. Every term is additive
on the *target*, inside `clampDemand`, so `Game.step` stays the only thing that
integrates and the bounds are the bounds they always were. The whole table is off
while the city has no housing, which is what keeps a fresh save bootstrapping off
the export tap exactly as it did. The Demand tab shows the breakdown, because a
signal that moves for a reason the player cannot name is not a mechanic.

### Power is a ratio, not a fourth signal

The city's second resource, and the first thing in it that can be *short*.
Every standing plot draws — 1 for housing, 1.5 for commerce, 3 for industry —
and the draw climbs the level ladder **faster than the ladder does**, at
`capacity ** POWER_EXPONENT`. Supply is `POWER_BASE`, the grid the city starts
connected to and grows out of, plus one plant per district's reserved 2x2
square, each built to the standard of the city around it the way an estate is
built to the standard of its works.

The exponent is not a taste — it is the last one the land can hold. A district
reserves exactly one plant square, so the question is whether one plant still
carries a district built out at the top of the ladder:

| exponent | detached | apartments | towers | arcologies | megastructures |
| --- | --- | --- | --- | --- | --- |
| 1.00 | 0.19 | 0.19 | 0.19 | 0.19 | 0.19 |
| 1.25 | 0.19 | 0.26 | 0.38 | 0.55 | **0.78** |
| 1.30 | 0.19 | 0.28 | 0.44 | 0.68 | **1.03** — does not fit |

At 1.00 the term does nothing; at 1.30 a fully built megastructure district
needs more plant than its ground can hold and browns out permanently at the top
of a ladder it was allowed to climb. 1.25 leaves 22% of headroom.

Supply over draw is **derived, never integrated** — occupancy already lags on a
120-second constant and demand on 25, and a third lagged signal feeding the
first would make the whole loop unreadable. What the ratio does is *cap
occupancy*, proportionally, with a floor: a browned-out city empties gradually
and visibly rather than flipping to zero income. `POWER_FLOOR` is 0.35 and the
number is derived rather than chosen — a blacked-out but otherwise happy city
settles at `OCCUPANCY_FULL × 0.35 = 0.322` against an `OCCUPANCY_EMPTY` of 0.25,
so a brownout costs a city its residents and never its buildings.

Draw is charged on what is *standing*, not on who is in: if it fell with
occupancy the brownout would cure itself and there would be no decision in it.
A ruin draws nothing, because it holds no level. Auto-development buys a plant
whenever the grid is short, for the reason everything else that compounds while
away is guarded. Measured, a city left to run itself is first short at 83
minutes and never drops below a supply ratio of 0.99.

The guardrail is that the modifier is bounded by a *constant*. The discounted
price floor is still `base × growth ** n × (1 - PRICE_DISCOUNT_MAX)` —
exponential in n — so no amount of demand can make the next building cheaper
than the last. Let the discount scale with something unbounded, or let
`PRICE_DISCOUNT_MAX` reach 1, and the curve inverts and the city builds itself
for free. `test/demand.test.ts` asserts the curve is strictly increasing in n at
maximum discount, for all three types.

Smoothing is exponential — `d += (target - d) * (1 - exp(-dt / TAU))` — not
`d += (target - d) * dt / TAU`. The naive form oscillates and then diverges once
`dt > TAU`, and catch-up steps whole minutes against a 25-second constant. The
exponential form saturates correctly at any step size, which is the only reason
offline catch-up is safe to run coarsely; the step-size invariance test is what
guards it.

Hospitals, police stations and fire stations earn nothing. Their coverage feeds
a happiness score which multiplies income (floored at 0.55), **caps residential
demand**, and below `HAPPINESS_MIN_BUILD` stops housing outright — so a city
with no hospital watches its residential bar flatline however many jobs it has
going spare, and then stops growing entirely. That is the tutorial, and it has
no text.

Coverage is measured against **housing plots**, not residents. That is the one
denominator that survives the level ladder: residents per plot run from 4 to 300
as buildings climb, and the civic land they stand on is fixed at six 2x2 sites
a district — so a per-resident measure meant need scaled with density while
supply scaled with land, and a maxed-out city read 34% happiness at every size.
Plots are also merge-invariant (a pair of houses that becomes one tower still
holds two plots) and occupancy-invariant (a boarded-up house still holds its
land), so coverage answers "how much of the city is served" and nothing else.

A shortfall is charged **in proportion to how much city there is to fail**, up to
`COVERAGE_GRACE_PLOTS`. A service fails nobody when nothing has been built — that
rule was already there at zero plots, and it used to be a step: the first house
took every service from failing nobody to failing everybody, and handed a
one-house village a 130 hospital to fix it. Since income is quadratic in
happiness (once through `HAPPINESS_FLOOR`, again through occupancy) the village
earned 4.8% of its rate with the housing gate shut in front of the only building
that could reopen it. The ramp is that rule made continuous, and it is spent by
twelve housing plots — the smallest city the gate has ever been calibrated
against — so nothing above it moves at all.

A zone also never writes off its *last* standing building. That is the same rule
`OCCUPANCY_FLOOR` is — a neglected city should read as one that has stopped
growing, not one that has been switched off — and the floor stopped short of it,
because occupancy is a share of a stock and a stock of nothing has no share. A
zone written off to the last plot houses nobody and earns exactly zero, and with
residents at zero the occupancy target sits under `OCCUPANCY_EMPTY` forever and
nothing ever recovers. One home standing is a third of a resident and a hospital
in about ninety minutes: slow enough to read as the consequence it is, and not a
save you have to throw away.

Three rules keep it from being either free or punishing. A new building ramps
its staffing in over ninety seconds rather than covering anything the moment its
roof goes on. A build gate of `floor(housingPlots / plots) + 1` means you may
always be one ahead of need and never five, so early cash cannot be dumped into
permanent coverage. And an empty city reads as fully covered rather than fully
neglected — coverage is the share of the housing a service fails, and it fails
nothing when nothing is built, which is what stops the housing gate deadlocking
the opening.

Each stands on a 2x2 site reserved before the housing list is drawn, and the
five 2x2 types draw from one city-wide list by a fixed interleave — hospitals
take site 5k, police 5k+1, fire 5k+2, schools 5k+3, depots 5k+4. Assigning them to whichever district was worst
covered would make a building's position depend on the state when it was built,
which a save of counts cannot reproduce; the city would rearrange itself on the
next refresh.

That divisor is `CIVIC_SERVICES.length`, and it is the number that must never
move for convenience: a sixth entry in that table would put every hospital,
police station, fire station, school and depot in the city on a different square,
and a returning player would watch their city rearrange itself around a save that
had not changed. Anything new that wants a 2x2 gets a list of its own, sliced
after these — which is what the **city hall** does.

There is one city hall in a city, on district 0's reserved square, and what it
buys is the right to have policies: the tax rate, free transport and
auto-develop are all gated on it, and until it is built the city runs at
`TAX_NEUTRAL` with fares on. That is exactly what a fresh city already got, so
nothing about the opening minutes changes. A returning save from before it
existed is *granted* one, because those cities set their rates under the old
rules and reverting them silently would change what they earn for reasons the
player never chose. Its square is reserved in every district and built on in
one — the reservation has to be uniform or `homeCapacity` stops being a
multiplication.

Worth stating because it is a lever that does not work: the hall lands at about
1.3 hours whatever it costs. A seven-fold price change moves the unlock by
thirteen minutes, because what gates it is the opening's ramp and not the number.

### Coverage costs something to keep

Civic buildings also carry an **operating upkeep**, which is what stops "buy
every service the land allows" from being strictly correct. The bill is priced
off what each type cost to open, compounded gently over how many of them there
are, and scaled by `ledgerScale` — what a plot of the city is worth against a
plot of a fresh one. That last term is the one that took measuring. Income
climbs the level ladder *twice*, once through the people paying rent and once
through the shop multiplier that rent is multiplied by, so a bill scaled by
anything linear in the ladder falls away to nothing: a flat rate times
`cityScale` reads 4.6% of the ledger at one district of apartments and 0.0% at
forty-nine of megastructures. Against `ledgerScale` the share is flat to three
significant figures at every rung, and runs 11% to 18% from one district to
forty-nine. `npm run upkeep:calibrate` prints the sweep the constants came from.

`income` stays gross — it is what the buildings *earn*, which is what the
inspector and the estates panel mean when they read it — and `netIncome` is what
the treasury actually gains. The dock shows net; the Treasury tab shows all
three.

The bankruptcy rule is that **unpaid wages decay staffing, not buildings.**
Permanent loss is the fastest way to make someone close an idle game, and
staffing is already an integrated scalar with a ramp, so the same machinery that
opens a hospital closes it and reopens it. Because upkeep is charged against
*staffed* buildings, a city that cannot pay stops paying: coverage falls to what
it can afford, income recovers against a smaller bill, and the payroll ramps back.

Two rules keep that from being a deadlock rather than a brownout. Wages are
budgeted out of revenue and never out of reserves, so the treasury grows by at
least a tenth of gross income however deep the arrears run — without it the
decay settles at a fixed point that still owes more than the city earns, and a
city that cannot afford its only hospital sits at 0.00 forever. And a rich city
that has over-bought coverage browns out too, because it cannot spend savings on
wages it does not earn. Auto-development answers to the same arithmetic: while
the ledger is negative it will not buy anything that adds to the payroll, and it
holds a minute of the shortfall back from everything else.

### Rank gates what a city may build

A city has a rank — village, town, city, conurbation, metropolis — and it is
derived, never stored: a pure function of `s.districts` and `population(s)`, so
an offline catch-up and a watched session agree by construction and a save from
an older balance pass opens on whatever rank its counts now imply.

Two thresholds a rung, and the city has to clear both. `LEVEL_HOUSING` spans 4
to 2,400, so one district of arcologies holds 28,800 people — dense, and a dense
village is still a village. The mirror case is forty-nine districts of bungalows,
which is large and empty. The rank is the lower of what the two say.

Four buttons are on the ladder: the city hall (town), the museum (town), the
stadium (city) and the highway (conurbation). Every one of them bites — the
calibrator prints how long each gate holds a button the price would otherwise
have opened. The other candidates were examined and left alone, because a second
gate on one button is two numbers saying one thing: the airport has the highway,
port terminals have `hasCoast`, and power plants were rejected outright because a
brownout caps occupancy and the grid is what lets a city reach a rank at all. The
university looks like the archetypal late building and is the one that was
measured out: it is what a city needs to clear the second education rung, which
arrives inside the first hour, and a rank on it deadlocks the level ladder.

### Founding the city again

`SEED` is a compile-time constant, so every city this game has ever drawn is
already on the same map — the water, the street walks, the plot lists and the
annexation spiral are identical across runs by construction. So an ascension is
not world generation: it is `reset()` plus two scalars that survive it.
`foundings` counts how many cities have stood here, and `legacy` counts the
districts they gave up. `test/ascension.test.ts` fingerprints the whole world and
asserts a city founded six times draws exactly what one founded once does.

The carryover is `1 + 0.15 * sqrt(legacy)` on income. `achievements.ts` refuses
to grant anything and explains why — a payout is "a multiplier handed to the
player for doing what they were going to do anyway" — and this violates that
rule deliberately: an achievement fires for playing, and this fires for *giving a
city up*. The shape of the argument is kept, though. Districts are the currency
because one run can contribute at most 49 of them however long it is left
running, and the square root is what makes four full runs twice the first rather
than four times it. The sizing guard is time to the first annexation: run 1 buys
its second district at 1:30:18, run 2 at 49:35, run 3 at 43:05, run 20 at 22:47.
Cash is only half of that gate — `activeDeveloped` has to reach
`ANNEX_MIN_OCCUPANCY` first — which is why the multiplier can be as large as it
is without deleting the opening hour.

### Crime and rubbish are quantities, and police stopped being a weight

Crime used to be an abstraction: police coverage fed the mood directly, so "how
safe is the city" meant "how many police stations did you buy". It is a quantity
now, with sources the city can act on — crowding, which is residents per housing
plot, and idleness, which is the labour imbalance `demandTargets` already reads,
normalised by `demandScale` because this game is structurally worker-rich and a
naive jobs-over-workers ratio reads 96% at every size.

That made the weight a decision rather than an addition, and it was taken the
way the brief framed it. Police carried 0.26 in a weighted sum of four; charging
that *and* a crime modifier would bill one purchase twice, and the calibrator
prints what that costs — between 1.5 and 2 stations of mood for one station. So
police dropped to `weight: 0`, crime carries the whole term at `CRIME_MOOD` 0.26,
and the other three were re-normalised: 0.34 / 0.22 / 0.18 over 0.74 rounds to
0.46 / 0.30 / 0.24, which still sums to exactly 1.

Rubbish is the same machine. A rate rather than a stock, because a stock would
have to be integrated and that is a fourth exception to "the save is counts"
bounded by nothing. Residents, trading premises and working industry make it;
the transit depot collects it, because the depot is the municipal yard and a
council that runs its buses out of one runs its bin lorries out of it too.

Neither has a geometry, and neither pretends to. `covered` is a plot count with
nothing anywhere deciding which plots — the rule the coverage overlay already
states — so a circle round a police station would put a number on screen the
services panel does not have. The two new overlay modes say what `coverage`
says: which plots the answer accounts for, oldest land first, with the rest
shaded by how bad the city-wide reading is.

The ceiling is safe by construction and measured to be: both are pressure times
*uncovered* service, so a fully served city reads exactly zero on each, and the
happiness ceiling comes out identical before and after to six decimal places at
every district count and level. What moved is everything below it.

### There is a city next door, and it can be traded with

`rivalStrength` is derived and never stored, which is the whole of why it
survives an offline catch-up: it is a function of `elapsed` and `districts`,
both of which only ever rise, so twelve hours away lands on exactly the rival a
watched session would have. A stored scalar would have been a fourth exception
to "the save is counts" — and unlike the three that exist, bounded by a clock
rather than by districts, a table or a ring.

Two factors, and between them they are what makes a rival a feature rather than
a tax. It **arrives**: `age / (1 + age)` against `RIVAL_SETTLE_SECONDS`
saturates instead of clamping, so there is no tick at which it suddenly is one.
And it is **outgrown**: at `RIVAL_MATCH_DISTRICTS` the place next door is a
suburb and the term reads zero, so the answer the player was always going to
reach for is an answer.

It reaches the game as two `DEMAND_TERMS` rows — commerce −0.11, industry −0.15
— rather than as a line in `demandTargets`, so the demand breakdown names it
without a case of its own. A rival the player cannot find would be
indistinguishable from commerce being mysteriously expensive. Housing has no
row: a rival competes for trade, and people live where they work. The sizing is
against `priceModifier`'s asymmetry rather than against the signal, which is the
trap: a rival that pinned a signal would not slow the city down, it would make
what it pins 60% dearer forever. Measured, it costs between 5.1% and 12.3% of a
fill across the whole demand range.

Two agreements answer it, both behind `hasPolicy` like the tax rate:

- **Power** is a three-way switch, `POWER_TRADES`, in the shape `TAX_STEPS`
  already is — one index in the save and the whole of what it does in one place.
  Importing raises supply by half the draw and bills for it every second, which
  is the answer to a brownout the grid cannot be built out of yet; exporting
  sells whatever the city's own plants make over its draw. Selling is capped at
  `POWER_EXPORT_CAP` of the draw, because uncapped it was worth 582% of the
  ledger — and the *rank gate* is the larger half of that guard, since the city
  that has the most spare power is a village and a village has no hall to sign
  with. Worst case over everything that could sign: 8.9%.
- **Goods** lifts the export tap by `GOODS_TRADE_LIFT`, in the same additive
  bracket the cargo berths and the runway are in, so there is still one number
  the outside world's appetite is made of. It answers `GOODS_TRADE_ANSWER` of the
  rival — not all of it, or the switch would be a chore rather than a lever. The
  fee is a share of the ledger rather than a flat rate, for the reason
  `civicPayroll` is: measured at 2.8% of income at 1, 10 and 25 districts, where
  a flat fee would have fallen from 0.31% to 0.01%. It pays through demand and
  costs through the ledger, so a city signs it to grow into rather than to cash.

Neither touches happiness at all — the rival is a demand term and the treaties
are a supply and a tap. `tools/rival.calibrate.mjs` prints all of it.

## Balance

Every tunable is in `src/sim/config.ts`, and nothing else in that file imports
anything. `ZONE_SHARE` is the one set of numbers that looks wrong and is not: R 0.48 /
C 0.31 / I 0.21 solves the tier-0 job/worker equilibrium, and rounding it to
50/30/20 breaks the demand loop. `RENT`, `HOME_BASE` and the first tier's capacity together set how
long the first house takes to pay for itself, which is the number the opening
minute lives or dies on. `test/game.test.ts` guards the pacing at both ends: no
dead first minute, and no filling a district in a quarter of an hour.

The demand constants are measured, not guessed: `npm run economy:calibrate`
simulates 24 hours under four policies and reports demand pinning, cost-curve
monotonicity, time to first rezone/annex/service, and happiness at 1h/6h/24h.
The numbers in the config comments came from it.

`UPKEEP_RATE` (1.5e-4) and `UPKEEP_GROWTH` (1.02) came from
`npm run upkeep:calibrate` the same way. The rate is a payback period —
1/`UPKEEP_RATE` seconds for a building to spend its own opening price on wages
at a fresh city's premises — and the growth is deliberately almost flat, because
income grows quadratically in the district count while a compounded payroll
grows exponentially in it: at 1.08 a full map owes more in wages than it earns.
`UPKEEP_ARREARS_TAU` (180s) is twice the staffing ramp, for the same reason
recovery outpaces decay everywhere else in this game, and `UPKEEP_KEEP_SHARE`
(0.1) is the floor that makes the way back slow rather than shut.

The airport's constants come from `npm run water:calibrate`, beside the berths
they are priced in. `AIRPORT_BASE` is what the *next* district would cost at the
moment the highway opens — the only curve still steep where the airport unlocks
is the land's — and `AIRPORT_PAYROLL` is set against what it earns rather than
against what it cost: at 24,000 it charged 2.23% of a fourteen-district ledger
against 0.91% of tourism, so the one building that gives an inland city tourism
at all would have lost money the day it opened. At one university's worth
(7,200) it is 0.67% against 0.91%, and the freight lift is upside.

`POWER_EXPONENT` (1.25) came from `npm run power:calibrate`, and it is the one
constant in this game set by the *land* rather than by the economy — see the
table above. `POWER_PER_PLANT` (700) is sized so a full map runs at a supply
ratio of 1.29 with every square built on, and `POWER_BASE` (400) covers a
district at level 0 three times over and one of apartments not at all, so the
first plant is what the first promotion wave asks for. Plants are on the wage
bill and take it from 16.6% of gross income to 20.6%.

## Saving

Saved to `localStorage` every ten seconds, on tab hide, and on unload. Time away
is credited on load in fixed 60-second steps, capped at twelve hours — fixed
*size* rather than a fixed count, because demand is a feedback loop now and
coarse steps let auto-development compound against a curve that has already
jumped to its asymptote. Turn on **Auto-develop** and surplus cash is spent
while you are gone, on the cheapest thing the city is not already oversupplied
in, leaving room in the residential zone for the services it still needs.

Everything degrades rather than breaks: a corrupted save, a browser with storage
switched off, or a save from an older balance pass all open — clamped into
something legal instead of rejected. A v1 save is read out of the key it was
written under and brought forward; a save claiming `demandR: 50` is clamped back
into the band rather than handed free buildings; and a save whose whole housing
stock was written off — a state older builds could reach and this one cannot —
gets its last building back, because a city with no standing housing earns
exactly zero and can never recover from it.
