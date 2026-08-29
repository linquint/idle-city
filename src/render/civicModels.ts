import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * Everything in the city that is modelled rather than massed, as part tables.
 *
 * Eight of the ten are buildings on a reserved square and are drawn by
 * `buildings.ts`. The other two are not buildings: the park, a single plot with
 * nothing standing on it, drawn by `Parks` in `zones.ts`; and the bus, which is
 * drawn by `cars.ts` and is the only one of these that moves. They are in one
 * file because what they are is one thing — the output of the converter — and
 * what draws them is not.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/<name>.obj models/<name>.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word. If
 * a building needs to look different, the model changes and this is re-run.
 *
 * The converter recognises axis-aligned boxes and discs/rings and refuses
 * anything else, so what lands here is always something the renderer can
 * instance cheaply. A refusal is a modelling instruction, not a licence to
 * write geometry by hand — see `ModelPart`.
 *
 * Kept apart from `buildings.ts` because generated data and hand-written code
 * age differently: this file is replaced wholesale, and the finishes and
 * commentary that say how each surface is *drawn* must not be caught in that.
 */

/** The hospital: a ward slab, a treatment wing, and a working roof. */
export const HOSPITAL_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 1.65, -2], size: [7, 3.3, 3], mtl: 'clinic-white', colour: PALETTE.hospital }, // ward
  { shape: 'box', at: [0, 1, -2], size: [7.06, 0.36, 3.06], mtl: 'glazing', colour: PALETTE.parapet }, // ward-glazing
  { shape: 'box', at: [0, 2.12, -2], size: [7.06, 0.36, 3.06], mtl: 'glazing', colour: PALETTE.parapet }, // ward-glazing
  { shape: 'box', at: [0, 3.4, -2], size: [7.22, 0.22, 3.22], mtl: 'mint-roof', colour: PALETTE.hospitalRoof }, // ward-cap
  { shape: 'box', at: [-1, 0.825, 1.5], size: [5, 1.65, 4], mtl: 'clinic-white', colour: PALETTE.hospital }, // wing
  { shape: 'box', at: [-1, 0.82, 1.5], size: [5.06, 0.5, 4.06], mtl: 'glazing', colour: PALETTE.parapet }, // wing-glazing
  { shape: 'box', at: [-1, 1.74, 1.5], size: [5.2, 0.2, 4.2], mtl: 'mint-roof', colour: PALETTE.hospitalRoof }, // wing-cap
  { shape: 'box', at: [-1.7, 1.28, 3.2], size: [3.2, 0.2, 1.5], mtl: 'glazing', colour: PALETTE.parapet }, // entrance-canopy
  { shape: 'box', at: [-3.05, 0.64, 3.75], size: [0.22, 1.28, 0.22], mtl: 'clinic-white', colour: PALETTE.hospital }, // entrance-columns
  { shape: 'box', at: [-0.35, 0.64, 3.75], size: [0.22, 1.28, 0.22], mtl: 'clinic-white', colour: PALETTE.hospital }, // entrance-columns
  { shape: 'box', at: [2.4, 1.95, 1.35], size: [2.1, 0.16, 3.7], mtl: 'plant-grey', colour: PALETTE.stack }, // bay-canopy
  { shape: 'box', at: [2.4, 0.6, -0.44], size: [1.9, 1.15, 0.14], mtl: 'sodium-glow', colour: PALETTE.sodium }, // bay-doors
  { shape: 'box', at: [1.4, 3.62, -2], size: [2.9, 0.12, 2.9], mtl: 'deck-asphalt', colour: PALETTE.runway }, // helipad
  { shape: 'box', at: [0.82, 3.69, -2], size: [0.34, 0.06, 1.5], mtl: 'marking-white', colour: PALETTE.marking }, // helipad-mark
  { shape: 'box', at: [1.98, 3.69, -2], size: [0.34, 0.06, 1.5], mtl: 'marking-white', colour: PALETTE.marking }, // helipad-mark
  { shape: 'box', at: [1.4, 3.69, -2], size: [0.82, 0.06, 0.34], mtl: 'marking-white', colour: PALETTE.marking }, // helipad-mark
  { shape: 'box', at: [-2.5, 3.9, -2.9], size: [1.5, 0.62, 0.9], mtl: 'plant-grey', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [-2.5, 3.9, -1.5], size: [0.9, 0.62, 0.7], mtl: 'plant-grey', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [-0.7, 3.9, -2.6], size: [0.7, 0.62, 1.4], mtl: 'plant-grey', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [-1.2, 1.91, 1.4], size: [2.6, 0.07, 0.86], mtl: 'emergency-red', colour: PALETTE.emergency }, // cross
  { shape: 'box', at: [-1.2, 1.91, 1.4], size: [0.86, 0.07, 2.6], mtl: 'emergency-red', colour: PALETTE.emergency }, // cross
];

/** The fire station: an appliance hall, a dormitory block and a hose tower. */
export const FIRE_STATION_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 1.375, 1.55], size: [7, 2.75, 2.5], mtl: 'engine-brick', colour: PALETTE.fire }, // hall
  { shape: 'box', at: [-1.72, 1.11, 2.86], size: [2.66, 2.22, 0.12], mtl: 'trim-concrete', colour: PALETTE.concrete }, // door-surrounds
  { shape: 'box', at: [1.72, 1.11, 2.86], size: [2.66, 2.22, 0.12], mtl: 'trim-concrete', colour: PALETTE.concrete }, // door-surrounds
  { shape: 'box', at: [-1.72, 1, 2.93], size: [2.34, 2, 0.1], mtl: 'bay-door-light', colour: PALETTE.sodium }, // bay-doors
  { shape: 'box', at: [1.72, 1, 2.93], size: [2.34, 2, 0.1], mtl: 'bay-door-light', colour: PALETTE.sodium }, // bay-doors
  { shape: 'box', at: [0, 2.38, 1.55], size: [7.12, 0.24, 2.62], mtl: 'trim-concrete', colour: PALETTE.concrete }, // hall-stripe
  { shape: 'box', at: [0, 2.86, 1.55], size: [7.24, 0.24, 2.74], mtl: 'roof-red', colour: PALETTE.fireRoof }, // hall-cap
  { shape: 'box', at: [-0.55, 1.525, -1.65], size: [5.9, 3.05, 3.7], mtl: 'engine-brick', colour: PALETTE.fire }, // dorm
  { shape: 'box', at: [-0.55, 1, -1.65], size: [5.96, 0.34, 3.76], mtl: 'glazing', colour: PALETTE.parapet }, // dorm-glazing
  { shape: 'box', at: [-0.55, 2.1, -1.65], size: [5.96, 0.34, 3.76], mtl: 'glazing', colour: PALETTE.parapet }, // dorm-glazing
  { shape: 'box', at: [-0.55, 3.15, -1.65], size: [6.12, 0.22, 3.92], mtl: 'roof-red', colour: PALETTE.fireRoof }, // dorm-cap
  { shape: 'box', at: [2.75, 2.65, -2.5], size: [1.3, 5.3, 1.3], mtl: 'engine-brick', colour: PALETTE.fire }, // hose-tower
  { shape: 'box', at: [2.75, 2.45, -2.5], size: [0.42, 3.9, 1.38], mtl: 'glazing', colour: PALETTE.parapet }, // tower-glazing
  { shape: 'box', at: [2.75, 5.4, -2.5], size: [1.54, 0.22, 1.54], mtl: 'roof-red', colour: PALETTE.fireRoof }, // tower-cap
  { shape: 'box', at: [2.75, 5.68, -2.5], size: [0.44, 0.34, 0.44], mtl: 'beacon-red', colour: PALETTE.fireRoof }, // beacon
  { shape: 'box', at: [0, 0.04, 3.14], size: [7, 0.08, 0.72], mtl: 'apron-asphalt', colour: PALETTE.runway }, // apron
  { shape: 'box', at: [-1.72, 0.09, 3.14], size: [0.16, 0.1, 0.68], mtl: 'marking-white', colour: PALETTE.marking }, // apron-stripes
  { shape: 'box', at: [1.72, 0.09, 3.14], size: [0.16, 0.1, 0.68], mtl: 'marking-white', colour: PALETTE.marking }, // apron-stripes
  { shape: 'box', at: [-2.4, 3.525, -2.9], size: [1.3, 0.55, 0.8], mtl: 'plant-grey', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [-0.9, 3.525, -3], size: [0.7, 0.55, 0.6], mtl: 'plant-grey', colour: PALETTE.stack }, // roof-plant
];

/** The transit depot: a bus shed, a canopied apron, and the yard it serves. */
export const BUS_DEPOT_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 1.2, -2.25], size: [7, 2.4, 2.5], mtl: 'depot-teal', colour: PALETTE.depot }, // shed
  { shape: 'box', at: [0, 1.72, -2.25], size: [7.06, 0.42, 2.56], mtl: 'glazing', colour: PALETTE.parapet }, // shed-glazing
  { shape: 'box', at: [0, 2.51, -2.25], size: [7.24, 0.24, 2.74], mtl: 'livery-lime', colour: PALETTE.depotRoof }, // shed-cap
  { shape: 'box', at: [0, 0.03, 1.2], size: [7, 0.06, 4.6], mtl: 'apron-asphalt', colour: PALETTE.runway }, // apron
  { shape: 'box', at: [-3.3, 0.05, 1.2], size: [0.12, 0.03, 3.7], mtl: 'marking-white', colour: PALETTE.marking }, // apron-markings
  { shape: 'box', at: [-1.7, 0.05, 1.2], size: [0.12, 0.03, 3.7], mtl: 'marking-white', colour: PALETTE.marking }, // apron-markings
  { shape: 'box', at: [-0.1, 0.05, 1.2], size: [0.12, 0.03, 3.7], mtl: 'marking-white', colour: PALETTE.marking }, // apron-markings
  { shape: 'box', at: [1.5, 0.05, 1.2], size: [0.12, 0.03, 3.7], mtl: 'marking-white', colour: PALETTE.marking }, // apron-markings
  { shape: 'box', at: [-1, 0.05, -0.72], size: [4.8, 0.03, 0.14], mtl: 'marking-white', colour: PALETTE.marking }, // apron-markings
  { shape: 'box', at: [-2.5, 0.61, 1.05], size: [1.15, 1.1, 3.2], mtl: 'bus-green', colour: PALETTE.bus }, // buses
  { shape: 'box', at: [-0.9, 0.61, 1.05], size: [1.15, 1.1, 3.2], mtl: 'bus-green', colour: PALETTE.bus }, // buses
  { shape: 'box', at: [0.7, 0.61, 1.05], size: [1.15, 1.1, 3.2], mtl: 'bus-green', colour: PALETTE.bus }, // buses
  { shape: 'box', at: [-2.5, 0.91, 1.05], size: [1.19, 0.36, 3.16], mtl: 'glazing', colour: PALETTE.parapet }, // bus-glazing
  { shape: 'box', at: [-0.9, 0.91, 1.05], size: [1.19, 0.36, 3.16], mtl: 'glazing', colour: PALETTE.parapet }, // bus-glazing
  { shape: 'box', at: [0.7, 0.91, 1.05], size: [1.19, 0.36, 3.16], mtl: 'glazing', colour: PALETTE.parapet }, // bus-glazing
  { shape: 'box', at: [-2.5, 0.37, 1.05], size: [1.19, 0.16, 3.16], mtl: 'livery-lime', colour: PALETTE.depotRoof }, // bus-livery
  { shape: 'box', at: [-0.9, 0.37, 1.05], size: [1.19, 0.16, 3.16], mtl: 'livery-lime', colour: PALETTE.depotRoof }, // bus-livery
  { shape: 'box', at: [0.7, 0.37, 1.05], size: [1.19, 0.16, 3.16], mtl: 'livery-lime', colour: PALETTE.depotRoof }, // bus-livery
  { shape: 'box', at: [-0.65, 2.05, 0], size: [5.7, 0.18, 1.7], mtl: 'plant-grey', colour: PALETTE.stack }, // canopy
  { shape: 'box', at: [-3.2, 1.025, -0.7], size: [0.2, 2.05, 0.2], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [1.9, 1.025, -0.7], size: [0.2, 2.05, 0.2], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [-3.2, 1.025, 0.7], size: [0.2, 2.05, 0.2], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [1.9, 1.025, 0.7], size: [0.2, 2.05, 0.2], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [2.55, 0.95, 1.5], size: [0.16, 1.9, 0.16], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [2.55, 0.95, 3.1], size: [0.16, 1.9, 0.16], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [-0.65, 1.89, 0.76], size: [5.2, 0.1, 0.16], mtl: 'bay-light', colour: PALETTE.sodium }, // bay-lights
  { shape: 'box', at: [2.9, 0.53, 2.3], size: [0.8, 1, 1.1], mtl: 'depot-teal', colour: PALETTE.depot }, // fuel-pump
  { shape: 'box', at: [2.75, 1.95, 2.3], size: [1.5, 0.16, 2.2], mtl: 'plant-grey', colour: PALETTE.stack }, // fuel-canopy
  { shape: 'box', at: [-3.15, 1.65, 3.25], size: [0.26, 3.3, 0.26], mtl: 'trim-concrete', colour: PALETTE.concrete }, // pylon
  { shape: 'box', at: [-3.15, 3.05, 3.25], size: [1, 0.68, 0.14], mtl: 'livery-lime', colour: PALETTE.depotRoof }, // pylon-sign
  { shape: 'box', at: [-2.1, 2.9, -3], size: [1.2, 0.56, 0.8], mtl: 'plant-grey', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [-0.5, 2.9, -2.9], size: [0.7, 0.56, 0.6], mtl: 'plant-grey', colour: PALETTE.stack }, // roof-plant
];

/** The police station: a banded block, a cell wing, and the yard behind them. */
export const POLICE_STATION_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-0.95, 1.3, 1.5], size: [5.1, 2.6, 4], mtl: 'station-navy', colour: PALETTE.police }, // station
  { shape: 'box', at: [-0.95, 1, 1.5], size: [5.16, 0.16, 4.06], mtl: 'band-stone', colour: PALETTE.kerb }, // station-banding
  { shape: 'box', at: [-0.95, 2, 1.5], size: [5.16, 0.16, 4.06], mtl: 'band-stone', colour: PALETTE.kerb }, // station-banding
  { shape: 'box', at: [-0.95, 2.42, 1.5], size: [5.14, 0.36, 4.04], mtl: 'police-blue', colour: PALETTE.policeRoof }, // head-band
  { shape: 'box', at: [-0.95, 2.68, 1.5], size: [5.1, 0.16, 4], mtl: 'mast-grey', colour: PALETTE.stack }, // roof-slab
  { shape: 'box', at: [-0.95, 0.07, 3.72], size: [2.4, 0.14, 0.4], mtl: 'trim-concrete', colour: PALETTE.concrete }, // entrance-steps
  { shape: 'box', at: [-0.95, 0.21, 3.58], size: [2.1, 0.14, 0.36], mtl: 'trim-concrete', colour: PALETTE.concrete }, // entrance-steps
  { shape: 'box', at: [-0.95, 0.9, 3.53], size: [1.6, 1.6, 0.1], mtl: 'glazing', colour: PALETTE.parapet }, // entrance-door
  { shape: 'box', at: [-0.95, 2.1, 3.54], size: [2.3, 0.18, 0.8], mtl: 'trim-concrete', colour: PALETTE.concrete }, // entrance-canopy
  { shape: 'box', at: [-1.65, 0.95, -2.05], size: [3.7, 1.9, 2.9], mtl: 'station-navy', colour: PALETTE.police }, // cells
  { shape: 'box', at: [-1.65, 1.45, -2.05], size: [3.76, 0.3, 2.96], mtl: 'glazing', colour: PALETTE.parapet }, // cells-clerestory
  { shape: 'box', at: [-1.65, 2, -2.05], size: [3.92, 0.22, 3.12], mtl: 'police-blue', colour: PALETTE.policeRoof }, // cells-cap
  { shape: 'box', at: [1.95, 0.03, -2.05], size: [3.1, 0.06, 2.9], mtl: 'yard-asphalt', colour: PALETTE.runway }, // yard
  { shape: 'box', at: [1.95, 0.35, -3.42], size: [3.1, 0.7, 0.16], mtl: 'trim-concrete', colour: PALETTE.concrete }, // yard-wall-back
  { shape: 'box', at: [3.42, 0.35, -2.05], size: [0.16, 0.7, 2.9], mtl: 'trim-concrete', colour: PALETTE.concrete }, // yard-wall-east
  { shape: 'box', at: [0.48, 0.35, -2.8], size: [0.16, 0.7, 1.4], mtl: 'trim-concrete', colour: PALETTE.concrete }, // yard-wall-west
  { shape: 'box', at: [1.35, 0.37, -2.1], size: [0.95, 0.62, 2.1], mtl: 'patrol-white', colour: PALETTE.marking }, // patrol-cars
  { shape: 'box', at: [2.75, 0.37, -2.1], size: [0.95, 0.62, 2.1], mtl: 'patrol-white', colour: PALETTE.marking }, // patrol-cars
  { shape: 'box', at: [1.35, 0.6, -2.35], size: [0.99, 0.26, 1.05], mtl: 'glazing', colour: PALETTE.parapet }, // car-glazing
  { shape: 'box', at: [2.75, 0.6, -2.35], size: [0.99, 0.26, 1.05], mtl: 'glazing', colour: PALETTE.parapet }, // car-glazing
  { shape: 'box', at: [0.9, 4.46, 2.6], size: [0.16, 3.4, 0.16], mtl: 'mast-grey', colour: PALETTE.stack }, // mast
  { shape: 'box', at: [0.9, 5.56, 2.6], size: [1.3, 0.1, 0.1], mtl: 'mast-grey', colour: PALETTE.stack }, // mast
  { shape: 'box', at: [0.9, 5.06, 2.6], size: [0.1, 0.1, 1], mtl: 'mast-grey', colour: PALETTE.stack }, // mast
  { shape: 'box', at: [-2.4, 2.9, 1], size: [1.2, 0.28, 0.8], mtl: 'mast-grey', colour: PALETTE.stack }, // mast
  { shape: 'box', at: [-2.4, 2.9, 2.6], size: [0.7, 0.28, 0.7], mtl: 'mast-grey', colour: PALETTE.stack }, // mast
  { shape: 'box', at: [-0.95, 1.86, 3.58], size: [0.34, 0.36, 0.26], mtl: 'signal-blue', colour: PALETTE.policeRoof }, // blue-lights
  { shape: 'box', at: [0.9, 6.28, 2.6], size: [0.2, 0.24, 0.2], mtl: 'signal-blue', colour: PALETTE.policeRoof }, // blue-lights
  { shape: 'box', at: [1.35, 0.76, -2.35], size: [0.6, 0.1, 0.22], mtl: 'signal-blue', colour: PALETTE.policeRoof }, // blue-lights
  { shape: 'box', at: [2.75, 0.76, -2.35], size: [0.6, 0.1, 0.22], mtl: 'signal-blue', colour: PALETTE.policeRoof }, // blue-lights
];

/** The museum: a colonnaded hall between two wings, on a stone plinth. */
export const MUSEUM_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.25, 0], size: [7, 0.5, 7], mtl: 'plinth-grey', colour: PALETTE.kerb }, // plinth
  { shape: 'box', at: [-2.55, 1.7, -0.4], size: [1.7, 2.4, 5.6], mtl: 'landmark-stone', colour: PALETTE.landmark }, // wings
  { shape: 'box', at: [2.55, 1.7, -0.4], size: [1.7, 2.4, 5.6], mtl: 'landmark-stone', colour: PALETTE.landmark }, // wings
  { shape: 'box', at: [0, 2.3, -0.4], size: [3.4, 3.6, 5.6], mtl: 'landmark-stone', colour: PALETTE.landmark }, // hall
  { shape: 'box', at: [0, 4.22, -0.4], size: [3.64, 0.24, 5.84], mtl: 'cornice-brown', colour: PALETTE.landmarkRoof }, // cornice
  { shape: 'box', at: [-2.55, 3.02, -0.4], size: [1.94, 0.24, 5.84], mtl: 'cornice-brown', colour: PALETTE.landmarkRoof }, // cornice
  { shape: 'box', at: [2.55, 3.02, -0.4], size: [1.94, 0.24, 5.84], mtl: 'cornice-brown', colour: PALETTE.landmarkRoof }, // cornice
  { shape: 'box', at: [0, 3.7, 3.1], size: [4.6, 0.3, 1.5], mtl: 'cornice-brown', colour: PALETTE.landmarkRoof }, // portico-roof
  { shape: 'box', at: [-1.9, 2.025, 3.5], size: [0.36, 3.05, 0.36], mtl: 'landmark-stone', colour: PALETTE.landmark }, // columns
  { shape: 'box', at: [-0.64, 2.025, 3.5], size: [0.36, 3.05, 0.36], mtl: 'landmark-stone', colour: PALETTE.landmark }, // columns
  { shape: 'box', at: [0.64, 2.025, 3.5], size: [0.36, 3.05, 0.36], mtl: 'landmark-stone', colour: PALETTE.landmark }, // columns
  { shape: 'box', at: [1.9, 2.025, 3.5], size: [0.36, 3.05, 0.36], mtl: 'landmark-stone', colour: PALETTE.landmark }, // columns
  { shape: 'box', at: [0, 0.1, 3.8], size: [5, 0.2, 0.28], mtl: 'plinth-grey', colour: PALETTE.kerb }, // steps
  { shape: 'box', at: [0, 0.3, 3.62], size: [4.6, 0.2, 0.28], mtl: 'plinth-grey', colour: PALETTE.kerb }, // steps
  { shape: 'box', at: [0, 1.3, 2.44], size: [1.8, 1.6, 0.12], mtl: 'glazing', colour: PALETTE.parapet }, // entrance-door
  { shape: 'box', at: [-2.95, 1.7, 2.44], size: [0.5, 1.4, 0.12], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.15, 1.7, 2.44], size: [0.5, 1.4, 0.12], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.15, 1.7, 2.44], size: [0.5, 1.4, 0.12], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.95, 1.7, 2.44], size: [0.5, 1.4, 0.12], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 1.7, -2], size: [0.12, 1.4, 0.5], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 1.7, -0.4], size: [0.12, 1.4, 0.5], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 1.7, 1.2], size: [0.12, 1.4, 0.5], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 1.7, -2], size: [0.12, 1.4, 0.5], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 1.7, -0.4], size: [0.12, 1.4, 0.5], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 1.7, 1.2], size: [0.12, 1.4, 0.5], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 4.9, -0.4], size: [2.2, 1.1, 2.2], mtl: 'lantern-light', colour: PALETTE.sodium }, // lantern
  { shape: 'box', at: [0, 5.56, -0.4], size: [2.5, 0.22, 2.5], mtl: 'cornice-brown', colour: PALETTE.landmarkRoof }, // lantern-cap
];

/** The stadium: a bowl of stands around a marked pitch, under four masts. */
export const STADIUM_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.15, 0], size: [11.4, 0.3, 11.4], mtl: 'seating-grey', colour: PALETTE.kerb }, // concourse
  { shape: 'box', at: [0, 0.35, 0], size: [7, 0.1, 7], mtl: 'pitch-green', colour: PALETTE.park }, // pitch
  { shape: 'box', at: [0, 0.41, -3.2], size: [6.4, 0.02, 0.12], mtl: 'marking-white', colour: PALETTE.marking }, // pitch-markings
  { shape: 'box', at: [0, 0.41, 3.2], size: [6.4, 0.02, 0.12], mtl: 'marking-white', colour: PALETTE.marking }, // pitch-markings
  { shape: 'box', at: [-3.2, 0.41, 0], size: [0.12, 0.02, 6.4], mtl: 'marking-white', colour: PALETTE.marking }, // pitch-markings
  { shape: 'box', at: [3.2, 0.41, 0], size: [0.12, 0.02, 6.4], mtl: 'marking-white', colour: PALETTE.marking }, // pitch-markings
  { shape: 'box', at: [0, 0.41, 0], size: [6.4, 0.02, 0.12], mtl: 'marking-white', colour: PALETTE.marking }, // pitch-markings
  { shape: 'box', at: [0, 1.6, -4.85], size: [11, 2.6, 1.3], mtl: 'landmark-stone', colour: PALETTE.landmark }, // stands-back
  { shape: 'box', at: [0, 1.6, 4.85], size: [11, 2.6, 1.3], mtl: 'landmark-stone', colour: PALETTE.landmark }, // stands-front
  { shape: 'box', at: [-4.85, 1.6, 0], size: [1.3, 2.6, 8.4], mtl: 'landmark-stone', colour: PALETTE.landmark }, // stands-west
  { shape: 'box', at: [4.85, 1.6, 0], size: [1.3, 2.6, 8.4], mtl: 'landmark-stone', colour: PALETTE.landmark }, // stands-east
  { shape: 'box', at: [0, 0.95, -3.85], size: [8.4, 1.3, 0.7], mtl: 'seating-grey', colour: PALETTE.kerb }, // tiers-back
  { shape: 'box', at: [0, 0.95, 3.85], size: [8.4, 1.3, 0.7], mtl: 'seating-grey', colour: PALETTE.kerb }, // tiers-front
  { shape: 'box', at: [-3.85, 0.95, 0], size: [0.7, 1.3, 7], mtl: 'seating-grey', colour: PALETTE.kerb }, // tiers-west
  { shape: 'box', at: [3.85, 0.95, 0], size: [0.7, 1.3, 7], mtl: 'seating-grey', colour: PALETTE.kerb }, // tiers-east
  { shape: 'box', at: [0, 2.1, -4.85], size: [11.08, 0.26, 1.38], mtl: 'roof-brown', colour: PALETTE.landmarkRoof }, // facade-band
  { shape: 'box', at: [0, 2.1, 4.85], size: [11.08, 0.26, 1.38], mtl: 'roof-brown', colour: PALETTE.landmarkRoof }, // facade-band
  { shape: 'box', at: [-4.85, 2.1, 0], size: [1.38, 0.26, 8.48], mtl: 'roof-brown', colour: PALETTE.landmarkRoof }, // facade-band
  { shape: 'box', at: [4.85, 2.1, 0], size: [1.38, 0.26, 8.48], mtl: 'roof-brown', colour: PALETTE.landmarkRoof }, // facade-band
  { shape: 'box', at: [0, 3.02, -4.55], size: [11, 0.24, 1.9], mtl: 'roof-brown', colour: PALETTE.landmarkRoof }, // canopies
  { shape: 'box', at: [0, 3.02, 4.55], size: [11, 0.24, 1.9], mtl: 'roof-brown', colour: PALETTE.landmarkRoof }, // canopies
  { shape: 'box', at: [-4.55, 3.02, 0], size: [1.9, 0.24, 8.4], mtl: 'roof-brown', colour: PALETTE.landmarkRoof }, // canopies
  { shape: 'box', at: [4.55, 3.02, 0], size: [1.9, 0.24, 8.4], mtl: 'roof-brown', colour: PALETTE.landmarkRoof }, // canopies
  { shape: 'box', at: [-2.6, 1, 5.46], size: [1.4, 1.4, 0.14], mtl: 'gate-dark', colour: PALETTE.parapet }, // gates
  { shape: 'box', at: [0, 1, 5.46], size: [1.4, 1.4, 0.14], mtl: 'gate-dark', colour: PALETTE.parapet }, // gates
  { shape: 'box', at: [2.6, 1, 5.46], size: [1.4, 1.4, 0.14], mtl: 'gate-dark', colour: PALETTE.parapet }, // gates
  { shape: 'box', at: [-4.9, 3.55, -4.9], size: [0.5, 6.5, 0.5], mtl: 'mast-grey', colour: PALETTE.stack }, // masts
  { shape: 'box', at: [4.9, 3.55, -4.9], size: [0.5, 6.5, 0.5], mtl: 'mast-grey', colour: PALETTE.stack }, // masts
  { shape: 'box', at: [-4.9, 3.55, 4.9], size: [0.5, 6.5, 0.5], mtl: 'mast-grey', colour: PALETTE.stack }, // masts
  { shape: 'box', at: [4.9, 3.55, 4.9], size: [0.5, 6.5, 0.5], mtl: 'mast-grey', colour: PALETTE.stack }, // masts
  { shape: 'box', at: [-4.9, 6.9, -4.9], size: [1, 0.4, 0.7], mtl: 'floodlight', colour: PALETTE.sodium }, // floodlights
  { shape: 'box', at: [4.9, 6.9, -4.9], size: [1, 0.4, 0.7], mtl: 'floodlight', colour: PALETTE.sodium }, // floodlights
  { shape: 'box', at: [-4.9, 6.9, 4.9], size: [1, 0.4, 0.7], mtl: 'floodlight', colour: PALETTE.sodium }, // floodlights
  { shape: 'box', at: [4.9, 6.9, 4.9], size: [1, 0.4, 0.7], mtl: 'floodlight', colour: PALETTE.sodium }, // floodlights
];

/** The school: a teaching hall, a gym, and the playground between them. */
export const SCHOOL_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.9, -1.9], size: [7, 1.8, 3.2], mtl: 'school-stone', colour: PALETTE.school }, // hall
  { shape: 'box', at: [0, 1.1, -1.9], size: [7.06, 0.62, 3.26], mtl: 'glazing', colour: PALETTE.parapet }, // hall-glazing
  { shape: 'box', at: [0, 1.91, -1.9], size: [7.22, 0.22, 3.42], mtl: 'school-roof', colour: PALETTE.schoolRoof }, // hall-roof
  { shape: 'box', at: [0, 2.18, -1.9], size: [4.6, 0.3, 0.66], mtl: 'clerestory-light', colour: PALETTE.sodium }, // clerestory
  { shape: 'box', at: [-2.25, 1.3, 0.9], size: [2.5, 2.6, 2.4], mtl: 'school-stone', colour: PALETTE.school }, // gym
  { shape: 'box', at: [-2.25, 1.85, 0.9], size: [2.56, 0.42, 2.46], mtl: 'glazing', colour: PALETTE.parapet }, // gym-glazing
  { shape: 'box', at: [-2.25, 2.7, 0.9], size: [2.7, 0.2, 2.6], mtl: 'school-roof', colour: PALETTE.schoolRoof }, // gym-roof
  { shape: 'box', at: [1.4, 0.85, -0.24], size: [1.7, 1.5, 0.12], mtl: 'glazing', colour: PALETTE.parapet }, // entrance
  { shape: 'box', at: [1.4, 1.72, 0.1], size: [2.6, 0.16, 1.6], mtl: 'trim-grey', colour: PALETTE.kerb }, // entrance-canopy
  { shape: 'box', at: [0.35, 0.82, 0.78], size: [0.14, 1.64, 0.14], mtl: 'trim-grey', colour: PALETTE.kerb }, // entrance-canopy
  { shape: 'box', at: [2.45, 0.82, 0.78], size: [0.14, 1.64, 0.14], mtl: 'trim-grey', colour: PALETTE.kerb }, // entrance-canopy
  { shape: 'box', at: [0.65, 0.04, 1.85], size: [5.6, 0.08, 3.1], mtl: 'yard-asphalt', colour: PALETTE.asphalt }, // playground
  { shape: 'box', at: [0.65, 0.09, 0.45], size: [5.2, 0.03, 0.1], mtl: 'marking-white', colour: PALETTE.marking }, // court-lines-back
  { shape: 'box', at: [0.65, 0.09, 3.25], size: [5.2, 0.03, 0.1], mtl: 'marking-white', colour: PALETTE.marking }, // court-lines-front
  { shape: 'box', at: [-1.9, 0.09, 1.85], size: [0.1, 0.03, 2.9], mtl: 'marking-white', colour: PALETTE.marking }, // court-lines-west
  { shape: 'box', at: [3.2, 0.09, 1.85], size: [0.1, 0.03, 2.9], mtl: 'marking-white', colour: PALETTE.marking }, // court-lines-east
  { shape: 'box', at: [0.65, 0.09, 1.85], size: [5.2, 0.03, 0.1], mtl: 'marking-white', colour: PALETTE.marking }, // court-halfway
  { shape: 'box', at: [-1.75, 0.85, 1.85], size: [0.12, 1.7, 0.12], mtl: 'trim-grey', colour: PALETTE.kerb }, // hoops
  { shape: 'box', at: [-1.75, 1.6, 1.85], size: [0.08, 0.42, 0.62], mtl: 'trim-grey', colour: PALETTE.kerb }, // hoops
  { shape: 'box', at: [3.05, 0.85, 1.85], size: [0.12, 1.7, 0.12], mtl: 'trim-grey', colour: PALETTE.kerb }, // hoops
  { shape: 'box', at: [3.05, 1.6, 1.85], size: [0.08, 0.42, 0.62], mtl: 'trim-grey', colour: PALETTE.kerb }, // hoops
  { shape: 'box', at: [0.65, 0.25, 3.44], size: [5.9, 0.45, 0.3], mtl: 'hedge-green', colour: PALETTE.hedge }, // hedge
  { shape: 'box', at: [3.44, 0.25, 1.9], size: [0.3, 0.45, 3.4], mtl: 'hedge-green', colour: PALETTE.hedge }, // hedge
];

/**
 * A park: a lawn with paths across it, planting, a pond, three trees, two
 * benches and a lamp.
 *
 * The one modelled thing in the city that is not a building and does not stand
 * on a reserved square — it is a single plot, and the model is drawn to the
 * 3.2-unit pad `PAD` already gave it. Drawn by `Parks` rather than `Buildings`.
 */
export const PARK_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.05, 0], size: [3.2, 0.1, 3.2], mtl: 'park-lawn', colour: PALETTE.park }, // lawn
  { shape: 'box', at: [0, 0.12, 0], size: [3.2, 0.06, 0.62], mtl: 'park-path', colour: PALETTE.sand }, // paths
  { shape: 'box', at: [0.15, 0.12, 0], size: [0.62, 0.06, 3.2], mtl: 'park-path', colour: PALETTE.sand }, // paths
  { shape: 'box', at: [-1.02, 0.15, -1.02], size: [0.9, 0.12, 0.9], mtl: 'planting-bed', colour: PALETTE.courtyard }, // planting-beds
  { shape: 'box', at: [1.08, 0.15, 1.08], size: [0.72, 0.12, 0.72], mtl: 'planting-bed', colour: PALETTE.courtyard }, // planting-beds
  { shape: 'box', at: [-0.95, 0.13, 0.98], size: [1, 0.08, 0.86], mtl: 'pond-water', colour: PALETTE.water }, // pond
  { shape: 'box', at: [-1, 0.334, 1], size: [0.16, 0.468, 0.16], mtl: 'tree-trunk', colour: PALETTE.trunk }, // tree-trunks
  { shape: 'box', at: [0.95, 0.399, -0.9], size: [0.16, 0.598, 0.16], mtl: 'tree-trunk', colour: PALETTE.trunk }, // tree-trunks
  { shape: 'box', at: [0.7, 0.303, 1.05], size: [0.16, 0.406, 0.16], mtl: 'tree-trunk', colour: PALETTE.trunk }, // tree-trunks
  { shape: 'box', at: [-1, 0.748, 1], size: [0.648, 0.36, 0.648], mtl: 'tree-canopy', colour: PALETTE.canopy }, // tree-canopies
  { shape: 'box', at: [-1, 1.072, 1], size: [0.396, 0.288, 0.396], mtl: 'tree-canopy', colour: PALETTE.canopy }, // tree-canopies
  { shape: 'box', at: [0.95, 0.928, -0.9], size: [0.828, 0.46, 0.828], mtl: 'tree-canopy', colour: PALETTE.canopy }, // tree-canopies
  { shape: 'box', at: [0.95, 1.342, -0.9], size: [0.506, 0.368, 0.506], mtl: 'tree-canopy', colour: PALETTE.canopy }, // tree-canopies
  { shape: 'box', at: [0.7, 0.662, 1.05], size: [0.562, 0.312, 0.562], mtl: 'tree-canopy', colour: PALETTE.canopy }, // tree-canopies
  { shape: 'box', at: [0.7, 0.942, 1.05], size: [0.343, 0.25, 0.343], mtl: 'tree-canopy', colour: PALETTE.canopy }, // tree-canopies
  { shape: 'box', at: [-0.62, 0.32, -0.52], size: [0.7, 0.08, 0.22], mtl: 'bench-grey', colour: PALETTE.kerb }, // benches
  { shape: 'box', at: [-0.62, 0.21, -0.52], size: [0.6, 0.14, 0.1], mtl: 'bench-grey', colour: PALETTE.kerb }, // benches
  { shape: 'box', at: [0.62, 0.32, 0.52], size: [0.7, 0.08, 0.22], mtl: 'bench-grey', colour: PALETTE.kerb }, // benches
  { shape: 'box', at: [0.62, 0.21, 0.52], size: [0.6, 0.14, 0.1], mtl: 'bench-grey', colour: PALETTE.kerb }, // benches
  { shape: 'box', at: [1.42, 0.75, -1.42], size: [0.1, 1.3, 0.1], mtl: 'bench-grey', colour: PALETTE.kerb }, // lamp-post
  { shape: 'box', at: [1.42, 1.45, -1.42], size: [0.24, 0.14, 0.24], mtl: 'lamp-light', colour: PALETTE.sodium }, // lamp-head
];

/** The university: four ranges round a quad, with a campanile on one corner. */
export const CAMPUS_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.15, 0], size: [11.4, 0.3, 11.4], mtl: 'trim-grey', colour: PALETTE.kerb }, // terrace
  { shape: 'box', at: [0, 0.36, 0.1], size: [6.6, 0.12, 6.8], mtl: 'quad-lawn', colour: PALETTE.park }, // quad-lawn
  { shape: 'box', at: [0, 0.44, 0.1], size: [6.6, 0.08, 0.8], mtl: 'quad-path', colour: PALETTE.sand }, // quad-paths
  { shape: 'box', at: [0, 0.44, 0.1], size: [0.8, 0.08, 6.8], mtl: 'quad-path', colour: PALETTE.sand }, // quad-paths
  { shape: 'box', at: [0, 2, -4.4], size: [11, 3.4, 2.2], mtl: 'campus-stone', colour: PALETTE.university }, // range-back
  { shape: 'box', at: [0, 1.8, 4.5], size: [11, 3, 2], mtl: 'campus-stone', colour: PALETTE.university }, // range-front
  { shape: 'box', at: [-4.4, 1.8, 0.1], size: [2.2, 3, 6.8], mtl: 'campus-stone', colour: PALETTE.university }, // range-west
  { shape: 'box', at: [4.4, 1.8, 0.1], size: [2.2, 3, 6.8], mtl: 'campus-stone', colour: PALETTE.university }, // range-east
  { shape: 'box', at: [0, 1.5, -4.4], size: [11.06, 0.5, 2.26], mtl: 'glazing', colour: PALETTE.parapet }, // range-glazing
  { shape: 'box', at: [0, 2.6, -4.4], size: [11.06, 0.5, 2.26], mtl: 'glazing', colour: PALETTE.parapet }, // range-glazing
  { shape: 'box', at: [0, 1.5, 4.5], size: [11.06, 0.5, 2.06], mtl: 'glazing', colour: PALETTE.parapet }, // range-glazing
  { shape: 'box', at: [-4.4, 1.5, 0.1], size: [2.26, 0.5, 6.86], mtl: 'glazing', colour: PALETTE.parapet }, // range-glazing
  { shape: 'box', at: [4.4, 1.5, 0.1], size: [2.26, 0.5, 6.86], mtl: 'glazing', colour: PALETTE.parapet }, // range-glazing
  { shape: 'box', at: [0, 3.8, -4.4], size: [11.12, 0.2, 2.32], mtl: 'campus-roof', colour: PALETTE.universityRoof }, // range-caps
  { shape: 'box', at: [0, 3.4, 4.5], size: [11.12, 0.2, 2.12], mtl: 'campus-roof', colour: PALETTE.universityRoof }, // range-caps
  { shape: 'box', at: [-4.4, 3.4, 0.1], size: [2.32, 0.2, 6.92], mtl: 'campus-roof', colour: PALETTE.universityRoof }, // range-caps
  { shape: 'box', at: [4.4, 3.4, 0.1], size: [2.32, 0.2, 6.92], mtl: 'campus-roof', colour: PALETTE.universityRoof }, // range-caps
  { shape: 'box', at: [-3.6, 1.35, 3.3], size: [0.34, 2.1, 0.34], mtl: 'campus-stone', colour: PALETTE.university }, // colonnade
  { shape: 'box', at: [-2.16, 1.35, 3.3], size: [0.34, 2.1, 0.34], mtl: 'campus-stone', colour: PALETTE.university }, // colonnade
  { shape: 'box', at: [-0.72, 1.35, 3.3], size: [0.34, 2.1, 0.34], mtl: 'campus-stone', colour: PALETTE.university }, // colonnade
  { shape: 'box', at: [0.72, 1.35, 3.3], size: [0.34, 2.1, 0.34], mtl: 'campus-stone', colour: PALETTE.university }, // colonnade
  { shape: 'box', at: [2.16, 1.35, 3.3], size: [0.34, 2.1, 0.34], mtl: 'campus-stone', colour: PALETTE.university }, // colonnade
  { shape: 'box', at: [3.6, 1.35, 3.3], size: [0.34, 2.1, 0.34], mtl: 'campus-stone', colour: PALETTE.university }, // colonnade
  { shape: 'box', at: [0, 2.48, 3.3], size: [8, 0.16, 0.62], mtl: 'campus-stone', colour: PALETTE.university }, // colonnade-cap
  { shape: 'box', at: [0, 1.35, 5.44], size: [1.8, 2.1, 0.14], mtl: 'glazing', colour: PALETTE.parapet }, // gateway
  { shape: 'box', at: [0, 2.7, 5.42], size: [2.6, 0.3, 0.24], mtl: 'campus-roof', colour: PALETTE.universityRoof }, // gateway-pediment
  { shape: 'box', at: [-4.15, 5.05, -4.15], size: [2.6, 9.5, 2.6], mtl: 'campus-stone', colour: PALETTE.university }, // campanile
  { shape: 'box', at: [-4.15, 8.7, -4.15], size: [1.5, 0.9, 2.68], mtl: 'belfry-light', colour: PALETTE.sodium }, // belfry
  { shape: 'box', at: [-4.15, 8.7, -4.15], size: [2.68, 0.9, 1.5], mtl: 'belfry-light', colour: PALETTE.sodium }, // belfry
  { shape: 'box', at: [-4.15, 9.95, -4.15], size: [3, 0.3, 3], mtl: 'campus-roof', colour: PALETTE.universityRoof }, // campanile-cap
  { shape: 'box', at: [-4.15, 10.4, -4.15], size: [1.6, 0.6, 1.6], mtl: 'campus-roof', colour: PALETTE.universityRoof }, // campanile-cap
  { shape: 'box', at: [-1.4, 0.77, 1.4], size: [0.2, 0.7, 0.2], mtl: 'tree-trunk', colour: PALETTE.trunk }, // tree-trunks
  { shape: 'box', at: [1.5, 0.77, -1.2], size: [0.2, 0.7, 0.2], mtl: 'tree-trunk', colour: PALETTE.trunk }, // tree-trunks
  { shape: 'box', at: [-1.4, 1.72, 1.4], size: [1.5, 1.2, 1.5], mtl: 'tree-canopy', colour: PALETTE.canopy }, // tree-canopies
  { shape: 'box', at: [1.5, 1.72, -1.2], size: [1.5, 1.2, 1.5], mtl: 'tree-canopy', colour: PALETTE.canopy }, // tree-canopies
];

/**
 * The bus, which is the one modelled thing in the city that moves.
 *
 * Drawn by `cars.ts` rather than by anything in `buildings.ts`, and merged
 * differently for that reason — see `mergeColoured`. Its lime is the depot's
 * livery, so a bus on a street and a bus parked in its depot are the same bus.
 */
export const BUS_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.57, 0], size: [3.4, 0.7, 0.95], mtl: 'bus-green', colour: PALETTE.bus }, // body
  { shape: 'box', at: [0, 0.73, 0], size: [3.42, 0.22, 0.97], mtl: 'bus-glazing', colour: PALETTE.parapet }, // glazing
  { shape: 'box', at: [0, 0.31, 0], size: [3.42, 0.1, 0.97], mtl: 'livery-lime', colour: PALETTE.depotRoof }, // livery
  { shape: 'box', at: [0, 0.15, 0], size: [3.24, 0.16, 0.9], mtl: 'chassis-dark', colour: PALETTE.hull }, // skirt
  { shape: 'box', at: [-1.05, 0.13, -0.46], size: [0.5, 0.26, 0.16], mtl: 'chassis-dark', colour: PALETTE.hull }, // wheels
  { shape: 'box', at: [-1.05, 0.13, 0.46], size: [0.5, 0.26, 0.16], mtl: 'chassis-dark', colour: PALETTE.hull }, // wheels
  { shape: 'box', at: [1.05, 0.13, -0.46], size: [0.5, 0.26, 0.16], mtl: 'chassis-dark', colour: PALETTE.hull }, // wheels
  { shape: 'box', at: [1.05, 0.13, 0.46], size: [0.5, 0.26, 0.16], mtl: 'chassis-dark', colour: PALETTE.hull }, // wheels
  { shape: 'box', at: [-0.9, 0.935, 0], size: [0.7, 0.06, 0.5], mtl: 'roof-grey', colour: PALETTE.kerb }, // roof-vents
  { shape: 'box', at: [0.7, 0.935, 0], size: [0.4, 0.06, 0.4], mtl: 'roof-grey', colour: PALETTE.kerb }, // roof-vents
  { shape: 'box', at: [-0.45, 0.51, 0.48], size: [0.46, 0.56, 0.04], mtl: 'bus-glazing', colour: PALETTE.parapet }, // doors
  { shape: 'box', at: [0.95, 0.51, 0.48], size: [0.46, 0.56, 0.04], mtl: 'bus-glazing', colour: PALETTE.parapet }, // doors
  { shape: 'box', at: [1.67, 0.77, 0], size: [0.06, 0.16, 0.62], mtl: 'destination-blind', colour: PALETTE.sodium }, // blind
  { shape: 'box', at: [1.67, 0.28, -0.3], size: [0.06, 0.12, 0.2], mtl: 'headlight', colour: PALETTE.headlight }, // headlights
  { shape: 'box', at: [1.67, 0.28, 0.3], size: [0.06, 0.12, 0.2], mtl: 'headlight', colour: PALETTE.headlight }, // headlights
];
