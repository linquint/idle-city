import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-5 trade towers, as part tables.
 *
 * Commerce's top rung, and the one that finishes the ladder: `shop` joins
 * `home` as a zone with no body mesh at any level. Every model is 6.8 along the
 * parcel by 3.2 across — `MERGED_SPAN` by `ZONE_SHAPES.shop[4].width` — and 8.0
 * tall against the exchange's 6.0, on the same parcel the rung below stands on.
 *
 * These are the first commercial buildings in the city to carry a **beacon**.
 * `ZONE_SHAPES.shop[4].beacon` is the only true flag in the commercial row, and
 * nothing here has to model it: `writeModelParts` reads the flag and puts a
 * lamp on the model's own top, because a beacon is a *light* and a
 * vertex-colour merge has one material for the whole model. Same trick as the
 * window lights. What the models owe it is a top worth standing a lamp on,
 * which is why four of the five finish with a cap rather than a plant deck.
 *
 * At 8.0 these have stopped being buildings with countable floors and started
 * being **shapes against the sky**, which is the same thing that happened to
 * housing two rungs above its merge — and the answer is the same one the
 * pinnacles gave: each carries one full-height idea rather than a facade full
 * of incidents. A shaft under a crown of three bands, three setback tiers with
 * the roofs they free railed as terraces, three masses split by two recessed
 * glazed slots, a block with a finned marker standing three storeys past it,
 * and a shaft under an open louvred lantern on four piers. From the orbit
 * camera that difference is most of what lands.
 *
 * The shared ground floor survives all the way up. All five still meet the kerb
 * with the piers, shopfronts, stallrisers, doors, soffit lights and pavement the
 * high streets introduced, and `transom` still marks where the shop stops. Four
 * rungs of commerce differ entirely above that line and not at all below it,
 * which is what has let a district climb the whole ladder without its street
 * changing.
 *
 * No refusals and no new palette entry. Commerce is five rungs deep on the
 * colours its first rung shipped with, which is the whole ladder on one palette.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/tradetowerN.obj models/tradetowerN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 */

/** Style 1 — the banded crown: a mullioned shaft finishing in three horizontal bands, glazed between them and returning around both ends. */
export const TRADETOWER_CROWN_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-1.133, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [1.133, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-2.152, 0.94, -0.225], size: [1.597, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [0, 0.94, -0.225], size: [1.827, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [2.152, 0.94, -0.225], size: [1.597, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [-2.152, 1.67, 0], size: [1.777, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [0, 1.67, 0], size: [2.007, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [2.152, 1.67, 0], size: [1.777, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [-2.512, 0.85, 1.133], size: [0.857, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-0.36, 0.85, 1.133], size: [1.087, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [1.792, 0.85, 1.133], size: [0.857, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-2.512, 0.15, 1.145], size: [0.857, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-0.36, 0.15, 1.145], size: [1.087, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [1.792, 0.15, 1.145], size: [0.857, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-1.723, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [0.543, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [2.58, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-2.152, 1.45, 1.355], size: [1.277, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 1.45, 1.355], size: [1.507, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [2.152, 1.45, 1.355], size: [1.277, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 0.03, 1.625], size: [6.74, 0.06, 0.05], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 4.95, 0], size: [6.8, 6.1, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // shaft
  { shape: 'box', at: [0, 1.76, 1.635], size: [6.8, 0.28, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // transom
  { shape: 'box', at: [-2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 1.76, 1.629], size: [1.507, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 2.51, 1.623], size: [6.3, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shaft-glazing
  { shape: 'box', at: [0, 3.73, 1.623], size: [6.3, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shaft-glazing
  { shape: 'box', at: [0, 4.95, 1.623], size: [6.3, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shaft-glazing
  { shape: 'box', at: [0, 6.17, 1.623], size: [6.3, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shaft-glazing
  { shape: 'box', at: [0, 3.12, 1.635], size: [6.8, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 4.34, 1.635], size: [6.8, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 5.56, 1.635], size: [6.8, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 7.04, 1.635], size: [6.8, 0.24, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // crown-bands
  { shape: 'box', at: [0, 7.42, 1.635], size: [6.8, 0.24, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // crown-bands
  { shape: 'box', at: [0, 7.8, 1.635], size: [6.8, 0.24, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // crown-bands
  { shape: 'box', at: [0, 7.39, 1.623], size: [5.4, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // crown-glazing
  { shape: 'box', at: [-2.55, 4.34, 1.629], size: [0.08, 4.68, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [-1.7, 4.34, 1.629], size: [0.08, 4.68, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [-0.85, 4.34, 1.629], size: [0.08, 4.68, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [0, 4.34, 1.629], size: [0.08, 4.68, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [0.85, 4.34, 1.629], size: [0.08, 4.68, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [1.7, 4.34, 1.629], size: [0.08, 4.68, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [2.55, 4.34, 1.629], size: [0.08, 4.68, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [-3.423, 2.51, 0], size: [0.03, 0.8, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [-3.423, 3.73, 0], size: [0.03, 0.8, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [-3.423, 4.95, 0], size: [0.03, 0.8, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [-3.423, 6.17, 0], size: [0.03, 0.8, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [3.423, 2.51, 0], size: [0.03, 0.8, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [3.423, 3.73, 0], size: [0.03, 0.8, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [3.423, 4.95, 0], size: [0.03, 0.8, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [3.423, 6.17, 0], size: [0.03, 0.8, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [0, 8.14, 0], size: [6.9, 0.28, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [-1.9, 8.55, -0.6], size: [1.4, 0.54, 1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 2 — the setbacks: three tiers stepping back from the street, each roof they free railed as a terrace. */
export const TRADETOWER_SETBACK_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-1.133, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [1.133, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-2.152, 0.94, -0.225], size: [1.597, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [0, 0.94, -0.225], size: [1.827, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [2.152, 0.94, -0.225], size: [1.597, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [-2.152, 1.67, 0], size: [1.777, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [0, 1.67, 0], size: [2.007, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [2.152, 1.67, 0], size: [1.777, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [-2.512, 0.85, 1.133], size: [0.857, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-0.36, 0.85, 1.133], size: [1.087, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [1.792, 0.85, 1.133], size: [0.857, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-2.512, 0.15, 1.145], size: [0.857, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-0.36, 0.15, 1.145], size: [1.087, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [1.792, 0.15, 1.145], size: [0.857, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-1.723, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [0.543, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [2.58, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-2.152, 1.45, 1.355], size: [1.277, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 1.45, 1.355], size: [1.507, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [2.152, 1.45, 1.355], size: [1.277, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 0.03, 1.625], size: [6.74, 0.06, 0.05], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 3.12, 0], size: [6.8, 2.44, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // tiers
  { shape: 'box', at: [0, 5.56, -0.25], size: [5.9, 2.44, 2.7], mtl: 'shop-navy', colour: PALETTE.shop }, // tiers
  { shape: 'box', at: [0, 7.39, -0.5], size: [4.9, 1.22, 2.2], mtl: 'shop-navy', colour: PALETTE.shop }, // tiers
  { shape: 'box', at: [0, 1.76, 1.635], size: [6.8, 0.28, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // transom
  { shape: 'box', at: [-2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 1.76, 1.629], size: [1.507, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 4.42, 0], size: [6.9, 0.2, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // tier-caps
  { shape: 'box', at: [0, 6.87, -0.25], size: [6, 0.2, 2.75], mtl: 'trim-concrete', colour: PALETTE.concrete }, // tier-caps
  { shape: 'box', at: [0, 8.1, -0.5], size: [5, 0.2, 2.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // tier-caps
  { shape: 'box', at: [0, 4.86, 1.5], size: [5.9, 0.08, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rails
  { shape: 'box', at: [-2.89, 4.68, 1.5], size: [0.08, 0.44, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rails
  { shape: 'box', at: [2.89, 4.68, 1.5], size: [0.08, 0.44, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rails
  { shape: 'box', at: [0, 7.3, 1], size: [4.9, 0.08, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rails
  { shape: 'box', at: [-2.39, 7.12, 1], size: [0.08, 0.44, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rails
  { shape: 'box', at: [2.39, 7.12, 1], size: [0.08, 0.44, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rails
  { shape: 'box', at: [0, 2.51, 1.623], size: [6.3, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // tier-glazing
  { shape: 'box', at: [0, 3.73, 1.623], size: [6.3, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // tier-glazing
  { shape: 'box', at: [0, 4.95, 1.123], size: [5.4, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // tier-glazing
  { shape: 'box', at: [0, 6.17, 1.123], size: [5.4, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // tier-glazing
  { shape: 'box', at: [0, 7.39, 0.623], size: [4.4, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // tier-glazing
  { shape: 'box', at: [0, 3.12, 1.635], size: [6.8, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 5.56, 1.135], size: [5.9, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 8.45, -0.5], size: [1.3, 0.5, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 3 — the slots: three masses along the parcel, split the full height by two recessed glazed slots. */
export const TRADETOWER_SLOT_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-1.133, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [1.133, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-2.152, 0.94, -0.225], size: [1.597, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [0, 0.94, -0.225], size: [1.827, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [2.152, 0.94, -0.225], size: [1.597, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [-2.152, 1.67, 0], size: [1.777, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [0, 1.67, 0], size: [2.007, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [2.152, 1.67, 0], size: [1.777, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [-2.512, 0.85, 1.133], size: [0.857, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-0.36, 0.85, 1.133], size: [1.087, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [1.792, 0.85, 1.133], size: [0.857, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-2.512, 0.15, 1.145], size: [0.857, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-0.36, 0.15, 1.145], size: [1.087, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [1.792, 0.15, 1.145], size: [0.857, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-1.723, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [0.543, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [2.58, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-2.152, 1.45, 1.355], size: [1.277, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 1.45, 1.355], size: [1.507, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [2.152, 1.45, 1.355], size: [1.277, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 0.03, 1.625], size: [6.74, 0.06, 0.05], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [-2.675, 4.95, 0], size: [1.45, 6.1, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // masses
  { shape: 'box', at: [0, 4.95, 0], size: [2.5, 6.1, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // masses
  { shape: 'box', at: [2.675, 4.95, 0], size: [1.45, 6.1, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // masses
  { shape: 'box', at: [-1.6, 4.95, -0.25], size: [0.7, 6.1, 2.7], mtl: 'shop-navy', colour: PALETTE.shop }, // slot-backs
  { shape: 'box', at: [1.6, 4.95, -0.25], size: [0.7, 6.1, 2.7], mtl: 'shop-navy', colour: PALETTE.shop }, // slot-backs
  { shape: 'box', at: [0, 1.76, 1.635], size: [6.8, 0.28, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // transom
  { shape: 'box', at: [-2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 1.76, 1.629], size: [1.507, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [-1.6, 2.51, 1.123], size: [0.5, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [-1.6, 3.73, 1.123], size: [0.5, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [-1.6, 4.95, 1.123], size: [0.5, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [-1.6, 6.17, 1.123], size: [0.5, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [-1.6, 7.39, 1.123], size: [0.5, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [1.6, 2.51, 1.123], size: [0.5, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [1.6, 3.73, 1.123], size: [0.5, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [1.6, 4.95, 1.123], size: [0.5, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [1.6, 6.17, 1.123], size: [0.5, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [1.6, 7.39, 1.123], size: [0.5, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [-2.675, 2.51, 1.623], size: [1.05, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [-2.675, 3.73, 1.623], size: [1.05, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [-2.675, 4.95, 1.623], size: [1.05, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [-2.675, 6.17, 1.623], size: [1.05, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [-2.675, 7.39, 1.623], size: [1.05, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [0, 2.51, 1.623], size: [2.1, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [0, 3.73, 1.623], size: [2.1, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [0, 4.95, 1.623], size: [2.1, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [0, 6.17, 1.623], size: [2.1, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [0, 7.39, 1.623], size: [2.1, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [2.675, 2.51, 1.623], size: [1.05, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [2.675, 3.73, 1.623], size: [1.05, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [2.675, 4.95, 1.623], size: [1.05, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [2.675, 6.17, 1.623], size: [1.05, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [2.675, 7.39, 1.623], size: [1.05, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // mass-glazing
  { shape: 'box', at: [-2.675, 3.12, 1.635], size: [1.45, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.675, 4.34, 1.635], size: [1.45, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.675, 5.56, 1.635], size: [1.45, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.675, 6.78, 1.635], size: [1.45, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 3.12, 1.635], size: [2.5, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 4.34, 1.635], size: [2.5, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 5.56, 1.635], size: [2.5, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 6.78, 1.635], size: [2.5, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.675, 3.12, 1.635], size: [1.45, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.675, 4.34, 1.635], size: [1.45, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.675, 5.56, 1.635], size: [1.45, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.675, 6.78, 1.635], size: [1.45, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.675, 8.14, 0], size: [1.51, 0.28, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // caps
  { shape: 'box', at: [0, 8.14, 0], size: [2.56, 0.28, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // caps
  { shape: 'box', at: [2.675, 8.14, 0], size: [1.51, 0.28, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // caps
  { shape: 'box', at: [-1.6, 8.09, -0.25], size: [0.74, 0.18, 2.74], mtl: 'trim-concrete', colour: PALETTE.concrete }, // caps
  { shape: 'box', at: [1.6, 8.09, -0.25], size: [0.74, 0.18, 2.74], mtl: 'trim-concrete', colour: PALETTE.concrete }, // caps
  { shape: 'box', at: [-2.5, 8.56, -0.6], size: [1.2, 0.52, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 4 — the marker: a block with a fin-flanked shaft standing three storeys past it at one end. */
export const TRADETOWER_MARKER_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-0.85, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [1.47, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-2.01, 0.94, -0.225], size: [1.88, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [0.31, 0.94, -0.225], size: [1.88, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [-2.01, 1.67, 0], size: [2.06, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [0.31, 1.67, 0], size: [2.06, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [-1.65, 0.85, 1.133], size: [1.14, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [0.67, 0.85, 1.133], size: [1.14, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-1.65, 0.15, 1.145], size: [1.14, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [0.67, 0.15, 1.145], size: [1.14, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-2.58, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-0.26, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-2.01, 1.45, 1.355], size: [1.56, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0.31, 1.45, 1.355], size: [1.56, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 0.03, 1.625], size: [6.74, 0.06, 0.05], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [-0.85, 4.95, 0], size: [5.1, 6.1, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // block
  { shape: 'box', at: [2.55, 4.6, 0], size: [1.7, 9.2, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // marker
  { shape: 'box', at: [1.86, 5.55, 1.635], size: [0.22, 6.9, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // marker-fins
  { shape: 'box', at: [3.24, 5.55, 1.635], size: [0.22, 6.9, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // marker-fins
  { shape: 'box', at: [0, 1.76, 1.635], size: [6.8, 0.28, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // transom
  { shape: 'box', at: [-2.01, 1.76, 1.629], size: [1.56, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0.31, 1.76, 1.629], size: [1.56, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [-0.85, 2.51, 1.623], size: [4.7, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // block-glazing
  { shape: 'box', at: [-0.85, 3.73, 1.623], size: [4.7, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // block-glazing
  { shape: 'box', at: [-0.85, 4.95, 1.623], size: [4.7, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // block-glazing
  { shape: 'box', at: [-0.85, 6.17, 1.623], size: [4.7, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // block-glazing
  { shape: 'box', at: [-0.85, 7.39, 1.623], size: [4.7, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // block-glazing
  { shape: 'box', at: [2.55, 2.51, 1.623], size: [0.8, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // marker-glazing
  { shape: 'box', at: [2.55, 3.73, 1.623], size: [0.8, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // marker-glazing
  { shape: 'box', at: [2.55, 4.95, 1.623], size: [0.8, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // marker-glazing
  { shape: 'box', at: [2.55, 6.17, 1.623], size: [0.8, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // marker-glazing
  { shape: 'box', at: [2.55, 7.39, 1.623], size: [0.8, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // marker-glazing
  { shape: 'box', at: [2.55, 8.35, 1.623], size: [0.8, 0.7, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // marker-glazing
  { shape: 'box', at: [-0.85, 3.12, 1.635], size: [5.1, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-0.85, 4.34, 1.635], size: [5.1, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-0.85, 5.56, 1.635], size: [5.1, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-0.85, 6.78, 1.635], size: [5.1, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-0.85, 8.12, 0], size: [5.18, 0.24, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // block-cap
  { shape: 'box', at: [2.55, 9.35, 0], size: [1.82, 0.3, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // marker-cap
  { shape: 'box', at: [-1.35, 8.5, -0.6], size: [1.3, 0.5, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 5 — the lantern: a shaft capped and then crowned again by an open louvred storey carried on four piers. */
export const TRADETOWER_LANTERN_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-1.133, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [1.133, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-2.152, 0.94, -0.225], size: [1.597, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [0, 0.94, -0.225], size: [1.827, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [2.152, 0.94, -0.225], size: [1.597, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [-2.152, 1.67, 0], size: [1.777, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [0, 1.67, 0], size: [2.007, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [2.152, 1.67, 0], size: [1.777, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [-2.512, 0.85, 1.133], size: [0.857, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-0.36, 0.85, 1.133], size: [1.087, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [1.792, 0.85, 1.133], size: [0.857, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-2.512, 0.15, 1.145], size: [0.857, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-0.36, 0.15, 1.145], size: [1.087, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [1.792, 0.15, 1.145], size: [0.857, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-1.723, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [0.543, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [2.58, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-2.152, 1.45, 1.355], size: [1.277, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 1.45, 1.355], size: [1.507, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [2.152, 1.45, 1.355], size: [1.277, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 0.03, 1.625], size: [6.74, 0.06, 0.05], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 4.035, 0], size: [6.8, 4.27, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // shaft
  { shape: 'box', at: [0, 1.76, 1.635], size: [6.8, 0.28, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // transom
  { shape: 'box', at: [-2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 1.76, 1.629], size: [1.507, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 2.51, 1.623], size: [6.3, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shaft-glazing
  { shape: 'box', at: [0, 3.73, 1.623], size: [6.3, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shaft-glazing
  { shape: 'box', at: [0, 4.95, 1.623], size: [6.3, 0.8, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shaft-glazing
  { shape: 'box', at: [0, 3.12, 1.635], size: [6.8, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 4.34, 1.635], size: [6.8, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 5.56, 1.635], size: [6.8, 0.32, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 6.27, 0], size: [6.9, 0.2, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // shaft-cap
  { shape: 'box', at: [0, 7.185, 0], size: [6.5, 1.63, 2.9], mtl: 'shop-navy', colour: PALETTE.shop }, // crown
  { shape: 'box', at: [-3.17, 7.285, 0], size: [0.26, 2.03, 3.1], mtl: 'trim-concrete', colour: PALETTE.concrete }, // crown-piers
  { shape: 'box', at: [-1.133, 7.285, 0], size: [0.26, 2.03, 3.1], mtl: 'trim-concrete', colour: PALETTE.concrete }, // crown-piers
  { shape: 'box', at: [1.133, 7.285, 0], size: [0.26, 2.03, 3.1], mtl: 'trim-concrete', colour: PALETTE.concrete }, // crown-piers
  { shape: 'box', at: [3.17, 7.285, 0], size: [0.26, 2.03, 3.1], mtl: 'trim-concrete', colour: PALETTE.concrete }, // crown-piers
  { shape: 'box', at: [0, 6.72, -1.485], size: [5.8, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 6.72, 1.485], size: [5.8, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 7.17, -1.485], size: [5.8, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 7.17, 1.485], size: [5.8, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 7.62, -1.485], size: [5.8, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 7.62, 1.485], size: [5.8, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 8.45, 0], size: [6.86, 0.3, 3.18], mtl: 'trim-concrete', colour: PALETTE.concrete }, // crown-cap
  { shape: 'box', at: [-1.6, 8.86, -0.5], size: [1.2, 0.52, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];
