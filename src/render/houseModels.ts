import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-1 houses, as part tables.
 *
 * A house is the first thing the player buys and the thing they buy most of, so
 * it is the one building the city is mostly *made* of — and it was the last one
 * still massed, a 2.2-unit box with a cone on it. Five models replace it, one
 * chosen per plot by `houseStyle`, and the choice is a pure function of the slot
 * and the seed: nothing here is stored, so a save is still counts.
 *
 * Kept apart from `civicModels.ts`, which draws the things that stand on a
 * reserved square. These are not that. They stand on a single plot, they are
 * chosen from rather than placed by type, and there are thousands of them —
 * which is why they are drawn by `houses.ts` as one vertex-coloured mesh a
 * style rather than as a mesh per material. Same converter, same contract,
 * different consumer.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/houseN.obj models/houseN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 *
 * Every table carries exactly one `window-light` part. That is a contract
 * rather than a coincidence — see `HOUSE_LIT` in `houses.ts`, which is what
 * lets a modelled house keep the night ramp without a mesh of its own.
 */

/** Style 1 — the cottage: a hipped-roof detached house behind a hedged path. */
export const HOUSE_COTTAGE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.8, 0], size: [2.2, 1.6, 2.2], mtl: 'house-concrete', colour: PALETTE.concrete }, // body
  { shape: 'box', at: [0, 1.725, 0], size: [2.36, 0.25, 2.36], mtl: 'roof-tile', colour: PALETTE.tile }, // roof
  { shape: 'box', at: [0, 1.975, 0], size: [2.36, 0.25, 1.652], mtl: 'roof-tile', colour: PALETTE.tile }, // roof
  { shape: 'box', at: [0, 2.225, 0], size: [2.36, 0.25, 0.991], mtl: 'roof-tile', colour: PALETTE.tile }, // roof
  { shape: 'box', at: [0, 2.475, 0], size: [2.36, 0.25, 0.378], mtl: 'roof-tile', colour: PALETTE.tile }, // roof
  { shape: 'box', at: [-0.72, 2.55, -0.5], size: [0.3, 0.9, 0.3], mtl: 'roof-tile', colour: PALETTE.tile }, // chimney
  { shape: 'box', at: [-0.58, 0.95, 1.11], size: [0.62, 0.56, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.58, 0.95, 1.11], size: [0.62, 0.56, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.11, 0.95, -0.3], size: [0.06, 0.56, 0.62], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.11, 0.95, 0.2], size: [0.06, 0.56, 0.62], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 0.95, 0], size: [2.24, 0.1, 2.24], mtl: 'window-light', colour: PALETTE.sodium }, // window-light
  { shape: 'box', at: [0, 0.42, 1.11], size: [0.46, 0.84, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // door
  { shape: 'box', at: [0, 1.02, 1.3], size: [0.9, 0.1, 0.5], mtl: 'canopy-pale', colour: PALETTE.awning }, // porch
  { shape: 'box', at: [-0.36, 0.5, 1.48], size: [0.09, 1, 0.09], mtl: 'canopy-pale', colour: PALETTE.awning }, // porch
  { shape: 'box', at: [0.36, 0.5, 1.48], size: [0.09, 1, 0.09], mtl: 'canopy-pale', colour: PALETTE.awning }, // porch
  { shape: 'box', at: [0, 0.03, 1.31], size: [0.6, 0.06, 0.48], mtl: 'garden-path', colour: PALETTE.land }, // path
  { shape: 'box', at: [-0.78, 0.18, 1.33], size: [0.62, 0.36, 0.44], mtl: 'garden-hedge', colour: PALETTE.hedge }, // hedge
  { shape: 'box', at: [0.78, 0.18, 1.33], size: [0.62, 0.36, 0.44], mtl: 'garden-hedge', colour: PALETTE.hedge }, // hedge
];

/** Style 2 — the terrace: a flat-parapet townhouse with a bay and party walls. */
export const HOUSE_TERRACE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.95, 0], size: [2.2, 1.9, 2], mtl: 'house-concrete', colour: PALETTE.concrete }, // body
  { shape: 'box', at: [-1.12, 1.01, 0], size: [0.16, 2.02, 2.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // party-walls
  { shape: 'box', at: [1.12, 1.01, 0], size: [0.16, 2.02, 2.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // party-walls
  { shape: 'box', at: [0, 2.02, 0], size: [2.34, 0.24, 2.14], mtl: 'roof-tile', colour: PALETTE.tile }, // parapet
  { shape: 'box', at: [0, 2.22, 0], size: [0.9, 0.16, 0.9], mtl: 'roof-tile', colour: PALETTE.tile }, // parapet
  { shape: 'box', at: [0.82, 2.42, -0.4], size: [0.34, 0.66, 0.28], mtl: 'roof-tile', colour: PALETTE.tile }, // chimney
  { shape: 'box', at: [0.42, 0.62, 1.16], size: [1, 1.24, 0.42], mtl: 'house-concrete', colour: PALETTE.concrete }, // bay
  { shape: 'box', at: [0.42, 0.74, 1.38], size: [0.84, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // bay-glazing
  { shape: 'box', at: [-0.1, 0.74, 1.16], size: [0.06, 0.72, 0.3], mtl: 'glazing', colour: PALETTE.parapet }, // bay-glazing
  { shape: 'box', at: [0.94, 0.74, 1.16], size: [0.06, 0.72, 0.3], mtl: 'glazing', colour: PALETTE.parapet }, // bay-glazing
  { shape: 'box', at: [0.42, 1.28, 1.16], size: [1.12, 0.1, 0.54], mtl: 'trim-grey', colour: PALETTE.kerb }, // bay-cap
  { shape: 'box', at: [-0.55, 1.5, 1.01], size: [0.5, 0.62, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // upper-windows
  { shape: 'box', at: [0.42, 1.5, 1.01], size: [0.5, 0.62, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // upper-windows
  { shape: 'box', at: [0, 1.5, 0], size: [2.24, 0.08, 2.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-light
  { shape: 'box', at: [-0.58, 0.46, 1.01], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // door
  { shape: 'box', at: [-0.58, 0.98, 1.11], size: [0.66, 0.1, 0.3], mtl: 'trim-grey', colour: PALETTE.kerb }, // door-hood
  { shape: 'box', at: [-0.58, 0.05, 1.22], size: [0.72, 0.1, 0.34], mtl: 'garden-path', colour: PALETTE.land }, // stoop
  { shape: 'box', at: [-0.58, 0.14, 1.1], size: [0.6, 0.1, 0.2], mtl: 'garden-path', colour: PALETTE.land }, // stoop
];

/** Style 3 — the veranda house: a low hip with a dormer over a full-width porch. */
export const HOUSE_VERANDA_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.55, -0.2], size: [2.2, 1.1, 1.8], mtl: 'house-concrete', colour: PALETTE.concrete }, // body
  { shape: 'box', at: [0, 1.208, -0.2], size: [2.5, 0.215, 2.1], mtl: 'roof-tile', colour: PALETTE.tile }, // roof
  { shape: 'box', at: [0, 1.423, -0.2], size: [1.85, 0.215, 1.554], mtl: 'roof-tile', colour: PALETTE.tile }, // roof
  { shape: 'box', at: [0, 1.637, -0.2], size: [1.2, 0.215, 1.008], mtl: 'roof-tile', colour: PALETTE.tile }, // roof
  { shape: 'box', at: [0, 1.853, -0.2], size: [0.55, 0.215, 0.462], mtl: 'roof-tile', colour: PALETTE.tile }, // roof
  { shape: 'box', at: [0.3, 1.4, 0.42], size: [0.66, 0.44, 0.4], mtl: 'house-concrete', colour: PALETTE.concrete }, // dormer
  { shape: 'box', at: [0.3, 1.4, 0.63], size: [0.48, 0.3, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // dormer-window
  { shape: 'box', at: [0.3, 1.67, 0.42], size: [0.78, 0.12, 0.5], mtl: 'roof-tile', colour: PALETTE.tile }, // dormer-cap
  { shape: 'box', at: [-0.8, 1.82, -0.6], size: [0.28, 0.72, 0.28], mtl: 'roof-tile', colour: PALETTE.tile }, // chimney
  { shape: 'box', at: [0, 1.06, 0.72], size: [2.44, 0.1, 0.86], mtl: 'canopy-pale', colour: PALETTE.awning }, // veranda-roof
  { shape: 'box', at: [-1.06, 0.52, 1.06], size: [0.1, 1.04, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // veranda-posts
  { shape: 'box', at: [-0.36, 0.52, 1.06], size: [0.1, 1.04, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // veranda-posts
  { shape: 'box', at: [0.36, 0.52, 1.06], size: [0.1, 1.04, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // veranda-posts
  { shape: 'box', at: [1.06, 0.52, 1.06], size: [0.1, 1.04, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // veranda-posts
  { shape: 'box', at: [0, 0.05, 0.78], size: [2.36, 0.1, 0.9], mtl: 'garden-path', colour: PALETTE.land }, // veranda-deck
  { shape: 'box', at: [-0.62, 0.66, 0.71], size: [0.66, 0.5, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.62, 0.66, 0.71], size: [0.66, 0.5, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.11, 0.66, -0.4], size: [0.06, 0.5, 0.7], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.11, 0.66, -0.4], size: [0.06, 0.5, 0.7], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 0.66, -0.2], size: [2.24, 0.08, 1.84], mtl: 'window-light', colour: PALETTE.sodium }, // window-light
  { shape: 'box', at: [0, 0.4, 0.71], size: [0.44, 0.8, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // door
  { shape: 'box', at: [0, 0.16, 1.32], size: [2.4, 0.32, 0.24], mtl: 'garden-hedge', colour: PALETTE.hedge }, // hedge
];

/** Style 4 — the semi: two gabled halves under a shared chimney, two front doors. */
export const HOUSE_SEMI_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-0.55, 0.8, 0], size: [1.06, 1.6, 2.1], mtl: 'house-concrete', colour: PALETTE.concrete }, // bodies
  { shape: 'box', at: [0.55, 0.8, 0], size: [1.06, 1.6, 2.1], mtl: 'house-concrete', colour: PALETTE.concrete }, // bodies
  { shape: 'box', at: [-0.55, 1.713, 0], size: [1.16, 0.225, 2.2], mtl: 'roof-tile', colour: PALETTE.tile }, // roofs
  { shape: 'box', at: [-0.55, 1.938, 0], size: [1.16, 0.225, 1.54], mtl: 'roof-tile', colour: PALETTE.tile }, // roofs
  { shape: 'box', at: [-0.55, 2.163, 0], size: [1.16, 0.225, 0.924], mtl: 'roof-tile', colour: PALETTE.tile }, // roofs
  { shape: 'box', at: [-0.55, 2.388, 0], size: [1.16, 0.225, 0.352], mtl: 'roof-tile', colour: PALETTE.tile }, // roofs
  { shape: 'box', at: [0.55, 1.713, 0], size: [1.16, 0.225, 2.2], mtl: 'roof-tile', colour: PALETTE.tile }, // roofs
  { shape: 'box', at: [0.55, 1.938, 0], size: [1.16, 0.225, 1.54], mtl: 'roof-tile', colour: PALETTE.tile }, // roofs
  { shape: 'box', at: [0.55, 2.163, 0], size: [1.16, 0.225, 0.924], mtl: 'roof-tile', colour: PALETTE.tile }, // roofs
  { shape: 'box', at: [0.55, 2.388, 0], size: [1.16, 0.225, 0.352], mtl: 'roof-tile', colour: PALETTE.tile }, // roofs
  { shape: 'box', at: [0, 2.52, -0.3], size: [0.34, 1, 0.3], mtl: 'roof-tile', colour: PALETTE.tile }, // shared-chimney
  { shape: 'box', at: [0, 0.83, 0], size: [0.1, 1.66, 2.16], mtl: 'trim-grey', colour: PALETTE.kerb }, // party-line
  { shape: 'box', at: [-0.28, 0.42, 1.06], size: [0.4, 0.84, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // doors
  { shape: 'box', at: [0.28, 0.42, 1.06], size: [0.4, 0.84, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // doors
  { shape: 'box', at: [0, 0.94, 1.18], size: [1.24, 0.1, 0.38], mtl: 'canopy-pale', colour: PALETTE.awning }, // door-hood
  { shape: 'box', at: [-0.82, 0.5, 1.06], size: [0.44, 0.48, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.82, 0.5, 1.06], size: [0.44, 0.48, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.55, 1.18, 1.06], size: [0.6, 0.46, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.55, 1.18, 1.06], size: [0.6, 0.46, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 1.18, 0], size: [2.24, 0.08, 2.14], mtl: 'window-light', colour: PALETTE.sodium }, // window-light
  { shape: 'box', at: [-0.72, 0.16, 1.38], size: [0.9, 0.32, 0.22], mtl: 'garden-hedge', colour: PALETTE.hedge }, // garden-wall
  { shape: 'box', at: [0.72, 0.16, 1.38], size: [0.9, 0.32, 0.22], mtl: 'garden-hedge', colour: PALETTE.hedge }, // garden-wall
  { shape: 'box', at: [-0.28, 0.03, 1.3], size: [0.42, 0.06, 0.4], mtl: 'garden-path', colour: PALETTE.land }, // paths
  { shape: 'box', at: [0.28, 0.03, 1.3], size: [0.42, 0.06, 0.4], mtl: 'garden-path', colour: PALETTE.land }, // paths
];

/** Style 5 — the modern: two flat-capped wings, a clerestory and a carport. */
export const HOUSE_MODERN_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-0.42, 0.9, -0.62], size: [1.36, 1.8, 0.96], mtl: 'house-concrete', colour: PALETTE.concrete }, // wings
  { shape: 'box', at: [-0.75, 0.7, 0.36], size: [0.7, 1.4, 1], mtl: 'house-concrete', colour: PALETTE.concrete }, // wings
  { shape: 'box', at: [-0.42, 1.87, -0.62], size: [1.5, 0.14, 1.1], mtl: 'roof-tile', colour: PALETTE.tile }, // roof-caps
  { shape: 'box', at: [-0.75, 1.47, 0.36], size: [0.84, 0.14, 1.14], mtl: 'roof-tile', colour: PALETTE.tile }, // roof-caps
  { shape: 'box', at: [-0.42, 1.66, -0.62], size: [1.4, 0.14, 1], mtl: 'window-light', colour: PALETTE.sodium }, // clerestory
  { shape: 'box', at: [-0.42, 0.86, -0.11], size: [1.16, 1.1, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // glazing
  { shape: 'box', at: [-1.11, 0.86, -0.62], size: [0.06, 1.1, 0.72], mtl: 'glazing', colour: PALETTE.parapet }, // glazing
  { shape: 'box', at: [-0.86, 0.72, 0.87], size: [0.42, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // glazing
  { shape: 'box', at: [-0.53, 0.44, 0.87], size: [0.34, 0.88, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // door
  { shape: 'box', at: [0.72, 1.2, 0.34], size: [0.9, 0.12, 1.36], mtl: 'canopy-pale', colour: PALETTE.awning }, // carport-roof
  { shape: 'box', at: [1.12, 0.57, -0.3], size: [0.1, 1.14, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // carport-posts
  { shape: 'box', at: [1.12, 0.57, 0.98], size: [0.1, 1.14, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // carport-posts
  { shape: 'box', at: [0.32, 0.57, 0.98], size: [0.1, 1.14, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // carport-posts
  { shape: 'box', at: [0.32, 0.57, -0.3], size: [0.1, 1.14, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // carport-posts
  { shape: 'box', at: [0.72, 0.03, 0.5], size: [0.96, 0.06, 1.9], mtl: 'garden-path', colour: PALETTE.land }, // drive
  { shape: 'box', at: [-0.75, 0.24, 1.42], size: [1.42, 0.48, 0.14], mtl: 'trim-grey', colour: PALETTE.kerb }, // garden-wall
  { shape: 'box', at: [-1.39, 0.24, 0.82], size: [0.14, 0.48, 1.34], mtl: 'trim-grey', colour: PALETTE.kerb }, // garden-wall
  { shape: 'box', at: [-0.75, 0.2, 1.16], size: [1.2, 0.4, 0.34], mtl: 'garden-hedge', colour: PALETTE.hedge }, // hedge
];
