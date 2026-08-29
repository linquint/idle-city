import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-2 high streets, as part tables.
 *
 * Commerce's *second* rung, and the second rung anywhere above a first to be
 * modelled — `walkupModels.ts` was the first, and the argument is the one it
 * made. A cliff sits wherever a modelled rung is promoted into a massed one,
 * and until now commerce had that cliff at its very first promotion: five shop
 * silhouettes along a kerb became copies of one 3.0 x 3.2 box, in the hour
 * after the one the shops were built for.
 *
 * What a high street has to say that a parade of corner shops does not is that
 * the shop has *gained a floor* — and that the floor is part of the same
 * building rather than a box set on top of it. So every model here is read as
 * two storeys from the street: a ground floor that is nearly all glass between
 * two brick piers, a band or a fascia marking the break, and an upper floor
 * with its own windows and its own top. A shop that simply got taller would
 * read as an office block with a shopfront cut into it, which is the thing this
 * rung most needed to avoid.
 *
 * **The ground floor is deliberately shared.** All five carry the same piers,
 * shopfront, mullions, door, light and pavement, in the same places, and vary
 * only above the fascia. That is what makes them a *street* rather than five
 * buildings: a real high street is a repeated ground-floor rhythm under a run
 * of upper floors that never match, and the variety belongs where the eye reads
 * it — the skyline, not the kerb.
 *
 * The models are built to the row they replace: `ZONE_SHAPES.shop[1]` is 3.0
 * wide and 3.2 tall, and every one of these has a 3.0-wide shell over a
 * 1.85-high ground floor and a 1.35-high upper, with only the cornice, gable or
 * roof plant reaching past 3.2. So the ladder still steps where it stepped —
 * what changed is what stands on the step.
 *
 * These stand on a *single* plot, like the rung below them: `LEVEL_FOOTPRINT`
 * is [1, 1, 2, ...], so the merge is the promotion to level 3 and not to this
 * one. That is what lets them drop into the same write path a shop takes,
 * jitter and quarter turn and all, rather than needing to span a parcel.
 *
 * Nothing here needed a new palette entry, which is the first time a rung has
 * managed that: `roof-tile` is the brick brown the walls already wear and
 * `roof-plant` is the `stack` grey-blue the level-1 arcade already puts on its
 * roof. A rung that introduces no colour is a rung that cannot drift from the
 * city's palette.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/highstreetN.obj models/highstreetN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 */

/** Style 1 — the corniced block: a glazed ground floor under four upper windows, capped by a two-step cornice. */
export const HIGHSTREET_CORNICE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-1.275, 0.925, 0], size: [0.45, 1.85, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [1.275, 0.925, 0], size: [0.45, 1.85, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [0, 0.915, -0.2], size: [2.06, 1.83, 2.56], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [0, 1.65, 0], size: [2.1, 0.4, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-head
  { shape: 'box', at: [-0.315, 0.82, 1.115], size: [1.33, 1.15, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfront
  { shape: 'box', at: [-0.62, 0.845, 1.125], size: [0.08, 1.21, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [0.24, 0.845, 1.125], size: [0.08, 1.21, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [-0.315, 0.14, 1.125], size: [1.33, 0.28, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [0.7, 0.52, 1.125], size: [0.6, 1.04, 0.05], mtl: 'door-timber', colour: PALETTE.door }, // shop-door
  { shape: 'box', at: [0, 1.4, 1.29], size: [1.8, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // shopfront-light
  { shape: 'box', at: [0, 0.03, 1.55], size: [3, 0.06, 0.1], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 1.59, 1.545], size: [2.3, 0.28, 0.05], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-sign
  { shape: 'box', at: [0, 2.525, 0], size: [3, 1.35, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-floor
  { shape: 'box', at: [0, 1.85, 0], size: [3.08, 0.14, 3.08], mtl: 'facade-band', colour: PALETTE.awning }, // floor-band
  { shape: 'box', at: [-0.9, 2.53, 1.535], size: [0.52, 0.66, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-0.3, 2.53, 1.535], size: [0.52, 0.66, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0.3, 2.53, 1.535], size: [0.52, 0.66, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0.9, 2.53, 1.535], size: [0.52, 0.66, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-1.535, 2.53, -0.7], size: [0.05, 0.66, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [-1.535, 2.53, 0.7], size: [0.05, 0.66, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [1.535, 2.53, -0.7], size: [0.05, 0.66, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [1.535, 2.53, 0.7], size: [0.05, 0.66, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [0, 3.29, 0], size: [3.22, 0.18, 3.22], mtl: 'trim-concrete', colour: PALETTE.concrete }, // cornice
  { shape: 'box', at: [0, 3.46, 0], size: [3.12, 0.16, 3.12], mtl: 'trim-concrete', colour: PALETTE.concrete }, // cornice
  { shape: 'box', at: [-0.7, 3.72, -0.6], size: [1, 0.36, 0.8], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 2 — the blind shop: a canvas blind on arms over the fascia, and a railed terrace along the set-back upper floor. */
export const HIGHSTREET_BLIND_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-1.275, 0.925, 0], size: [0.45, 1.85, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [1.275, 0.925, 0], size: [0.45, 1.85, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [0, 0.915, -0.2], size: [2.06, 1.83, 2.56], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [0, 1.65, 0], size: [2.1, 0.4, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-head
  { shape: 'box', at: [-0.315, 0.82, 1.115], size: [1.33, 1.15, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfront
  { shape: 'box', at: [-0.62, 0.845, 1.125], size: [0.08, 1.21, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [0.24, 0.845, 1.125], size: [0.08, 1.21, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [-0.315, 0.14, 1.125], size: [1.33, 0.28, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [0.7, 0.52, 1.125], size: [0.6, 1.04, 0.05], mtl: 'door-timber', colour: PALETTE.door }, // shop-door
  { shape: 'box', at: [0, 1.4, 1.29], size: [1.8, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // shopfront-light
  { shape: 'box', at: [0, 0.03, 1.55], size: [3, 0.06, 0.1], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 2.525, -0.15], size: [3, 1.35, 2.7], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-floor
  { shape: 'box', at: [0, 1.65, 1.56], size: [3, 0.4, 0.06], mtl: 'facade-band', colour: PALETTE.awning }, // fascia
  { shape: 'box', at: [0, 1.65, 1.61], size: [2.5, 0.24, 0.04], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-sign
  { shape: 'box', at: [0, 1.39, 1.595], size: [2.8, 0.1, 0.07], mtl: 'awning-canvas', colour: PALETTE.awning }, // blind
  { shape: 'box', at: [-1.3, 1.51, 1.595], size: [0.07, 0.34, 0.07], mtl: 'shutter-grey', colour: PALETTE.kerb }, // blind-arms
  { shape: 'box', at: [1.3, 1.51, 1.595], size: [0.07, 0.34, 0.07], mtl: 'shutter-grey', colour: PALETTE.kerb }, // blind-arms
  { shape: 'box', at: [0, 2.17, 1.44], size: [2.9, 0.07, 0.07], mtl: 'shutter-grey', colour: PALETTE.kerb }, // terrace-rail
  { shape: 'box', at: [-1.42, 2.01, 1.44], size: [0.07, 0.38, 0.07], mtl: 'shutter-grey', colour: PALETTE.kerb }, // terrace-rail
  { shape: 'box', at: [1.42, 2.01, 1.44], size: [0.07, 0.38, 0.07], mtl: 'shutter-grey', colour: PALETTE.kerb }, // terrace-rail
  { shape: 'box', at: [-0.75, 2.57, 1.235], size: [0.6, 0.7, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0, 2.57, 1.235], size: [0.6, 0.7, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0.75, 2.57, 1.235], size: [0.6, 0.7, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0, 3.3, -0.15], size: [3.14, 0.2, 2.84], mtl: 'trim-concrete', colour: PALETTE.concrete }, // upper-cap
  { shape: 'box', at: [0.6, 3.58, -0.6], size: [0.9, 0.36, 0.7], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 3 — the stepped gable: three tiled copings climbing to a gable window above the street. */
export const HIGHSTREET_GABLE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-1.275, 0.925, 0], size: [0.45, 1.85, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [1.275, 0.925, 0], size: [0.45, 1.85, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [0, 0.915, -0.2], size: [2.06, 1.83, 2.56], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [0, 1.65, 0], size: [2.1, 0.4, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-head
  { shape: 'box', at: [-0.315, 0.82, 1.115], size: [1.33, 1.15, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfront
  { shape: 'box', at: [-0.62, 0.845, 1.125], size: [0.08, 1.21, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [0.24, 0.845, 1.125], size: [0.08, 1.21, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [-0.315, 0.14, 1.125], size: [1.33, 0.28, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [0.7, 0.52, 1.125], size: [0.6, 1.04, 0.05], mtl: 'door-timber', colour: PALETTE.door }, // shop-door
  { shape: 'box', at: [0, 1.4, 1.29], size: [1.8, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // shopfront-light
  { shape: 'box', at: [0, 0.03, 1.55], size: [3, 0.06, 0.1], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 1.59, 1.545], size: [2.3, 0.28, 0.05], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-sign
  { shape: 'box', at: [0, 2.525, 0], size: [3, 1.35, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-floor
  { shape: 'box', at: [0, 1.85, 0], size: [3.08, 0.14, 3.08], mtl: 'facade-band', colour: PALETTE.awning }, // floor-band
  { shape: 'box', at: [0, 3.37, -0.1], size: [3, 0.34, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // gable-steps
  { shape: 'box', at: [0, 3.7, -0.1], size: [2.3, 0.32, 2.8], mtl: 'shop-navy', colour: PALETTE.shop }, // gable-steps
  { shape: 'box', at: [0, 4.01, -0.1], size: [1.5, 0.3, 2.6], mtl: 'shop-navy', colour: PALETTE.shop }, // gable-steps
  { shape: 'box', at: [0, 3.58, -0.1], size: [3.12, 0.12, 3.06], mtl: 'roof-tile', colour: PALETTE.tile }, // step-copings
  { shape: 'box', at: [0, 3.9, -0.1], size: [2.42, 0.12, 2.86], mtl: 'roof-tile', colour: PALETTE.tile }, // step-copings
  { shape: 'box', at: [0, 4.2, -0.1], size: [1.62, 0.12, 2.66], mtl: 'roof-tile', colour: PALETTE.tile }, // step-copings
  { shape: 'box', at: [-0.75, 2.53, 1.535], size: [0.56, 0.72, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0, 2.53, 1.535], size: [0.56, 0.72, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0.75, 2.53, 1.535], size: [0.56, 0.72, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [0, 4.06, 1.235], size: [0.5, 0.18, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // gable-window
  { shape: 'box', at: [-1.535, 2.53, -0.7], size: [0.05, 0.66, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [-1.535, 2.53, 0.7], size: [0.05, 0.66, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [1.535, 2.53, -0.7], size: [0.05, 0.66, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [1.535, 2.53, 0.7], size: [0.05, 0.66, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
];

/** Style 4 — the oriel: a corbelled bay window projecting from the upper floor, with a raised parapet behind it. */
export const HIGHSTREET_ORIEL_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-1.275, 0.925, 0], size: [0.45, 1.85, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [1.275, 0.925, 0], size: [0.45, 1.85, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [0, 0.915, -0.2], size: [2.06, 1.83, 2.56], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [0, 1.65, 0], size: [2.1, 0.4, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-head
  { shape: 'box', at: [-0.315, 0.82, 1.115], size: [1.33, 1.15, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfront
  { shape: 'box', at: [-0.62, 0.845, 1.125], size: [0.08, 1.21, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [0.24, 0.845, 1.125], size: [0.08, 1.21, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [-0.315, 0.14, 1.125], size: [1.33, 0.28, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [0.7, 0.52, 1.125], size: [0.6, 1.04, 0.05], mtl: 'door-timber', colour: PALETTE.door }, // shop-door
  { shape: 'box', at: [0, 1.4, 1.29], size: [1.8, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // shopfront-light
  { shape: 'box', at: [0, 0.03, 1.55], size: [3, 0.06, 0.1], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 1.59, 1.545], size: [2.3, 0.28, 0.05], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-sign
  { shape: 'box', at: [0, 2.525, 0], size: [3, 1.35, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-floor
  { shape: 'box', at: [0, 1.85, 0], size: [3.08, 0.14, 3.08], mtl: 'facade-band', colour: PALETTE.awning }, // floor-band
  { shape: 'box', at: [-0.9, 2.575, 1.56], size: [0.9, 1.11, 0.12], mtl: 'shop-navy', colour: PALETTE.shop }, // oriel
  { shape: 'box', at: [-0.9, 1.95, 1.54], size: [1.04, 0.16, 0.12], mtl: 'trim-concrete', colour: PALETTE.concrete }, // oriel-corbel
  { shape: 'box', at: [-0.9, 3.15, 1.54], size: [1.06, 0.14, 0.12], mtl: 'roof-tile', colour: PALETTE.tile }, // oriel-cap
  { shape: 'box', at: [-0.9, 2.575, 1.63], size: [0.72, 0.93, 0.04], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // oriel-glazing
  { shape: 'box', at: [-1.34, 2.575, 1.56], size: [0.04, 0.93, 0.14], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // oriel-glazing
  { shape: 'box', at: [-0.46, 2.575, 1.56], size: [0.04, 0.93, 0.14], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // oriel-glazing
  { shape: 'box', at: [0.5, 2.55, 1.535], size: [0.5, 0.68, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [1.15, 2.55, 1.535], size: [0.5, 0.68, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-windows
  { shape: 'box', at: [-1.535, 2.55, -0.7], size: [0.05, 0.68, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [-1.535, 2.55, 0.7], size: [0.05, 0.68, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [1.535, 2.55, -0.7], size: [0.05, 0.68, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [1.535, 2.55, 0.7], size: [0.05, 0.68, 0.52], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-windows
  { shape: 'box', at: [0, 3.31, 0], size: [3.18, 0.22, 3.18], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [-0.9, 3.54, 0.6], size: [1.1, 0.24, 1.1], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [0.8, 3.6, -0.6], size: [0.9, 0.36, 0.8], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 5 — the loft: a full-width run of glazing between two lintels, returning down both flanks. */
export const HIGHSTREET_LOFT_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-1.275, 0.925, 0], size: [0.45, 1.85, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [1.275, 0.925, 0], size: [0.45, 1.85, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-piers
  { shape: 'box', at: [0, 0.915, -0.2], size: [2.06, 1.83, 2.56], mtl: 'shop-navy', colour: PALETTE.shop }, // ground-back
  { shape: 'box', at: [0, 1.65, 0], size: [2.1, 0.4, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // shopfront-head
  { shape: 'box', at: [-0.315, 0.82, 1.115], size: [1.33, 1.15, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfront
  { shape: 'box', at: [-0.62, 0.845, 1.125], size: [0.08, 1.21, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [0.24, 0.845, 1.125], size: [0.08, 1.21, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [-0.315, 0.14, 1.125], size: [1.33, 0.28, 0.05], mtl: 'facade-band', colour: PALETTE.awning }, // mullions
  { shape: 'box', at: [0.7, 0.52, 1.125], size: [0.6, 1.04, 0.05], mtl: 'door-timber', colour: PALETTE.door }, // shop-door
  { shape: 'box', at: [0, 1.4, 1.29], size: [1.8, 0.1, 0.3], mtl: 'shopfront-light', colour: PALETTE.sodium }, // shopfront-light
  { shape: 'box', at: [0, 0.03, 1.55], size: [3, 0.06, 0.1], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 2.525, 0], size: [3, 1.35, 3], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-floor
  { shape: 'box', at: [0, 3.04, 1.535], size: [3, 0.32, 0.07], mtl: 'facade-band', colour: PALETTE.awning }, // lintel
  { shape: 'box', at: [0, 1.93, 1.535], size: [3, 0.16, 0.07], mtl: 'facade-band', colour: PALETTE.awning }, // lintel
  { shape: 'box', at: [0, 2.525, 1.535], size: [2.5, 0.75, 0.05], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // loft-glazing
  { shape: 'box', at: [-0.62, 2.525, 1.545], size: [0.07, 0.75, 0.05], mtl: 'shutter-grey', colour: PALETTE.kerb }, // loft-mullions
  { shape: 'box', at: [0, 2.525, 1.545], size: [0.07, 0.75, 0.05], mtl: 'shutter-grey', colour: PALETTE.kerb }, // loft-mullions
  { shape: 'box', at: [0.62, 2.525, 1.545], size: [0.07, 0.75, 0.05], mtl: 'shutter-grey', colour: PALETTE.kerb }, // loft-mullions
  { shape: 'box', at: [-1.535, 2.525, 0], size: [0.05, 0.75, 2.3], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-glazing
  { shape: 'box', at: [1.535, 2.525, 0], size: [0.05, 0.75, 2.3], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // side-glazing
  { shape: 'box', at: [0, 1.61, 1.545], size: [2.6, 0.26, 0.05], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-sign
  { shape: 'box', at: [0, 3.33, 0], size: [3.2, 0.26, 3.2], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [-0.6, 3.66, -0.5], size: [1.1, 0.4, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [0.8, 3.6, -0.7], size: [0.6, 0.28, 0.6], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];
