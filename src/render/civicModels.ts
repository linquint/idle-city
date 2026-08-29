import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * Civic buildings that are modelled rather than massed, as part tables.
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
