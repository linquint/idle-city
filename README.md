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
| `npm test` | Simulation tests (vitest) |

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

Two techniques carry the rest:

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

## Balance

Every tunable is in `src/sim/config.ts`, and nothing else in that file imports
anything. `RENT`, `HOME_BASE` and the first tier's capacity together set how
long the first house takes to pay for itself, which is the number the opening
minute lives or dies on. `test/game.test.ts` guards the pacing at both ends: no
dead first minute, and no filling a district in a quarter of an hour.

## Saving

Saved to `localStorage` every ten seconds, on tab hide, and on unload. Time away
is credited on load, capped at twelve hours. Turn on **Auto-develop** and
surplus cash is spent on the cheapest available plot while you are gone, so the
city grows rather than just the bank balance.

Everything degrades rather than breaks: a corrupted save, a browser with storage
switched off, or a save from an older balance pass all open — clamped into
something legal instead of rejected.
