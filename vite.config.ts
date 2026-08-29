import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        // three is by far the biggest dependency; splitting it out means the
        // game code can be re-downloaded without re-downloading the renderer.
        manualChunks: { three: ['three'] },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Most of these tests are whole-city simulations run over thousands of
    // ticks, and vitest's 5s default was never a claim about how long one of
    // them ought to take — it is just the default. Two are close enough to it
    // to fail on a loaded runner and pass on an idle one: the power suite's
    // wage-bill spiral costs 2.6s and the parks land check 4.1s, against a
    // budget shared with 36 other files running in parallel. The ceiling is
    // raised rather than the tests thinned, because what they assert is worth
    // more than the seconds, and a timeout that fires on machine load is not
    // telling anyone anything about the simulation.
    testTimeout: 20_000,
  },
});
