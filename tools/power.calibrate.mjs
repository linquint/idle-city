/**
 * Measures the grid, so POWER_EXPONENT, POWER_PER_PLANT and POWER_BASE can be
 * set from numbers rather than from a feel. Same contract as the other
 * calibrators: it prints, it does not assert, and what it prints belongs in the
 * config comments.
 *
 * The measurement that decides the exponent is the first one, and it is a *land*
 * measurement rather than an economic one. A district reserves exactly one 2x2
 * square for a plant, so an exponent is only viable if one plant can still carry
 * a district built out at the top of the level ladder. Everything else here is a
 * check on the consequences: when the grid first bites, whether a browned-out
 * city can climb out, and what capping occupancy did to the demand loop that was
 * calibrated without it.
 *
 *   node tools/power.calibrate.mjs [hours]
 */
import {
  FRONTAGE_TARGET,
  LEVEL_CAPACITY,
  LEVEL_NAMES,
  MAX_DISTRICTS,
  OCCUPANCY_EMPTY,
  OCCUPANCY_FULL,
  POWER_BASE,
  POWER_EXPONENT,
  POWER_FLOOR,
  POWER_PER_PLANT,
  POWER_PER_PLOT,
  SERVICES,
} from '../src/sim/config.ts';
import {
  canBuildPlant,
  cityScale,
  income,
  netIncome,
  occupancyTarget,
  plantCost,
  population,
  powerCap,
  powerDemand,
  powerRatio,
  powerSupply,
  residents,
  serviceAllowed,
  upkeep,
} from '../src/sim/economy.ts';
import { Game } from '../src/sim/game.ts';
import { createState } from '../src/sim/state.ts';

const HOURS = Number(process.argv[2] ?? 24);
const pct = (n) => `${(n * 100).toFixed(1)}%`;

/** Candidate exponents, from "the term does nothing" to "the land cannot hold it". */
const EXPONENTS = [1.0, 1.1, 1.2, 1.25, 1.3, 1.4];
const SIZES = [1, 12, 49];

/**
 * A city of `districts` built out to its own frontage at `level`, with every
 * service the land allows and `plants` power plants.
 */
function builtOut(districts, level, plants) {
  const s = createState(0);
  s.districts = districts;
  s.cash = Number.MAX_SAFE_INTEGER;
  const foot = level >= 2 ? 2 : 1;
  const fit = (per) => Math.floor((districts * per) / foot);
  const cohort = (n) => {
    const levels = [0, 0, 0, 0, 0];
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
    mergedR: level >= 2 ? homes : 0,
    mergedC: level >= 2 ? shops : 0,
    mergedI: level >= 2 ? works : 0,
    occupancyR: OCCUPANCY_FULL,
    occupancyC: OCCUPANCY_FULL,
    occupancyI: OCCUPANCY_FULL,
    happiness: 1,
    parks: districts * 4,
    plants: Math.min(plants, districts),
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
  s.depotStaff = 1;
  return s;
}

const perDistrict0 =
  FRONTAGE_TARGET.residential * POWER_PER_PLOT.residential +
  FRONTAGE_TARGET.commercial * POWER_PER_PLOT.commercial +
  FRONTAGE_TARGET.industrial * POWER_PER_PLOT.industrial;

console.log(
  `power at exponent ${POWER_EXPONENT}, ${POWER_PER_PLANT} a plant, ${POWER_BASE} of grid\n`,
);
console.log(`a district at level 0 draws ${perDistrict0}`);
console.log(`the land holds ${FRONTAGE_TARGET.powerSites}.00 plants a district\n`);

/**
 * The measurement that picks the exponent. What a district needs, per rung, in
 * plants — against the one its square holds.
 */
console.log('plants a district needs, per exponent and rung');
console.log(`  exponent${LEVEL_NAMES.map((n) => n.slice(0, 6).padStart(8)).join('')}`);
for (const e of EXPONENTS) {
  const row = LEVEL_CAPACITY.map((capacity) => {
    const scale = capacity / LEVEL_CAPACITY[0];
    return ((perDistrict0 * scale ** e) / (POWER_PER_PLANT * scale)).toFixed(2).padStart(8);
  });
  const worst = Number(row[row.length - 1]);
  console.log(
    `  ${e.toFixed(2).padStart(8)}${row.join('')}${worst > FRONTAGE_TARGET.powerSites ? '   <- does not fit' : ''}`,
  );
}
console.log('');

/** What the grid actually reads on a city that has used every square it owns. */
console.log('supply ratio with every square built on');
console.log(`  districts${LEVEL_NAMES.map((n) => n.slice(0, 6).padStart(9)).join('')}`);
for (const districts of SIZES) {
  const row = LEVEL_CAPACITY.map((_, level) =>
    powerRatio(builtOut(districts, level, districts)).toFixed(2).padStart(9),
  );
  console.log(`  ${String(districts).padStart(9)}${row.join('')}`);
}
console.log('');

/**
 * The floor, checked against the line it has to stay above. A blacked-out but
 * otherwise happy city must sit over OCCUPANCY_EMPTY, or a brownout takes
 * buildings rather than residents and the failure stops being reversible.
 */
{
  const blackout = OCCUPANCY_FULL * POWER_FLOOR;
  console.log('the floor under the cap');
  console.log(
    `  a blacked-out but happy city settles at ${blackout.toFixed(3)} occupancy, ` +
      `against an OCCUPANCY_EMPTY of ${OCCUPANCY_EMPTY} ` +
      `— ${blackout > OCCUPANCY_EMPTY ? 'residents, not buildings' : 'IT ROTS'}`,
  );
  const dark = builtOut(12, 2, 0);
  console.log(
    `  a 12-district city of towers with no plants: ratio ${powerRatio(dark).toFixed(3)}, ` +
      `cap ${powerCap(dark).toFixed(3)}, occupancy target ${occupancyTarget(dark, 'home').toFixed(3)}`,
  );
  console.log('');
}

/**
 * When the grid first bites, played for real.
 *
 * Auto-development, exactly as the game plays it while you are away, once the
 * hall it is gated on is up — and auto-development buys plants, which is what
 * this is checking as much as when the shortfall arrives. A city left to run
 * itself into a brownout would come back emptier than it was left with nothing
 * on screen to say why.
 */
{
  const game = new Game(createState(0));
  let firstShort = null;
  let firstPlant = null;
  let worstRatio = Infinity;
  const marks = [];
  for (let t = 0; t < HOURS * 3600; t++) {
    const s = game.state;
    if (!s.cityHall) {
      if (s.cash >= 1_500) game.buildCityHall();
      else {
        let bought = true;
        while (bought) {
          bought = false;
          for (const service of SERVICES) {
            if (residents(s) > 0 && game.buildService(service)) bought = true;
          }
          if (!bought) bought = game.buildHome();
        }
      }
    } else if (!s.autoDevelop) game.setAutoDevelop(true);
    game.advance(1);
    const ratio = powerRatio(game.state);
    if (game.state.homes > 0) {
      if (firstShort === null && ratio < 1) firstShort = t;
      worstRatio = Math.min(worstRatio, ratio);
    }
    if (firstPlant === null && game.state.plants > 0) firstPlant = t;
    if (t === 3600 || t === 6 * 3600) marks.push([t, ratio, game.state.plants, game.state.districts]);
  }
  const s = game.state;
  console.log('played for real: auto-development, which buys plants when it is short');
  console.log(
    `  first short of power ${firstShort === null ? 'never' : `${(firstShort / 60).toFixed(1)}m`}, ` +
      `first plant ${firstPlant === null ? 'never' : `${(firstPlant / 60).toFixed(1)}m`}, ` +
      `worst ratio ${worstRatio.toFixed(2)}`,
  );
  for (const [t, ratio, plants, districts] of marks) {
    console.log(`  at ${t / 3600}h: ratio ${ratio.toFixed(2)}, ${plants} plants, ${districts} districts`);
  }
  console.log(
    `  after ${HOURS}h: ${s.plants} plants of ${s.districts} squares, ratio ` +
      `${powerRatio(s).toFixed(2)}, next plant ${plantCost(s).toExponential(2)} ` +
      `against a ledger of ${income(s).toExponential(2)}/s, ` +
      `wages ${pct(upkeep(s) / income(s))} of gross`,
  );
  console.log('');
}

/**
 * The failure that matters: a browned-out city has to be able to climb out.
 *
 * Every plant lost and no cash, on a city big enough to have been drawing a lot
 * — which is the state a player would reach by over-expanding and then running
 * out of squares, or by letting the wage bill decay the plants they had.
 */
{
  const game = new Game({ ...builtOut(12, 2, 0), cash: 0, plants: 0, plantStaff: 0 });
  const opening = powerRatio(game.state);
  const marks = [];
  for (let hour = 0; hour < 6; hour++) {
    for (let i = 0; i < 36000; i++) game.advance(0.1);
    marks.push([game.state.cash, game.state.occupancyR, powerRatio(game.state)]);
  }
  const s = game.state;
  console.log('climbing out: twelve districts of towers, no plants, no cash');
  console.log(`  opened at ratio ${opening.toFixed(3)}, cap ${powerCap(s).toFixed(3)}`);
  for (let i = 0; i < marks.length; i++) {
    const [cash, occupancy, ratio] = marks[i];
    console.log(
      `  ${i + 1}h: cash ${cash.toExponential(2)}, occupancy ${occupancy.toFixed(3)}, ` +
        `ratio ${ratio.toFixed(2)}, ${cash >= plantCost(s) ? 'can afford a plant' : 'cannot yet'}`,
    );
  }
  console.log(
    `  net ${netIncome(s).toExponential(2)}/s, population ${Math.round(population(s))}, ` +
      `abandoned ${s.abandonedR}`,
  );
  console.log('');
}

/** What one plant is worth on the biggest city the map allows. */
{
  const full = builtOut(MAX_DISTRICTS, 4, MAX_DISTRICTS);
  console.log('at the city limits, every square built on');
  console.log(
    `  draw ${powerDemand(full).toExponential(3)}, supply ${powerSupply(full).toExponential(3)}, ` +
      `ratio ${powerRatio(full).toFixed(2)}, cityScale ${cityScale(full).toFixed(0)}`,
  );
  console.log(
    `  the last plant costs ${plantCost({ ...full, plants: MAX_DISTRICTS - 1 }).toExponential(2)} ` +
      `against a ledger of ${income(full).toExponential(2)}/s`,
  );
}
