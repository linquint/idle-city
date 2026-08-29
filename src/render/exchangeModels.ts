import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-4 exchanges, as part tables.
 *
 * Commerce's fourth rung, and the first modelled rung anywhere *above* a merge
 * that is not housing's. The parcel is the one the rung below already stands
 * on — `LEVEL_FOOTPRINT` is 2 from level 3 up — so nothing about the footprint
 * changes here and the building can only grow in one direction. Every model is
 * 6.8 along the parcel by 3.2 across, which is `MERGED_SPAN` by
 * `ZONE_SHAPES.shop[3].width` exactly, and 6.0 tall to match its row against
 * the retail park's 4.4.
 *
 * That is the whole of what this rung has to say, and it is why all five say it
 * the same way. A retail park is a *wide* building; an exchange is the first
 * commercial building in the city that reads as a **tall** one, and at three
 * storeys over a shopfront the only thing that makes height legible is a
 * repeated element counting the floors off. So each carries one and commits to
 * it — three bands of curtain glazing between spandrels, a full-height glazed
 * slot between two wings, a tower set back on a podium, four giant piers
 * running the whole elevation under one entablature, or floor slabs expressed
 * as a stack of horizontals. A plain box at this height reads as the rung below
 * scaled up, which is the failure this rung exists to avoid.
 *
 * The ground floor is still the shared one the high streets introduced and the
 * retail parks kept — the same piers, shopfronts, stallrisers, doors, soffit
 * lights and pavement — with `transom` at 1.76 as the constant line where the
 * shop stops and the exchange starts. Three rungs of commerce now meet the kerb
 * identically and differ entirely above it, which is what lets a district climb
 * without its street changing.
 *
 * Still **no beacon**: `ZONE_SHAPES.shop[3].beacon` is false and commerce does
 * not light one until its fifth. At 6.0 against housing's 22 at the same rung
 * this is not a building anything needs warning about.
 *
 * One refusal here, and the first anywhere in commerce since its opening rung —
 * the high streets and the retail parks came through clean. The podium's
 * terrace rail arrived as three boxes welded at their corners, and `npm run
 * model:solids` split it into three groups without touching a vertex. That is
 * the same lump every refusal in this repo has been.
 *
 * No new palette entry either. Commerce is now four rungs deep on the colours
 * its first rung shipped with.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/exchangeN.obj models/exchangeN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 */

/** Style 1 — the curtain wall: three bands of glazing between spandrels, gridded by mullions and returning around both ends. */
export const EXCHANGE_CURTAIN_PARTS: readonly ModelPart[] = [
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
  { shape: 'box', at: [0, 3.95, 0], size: [6.8, 4.1, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-block
  { shape: 'box', at: [0, 1.76, 1.635], size: [6.8, 0.28, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // transom
  { shape: 'box', at: [-2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 1.76, 1.629], size: [1.507, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 2.583, 1.623], size: [6.3, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // curtain-glazing
  { shape: 'box', at: [0, 3.95, 1.623], size: [6.3, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // curtain-glazing
  { shape: 'box', at: [0, 5.317, 1.623], size: [6.3, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // curtain-glazing
  { shape: 'box', at: [0, 3.267, 1.635], size: [6.8, 0.36, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 4.633, 1.635], size: [6.8, 0.36, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.55, 3.95, 1.629], size: [0.08, 3.9, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [-1.7, 3.95, 1.629], size: [0.08, 3.9, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [-0.85, 3.95, 1.629], size: [0.08, 3.9, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [0, 3.95, 1.629], size: [0.08, 3.9, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [0.85, 3.95, 1.629], size: [0.08, 3.9, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [1.7, 3.95, 1.629], size: [0.08, 3.9, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [2.55, 3.95, 1.629], size: [0.08, 3.9, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [-3.423, 2.583, 0], size: [0.03, 0.927, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [-3.423, 3.95, 0], size: [0.03, 0.927, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [-3.423, 5.317, 0], size: [0.03, 0.927, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [3.423, 2.583, 0], size: [0.03, 0.927, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [3.423, 3.95, 0], size: [0.03, 0.927, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [3.423, 5.317, 0], size: [0.03, 0.927, 2.5], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // end-glazing
  { shape: 'box', at: [0, 6.13, 0], size: [6.9, 0.26, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [-1.9, 6.5, -0.6], size: [1.4, 0.48, 1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 2 — the atrium: two wings split the whole height by a glazed slot with its own entrance at the foot. */
export const EXCHANGE_ATRIUM_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-0.98, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-2.075, 0.94, -0.225], size: [1.75, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [-2.075, 1.67, 0], size: [1.93, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [-2.435, 0.85, 1.133], size: [1.01, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-2.435, 0.15, 1.145], size: [1.01, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-1.57, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-2.075, 1.45, 1.355], size: [1.43, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 0.03, 1.625], size: [6.74, 0.06, 0.05], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [-2.075, 3.95, 0], size: [2.65, 4.1, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // wings
  { shape: 'box', at: [2.075, 3.95, 0], size: [2.65, 4.1, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // wings
  { shape: 'box', at: [0, 3, -0.275], size: [1.5, 6, 2.65], mtl: 'shop-navy', colour: PALETTE.shop }, // slot-back
  { shape: 'box', at: [0, 3.4, 1.073], size: [1.2, 4.4, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // slot-glazing
  { shape: 'box', at: [0, 3.267, 1.079], size: [1.2, 0.1, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // slot-transoms
  { shape: 'box', at: [0, 4.633, 1.079], size: [1.2, 0.1, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // slot-transoms
  { shape: 'box', at: [0, 1.9, 1.079], size: [1.2, 0.1, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // slot-transoms
  { shape: 'box', at: [0, 0.6, 1.085], size: [1.1, 1.2, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // atrium-door
  { shape: 'box', at: [2.085, 0.85, 1.133], size: [1.61, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // right-shopfront
  { shape: 'box', at: [1, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // right-base
  { shape: 'box', at: [3.17, 0.95, 0], size: [0.46, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // right-base
  { shape: 'box', at: [2.085, 0.94, -0.225], size: [1.73, 1.88, 2.71], mtl: 'shop-navy', colour: PALETTE.shop }, // right-base
  { shape: 'box', at: [2.085, 1.67, 0], size: [1.91, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // right-base
  { shape: 'box', at: [0, 1.76, 1.635], size: [6.8, 0.28, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // transom
  { shape: 'box', at: [-2.075, 2.583, 1.623], size: [2.15, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // wing-glazing
  { shape: 'box', at: [-2.075, 3.95, 1.623], size: [2.15, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // wing-glazing
  { shape: 'box', at: [-2.075, 5.317, 1.623], size: [2.15, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // wing-glazing
  { shape: 'box', at: [2.075, 2.583, 1.623], size: [2.15, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // wing-glazing
  { shape: 'box', at: [2.075, 3.95, 1.623], size: [2.15, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // wing-glazing
  { shape: 'box', at: [2.075, 5.317, 1.623], size: [2.15, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // wing-glazing
  { shape: 'box', at: [-2.075, 3.267, 1.635], size: [2.65, 0.34, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.075, 4.633, 1.635], size: [2.65, 0.34, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.075, 3.267, 1.635], size: [2.65, 0.34, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.075, 4.633, 1.635], size: [2.65, 0.34, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.075, 6.13, 0], size: [2.73, 0.26, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // caps
  { shape: 'box', at: [2.075, 6.13, 0], size: [2.73, 0.26, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // caps
  { shape: 'box', at: [0, 6.1, -0.275], size: [1.54, 0.2, 2.69], mtl: 'trim-concrete', colour: PALETTE.concrete }, // caps
  { shape: 'box', at: [-2.2, 6.5, -0.6], size: [1.3, 0.48, 1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 3 — the podium: a tower set back on a two-storey podium, with a railed terrace on the roof it leaves. */
export const EXCHANGE_PODIUM_PARTS: readonly ModelPart[] = [
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
  { shape: 'box', at: [0, 2.583, 0], size: [6.8, 1.367, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // podium
  { shape: 'box', at: [0, 4.633, -0.35], size: [6.3, 2.733, 2.5], mtl: 'shop-navy', colour: PALETTE.shop }, // tower
  { shape: 'box', at: [0, 3.347, 0], size: [6.88, 0.2, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // podium-cap
  { shape: 'box', at: [0, 3.767, 1.5], size: [6.6, 0.08, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rail
  { shape: 'box', at: [-3.26, 3.587, 1.5], size: [0.08, 0.44, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rail
  { shape: 'box', at: [3.26, 3.587, 1.5], size: [0.08, 0.44, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rail
  { shape: 'box', at: [0, 1.76, 1.635], size: [6.8, 0.28, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // transom
  { shape: 'box', at: [-2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 1.76, 1.629], size: [1.507, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 2.583, 1.623], size: [6.3, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // podium-glazing
  { shape: 'box', at: [0, 3.95, 0.923], size: [5.8, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // tower-glazing
  { shape: 'box', at: [0, 5.317, 0.923], size: [5.8, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // tower-glazing
  { shape: 'box', at: [0, 4.633, 0.935], size: [6.3, 0.34, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 6.12, -0.35], size: [6.38, 0.24, 2.55], mtl: 'trim-concrete', colour: PALETTE.concrete }, // tower-cap
  { shape: 'box', at: [-1.7, 6.48, -0.5], size: [1.3, 0.48, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 4 — the giant order: four piers running the full elevation under a single entablature, glazed in bays between them. */
export const EXCHANGE_ORDER_PARTS: readonly ModelPart[] = [
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
  { shape: 'box', at: [0, 3.95, -0.15], size: [6.8, 4.1, 2.9], mtl: 'shop-navy', colour: PALETTE.shop }, // upper-back
  { shape: 'box', at: [-3.17, 3.8, 1.45], size: [0.34, 3.8, 0.3], mtl: 'trim-concrete', colour: PALETTE.concrete }, // giant-piers
  { shape: 'box', at: [-1.133, 3.8, 1.45], size: [0.34, 3.8, 0.3], mtl: 'trim-concrete', colour: PALETTE.concrete }, // giant-piers
  { shape: 'box', at: [1.133, 3.8, 1.45], size: [0.34, 3.8, 0.3], mtl: 'trim-concrete', colour: PALETTE.concrete }, // giant-piers
  { shape: 'box', at: [3.17, 3.8, 1.45], size: [0.34, 3.8, 0.3], mtl: 'trim-concrete', colour: PALETTE.concrete }, // giant-piers
  { shape: 'box', at: [0, 5.85, 1.45], size: [6.8, 0.3, 0.3], mtl: 'trim-concrete', colour: PALETTE.concrete }, // order-entablature
  { shape: 'box', at: [0, 1.76, 1.635], size: [6.8, 0.28, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // transom
  { shape: 'box', at: [-2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [0, 1.76, 1.629], size: [1.507, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [2.152, 1.76, 1.629], size: [1.277, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [-3.06, 3.85, 1.323], size: [0.5, 3.3, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // bay-glazing
  { shape: 'box', at: [-2.04, 3.85, 1.323], size: [1, 3.3, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // bay-glazing
  { shape: 'box', at: [-0.68, 3.85, 1.323], size: [1, 3.3, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // bay-glazing
  { shape: 'box', at: [0.68, 3.85, 1.323], size: [1, 3.3, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // bay-glazing
  { shape: 'box', at: [2.04, 3.85, 1.323], size: [1, 3.3, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // bay-glazing
  { shape: 'box', at: [3.06, 3.85, 1.323], size: [0.5, 3.3, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // bay-glazing
  { shape: 'box', at: [0, 3.267, 1.335], size: [6.5, 0.34, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 4.633, 1.335], size: [6.5, 0.34, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 6.14, -0.05], size: [6.86, 0.28, 3.18], mtl: 'trim-concrete', colour: PALETTE.concrete }, // parapet
  { shape: 'box', at: [1.8, 6.52, -0.5], size: [1.3, 0.48, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 5 — the expressed slabs: every floor read as a horizontal band past the glazing, under a set-back top storey. */
export const EXCHANGE_SLAB_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-3.15, 0.95, 0], size: [0.5, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [0, 0.95, 0], size: [0.5, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [3.15, 0.95, 0], size: [0.5, 1.9, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // base-piers
  { shape: 'box', at: [-1.575, 0.94, -0.225], size: [2.67, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [1.575, 0.94, -0.225], size: [2.67, 1.88, 2.67], mtl: 'shop-navy', colour: PALETTE.shop }, // base-back
  { shape: 'box', at: [-1.575, 1.67, 0], size: [2.85, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [1.575, 1.67, 0], size: [2.85, 0.34, 3.16], mtl: 'shop-navy', colour: PALETTE.shop }, // base-heads
  { shape: 'box', at: [-1.215, 0.85, 1.133], size: [1.93, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [1.935, 0.85, 1.133], size: [1.93, 1.16, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // shopfronts
  { shape: 'box', at: [-1.215, 0.15, 1.145], size: [1.93, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [1.935, 0.15, 1.145], size: [1.93, 0.3, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // stallrisers
  { shape: 'box', at: [-2.54, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [0.61, 0.54, 1.139], size: [0.56, 1.08, 0.03], mtl: 'door-timber', colour: PALETTE.door }, // shop-doors
  { shape: 'box', at: [-1.575, 1.45, 1.355], size: [2.35, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [1.575, 1.45, 1.355], size: [2.35, 0.1, 0.33], mtl: 'shopfront-light', colour: PALETTE.sodium }, // soffit-lights
  { shape: 'box', at: [0, 0.03, 1.625], size: [6.74, 0.06, 0.05], mtl: 'forecourt-paving', colour: PALETTE.forecourt }, // pavement
  { shape: 'box', at: [0, 3.267, 0], size: [6.8, 2.733, 3.2], mtl: 'shop-navy', colour: PALETTE.shop }, // lower-floors
  { shape: 'box', at: [0, 5.317, -0.3], size: [6.4, 1.367, 2.6], mtl: 'shop-navy', colour: PALETTE.shop }, // top-floor
  { shape: 'box', at: [0, 1.9, 0], size: [6.92, 0.22, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // floor-slabs
  { shape: 'box', at: [0, 3.267, 0], size: [6.92, 0.22, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // floor-slabs
  { shape: 'box', at: [0, 4.633, 0], size: [6.92, 0.22, 3.25], mtl: 'trim-concrete', colour: PALETTE.concrete }, // floor-slabs
  { shape: 'box', at: [0, 6.1, -0.3], size: [6.48, 0.2, 2.66], mtl: 'trim-concrete', colour: PALETTE.concrete }, // top-slab
  { shape: 'box', at: [0, 2.583, 1.623], size: [6.4, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // floor-glazing
  { shape: 'box', at: [0, 3.95, 1.623], size: [6.4, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // floor-glazing
  { shape: 'box', at: [0, 5.317, 1.023], size: [6, 0.927, 0.03], mtl: 'shop-glass', colour: PALETTE.shopGlass }, // top-glazing
  { shape: 'box', at: [0, 5.183, 1.5], size: [6.5, 0.08, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rail
  { shape: 'box', at: [-3.2, 5.013, 1.5], size: [0.08, 0.42, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rail
  { shape: 'box', at: [3.2, 5.013, 1.5], size: [0.08, 0.42, 0.08], mtl: 'glazing-bar', colour: PALETTE.kerb }, // terrace-rail
  { shape: 'box', at: [-2.55, 3.267, 1.629], size: [0.08, 2.433, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [-1.275, 3.267, 1.629], size: [0.08, 2.433, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [0, 3.267, 1.629], size: [0.08, 2.433, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [1.275, 3.267, 1.629], size: [0.08, 2.433, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [2.55, 3.267, 1.629], size: [0.08, 2.433, 0.03], mtl: 'glazing-bar', colour: PALETTE.kerb }, // mullions
  { shape: 'box', at: [0, 1.74, 1.635], size: [6.7, 0.26, 0.03], mtl: 'facade-band', colour: PALETTE.awning }, // transom
  { shape: 'box', at: [-1.575, 1.74, 1.629], size: [2.35, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [1.575, 1.74, 1.629], size: [2.35, 0.2, 0.03], mtl: 'shop-sign', colour: PALETTE.sodium }, // fascia-signs
  { shape: 'box', at: [-1.5, 6.44, -0.5], size: [1.2, 0.48, 0.9], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];
