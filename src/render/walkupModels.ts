import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-2 walk-ups, as part tables.
 *
 * Housing's *second* rung, and the first rung anywhere in the city above the
 * first to be modelled rather than massed. `houseModels.ts` set out why the
 * rung a district is made of is worth the geometry; this is the answer to the
 * question that one raised and left open — what happens to a street when the
 * player promotes it. A district of five house silhouettes climbing to twenty-
 * four copies of the same 2.6 x 4.6 box was the most visible cliff in the game,
 * and it is the rung a city spends its *second* hour looking at.
 *
 * The models are built to the row they replace. `ZONE_SHAPES.home[1]` is 2.6
 * wide and 4.6 tall and every one of these stands in it: four bodies are 2.6 x
 * 4.6 exactly and the mansard is 2.6 x 3.5 with its top floor bringing it to
 * the same 4.8. So the ladder still steps where it stepped — what changed is
 * what stands on the step.
 *
 * A walk-up is three or four storeys of flats reached on foot, which is the one
 * thing the silhouette has to say: every model here carries its stacked floors
 * on the outside, as a band, a deck, a gallery or a run of dormers, because a
 * plain box at this height reads as an office. That is also what makes the rung
 * legible from the play camera at a glance — a district that has climbed is a
 * district whose fronts have gone horizontal.
 *
 * These stand on a *single* plot, like the rung below them: `LEVEL_FOOTPRINT`
 * is [1, 1, 2, ...], so the merge is the promotion to level 3 and not to this
 * one. That is what lets them drop into the same write path a house takes,
 * jitter and quarter turn and all, rather than needing to span a parcel.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/walkupN.obj models/walkupN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 *
 * Every table carries at least one `window-light` part, the same contract the
 * houses keep — see `MODEL_LIT` in `modelled.ts`. Two of these carry three,
 * which is a floor each: a walk-up that lit one band would read as a house that
 * had been stretched.
 */

/** Style 1 — the core block: a brick walk-up with its stair tower glazed up the front. */
export const WALKUP_CORE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 2.3, 0], size: [2.6, 4.6, 2.6], mtl: 'wall-brick', colour: PALETTE.tile }, // body
  { shape: 'box', at: [0, 1.5, 0], size: [2.68, 0.16, 2.68], mtl: 'wall-concrete', colour: PALETTE.concrete }, // floor-bands
  { shape: 'box', at: [0, 3, 0], size: [2.68, 0.16, 2.68], mtl: 'wall-concrete', colour: PALETTE.concrete }, // floor-bands
  { shape: 'box', at: [1.02, 2.45, 0.7], size: [0.76, 4.9, 1.5], mtl: 'wall-concrete', colour: PALETTE.concrete }, // stair-core
  { shape: 'box', at: [1.02, 2.4, 1.46], size: [0.44, 3.6, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // stair-glazing
  { shape: 'box', at: [0, 4.73, 0], size: [2.76, 0.26, 2.76], mtl: 'trim-grey', colour: PALETTE.kerb }, // parapet
  { shape: 'box', at: [1.02, 5, 0.7], size: [0.9, 0.2, 1.62], mtl: 'trim-grey', colour: PALETTE.kerb }, // core-cap
  { shape: 'box', at: [-0.92, 0.78, 1.31], size: [0.5, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.1, 0.78, 1.31], size: [0.5, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.92, 2.28, 1.31], size: [0.5, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.1, 2.28, 1.31], size: [0.5, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.92, 3.72, 1.31], size: [0.5, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.1, 3.72, 1.31], size: [0.5, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.31, 0.78, -0.5], size: [0.06, 0.72, 0.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.31, 2.28, -0.5], size: [0.06, 0.72, 0.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.31, 3.72, -0.5], size: [0.06, 0.72, 0.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.31, 2.28, 0.7], size: [0.06, 0.72, 0.5], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 1.22, 0], size: [2.66, 0.08, 2.66], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 2.72, 0], size: [2.66, 0.08, 2.66], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 4.16, 0], size: [2.66, 0.08, 2.66], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [1.02, 0.52, 1.45], size: [0.52, 1.04, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [1.02, 1.14, 1.44], size: [0.86, 0.12, 0.28], mtl: 'trim-grey', colour: PALETTE.kerb }, // entrance-hood
  { shape: 'box', at: [1.02, 0.05, 1.54], size: [0.9, 0.1, 0.12], mtl: 'garden-path', colour: PALETTE.land }, // stoop
  { shape: 'box', at: [1.02, 0.14, 1.44], size: [0.76, 0.1, 0.1], mtl: 'garden-path', colour: PALETTE.land }, // stoop
  { shape: 'box', at: [-0.62, 0.2, 1.42], size: [1.34, 0.4, 0.24], mtl: 'garden-hedge', colour: PALETTE.hedge }, // hedge
];

/** Style 2 — the deck block: flats off an open gallery, reached by an external stair. */
export const WALKUP_DECK_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 2.3, -0.12], size: [2.6, 4.6, 2.36], mtl: 'wall-concrete', colour: PALETTE.concrete }, // body
  { shape: 'box', at: [-0.125, 1.62, 1.3], size: [2.35, 0.14, 0.5], mtl: 'trim-grey', colour: PALETTE.kerb }, // access-decks
  { shape: 'box', at: [-0.125, 3.12, 1.3], size: [2.35, 0.14, 0.5], mtl: 'trim-grey', colour: PALETTE.kerb }, // access-decks
  { shape: 'box', at: [-1.16, 1.835, 1.48], size: [0.12, 3.67, 0.12], mtl: 'trim-grey', colour: PALETTE.kerb }, // deck-posts
  { shape: 'box', at: [-0.15, 1.835, 1.48], size: [0.12, 3.67, 0.12], mtl: 'trim-grey', colour: PALETTE.kerb }, // deck-posts
  { shape: 'box', at: [0.86, 1.835, 1.48], size: [0.12, 3.67, 0.12], mtl: 'trim-grey', colour: PALETTE.kerb }, // deck-posts
  { shape: 'box', at: [-0.125, 2.04, 1.51], size: [2.35, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // railings
  { shape: 'box', at: [-0.125, 1.86, 1.51], size: [2.35, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // railings
  { shape: 'box', at: [-0.125, 3.54, 1.51], size: [2.35, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // railings
  { shape: 'box', at: [-0.125, 3.36, 1.51], size: [2.35, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // railings
  { shape: 'box', at: [1.3, 1.595, 1.34], size: [0.5, 3.19, 0.44], mtl: 'trim-grey', colour: PALETTE.kerb }, // external-stair
  { shape: 'box', at: [1.3, 0.45, 1.57], size: [0.44, 0.07, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-treads
  { shape: 'box', at: [1.3, 0.9, 1.57], size: [0.44, 0.07, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-treads
  { shape: 'box', at: [1.3, 1.35, 1.57], size: [0.44, 0.07, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-treads
  { shape: 'box', at: [1.3, 1.8, 1.57], size: [0.44, 0.07, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-treads
  { shape: 'box', at: [1.3, 2.25, 1.57], size: [0.44, 0.07, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-treads
  { shape: 'box', at: [1.3, 2.7, 1.57], size: [0.44, 0.07, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-treads
  { shape: 'box', at: [0, 4.72, -0.12], size: [2.74, 0.24, 2.5], mtl: 'trim-grey', colour: PALETTE.kerb }, // roof
  { shape: 'box', at: [-0.82, 2.19, 1.09], size: [0.44, 0.94, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [0.24, 2.19, 1.09], size: [0.44, 0.94, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-0.82, 3.69, 1.09], size: [0.44, 0.94, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [0.24, 3.69, 1.09], size: [0.44, 0.94, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-0.82, 0.78, 1.09], size: [0.56, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.24, 0.78, 1.09], size: [0.56, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.3, 2.19, 1.09], size: [0.5, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.3, 3.69, 1.09], size: [0.5, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.31, 1.6, -0.12], size: [0.06, 0.8, 0.9], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.31, 3.1, -0.12], size: [0.06, 0.8, 0.9], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.3, 1.52, 1.09], size: [1.9, 0.08, 0.06], mtl: 'window-light', colour: PALETTE.sodium }, // deck-lights
  { shape: 'box', at: [-0.3, 3.02, 1.09], size: [1.9, 0.08, 0.06], mtl: 'window-light', colour: PALETTE.sodium }, // deck-lights
  { shape: 'box', at: [0.86, 0.5, 1.09], size: [0.5, 1, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // ground-entry
  { shape: 'box', at: [0.86, 0.03, 1.36], size: [0.6, 0.06, 0.5], mtl: 'garden-path', colour: PALETTE.land }, // path
];

/** Style 3 — the maisonettes: a gabled pair, the upper flats up their own outside stairs. */
export const WALKUP_MAISONETTE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-0.65, 2.3, 0], size: [1.3, 4.6, 2.6], mtl: 'wall-brick', colour: PALETTE.tile }, // left-half
  { shape: 'box', at: [0.65, 2.3, 0], size: [1.3, 4.6, 2.6], mtl: 'wall-concrete', colour: PALETTE.concrete }, // right-half
  { shape: 'box', at: [0, 4.74, 0], size: [2.76, 0.28, 2.76], mtl: 'roof-tile', colour: PALETTE.walkupRoof }, // gable
  { shape: 'box', at: [0, 5.02, 0], size: [2.76, 0.28, 1.82], mtl: 'roof-tile', colour: PALETTE.walkupRoof }, // gable
  { shape: 'box', at: [0, 5.3, 0], size: [2.76, 0.28, 1.04], mtl: 'roof-tile', colour: PALETTE.walkupRoof }, // gable
  { shape: 'box', at: [0, 2.31, 0], size: [0.1, 4.62, 2.64], mtl: 'trim-grey', colour: PALETTE.kerb }, // party-line
  { shape: 'box', at: [0, 2.3, 0], size: [2.68, 0.14, 2.68], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-band
  { shape: 'box', at: [-1.08, 1.18, 1.44], size: [0.4, 2.36, 0.28], mtl: 'trim-grey', colour: PALETTE.kerb }, // upper-stairs
  { shape: 'box', at: [-1.08, 2.44, 1.38], size: [0.46, 0.16, 0.4], mtl: 'trim-grey', colour: PALETTE.kerb }, // upper-stairs
  { shape: 'box', at: [1.08, 1.18, 1.44], size: [0.4, 2.36, 0.28], mtl: 'trim-grey', colour: PALETTE.kerb }, // upper-stairs
  { shape: 'box', at: [1.08, 2.44, 1.38], size: [0.46, 0.16, 0.4], mtl: 'trim-grey', colour: PALETTE.kerb }, // upper-stairs
  { shape: 'box', at: [-1.08, 2.74, 1.54], size: [0.46, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-rails
  { shape: 'box', at: [-1.27, 2.65, 1.54], size: [0.08, 0.26, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-rails
  { shape: 'box', at: [-0.89, 2.65, 1.54], size: [0.08, 0.26, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-rails
  { shape: 'box', at: [1.08, 2.74, 1.54], size: [0.46, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-rails
  { shape: 'box', at: [0.89, 2.65, 1.54], size: [0.08, 0.26, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-rails
  { shape: 'box', at: [1.27, 2.65, 1.54], size: [0.08, 0.26, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // stair-rails
  { shape: 'box', at: [-0.26, 0.5, 1.33], size: [0.36, 1, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // doors
  { shape: 'box', at: [0.26, 0.5, 1.33], size: [0.36, 1, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // doors
  { shape: 'box', at: [-1.08, 3.02, 1.33], size: [0.36, 1, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // doors
  { shape: 'box', at: [1.08, 3.02, 1.33], size: [0.36, 1, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // doors
  { shape: 'box', at: [-0.68, 0.86, 1.31], size: [0.4, 0.74, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.68, 0.86, 1.31], size: [0.4, 0.74, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.26, 3.02, 1.31], size: [0.36, 0.74, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.26, 3.02, 1.31], size: [0.36, 0.74, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.68, 3.02, 1.31], size: [0.4, 0.74, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.68, 3.02, 1.31], size: [0.4, 0.74, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.65, 3.98, 1.31], size: [0.66, 0.5, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.65, 3.98, 1.31], size: [0.66, 0.5, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.31, 1.8, -0.5], size: [0.06, 0.74, 0.7], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.31, 1.8, -0.5], size: [0.06, 0.74, 0.7], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 3.46, 0], size: [2.66, 0.08, 2.66], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 1.28, 0], size: [2.66, 0.08, 2.66], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-1, 5.55, -0.8], size: [0.32, 1.1, 0.32], mtl: 'roof-tile', colour: PALETTE.walkupRoof }, // chimney
  { shape: 'box', at: [0, 0.03, 1.44], size: [2.6, 0.06, 0.24], mtl: 'garden-path', colour: PALETTE.land }, // path
];

/** Style 4 — the court: two wings round a raised deck, a terrace railed over the shorter. */
export const WALKUP_COURT_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-0.5, 2.3, -0.65], size: [1.6, 4.6, 1.3], mtl: 'wall-concrete', colour: PALETTE.concrete }, // wings
  { shape: 'box', at: [-0.95, 1.75, 0.75], size: [0.7, 3.5, 1.5], mtl: 'wall-concrete', colour: PALETTE.concrete }, // wings
  { shape: 'box', at: [0.33, 1.6, -0.65], size: [0.06, 0.8, 1.2], mtl: 'glazing', colour: PALETTE.parapet }, // corner-glazing
  { shape: 'box', at: [0.33, 3.1, -0.65], size: [0.06, 0.8, 1.2], mtl: 'glazing', colour: PALETTE.parapet }, // corner-glazing
  { shape: 'box', at: [-0.15, 1.72, 0.04], size: [0.8, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // corner-glazing
  { shape: 'box', at: [-0.15, 3.05, 0.04], size: [0.8, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // corner-glazing
  { shape: 'box', at: [-0.95, 1.6, 1.53], size: [0.6, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // corner-glazing
  { shape: 'box', at: [-0.95, 3.05, 1.53], size: [0.6, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // corner-glazing
  { shape: 'box', at: [-1.33, 2.3, -0.65], size: [0.06, 0.9, 1.2], mtl: 'glazing', colour: PALETTE.parapet }, // corner-glazing
  { shape: 'box', at: [-0.5, 2.35, -0.65], size: [1.66, 0.14, 1.36], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-0.95, 2.35, 0.75], size: [0.76, 0.14, 1.56], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-0.5, 4.72, -0.65], size: [1.76, 0.24, 1.46], mtl: 'trim-grey', colour: PALETTE.kerb }, // wing-caps
  { shape: 'box', at: [-0.95, 3.62, 0.75], size: [0.86, 0.24, 1.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // wing-caps
  { shape: 'box', at: [0.62, 0.22, 0.68], size: [1.36, 0.44, 1.36], mtl: 'garden-path', colour: PALETTE.land }, // deck
  { shape: 'box', at: [0.62, 0.66, 1.32], size: [1.36, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // deck-rail
  { shape: 'box', at: [1.26, 0.66, 0.68], size: [0.08, 0.08, 1.36], mtl: 'railing-pale', colour: PALETTE.awning }, // deck-rail
  { shape: 'box', at: [-0.02, 0.55, 1.32], size: [0.07, 0.34, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // deck-rail
  { shape: 'box', at: [1.26, 0.55, 1.32], size: [0.07, 0.34, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // deck-rail
  { shape: 'box', at: [1.26, 0.55, 0.09], size: [0.07, 0.34, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // deck-rail
  { shape: 'box', at: [-0.95, 3.95, 1.5], size: [0.86, 0.42, 0.1], mtl: 'railing-pale', colour: PALETTE.awning }, // roof-terrace
  { shape: 'box', at: [-1.34, 3.95, 0.75], size: [0.1, 0.42, 1.6], mtl: 'railing-pale', colour: PALETTE.awning }, // roof-terrace
  { shape: 'box', at: [-0.56, 3.95, 0.75], size: [0.1, 0.42, 1.6], mtl: 'railing-pale', colour: PALETTE.awning }, // roof-terrace
  { shape: 'box', at: [-0.05, 0.86, 0.03], size: [0.5, 0.84, 0.1], mtl: 'door-timber', colour: PALETTE.door }, // entry
  { shape: 'box', at: [0.62, 0.07, 1.53], size: [0.8, 0.14, 0.18], mtl: 'garden-path', colour: PALETTE.land }, // steps
  { shape: 'box', at: [0.62, 0.21, 1.42], size: [0.7, 0.14, 0.16], mtl: 'garden-path', colour: PALETTE.land }, // steps
  { shape: 'box', at: [-0.5, 1.98, -0.65], size: [1.66, 0.08, 1.36], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-0.95, 1.98, 0.75], size: [0.76, 0.08, 1.56], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [1.42, 0.2, 0.4], size: [0.24, 0.4, 2], mtl: 'garden-hedge', colour: PALETTE.hedge }, // hedge
];

/** Style 5 — the mansard: a corniced block under a dormered top floor behind a parapet. */
export const WALKUP_MANSARD_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 1.75, 0], size: [2.6, 3.5, 2.6], mtl: 'wall-concrete', colour: PALETTE.concrete }, // body
  { shape: 'box', at: [0, 3.62, 0], size: [2.8, 0.24, 2.8], mtl: 'trim-grey', colour: PALETTE.kerb }, // cornice
  { shape: 'box', at: [0, 1.9, 0], size: [2.7, 0.14, 2.7], mtl: 'trim-grey', colour: PALETTE.kerb }, // cornice
  { shape: 'box', at: [0, 4.2, 0], size: [2.16, 0.9, 2.16], mtl: 'roof-tile', colour: PALETTE.walkupRoof }, // mansard-floor
  { shape: 'box', at: [0, 3.94, 1.21], size: [2.8, 0.4, 0.18], mtl: 'wall-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [0, 3.94, -1.21], size: [2.8, 0.4, 0.18], mtl: 'wall-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [-1.21, 3.94, 0], size: [0.18, 0.4, 2.8], mtl: 'wall-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [1.21, 3.94, 0], size: [0.18, 0.4, 2.8], mtl: 'wall-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [0, 4.72, 0], size: [2.3, 0.14, 2.3], mtl: 'trim-grey', colour: PALETTE.kerb }, // mansard-cap
  { shape: 'box', at: [-0.78, 4.28, 1.11], size: [0.5, 0.66, 0.16], mtl: 'roof-tile', colour: PALETTE.walkupRoof }, // dormers
  { shape: 'box', at: [0, 4.28, 1.11], size: [0.5, 0.66, 0.16], mtl: 'roof-tile', colour: PALETTE.walkupRoof }, // dormers
  { shape: 'box', at: [0.78, 4.28, 1.11], size: [0.5, 0.66, 0.16], mtl: 'roof-tile', colour: PALETTE.walkupRoof }, // dormers
  { shape: 'box', at: [-0.78, 4.28, 1.2], size: [0.36, 0.48, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // dormer-glazing
  { shape: 'box', at: [0, 4.28, 1.2], size: [0.36, 0.48, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // dormer-glazing
  { shape: 'box', at: [0.78, 4.28, 1.2], size: [0.36, 0.48, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // dormer-glazing
  { shape: 'box', at: [-0.78, 0.8, 1.31], size: [0.46, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 0.8, 1.31], size: [0.46, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.78, 0.8, 1.31], size: [0.46, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.78, 2.5, 1.31], size: [0.46, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 2.5, 1.31], size: [0.46, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0.78, 2.5, 1.31], size: [0.46, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.31, 0.8, -0.6], size: [0.06, 0.8, 0.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.31, 2.5, -0.6], size: [0.06, 0.8, 0.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.31, 0.8, -0.6], size: [0.06, 0.8, 0.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.31, 2.5, -0.6], size: [0.06, 0.8, 0.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 1.3, 0], size: [2.66, 0.08, 2.66], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 3, 0], size: [2.66, 0.08, 2.66], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 0.55, 1.33], size: [0.56, 1.1, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // door
  { shape: 'box', at: [-0.36, 0.62, 1.36], size: [0.14, 1.24, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // door-surround
  { shape: 'box', at: [0.36, 0.62, 1.36], size: [0.14, 1.24, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // door-surround
  { shape: 'box', at: [0, 1.29, 1.36], size: [0.86, 0.14, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // door-surround
  { shape: 'box', at: [0, 0.05, 1.47], size: [0.84, 0.1, 0.22], mtl: 'garden-path', colour: PALETTE.land }, // steps
  { shape: 'box', at: [0, 0.15, 1.36], size: [0.72, 0.1, 0.18], mtl: 'garden-path', colour: PALETTE.land }, // steps
  { shape: 'box', at: [-0.4, 0.41, 1.44], size: [0.08, 0.62, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // railings
  { shape: 'box', at: [0.4, 0.41, 1.44], size: [0.08, 0.62, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // railings
];
