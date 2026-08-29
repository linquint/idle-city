import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-1 shops, as part tables.
 *
 * The commercial ladder's first rung, and the second thing in the city to be
 * modelled rather than massed — see `houseModels.ts`, which did the same for
 * housing and set out why the rung a district is *made* of is the one worth
 * the geometry.
 *
 * What a shop has to do that a house does not is read as *open*. A house says
 * what it is with a roof; a shop says it with a lit front and a sign, at street
 * level, on the side the customer walks up. So every one of these carries a
 * shopfront light and a sign in `PALETTE.sodium`, and two of them carry a third
 * lit piece — a projecting fin and a menu board. That is what sets the reserved
 * lit-part slots per building: see `BANDS_MAX`.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/shopN.obj models/shopN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 */

/** Style 1 — the parade shop: a glazed front under a canvas awning, bollards at the kerb. */
export const SHOP_PARADE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 1.2, -0.21], size: [3, 2.4, 2.58], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [-1.275, 1.2, 1.29], size: [0.45, 2.4, 0.42], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [1.275, 1.2, 1.29], size: [0.45, 2.4, 0.42], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [0, 2.06, 1.29], size: [2.1, 0.68, 0.42], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [0, 2.51, 0], size: [3.14, 0.22, 3.14], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [0, 0.94, 1.12], size: [2.1, 1.44, 0.08], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfront
  { shape: 'box', at: [-0.7, 0.94, 1.19], size: [0.08, 1.44, 0.06], mtl: 'trim-concrete', colour: PALETTE.concrete }, // mullions
  { shape: 'box', at: [0.16, 0.94, 1.19], size: [0.08, 1.44, 0.06], mtl: 'trim-concrete', colour: PALETTE.concrete }, // mullions
  { shape: 'box', at: [0, 0.18, 1.19], size: [2.1, 0.36, 0.1], mtl: 'trim-concrete', colour: PALETTE.concrete }, // mullions
  { shape: 'box', at: [0, 1.5, 1.2], size: [1.9, 0.14, 0.05], mtl: 'shopfront-light', colour: PALETTE.sodium }, // shopfront-light
  { shape: 'box', at: [0.68, 0.55, 1.18], size: [0.62, 1.1, 0.1], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // door
  { shape: 'box', at: [0, 1.96, 1.44], size: [2.8, 0.4, 0.14], mtl: 'trim-concrete', colour: PALETTE.concrete }, // fascia
  { shape: 'box', at: [0, 1.96, 1.52], size: [2.2, 0.26, 0.05], mtl: 'shop-sign', colour: PALETTE.sodium }, // sign
  { shape: 'box', at: [0, 1.66, 1.51], size: [2.4, 0.1, 0.2], mtl: 'awning-canvas', colour: PALETTE.awning }, // awning
  { shape: 'box', at: [-1.16, 1.78, 1.48], size: [0.06, 0.34, 0.1], mtl: 'shutter-grey', colour: PALETTE.kerb }, // awning-brackets
  { shape: 'box', at: [1.16, 1.78, 1.48], size: [0.06, 0.34, 0.1], mtl: 'shutter-grey', colour: PALETTE.kerb }, // awning-brackets
  { shape: 'box', at: [0, 0.03, 1.53], size: [3, 0.06, 0.16], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [-1.28, 0.24, 1.53], size: [0.12, 0.48, 0.12], mtl: 'shutter-grey', colour: PALETTE.kerb }, // bollards
  { shape: 'box', at: [1.28, 0.24, 1.53], size: [0.12, 0.48, 0.12], mtl: 'shutter-grey', colour: PALETTE.kerb }, // bollards
];

/** Style 2 — the corner unit: a stallriser and a recessed door under a projecting fin sign. */
export const SHOP_FIN_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 1.2, -0.5], size: [3, 2.4, 2], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [-1.05, 1.2, 1], size: [0.9, 2.4, 1], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [1.05, 1.2, 0.7], size: [0.9, 2.4, 0.4], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [0.9, 1.2, 1.05], size: [0.6, 2.4, 0.3], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [0.75, 1.2, 1.35], size: [0.3, 2.4, 0.3], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [-0.45, 2.06, 0.6], size: [2.1, 0.68, 1.8], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [0, 2.53, -0.5], size: [3.14, 0.26, 2.1], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [-1.05, 2.53, 1], size: [1.02, 0.26, 1.06], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [-0.45, 2.53, 1.44], size: [2.22, 0.26, 0.18], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [1.05, 2.53, 0.7], size: [0.96, 0.26, 0.46], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [0.9, 2.53, 1.05], size: [0.66, 0.26, 0.32], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [0.75, 2.53, 1.35], size: [0.36, 0.26, 0.32], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [0, 0.85, 1.45], size: [1.2, 1.7, 0.1], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // glazing
  { shape: 'box', at: [1.46, 0.85, 0.7], size: [0.1, 1.7, 0.36], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // glazing
  { shape: 'box', at: [1.35, 0.85, 0.92], size: [0.28, 1.7, 0.06], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // glazing
  { shape: 'box', at: [1.23, 0.85, 1.05], size: [0.06, 1.7, 0.28], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // glazing
  { shape: 'box', at: [1.05, 0.85, 1.22], size: [0.28, 1.7, 0.06], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // glazing
  { shape: 'box', at: [0.93, 0.85, 1.35], size: [0.06, 1.7, 0.28], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // glazing
  { shape: 'box', at: [0.75, 0.85, 1.52], size: [0.28, 1.7, 0.06], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // glazing
  { shape: 'box', at: [-1.46, 0.85, 0.4], size: [0.1, 1.7, 1.8], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // glazing
  { shape: 'box', at: [0.16, 0.68, 1.48], size: [0.56, 1.36, 0.08], mtl: 'door-timber', colour: PALETTE.door }, // door
  { shape: 'box', at: [-0.17, 0.75, 1.5], size: [0.1, 1.5, 0.1], mtl: 'trim-concrete', colour: PALETTE.concrete }, // door-surround
  { shape: 'box', at: [0.49, 0.75, 1.5], size: [0.1, 1.5, 0.1], mtl: 'trim-concrete', colour: PALETTE.concrete }, // door-surround
  { shape: 'box', at: [0.16, 1.42, 1.5], size: [0.76, 0.1, 0.1], mtl: 'trim-concrete', colour: PALETTE.concrete }, // door-surround
  { shape: 'box', at: [-0.42, 0.16, 1.47], size: [0.66, 0.32, 0.12], mtl: 'trim-concrete', colour: PALETTE.concrete }, // stallriser
  { shape: 'box', at: [-0.36, 1.56, 1.53], size: [0.9, 0.14, 0.06], mtl: 'shopfront-light', colour: PALETTE.sodium }, // shopfront-light
  { shape: 'box', at: [-0.36, 1.94, 1.44], size: [1.9, 0.34, 0.14], mtl: 'trim-concrete', colour: PALETTE.concrete }, // fascia
  { shape: 'box', at: [-0.36, 1.94, 1.52], size: [1.6, 0.22, 0.05], mtl: 'shop-sign', colour: PALETTE.sodium }, // sign
  { shape: 'box', at: [-1.2, 3.14, 1.15], size: [0.22, 1.5, 0.6], mtl: 'shop-navy', colour: PALETTE.shop }, // fin
  { shape: 'box', at: [-1.2, 3.14, 1.15], size: [0.26, 1.1, 0.44], mtl: 'shop-sign', colour: PALETTE.sodium }, // fin-sign
  { shape: 'box', at: [0, 0.03, 1.54], size: [3, 0.06, 0.16], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
];

/** Style 3 — the arcade: an upper floor carried on columns over a covered walkway. */
export const SHOP_ARCADE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 1.2, -0.66], size: [3, 2.4, 1.68], mtl: 'shop-navy', colour: PALETTE.shop }, // back-block
  { shape: 'box', at: [0, 1.88, 0.66], size: [3, 1.04, 1.68], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-floor
  { shape: 'box', at: [0, 1.36, 0.66], size: [3.1, 0.24, 1.78], mtl: 'trim-concrete', colour: PALETTE.concrete }, // arcade-beam
  { shape: 'box', at: [-1.32, 0.62, 1.34], size: [0.24, 1.24, 0.24], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [-0.66, 0.62, 1.34], size: [0.24, 1.24, 0.24], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [0, 0.62, 1.34], size: [0.24, 1.24, 0.24], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [0.66, 0.62, 1.34], size: [0.24, 1.24, 0.24], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [1.32, 0.62, 1.34], size: [0.24, 1.24, 0.24], mtl: 'trim-concrete', colour: PALETTE.concrete }, // columns
  { shape: 'box', at: [0, 0.04, 0.9], size: [3, 0.08, 1.2], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // arcade-floor
  { shape: 'box', at: [0, 0.72, 0.24], size: [2.7, 1.2, 0.1], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfront
  { shape: 'box', at: [0, 1.2, 0.32], size: [2.5, 0.12, 0.06], mtl: 'shopfront-light', colour: PALETTE.sodium }, // shopfront-light
  { shape: 'box', at: [-0.9, 0.52, 0.22], size: [0.6, 1.04, 0.14], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // door
  { shape: 'box', at: [-0.9, 1.9, 1.46], size: [0.7, 0.66, 0.1], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-glazing
  { shape: 'box', at: [0, 1.9, 1.46], size: [0.7, 0.66, 0.1], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-glazing
  { shape: 'box', at: [0.9, 1.9, 1.46], size: [0.7, 0.66, 0.1], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // upper-glazing
  { shape: 'box', at: [0, 2.51, 0], size: [3.12, 0.22, 3.12], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [0, 1.36, 1.57], size: [2.2, 0.2, 0.05], mtl: 'shop-sign', colour: PALETTE.sodium }, // sign
  { shape: 'box', at: [-0.82, 2.84, -0.7], size: [1, 0.44, 0.7], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
  { shape: 'box', at: [0.5, 2.8, -0.5], size: [0.6, 0.36, 0.6], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 4 — the market shop: a shutter box, a striped canopy and a crate stall on the pavement. */
export const SHOP_MARKET_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 1.2, -0.7], size: [3, 2.4, 1.6], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [-1.38, 1.2, 0.55], size: [0.24, 2.4, 0.9], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [1.38, 1.2, 0.55], size: [0.24, 2.4, 0.9], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [0, 2.06, 0.55], size: [3, 0.68, 0.9], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [0, 2.5, -0.1], size: [3.12, 0.2, 2.9], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [0, 1.56, 0.98], size: [2.5, 0.42, 0.08], mtl: 'shutter-grey', colour: PALETTE.kerb }, // shutter
  { shape: 'box', at: [0, 1.82, 0.98], size: [2.62, 0.14, 0.16], mtl: 'trim-concrete', colour: PALETTE.concrete }, // shutter-box
  { shape: 'box', at: [0, 0.8, 0.14], size: [2.5, 1.5, 0.06], mtl: 'shopfront-light', colour: PALETTE.sodium }, // interior
  { shape: 'box', at: [0, 0.5, 1.06], size: [2.5, 0.12, 0.66], mtl: 'crate-timber', colour: PALETTE.tile }, // stall
  { shape: 'box', at: [-1.1, 0.26, 1.06], size: [0.12, 0.52, 0.6], mtl: 'crate-timber', colour: PALETTE.tile }, // stall
  { shape: 'box', at: [1.1, 0.26, 1.06], size: [0.12, 0.52, 0.6], mtl: 'crate-timber', colour: PALETTE.tile }, // stall
  { shape: 'box', at: [-0.85, 0.68, 1], size: [0.5, 0.24, 0.4], mtl: 'crate-timber', colour: PALETTE.tile }, // crates
  { shape: 'box', at: [-0.25, 0.68, 1.06], size: [0.5, 0.24, 0.4], mtl: 'crate-timber', colour: PALETTE.tile }, // crates
  { shape: 'box', at: [0.35, 0.68, 1], size: [0.5, 0.24, 0.4], mtl: 'crate-timber', colour: PALETTE.tile }, // crates
  { shape: 'box', at: [0.92, 0.68, 1.06], size: [0.44, 0.24, 0.4], mtl: 'crate-timber', colour: PALETTE.tile }, // crates
  { shape: 'box', at: [-0.55, 0.9, 1.02], size: [0.44, 0.2, 0.36], mtl: 'crate-timber', colour: PALETTE.tile }, // crates
  { shape: 'box', at: [-1.2, 1.42, 1.3], size: [0.4, 0.1, 0.5], mtl: 'awning-canvas', colour: PALETTE.awning }, // canopy-stripes-pale
  { shape: 'box', at: [-0.4, 1.42, 1.3], size: [0.4, 0.1, 0.5], mtl: 'awning-canvas', colour: PALETTE.awning }, // canopy-stripes-pale
  { shape: 'box', at: [0.4, 1.42, 1.3], size: [0.4, 0.1, 0.5], mtl: 'awning-canvas', colour: PALETTE.awning }, // canopy-stripes-pale
  { shape: 'box', at: [1.2, 1.42, 1.3], size: [0.4, 0.1, 0.5], mtl: 'awning-canvas', colour: PALETTE.awning }, // canopy-stripes-pale
  { shape: 'box', at: [-0.8, 1.42, 1.3], size: [0.4, 0.1, 0.5], mtl: 'shop-navy', colour: PALETTE.shop }, // canopy-stripes-dark
  { shape: 'box', at: [0, 1.42, 1.3], size: [0.4, 0.1, 0.5], mtl: 'shop-navy', colour: PALETTE.shop }, // canopy-stripes-dark
  { shape: 'box', at: [0.8, 1.42, 1.3], size: [0.4, 0.1, 0.5], mtl: 'shop-navy', colour: PALETTE.shop }, // canopy-stripes-dark
  { shape: 'box', at: [-1.34, 0.74, 1.46], size: [0.08, 1.48, 0.08], mtl: 'shutter-grey', colour: PALETTE.kerb }, // canopy-poles
  { shape: 'box', at: [1.34, 0.74, 1.46], size: [0.08, 1.48, 0.08], mtl: 'shutter-grey', colour: PALETTE.kerb }, // canopy-poles
  { shape: 'box', at: [0, 2.06, 1.02], size: [2.2, 0.28, 0.06], mtl: 'shop-sign', colour: PALETTE.sodium }, // sign
  { shape: 'box', at: [0, 0.03, 1.4], size: [3, 0.06, 0.4], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
];

/** Style 5 — the cafe: a side wing and a forecourt of tables, chairs and planters. */
export const SHOP_CAFE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [0, 1.2, -0.6], size: [3, 2.4, 1.8], mtl: 'shop-navy', colour: PALETTE.shop }, // shell
  { shape: 'box', at: [1.24, 0.95, 0.72], size: [0.52, 1.9, 0.84], mtl: 'shop-navy', colour: PALETTE.shop }, // wing
  { shape: 'box', at: [0, 2.51, -0.6], size: [3.14, 0.22, 1.94], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [1.24, 1.98, 0.72], size: [0.66, 0.16, 0.98], mtl: 'trim-concrete', colour: PALETTE.concrete }, // wing-cap
  { shape: 'box', at: [-0.72, 1, 0.34], size: [1.44, 1.6, 0.1], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // glazing
  { shape: 'box', at: [0.8, 1, 0.34], size: [0.3, 1.6, 0.1], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // glazing
  { shape: 'box', at: [-0.2, 1.72, 0.35], size: [2.2, 0.14, 0.06], mtl: 'shopfront-light', colour: PALETTE.sodium }, // shopfront-light
  { shape: 'box', at: [0.34, 0.56, 0.32], size: [0.56, 1.12, 0.14], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // door
  { shape: 'box', at: [0, 2, 0.36], size: [2.8, 0.3, 0.14], mtl: 'trim-concrete', colour: PALETTE.concrete }, // fascia
  { shape: 'box', at: [-0.4, 2, 0.44], size: [1.8, 0.2, 0.05], mtl: 'shop-sign', colour: PALETTE.sodium }, // sign
  { shape: 'box', at: [-0.24, 0.04, 1.06], size: [2.5, 0.08, 1.06], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // forecourt
  { shape: 'box', at: [-0.95, 0.34, 1.02], size: [0.5, 0.08, 0.5], mtl: 'trim-concrete', colour: PALETTE.concrete }, // tables
  { shape: 'box', at: [-0.95, 0.19, 1.02], size: [0.12, 0.22, 0.12], mtl: 'trim-concrete', colour: PALETTE.concrete }, // tables
  { shape: 'box', at: [0.35, 0.34, 1.02], size: [0.5, 0.08, 0.5], mtl: 'trim-concrete', colour: PALETTE.concrete }, // tables
  { shape: 'box', at: [0.35, 0.19, 1.02], size: [0.12, 0.22, 0.12], mtl: 'trim-concrete', colour: PALETTE.concrete }, // tables
  { shape: 'box', at: [-1.35, 0.2, 1.02], size: [0.22, 0.24, 0.26], mtl: 'crate-timber', colour: PALETTE.tile }, // chairs
  { shape: 'box', at: [-0.55, 0.2, 1.02], size: [0.22, 0.24, 0.26], mtl: 'crate-timber', colour: PALETTE.tile }, // chairs
  { shape: 'box', at: [-0.05, 0.2, 1.02], size: [0.22, 0.24, 0.26], mtl: 'crate-timber', colour: PALETTE.tile }, // chairs
  { shape: 'box', at: [0.75, 0.2, 1.02], size: [0.22, 0.24, 0.26], mtl: 'crate-timber', colour: PALETTE.tile }, // chairs
  { shape: 'box', at: [-1.3, 0.44, 1.36], size: [0.14, 0.72, 0.3], mtl: 'shop-sign', colour: PALETTE.sodium }, // menu-board
  { shape: 'box', at: [-1.42, 0.16, 0.5], size: [0.28, 0.32, 0.6], mtl: 'trim-concrete', colour: PALETTE.concrete }, // planters
  { shape: 'box', at: [0.9, 0.16, 1.42], size: [0.6, 0.32, 0.28], mtl: 'trim-concrete', colour: PALETTE.concrete }, // planters
  { shape: 'box', at: [-0.7, 2.82, -0.9], size: [0.9, 0.4, 0.7], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];
