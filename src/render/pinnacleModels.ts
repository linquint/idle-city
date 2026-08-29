import { PALETTE } from './palette.ts';
import type { ModelPart } from './model.ts';

/**
 * The five level-5 pinnacles, as part tables.
 *
 * Housing's top rung, and the one that finishes the ladder: with these, every
 * rung a home can stand on is drawn from models and `home` is the first zone in
 * the city with **no body mesh at all**. `ZONE_SHAPES.home` still states the
 * ladder — `LEVELS` indexes it and `beacon` is read off it — but none of its
 * widths or heights describe anything that gets drawn any more.
 *
 * Built to their row like every rung before: 6.8 along the parcel by 3.1
 * across, which is `MERGED_SPAN` by `ZONE_SHAPES.home[4].width`, and 27 tall to
 * match. Third rung running on the merged parcel, so the machinery the towers
 * paid for carried them in unchanged.
 *
 * These are the *lightest* models above the walk-ups — 47 to 78 boxes against
 * the towers' 67 to 241 — and that is the design rather than a saving. The
 * progression the rungs make is toward fewer, larger ideas: a walk-up shows its
 * floors, a tower shows a vertical run of something, an arcology carries one
 * full-height idea, and a pinnacle at 27 units is read almost entirely as a
 * *shape against the sky*. Articulating it further would spend geometry on
 * something the camera at this distance cannot resolve.
 *
 * What they do all carry, and the only place in the city where five models
 * agree on a detail, is a lit entrance portal: `base-jambs`, `portal-head`,
 * `portal-back`, `entrance` and a `portal-light` over the door. A megastructure
 * holds 1,200 residents and meets the pavement at one door, and that junction
 * is the only part of it a street-level camera ever sees. Making it the same
 * door on all five is what says they are the same *kind* of building — the
 * variety is above, where it can be seen from across the city.
 *
 * GENERATED. Every table here is the output of
 *
 *     npm run model:parts -- models/pinnacleN.obj models/pinnacleN.mtl --ts
 *
 * pasted whole, and the model in `models/` is the source of truth. Do not hand
 * edit a number in this file: a value changed here silently stops matching the
 * file it came from, and the next regeneration overwrites it without a word.
 */

/** Style 1 — the stepped tiers: three setbacks narrowing to a finned crown. */
export const PINNACLE_TIERS_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-2, 1.286, 0], size: [2.8, 2.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // base-jambs
  { shape: 'box', at: [2, 1.286, 0], size: [2.8, 2.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // base-jambs
  { shape: 'box', at: [0, 2.286, 0], size: [1.2, 0.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // portal-head
  { shape: 'box', at: [0, 1.276, -0.34], size: [1.16, 2.551, 2.38], mtl: 'wall-concrete', colour: PALETTE.concrete }, // portal-back
  { shape: 'box', at: [0, 0.72, 0.88], size: [1.5, 1.44, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.95, 1.2], size: [0.9, 0.1, 0.5], mtl: 'window-light', colour: PALETTE.sodium }, // portal-light
  { shape: 'box', at: [0, 0.03, 1.581], size: [1.7, 0.06, 0.03], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
  { shape: 'box', at: [0, 9.786, 0], size: [6.76, 14.429, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // tiers
  { shape: 'box', at: [0, 20, 0], size: [5.44, 6, 2.4], mtl: 'wall-concrete', colour: PALETTE.concrete }, // tiers
  { shape: 'box', at: [0, 25, 0], size: [4.08, 4, 1.7], mtl: 'wall-concrete', colour: PALETTE.concrete }, // tiers
  { shape: 'box', at: [0, 17.08, 0], size: [6.86, 0.2, 3.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // tier-caps
  { shape: 'box', at: [0, 23.08, 0], size: [5.54, 0.2, 2.5], mtl: 'trim-grey', colour: PALETTE.kerb }, // tier-caps
  { shape: 'box', at: [0, 27.08, 0], size: [4.18, 0.2, 1.8], mtl: 'trim-grey', colour: PALETTE.kerb }, // tier-caps
  { shape: 'box', at: [-2.72, 9.736, 1.585], size: [0.96, 13.529, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 9.736, 1.585], size: [0.96, 13.529, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 9.736, 1.585], size: [0.96, 13.529, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 9.736, 1.585], size: [0.96, 13.529, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 9.736, 1.585], size: [0.96, 13.529, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 19.95, 1.235], size: [0.96, 5.1, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 19.95, 1.235], size: [0.96, 5.1, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 19.95, 1.235], size: [0.96, 5.1, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 24.95, 0.885], size: [0.96, 3.1, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 24.95, 0.885], size: [0.96, 3.1, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 24.95, 0.885], size: [0.96, 3.1, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 3.857, 1.574], size: [6.76, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 5.143, 1.574], size: [6.76, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 6.429, 1.574], size: [6.76, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 7.714, 1.574], size: [6.76, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 9, 1.574], size: [6.76, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 10.286, 1.574], size: [6.76, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 11.571, 1.574], size: [6.76, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 12.857, 1.574], size: [6.76, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 14.143, 1.574], size: [6.76, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 15.429, 1.574], size: [6.76, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 18, 1.224], size: [5.44, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 19.286, 1.224], size: [5.44, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 20.571, 1.224], size: [5.44, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 21.857, 1.224], size: [5.44, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 24.429, 0.874], size: [4.08, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 25.714, 0.874], size: [4.08, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 25, 0.891], size: [0.14, 4, 0.035], mtl: 'trim-grey', colour: PALETTE.kerb }, // crown-fins
  { shape: 'box', at: [-0.68, 25, 0.891], size: [0.14, 4, 0.035], mtl: 'trim-grey', colour: PALETTE.kerb }, // crown-fins
  { shape: 'box', at: [0.68, 25, 0.891], size: [0.14, 4, 0.035], mtl: 'trim-grey', colour: PALETTE.kerb }, // crown-fins
  { shape: 'box', at: [2.04, 25, 0.891], size: [0.14, 4, 0.035], mtl: 'trim-grey', colour: PALETTE.kerb }, // crown-fins
  { shape: 'box', at: [0, 9.786, 0], size: [6.8, 0.08, 3.14], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 20, 0], size: [5.48, 0.08, 2.44], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 25, 0], size: [4.12, 0.08, 1.74], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 27.44, -0.3], size: [1.4, 0.6, 1], mtl: 'roof-plant', colour: PALETTE.stack }, // crown-plant
];

/** Style 2 — the sky bridge: twin shafts joined high by a glazed link. */
export const PINNACLE_BRIDGE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-2, 1.286, 0], size: [2.8, 2.571, 2.5], mtl: 'wall-concrete', colour: PALETTE.concrete }, // base-jambs
  { shape: 'box', at: [2, 1.286, 0], size: [2.8, 2.571, 2.5], mtl: 'wall-concrete', colour: PALETTE.concrete }, // base-jambs
  { shape: 'box', at: [0, 2.286, 0], size: [1.2, 0.571, 2.5], mtl: 'wall-concrete', colour: PALETTE.concrete }, // portal-head
  { shape: 'box', at: [0, 1.276, -0.34], size: [1.16, 2.551, 1.78], mtl: 'wall-concrete', colour: PALETTE.concrete }, // portal-back
  { shape: 'box', at: [0, 0.72, 0.58], size: [1.5, 1.44, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.95, 0.9], size: [0.9, 0.1, 0.5], mtl: 'window-light', colour: PALETTE.sodium }, // portal-light
  { shape: 'box', at: [0, 0.03, 1.281], size: [1.7, 0.06, 0.03], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
  { shape: 'box', at: [-2.04, 14.786, 0], size: [2.7, 24.429, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // shafts
  { shape: 'box', at: [2.04, 13.186, 0], size: [2.7, 21.229, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // shafts
  { shape: 'box', at: [0, 11.786, 0], size: [1.36, 18.429, 1.9], mtl: 'wall-brick', colour: PALETTE.tile }, // link
  { shape: 'box', at: [0, 21, 0], size: [1.96, 0.34, 2.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // sky-bridge
  { shape: 'box', at: [0, 21.96, 0], size: [1.96, 0.28, 2.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // sky-bridge
  { shape: 'box', at: [0, 21.55, -1.1], size: [1.66, 0.62, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // bridge-glazing
  { shape: 'box', at: [0, 21.55, 1.1], size: [1.66, 0.62, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // bridge-glazing
  { shape: 'box', at: [0, 3.214, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 4.5, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 5.786, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 7.071, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 8.357, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 9.643, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 10.929, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 12.214, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 13.5, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 14.786, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 16.071, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 17.357, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 18.643, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [0, 19.929, 0.985], size: [0.96, 0.86, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // link-glazing
  { shape: 'box', at: [-2.72, 14.736, 1.585], size: [0.96, 23.529, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 14.736, 1.585], size: [0.96, 23.529, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 13.136, 1.585], size: [0.96, 20.329, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 13.136, 1.585], size: [0.96, 20.329, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-2.04, 3.857, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 5.143, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 6.429, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 7.714, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 9, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 10.286, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 11.571, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 12.857, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 14.143, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 15.429, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 16.714, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 18, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 19.286, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 20.571, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 21.857, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 23.143, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 24.429, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 25.714, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 3.857, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 5.143, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 6.429, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 7.714, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 9, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 10.286, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 11.571, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 12.857, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 14.143, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 15.429, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 16.714, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 18, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 19.286, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 20.571, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 21.857, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.04, 23.143, 1.574], size: [2.72, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.04, 27.12, 0], size: [2.84, 0.24, 3.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [2.04, 23.92, 0], size: [2.84, 0.24, 3.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [0, 21.1, 0], size: [1.44, 0.2, 2], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [-2.04, 13.5, 0], size: [2.76, 0.08, 3.14], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [2.04, 11.9, 0], size: [2.76, 0.08, 3.14], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [-2.04, 27.54, -0.3], size: [1.4, 0.6, 1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 3 — the buttressed core: a glazed core braced by four tapering piers. */
export const PINNACLE_BUTTRESS_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-2, 1.286, 0], size: [2.8, 2.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // base-jambs
  { shape: 'box', at: [2, 1.286, 0], size: [2.8, 2.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // base-jambs
  { shape: 'box', at: [0, 2.286, 0], size: [1.2, 0.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // portal-head
  { shape: 'box', at: [0, 1.276, -0.34], size: [1.16, 2.551, 2.38], mtl: 'wall-concrete', colour: PALETTE.concrete }, // portal-back
  { shape: 'box', at: [0, 0.72, 0.88], size: [1.5, 1.44, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.95, 1.2], size: [0.9, 0.1, 0.5], mtl: 'window-light', colour: PALETTE.sodium }, // portal-light
  { shape: 'box', at: [0, 0.03, 1.581], size: [1.7, 0.06, 0.03], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
  { shape: 'box', at: [0, 14.786, 0], size: [2.1, 24.429, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // core-shaft
  { shape: 'box', at: [-1.675, 11.786, 0], size: [0.75, 18.429, 2.8], mtl: 'wall-brick', colour: PALETTE.tile }, // buttresses
  { shape: 'box', at: [1.675, 11.786, 0], size: [0.75, 18.429, 2.8], mtl: 'wall-brick', colour: PALETTE.tile }, // buttresses
  { shape: 'box', at: [-2.85, 8.786, 0], size: [1.1, 12.429, 2.8], mtl: 'wall-brick', colour: PALETTE.tile }, // buttresses
  { shape: 'box', at: [2.85, 8.786, 0], size: [1.1, 12.429, 2.8], mtl: 'wall-brick', colour: PALETTE.tile }, // buttresses
  { shape: 'box', at: [-1.675, 21.11, 0], size: [0.85, 0.22, 2.94], mtl: 'trim-grey', colour: PALETTE.kerb }, // buttress-caps
  { shape: 'box', at: [1.675, 21.11, 0], size: [0.85, 0.22, 2.94], mtl: 'trim-grey', colour: PALETTE.kerb }, // buttress-caps
  { shape: 'box', at: [-2.85, 15.11, 0], size: [1.2, 0.22, 2.94], mtl: 'trim-grey', colour: PALETTE.kerb }, // buttress-caps
  { shape: 'box', at: [2.85, 15.11, 0], size: [1.2, 0.22, 2.94], mtl: 'trim-grey', colour: PALETTE.kerb }, // buttress-caps
  { shape: 'box', at: [-1.175, 11.786, 0], size: [0.25, 18.429, 2.4], mtl: 'wall-concrete', colour: PALETTE.concrete }, // infill
  { shape: 'box', at: [-2.175, 8.786, 0], size: [0.25, 12.429, 2.4], mtl: 'wall-concrete', colour: PALETTE.concrete }, // infill
  { shape: 'box', at: [1.175, 11.786, 0], size: [0.25, 18.429, 2.4], mtl: 'wall-concrete', colour: PALETTE.concrete }, // infill
  { shape: 'box', at: [2.175, 8.786, 0], size: [0.25, 12.429, 2.4], mtl: 'wall-concrete', colour: PALETTE.concrete }, // infill
  { shape: 'box', at: [0, 14.286, 1.58], size: [1.6, 22.629, 0.04], mtl: 'glazing', colour: PALETTE.parapet }, // core-glazing
  { shape: 'box', at: [-1.175, 11.686, 1.23], size: [0.19, 17.429, 0.04], mtl: 'glazing', colour: PALETTE.parapet }, // infill-glazing
  { shape: 'box', at: [-2.175, 8.686, 1.23], size: [0.19, 11.429, 0.04], mtl: 'glazing', colour: PALETTE.parapet }, // infill-glazing
  { shape: 'box', at: [1.175, 11.686, 1.23], size: [0.19, 17.429, 0.04], mtl: 'glazing', colour: PALETTE.parapet }, // infill-glazing
  { shape: 'box', at: [2.175, 8.686, 1.23], size: [0.19, 11.429, 0.04], mtl: 'glazing', colour: PALETTE.parapet }, // infill-glazing
  { shape: 'box', at: [0, 3.857, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 5.143, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 6.429, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 7.714, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 9, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 10.286, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 11.571, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 12.857, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 14.143, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 15.429, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 16.714, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 18, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 19.286, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 20.571, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 21.857, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 23.143, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 24.429, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 25.714, 1.574], size: [2.1, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 27.13, 0], size: [2.24, 0.26, 3.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // core-cap
  { shape: 'box', at: [0, 13.5, 0], size: [2.14, 0.08, 3.14], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 10.5, 0], size: [6.2, 0.08, 2.88], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 27.56, -0.3], size: [1.2, 0.6, 1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 4 — the sky gardens: planted voids cut clean through the slab. */
export const PINNACLE_GARDEN_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-2, 1.286, 0], size: [2.8, 2.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // base-jambs
  { shape: 'box', at: [2, 1.286, 0], size: [2.8, 2.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // base-jambs
  { shape: 'box', at: [0, 2.286, 0], size: [1.2, 0.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // portal-head
  { shape: 'box', at: [0, 1.276, -0.34], size: [1.16, 2.551, 2.38], mtl: 'wall-concrete', colour: PALETTE.concrete }, // portal-back
  { shape: 'box', at: [0, 0.72, 0.88], size: [1.5, 1.44, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.95, 1.2], size: [0.9, 0.1, 0.5], mtl: 'window-light', colour: PALETTE.sodium }, // portal-light
  { shape: 'box', at: [0, 0.03, 1.581], size: [1.7, 0.06, 0.03], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
  { shape: 'box', at: [-2.72, 14.796, 0], size: [1.36, 24.489, 3.08], mtl: 'wall-concrete', colour: PALETTE.concrete }, // end-shafts
  { shape: 'box', at: [2.72, 14.796, 0], size: [1.36, 24.489, 3.08], mtl: 'wall-concrete', colour: PALETTE.concrete }, // end-shafts
  { shape: 'box', at: [0, 14.786, -0.48], size: [4.28, 24.429, 2.06], mtl: 'wall-concrete', colour: PALETTE.concrete }, // middle-back
  { shape: 'box', at: [0, 5.786, 1.05], size: [4.2, 6.429, 1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // middle-front
  { shape: 'box', at: [0, 14.786, 1.05], size: [4.2, 6.429, 1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // middle-front
  { shape: 'box', at: [0, 23.786, 1.05], size: [4.2, 6.429, 1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // middle-front
  { shape: 'box', at: [0, 9.08, 1.05], size: [4.08, 0.16, 1], mtl: 'trim-grey', colour: PALETTE.kerb }, // void-slabs
  { shape: 'box', at: [0, 18.08, 1.05], size: [4.08, 0.16, 1], mtl: 'trim-grey', colour: PALETTE.kerb }, // void-slabs
  { shape: 'box', at: [0, 9.29, 0.89], size: [3.58, 0.26, 0.5], mtl: 'sky-garden', colour: PALETTE.hedge }, // sky-gardens
  { shape: 'box', at: [0, 18.29, 0.89], size: [3.58, 0.26, 0.5], mtl: 'sky-garden', colour: PALETTE.hedge }, // sky-gardens
  { shape: 'box', at: [0, 9.66, 1.47], size: [3.98, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [-1.98, 9.45, 1.47], size: [0.07, 0.44, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [1.98, 9.45, 1.47], size: [0.07, 0.44, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [0, 18.66, 1.47], size: [3.98, 0.07, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [-1.98, 18.45, 1.47], size: [0.07, 0.44, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [1.98, 18.45, 1.47], size: [0.07, 0.44, 0.07], mtl: 'railing-pale', colour: PALETTE.awning }, // garden-rails
  { shape: 'box', at: [-1.36, 5.786, 1.585], size: [0.96, 5.629, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // middle-glazing
  { shape: 'box', at: [0, 5.786, 1.585], size: [0.96, 5.629, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // middle-glazing
  { shape: 'box', at: [1.36, 5.786, 1.585], size: [0.96, 5.629, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // middle-glazing
  { shape: 'box', at: [-1.36, 14.786, 1.585], size: [0.96, 5.629, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // middle-glazing
  { shape: 'box', at: [0, 14.786, 1.585], size: [0.96, 5.629, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // middle-glazing
  { shape: 'box', at: [1.36, 14.786, 1.585], size: [0.96, 5.629, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // middle-glazing
  { shape: 'box', at: [-1.36, 23.786, 1.585], size: [0.96, 5.629, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // middle-glazing
  { shape: 'box', at: [0, 23.786, 1.585], size: [0.96, 5.629, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // middle-glazing
  { shape: 'box', at: [1.36, 23.786, 1.585], size: [0.96, 5.629, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // middle-glazing
  { shape: 'box', at: [0, 10.286, 0.585], size: [3.68, 2.071, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // void-glazing
  { shape: 'box', at: [0, 19.286, 0.585], size: [3.68, 2.071, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // void-glazing
  { shape: 'box', at: [-2.72, 14.736, 1.585], size: [0.91, 23.529, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [2.72, 14.736, 1.585], size: [0.91, 23.529, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // shaft-glazing
  { shape: 'box', at: [-2.72, 3.857, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 5.143, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 6.429, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 7.714, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 9, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 10.286, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 11.571, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 12.857, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 14.143, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 15.429, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 16.714, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 18, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 19.286, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 20.571, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 21.857, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 23.143, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 24.429, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 25.714, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 3.857, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 5.143, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 6.429, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 7.714, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 9, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 10.286, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 11.571, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 12.857, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 14.143, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 15.429, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 16.714, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 18, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 19.286, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 20.571, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 21.857, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 23.143, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 24.429, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [2.72, 25.714, 1.574], size: [1.36, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [-2.72, 27.16, 0], size: [1.48, 0.24, 3.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [2.72, 27.16, 0], size: [1.48, 0.24, 3.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [0, 27.12, -0.48], size: [4.36, 0.24, 2.16], mtl: 'trim-grey', colour: PALETTE.kerb }, // caps
  { shape: 'box', at: [-2.72, 13.5, 0], size: [1.4, 0.08, 3.14], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [2.72, 13.5, 0], size: [1.4, 0.08, 3.14], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 27.5, -0.48], size: [1.4, 0.6, 1], mtl: 'roof-plant', colour: PALETTE.stack }, // roof-plant
];

/** Style 5 — the louvred crown: a finned shaft under an open louvred cap. */
export const PINNACLE_LOUVRE_PARTS: readonly ModelPart[] = [
  { shape: 'box', at: [-2, 1.286, 0], size: [2.8, 2.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // base-jambs
  { shape: 'box', at: [2, 1.286, 0], size: [2.8, 2.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // base-jambs
  { shape: 'box', at: [0, 2.286, 0], size: [1.2, 0.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // portal-head
  { shape: 'box', at: [0, 1.276, -0.34], size: [1.16, 2.551, 2.38], mtl: 'wall-concrete', colour: PALETTE.concrete }, // portal-back
  { shape: 'box', at: [0, 0.72, 0.88], size: [1.5, 1.44, 0.04], mtl: 'door-timber', colour: PALETTE.door }, // entrance
  { shape: 'box', at: [0, 1.95, 1.2], size: [0.9, 0.1, 0.5], mtl: 'window-light', colour: PALETTE.sodium }, // portal-light
  { shape: 'box', at: [0, 0.03, 1.581], size: [1.7, 0.06, 0.03], mtl: 'forecourt-paving', colour: PALETTE.land }, // forecourt
  { shape: 'box', at: [0, 12.857, 0], size: [6.76, 20.571, 3.1], mtl: 'wall-concrete', colour: PALETTE.concrete }, // shaft
  { shape: 'box', at: [-3.4, 12.857, 1.589], size: [0.16, 20.571, 0.03], mtl: 'spandrel-band', colour: PALETTE.awning }, // fins
  { shape: 'box', at: [-2.04, 12.857, 1.589], size: [0.16, 20.571, 0.03], mtl: 'spandrel-band', colour: PALETTE.awning }, // fins
  { shape: 'box', at: [-0.68, 12.857, 1.589], size: [0.16, 20.571, 0.03], mtl: 'spandrel-band', colour: PALETTE.awning }, // fins
  { shape: 'box', at: [0.68, 12.857, 1.589], size: [0.16, 20.571, 0.03], mtl: 'spandrel-band', colour: PALETTE.awning }, // fins
  { shape: 'box', at: [2.04, 12.857, 1.589], size: [0.16, 20.571, 0.03], mtl: 'spandrel-band', colour: PALETTE.awning }, // fins
  { shape: 'box', at: [3.4, 12.857, 1.589], size: [0.16, 20.571, 0.03], mtl: 'spandrel-band', colour: PALETTE.awning }, // fins
  { shape: 'box', at: [-2.72, 12.857, 1.585], size: [0.96, 19.771, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [-1.36, 12.857, 1.585], size: [0.96, 19.771, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 12.857, 1.585], size: [0.96, 19.771, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [1.36, 12.857, 1.585], size: [0.96, 19.771, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [2.72, 12.857, 1.585], size: [0.96, 19.771, 0.05], mtl: 'glazing', colour: PALETTE.parapet }, // windows
  { shape: 'box', at: [0, 3.857, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 5.143, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 6.429, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 7.714, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 9, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 10.286, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 11.571, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 12.857, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 14.143, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 15.429, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 16.714, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 18, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 19.286, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 20.571, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 21.857, 1.574], size: [6.8, 0.3, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // spandrels
  { shape: 'box', at: [0, 25.071, 0], size: [6.6, 3.857, 2.8], mtl: 'wall-brick', colour: PALETTE.tile }, // crown
  { shape: 'box', at: [-3.4, 25.191, 0], size: [0.24, 4.297, 3.06], mtl: 'wall-brick', colour: PALETTE.tile }, // crown-piers
  { shape: 'box', at: [-2.04, 25.191, 0], size: [0.24, 4.297, 3.06], mtl: 'wall-brick', colour: PALETTE.tile }, // crown-piers
  { shape: 'box', at: [-0.68, 25.191, 0], size: [0.24, 4.297, 3.06], mtl: 'wall-brick', colour: PALETTE.tile }, // crown-piers
  { shape: 'box', at: [0.68, 25.191, 0], size: [0.24, 4.297, 3.06], mtl: 'wall-brick', colour: PALETTE.tile }, // crown-piers
  { shape: 'box', at: [2.04, 25.191, 0], size: [0.24, 4.297, 3.06], mtl: 'wall-brick', colour: PALETTE.tile }, // crown-piers
  { shape: 'box', at: [3.4, 25.191, 0], size: [0.24, 4.297, 3.06], mtl: 'wall-brick', colour: PALETTE.tile }, // crown-piers
  { shape: 'box', at: [0, 23.643, -1.424], size: [5.9, 0.66, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 23.643, 1.424], size: [5.9, 0.66, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 24.743, -1.424], size: [5.9, 0.66, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 24.743, 1.424], size: [5.9, 0.66, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 25.843, -1.424], size: [5.9, 0.66, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 25.843, 1.424], size: [5.9, 0.66, 0.04], mtl: 'spandrel-band', colour: PALETTE.awning }, // crown-louvres
  { shape: 'box', at: [0, 27.46, 0], size: [6.86, 0.24, 3], mtl: 'trim-grey', colour: PALETTE.kerb }, // crown-cap
  { shape: 'box', at: [0, 27.68, 0], size: [5.4, 0.2, 2.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // crown-cap
  { shape: 'box', at: [0, 23.223, 0], size: [6.94, 0.2, 3.2], mtl: 'trim-grey', colour: PALETTE.kerb }, // shaft-cap
  { shape: 'box', at: [0, 4.92, 0], size: [6.84, 0.08, 3.14], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 11.349, 0], size: [6.84, 0.08, 3.14], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
  { shape: 'box', at: [0, 17.777, 0], size: [6.84, 0.08, 3.14], mtl: 'window-light', colour: PALETTE.sodium }, // window-lights
];
