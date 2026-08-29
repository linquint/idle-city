/**
 * Measures what the city actually submits, so the street camera's culling can
 * be designed against numbers rather than against an assumption. Same contract
 * as the other calibrators: it prints, it does not assert.
 *
 * The question it exists to answer is the one the brief put plainly — *is the
 * street camera the case that pays for the culling?* — and it answers it in
 * six parts:
 *
 *   - what the scene is made of. Meshes, instances and triangles at the largest
 *     city the game can reach. A draw call for an `InstancedMesh` is the mesh,
 *     not the instance, so counting the meshes is counting the draw calls;
 *   - what a per-object frustum test could ever remove. Every building mesh is
 *     packed per (zone, level) and holds instances from every district, so the
 *     test is asked against the real frustum of the real camera at both the
 *     orbit and the street positions;
 *   - what a per-district test could remove instead, which is a different
 *     question with a very different answer: a district is 60 world units
 *     across and a street camera sees a handful of them;
 *   - what the dressing is worth, since that is what the detail mask drops;
 *   - what the mask actually removes at each camera distance, and what a repack
 *     costs — distance-based LOD pays for one every time the focus moves far
 *     enough to change its mind;
 *   - what the haze does from both cameras, because it was calibrated for the
 *     orbit view and the street camera is a new case for it.
 *
 * No GPU here. Node has no WebGL context, so *frame time* in the rendering
 * sense cannot be measured in this harness and is not claimed: what is measured
 * is the submitted work — draw calls, instances, triangles — and the CPU cost
 * of the writes that produce it. Those are the quantities culling moves.
 *
 *   node --experimental-transform-types tools/lod.calibrate.mjs
 */
import * as THREE from 'three';
import {
  FRONTAGE_TARGET,
  LEVELS,
  LEVEL_FOOTPRINT,
  MAX_DISTRICTS,
  OCCUPANCY_FULL,
  SERVICES,
} from '../src/sim/config.ts';
import { serviceAllowed } from '../src/sim/economy.ts';
import {
  CityLayout,
  DISTRICT_WIDTH,
  cityCentre,
  cityRadius,
  districtCoord,
} from '../src/sim/layout.ts';
import { createState } from '../src/sim/state.ts';
import { BUILDING_MESH_BUDGET, Buildings } from '../src/render/buildings.ts';
import { Ground } from '../src/render/ground.ts';
import { Cars } from '../src/render/cars.ts';
import { Pedestrians } from '../src/render/pedestrians.ts';
import { Courtyards, Parks, Zones } from '../src/render/zones.ts';

const pad = (v, w) => String(v).padStart(w);
const fixed = (v, w, d = 2) => pad(Number(v).toFixed(d), w);
const thou = (v, w) => pad(Math.round(v).toLocaleString('en-GB'), w);

/** A city built out to its own frontage at `level`, fully served and staffed. */
function city(districts, level) {
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
    museums: districts,
    stadiums: districts,
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
  s.depotStaff = 1;
  return s;
}

/** Every `InstancedMesh` under a scene, with what it would submit this frame. */
function submitted(root) {
  const rows = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.InstancedMesh)) return;
    const index = object.geometry.getIndex();
    const tris = index ? index.count / 3 : object.geometry.getAttribute('position').count / 3;
    rows.push({
      name: object.name || '(unnamed)',
      mesh: object,
      count: object.count,
      tris: tris * object.count,
      shadow: object.castShadow,
    });
  });
  return rows;
}

const totals = (rows) => ({
  meshes: rows.length,
  drawn: rows.filter((r) => r.count > 0).length,
  instances: rows.reduce((n, r) => n + r.count, 0),
  tris: rows.reduce((n, r) => n + r.tris, 0),
  shadowDrawn: rows.filter((r) => r.count > 0 && r.shadow).length,
});

/** The whole city, standing in one scene, exactly as `View` assembles it. */
function stand(districts, level) {
  const state = city(districts, level);
  const root = new THREE.Scene();
  const layout = new CityLayout();
  const ground = new Ground(root, layout);
  const buildings = new Buildings(root, layout);
  const zones = new Zones(root, layout);
  const courtyards = new Courtyards(root, layout);
  const parks = new Parks(root, layout);
  const cars = new Cars(root, layout, true);
  const walkers = new Pedestrians(root, layout, true);
  ground.sync(state.districts, 0, false);
  buildings.sync(state, 0);
  zones.sync(state);
  courtyards.sync(state);
  parks.sync(state);
  cars.sync(state);
  walkers.sync(state);
  const focus = new THREE.Vector3(cityCentre(state.districts).x, 0, cityCentre(state.districts).z);
  for (let f = 0; f < 200; f++) {
    cars.update(1 / 60, focus, 0);
    walkers.update(1 / 60, focus);
  }
  return { state, root, layout, buildings, focus };
}

// ------------------------------------------------------------------- part 1

console.log('what the largest city submits\n');
const big = stand(MAX_DISTRICTS, LEVELS - 1);
{
  const rows = submitted(big.root);
  const t = totals(rows);
  console.log(`  districts ${MAX_DISTRICTS}, housing at level ${LEVELS - 1}`);
  console.log(`  instanced meshes in the scene      ${pad(t.meshes, 8)}`);
  console.log(`  of those, drawing anything         ${pad(t.drawn, 8)}   <- draw calls`);
  console.log(`  of those, also in the shadow pass  ${pad(t.shadowDrawn, 8)}`);
  console.log(`  instances submitted                ${thou(t.instances, 8)}`);
  console.log(`  triangles submitted                ${thou(t.tris, 8)}`);
  console.log('');
  console.log(`  BUILDING_MESH_BUDGET is ${BUILDING_MESH_BUDGET}: the three zone ladders, the`);
  console.log('  shared part bank and the five house models. A massed style is a parameter');
  console.log('  set rather than a mesh and the detail parts are shared across every zone');
  console.log('  and level, so 45 massed looks still cost fourteen bodies and eight parts.');
  console.log('');
  console.log('  the ten largest, by triangles submitted\n');
  console.log('    mesh                     instances     triangles   shadow');
  for (const r of rows.filter((r) => r.count > 0).sort((a, b) => b.tris - a.tris).slice(0, 10)) {
    console.log(
      `    ${r.name.padEnd(22)}${thou(r.count, 10)}${thou(r.tris, 14)}${(r.shadow ? '   yes' : '    no').padStart(9)}`,
    );
  }
}
console.log('');

// ------------------------------------------------------- part 1b

/**
 * What modelling the first rungs costs, measured at the city that is made of
 * them.
 *
 * Part 1 stands the city at level 4, where there is not a single first-rung
 * house or shop in it — so it says nothing at all about the ten models. The
 * case that pays for them is the opposite one: a player who annexes widely and
 * promotes little has a 49-district city of nothing but the modelled rungs, and
 * that is the most modelled geometry the game can ever have standing.
 *
 * The comparison is against what that same city used to be: one box per
 * building, one roof out of the shared bank. That is not a state this build can
 * produce, so it is arithmetic rather than a second measurement — a massed
 * first-rung building was a 12-triangle box and a 12-triangle roof, and the
 * count of them is the count standing.
 */
console.log('what modelling the first rungs of housing and commerce costs\n');
{
  const low = stand(MAX_DISTRICTS, 0);
  const rows = submitted(low.root);
  const t = totals(rows);
  const models = rows.filter((r) => r.name.startsWith('model:'));
  const standing = models.reduce((n, r) => n + r.count, 0);
  const tris = models.reduce((n, r) => n + r.tris, 0);
  const massed = standing * 24;
  const shadowTris = rows.filter((r) => r.count > 0 && r.shadow).reduce((n, r) => n + r.tris, 0);
  console.log(`  districts ${MAX_DISTRICTS}, everything at level 1 — every house and shop a model`);
  console.log(`  draw calls in the whole scene      ${pad(t.drawn, 8)}`);
  console.log(`  triangles submitted                ${thou(t.tris, 8)}`);
  console.log(`  of those, in the shadow pass       ${thou(shadowTris, 8)}`);
  console.log('');
  console.log('    model                     instances     triangles');
  for (const zone of ['home', 'shop']) {
    const mine = models.filter((r) => r.name.startsWith(`model:${zone}:`));
    for (const r of mine) {
      console.log(`    ${r.name.padEnd(25)}${thou(r.count, 10)}${thou(r.tris, 14)}`);
    }
    const n = mine.reduce((a, r) => a + r.count, 0);
    const x = mine.reduce((a, r) => a + r.tris, 0);
    console.log(`    ${`all five ${zone}`.padEnd(25)}${thou(n, 10)}${thou(x, 14)}`);
  }
  console.log('');
  const before = t.tris - tris + massed;
  console.log(`  the same ${standing.toLocaleString('en-GB')} buildings massed would be`);
  console.log(`  a box and a roof each: ${thou(massed, 1)} triangles, in 4 meshes.`);
  console.log(`  So the models cost ${thou(tris - massed, 1)} triangles and 6 draw calls,`);
  console.log(`  and are ${fixed((100 * tris) / t.tris, 1, 1)}% of everything this city submits.`);
  console.log('');
  console.log('  This is the honest headline, and it is a real cost: the worst scene the');
  console.log(`  game can build goes from ${thou(before, 1)} triangles to ${thou(t.tris, 1)},`);
  console.log(`  which is ${fixed((100 * t.tris) / before - 100, 1, 1)}% more, for 6 draw calls and ten silhouettes.`);
  console.log('  It is also worth reading against part 1, which is the *other* worst case:');
  console.log('  a level-4 city has half the buildings and dresses them to the teeth.');
}
console.log('');

// ------------------------------------------------------------------- part 2

/**
 * The two cameras, built exactly as `World` and `CameraRig` build them.
 *
 * The orbit one is at the framing distance `fit` picks for a city this size,
 * at the rig's own resting angles. The street one is at the mode this change
 * adds: a short arm, near-horizontal, low over a road.
 */
function cameras(districts) {
  const centre = cityCentre(districts);
  const radius = cityRadius(districts);
  const make = (r, phi, targetY, near, far) => {
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, near, far);
    const theta = 0.72;
    const target = new THREE.Vector3(centre.x, targetY, centre.z);
    camera.position.set(
      target.x + r * Math.sin(phi) * Math.cos(theta),
      target.y + r * Math.cos(phi),
      target.z + r * Math.sin(phi) * Math.sin(theta),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    return camera;
  };
  return {
    orbit: make(radius * 3.6 + 18, 0.95, 4, 0.5, radius * 8 + 600),
    street: make(7, 1.5, 0.9, 0.12, 600),
  };
}

/** How many of the city's districts a camera's frustum touches. */
function districtsInView(camera, districts) {
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  );
  const box = new THREE.Box3();
  const half = DISTRICT_WIDTH / 2;
  let seen = 0;
  for (let i = 0; i < districts; i++) {
    const at = districtCoord(i);
    const x = at.x * DISTRICT_WIDTH;
    const z = at.z * DISTRICT_WIDTH;
    // Tall enough for an arcology and its beacon, which is what decides whether
    // a district on the edge of the frustum is in it.
    box.min.set(x - half, 0, z - half);
    box.max.set(x + half, 40, z + half);
    if (frustum.intersectsBox(box)) seen++;
  }
  return seen;
}

console.log('what a frustum test can remove\n');
for (const districts of [1, 10, MAX_DISTRICTS]) {
  const scene = stand(districts, LEVELS - 1);
  const rows = submitted(scene.root).filter((r) => r.count > 0);
  const cams = cameras(districts);
  const sphere = new THREE.Sphere();
  /** How many meshes a frustum rejects, against whatever bounds they carry. */
  const cull = (frustum, tight) => {
    let culled = 0;
    for (const r of rows) {
      // The stated column is what the renderer actually ships: a mesh with the
      // flag off is never tested, however far off screen it is. The tight
      // column ignores the flag and derives bounds by walking every instance
      // matrix, which is the ceiling — the gap between the two is what turning
      // the flag on selectively, and stating the bounds, is giving up.
      if (!tight && !r.mesh.frustumCulled) continue;
      let bs = r.mesh.boundingSphere;
      if (tight || !bs) {
        r.mesh.boundingSphere = null;
        r.mesh.computeBoundingSphere();
        bs = r.mesh.boundingSphere;
      }
      if (!bs) continue;
      sphere.copy(bs).applyMatrix4(r.mesh.matrixWorld);
      if (!frustum.intersectsSphere(sphere)) culled++;
    }
    return culled;
  };
  const line = (name, camera) => {
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    // Stated first, because computing the tight ones overwrites them — and the
    // stated spheres are restored afterwards so a second camera sees the same
    // scene the first did.
    const kept = rows.map((r) => r.mesh.boundingSphere);
    const stated = cull(frustum, false);
    const tight = cull(frustum, true);
    rows.forEach((r, i) => {
      r.mesh.boundingSphere = kept[i];
    });
    const seen = districtsInView(camera, districts);
    console.log(
      `    ${name.padEnd(8)}${pad(rows.length, 12)}${pad(stated, 9)}${pad(tight, 8)}` +
        `${pad(seen, 12)}${fixed((seen / districts) * 100, 9, 1)}%`,
    );
  };
  console.log(`  ${districts} districts`);
  console.log('    camera     draw calls   stated   tight   districts   share');
  line('orbit', cams.orbit);
  line('street', cams.street);
  console.log('');
}
console.log("  Stated bounds are the city's own extent, so a body mesh — one (zone, level)");
console.log('  across every district — carries a sphere round the whole map and is never');
console.log('  rejected. The tight column is what three would derive by walking every');
console.log('  instance matrix: up to 14 more draw calls, at the price of recomputing');
console.log('  those bounds every frame anything moves. The district column is the one');
console.log('  with room in it, and that is what the detail mask uses.');
console.log('');

// ------------------------------------------------------------------- part 3

console.log('what a per-district cull would leave, at 49 districts\n');
{
  const cams = cameras(MAX_DISTRICTS);
  const rows = submitted(big.root).filter((r) => r.count > 0);
  const t = totals(rows);
  console.log('    camera    districts seen   share of instances   triangles left');
  for (const [name, camera] of [
    ['orbit', cams.orbit],
    ['street', cams.street],
  ]) {
    const seen = districtsInView(camera, MAX_DISTRICTS);
    const share = seen / MAX_DISTRICTS;
    console.log(
      `    ${name.padEnd(9)}${pad(seen, 14)}${fixed(share * 100, 20, 1)}%${thou(t.tris * share, 18)}`,
    );
  }
  console.log('');
  console.log(`    all 49                     ${fixed(100, 19, 1)}%${thou(t.tris, 18)}`);
}
console.log('');

// ------------------------------------------------------------------- part 4

console.log('what the dressing is worth, and what a repack costs\n');
{
  const rows = submitted(big.root).filter((r) => r.count > 0);
  const parts = rows.filter((r) => r.name.startsWith('part:'));
  const bodies = rows.filter((r) => /^(home|shop|industry):\d+$/.test(r.name));
  const t = totals(rows);
  const partTris = parts.reduce((n, r) => n + r.tris, 0);
  const bodyTris = bodies.reduce((n, r) => n + r.tris, 0);
  console.log(`    bodies      ${thou(bodies.reduce((n, r) => n + r.count, 0), 9)} instances` +
    `${thou(bodyTris, 12)} triangles`);
  console.log(`    dressing    ${thou(parts.reduce((n, r) => n + r.count, 0), 9)} instances` +
    `${thou(partTris, 12)} triangles  (${((partTris / t.tris) * 100).toFixed(1)}% of the scene)`);
  console.log('');
  console.log('    the dressing, part by part\n');
  console.log('      part                 instances    triangles');
  for (const r of parts.sort((a, b) => b.count - a.count)) {
    console.log(`      ${r.name.padEnd(20)}${thou(r.count, 10)}${thou(r.tris, 13)}`);
  }
  console.log('');

  console.log(`    dressing as a share of every triangle   ${((partTris / t.tris) * 100).toFixed(1)}%`);
}
console.log('');

// ------------------------------------------------------------------- part 5

console.log('what the detail mask actually removes\n');
{
  const state = big.state;
  const centre = cityCentre(state.districts);
  const layout = new CityLayout();
  const scene = new THREE.Scene();
  const buildings = new Buildings(scene, layout);
  buildings.sync(state, 0);

  /** Instances and triangles in the part bank as it currently stands. */
  const dressing = () => {
    const parts = submitted(scene).filter((r) => r.name.startsWith('part:'));
    return {
      instances: parts.reduce((n, r) => n + r.count, 0),
      tris: parts.reduce((n, r) => n + r.tris, 0),
    };
  };

  /** Times a repack from whatever state the mask is currently in. */
  const repackCost = () => {
    let best = Infinity;
    for (let r = 0; r < 3; r++) {
      const t0 = process.hrtime.bigint();
      for (let i = 0; i < 20; i++) buildings.repack(0);
      const t1 = process.hrtime.bigint();
      best = Math.min(best, Number(t1 - t0) / 1e6 / 20);
    }
    return best;
  };

  console.log('    camera distance   dressed   instances   triangles   repack ms');
  for (const distance of [1206, 200, 120, 60, 7]) {
    buildings.setDetail(centre.x, centre.z, distance, state.districts);
    buildings.repack(0);
    const d = dressing();
    console.log(
      `    ${pad(distance, 15)}${(buildings.dressingAll ? '   all' : '  some').padStart(10)}` +
        `${thou(d.instances, 12)}${thou(d.tris, 12)}${fixed(repackCost(), 12, 2)}`,
    );
  }
  console.log('');
  console.log('    1206 is the framing distance `fit` picks for 49 districts, which is the');
  console.log('    wide shot; 7 is the street camera. The mask engages under 120 and the');
  console.log('    two views therefore never fight over what the city should be wearing.');
}
console.log('');

// ------------------------------------------------------------------- part 6

console.log('what the haze does, at both cameras\n');
{
  // `World`'s own arithmetic, restated: the constructor's 110/240 is replaced on
  // the first frame by `updateFog`, which derives both depths from the camera's
  // distance and the city's radius.
  const radius = cityRadius(MAX_DISTRICTS);
  const far = radius * 8 + 600;
  const fogOf = (distance) => ({
    near: distance * 0.95,
    far: Math.min(far * 0.98, distance + radius * 4 + 400),
  });
  const across = radius * 2;
  console.log('    camera        distance   fog near    fog far   haze at the far kerb');
  for (const [name, distance] of [
    ['orbit (fit)', radius * 3.6 + 18],
    ['orbit (close)', 120],
    ['street', 7],
  ]) {
    const fog = fogOf(distance);
    const at = Math.max(0, Math.min(1, (across - fog.near) / (fog.far - fog.near)));
    console.log(
      `    ${name.padEnd(14)}${fixed(distance, 9, 0)}${fixed(fog.near, 11, 0)}` +
        `${fixed(fog.far, 11, 0)}${fixed(at * 100, 20, 0)}%`,
    );
  }
  console.log('');
  console.log(`    "the far kerb" is ${Math.round(across)} units — the width of a 49-district city.`);
  console.log('    The constructor\'s 110/240 never survives a frame: `updateFog` runs every');
  console.log('    frame and overwrites both. Left alone — see the report.');
}
