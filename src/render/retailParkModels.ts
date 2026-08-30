import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-3 retail parks, as part tables.
 *
 * Commerce's third rung, and the first modelled building outside housing that
 * stands on a *merged parcel*. `LEVEL_FOOTPRINT` is [1, 1, 2, 2, 2], so
 * promotion to this rung is the merge: two neighbouring plots become one
 * building covering both. Every model here is built to that parcel rather than
 * to a plot — 6.8 along it by 3.1 across, which is `MERGED_SPAN` by
 * `ZONE_SHAPES.shop[2].width` exactly, and 4.4 tall to match its row.
 *
 * The oblong footprint costs the same two rules it cost the towers, and they
 * are the reason this rung is a different thing to draw rather than a taller
 * version of the last one:
 *
 *   - **a retail park cannot turn freely.** A high street picks any of the four
 *     sides its plot fronts; this has to lay its long axis along its parcel, so
 *     only two of the four are candidates and the street choice happens within
 *     those. See `modelFacing`;
 *   - **its two spans are bounded differently.** The long one always lies along
 *     the parcel and the short one always across it, so they answer to 2 x CELL
 *     and to CELL respectively rather than both to whichever the turn put on
 *     the frontage. See `jitterCap`.
 *
 * Unlike the towers at the same rung it carries **no beacon**:
 * `ZONE_SHAPES.shop[2].beacon` is false, and commerce does not light one until
 * its fifth. A retail park is a wide building rather than a tall one, and a
 * warning light on a four-unit roof would read as an aircraft hazard on a
 * supermarket.
 *
 * What these have to say that a high street does not is **one building where
 * there were two**. The merge is the most consequential thing a player does to
 * a district, and the failure mode is that it reads as the same shop stretched.
 * So four of the five carry *several shopfronts* along one frontage — three
 * units behind pilasters, two flanking a colonnade, two under a stair tower —
 * under a single continuous upper block and a single cornice. The units stay
 * legible at the kerb and the building above them does not, which is what two
 * plots knocked together actually looks like. The hall is the one that answers
 * the other way, as a single clerestory-lit volume with no upper floor at all,
 * because a rung of five variations on one idea is a rung with four.
 *
 * Nothing here needed a new palette entry either — `glazing-bar` is the `kerb`
 * grey the shutters already wear, and `roof-tile` and `roof-plant` are the two
 * the high streets brought in. Commerce is now three rungs deep on one palette.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/retailparkN.obj models/retailparkN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 */

/** Style 1 — the pilastered parade: three units along the frontage, divided above the fascia by four full-height pilasters under one cornice. */
export const RETAILPARK_PILASTER_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-3.18, 0.925, 0], size: [0.44, 1.85, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [-1.133, 0.925, 0], size: [0.44, 1.85, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [1.133, 0.925, 0], size: [0.44, 1.85, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [3.18, 0.925, 0], size: [0.44, 1.85, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [-2.157, 0.915, -0.2], size: [1.627, 1.83, 2.66], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [0, 0.915, -0.2], size: [1.847, 1.83, 2.66], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [2.157, 0.915, -0.2], size: [1.627, 1.83, 2.66], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [-2.157, 1.65, 0], size: [1.607, 0.4, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-heads
  { shape: 'box', at: [0, 1.65, 0], size: [1.827, 0.4, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-heads
  { shape: 'box', at: [2.157, 1.65, 0], size: [1.607, 0.4, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-heads
  { shape: 'box', at: [-2.517, 0.82, 1.16], size: [0.887, 1.15, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-0.36, 0.82, 1.16], size: [1.107, 1.15, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [1.797, 0.82, 1.16], size: [0.887, 1.15, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-2.517, 0.14, 1.173], size: [0.887, 0.28, 0.045], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-0.36, 0.14, 1.173], size: [1.107, 0.28, 0.045], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [1.797, 0.14, 1.173], size: [0.887, 0.28, 0.045], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-1.713, 0.52, 1.17], size: [0.56, 1.04, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [0.553, 0.52, 1.17], size: [0.56, 1.04, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [2.6, 0.52, 1.17], size: [0.56, 1.04, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-2.157, 1.4, 1.34], size: [1.307, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 1.4, 1.34], size: [1.527, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [2.157, 1.4, 1.34], size: [1.307, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 0.03, 1.6], size: [6.8, 0.06, 0.1], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 3.125, 0], size: [6.8, 2.55, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-block
  { shape: 'box', at: [-3.18, 3.125, 1.605], size: [0.36, 2.55, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // pilasters
  { shape: 'box', at: [-1.133, 3.125, 1.605], size: [0.36, 2.55, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // pilasters
  { shape: 'box', at: [1.133, 3.125, 1.605], size: [0.36, 2.55, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // pilasters
  { shape: 'box', at: [3.18, 3.125, 1.605], size: [0.36, 2.55, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // pilasters
  { shape: 'box', at: [0, 1.69, 1.605], size: [6.8, 0.32, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // fascia-band
  { shape: 'box', at: [-2.157, 1.69, 1.615], size: [1.407, 0.24, 0.04], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 1.69, 1.615], size: [1.627, 0.24, 0.04], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [2.157, 1.69, 1.615], size: [1.407, 0.24, 0.04], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [-2.577, 2.55, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-1.737, 2.55, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-2.577, 3.805, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-1.737, 3.805, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-0.42, 2.55, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0.42, 2.55, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-0.42, 3.805, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0.42, 3.805, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [1.737, 2.55, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [2.577, 2.55, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [1.737, 3.805, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [2.577, 3.805, 1.58], size: [0.56, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0, 3.125, 0], size: [6.86, 0.12, 3.16], mtl: 'facade-band', colour: PALETTE.awning }, // floor-band
  { shape: 'box', at: [0, 4.5, 0], size: [7, 0.2, 3.24], mtl: 'trim-concrete', colour: PALETTE.concrete }, // cornice
  { shape: 'box', at: [0, 4.68, 0], size: [6.9, 0.16, 3.16], mtl: 'trim-concrete', colour: PALETTE.concrete }, // cornice
  { shape: 'box', at: [-1.8, 4.98, -0.6], size: [1.3, 0.4, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 2 — the colonnade: two shopfronts set back behind six columns and a covered walkway the width of the parcel. */
export const RETAILPARK_COLONNADE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 0.925, -0.4], size: [6.8, 1.85, 2.3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [-3.23, 0.795, 1.36], size: [0.34, 1.59, 0.34], mtl: 'trim-concrete', colour: PALETTE.concrete }, // colonnade
  { shape: 'box', at: [-2.04, 0.795, 1.36], size: [0.34, 1.59, 0.34], mtl: 'trim-concrete', colour: PALETTE.concrete }, // colonnade
  { shape: 'box', at: [-0.68, 0.795, 1.36], size: [0.34, 1.59, 0.34], mtl: 'trim-concrete', colour: PALETTE.concrete }, // colonnade
  { shape: 'box', at: [0.68, 0.795, 1.36], size: [0.34, 1.59, 0.34], mtl: 'trim-concrete', colour: PALETTE.concrete }, // colonnade
  { shape: 'box', at: [2.04, 0.795, 1.36], size: [0.34, 1.59, 0.34], mtl: 'trim-concrete', colour: PALETTE.concrete }, // colonnade
  { shape: 'box', at: [3.23, 0.795, 1.36], size: [0.34, 1.59, 0.34], mtl: 'trim-concrete', colour: PALETTE.concrete }, // colonnade
  { shape: 'box', at: [0, 1.72, 1.38], size: [6.8, 0.26, 0.34], mtl: 'trim-concrete', colour: PALETTE.concrete }, // arcade-beam
  { shape: 'box', at: [0, 0.03, 1.15], size: [6.74, 0.06, 0.8], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // arcade-floor
  { shape: 'box', at: [-1.9, 0.86, 0.78], size: [2.7, 1.24, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [1.9, 0.86, 0.78], size: [2.7, 1.24, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-1.9, 0.14, 0.79], size: [2.7, 0.28, 0.04], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [1.9, 0.14, 0.79], size: [2.7, 0.28, 0.04], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [0, 0.52, 0.79], size: [0.7, 1.04, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [0, 1.52, 1.3], size: [6.2, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 3.125, 0], size: [6.8, 2.55, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-block
  { shape: 'box', at: [-2.55, 2.55, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-1.53, 2.55, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-0.51, 2.55, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0.51, 2.55, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [1.53, 2.55, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [2.55, 2.55, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-2.55, 3.805, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-1.53, 3.805, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-0.51, 3.805, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0.51, 3.805, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [1.53, 3.805, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [2.55, 3.805, 1.58], size: [0.72, 0.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0, 3.125, 0], size: [6.86, 0.12, 3.16], mtl: 'facade-band', colour: PALETTE.awning }, // floor-band
  { shape: 'box', at: [0, 1.97, 1.59], size: [5.2, 0.24, 0.04], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-sign
  { shape: 'box', at: [0, 4.51, 0], size: [6.98, 0.22, 3.22], mtl: 'trim-concrete', colour: PALETTE.concrete }, // cornice
  { shape: 'box', at: [1.7, 4.82, -0.5], size: [1.2, 0.4, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 3 — the department store: one shopfront and one sign the whole way along, with the upper floors returning around both ends. */
export const RETAILPARK_STORE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-3.15, 0.925, 0], size: [0.5, 1.85, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [3.15, 0.925, 0], size: [0.5, 1.85, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [0, 0.915, -0.2], size: [5.82, 1.83, 2.66], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [0, 1.65, 0], size: [5.8, 0.4, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-heads
  { shape: 'box', at: [-0.36, 0.82, 1.16], size: [5.08, 1.15, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-0.36, 0.14, 1.173], size: [5.08, 0.28, 0.045], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [2.54, 0.52, 1.17], size: [0.56, 1.04, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [0, 1.4, 1.34], size: [5.5, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 0.03, 1.6], size: [6.8, 0.06, 0.1], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 3.125, 0], size: [6.8, 2.55, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-block
  { shape: 'box', at: [0, 1.65, 1.605], size: [6.8, 0.4, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // fascia-band
  { shape: 'box', at: [0, 1.65, 1.615], size: [5.6, 0.3, 0.04], mtl: 'shop-sign', colour: PALETTE.sodium }, // store-sign
  { shape: 'box', at: [-2.4, 2.55, 1.58], size: [1.6, 0.72, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0, 2.55, 1.58], size: [2.2, 0.72, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [2.4, 2.55, 1.58], size: [1.6, 0.72, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-2.4, 3.805, 1.58], size: [1.6, 0.72, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0, 3.805, 1.58], size: [2.2, 0.72, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [2.4, 3.805, 1.58], size: [1.6, 0.72, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-3.43, 2.55, 0], size: [0.04, 0.72, 1.9], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-windows
  { shape: 'box', at: [-3.43, 3.805, 0], size: [0.04, 0.72, 1.9], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-windows
  { shape: 'box', at: [3.43, 2.55, 0], size: [0.04, 0.72, 1.9], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-windows
  { shape: 'box', at: [3.43, 3.805, 0], size: [0.04, 0.72, 1.9], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-windows
  { shape: 'box', at: [0, 3.125, 0], size: [6.86, 0.12, 3.16], mtl: 'facade-band', colour: PALETTE.awning }, // floor-band
  { shape: 'box', at: [0, 4.52, 0], size: [7.04, 0.24, 3.26], mtl: 'trim-concrete', colour: PALETTE.concrete }, // cornice
  { shape: 'box', at: [0, 4.74, 0], size: [6.92, 0.2, 3.18], mtl: 'trim-concrete', colour: PALETTE.concrete }, // cornice
  { shape: 'box', at: [-1.9, 5.04, -0.5], size: [1.5, 0.4, 1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [1.6, 4.98, -0.6], size: [1, 0.28, 0.8], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 4 — the market hall: a single glazed volume between six piers, lit from a clerestory instead of an upper floor. */
export const RETAILPARK_HALL_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 1.64, -0.13], size: [6.76, 3.28, 2.76], mtl: 'shop-navy', colour: PALETTE.shop }, // hall-back
  { shape: 'box', at: [-3.17, 1.65, 0], size: [0.46, 3.3, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // hall-piers
  { shape: 'box', at: [-2.04, 1.65, 0], size: [0.46, 3.3, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // hall-piers
  { shape: 'box', at: [-0.68, 1.65, 0], size: [0.46, 3.3, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // hall-piers
  { shape: 'box', at: [0.68, 1.65, 0], size: [0.46, 3.3, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // hall-piers
  { shape: 'box', at: [2.04, 1.65, 0], size: [0.46, 3.3, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // hall-piers
  { shape: 'box', at: [3.17, 1.65, 0], size: [0.46, 3.3, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // hall-piers
  { shape: 'box', at: [-2.605, 1.65, 1.28], size: [0.67, 2.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // hall-glazing
  { shape: 'box', at: [-1.36, 1.65, 1.28], size: [0.9, 2.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // hall-glazing
  { shape: 'box', at: [0, 2.18, 1.28], size: [0.9, 1.64, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // hall-glazing
  { shape: 'box', at: [1.36, 1.65, 1.28], size: [0.9, 2.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // hall-glazing
  { shape: 'box', at: [2.605, 1.65, 1.28], size: [0.67, 2.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // hall-glazing
  { shape: 'box', at: [-2.605, 0.42, 1.29], size: [0.67, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [-2.605, 1.5, 1.29], size: [0.67, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [-2.605, 2.58, 1.29], size: [0.67, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [-1.36, 0.42, 1.29], size: [0.9, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [-1.36, 1.5, 1.29], size: [0.9, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [-1.36, 2.58, 1.29], size: [0.9, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [0, 1.5, 1.29], size: [0.9, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [0, 2.58, 1.29], size: [0.9, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [1.36, 0.42, 1.29], size: [0.9, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [1.36, 1.5, 1.29], size: [0.9, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [1.36, 2.58, 1.29], size: [0.9, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [2.605, 0.42, 1.29], size: [0.67, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [2.605, 1.5, 1.29], size: [0.67, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [2.605, 2.58, 1.29], size: [0.67, 0.08, 0.04], mtl: 'glazing-bar', colour: PALETTE.kerb }, // glazing-bars
  { shape: 'box', at: [0, 0.6, 1.305], size: [1.4, 1.2, 0.05], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 0.03, 1.6], size: [6.8, 0.06, 0.1], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 3.43, 0], size: [6.98, 0.26, 3.24], mtl: 'trim-concrete', colour: PALETTE.concrete }, // hall-cap
  { shape: 'box', at: [0, 3.98, 0], size: [5.4, 0.84, 2.3], mtl: 'shop-navy', colour: PALETTE.shop }, // clerestory
  { shape: 'box', at: [0, 3.98, -1.18], size: [5, 0.5, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // clerestory-glazing
  { shape: 'box', at: [0, 3.98, 1.18], size: [5, 0.5, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // clerestory-glazing
  { shape: 'box', at: [0, 4.5, 0], size: [5.6, 0.2, 2.5], mtl: 'roof-tile', colour: PALETTE.tile }, // clerestory-cap
  { shape: 'box', at: [0, 3, 1.59], size: [2.4, 0.3, 0.04], mtl: 'shop-sign', colour: PALETTE.sodium }, // hall-sign
  { shape: 'box', at: [-3, 3.76, -0.5], size: [0.6, 0.4, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 5 — the stair tower: two units and their offices under a glazed stair tower standing a storey clear at one end. */
export const RETAILPARK_STAIR_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-3.19, 0.925, 0], size: [0.42, 1.85, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [-0.6, 0.925, 0], size: [0.42, 1.85, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [1.99, 0.925, 0], size: [0.42, 1.85, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [-1.895, 0.915, -0.2], size: [2.19, 1.83, 2.66], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [0.695, 0.915, -0.2], size: [2.19, 1.83, 2.66], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [-1.895, 1.65, 0], size: [2.17, 0.4, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-heads
  { shape: 'box', at: [0.695, 1.65, 0], size: [2.17, 0.4, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-heads
  { shape: 'box', at: [-1.535, 0.82, 1.16], size: [1.45, 1.15, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [1.055, 0.82, 1.16], size: [1.45, 1.15, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-1.535, 0.14, 1.173], size: [1.45, 0.28, 0.045], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [1.055, 0.14, 1.173], size: [1.45, 0.28, 0.045], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-2.62, 0.52, 1.17], size: [0.56, 1.04, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-0.03, 0.52, 1.17], size: [0.56, 1.04, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-1.895, 1.4, 1.34], size: [1.87, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0.695, 1.4, 1.34], size: [1.87, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [-0.6, 0.03, 1.6], size: [5.6, 0.06, 0.1], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [-0.6, 3.125, 0], size: [5.6, 2.55, 3.1], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-block
  { shape: 'box', at: [2.8, 2.65, 0], size: [1.2, 5.3, 3], mtl: 'trim-concrete', colour: PALETTE.concrete }, // stair-tower
  { shape: 'box', at: [2.8, 3.05, 1.53], size: [0.8, 3.7, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // tower-glazing
  { shape: 'box', at: [2.8, 0.6, 1.545], size: [0.8, 1.2, 0.05], mtl: 'door-timber', colour: PALETTE.door }, // tower-entrance
  { shape: 'box', at: [2.8, 5.41, 0], size: [1.36, 0.22, 3.14], mtl: 'roof-tile', colour: PALETTE.tile }, // tower-cap
  { shape: 'box', at: [-0.6, 1.69, 1.605], size: [5.6, 0.32, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // fascia-band
  { shape: 'box', at: [-1.895, 1.69, 1.615], size: [1.97, 0.24, 0.04], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0.695, 1.69, 1.615], size: [1.97, 0.24, 0.04], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [-2.6, 2.55, 1.58], size: [1, 0.74, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // office-glazing
  { shape: 'box', at: [-1.3, 2.55, 1.58], size: [1, 0.74, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // office-glazing
  { shape: 'box', at: [0, 2.55, 1.58], size: [1, 0.74, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // office-glazing
  { shape: 'box', at: [1.3, 2.55, 1.58], size: [1, 0.74, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // office-glazing
  { shape: 'box', at: [-2.6, 3.805, 1.58], size: [1, 0.74, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // office-glazing
  { shape: 'box', at: [-1.3, 3.805, 1.58], size: [1, 0.74, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // office-glazing
  { shape: 'box', at: [0, 3.805, 1.58], size: [1, 0.74, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // office-glazing
  { shape: 'box', at: [1.3, 3.805, 1.58], size: [1, 0.74, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // office-glazing
  { shape: 'box', at: [-0.6, 3.125, 0], size: [5.66, 0.12, 3.16], mtl: 'facade-band', colour: PALETTE.awning }, // floor-band
  { shape: 'box', at: [-0.6, 4.51, 0], size: [5.74, 0.22, 3.22], mtl: 'trim-concrete', colour: PALETTE.concrete }, // block-cap
  { shape: 'box', at: [-1, 4.82, -0.5], size: [1.4, 0.4, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];
