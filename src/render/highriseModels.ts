import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-4 arcologies, as part tables.
 *
 * Housing's fourth rung, and the second to stand on a merged parcel. The rung
 * below brought the merge and everything that follows from it — the split
 * jitter bound, the parcel-axis turn, the beacon off the model's own top — so
 * this rung needed none of it built and simply arrives into it. That is the
 * shape a fourth entry in `MODELS.home` should have: the towers paid for the
 * mechanism and the arcologies use it.
 *
 * Built to their row like every rung before them: 6.8 along the parcel by 3.0
 * across, which is `MERGED_SPAN` by `ZONE_SHAPES.home[3].width`, and 22 tall to
 * match. The models reach 22.8 with their rooftop plant on, which is the same
 * relationship the towers have to their own row — a model's height is its whole
 * silhouette and the row states its body.
 *
 * What these have to say that a tower does not is that the city has stopped
 * being made of buildings and started being made of *slabs*. A tower is 11.5
 * tall and still reads as something with floors you could count; at 22 it does
 * not, so every one of these carries a single full-height idea — a run of fins,
 * a stack of loggias, a notch, a flight of setbacks, an expressed frame —
 * rather than more of the storey-by-storey articulation the rungs below use.
 * That is also what keeps them legible at the distance they are actually seen
 * from, which is further out than any rung below.
 *
 * The notched shafts carry **eight** lit pieces, which is the most any model in
 * the city has and one more than the mill's seven. It widens `BANDS_MAX` and
 * with it the reserved part stride — see `PART_SLOTS`, which is derived from it
 * for exactly this reason: a remodel that wanted a ninth would widen it again
 * rather than silently dropping the ninth.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/highriseN.obj models/highriseN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 *
 * These are the first five to arrive with **no refusals at all** — no welded
 * lump anywhere in them, so `model:solids` had nothing to split. Worth writing
 * down because the converter's refusals have never been a complaint about the
 * models: they are a complaint about how a modeller happened to group them, and
 * five clean exports in a row is what that looks like when it goes right.
 */

/** Style 1 — the fin slab: a glazed slab ribbed top to bottom by shallow fins. */
export const HIGHRISE_FIN_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 11, 0], size: [6.8, 22, 3], mtl: 'wall-concrete', colour: PALETTE.concrete }, // body
  { shape: 'box', at: [-3.4, 11, 1.58], size: [0.18, 22, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [-2.04, 11, 1.58], size: [0.18, 22, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [-0.68, 11, 1.58], size: [0.18, 22, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [0.68, 11, 1.58], size: [0.18, 22, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [2.04, 11, 1.58], size: [0.18, 22, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [3.4, 11, 1.58], size: [0.18, 22, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // fins
  { shape: 'box', at: [-2.72, 11.65, 1.545], size: [1.02, 19.5, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // bay-glazing
  { shape: 'box', at: [-1.36, 11.65, 1.545], size: [1.02, 19.5, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // bay-glazing
  { shape: 'box', at: [0, 11.65, 1.545], size: [1.02, 19.5, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // bay-glazing
  { shape: 'box', at: [1.36, 11.65, 1.545], size: [1.02, 19.5, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // bay-glazing
  { shape: 'box', at: [2.72, 11.65, 1.545], size: [1.02, 19.5, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // bay-glazing
  { shape: 'box', at: [0, 1.294, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 2.588, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 3.882, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 5.176, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 6.471, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 7.765, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 9.059, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 10.353, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 11.647, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 12.941, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 14.235, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 15.529, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 16.824, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 18.118, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 19.412, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [0, 20.706, 1.53], size: [6.8, 0.34, 0.05], mtl: 'wall-concrete', colour: PALETTE.concrete }, // spandrels
  { shape: 'box', at: [-3.445, 0.647, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 0.647, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 3.235, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 3.235, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 5.824, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 5.824, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 8.412, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 8.412, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 11, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 11, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 13.588, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 13.588, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 16.176, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 16.176, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 18.765, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 18.765, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 21.353, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 21.353, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [0, 3.655, 0], size: [6.84, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 8.832, 0], size: [6.84, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 14.008, 0], size: [6.84, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 19.185, 0], size: [6.84, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 22.12, 0], size: [6.96, 0.24, 3.16], mtl: 'trim-grey', colour: PALETTE.kerb }, // roof
  { shape: 'box', at: [-2.2, 22.54, -0.5], size: [1.6, 0.6, 1.2], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [1.7, 22.46, -0.4], size: [1.1, 0.44, 1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [0, 0.7, 1.56], size: [0.64, 1.4, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.56, 1.585], size: [1.04, 0.14, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy
  { shape: 'box', at: [-0.44, 0.78, 1.585], size: [0.1, 1.56, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0.44, 0.78, 1.585], size: [0.1, 1.56, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0, 0.03, 1.59], size: [1.04, 0.06, 0.06], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
];

/** Style 2 — the loggia block: open loggias recessed between two solid end shafts. */
export const HIGHRISE_LOGGIA_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 11, -0.33], size: [4.28, 22, 2.26], mtl: 'wall-concrete', colour: PALETTE.concrete }, // back-wall
  { shape: 'box', at: [-2.72, 11.02, 0], size: [1.36, 22.04, 3], mtl: 'wall-concrete', colour: PALETTE.concrete }, // end-shafts
  { shape: 'box', at: [2.72, 11.02, 0], size: [1.36, 22.04, 3], mtl: 'wall-concrete', colour: PALETTE.concrete }, // end-shafts
  { shape: 'box', at: [-0.68, 11, 1.15], size: [0.2, 22, 0.7], mtl: 'wall-concrete', colour: PALETTE.concrete }, // loggia-piers
  { shape: 'box', at: [0.68, 11, 1.15], size: [0.2, 22, 0.7], mtl: 'wall-concrete', colour: PALETTE.concrete }, // loggia-piers
  { shape: 'box', at: [0, 1.294, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 2.588, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 3.882, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 5.176, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 6.471, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 7.765, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 9.059, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 10.353, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 11.647, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 12.941, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 14.235, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 15.529, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 16.824, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 18.118, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 19.412, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 20.706, 1.15], size: [4.2, 0.16, 0.66], mtl: 'trim-grey', colour: PALETTE.kerb }, // loggia-slabs
  { shape: 'box', at: [0, 3.028, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 2.848, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 4.322, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 4.142, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 5.616, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 5.436, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 6.911, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 6.731, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 8.205, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 8.025, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 9.499, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 9.319, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 10.793, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 10.613, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 12.087, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 11.907, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 13.381, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 13.201, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 14.675, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 14.495, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 15.969, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 15.789, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 17.264, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 17.084, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 18.558, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 18.378, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 19.852, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 19.672, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 21.146, 1.44], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 20.966, 1.44], size: [4.08, 0.06, 0.06], mtl: 'railing-pale', colour: PALETTE.awning }, // loggia-rails
  { shape: 'box', at: [0, 1.941, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 3.235, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 4.529, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 5.824, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 7.118, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 8.412, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 9.706, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 11, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 12.294, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 13.588, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 14.882, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 16.176, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 17.471, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 18.765, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 20.059, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [0, 21.353, 0.845], size: [3.48, 0.86, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // loggia-glazing
  { shape: 'box', at: [-2.72, 0.647, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 0.647, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 1.941, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 1.941, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 3.235, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 3.235, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 4.529, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 4.529, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 5.824, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 5.824, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 7.118, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 7.118, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 8.412, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 8.412, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 9.706, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 9.706, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 11, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 11, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 12.294, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 12.294, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 13.588, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 13.588, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 14.882, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 14.882, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 16.176, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 16.176, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 17.471, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 17.471, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 18.765, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 18.765, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 20.059, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 20.059, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 21.353, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 21.353, 1.545], size: [0.86, 0.8, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 1.294, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 1.294, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 2.588, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 2.588, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 3.882, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 3.882, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 5.176, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 5.176, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 6.471, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 6.471, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 7.765, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 7.765, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 9.059, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 9.059, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 10.353, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 10.353, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 11.647, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 11.647, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 12.941, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 12.941, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 14.235, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 14.235, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 15.529, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 15.529, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 16.824, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 16.824, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 18.118, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 18.118, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 19.412, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 19.412, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [-2.72, 20.706, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [2.72, 20.706, 1.53], size: [1.36, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // shaft-spandrels
  { shape: 'box', at: [0, 3.655, -0.33], size: [4.32, 0.08, 2.3], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 8.832, -0.33], size: [4.32, 0.08, 2.3], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 14.008, -0.33], size: [4.32, 0.08, 2.3], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 19.185, -0.33], size: [4.32, 0.08, 2.3], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 22.12, -0.33], size: [4.38, 0.24, 2.36], mtl: 'trim-grey', colour: PALETTE.kerb }, // roof
  { shape: 'box', at: [0, 22.12, 1.15], size: [4.18, 0.24, 0.76], mtl: 'trim-grey', colour: PALETTE.kerb }, // roof
  { shape: 'box', at: [-1.9, 22.54, -0.6], size: [1.5, 0.6, 1.1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [0, 0.7, 0.86], size: [0.56, 1.4, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.56, 0.885], size: [0.96, 0.14, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy
  { shape: 'box', at: [-0.4, 0.78, 0.885], size: [0.1, 1.56, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0.4, 0.78, 0.885], size: [0.1, 1.56, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0, 0.03, 0.89], size: [0.96, 0.06, 0.06], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
];

/** Style 3 — the notched shafts: two shafts split full height by a glazed notch. */
export const HIGHRISE_NOTCH_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-2.04, 11, 0], size: [2.72, 22, 3], mtl: 'wall-concrete', colour: PALETTE.concrete }, // shafts
  { shape: 'box', at: [2.04, 11, 0], size: [2.72, 22, 3], mtl: 'wall-concrete', colour: PALETTE.concrete }, // shafts
  { shape: 'box', at: [0, 11, -0.55], size: [1.36, 22, 1.9], mtl: 'wall-brick', colour: PALETTE.tile }, // notch
  { shape: 'box', at: [0, 1.941, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 3.235, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 4.529, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 5.824, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 7.118, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 8.412, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 9.706, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 11, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 12.294, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 13.588, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 14.882, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 16.176, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 17.471, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 18.765, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 20.059, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [0, 21.353, 0.445], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // notch-glazing
  { shape: 'box', at: [-2.72, 0.647, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 0.647, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 0.647, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 0.647, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 1.941, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 1.941, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 1.941, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 1.941, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 3.235, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 3.235, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 3.235, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 3.235, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 4.529, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 4.529, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 4.529, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 4.529, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 5.824, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 5.824, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 5.824, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 5.824, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 7.118, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 7.118, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 7.118, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 7.118, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 8.412, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 8.412, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 8.412, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 8.412, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 9.706, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 9.706, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 9.706, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 9.706, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 11, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 11, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 11, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 11, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 12.294, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 12.294, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 12.294, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 12.294, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 13.588, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 13.588, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 13.588, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 13.588, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 14.882, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 14.882, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 14.882, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 14.882, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 16.176, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 16.176, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 16.176, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 16.176, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 17.471, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 17.471, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 17.471, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 17.471, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 18.765, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 18.765, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 18.765, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 18.765, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 20.059, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 20.059, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 20.059, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 20.059, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 21.353, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-1.36, 21.353, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [1.36, 21.353, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 21.353, 1.545], size: [1.02, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.04, 1.294, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 1.294, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 2.588, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 2.588, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 3.882, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 3.882, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 5.176, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 5.176, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 6.471, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 6.471, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 7.765, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 7.765, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 9.059, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 9.059, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 10.353, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 10.353, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 11.647, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 11.647, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 12.941, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 12.941, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 14.235, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 14.235, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 15.529, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 15.529, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 16.824, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 16.824, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 18.118, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 18.118, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 19.412, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 19.412, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 20.706, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 20.706, 1.53], size: [2.72, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 11, 1.58], size: [0.18, 22, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // shaft-fins
  { shape: 'box', at: [2.04, 11, 1.58], size: [0.18, 22, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // shaft-fins
  { shape: 'box', at: [-3.445, 0.647, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 0.647, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 3.235, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 3.235, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 5.824, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 5.824, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 8.412, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 8.412, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 11, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 11, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 13.588, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 13.588, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 16.176, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 16.176, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 18.765, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 18.765, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 21.353, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 21.353, -0.3], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-2.04, 3.655, 0], size: [2.76, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [2.04, 3.655, 0], size: [2.76, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-2.04, 8.832, 0], size: [2.76, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [2.04, 8.832, 0], size: [2.76, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-2.04, 14.008, 0], size: [2.76, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [2.04, 14.008, 0], size: [2.76, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-2.04, 19.185, 0], size: [2.76, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [2.04, 19.185, 0], size: [2.76, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-2.04, 22.14, 0], size: [2.88, 0.28, 3.16], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [2.04, 22.14, 0], size: [2.88, 0.28, 3.16], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [0, 22.1, -0.55], size: [1.46, 0.2, 2], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [-2.04, 22.56, -0.5], size: [1.5, 0.6, 1.2], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [0, 0.7, 0.46], size: [0.6, 1.4, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.56, 0.485], size: [1, 0.14, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy
  { shape: 'box', at: [-0.42, 0.78, 0.485], size: [0.1, 1.56, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0.42, 0.78, 0.485], size: [0.1, 1.56, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0, 0.03, 0.49], size: [1, 0.06, 0.06], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
];

/** Style 4 — the garden terraces: setback tiers, each freed roof planted and railed. */
export const HIGHRISE_GARDEN_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 7, 0], size: [6.8, 14, 3], mtl: 'wall-concrete', colour: PALETTE.concrete }, // tiers
  { shape: 'box', at: [0, 16.2, 0], size: [5.44, 4.4, 2.2], mtl: 'wall-concrete', colour: PALETTE.concrete }, // tiers
  { shape: 'box', at: [0, 20.2, 0], size: [4.08, 3.6, 1.4], mtl: 'wall-concrete', colour: PALETTE.concrete }, // tiers
  { shape: 'box', at: [0, 14.08, 0], size: [6.94, 0.2, 3.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // tier-caps
  { shape: 'box', at: [0, 18.48, 0], size: [5.58, 0.2, 2.4], mtl: 'trim-grey', colour: PALETTE.kerb }, // tier-caps
  { shape: 'box', at: [0, 22.08, 0], size: [4.22, 0.2, 1.6], mtl: 'trim-grey', colour: PALETTE.kerb }, // tier-caps
  { shape: 'box', at: [0, 14.31, 1.3], size: [5.14, 0.26, 0.34], mtl: 'roof-garden', colour: PALETTE.hedge }, // roof-gardens
  { shape: 'box', at: [0, 18.71, 0.9], size: [3.78, 0.26, 0.34], mtl: 'roof-garden', colour: PALETTE.hedge }, // roof-gardens
  { shape: 'box', at: [0, 14.62, 1.42], size: [5.44, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [-2.66, 14.4, 1.42], size: [0.08, 0.44, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [2.66, 14.4, 1.42], size: [0.08, 0.44, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [0, 19.02, 1.02], size: [4.08, 0.08, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [-1.98, 18.8, 1.02], size: [0.08, 0.44, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [1.98, 18.8, 1.02], size: [0.08, 0.44, 0.08], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [-2.72, 0.647, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 0.647, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 0.647, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 0.647, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 1.941, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 1.941, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 1.941, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 1.941, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 1.941, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 3.235, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 3.235, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 3.235, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 3.235, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 3.235, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 4.529, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 4.529, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 4.529, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 4.529, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 4.529, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 5.824, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 5.824, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 5.824, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 5.824, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 5.824, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 7.118, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 7.118, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 7.118, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 7.118, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 7.118, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 8.412, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 8.412, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 8.412, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 8.412, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 8.412, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 9.706, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 9.706, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 9.706, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 9.706, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 9.706, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 11, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 11, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 11, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 11, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 11, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 12.294, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 12.294, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 12.294, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 12.294, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 12.294, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.72, 13.588, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 13.588, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 13.588, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 13.588, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 13.588, 1.545], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 14.882, 1.145], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 14.882, 1.145], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 14.882, 1.145], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 16.176, 1.145], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 16.176, 1.145], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 16.176, 1.145], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 17.471, 1.145], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 17.471, 1.145], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 17.471, 1.145], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 18.765, 0.745], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 18.765, 0.745], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 18.765, 0.745], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 20.059, 0.745], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 20.059, 0.745], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 20.059, 0.745], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 21.353, 0.745], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 21.353, 0.745], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 21.353, 0.745], size: [0.86, 0.82, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 1.294, 1.53], size: [6.8, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 2.588, 1.53], size: [6.8, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 3.882, 1.53], size: [6.8, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 5.176, 1.53], size: [6.8, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 6.471, 1.53], size: [6.8, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 7.765, 1.53], size: [6.8, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 9.059, 1.53], size: [6.8, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 10.353, 1.53], size: [6.8, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 11.647, 1.53], size: [6.8, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 12.941, 1.53], size: [6.8, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 15.529, 1.13], size: [5.44, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 16.824, 1.13], size: [5.44, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 19.412, 0.73], size: [4.08, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 20.706, 0.73], size: [4.08, 0.3, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 7, 0], size: [6.84, 0.08, 3.04], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 16.2, 0], size: [5.48, 0.08, 2.24], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 20.2, 0], size: [4.12, 0.08, 1.44], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 22.34, -0.5], size: [1.6, 0.6, 1.1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [0, 0.7, 1.56], size: [0.64, 1.4, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.56, 1.585], size: [1.04, 0.14, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy
  { shape: 'box', at: [-0.44, 0.78, 1.585], size: [0.1, 1.56, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0.44, 0.78, 1.585], size: [0.1, 1.56, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0, 0.03, 1.59], size: [1.04, 0.06, 0.06], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
];

/** Style 5 — the framed block: an expressed concrete frame with spandrel infill. */
export const HIGHRISE_FRAME_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 11, -0.2], size: [6.76, 22, 2.6], mtl: 'wall-concrete', colour: PALETTE.concrete }, // core
  { shape: 'box', at: [-3.4, 11.03, 0.95], size: [0.24, 22.06, 1.1], mtl: 'wall-brick', colour: PALETTE.tile }, // frame-piers
  { shape: 'box', at: [-2.04, 11.03, 0.95], size: [0.24, 22.06, 1.1], mtl: 'wall-brick', colour: PALETTE.tile }, // frame-piers
  { shape: 'box', at: [-0.68, 11.03, 0.95], size: [0.24, 22.06, 1.1], mtl: 'wall-brick', colour: PALETTE.tile }, // frame-piers
  { shape: 'box', at: [0.68, 11.03, 0.95], size: [0.24, 22.06, 1.1], mtl: 'wall-brick', colour: PALETTE.tile }, // frame-piers
  { shape: 'box', at: [2.04, 11.03, 0.95], size: [0.24, 22.06, 1.1], mtl: 'wall-brick', colour: PALETTE.tile }, // frame-piers
  { shape: 'box', at: [3.4, 11.03, 0.95], size: [0.24, 22.06, 1.1], mtl: 'wall-brick', colour: PALETTE.tile }, // frame-piers
  { shape: 'box', at: [0, 5.176, 0.95], size: [6.8, 0.5, 0.98], mtl: 'wall-brick', colour: PALETTE.tile }, // belt-courses
  { shape: 'box', at: [0, 10.353, 0.95], size: [6.8, 0.5, 0.98], mtl: 'wall-brick', colour: PALETTE.tile }, // belt-courses
  { shape: 'box', at: [0, 15.529, 0.95], size: [6.8, 0.5, 0.98], mtl: 'wall-brick', colour: PALETTE.tile }, // belt-courses
  { shape: 'box', at: [0, 20.706, 0.95], size: [6.8, 0.5, 0.98], mtl: 'wall-brick', colour: PALETTE.tile }, // belt-courses
  { shape: 'box', at: [-2.72, 0.647, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 1.941, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 3.235, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 4.529, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 5.824, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 7.118, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 8.412, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 9.706, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 11, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 12.294, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 13.588, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 14.882, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 16.176, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 17.471, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 18.765, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 20.059, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-2.72, 21.353, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 0.647, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 1.941, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 3.235, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 4.529, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 5.824, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 7.118, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 8.412, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 9.706, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 11, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 12.294, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 13.588, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 14.882, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 16.176, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 17.471, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 18.765, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 20.059, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [-1.36, 21.353, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 1.941, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 3.235, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 4.529, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 5.824, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 7.118, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 8.412, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 9.706, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 11, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 12.294, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 13.588, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 14.882, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 16.176, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 17.471, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 18.765, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 20.059, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 21.353, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 0.647, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 1.941, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 3.235, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 4.529, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 5.824, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 7.118, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 8.412, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 9.706, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 11, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 12.294, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 13.588, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 14.882, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 16.176, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 17.471, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 18.765, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 20.059, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [1.36, 21.353, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 0.647, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 1.941, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 3.235, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 4.529, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 5.824, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 7.118, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 8.412, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 9.706, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 11, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 12.294, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 13.588, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 14.882, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 16.176, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 17.471, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 18.765, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 20.059, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [2.72, 21.353, 1.145], size: [0.96, 0.9, 0.06], mtl: 'glazing', colour: PALETTE.parapet }, // frame-glazing
  { shape: 'box', at: [0, 1.294, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 2.588, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 3.882, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 6.471, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 7.765, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 9.059, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 11.647, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 12.941, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 14.235, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 16.824, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 18.118, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [0, 19.412, 1.13], size: [6.2, 0.32, 0.05], mtl: 'spandrel-band', colour: PALETTE.awning }, // infill-spandrels
  { shape: 'box', at: [-3.445, 0.647, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 0.647, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 3.235, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 3.235, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 5.824, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 5.824, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 8.412, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 8.412, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 11, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 11, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 13.588, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 13.588, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 16.176, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 16.176, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 18.765, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 18.765, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [-3.445, 21.353, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [3.445, 21.353, -0.2], size: [0.06, 0.8, 1.7], mtl: 'glazing', colour: PALETTE.parapet }, // end-glazing
  { shape: 'box', at: [0, 3.655, -0.2], size: [6.84, 0.08, 2.64], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 8.832, -0.2], size: [6.84, 0.08, 2.64], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 14.008, -0.2], size: [6.84, 0.08, 2.64], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 19.185, -0.2], size: [6.84, 0.08, 2.64], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 22.12, -0.2], size: [6.86, 0.24, 2.7], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [0, 22.3, 0.95], size: [6.94, 0.36, 1.16], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [-1.8, 22.54, -0.5], size: [1.5, 0.6, 1.1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [0, 0.7, 1.16], size: [0.52, 1.4, 0.06], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.56, 1.185], size: [0.92, 0.14, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy
  { shape: 'box', at: [-0.38, 0.78, 1.185], size: [0.1, 1.56, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0.38, 0.78, 1.185], size: [0.1, 1.56, 0.06], mtl: 'trim-grey', colour: PALETTE.kerb }, // canopy-brackets
  { shape: 'box', at: [0, 0.03, 1.19], size: [0.92, 0.06, 0.06], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
];
