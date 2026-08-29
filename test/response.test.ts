import { describe, expect, it } from 'vitest';
import {
  ANSWER_MAX,
  ANSWER_MIN,
  BASE_CALL_PER_BUILDING_HOUR,
  BURN_OUT_SECONDS,
  CRIME_MOOD,
  EXTINGUISH_MAX,
  EXTINGUISH_MIN,
  FIRE_RESPONSE,
  LEVELS,
  MAX_ACTIVE_CALLS,
  MAX_DISTRICTS,
  POLICE_RESPONSE,
  RESPONSES,
  SERVICES,
  UNANSWERED_CRIME,
  UNANSWERED_SECONDS,
} from '../src/sim/config';
import {
  callRate,
  coverage,
  crime,
  crimePressure,
  extinguishSeconds,
  happinessTarget,
  missesDeadline,
  parkCapacity,
  resolvesAt,
  responseResolvesAt,
  responseSeconds,
  responseThreshold,
  serviceAllowed,
  unansweredCalls,
  unansweredCrime,
  wouldBurnOut,
} from '../src/sim/economy';
import { Game } from '../src/sim/game';
import { BUILDABLE_RESIDENTIAL_PER_DISTRICT } from '../src/sim/layout';
import { migrate } from '../src/sim/save';
import { createState, type GameState } from '../src/sim/state';
import { built, housedOn, served } from './levels';

const state = (patch: Partial<GameState> = {}): GameState => ({ ...createState(0), ...patch });

/**
 * The police coverage a city reads, set exactly rather than by a station count.
 *
 * A whole number of stations and a *fractional* payroll, rather than the other
 * way round: `staffing` is a share and belongs in [0, 1], and a state that put
 * 11 in it would read as eleven times covered until the staffing ramp pulled it
 * back to 1 and the coverage collapsed under the test's feet. That is worth
 * saying here because it is exactly the bug this helper had.
 *
 * Static only. A running `Game` ramps the payroll toward 1, so a test that
 * advances the clock has to use a coverage the ramp cannot move — nothing, or
 * the whole allowance.
 */
const policed = (s: GameState, coverageWanted: number): GameState => {
  const police = SERVICES.find((service) => service.key === 'police')!;
  const plots = BUILDABLE_RESIDENTIAL_PER_DISTRICT * s.districts;
  const reach = (coverageWanted * plots) / police.plots;
  const stations = Math.ceil(reach);
  return {
    ...s,
    police: stations,
    policeStaff: stations > 0 ? reach / stations : 0,
  };
};

describe('the shared response model', () => {
  /**
   * The whole reason it was extracted rather than copied. Every row states the
   * same three numbers and the model reads them the same way, so a second
   * emergency is a row rather than a second copy of `resolveFires`.
   */
  it('puts the deadline strictly between the two response times', () => {
    for (const row of RESPONSES) {
      expect(row.fast).toBeLessThan(row.deadline);
      expect(row.deadline).toBeLessThan(row.slow);
      // Outside that band the service is buying a number nobody can see:
      // nothing is ever answered in time, or everything is.
      expect(responseThreshold(row)).toBeGreaterThan(0);
      expect(responseThreshold(row)).toBeLessThan(1);
    }
  });

  it('interpolates the response between the two ends', () => {
    for (const row of RESPONSES) {
      const service = SERVICES.find((entry) => entry.key === row.service)!;
      const bare = state({ ...housedOn(24, 0) });
      expect(responseSeconds(bare, row)).toBeCloseTo(row.slow, 6);
      const full = state({ ...housedOn(24, 0), ...served() });
      expect(coverage(full, service)).toBe(1);
      expect(responseSeconds(full, row)).toBeCloseTo(row.fast, 6);
    }
  });

  it('resolves at the deadline when it is missed and at the response when it is not', () => {
    for (const row of RESPONSES) {
      const slow = state({ ...housedOn(240, 0) });
      expect(missesDeadline(slow, row)).toBe(true);
      expect(responseResolvesAt(slow, row)).toBe(row.deadline);
      const fast = state({ ...housedOn(240, 0), ...served() });
      expect(missesDeadline(fast, row)).toBe(false);
      expect(responseResolvesAt(fast, row)).toBeCloseTo(row.fast, 6);
    }
  });
});

describe("fire's numbers, which must not move", () => {
  it('keeps the three constants exactly where they were', () => {
    expect(EXTINGUISH_MAX).toBe(90);
    expect(EXTINGUISH_MIN).toBe(20);
    expect(BURN_OUT_SECONDS).toBe(75);
    expect(FIRE_RESPONSE.slow).toBe(EXTINGUISH_MAX);
    expect(FIRE_RESPONSE.fast).toBe(EXTINGUISH_MIN);
    expect(FIRE_RESPONSE.deadline).toBe(BURN_OUT_SECONDS);
  });

  /**
   * 21.4% is quoted in three comments and a test. It is now *derived* from the
   * three constants rather than typed anywhere, which is the point of pulling
   * the model out — but it has to come out at the same number.
   */
  it('still turns at 21.4% coverage, and now derives it', () => {
    expect(responseThreshold(FIRE_RESPONSE)).toBeCloseTo(15 / 70, 10);
    expect(responseThreshold(FIRE_RESPONSE)).toBeCloseTo(0.214, 3);
  });

  it('answers `extinguishSeconds`, `wouldBurnOut` and `resolvesAt` unchanged', () => {
    for (const homes of [0, 24, 240, 2400]) {
      for (const serve of [true, false]) {
        const s = state({ ...housedOn(homes, 0), ...(serve ? served() : {}) });
        const c = coverage(s, SERVICES.find((x) => x.key === 'fire')!);
        expect(extinguishSeconds(s)).toBeCloseTo(
          EXTINGUISH_MAX + (EXTINGUISH_MIN - EXTINGUISH_MAX) * c,
          9,
        );
        expect(wouldBurnOut(s)).toBe(extinguishSeconds(s) > BURN_OUT_SECONDS);
        expect(resolvesAt(s)).toBe(Math.min(extinguishSeconds(s), BURN_OUT_SECONDS));
      }
    }
  });
});

describe('the police response', () => {
  it('turns at a coverage fire does not', () => {
    expect(responseThreshold(POLICE_RESPONSE)).toBeCloseTo(0.4, 10);
    expect(POLICE_RESPONSE.slow).toBe(ANSWER_MAX);
    expect(POLICE_RESPONSE.fast).toBe(ANSWER_MIN);
    expect(POLICE_RESPONSE.deadline).toBe(UNANSWERED_SECONDS);
    // Two thresholds a player learns separately are two mechanics.
    expect(responseThreshold(POLICE_RESPONSE)).not.toBeCloseTo(
      responseThreshold(FIRE_RESPONSE),
      2,
    );
  });

  /**
   * The difference between the two services, stated as a test: a fire station
   * stops fires starting, and a police station does not stop crime happening.
   */
  it('is not suppressed by the police, only answered by them', () => {
    const base = state({ ...built(240, 100, 40, 1), districts: 12, occupancyR: 1 });
    const bare = policed(base, 0);
    const full = policed(base, 1);
    expect(callRate(bare)).toBeGreaterThan(0);
    expect(callRate(full)).toBeCloseTo(callRate(bare), 12);
    // And it is the pressure the city made for itself that drives it.
    expect(callRate(bare)).toBeCloseTo(
      (BASE_CALL_PER_BUILDING_HOUR * (base.homes + base.shops + base.industry) *
        crimePressure(bare)) /
        3600,
      9,
    );
  });

  it('counts unanswered calls against the cap, and only past the threshold', () => {
    const base = state({ ...built(240, 100, 40, 1), districts: 12, occupancyR: 1 });
    const calls = Array.from({ length: MAX_ACTIVE_CALLS }, () => ({
      kind: 'home' as const,
      index: 0,
      startedAt: 0,
    }));
    const slow = { ...policed(base, 0.3), calls };
    expect(missesDeadline(slow, POLICE_RESPONSE)).toBe(true);
    expect(unansweredCalls(slow)).toBe(1);
    expect(unansweredCrime(slow)).toBeCloseTo(UNANSWERED_CRIME, 10);

    const quick = { ...policed(base, 0.5), calls };
    expect(missesDeadline(quick, POLICE_RESPONSE)).toBe(false);
    expect(unansweredCalls(quick)).toBe(0);
    expect(unansweredCrime(quick)).toBe(0);
  });

  it('lands on crime rather than on a seventh modifier', () => {
    // Served everywhere except the police, so the target is nowhere near its
    // clamp and the difference the calls make is the difference they make.
    const base = policed(
      state({
        ...built(240, 100, 40, 1),
        ...served(),
        districts: 12,
        occupancyR: 1,
        depots: 40,
        depotStaff: 1,
      }),
      0.2,
    );
    const calls = Array.from({ length: 4 }, () => ({
      kind: 'home' as const,
      index: 0,
      startedAt: 0,
    }));
    const bare = base;
    const busy = { ...bare, calls };
    expect(crime(busy)).toBeGreaterThan(crime(bare));
    expect(crime(busy)).toBeCloseTo(
      Math.min(1, crime(bare) + unansweredCrime(busy)),
      10,
    );
    // And the whole of what it costs arrives through CRIME_MOOD, which is
    // already in the bracket. Nothing new was added to it.
    expect(happinessTarget(busy)).toBeLessThan(happinessTarget(bare));
    expect(happinessTarget(bare) - happinessTarget(busy)).toBeCloseTo(
      CRIME_MOOD * (crime(busy) - crime(bare)),
      6,
    );
  });

  /**
   * The guard, and it holds by construction: a fully covered city answers every
   * call inside ANSWER_MIN, so `crime` reads exactly what it read before calls
   * existed and the ceiling `test/services.test.ts` asserts cannot move.
   */
  it('cannot lower the happiness ceiling at any city size', () => {
    for (let districts = 1; districts <= MAX_DISTRICTS; districts++) {
      const s = state({
        ...housedOn(BUILDABLE_RESIDENTIAL_PER_DISTRICT * districts, LEVELS - 1),
        districts,
      });
      s.parks = parkCapacity(s);
      for (const service of SERVICES) {
        const n = serviceAllowed(s, service);
        if (service.key === 'hospital') { s.hospitals = n; s.hospitalStaff = 1; }
        if (service.key === 'police') { s.police = n; s.policeStaff = 1; }
        if (service.key === 'fire') { s.fire = n; s.fireStaff = 1; }
        if (service.key === 'school') { s.schools = n; s.schoolStaff = 1; }
        if (service.key === 'transit') { s.depots = n; s.depotStaff = 1; }
        if (service.key === 'university') { s.universities = n; s.universityStaff = 1; }
      }
      const swamped = {
        ...s,
        calls: Array.from({ length: MAX_ACTIVE_CALLS }, () => ({
          kind: 'home' as const,
          index: 0,
          startedAt: 0,
        })),
      };
      expect(crime(swamped)).toBe(crime(s));
      expect(happinessTarget(swamped)).toBe(happinessTarget(s));
      expect(happinessTarget(swamped)).toBeGreaterThanOrEqual(0.95);
    }
  });
});

describe('calls under the clock', () => {
  const city = (patch: Partial<GameState> = {}): GameState =>
    state({
      ...built(240, 100, 40, 1),
      districts: 12,
      occupancyR: 1,
      occupancyC: 1,
      occupancyI: 1,
      happiness: 1,
      cash: 0,
      ...patch,
    });

  it('comes in, and is capped at MAX_ACTIVE_CALLS', () => {
    const game = new Game(policed(city(), 0));
    for (let i = 0; i < 60_000; i++) game.advance(0.1);
    expect(game.state.callCursor).toBeGreaterThan(0);
    expect(game.state.calls.length).toBeLessThanOrEqual(MAX_ACTIVE_CALLS);
  });

  it('is answered by a city that covers itself and missed by one that does not', () => {
    const run = (cover: number): { missed: number } => {
      const game = new Game(
        cover >= 1 ? { ...city(), ...served() } : policed(city(), cover),
      );
      let missed = 0;
      for (let i = 0; i < 40_000; i++) {
        game.advance(0.1);
        for (const event of game.drainEvents()) {
          if (event.kind === 'call-missed') missed += event.count;
        }
      }
      return { missed };
    };
    expect(run(0).missed).toBeGreaterThan(0);
    // Every station the land allows, at a full payroll, which is the one
    // covered state the staffing ramp cannot move under the run.
    expect(run(1).missed).toBe(0);
  });

  /**
   * The invariant every random draw in this simulation carries. A Bernoulli
   * trial per tick is not step-size invariant — 600 trials at a tenth of a
   * second and one at sixty are different distributions — so the process
   * accumulates `rate x dt` into a hazard and spends it against exponential
   * waiting times, exactly as `fireHazard` does.
   */
  it('gives catch-up and real time the same call history, within 1%', () => {
    // Built the way `test/fire.test.ts` builds its own invariance city, and for
    // the same reason: two step sizes are only comparable while the *rate* is
    // near-constant, and the rate reads `crimePressure`, which reads residents.
    // So nothing may promote, nothing may burn down and nothing may brown out —
    // every home already at the top level, fire covered outright so no building
    // is ever lost, and the grid lit.
    //
    // No police at all, which is the condition this test is about and the only
    // one a running clock holds still: calls come in, every one of them goes
    // unanswered, and the two runs have to agree about how many. A partial
    // coverage would have drifted upward under both runs as the payroll ramped
    // — see `policed`.
    const patch = (): GameState =>
      policed(
        state({
          ...built(55, 427, 140, LEVELS - 1),
          districts: 49,
          occupancyR: 0.7,
          occupancyC: 0.7,
          occupancyI: 0.7,
          ...served(),
          police: 0,
          policeStaff: 0,
          depots: 40,
          depotStaff: 1,
          cash: 0,
        }),
        0,
      );
    const away = new Game(patch());
    const watched = new Game(patch());
    away.catchUp(3600);
    for (let i = 0; i < 3600; i++) watched.catchUp(1);

    // Every call attempt costs exactly three draws — the waiting time, the kind
    // and the slot — so the cursor is the call history in one number.
    const raised = (g: Game): number => g.state.callCursor / 3;
    expect(raised(watched)).toBeGreaterThan(10);
    const gap = Math.abs(raised(away) - raised(watched));
    expect(gap).toBeLessThanOrEqual(Math.max(1, raised(watched) * 0.01));
    // And the pressure still unspent agrees to inside two calls. Looser than
    // fire's half, and the reason is the rate: fire reads a coverage that is
    // pinned by construction here, where `crimePressure` reads `unemployment`
    // and `crimeCrowding`, both of which read residents — so the call rate is
    // *near* constant across the hour where fire's is nearer. Two calls of
    // accumulated difference over the ~190 the hour raises is the honest
    // statement of that, and it is a statement about occupancy settling rather
    // than about the hazard.
    expect(Math.abs(away.state.callHazard - watched.state.callHazard)).toBeLessThan(2);
  });

  it('keeps the two emergencies on separate streams', () => {
    // A city whose fire process is further along its own sequence must not find
    // its calls drawn from a different place in theirs. On one shared cursor it
    // would, and the two mechanics would be silently coupled through the hash.
    const seed = (fireCursor: number): GameState =>
      policed({ ...city(), fireCursor, fire: 40, fireStaff: 1 }, 0);
    const a = new Game(seed(0));
    const b = new Game(seed(5_000));
    for (let i = 0; i < 6_000; i++) {
      a.advance(0.1);
      b.advance(0.1);
    }
    expect(b.state.callCursor).toBe(a.state.callCursor);
    expect(b.state.fireCursor).not.toBe(a.state.fireCursor);
  });

  it('forgets a call about a building the city no longer owns', () => {
    const game = new Game(policed({ ...city(), homes: 1 }, 0));
    for (let i = 0; i < 20_000; i++) game.advance(0.1);
    for (const call of game.state.calls) {
      const of =
        call.kind === 'home' ? game.state.homes
        : call.kind === 'shop' ? game.state.shops
        : game.state.industry;
      expect(call.index).toBeLessThan(of);
    }
  });

  it('destroys nothing, whatever it misses', () => {
    // Fire covered outright, so the only thing that could take a building off
    // the books is the thing being tested. It never does: a missed call costs
    // the crime it carried and nothing else — see `abandonedR` for why.
    const game = new Game(policed({ ...city(), fire: 40, fireStaff: 1 }, 0));
    const before = { ...game.state };
    for (let i = 0; i < 40_000; i++) game.advance(0.1);
    expect(game.state.homes).toBe(before.homes);
    expect(game.state.shops).toBe(before.shops);
    expect(game.state.industry).toBe(before.industry);
  });
});

describe('calls across a save', () => {
  it('opens a save that predates them with none', () => {
    const raw = JSON.parse(JSON.stringify(state({ ...built(24, 10, 4, 0), districts: 2 })));
    raw.version = 14;
    delete raw.calls;
    delete raw.callCursor;
    delete raw.callHazard;
    const back = migrate(raw, 0)!;
    expect(back.calls).toEqual([]);
    expect(back.callCursor).toBe(0);
    expect(back.callHazard).toBe(0);
  });

  it('drops a call about a building the save does not own', () => {
    const s = state({ ...built(4, 2, 1, 0), districts: 1 });
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw['calls'] = [
      { kind: 'home', index: 0, startedAt: 0 },
      { kind: 'home', index: 900, startedAt: 0 },
      { kind: 'nonsense', index: 0, startedAt: 0 },
      null,
    ];
    const back = migrate(raw, 0)!;
    expect(back.calls).toHaveLength(1);
    expect(back.calls[0]!.index).toBe(0);
  });

  it('cuts a list claiming more than the cap', () => {
    const s = state({ ...built(24, 10, 4, 0), districts: 2 });
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw['calls'] = Array.from({ length: 400 }, () => ({ kind: 'home', index: 0, startedAt: 0 }));
    expect(migrate(raw, 0)!.calls).toHaveLength(MAX_ACTIVE_CALLS);
  });

  /**
   * Two calls to one building are legal where two fires are not: a house
   * cannot burn down twice, and a street where something happens twice is a
   * street with a problem.
   */
  it('allows two calls about one building', () => {
    const s = state({ ...built(24, 10, 4, 0), districts: 2 });
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw['calls'] = [
      { kind: 'home', index: 3, startedAt: 0 },
      { kind: 'home', index: 3, startedAt: 0 },
    ];
    expect(migrate(raw, 0)!.calls).toHaveLength(2);
  });
});
