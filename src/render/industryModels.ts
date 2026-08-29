import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-1 industrial buildings, as part tables.
 *
 * The last rung of the three that was still massed — see `houseModels.ts`,
 * which did this for housing first and sets out why the rung a district is
 * *made* of is the one worth the geometry.
 *
 * What industry has to do that the other two do not is read from *above*. A
 * house is a roof and a shop is a frontage, both seen from the street; a works
 * is a footprint, and the play camera looks down at it. So these carry their
 * character on the roof and the yard — ribbed sheds, roof vents, a sawtooth of
 * north lights, silos and flues, a tank farm behind a bund wall, pallets on a
 * loading apron — rather than on a facade nobody is looking at.
 *
 * They are also the one zone whose lit pieces are not a sign. A works after
 * dark is a lit loading bay and a row of clerestories, which is why the mill
 * carries seven of them and sets `BANDS_MAX` for the whole city.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/worksN.obj models/worksN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 */

/** Style 1 — the shed: a ribbed hall with roller doors, roof vents and one stack. */
export const INDUSTRY_SHED_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.65, 0], size: [3.5, 1.3, 3.01], mtl: 'industry-dark', colour: PALETTE.industry }, // shed
  { shape: 'box', at: [-1.4, 0.65, -1.525], size: [0.12, 1.3, 0.06], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // ribs
  { shape: 'box', at: [-0.7, 0.65, -1.525], size: [0.12, 1.3, 0.06], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // ribs
  { shape: 'box', at: [0, 0.65, -1.525], size: [0.12, 1.3, 0.06], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // ribs
  { shape: 'box', at: [0.7, 0.65, -1.525], size: [0.12, 1.3, 0.06], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // ribs
  { shape: 'box', at: [1.4, 0.65, -1.525], size: [0.12, 1.3, 0.06], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // ribs
  { shape: 'box', at: [0, 1.39, 0], size: [3.54, 0.18, 3.07], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // roof
  { shape: 'box', at: [-0.95, 0.5, 1.535], size: [1, 1, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // roller-doors
  { shape: 'box', at: [0.5, 0.5, 1.535], size: [1, 1, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // roller-doors
  { shape: 'box', at: [-0.95, 1.06, 1.565], size: [1, 0.1, 0.05], mtl: 'bay-light', colour: PALETTE.sodium }, // bay-lights
  { shape: 'box', at: [0.5, 1.06, 1.565], size: [1, 0.1, 0.05], mtl: 'bay-light', colour: PALETTE.sodium }, // bay-lights
  { shape: 'box', at: [1.28, 2.33, -0.95], size: [0.42, 1.7, 0.42], mtl: 'stack-grey', colour: PALETTE.stack }, // stack
  { shape: 'box', at: [1.28, 3.26, -0.95], size: [0.54, 0.16, 0.54], mtl: 'stack-grey', colour: PALETTE.stack }, // stack
  { shape: 'box', at: [-1, 1.7, -0.5], size: [1.1, 0.44, 0.8], mtl: 'plant-vent', colour: PALETTE.vent }, // roof-vents
  { shape: 'box', at: [0.2, 1.66, -0.7], size: [0.6, 0.36, 0.6], mtl: 'plant-vent', colour: PALETTE.vent }, // roof-vents
  { shape: 'box', at: [-0.4, 1.62, 0.7], size: [1.8, 0.28, 0.3], mtl: 'plant-vent', colour: PALETTE.vent }, // roof-vents
  { shape: 'box', at: [0, 0.03, 1.635], size: [3.5, 0.06, 0.26], mtl: 'apron-asphalt', colour: PALETTE.asphalt }, // apron
  { shape: 'box', at: [-0.95, 0.07, 1.635], size: [0.1, 0.04, 0.24], mtl: 'marking-white', colour: PALETTE.marking }, // bay-markings
  { shape: 'box', at: [0.5, 0.07, 1.635], size: [0.1, 0.04, 0.24], mtl: 'marking-white', colour: PALETTE.marking }, // bay-markings
];

/** Style 2 — the works: a stepped upper block with silos, flues and the tallest stack. */
export const INDUSTRY_WORKS_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.775, 0], size: [3.5, 1.55, 3.01], mtl: 'industry-dark', colour: PALETTE.industry }, // shed
  { shape: 'box', at: [0, 1.64, 0], size: [3.54, 0.18, 3.07], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // roof
  { shape: 'box', at: [-0.5, 2.18, -0.3], size: [2.2, 0.9, 1.9], mtl: 'industry-dark', colour: PALETTE.industry }, // upper-block
  { shape: 'box', at: [-0.5, 2.71, -0.3], size: [2.3, 0.16, 2], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // upper-roof
  { shape: 'box', at: [-1.25, 4.08, -0.3], size: [0.46, 3.9, 0.46], mtl: 'stack-grey', colour: PALETTE.stack }, // stack
  { shape: 'box', at: [-1.25, 6.13, -0.3], size: [0.58, 0.2, 0.58], mtl: 'stack-grey', colour: PALETTE.stack }, // stack
  { shape: 'box', at: [1.15, 2.48, 0.55], size: [0.8, 1.5, 0.8], mtl: 'trim-grey', colour: PALETTE.kerb }, // silos
  { shape: 'box', at: [1.15, 2.48, -0.5], size: [0.8, 1.5, 0.8], mtl: 'trim-grey', colour: PALETTE.kerb }, // silos
  { shape: 'box', at: [1.15, 3.34, 0.55], size: [0.92, 0.22, 0.92], mtl: 'plant-vent', colour: PALETTE.vent }, // silo-caps
  { shape: 'box', at: [1.15, 3.34, -0.5], size: [0.92, 0.22, 0.92], mtl: 'plant-vent', colour: PALETTE.vent }, // silo-caps
  { shape: 'box', at: [0.35, 2.93, -0.3], size: [1.6, 0.24, 0.24], mtl: 'plant-vent', colour: PALETTE.vent }, // flues
  { shape: 'box', at: [0.35, 2.33, -0.3], size: [0.24, 1.2, 0.24], mtl: 'plant-vent', colour: PALETTE.vent }, // flues
  { shape: 'box', at: [0.6, 0.6, 1.535], size: [1.1, 1.2, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // door
  { shape: 'box', at: [0.6, 1.26, 1.565], size: [1.1, 0.1, 0.05], mtl: 'bay-light', colour: PALETTE.sodium }, // door-light
  { shape: 'box', at: [0, 0.03, 1.635], size: [3.5, 0.06, 0.26], mtl: 'apron-asphalt', colour: PALETTE.asphalt }, // apron
];

/** Style 3 — the loading dock: a canopy over a marked apron, with pallets stacked on it. */
export const INDUSTRY_DOCK_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.575, 0], size: [3.5, 1.15, 3.01], mtl: 'industry-dark', colour: PALETTE.industry }, // shed
  { shape: 'box', at: [0, 1.24, 0], size: [3.54, 0.18, 3.07], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // roof
  { shape: 'box', at: [0, 1.16, 1.595], size: [3.5, 0.14, 0.22], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // loading-canopy
  { shape: 'box', at: [-1.6, 0.545, 1.645], size: [0.12, 1.09, 0.12], mtl: 'stack-grey', colour: PALETTE.stack }, // canopy-posts
  { shape: 'box', at: [-0.55, 0.545, 1.645], size: [0.12, 1.09, 0.12], mtl: 'stack-grey', colour: PALETTE.stack }, // canopy-posts
  { shape: 'box', at: [0.55, 0.545, 1.645], size: [0.12, 1.09, 0.12], mtl: 'stack-grey', colour: PALETTE.stack }, // canopy-posts
  { shape: 'box', at: [1.6, 0.545, 1.645], size: [0.12, 1.09, 0.12], mtl: 'stack-grey', colour: PALETTE.stack }, // canopy-posts
  { shape: 'box', at: [-1.1, 0.45, 1.535], size: [0.9, 0.9, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // dock-doors
  { shape: 'box', at: [0.15, 0.45, 1.535], size: [0.9, 0.9, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // dock-doors
  { shape: 'box', at: [1.35, 0.45, 1.535], size: [0.7, 0.9, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // dock-doors
  { shape: 'box', at: [0, 1.02, 1.555], size: [3.1, 0.08, 0.05], mtl: 'bay-light', colour: PALETTE.sodium }, // dock-light
  { shape: 'box', at: [-1.3, 1.58, -0.9], size: [0.8, 0.5, 0.7], mtl: 'crate-rust', colour: PALETTE.container }, // pallets
  { shape: 'box', at: [-1.3, 2.08, -0.9], size: [0.8, 0.5, 0.7], mtl: 'crate-rust', colour: PALETTE.container }, // pallets
  { shape: 'box', at: [-0.35, 1.58, -0.95], size: [0.8, 0.5, 0.7], mtl: 'crate-rust', colour: PALETTE.container }, // pallets
  { shape: 'box', at: [0.62, 1.58, -0.85], size: [0.7, 0.5, 0.6], mtl: 'crate-rust', colour: PALETTE.container }, // pallets
  { shape: 'box', at: [0.62, 2.08, -0.85], size: [0.7, 0.5, 0.6], mtl: 'crate-rust', colour: PALETTE.container }, // pallets
  { shape: 'box', at: [1.28, 1.63, 0.4], size: [0.86, 0.6, 1], mtl: 'plant-vent', colour: PALETTE.vent }, // roof-plant
  { shape: 'box', at: [0.1, 1.49, 0.75], size: [1.6, 0.32, 0.5], mtl: 'plant-vent', colour: PALETTE.vent }, // roof-plant
  { shape: 'box', at: [-1.55, 2.03, 0.9], size: [0.32, 1.4, 0.32], mtl: 'stack-grey', colour: PALETTE.stack }, // stack
  { shape: 'box', at: [0, 0.03, 1.655], size: [3.5, 0.06, 0.24], mtl: 'apron-asphalt', colour: PALETTE.asphalt }, // apron
  { shape: 'box', at: [-1.1, 0.07, 1.655], size: [0.1, 0.04, 0.22], mtl: 'marking-white', colour: PALETTE.marking }, // bay-markings
  { shape: 'box', at: [0.15, 0.07, 1.655], size: [0.1, 0.04, 0.22], mtl: 'marking-white', colour: PALETTE.marking }, // bay-markings
  { shape: 'box', at: [1.35, 0.07, 1.655], size: [0.1, 0.04, 0.22], mtl: 'marking-white', colour: PALETTE.marking }, // bay-markings
];

/** Style 4 — the tank farm: three banded tanks and a pipe bridge inside a bund wall. */
export const INDUSTRY_TANKS_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-1.1, 0.575, 0], size: [1.3, 1.15, 3.01], mtl: 'industry-dark', colour: PALETTE.industry }, // pump-house
  { shape: 'box', at: [-1.1, 1.24, 0], size: [1.3, 0.18, 3.07], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // pump-roof
  { shape: 'box', at: [0.58, 0.05, 0], size: [2.34, 0.1, 3.01], mtl: 'apron-asphalt', colour: PALETTE.asphalt }, // base-slab
  { shape: 'box', at: [-0.18, 1.05, 0], size: [0.6, 1.9, 0.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // tanks
  { shape: 'box', at: [0.55, 1.05, 0], size: [0.6, 1.9, 0.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // tanks
  { shape: 'box', at: [1.28, 1.05, 0], size: [0.6, 1.9, 0.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // tanks
  { shape: 'box', at: [-0.18, 2.11, 0], size: [0.68, 0.22, 0.94], mtl: 'plant-vent', colour: PALETTE.vent }, // tank-caps
  { shape: 'box', at: [0.55, 2.11, 0], size: [0.68, 0.22, 0.94], mtl: 'plant-vent', colour: PALETTE.vent }, // tank-caps
  { shape: 'box', at: [1.28, 2.11, 0], size: [0.68, 0.22, 0.94], mtl: 'plant-vent', colour: PALETTE.vent }, // tank-caps
  { shape: 'box', at: [-0.18, 0.72, 0], size: [0.64, 0.1, 0.9], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tank-bands
  { shape: 'box', at: [-0.18, 1.5, 0], size: [0.64, 0.1, 0.9], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tank-bands
  { shape: 'box', at: [0.55, 0.72, 0], size: [0.64, 0.1, 0.9], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tank-bands
  { shape: 'box', at: [0.55, 1.5, 0], size: [0.64, 0.1, 0.9], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tank-bands
  { shape: 'box', at: [1.28, 0.72, 0], size: [0.64, 0.1, 0.9], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tank-bands
  { shape: 'box', at: [1.28, 1.5, 0], size: [0.64, 0.1, 0.9], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tank-bands
  { shape: 'box', at: [0.4, 2.24, 0], size: [2, 0.16, 0.16], mtl: 'stack-grey', colour: PALETTE.stack }, // pipe-bridge
  { shape: 'box', at: [-0.28, 2.24, 0], size: [0.16, 0.16, 1.6], mtl: 'stack-grey', colour: PALETTE.stack }, // pipe-bridge
  { shape: 'box', at: [-0.72, 1.7, 0], size: [0.16, 1.24, 0.16], mtl: 'stack-grey', colour: PALETTE.stack }, // pipe-bridge
  { shape: 'box', at: [0.58, 0.28, 1.415], size: [2.38, 0.56, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // bund-wall
  { shape: 'box', at: [0.58, 0.28, -1.415], size: [2.38, 0.56, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // bund-wall
  { shape: 'box', at: [1.7, 0.28, 0], size: [0.16, 0.56, 3.01], mtl: 'trim-grey', colour: PALETTE.kerb }, // bund-wall
  { shape: 'box', at: [-1.1, 0.45, 1.535], size: [0.9, 0.9, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // pump-door
  { shape: 'box', at: [-1.1, 1, 1.555], size: [0.9, 0.08, 0.05], mtl: 'bay-light', colour: PALETTE.sodium }, // pump-light
  { shape: 'box', at: [0.58, 0.11, 1.225], size: [2.2, 0.04, 0.14], mtl: 'marking-white', colour: PALETTE.marking }, // hazard-marking
];

/** Style 5 — the mill: a sawtooth roof of five north lights over a wide hall. */
export const INDUSTRY_MILL_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.6, 0], size: [3.5, 1.2, 3.01], mtl: 'industry-dark', colour: PALETTE.industry }, // shed
  { shape: 'box', at: [0, 1.29, 0], size: [3.54, 0.18, 3.07], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // eaves
  { shape: 'box', at: [-1.5, 1.54, 0], size: [0.34, 0.32, 2.81], mtl: 'industry-dark', colour: PALETTE.industry }, // teeth
  { shape: 'box', at: [-1.33, 1.68, 0], size: [0.34, 0.6, 2.81], mtl: 'industry-dark', colour: PALETTE.industry }, // teeth
  { shape: 'box', at: [-0.8, 1.54, 0], size: [0.34, 0.32, 2.81], mtl: 'industry-dark', colour: PALETTE.industry }, // teeth
  { shape: 'box', at: [-0.63, 1.68, 0], size: [0.34, 0.6, 2.81], mtl: 'industry-dark', colour: PALETTE.industry }, // teeth
  { shape: 'box', at: [-0.1, 1.54, 0], size: [0.34, 0.32, 2.81], mtl: 'industry-dark', colour: PALETTE.industry }, // teeth
  { shape: 'box', at: [0.07, 1.68, 0], size: [0.34, 0.6, 2.81], mtl: 'industry-dark', colour: PALETTE.industry }, // teeth
  { shape: 'box', at: [0.6, 1.54, 0], size: [0.34, 0.32, 2.81], mtl: 'industry-dark', colour: PALETTE.industry }, // teeth
  { shape: 'box', at: [0.77, 1.68, 0], size: [0.34, 0.6, 2.81], mtl: 'industry-dark', colour: PALETTE.industry }, // teeth
  { shape: 'box', at: [1.3, 1.54, 0], size: [0.34, 0.32, 2.81], mtl: 'industry-dark', colour: PALETTE.industry }, // teeth
  { shape: 'box', at: [1.47, 1.68, 0], size: [0.34, 0.6, 2.81], mtl: 'industry-dark', colour: PALETTE.industry }, // teeth
  { shape: 'box', at: [-1.53, 1.84, 0], size: [0.1, 0.28, 2.81], mtl: 'bay-light', colour: PALETTE.sodium }, // north-lights
  { shape: 'box', at: [-0.83, 1.84, 0], size: [0.1, 0.28, 2.81], mtl: 'bay-light', colour: PALETTE.sodium }, // north-lights
  { shape: 'box', at: [-0.13, 1.84, 0], size: [0.1, 0.28, 2.81], mtl: 'bay-light', colour: PALETTE.sodium }, // north-lights
  { shape: 'box', at: [0.57, 1.84, 0], size: [0.1, 0.28, 2.81], mtl: 'bay-light', colour: PALETTE.sodium }, // north-lights
  { shape: 'box', at: [1.27, 1.84, 0], size: [0.1, 0.28, 2.81], mtl: 'bay-light', colour: PALETTE.sodium }, // north-lights
  { shape: 'box', at: [-1.33, 2.02, 0], size: [0.38, 0.1, 2.89], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tooth-caps
  { shape: 'box', at: [-0.63, 2.02, 0], size: [0.38, 0.1, 2.89], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tooth-caps
  { shape: 'box', at: [0.07, 2.02, 0], size: [0.38, 0.1, 2.89], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tooth-caps
  { shape: 'box', at: [0.77, 2.02, 0], size: [0.38, 0.1, 2.89], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tooth-caps
  { shape: 'box', at: [1.47, 2.02, 0], size: [0.38, 0.1, 2.89], mtl: 'industry-roof', colour: PALETTE.industryRoof }, // tooth-caps
  { shape: 'box', at: [0, 1.68, 1.365], size: [3.5, 0.6, 0.14], mtl: 'industry-dark', colour: PALETTE.industry }, // gable-ends
  { shape: 'box', at: [0, 1.68, -1.365], size: [3.5, 0.6, 0.14], mtl: 'industry-dark', colour: PALETTE.industry }, // gable-ends
  { shape: 'box', at: [-1.5, 2.63, -1], size: [0.38, 2.5, 0.38], mtl: 'stack-grey', colour: PALETTE.stack }, // stack
  { shape: 'box', at: [-1.5, 3.98, -1], size: [0.5, 0.18, 0.5], mtl: 'stack-grey', colour: PALETTE.stack }, // stack
  { shape: 'box', at: [-0.7, 0.48, 1.535], size: [1.2, 0.96, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // doors
  { shape: 'box', at: [0.85, 0.48, 1.535], size: [1.2, 0.96, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // doors
  { shape: 'box', at: [-0.7, 1.02, 1.555], size: [1.2, 0.08, 0.05], mtl: 'bay-light', colour: PALETTE.sodium }, // door-lights
  { shape: 'box', at: [0.85, 1.02, 1.555], size: [1.2, 0.08, 0.05], mtl: 'bay-light', colour: PALETTE.sodium }, // door-lights
  { shape: 'box', at: [0, 0.03, 1.635], size: [3.5, 0.06, 0.26], mtl: 'apron-asphalt', colour: PALETTE.asphalt }, // apron
];
