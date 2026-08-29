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

/**
 * The whole city, standing in one scene, exactly as `View` assembles it.
 *
 * `at` moves one zone's cohort off `level` without moving the other two, which
 * is what parts 1c and 1g need to measure a promotion in isolation:
 * `{ home: 1 }` climbs housing alone, `{ shop: 1 }` climbs commerce alone. It is
 * only legal between levels of the same footprint — the count `city` fitted is
 * a count of *buildings*, and a rung that stands on two plots would need half
 * as many — so it is used for 0 -> 1 and asserted rather than trusted.
 *
 * All three zones are listed even though only two are asked for today: a name
 * this loop does not know would move nothing and report nothing, which is the
 * one way a calibration can quietly measure the wrong city.
 */
const COHORTS = {
  home: ['homes', 'homeLevels'],
  shop: ['shops', 'shopLevels'],
  industry: ['industry', 'industryLevels'],
};

function stand(districts, level, at = {}) {
  const state = city(districts, level);
  for (const [zone, [count, cohort]] of Object.entries(COHORTS)) {
    const to = at[zone];
    if (to === undefined || to === level) continue;
    if ((LEVEL_FOOTPRINT[to] ?? 1) !== (LEVEL_FOOTPRINT[level] ?? 1)) {
      throw new Error(`levels ${level} and ${to} have different footprints`);
    }
    const levels = new Array(LEVELS).fill(0);
    levels[to] = state[count];
    state[cohort] = levels;
  }
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
  console.log(`  BUILDING_MESH_BUDGET is ${BUILDING_MESH_BUDGET}: the three zone ladders, the shared`);
  console.log('  part bank and the construction cage. A massed style is a parameter set');
  console.log('  rather than a mesh and the detail parts are shared across every zone and');
  console.log('  level, so what is left massed — 12 looks across four rungs, all of them');
  console.log('  industry — costs four bodies and eight parts, against 55 meshes for the');
  console.log('  eleven modelled rungs.');
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
 * building in it — so it says nothing at all about the ten models. The
 * case that pays for them is the opposite one: a player who annexes widely and
 * promotes little has a 49-district city of nothing but the modelled rungs,
 * which is the most *buildings* the game can ever have standing as models. Part
 * 1c is the other half: the same city with its housing promoted one rung, which
 * is the most modelled geometry, because a walk-up is a bigger model than the
 * house it replaces.
 *
 * The comparison is against what that same city used to be: one box per
 * building, one roof out of the shared bank. That is not a state this build can
 * produce, so it is arithmetic rather than a second measurement — a massed
 * first-rung building was a 12-triangle box and a 12-triangle roof, and the
 * count of them is the count standing.
 */
console.log('what modelling every zone\'s first rung costs\n');
{
  const low = stand(MAX_DISTRICTS, 0);
  const rows = submitted(low.root);
  const t = totals(rows);
  const models = rows.filter((r) => r.name.startsWith('model:'));
  const standing = models.reduce((n, r) => n + r.count, 0);
  const tris = models.reduce((n, r) => n + r.tris, 0);
  const massed = standing * 24;
  const shadowTris = rows.filter((r) => r.count > 0 && r.shadow).reduce((n, r) => n + r.tris, 0);
  console.log(`  districts ${MAX_DISTRICTS}, everything at level 1 — every building a model`);
  console.log(`  draw calls in the whole scene      ${pad(t.drawn, 8)}`);
  console.log(`  triangles submitted                ${thou(t.tris, 8)}`);
  console.log(`  of those, in the shadow pass       ${thou(shadowTris, 8)}`);
  console.log('');
  console.log('    model                     instances     triangles');
  for (const zone of ['home', 'shop', 'industry']) {
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
  console.log(`  a box and a roof each: ${thou(massed, 1)} triangles, in 6 meshes.`);
  console.log(`  So the models cost ${thou(tris - massed, 1)} triangles and 9 draw calls,`);
  console.log(`  and are ${fixed((100 * tris) / t.tris, 1, 1)}% of everything this city submits.`);
  console.log('');
  console.log('  This is the honest headline, and it is a real cost: the worst scene the');
  console.log(`  game can build goes from ${thou(before, 1)} triangles to ${thou(t.tris, 1)},`);
  console.log(`  which is ${fixed((100 * t.tris) / before - 100, 1, 1)}% more, for 9 draw calls and fifteen silhouettes.`);
  console.log('  It is also worth reading against part 1, which is the *other* worst case:');
  console.log('  a level-4 city has half the buildings and dresses them to the teeth.');
}
console.log('');

// ------------------------------------------------------- part 1c

/**
 * What modelling housing's *second* rung costs, measured as the swap it is.
 *
 * The question part 1b cannot answer, and the one the fourth +4 on
 * BUILDING_MESH_BUDGET has to be argued against: a district that promotes its
 * housing does not gain buildings, it trades them. A plot holds one building,
 * so 1,176 houses become 1,176 walk-ups — and what the promotion costs is the
 * difference between the two models rather than the whole of the second one.
 *
 * Housing alone moves, with commerce and industry left on their first rung.
 * That is the city the trade is visible in: promoting all three at once would
 * mix in the massed rungs the other two climb to, and the reading would be
 * about those instead.
 */
console.log("what modelling housing's second rung costs\n");
{
  const houses = stand(MAX_DISTRICTS, 0);
  const walkups = stand(MAX_DISTRICTS, 0, { home: 1 });
  const homeRows = (root, level) =>
    submitted(root).filter((r) => r.name.startsWith(`model:home:${level}:`));
  const sum = (rows, key) => rows.reduce((n, r) => n + r[key], 0);

  const before = homeRows(houses.root, 0);
  const after = homeRows(walkups.root, 1);
  const nBefore = sum(before, 'count');
  const nAfter = sum(after, 'count');
  const tBefore = sum(before, 'tris');
  const tAfter = sum(after, 'tris');
  const whole = totals(submitted(houses.root)).tris;
  const wholeAfter = totals(submitted(walkups.root)).tris;

  console.log(`  districts ${MAX_DISTRICTS}, commerce and industry at level 1 throughout`);
  console.log('');
  console.log('    housing            buildings     triangles      each');
  console.log(
    `    ${'level 1, houses'.padEnd(19)}${thou(nBefore, 9)}${thou(tBefore, 14)}${thou(tBefore / Math.max(1, nBefore), 10)}`,
  );
  console.log(
    `    ${'level 2, walk-ups'.padEnd(19)}${thou(nAfter, 9)}${thou(tAfter, 14)}${thou(tAfter / Math.max(1, nAfter), 10)}`,
  );
  console.log('');
  console.log(`  The same ${nBefore.toLocaleString('en-GB')} plots, so the promotion is a swap and not an addition:`);
  console.log(`  ${thou(tAfter - tBefore, 1)} triangles more, which is ${fixed((100 * tAfter) / tBefore - 100, 1, 1)}% on the housing and`);
  console.log(`  ${fixed((100 * wholeAfter) / whole - 100, 1, 1)}% on the whole scene — ${thou(whole, 1)} to ${thou(wholeAfter, 1)}.`);
  console.log('');
  console.log('  Massed, this rung was a box and a roof: 24 triangles a building, so the');
  console.log(`  rung the player promotes to went from ${thou(nAfter * 24, 1)} triangles to`);
  console.log(`  ${thou(tAfter, 1)} for five silhouettes and 4 draw calls. That is the price,`);
  console.log('  and it buys the one promotion every player makes.');
}
console.log('');

// ------------------------------------------------------- part 1d

/**
 * What the towers cost, which is the one that had to be looked at before it was
 * spent rather than after.
 *
 * They are the largest models in the city by a wide margin — 67 to 241 boxes
 * against a house's 17 to 23 — and the arithmetic that makes them affordable is
 * the merge rather than the models: a tower stands on *two* plots, so a district
 * that has climbed to them holds about half as many buildings as one of walk-
 * ups. Whether the halving covers a model five times the size is the question,
 * and it is a measurement rather than an opinion.
 *
 * Housing alone moves again, for the reason part 1c gives. `city` is asked for a
 * level-2 city directly here rather than patched, because this rung *does*
 * change the building count — the footprint is 2 — and `city` is what knows how
 * to fit a cohort to the land.
 */
console.log('what the towers cost, and what the merge pays back\n');
{
  const walkups = stand(MAX_DISTRICTS, 0, { home: 1 });
  const towers = stand(MAX_DISTRICTS, 2);
  const rows = (root, level) =>
    submitted(root).filter((r) => r.name.startsWith(`model:home:${level}:`));
  const sum = (list, key) => list.reduce((n, r) => n + r[key], 0);

  const before = rows(walkups.root, 1);
  const after = rows(towers.root, 2);
  const nB = sum(before, 'count');
  const nA = sum(after, 'count');
  const tB = sum(before, 'tris');
  const tA = sum(after, 'tris');

  console.log(`  districts ${MAX_DISTRICTS}, housing alone climbing`);
  console.log('');
  console.log('    housing            buildings     triangles      each');
  console.log(
    `    ${'level 2, walk-ups'.padEnd(19)}${thou(nB, 9)}${thou(tB, 14)}${thou(tB / Math.max(1, nB), 10)}`,
  );
  console.log(
    `    ${'level 3, towers'.padEnd(19)}${thou(nA, 9)}${thou(tA, 14)}${thou(tA / Math.max(1, nA), 10)}`,
  );
  console.log('');
  console.log('    tower                     instances     triangles');
  for (const r of after) {
    console.log(`    ${r.name.padEnd(25)}${thou(r.count, 10)}${thou(r.tris, 14)}`);
  }
  console.log('');
  const ratio = tA / Math.max(1, tB);
  console.log(`  A tower is ${fixed(tA / Math.max(1, nA) / (tB / Math.max(1, nB)), 1, 2)}x the model a walk-up is, and the merge`);
  console.log(`  halves the count: ${nB.toLocaleString('en-GB')} walk-ups become ${nA.toLocaleString('en-GB')} towers. Net, the rung`);
  console.log(`  costs ${fixed(ratio, 1, 2)}x what the one below it does — ${thou(tA - tB, 1)} triangles.`);
  console.log('');
  console.log('  The balcony slab is the outlier and worth naming: 241 boxes, 120 of them');
  console.log('  balcony rails that are a tenth of a unit across. From the orbit camera');
  console.log('  they are sub-pixel, which is the silhouette-geometry case `ModelMeshes`');
  console.log('  sets out and does not build. This is the number to re-read when it is.');
}
console.log('');

// ------------------------------------------------------- part 1e

/**
 * The arcologies, which is the rung where the swap stops costing entirely.
 *
 * Both rungs stand on a merged parcel, so unlike every promotion below it this
 * one does not change the building count at all: the same 588 parcels, a
 * different model on each. That makes it the cleanest of these comparisons —
 * whatever the difference is, it is the models and nothing else.
 */
console.log('what the arcologies cost against the towers\n');
{
  const towers = stand(MAX_DISTRICTS, 2);
  const arcologies = stand(MAX_DISTRICTS, 3);
  const rows = (root, level) =>
    submitted(root).filter((r) => r.name.startsWith(`model:home:${level}:`));
  const sum = (list, key) => list.reduce((n, r) => n + r[key], 0);

  const before = rows(towers.root, 2);
  const after = rows(arcologies.root, 3);
  const nB = sum(before, 'count');
  const nA = sum(after, 'count');
  const tB = sum(before, 'tris');
  const tA = sum(after, 'tris');
  const wholeB = totals(submitted(towers.root)).tris;
  const wholeA = totals(submitted(arcologies.root)).tris;

  console.log(`  districts ${MAX_DISTRICTS}, housing alone climbing, commerce and industry at level 1`);
  console.log('');
  console.log('    housing            buildings     triangles      each');
  console.log(
    `    ${'level 3, towers'.padEnd(19)}${thou(nB, 9)}${thou(tB, 14)}${thou(tB / Math.max(1, nB), 10)}`,
  );
  console.log(
    `    ${'level 4, arcologies'.padEnd(19)}${thou(nA, 9)}${thou(tA, 14)}${thou(tA / Math.max(1, nA), 10)}`,
  );
  console.log('');
  console.log('    arcology                  instances     triangles');
  for (const r of after) {
    console.log(`    ${r.name.padEnd(25)}${thou(r.count, 10)}${thou(r.tris, 14)}`);
  }
  console.log('');
  console.log(`  Same ${nA.toLocaleString('en-GB')} parcels either way — both rungs merge — so this is the models`);
  console.log(`  and nothing else: ${thou(tA - tB, 1)} triangles, ${fixed((100 * tA) / Math.max(1, tB) - 100, 1, 1)}% on the housing and`);
  console.log(`  ${fixed((100 * wholeA) / Math.max(1, wholeB) - 100, 1, 1)}% on the whole scene, ${thou(wholeB, 1)} to ${thou(wholeA, 1)}.`);
  console.log('');
  console.log('  Which is the answer to the question the towers raised, and it came back');
  console.log('  better than the question assumed: a rung of models above the merge is not');
  console.log('  another 2x, it is whatever the two models differ by — and here that is');
  console.log('  *negative*. The towers cost what they did because they replaced twice as');
  console.log('  many smaller buildings. From the merge up the count is fixed, so the');
  console.log('  fourth rung of housing is the first one in this whole sequence that is');
  console.log('  free: five more silhouettes, four more draw calls, and slightly fewer');
  console.log('  triangles than the rung it stands above.');
}
console.log('');

// ------------------------------------------------------- part 1f

/**
 * The whole housing ladder, now that every rung of it is modelled.
 *
 * The five parts before this each measured one step. This is the shape they
 * make together, and it is the number to quote when someone asks what modelling
 * housing cost: the same district, promoted rung by rung, from the city a new
 * player builds to the one a finished city is.
 *
 * Read it as two halves. Below the merge, promoting is *cheaper per building*
 * and there are twice as many of them; above it the count is pinned at the
 * parcel and a rung is worth only the difference between two models. That is
 * why the curve turns over rather than running away.
 */
console.log('the whole housing ladder, rung by rung\n');
{
  const rung = (level) => {
    const scene = level <= 1 ? stand(MAX_DISTRICTS, 0, { home: level }) : stand(MAX_DISTRICTS, level);
    const rows = submitted(scene.root).filter((r) => r.name.startsWith(`model:home:${level}:`));
    return {
      n: rows.reduce((a, r) => a + r.count, 0),
      tris: rows.reduce((a, r) => a + r.tris, 0),
      whole: totals(submitted(scene.root)).tris,
    };
  };
  const names = ['houses', 'walk-ups', 'towers', 'arcologies', 'pinnacles'];
  const all = names.map((_, l) => rung(l));

  console.log(`  districts ${MAX_DISTRICTS}, housing alone climbing, commerce and industry at level 1`);
  console.log('');
  console.log('    rung                buildings     triangles      each      massed');
  all.forEach((r, l) => {
    console.log(
      `    ${`${l + 1}. ${names[l]}`.padEnd(20)}${thou(r.n, 9)}${thou(r.tris, 14)}${thou(r.tris / Math.max(1, r.n), 10)}${thou(r.n * 24, 12)}`,
    );
  });
  console.log('');
  const first = all[0];
  const last = all[all.length - 1];
  console.log(`  Peak is rung 3 at ${thou(all[2].tris, 1)}; the ladder ends *below* it, at`);
  console.log(`  ${thou(last.tris, 1)} on ${last.n.toLocaleString('en-GB')} buildings. Massed, the top rung was`);
  console.log(`  ${thou(last.n * 24, 1)} triangles, so the five silhouettes there cost ${thou(last.tris - last.n * 24, 1)}.`);
  console.log('');
  console.log('  The shape worth remembering: modelling a rung costs in proportion to how');
  console.log('  many buildings stand on it, and the merge halves that at rung 3. So the');
  console.log('  expensive half of this ladder is the bottom half, which is also the half');
  console.log('  a player spends the most time looking at — the spend and the value line');
  console.log('  up, which is not something that had to be true.');
}
console.log('');

// ------------------------------------------------------- part 1g

/**
 * What modelling *commerce's* second rung costs, on the same terms as 1c.
 *
 * The measurement the seventh +4 on BUILDING_MESH_BUDGET has to be argued
 * against, and the reason it is a separate part rather than a line in 1c: the
 * note on that budget priced commerce as the expensive zone, because a district
 * carries 45 commercial plots against 24 residential. So the same +5 -1 buys
 * fewer buildings' worth of promotion here per triangle spent, and the number
 * that settles whether it was worth it is this one rather than housing's.
 *
 * Commerce alone moves, housing and industry left on their first rung, for the
 * reason 1c gives.
 */
console.log("what modelling commerce's second rung costs\n");
{
  const shops = stand(MAX_DISTRICTS, 0);
  const streets = stand(MAX_DISTRICTS, 0, { shop: 1 });
  const shopRows = (root, level) =>
    submitted(root).filter((r) => r.name.startsWith(`model:shop:${level}:`));
  const sum = (rows, key) => rows.reduce((n, r) => n + r[key], 0);

  const before = shopRows(shops.root, 0);
  const after = shopRows(streets.root, 1);
  const nBefore = sum(before, 'count');
  const nAfter = sum(after, 'count');
  const tBefore = sum(before, 'tris');
  const tAfter = sum(after, 'tris');
  const whole = totals(submitted(shops.root)).tris;
  const wholeAfter = totals(submitted(streets.root)).tris;

  console.log(`  districts ${MAX_DISTRICTS}, housing and industry at level 1 throughout`);
  console.log('');
  console.log('    commerce              buildings     triangles      each');
  console.log(
    `    ${'level 1, shops'.padEnd(22)}${thou(nBefore, 9)}${thou(tBefore, 14)}${thou(tBefore / Math.max(1, nBefore), 10)}`,
  );
  console.log(
    `    ${'level 2, high streets'.padEnd(22)}${thou(nAfter, 9)}${thou(tAfter, 14)}${thou(tAfter / Math.max(1, nAfter), 10)}`,
  );
  console.log('');
  console.log(`  The same ${nBefore.toLocaleString('en-GB')} plots, so the promotion is a swap and not an addition:`);
  console.log(`  ${thou(tAfter - tBefore, 1)} triangles more, which is ${fixed((100 * tAfter) / tBefore - 100, 1, 1)}% on the commerce and`);
  console.log(`  ${fixed((100 * wholeAfter) / whole - 100, 1, 1)}% on the whole scene — ${thou(whole, 1)} to ${thou(wholeAfter, 1)}.`);
  console.log('');
  console.log('  Massed, this rung was a box and a roof: 24 triangles a building, so the');
  console.log(`  rung the player promotes to went from ${thou(nAfter * 24, 1)} triangles to`);
  console.log(`  ${thou(tAfter, 1)} for five silhouettes and 4 draw calls.`);
}
console.log('');

// ------------------------------------------------------- part 1h

/**
 * What commerce's *merge* costs, which part 1g's shape cannot measure.
 *
 * 1g could subtract two rungs directly because both stood on one plot and the
 * building count was pinned. This rung is the merge — `LEVEL_FOOTPRINT` goes
 * 1 -> 2 — so the count halves, and the question is the one part 1d asked of
 * the towers: whether the halving covers a model that got bigger. `city` is
 * asked for a level-2 city directly rather than patched, because it is what
 * knows how to fit a cohort to the land when the footprint changes.
 *
 * Only the commercial rows are read, so the two scenes differing in what their
 * housing is doing does not enter the comparison — which is also why there is
 * no whole-scene percentage here and there is one in 1g.
 */
console.log("what commerce's merge costs, and what it pays back\n");
{
  const streets = stand(MAX_DISTRICTS, 0, { shop: 1 });
  const parks = stand(MAX_DISTRICTS, 2);
  const rows = (root, level) =>
    submitted(root).filter((r) => r.name.startsWith(`model:shop:${level}:`));
  const sum = (list, key) => list.reduce((n, r) => n + r[key], 0);

  const before = rows(streets.root, 1);
  const after = rows(parks.root, 2);
  const nB = sum(before, 'count');
  const nA = sum(after, 'count');
  const tB = sum(before, 'tris');
  const tA = sum(after, 'tris');

  console.log(`  districts ${MAX_DISTRICTS}, commerce alone climbing`);
  console.log('');
  console.log('    commerce              buildings     triangles      each');
  console.log(
    `    ${'level 2, high streets'.padEnd(22)}${thou(nB, 9)}${thou(tB, 14)}${thou(tB / Math.max(1, nB), 10)}`,
  );
  console.log(
    `    ${'level 3, retail parks'.padEnd(22)}${thou(nA, 9)}${thou(tA, 14)}${thou(tA / Math.max(1, nA), 10)}`,
  );
  console.log('');
  console.log('    retail park               instances     triangles');
  for (const r of after) {
    console.log(`    ${r.name.padEnd(25)}${thou(r.count, 10)}${thou(r.tris, 14)}`);
  }
  console.log('');
  const ratio = tA / Math.max(1, tB);
  console.log(`  A retail park is ${fixed(tA / Math.max(1, nA) / (tB / Math.max(1, nB)), 1, 2)}x the model a high street is, and the`);
  console.log(`  merge halves the count: ${nB.toLocaleString('en-GB')} high streets become ${nA.toLocaleString('en-GB')} retail`);
  console.log(`  parks. Net, the rung costs ${fixed(ratio, 1, 2)}x what the one below it does —`);
  console.log(`  ${thou(tA - tB, 1)} triangles.`);
}
console.log('');

// ------------------------------------------------------- part 1i

/**
 * What commerce's rung *above* its merge costs, on part 1e's terms.
 *
 * Both rungs stand on the same parcels, so the count is pinned and the reading
 * is the two models and nothing else — the question part 1e answered for
 * housing, asked again where the answer might differ. It does: housing's fourth
 * rung came back *negative* because an arcology is simpler than a tower, and
 * that is a fact about those two models rather than about merged rungs. Whether
 * a rung above a merge is free depends entirely on which way the models go.
 */
console.log("what commerce's rung above the merge costs\n");
{
  const parks = stand(MAX_DISTRICTS, 2);
  const exchanges = stand(MAX_DISTRICTS, 3);
  const rows = (root, level) =>
    submitted(root).filter((r) => r.name.startsWith(`model:shop:${level}:`));
  const sum = (list, key) => list.reduce((n, r) => n + r[key], 0);

  const before = rows(parks.root, 2);
  const after = rows(exchanges.root, 3);
  const nB = sum(before, 'count');
  const nA = sum(after, 'count');
  const tB = sum(before, 'tris');
  const tA = sum(after, 'tris');
  const wholeB = totals(submitted(parks.root)).tris;
  const wholeA = totals(submitted(exchanges.root)).tris;

  console.log(`  districts ${MAX_DISTRICTS}, commerce alone climbing`);
  console.log('');
  console.log('    commerce              buildings     triangles      each');
  console.log(
    `    ${'level 3, retail parks'.padEnd(22)}${thou(nB, 9)}${thou(tB, 14)}${thou(tB / Math.max(1, nB), 10)}`,
  );
  console.log(
    `    ${'level 4, exchanges'.padEnd(22)}${thou(nA, 9)}${thou(tA, 14)}${thou(tA / Math.max(1, nA), 10)}`,
  );
  console.log('');
  console.log(`  Same ${nA.toLocaleString('en-GB')} parcels either way — both rungs merge — so this is the models`);
  console.log(`  and nothing else: ${thou(tA - tB, 1)} triangles, ${fixed((100 * tA) / Math.max(1, tB) - 100, 1, 1)}% on the commerce and`);
  console.log(`  ${fixed((100 * wholeA) / Math.max(1, wholeB) - 100, 1, 1)}% on the whole scene, ${thou(wholeB, 1)} to ${thou(wholeA, 1)}.`);
}
console.log('');

// ------------------------------------------------------- part 1j

/**
 * What commerce's *top* rung costs, on part 1i's terms.
 *
 * The third and last application of the pinned-parcel argument to commerce, and
 * the one that finishes the ladder. Same parcels either way, so this is the two
 * models and nothing else.
 */
console.log("what commerce's top rung costs\n");
{
  const exchanges = stand(MAX_DISTRICTS, 3);
  const towers = stand(MAX_DISTRICTS, 4);
  const rows = (root, level) =>
    submitted(root).filter((r) => r.name.startsWith(`model:shop:${level}:`));
  const sum = (list, key) => list.reduce((n, r) => n + r[key], 0);

  const before = rows(exchanges.root, 3);
  const after = rows(towers.root, 4);
  const nB = sum(before, 'count');
  const nA = sum(after, 'count');
  const tB = sum(before, 'tris');
  const tA = sum(after, 'tris');

  console.log(`  districts ${MAX_DISTRICTS}, commerce alone climbing`);
  console.log('');
  console.log('    commerce              buildings     triangles      each');
  console.log(
    `    ${'level 4, exchanges'.padEnd(22)}${thou(nB, 9)}${thou(tB, 14)}${thou(tB / Math.max(1, nB), 10)}`,
  );
  console.log(
    `    ${'level 5, trade towers'.padEnd(22)}${thou(nA, 9)}${thou(tA, 14)}${thou(tA / Math.max(1, nA), 10)}`,
  );
  console.log('');
  console.log(`  Same ${nA.toLocaleString('en-GB')} parcels either way: ${thou(tA - tB, 1)} triangles, ${fixed((100 * tA) / Math.max(1, tB) - 100, 1, 1)}% on`);
  console.log('  the commerce.');
}
console.log('');

// ------------------------------------------------------- part 1k

/**
 * The whole commerce ladder, now that every rung of it is modelled.
 *
 * Part 1f's twin, and the number to quote when someone asks what modelling
 * commerce cost. Worth reading beside it rather than alone, because the two
 * ladders do *not* have the same shape and the difference is the useful part:
 * housing's turns over after the merge and keeps falling, commerce's turns over
 * at the merge and then climbs again.
 */
console.log('the whole commerce ladder, rung by rung\n');
{
  const rung = (level) => {
    const scene = level <= 1 ? stand(MAX_DISTRICTS, 0, { shop: level }) : stand(MAX_DISTRICTS, level);
    const rows = submitted(scene.root).filter((r) => r.name.startsWith(`model:shop:${level}:`));
    return {
      n: rows.reduce((a, r) => a + r.count, 0),
      tris: rows.reduce((a, r) => a + r.tris, 0),
    };
  };
  const names = ['shops', 'high streets', 'retail parks', 'exchanges', 'trade towers'];
  const all = names.map((_, l) => rung(l));

  console.log(`  districts ${MAX_DISTRICTS}, commerce alone climbing, housing and industry at level 1`);
  console.log('');
  console.log('    rung                   buildings     triangles      each      massed');
  all.forEach((r, l) => {
    console.log(
      `    ${`${l + 1}. ${names[l]}`.padEnd(23)}${thou(r.n, 9)}${thou(r.tris, 14)}${thou(r.tris / Math.max(1, r.n), 10)}${thou(r.n * 24, 12)}`,
    );
  });
  console.log('');
  const peak = all.reduce((best, r, l) => (r.tris > all[best].tris ? l : best), 0);
  console.log(`  Peak is rung ${peak + 1} at ${thou(all[peak].tris, 1)}, and the merge at rung 3 is what`);
  console.log(`  turns it over: the parcel count halves there and never recovers, so the`);
  console.log(`  top rung stands on ${all[4].n.toLocaleString('en-GB')} buildings against rung 2's ${all[1].n.toLocaleString('en-GB')}.`);
  console.log('');
  console.log('  Read beside part 1f: housing falls away after its merge because its models');
  console.log('  get simpler as they climb, and commerce climbs back because its do not.');
  console.log('  Both ladders are affordable and only one of them is affordable for the');
  console.log('  reason the note on BUILDING_MESH_BUDGET used to give.');
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
