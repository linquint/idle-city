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

## How it is put together

The one rule everything else follows: **the renderer owns no game state.**

```
src/
  sim/     pure numbers. Never imports three.js.
  render/  read-only subscriber. Owns zero game state.
  ui/      read-only subscriber. Owns zero game state.
  core/    rng, formatting, events. Imports nothing.
```

`src/sim` is a plain object and some functions over it. It has no DOM, no
timers, no renderer — which is why the whole simulation is unit-testable in
Node, why offline progress is a loop rather than a special case, and why a save
file is ten fields instead of a scene graph.

Three techniques carry the rest:

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

Only the 72 of those 90 plots that front a street are ever for sale; the rest is
the interior of a deep block, and `civicSites` claims most of it for the 2x2
quads hospitals, police and fire stations stand on. That leaves 19 housing, 28
commercial and 11 industrial plots a district — and because the road-adjacent
R/I split is *not* seed-invariant, `districtPlanAt` rejection-samples the
district seed a second time until it is. Same trick, one level up.

**Deterministic placement.** The save says `{ homes: 412 }`, never 412
positions. Which plot the 412th home stands on is a pure function of its index
and a seed, so the same save renders the same city on every device — and a
building placed in district 1 does not move when district 20 is annexed.
`test/layout.test.ts` guards exactly that.

**Tier replacement.** Rezoning swaps houses for apartments for towers for
arcologies. A purchase changes *what* stands on a plot, not how many plots
exist — which is how an exponential economy stays inside a world you can
actually draw. Expansion is the second axis: annexing a district adds land,
plots, and a permanent civic bonus.

### Rendering notes

The city is a handful of `InstancedMesh` draw calls — one per building tier,
plus roads, kerbs and land tiles — so a city of four thousand buildings costs
about the same as a city of forty.

- `GrowableInstancedMesh` reallocates and copies instance buffers when the city
  outgrows them, doubling capacity so it stays amortised O(1) per instance.
- `GrowthSchedule` keeps only the buildings that are *currently animating* in a
  set, so per-frame cost tracks what is moving rather than how big the city is.
- The shadow map covers a fixed span that follows the camera's focus and snaps
  to a texel grid, so shadow density stays constant as the city spreads and
  shadows do not crawl when the camera drifts.
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

Three rules keep it from being either free or punishing. A new building ramps
its staffing in over ninety seconds rather than covering anybody the moment its
roof goes on. A build gate of `floor(residents / capacity) + 1` means you may
always be one ahead of need and never five, so early cash cannot be dumped into
permanent coverage. And an empty city reads as fully covered rather than fully
neglected — coverage is the share of residents a service fails, and it fails
nobody when there is nobody, which is what stops the housing gate deadlocking
the opening.

Each stands on a 2x2 site reserved before the housing list is drawn, and the
three types draw from one city-wide list by a fixed interleave — hospitals take
site 3k, police 3k+1, fire 3k+2. Assigning them to whichever district was worst
covered would make a building's position depend on the state when it was built,
which a save of counts cannot reproduce; the city would rearrange itself on the
next refresh.

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
into the band rather than handed free buildings.
