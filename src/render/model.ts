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
 *
 * `mtl` is the material's name in the MTL file and `colour` its diffuse, and
 * both are carried because they are not interchangeable: two materials may
 * share a colour and mean different things. The fire station's `roof-red` and
 * `beacon-red` are the same red, and one is a painted roof while the other is a
 * light — a distinction no amount of looking at the colour recovers.
 */
export type ModelPart =
  | {
      readonly shape: 'box';
      readonly at: readonly [number, number, number];
      readonly size: readonly [number, number, number];
      readonly mtl: string;
      readonly colour: number;
    }
  | {
      readonly shape: 'disc';
      readonly at: readonly [number, number, number];
      readonly radius: number;
      readonly height: number;
      readonly segments: number;
      readonly mtl: string;
      readonly colour: number;
    }
  | {
      readonly shape: 'ring';
      readonly at: readonly [number, number, number];
      readonly inner: number;
      readonly outer: number;
      readonly height: number;
      readonly segments: number;
      readonly mtl: string;
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
 * The model's primitives merged into one geometry per material, in the order
 * the materials first appear.
 *
 * Per material, because a material is what a draw call is: every part wearing
 * one also shares this building's single instance transform, so they can never
 * be more than one mesh's worth of work. A hospital is twenty-one pieces and
 * eight draw calls, and it stays eight however many the city opens.
 *
 * Per material rather than per *colour*, which is the same thing right up until
 * it is not: the fire station paints its beacon and its roof caps the same red
 * and needs the beacon lit, so a merge keyed on colour would weld a light onto
 * three roofs with no way back.
 */
export function mergeByMaterial(
  parts: readonly ModelPart[],
): Array<{ mtl: string; colour: number; geometry: THREE.BufferGeometry }> {
  const groups = new Map<string, { colour: number; geometries: THREE.BufferGeometry[] }>();
  for (const part of parts) {
    const found = groups.get(part.mtl);
    if (found) found.geometries.push(geometryOf(part));
    else groups.set(part.mtl, { colour: part.colour, geometries: [geometryOf(part)] });
  }
  return [...groups].map(([mtl, { colour, geometries }]) => ({
    mtl,
    colour,
    // `mergeGeometries` on a single geometry is a copy nobody needs.
    geometry:
      geometries.length === 1
        ? (geometries[0] as THREE.BufferGeometry)
        : mergeGeometries(geometries),
  }));
}
