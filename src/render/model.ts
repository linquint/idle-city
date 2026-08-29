import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A building described as primitives, straight out of `tools/model2parts.mjs`.
 *
 * The converter reads an OBJ and its MTL and emits exactly this shape, so a
 * remodel is a re-run and a paste rather than a translation done by eye. It
 * recognises axis-aligned boxes and discs/rings and *refuses* anything else,
 * which is the whole point of it: a refusal says the model has a shape the
 * renderer cannot instance cheaply, and the answer is to rebuild that shape in
 * the modeller — not to hand-write the geometry here, where it stops matching
 * the file it came from and nothing will ever notice.
 *
 * Positions are the primitive's *centre*, relative to the site centre, in the
 * same world units the rest of the renderer uses: x and z across the footprint,
 * y up from the pavement.
 */
export type ModelPart =
  | {
      readonly shape: 'box';
      readonly at: readonly [number, number, number];
      readonly size: readonly [number, number, number];
      readonly colour: number;
    }
  | {
      readonly shape: 'disc';
      readonly at: readonly [number, number, number];
      readonly radius: number;
      readonly height: number;
      readonly segments: number;
      readonly colour: number;
    }
  | {
      readonly shape: 'ring';
      readonly at: readonly [number, number, number];
      readonly inner: number;
      readonly outer: number;
      readonly height: number;
      readonly segments: number;
      readonly colour: number;
    };

/** One primitive, placed where the model puts it. */
function geometryOf(part: ModelPart): THREE.BufferGeometry {
  const [x, y, z] = part.at;
  if (part.shape === 'box') {
    const [w, h, d] = part.size;
    return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  }
  if (part.shape === 'disc') {
    return new THREE.CylinderGeometry(
      part.radius,
      part.radius,
      part.height,
      part.segments,
    ).translate(x, y, z);
  }
  // An annulus, which is the one primitive three has no constructor for: a
  // circle with a circular hole, extruded. `ExtrudeGeometry` works in a shape's
  // XY plane and pushes along +Z, so it is tipped a quarter turn onto the
  // ground and then dropped by half its own thickness to centre it.
  const shape = new THREE.Shape().absarc(0, 0, part.outer, 0, Math.PI * 2, false);
  shape.holes.push(new THREE.Path().absarc(0, 0, part.inner, 0, Math.PI * 2, true));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: part.height,
    bevelEnabled: false,
    curveSegments: part.segments,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry.translate(x, y - part.height / 2, z);
}

/**
 * The model's primitives merged into one geometry per colour, in the order the
 * colours first appear.
 *
 * By colour and not by part, because a colour is what a draw call is: every
 * part sharing a material also shares this building's single instance
 * transform, so they can never be anything but one mesh's worth of work. A
 * hospital is eighteen pieces and eight draw calls, and it stays eight however
 * many the city opens.
 */
export function mergeByColour(
  parts: readonly ModelPart[],
): Array<{ colour: number; geometry: THREE.BufferGeometry }> {
  const groups = new Map<number, THREE.BufferGeometry[]>();
  for (const part of parts) {
    const found = groups.get(part.colour);
    if (found) found.push(geometryOf(part));
    else groups.set(part.colour, [geometryOf(part)]);
  }
  return [...groups].map(([colour, geometries]) => ({
    colour,
    // `mergeGeometries` on a single geometry is a copy nobody needs.
    geometry: geometries.length === 1 ? (geometries[0] as THREE.BufferGeometry) : mergeGeometries(geometries),
  }));
}
