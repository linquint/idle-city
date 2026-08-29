/**
 * Registering the service worker, and nothing else.
 *
 * Its own module rather than four lines in `main.ts`, because the *scope* is
 * the whole of the difficulty and it needs somewhere to be explained.
 *
 * ---
 *
 * **The scope, which is the classic way to get this wrong.** GitHub Pages
 * serves this from a repository subpath — `https://user.github.io/idle-city/` —
 * and a service worker's default scope is the directory its own script is
 * served from. It can never control a path above that, whatever the code asks
 * for, so the only thing that works at the root *and* at a subpath *and* at the
 * dev server is to register a script that sits beside the page and let its
 * scope be the page's own directory.
 *
 * The URL is therefore built from `location` rather than written down.
 * `new URL('.', location.href)` is the directory the document is in: `/` at the
 * dev server, `/idle-city/` on Pages, and the same either way whether the
 * player arrived at `.../` or at `.../index.html`. A literal `/sw.js` would
 * point at the domain root on Pages and silently control nothing, which is
 * exactly the failure that only ever shows up on the deployed site.
 *
 * **What is deliberately not here: `skipWaiting`.** When a new version deploys,
 * the browser installs its worker and leaves it *waiting* — the tab that is
 * open keeps the worker, the cache and the code it started with, and the new
 * one takes over on the next load once no old tab remains.
 *
 * That is a decision about save integrity rather than about niceties. This game
 * holds its save under a versioned key and `migrate` brings a save *forward*
 * through eleven legacy keys; it has no path backward. So a build that ran once
 * and migrated a save to v13 must never be followed, in the same session, by an
 * older shell that reads that save as v12 — it would read the fields it knows,
 * default the ones it does not, and write the loss back. `skipWaiting` plus
 * `clients.claim` is precisely the mechanism that would swap the code under a
 * running tab, and it buys a faster update on a game nobody is waiting for an
 * update to. Not taking it is the cheapest correctness there is.
 *
 * The other half of that guard is in the worker: the entry document is fetched
 * network-first, so an online load always gets the newest shell rather than a
 * cached one. See tools/sw.mjs.
 */

/**
 * Registers the worker, if this browser has one and this is a real page.
 *
 * Every failure here is silent and non-fatal by design. A service worker is an
 * *enhancement*: the game already ran offline in every sense that mattered
 * except the fonts, and a registration that throws — an unsupported browser, a
 * private window, a `file://` URL, a scope the host will not allow — must leave
 * a working game rather than a blank canvas.
 */
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // No worker in dev. Vite serves modules unbundled and there is no `sw.js` to
  // register — and a stale precache in front of a hot-reloading dev server is
  // the worst debugging experience this project could offer.
  if (import.meta.env.DEV) return;
  const scope = new URL('.', location.href);
  window.addEventListener('load', () => {
    // After `load`, so registration never competes with the first frame for the
    // network or the main thread. The city is on screen before this runs.
    navigator.serviceWorker
      .register(new URL('sw.js', scope).href, { scope: scope.href })
      .catch(() => {
        // Nothing to say and nowhere useful to say it. The game is running.
      });
  });
}
