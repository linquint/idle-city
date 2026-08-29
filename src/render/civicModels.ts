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
