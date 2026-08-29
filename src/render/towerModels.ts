import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-3 towers, as part tables.
 *
 * Housing's third rung, and the first modelled building anywhere in the city
 * that stands on a *merged parcel*. `LEVEL_FOOTPRINT` is [1, 1, 2, 2, 2], so
 * promotion to this rung is the merge: two neighbouring plots become one
 * building covering both. Every model here is built to that parcel rather than
 * to a plot — 6.8 along it by 2.8 across, which is `MERGED_SPAN` by
 * `ZONE_SHAPES.home[2].width` exactly, and 11.5 tall to match its row.
 *
 * That oblong footprint is the whole of what makes this rung different to draw,
 * and it costs two rules the rungs below did not need:
 *
 *   - **a tower cannot turn freely.** A house picks any of the four sides its
 *     plot fronts; a tower has to lay its long axis along its parcel, so only
 *     two of the four are candidates and the street choice happens within
 *     those. See `modelFacing`, which takes the parcel axis for this;
 *   - **its two spans are bounded differently.** A single-plot model is capped
 *     on whichever span the turn puts across the frontage, because either can
 *     be. A tower's long span always lies along the parcel and its short span
 *     always across it, so they answer to 2 x CELL and to CELL respectively.
 *     See `jitterCap`.
 *
 * A tower also carries the warning light its row asks for — `beacon: true` from
 * this rung up — which no modelled rung needed before. It is written from the
 * model's own top by `writeModelParts` rather than baked in, because a beacon
 * is a *light*: it ramps with the daylight cycle, and a vertex-colour merge has
 * one material for the whole model. Same trick as the window lights.
 *
 * What these have to say that a walk-up does not is *height without bulk*. The
 * rung below is a block a player reads as a building; this is the first one
 * they read as a tower, and the four silhouettes that are not the twins all
 * make their height legible the same way — a vertical run of something, fins,
 * crosswalls, a lift shaft, a stack of setbacks — rather than by being a taller
 * box. The twins say it by standing two shafts of unequal height side by side,
 * which is the one reading that needs no vertical line at all.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/towerN.obj models/towerN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 *
 * These are the largest models in the city — 67 to 241 boxes against a house's
 * 17 to 23 — and the balcony slab is most of that on its own, with 120 of its
 * 241 boxes in balcony rails. That is measured rather than guessed and it is
 * the strongest argument yet for the silhouette geometry `ModelMeshes` sets out
 * and deliberately does not build; see part 1d of `npm run lod:calibrate`.
 */

/** Style 1 — the balcony slab: ten floors of projecting balconies behind fluted fins. */
export const TOWER_BALCONY_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 5.75, 0], size: [6.8, 11.5, 2.8], mtl: 'wall-concrete', colour: PALETTE.concrete }, // body
  { shape: 'box', at: [-3.4, 5.75, 1.52], size: [0.16, 11.5, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [-2.04, 5.75, 1.52], size: [0.16, 11.5, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [-0.68, 5.75, 1.52], size: [0.16, 11.5, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [0.68, 5.75, 1.52], size: [0.16, 11.5, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [2.04, 5.75, 1.52], size: [0.16, 11.5, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [3.4, 5.75, 1.52], size: [0.16, 11.5, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [0, 1.278, 0], size: [6.88, 0.12, 2.88], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0, 2.556, 0], size: [6.88, 0.12, 2.88], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0, 3.833, 0], size: [6.88, 0.12, 2.88], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0, 5.111, 0], size: [6.88, 0.12, 2.88], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0, 6.389, 0], size: [6.88, 0.12, 2.88], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0, 7.667, 0], size: [6.88, 0.12, 2.88], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0, 8.944, 0], size: [6.88, 0.12, 2.88], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0, 10.222, 0], size: [6.88, 0.12, 2.88], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.72, 1.338, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-1.36, 1.338, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [0, 1.338, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [1.36, 1.338, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [2.72, 1.338, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-2.72, 2.616, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-1.36, 2.616, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [0, 2.616, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [1.36, 2.616, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [2.72, 2.616, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-2.72, 3.893, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-1.36, 3.893, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [0, 3.893, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [1.36, 3.893, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [2.72, 3.893, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-2.72, 5.171, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-1.36, 5.171, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [0, 5.171, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [1.36, 5.171, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [2.72, 5.171, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-2.72, 6.449, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-1.36, 6.449, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [0, 6.449, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [1.36, 6.449, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [2.72, 6.449, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-2.72, 7.727, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-1.36, 7.727, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [0, 7.727, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [1.36, 7.727, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [2.72, 7.727, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-2.72, 9.004, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-1.36, 9.004, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [0, 9.004, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [1.36, 9.004, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [2.72, 9.004, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-2.72, 10.282, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-1.36, 10.282, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [0, 10.282, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [1.36, 10.282, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [2.72, 10.282, 1.49], size: [1.02, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // balconies
  { shape: 'box', at: [-2.72, 1.698, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-3.2, 1.548, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.24, 1.548, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.36, 1.698, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.84, 1.548, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.88, 1.548, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0, 1.698, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.48, 1.548, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.48, 1.548, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.36, 1.698, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.88, 1.548, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.84, 1.548, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.72, 1.698, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.24, 1.548, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [3.2, 1.548, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.72, 2.976, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-3.2, 2.826, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.24, 2.826, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.36, 2.976, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.84, 2.826, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.88, 2.826, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0, 2.976, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.48, 2.826, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.48, 2.826, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.36, 2.976, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.88, 2.826, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.84, 2.826, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.72, 2.976, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.24, 2.826, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [3.2, 2.826, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.72, 4.253, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-3.2, 4.103, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.24, 4.103, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.36, 4.253, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.84, 4.103, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.88, 4.103, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0, 4.253, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.48, 4.103, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.48, 4.103, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.36, 4.253, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.88, 4.103, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.84, 4.103, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.72, 4.253, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.24, 4.103, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [3.2, 4.103, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.72, 5.531, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-3.2, 5.381, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.24, 5.381, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.36, 5.531, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.84, 5.381, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.88, 5.381, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0, 5.531, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.48, 5.381, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.48, 5.381, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.36, 5.531, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.88, 5.381, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.84, 5.381, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.72, 5.531, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.24, 5.381, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [3.2, 5.381, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.72, 6.809, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-3.2, 6.659, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.24, 6.659, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.36, 6.809, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.84, 6.659, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.88, 6.659, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0, 6.809, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.48, 6.659, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.48, 6.659, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.36, 6.809, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.88, 6.659, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.84, 6.659, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.72, 6.809, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.24, 6.659, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [3.2, 6.659, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.72, 8.087, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-3.2, 7.937, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.24, 7.937, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.36, 8.087, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.84, 7.937, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.88, 7.937, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0, 8.087, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.48, 7.937, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.48, 7.937, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.36, 8.087, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.88, 7.937, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.84, 7.937, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.72, 8.087, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.24, 7.937, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [3.2, 7.937, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.72, 9.364, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-3.2, 9.214, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.24, 9.214, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.36, 9.364, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.84, 9.214, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.88, 9.214, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0, 9.364, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.48, 9.214, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.48, 9.214, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.36, 9.364, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.88, 9.214, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.84, 9.214, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.72, 9.364, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.24, 9.214, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [3.2, 9.214, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.72, 10.642, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-3.2, 10.492, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.24, 10.492, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.36, 10.642, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-1.84, 10.492, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.88, 10.492, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0, 10.642, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-0.48, 10.492, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.48, 10.492, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.36, 10.642, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [0.88, 10.492, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [1.84, 10.492, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.72, 10.642, 1.54], size: [1.02, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [2.24, 10.492, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [3.2, 10.492, 1.54], size: [0.07, 0.36, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // balcony-rails
  { shape: 'box', at: [-2.72, 0.699, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 0.699, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 0.699, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 0.699, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 1.977, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 1.977, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 1.977, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 1.977, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 1.977, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 3.254, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 3.254, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 3.254, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 3.254, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 3.254, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 4.532, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 4.532, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 4.532, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 4.532, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 4.532, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 5.81, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 5.81, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 5.81, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 5.81, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 5.81, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 7.088, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 7.088, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 7.088, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 7.088, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 7.088, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 8.366, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 8.366, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 8.366, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 8.366, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 8.366, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 9.643, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 9.643, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 9.643, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 9.643, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 9.643, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 10.921, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 10.921, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 10.921, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 10.921, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 10.921, 1.44], size: [0.92, 0.72, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 0.639, -0.4], size: [0.06, 0.72, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 0.639, -0.4], size: [0.06, 0.72, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 3.194, -0.4], size: [0.06, 0.72, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 3.194, -0.4], size: [0.06, 0.72, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 5.75, -0.4], size: [0.06, 0.72, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 5.75, -0.4], size: [0.06, 0.72, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 8.306, -0.4], size: [0.06, 0.72, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 8.306, -0.4], size: [0.06, 0.72, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 10.861, -0.4], size: [0.06, 0.72, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 10.861, -0.4], size: [0.06, 0.72, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 2.317, 0], size: [6.85, 0.07, 2.85], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 4.872, 0], size: [6.85, 0.07, 2.85], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 7.428, 0], size: [6.85, 0.07, 2.85], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 9.983, 0], size: [6.85, 0.07, 2.85], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 11.61, 0], size: [6.96, 0.22, 2.96], mtl: 'trim-grey', colour: PALETTE.kerb }, // roof
  { shape: 'box', at: [-2.2, 11.97, -0.5], size: [1.5, 0.5, 1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [1.9, 11.92, -0.4], size: [1, 0.4, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [0, 0.62, 1.48], size: [0.68, 1.24, 0.08], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.38, 1.55], size: [1.08, 0.14, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy
  { shape: 'box', at: [-0.46, 0.69, 1.55], size: [0.1, 1.38, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0.46, 0.69, 1.55], size: [0.1, 1.38, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0, 0.03, 1.57], size: [1.08, 0.06, 0.08], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
];

/** Style 2 — the crosswall block: brick party walls with glazed slots recessed between. */
export const TOWER_CROSSWALL_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 5.75, -0.2], size: [6.8, 11.5, 2.4], mtl: 'wall-concrete', colour: PALETTE.concrete }, // body
  { shape: 'box', at: [-3.4, 5.78, 0.05], size: [0.2, 11.56, 2.7], mtl: 'wall-brick', colour: PALETTE.tile }, // crosswalls
  { shape: 'box', at: [-2.04, 5.78, 0.05], size: [0.2, 11.56, 2.7], mtl: 'wall-brick', colour: PALETTE.tile }, // crosswalls
  { shape: 'box', at: [-0.68, 5.78, 0.05], size: [0.2, 11.56, 2.7], mtl: 'wall-brick', colour: PALETTE.tile }, // crosswalls
  { shape: 'box', at: [0.68, 5.78, 0.05], size: [0.2, 11.56, 2.7], mtl: 'wall-brick', colour: PALETTE.tile }, // crosswalls
  { shape: 'box', at: [2.04, 5.78, 0.05], size: [0.2, 11.56, 2.7], mtl: 'wall-brick', colour: PALETTE.tile }, // crosswalls
  { shape: 'box', at: [3.4, 5.78, 0.05], size: [0.2, 11.56, 2.7], mtl: 'wall-brick', colour: PALETTE.tile }, // crosswalls
  { shape: 'box', at: [-3.4, 11.71, 0.05], size: [0.28, 0.3, 2.8], mtl: 'trim-grey', colour: PALETTE.kerb }, // wall-caps
  { shape: 'box', at: [-2.04, 11.71, 0.05], size: [0.28, 0.3, 2.8], mtl: 'trim-grey', colour: PALETTE.kerb }, // wall-caps
  { shape: 'box', at: [-0.68, 11.71, 0.05], size: [0.28, 0.3, 2.8], mtl: 'trim-grey', colour: PALETTE.kerb }, // wall-caps
  { shape: 'box', at: [0.68, 11.71, 0.05], size: [0.28, 0.3, 2.8], mtl: 'trim-grey', colour: PALETTE.kerb }, // wall-caps
  { shape: 'box', at: [2.04, 11.71, 0.05], size: [0.28, 0.3, 2.8], mtl: 'trim-grey', colour: PALETTE.kerb }, // wall-caps
  { shape: 'box', at: [3.4, 11.71, 0.05], size: [0.28, 0.3, 2.8], mtl: 'trim-grey', colour: PALETTE.kerb }, // wall-caps
  { shape: 'box', at: [-2.72, 0.639, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-2.72, 1.917, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-2.72, 3.194, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-2.72, 4.472, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-2.72, 5.75, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-2.72, 7.028, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-2.72, 8.306, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-2.72, 9.583, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-2.72, 10.861, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-1.36, 0.639, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-1.36, 1.917, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-1.36, 3.194, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-1.36, 4.472, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-1.36, 5.75, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-1.36, 7.028, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-1.36, 8.306, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-1.36, 9.583, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-1.36, 10.861, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [0, 1.917, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [0, 3.194, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [0, 4.472, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [0, 5.75, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [0, 7.028, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [0, 8.306, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [0, 9.583, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [0, 10.861, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [1.36, 0.639, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [1.36, 1.917, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [1.36, 3.194, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [1.36, 4.472, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [1.36, 5.75, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [1.36, 7.028, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [1.36, 8.306, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [1.36, 9.583, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [1.36, 10.861, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [2.72, 0.639, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [2.72, 1.917, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [2.72, 3.194, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [2.72, 4.472, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [2.72, 5.75, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [2.72, 7.028, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [2.72, 8.306, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [2.72, 9.583, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [2.72, 10.861, 1.04], size: [0.86, 0.98, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // slot-glazing
  { shape: 'box', at: [-2.72, 1.278, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-2.72, 2.556, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-2.72, 3.833, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-2.72, 5.111, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-2.72, 6.389, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-2.72, 7.667, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-2.72, 8.944, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-2.72, 10.222, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-1.36, 1.278, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-1.36, 2.556, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-1.36, 3.833, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-1.36, 5.111, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-1.36, 6.389, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-1.36, 7.667, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-1.36, 8.944, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-1.36, 10.222, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [0, 2.556, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [0, 3.833, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [0, 5.111, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [0, 6.389, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [0, 7.667, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [0, 8.944, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [0, 10.222, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [1.36, 1.278, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [1.36, 2.556, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [1.36, 3.833, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [1.36, 5.111, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [1.36, 6.389, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [1.36, 7.667, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [1.36, 8.944, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [1.36, 10.222, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [2.72, 1.278, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [2.72, 2.556, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [2.72, 3.833, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [2.72, 5.111, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [2.72, 6.389, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [2.72, 7.667, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [2.72, 8.944, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [2.72, 10.222, 1.11], size: [1.34, 0.28, 0.08], mtl: 'trim-grey', colour: PALETTE.kerb }, // slot-spandrels
  { shape: 'box', at: [-3.44, 0.639, -0.9], size: [0.06, 0.8, 1], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 0.639, -0.9], size: [0.06, 0.8, 1], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 3.194, -0.9], size: [0.06, 0.8, 1], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 3.194, -0.9], size: [0.06, 0.8, 1], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 5.75, -0.9], size: [0.06, 0.8, 1], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 5.75, -0.9], size: [0.06, 0.8, 1], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 8.306, -0.9], size: [0.06, 0.8, 1], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 8.306, -0.9], size: [0.06, 0.8, 1], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 10.861, -0.9], size: [0.06, 0.8, 1], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [3.44, 10.861, -0.9], size: [0.06, 0.8, 1], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 2.337, -0.2], size: [6.85, 0.07, 2.45], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 4.892, -0.2], size: [6.85, 0.07, 2.45], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 7.448, -0.2], size: [6.85, 0.07, 2.45], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 10.003, -0.2], size: [6.85, 0.07, 2.45], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 11.62, -0.16], size: [6.7, 0.24, 2.42], mtl: 'trim-grey', colour: PALETTE.kerb }, // roof
  { shape: 'box', at: [-1.8, 12.02, -0.8], size: [1.6, 0.56, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [0, 0.62, 1.08], size: [0.56, 1.24, 0.08], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.38, 1.15], size: [0.96, 0.14, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy
  { shape: 'box', at: [-0.4, 0.69, 1.15], size: [0.1, 1.38, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0.4, 0.69, 1.15], size: [0.1, 1.38, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0, 0.03, 1.17], size: [0.96, 0.06, 0.08], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
];

/** Style 3 — the gallery block: flats off open galleries, served by a brick lift tower. */
export const TOWER_GALLERY_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-0.65, 5.75, 0], size: [5.5, 11.5, 2.8], mtl: 'wall-concrete', colour: PALETTE.concrete }, // body
  { shape: 'box', at: [2.75, 6.35, 0], size: [1.3, 12.7, 2.8], mtl: 'wall-brick', colour: PALETTE.tile }, // lift-tower
  { shape: 'box', at: [2.75, 12.83, 0], size: [1.48, 0.26, 2.98], mtl: 'trim-grey', colour: PALETTE.kerb }, // tower-cap
  { shape: 'box', at: [2.85, 7.25, 1.44], size: [0.8, 9.3, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // tower-glazing
  { shape: 'box', at: [-3.4, 5.75, 1.49], size: [0.16, 11.5, 0.24], mtl: 'wall-concrete', colour: PALETTE.concrete }, // gallery-piers
  { shape: 'box', at: [-2.04, 5.75, 1.49], size: [0.16, 11.5, 0.24], mtl: 'wall-concrete', colour: PALETTE.concrete }, // gallery-piers
  { shape: 'box', at: [-0.68, 5.75, 1.49], size: [0.16, 11.5, 0.24], mtl: 'wall-concrete', colour: PALETTE.concrete }, // gallery-piers
  { shape: 'box', at: [0.68, 5.75, 1.49], size: [0.16, 11.5, 0.24], mtl: 'wall-concrete', colour: PALETTE.concrete }, // gallery-piers
  { shape: 'box', at: [2.04, 5.75, 1.49], size: [0.16, 11.5, 0.24], mtl: 'wall-concrete', colour: PALETTE.concrete }, // gallery-piers
  { shape: 'box', at: [-0.65, 1.278, 1.49], size: [5.5, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // galleries
  { shape: 'box', at: [-0.65, 2.556, 1.49], size: [5.5, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // galleries
  { shape: 'box', at: [-0.65, 3.833, 1.49], size: [5.5, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // galleries
  { shape: 'box', at: [-0.65, 5.111, 1.49], size: [5.5, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // galleries
  { shape: 'box', at: [-0.65, 6.389, 1.49], size: [5.5, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // galleries
  { shape: 'box', at: [-0.65, 7.667, 1.49], size: [5.5, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // galleries
  { shape: 'box', at: [-0.65, 8.944, 1.49], size: [5.5, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // galleries
  { shape: 'box', at: [-0.65, 10.222, 1.49], size: [5.5, 0.12, 0.18], mtl: 'trim-grey', colour: PALETTE.kerb }, // galleries
  { shape: 'box', at: [-0.65, 1.678, 1.54], size: [5.5, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 1.498, 1.54], size: [5.5, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 2.956, 1.54], size: [5.5, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 2.776, 1.54], size: [5.5, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 4.233, 1.54], size: [5.5, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 4.053, 1.54], size: [5.5, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 5.511, 1.54], size: [5.5, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 5.331, 1.54], size: [5.5, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 6.789, 1.54], size: [5.5, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 6.609, 1.54], size: [5.5, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 8.067, 1.54], size: [5.5, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 7.887, 1.54], size: [5.5, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 9.344, 1.54], size: [5.5, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 9.164, 1.54], size: [5.5, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 10.622, 1.54], size: [5.5, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-0.65, 10.442, 1.54], size: [5.5, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // gallery-rails
  { shape: 'box', at: [-2.72, 1.798, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-1.36, 1.798, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [0, 1.798, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [1.36, 1.798, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-2.72, 3.076, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-1.36, 3.076, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [0, 3.076, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [1.36, 3.076, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-2.72, 4.353, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-1.36, 4.353, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [0, 4.353, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [1.36, 4.353, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-2.72, 5.631, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-1.36, 5.631, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [0, 5.631, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [1.36, 5.631, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-2.72, 6.909, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-1.36, 6.909, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [0, 6.909, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [1.36, 6.909, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-2.72, 8.187, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-1.36, 8.187, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [0, 8.187, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [1.36, 8.187, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-2.72, 9.464, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-1.36, 9.464, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [0, 9.464, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [1.36, 9.464, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-2.72, 10.742, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-1.36, 10.742, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [0, 10.742, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [1.36, 10.742, 1.47], size: [0.44, 0.92, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // flat-doors
  { shape: 'box', at: [-2.72, 0.639, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 0.639, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 0.639, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 0.639, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 1.917, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 1.917, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 1.917, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 1.917, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 3.194, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 3.194, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 3.194, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 3.194, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 4.472, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 4.472, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 4.472, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 4.472, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 5.75, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 5.75, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 5.75, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 5.75, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 7.028, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 7.028, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 7.028, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 7.028, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 8.306, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 8.306, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 8.306, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 8.306, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 9.583, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 9.583, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 9.583, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 9.583, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 10.861, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 10.861, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 10.861, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 10.861, -1.44], size: [0.86, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 0.639, 0], size: [0.06, 0.8, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 3.194, 0], size: [0.06, 0.8, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 5.75, 0], size: [0.06, 0.8, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 8.306, 0], size: [0.06, 0.8, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-3.44, 10.861, 0], size: [0.06, 0.8, 1.6], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-0.65, 2.317, 0], size: [5.55, 0.07, 2.85], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-0.65, 4.872, 0], size: [5.55, 0.07, 2.85], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-0.65, 7.428, 0], size: [5.55, 0.07, 2.85], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-0.65, 9.983, 0], size: [5.55, 0.07, 2.85], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-0.65, 11.61, 0], size: [5.62, 0.22, 2.94], mtl: 'trim-grey', colour: PALETTE.kerb }, // roof
  { shape: 'box', at: [-1.25, 11.98, -0.7], size: [1.6, 0.52, 0.8], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [2.74, 0.62, 1.48], size: [0.6, 1.24, 0.08], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [2.74, 1.38, 1.55], size: [1, 0.14, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy
  { shape: 'box', at: [2.32, 0.69, 1.55], size: [0.1, 1.38, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [3.16, 0.69, 1.55], size: [0.1, 1.38, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [2.74, 0.03, 1.57], size: [1, 0.06, 0.08], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
];

/** Style 4 — the terraced tower: three setback tiers, the two roofs they free up planted. */
export const TOWER_TERRACE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-2.04, 5.75, 0], size: [2.72, 11.5, 2.8], mtl: 'wall-concrete', colour: PALETTE.concrete }, // tiers
  { shape: 'box', at: [0.408, 4.14, 0], size: [2.176, 8.28, 2.8], mtl: 'wall-concrete', colour: PALETTE.concrete }, // tiers
  { shape: 'box', at: [2.448, 2.645, 0], size: [1.904, 5.29, 2.8], mtl: 'wall-concrete', colour: PALETTE.concrete }, // tiers
  { shape: 'box', at: [-2.04, 11.61, 0], size: [2.86, 0.22, 3], mtl: 'trim-grey', colour: PALETTE.kerb }, // tier-caps
  { shape: 'box', at: [0.408, 8.39, 0], size: [2.316, 0.22, 3], mtl: 'trim-grey', colour: PALETTE.kerb }, // tier-caps
  { shape: 'box', at: [2.448, 5.4, 0], size: [2.044, 0.22, 3], mtl: 'trim-grey', colour: PALETTE.kerb }, // tier-caps
  { shape: 'box', at: [0.408, 8.63, 0.3], size: [1.676, 0.26, 1.8], mtl: 'roof-garden', colour: PALETTE.hedge }, // roof-gardens
  { shape: 'box', at: [2.448, 5.64, 0.3], size: [1.404, 0.26, 1.8], mtl: 'roof-garden', colour: PALETTE.hedge }, // roof-gardens
  { shape: 'box', at: [0.408, 8.9, 1.3], size: [1.976, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [-0.56, 8.7, 1.3], size: [0.07, 0.42, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [1.376, 8.7, 1.3], size: [0.07, 0.42, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [2.448, 5.91, 1.3], size: [1.704, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [1.616, 5.71, 1.3], size: [0.07, 0.42, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [3.28, 5.71, 1.3], size: [0.07, 0.42, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [-2.72, 0.639, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 1.917, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 1.917, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 3.194, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 3.194, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 4.472, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 4.472, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 5.75, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 5.75, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 7.028, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 7.028, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 8.306, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 8.306, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 9.583, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 9.583, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 10.861, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 10.861, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 0.639, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 1.917, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 3.194, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 4.472, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 5.75, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 7.028, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 0.639, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 1.917, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 3.194, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 4.472, 1.44], size: [0.86, 0.76, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.04, 1.278, 0], size: [2.78, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.04, 2.556, 0], size: [2.78, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.04, 3.833, 0], size: [2.78, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.04, 5.111, 0], size: [2.78, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.04, 6.389, 0], size: [2.78, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.04, 7.667, 0], size: [2.78, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.04, 8.944, 0], size: [2.78, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.04, 10.222, 0], size: [2.78, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0.408, 1.278, 0], size: [2.236, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0.408, 2.556, 0], size: [2.236, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0.408, 3.833, 0], size: [2.236, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0.408, 5.111, 0], size: [2.236, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0.408, 6.389, 0], size: [2.236, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [0.408, 7.667, 0], size: [2.236, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [2.448, 1.278, 0], size: [1.964, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [2.448, 2.556, 0], size: [1.964, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [2.448, 3.833, 0], size: [1.964, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.04, 5.75, 0], size: [2.76, 0.07, 2.84], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0.408, 4.14, 0], size: [2.216, 0.07, 2.84], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [2.448, 2.645, 0], size: [1.944, 0.07, 2.84], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-2.04, 11.98, -0.6], size: [1.4, 0.52, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [-1.36, 0.62, 1.48], size: [0.68, 1.24, 0.08], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [-1.36, 1.38, 1.55], size: [1.08, 0.14, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy
  { shape: 'box', at: [-1.82, 0.69, 1.55], size: [0.1, 1.38, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [-0.9, 0.69, 1.55], size: [0.1, 1.38, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [-1.36, 0.03, 1.57], size: [1.08, 0.06, 0.08], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
];

/** Style 5 — the twins: two shafts of unequal height joined by a low link block. */
export const TOWER_TWIN_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-2.25, 5.75, 0], size: [2.3, 11.5, 2.8], mtl: 'wall-concrete', colour: PALETTE.concrete }, // towers
  { shape: 'box', at: [2.25, 4.715, 0], size: [2.3, 9.43, 2.8], mtl: 'wall-concrete', colour: PALETTE.concrete }, // towers
  { shape: 'box', at: [0, 2.3, 0], size: [2.2, 4.6, 2.2], mtl: 'wall-brick', colour: PALETTE.tile }, // link-block
  { shape: 'box', at: [-2.25, 11.61, 0], size: [2.46, 0.22, 2.96], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [2.25, 9.54, 0], size: [2.46, 0.22, 2.96], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [0, 4.7, 0], size: [2.32, 0.2, 2.36], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [0, 4.93, 0.2], size: [1.9, 0.26, 1.6], mtl: 'roof-garden', colour: PALETTE.hedge }, // link-terrace
  { shape: 'box', at: [0, 5.2, 1.05], size: [2.1, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // terrace-rails
  { shape: 'box', at: [-1.02, 5, 1.05], size: [0.07, 0.42, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // terrace-rails
  { shape: 'box', at: [1.02, 5, 1.05], size: [0.07, 0.42, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // terrace-rails
  { shape: 'box', at: [-2.25, 6.45, -0.5], size: [0.9, 12.9, 0.9], mtl: 'wall-brick', colour: PALETTE.tile }, // cores
  { shape: 'box', at: [2.25, 5.215, -0.5], size: [0.8, 10.43, 0.8], mtl: 'wall-brick', colour: PALETTE.tile }, // cores
  { shape: 'box', at: [-2.25, 13.02, -0.5], size: [1.06, 0.24, 1.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // core-caps
  { shape: 'box', at: [2.25, 10.55, -0.5], size: [0.96, 0.24, 0.96], mtl: 'trim-grey', colour: PALETTE.kerb }, // core-caps
  { shape: 'box', at: [-2.8, 1.917, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.7, 1.917, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.8, 3.194, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.7, 3.194, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.8, 4.472, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.7, 4.472, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.8, 5.75, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.7, 5.75, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.8, 7.028, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.7, 7.028, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.8, 8.306, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.7, 8.306, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.8, 9.583, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.7, 9.583, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.8, 10.861, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.7, 10.861, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.7, 0.639, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.8, 0.639, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.7, 1.917, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.8, 1.917, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.7, 3.194, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.8, 3.194, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.7, 4.472, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.8, 4.472, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.7, 5.75, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.8, 5.75, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.7, 7.028, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.8, 7.028, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.7, 8.306, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.8, 8.306, 1.44], size: [0.8, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 0.639, 1.14], size: [1.7, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 1.917, 1.14], size: [1.7, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 3.194, 1.14], size: [1.7, 0.78, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.25, 1.278, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.25, 2.556, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.25, 3.833, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.25, 5.111, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.25, 6.389, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.25, 7.667, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.25, 8.944, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.25, 10.222, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [2.25, 1.278, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [2.25, 2.556, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [2.25, 3.833, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [2.25, 5.111, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [2.25, 6.389, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [2.25, 7.667, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [2.25, 8.944, 0], size: [2.36, 0.09, 2.86], mtl: 'trim-grey', colour: PALETTE.kerb }, // floor-bands
  { shape: 'box', at: [-2.25, 5.75, 0], size: [2.34, 0.07, 2.84], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [2.25, 4.715, 0], size: [2.34, 0.07, 2.84], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-1.65, 11.96, 0.7], size: [0.9, 0.48, 0.8], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [-2.25, 0.62, 1.48], size: [1.2, 1.24, 0.08], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [-2.25, 1.38, 1.55], size: [1.98, 0.14, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy
  { shape: 'box', at: [-3.16, 0.69, 1.55], size: [0.1, 1.38, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [-1.34, 0.69, 1.55], size: [0.1, 1.38, 0.1], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [-2.25, 0.03, 1.57], size: [1.98, 0.06, 0.08], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
];
