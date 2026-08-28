/**
 * Measures the pedestrian fleet, so MAX_PEDESTRIANS and
 * WALKERS_PER_1000_TRIPS can be set from numbers rather than from a feel. Same
 * contract as the other calibrators: it prints, it does not assert, and what it
 * prints belongs in the comments in `src/render/pedestrians.ts`.
 *
 * Four questions:
 *
 *   - what one walker costs per frame. The ceiling is a budget, and a budget
 *     needs a price. The four rows are the two design choices — the gait bob
 *     and the body rotation — priced separately, because between them they are
 *     two thirds of the loop;
 *   - what the fleet size is across the city the game can actually reach. A
 *     ceiling nothing ever hits is a ceiling that was never measured, and one
 *     that is hit at ten districts is a city that stops growing on screen;
 *   - how many of the fleet are ever drawn. The view radius culls against the
 *     camera focus, so a seven-ring city writes a fraction of the pool and the
 *     honest cost is that fraction rather than the ceiling;
 *   - what the pavements look like with no transit. The fleet reads the trips
 *     the road does not carry, so a car-dependent city has empty pavements by
 *     construction. That is the intended reading and it is printed rather than
 *     hidden.
 *
 * Run it with the transform flag, not the plain interpreter: `src/render` uses
 * TypeScript's parameter-property shorthand, which Node's strip-only mode
 * refuses. The modules this reaches carry `.ts` extensions on their imports for
 * the reason `tsconfig.json` gives — a tool has to resolve them without a build.
 *
 *   node --experimental-transform-types tools/pedestrians.calibrate.mjs
 */
import * as THREE from 'three';
import {
  FRONTAGE_TARGET,
  LEVELS,
  LEVEL_FOOTPRINT,
  OCCUPANCY_FULL,
  SERVICES,
  TRIPS_PER_RESIDENT,
} from '../src/sim/config.ts';
import {
  residents,
  roadTrips,
  serviceAllowed,
  transitShare,
  trips,
} from '../src/sim/economy.ts';
import { CityLayout } from '../src/sim/layout.ts';
import { createState } from '../src/sim/state.ts';
import {
  MAX_PEDESTRIANS,
  MIN_PEDESTRIANS,
  Pedestrians,
  WALKERS_PER_1000_TRIPS,
  pedestrianFleet,
  walkingTrips,
} from '../src/render/pedestrians.ts';

const SIZES = [1, 10, 49];

/**
 * MAX_CARS, restated rather than imported.
 *
 * `src/render/cars.ts` reaches `glow.ts` and `highway.ts`, neither of which
 * carries `.ts` extensions on its imports, so plain Node cannot resolve the
 * module and the one number wanted from it is not worth converting three files
 * for. It is here only as the row the pedestrian ceiling is compared against.
 */
const MAX_CARS_CEILING = 160;

/** One frame at 60 Hz, in milliseconds. What the ceiling is a share of. */
const FRAME_60HZ = 1000 / 60;

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 2) => pad(Number(v).toFixed(d), w);

/**
 * A city of `districts` districts built out to its own frontage at `level`.
 *
 * The same fixture tools/traffic.calibrate.mjs uses, and for the same reason: a
 * state assembled by hand has no surveyor, and what is being measured is the
 * pavement against a finished district rather than whatever split a particular
 * city happened to survey. Fully served and fully staffed, or the city would be
 * reading its own unhappiness through occupancy and into the trip count.
 *
 * `transit` is the one service left as a dial, because it is the variable this
 * file is about: the fleet reads the trips the road does not carry.
 */
function city(districts, level, transit) {
  const s = createState(0);
  s.districts = districts;
  const foot = LEVEL_FOOTPRINT[level] ?? 1;
  const fit = (per) => Math.floor((districts * per) / foot);
  const cohort = (n) => {
    const levels = new Array(LEVELS).fill(0);
    levels[level] = n;
    return levels;
  };
  const homes = fit(FRONTAGE_TARGET.residential);
  const shops = fit(FRONTAGE_TARGET.commercial);
  const works = fit(FRONTAGE_TARGET.industrial);
  Object.assign(s, {
    homes,
    shops,
    industry: works,
    homeLevels: cohort(homes),
    shopLevels: cohort(shops),
    industryLevels: cohort(works),
    mergedR: foot > 1 ? homes : 0,
    mergedC: foot > 1 ? shops : 0,
    mergedI: foot > 1 ? works : 0,
    occupancyR: OCCUPANCY_FULL,
    occupancyC: OCCUPANCY_FULL,
    occupancyI: OCCUPANCY_FULL,
    happiness: 1,
    parks: districts * 4,
    plants: districts,
    plantStaff: 1,
    cityHall: true,
  });
  for (const service of SERVICES) {
    const allowed = serviceAllowed(s, service);
    if (service.key === 'hospital') s.hospitals = allowed;
    else if (service.key === 'police') s.police = allowed;
    else if (service.key === 'fire') s.fire = allowed;
    else if (service.key === 'school') s.schools = allowed;
    else if (service.key === 'transit') s.depots = allowed;
    else s.universities = allowed;
  }
  s.hospitalStaff = 1;
  s.policeStaff = 1;
  s.fireStaff = 1;
  s.schoolStaff = 1;
  s.universityStaff = 1;
  if (transit === 'none') {
    s.depots = 0;
    s.depotStaff = 0;
  } else {
    s.depotStaff = 1;
    s.freeTransport = transit === 'free';
  }
  return s;
}

// ------------------------------------------------------------------- part 1

/**
 * The per-frame loop, in the two shapes the renderer could have had.
 *
 * A stand-in for `Pedestrians.update` rather than the method itself, because
 * what is being priced is the *body* of the loop and the method only has one
 * version of it. Every line here is copied from that method: advance, the
 * distance test, the position write, the matrix compose, the instance write.
 */
function loopCost(n, bob, rot) {
  const dummy = new THREE.Object3D();
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.34, 0.72, 0.34),
    new THREE.MeshLambertMaterial(),
    n,
  );
  const pool = [];
  for (let i = 0; i < n; i++) {
    pool.push({
      from: (i % 37) * 1.4 - 25,
      fixed: (i % 41) * 1.3 - 26,
      dir: i % 2 ? 1 : -1,
      alongX: i % 3 === 0,
      heading: ((i % 4) * Math.PI) / 2,
      speed: 1.05 + (i % 7) * 0.07,
      travelled: (i % 19) * 0.9,
      length: 60,
      phase: (i % 13) * 0.5,
    });
  }
  const step = () => {
    let drawn = 0;
    for (let i = 0; i < pool.length; i++) {
      const w = pool[i];
      w.travelled += w.speed * (1 / 60);
      if (w.travelled >= w.length) w.travelled = 0;
      const along = w.from + w.dir * w.travelled;
      const x = w.alongX ? along : w.fixed;
      const z = w.alongX ? w.fixed : along;
      // Nothing is culled: the ceiling has to be priced at the worst case, and
      // the worst case is a focus with the whole fleet standing round it.
      const b = bob ? Math.sin(w.phase + w.travelled * 5.5) * 0.028 : 0;
      dummy.position.set(x, 0.66 + b, z);
      if (rot) dummy.rotation.set(0, w.heading, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(drawn++, dummy.matrix);
    }
    mesh.count = drawn;
    mesh.instanceMatrix.needsUpdate = true;
  };
  for (let f = 0; f < 600; f++) step();
  const FRAMES = 4_000;
  let best = Infinity;
  // Best of three. A garbage-collection pause lands on one run and not on the
  // other two, and what is wanted is the loop rather than the machine's mood.
  for (let r = 0; r < 3; r++) {
    const t0 = process.hrtime.bigint();
    for (let f = 0; f < FRAMES; f++) step();
    const t1 = process.hrtime.bigint();
    best = Math.min(best, Number(t1 - t0) / 1e6 / FRAMES);
  }
  return best;
}

console.log('what one walker costs a frame\n');
console.log('  instances      plain     + bob     + rot   + both       chosen us/instance');
for (const n of [MAX_CARS_CEILING, 320, MAX_PEDESTRIANS, 960, 1440, 2000]) {
  const plain = loopCost(n, false, false);
  const bob = loopCost(n, true, false);
  const rot = loopCost(n, false, true);
  const both = loopCost(n, true, true);
  console.log(
    `  ${pad(n, 9)}${fixed(plain, 11, 4)}${fixed(bob, 10, 4)}${fixed(rot, 10, 4)}${fixed(both, 9, 4)}` +
      `${fixed((bob * 1000) / n, 25, 4)}`,
  );
}
console.log('');
console.log('  Chosen: a gait bob, and no per-instance rotation — the body is square in');
console.log('  plan, so there is no facing to show and the Euler conversion comes off the');
console.log('  loop. Read the "+ both" column against "+ bob" for what that is worth.');
console.log('');
{
  const chosen = loopCost(MAX_PEDESTRIANS, true, false);
  const cars = loopCost(MAX_CARS_CEILING, true, true);
  console.log(
    `  MAX_PEDESTRIANS ${MAX_PEDESTRIANS}  ${chosen.toFixed(4)} ms/frame` +
      `  (${((chosen / FRAME_60HZ) * 100).toFixed(2)}% of a 60 Hz frame)`,
  );
  console.log(
    `  MAX_CARS        ${MAX_CARS_CEILING}  ${cars.toFixed(4)} ms/frame, the same loop with the rotation in` +
      `  (${((cars / FRAME_60HZ) * 100).toFixed(2)}%)`,
  );
}
console.log('');

// ------------------------------------------------------------------- part 2

console.log('the fleet, by city size and housing level\n');
for (const transit of ['none', 'covered', 'free']) {
  const label =
    transit === 'none' ? 'no depots'
    : transit === 'covered' ? 'depots, fares charged'
    : 'depots, free transport';
  console.log(`  ${label}`);
  console.log(
    '    districts' +
      Array.from({ length: LEVELS }, (_, l) => pad(`L${l}`, 8)).join('') +
      pad('carried', 10),
  );
  for (const districts of SIZES) {
    const row = [];
    for (let level = 0; level < LEVELS; level++) {
      row.push(pedestrianFleet(city(districts, level, transit)));
    }
    const probe = city(districts, 2, transit);
    console.log(
      `    ${pad(districts, 9)}` +
        row.map((v) => pad(v, 8)).join('') +
        fixed(transitShare(probe), 10, 3),
    );
  }
  console.log('');
}
console.log(`  MIN_PEDESTRIANS ${MIN_PEDESTRIANS}, MAX_PEDESTRIANS ${MAX_PEDESTRIANS},` +
  ` ${WALKERS_PER_1000_TRIPS} per 1000 walking trips`);
console.log(`  TRIPS_PER_RESIDENT ${TRIPS_PER_RESIDENT}; saturates at` +
  ` ${((MAX_PEDESTRIANS * 1000) / WALKERS_PER_1000_TRIPS).toLocaleString('en-GB')} walking trips a second`);
console.log('');
console.log('  where the trips go, at 49 districts, level 2\n');
console.log('    transit          residents      trips   on road   walking   walkers');
for (const transit of ['none', 'covered', 'free']) {
  const s = city(49, 2, transit);
  console.log(
    `    ${transit.padEnd(14)}${fixed(residents(s), 12, 0)}${fixed(trips(s), 11, 0)}` +
      `${fixed(roadTrips(s), 10, 0)}${fixed(walkingTrips(s), 10, 0)}${pad(pedestrianFleet(s), 10)}`,
  );
}
console.log('');

// ------------------------------------------------------------------- part 3

console.log('how many of the fleet the view radius ever writes\n');
console.log('  districts   fleet   drawn   share   ms/frame at that draw count');
for (const districts of SIZES) {
  const s = city(districts, 2, 'free');
  const scene = new THREE.Scene();
  const walkers = new Pedestrians(scene, new CityLayout(), true);
  walkers.sync(s);
  const focus = new THREE.Vector3(0, 0, 0);
  // Long enough that every walker has been routed at least once and the
  // sampler's bias toward the focus has settled.
  for (let f = 0; f < 900; f++) walkers.update(1 / 60, focus);
  let drawn = 0;
  const SAMPLES = 300;
  for (let f = 0; f < SAMPLES; f++) {
    walkers.update(1 / 60, focus);
    drawn += walkers.instances;
  }
  const mean = drawn / SAMPLES;
  const fleet = pedestrianFleet(s);
  console.log(
    `  ${pad(districts, 9)}${pad(fleet, 8)}${fixed(mean, 8, 1)}${fixed(mean / Math.max(1, fleet), 8, 2)}` +
      `${fixed(loopCost(Math.max(1, Math.round(mean)), true, false), 15, 4)}`,
  );
}
console.log('');
console.log('  A district is 60 world units across and the radius is 120, so a seven-ring');
console.log('  city can only ever show a handful of its districts at once. The sampler');
console.log('  biases new walks toward the focus, which is what keeps the drawn share up.');
