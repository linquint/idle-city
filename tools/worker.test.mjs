/**
 * What the worker is allowed to import, and what `npm test` is allowed to need.
 *
 *   node tools/worker.test.mjs
 *
 * Two acceptance criteria, and both of them are about *files* rather than about
 * behaviour, which is why they are here rather than in `test/` — the same
 * reason `tools/pwa.test.mjs` gives.
 *
 * **The worker must not be able to reach `save.ts`.** `save.ts` reaches for
 * `globalThis.localStorage`, which does not exist in a Worker, and the reach is
 * wrapped in a `try` that returns null — so a worker that called `save()` would
 * not throw. It would silently stop persisting, with no error anywhere and no
 * way to notice short of losing a city. A comment saying "do not import this"
 * is not a guard; walking the import graph is.
 *
 * **`npm test` must not need a worker.** vitest is configured
 * `environment: 'node'` and the suite is eight hundred cases because `src/sim`
 * needs nothing at all: no DOM, no renderer, no timers of its own. If a test
 * ever needed a worker shim, the boundary would be in the wrong place — so this
 * checks that nothing under `test/` reaches for one.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

let failures = 0;
let checks = 0;

function check(name, run) {
  try {
    const note = run();
    checks++;
    console.log(`  ok   ${name}${note ? ` — ${note}` : ''}`);
  } catch (error) {
    failures++;
    console.error(`  FAIL ${name}\n       ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * A file with its comments taken out.
 *
 * Needed because these checks are grep over source, and this codebase argues
 * with itself at length in prose — the worker's own header explains at some
 * length why it must never touch `localStorage`, and a check that could not
 * tell that from a call would fail on the explanation.
 */
function code(file) {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every relative import in a file, as a path. Enough for a graph this small. */
function importsOf(file) {
  const source = readFileSync(file, 'utf8');
  const found = [];
  for (const match of source.matchAll(/from\s+'(\.[^']+)'/g)) found.push(match[1]);
  for (const match of source.matchAll(/import\s*\(\s*'(\.[^']+)'\s*\)/g)) found.push(match[1]);
  // `new URL('./x.ts', import.meta.url)` is how Vite is told about a worker, and
  // it is an edge in the graph even though it is not an import statement.
  for (const match of source.matchAll(/new URL\(\s*'(\.[^']+)'/g)) found.push(match[1]);
  return found;
}

/** Everything reachable from `entry`, following relative imports only. */
function reachable(entry) {
  const seen = new Set();
  const queue = [resolve(entry)];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importsOf(file)) {
      const next = resolve(dirname(file), spec.endsWith('.ts') ? spec : `${spec}.ts`);
      try {
        statSync(next);
      } catch {
        continue;
      }
      queue.push(next);
    }
  }
  return new Set([...seen].map((file) => relative(process.cwd(), file).split('\\').join('/')));
}

const walk = (path, out = []) => {
  for (const entry of readdirSync(path)) {
    const at = join(path, entry);
    if (statSync(at).isDirectory()) walk(at, out);
    else if (at.endsWith('.ts')) out.push(at);
  }
  return out;
};

console.log('\nThe simulation across a thread boundary\n');

const worker = reachable('src/worker/sim.worker.ts');

check('the worker cannot reach the save', () => {
  // The one genuine coupling this whole change had to break. Persistence lives
  // entirely on the main thread; the worker is handed a state and hands states
  // back, and `markSaved` is how it is told what timestamp was used.
  assert(!worker.has('src/sim/save.ts'), 'src/sim/save.ts is reachable from the worker');
  return `${worker.size} modules, none of them the save`;
});

check('nor anything that would only work in a document', () => {
  // A worker has no `document`, no `window` and no `localStorage`. `src/sim`
  // has exactly one reference to any of them and it is in save.ts, which is
  // the module above; this is what stops a second one arriving unnoticed.
  for (const file of worker) {
    const source = code(file);
    for (const forbidden of ['document.', 'window.', 'localStorage', 'matchMedia']) {
      assert(
        !source.includes(forbidden),
        `${file} uses ${forbidden}, which does not exist in a Worker`,
      );
    }
  }
  return 'no document, window, localStorage or matchMedia';
});

check('the save still lives somewhere, and only the main thread reaches it', () => {
  const main = reachable('src/main.ts');
  assert(main.has('src/sim/save.ts'), 'nothing loads the save at all any more');
  // And the file is still where the eleven legacy keys are, rather than having
  // been split in half for the sake of the boundary.
  const save = code('src/sim/save.ts');
  assert(save.includes("SAVE_KEY = 'idle-city/save/"), 'SAVE_KEY has moved');
  assert(save.includes('LEGACY_SAVE_KEYS'), 'LEGACY_SAVE_KEYS has moved');
  assert(save.includes('export function migrate'), 'migrate has moved');
  return 'SAVE_KEY, LEGACY_SAVE_KEYS and migrate, all on the main thread';
});

check('the fallback runs the same commands as the worker', () => {
  // Not a parallel implementation. Both sides call `applyCommand`, so a command
  // the worker understands and the fallback does not is not expressible.
  for (const file of ['src/sim/local.ts', 'src/worker/sim.worker.ts']) {
    assert(
      code(file).includes('applyCommand'),
      `${file} does not go through applyCommand`,
    );
  }
  return 'one dispatcher, two transports';
});

check('the test suite needs no worker at all', () => {
  // The acceptance criterion for the whole change. If a case here needed a
  // worker shim, the boundary would be in the wrong place.
  for (const file of walk('test')) {
    const source = code(file);
    for (const forbidden of ['new Worker', 'worker_threads', 'sim.worker']) {
      assert(!source.includes(forbidden), `${file} reaches for ${forbidden}`);
    }
  }
  const config = code('vite.config.ts');
  assert(config.includes("environment: 'node'"), 'vitest is no longer configured for node');
  return `${walk('test').length} files, no shim anywhere`;
});

check('nothing in src/sim knows a worker exists', () => {
  // The simulation is the thing being moved, and it must not learn that it
  // moved. `commands.ts` names the message shapes because they are *its* types,
  // and nothing in the directory constructs, posts to or listens on one.
  for (const file of walk('src/sim')) {
    const source = code(file);
    for (const forbidden of ['new Worker', 'postMessage', 'self.addEventListener']) {
      assert(!source.includes(forbidden), `${file} reaches for ${forbidden}`);
    }
  }
  return 'the simulation does not know';
});

console.log(`\n${checks} passed, ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
