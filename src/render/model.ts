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
 * The model's primitives merged into a *single* geometry, with each part's
 * colour baked onto its vertices.
 *
 * The other merge for the other kind of thing. `mergeByMaterial` is right for a
 * building, which is written once when it is bought and then stands still: a
 * mesh per material costs one draw call each and buys a material per surface,
 * so a roof can glow and a wall cannot.
 *
 * A vehicle is the opposite case. Its transform is rewritten *every frame*, for
 * every one of it on screen, so the per-mesh cost is not one draw call — it is
 * a matrix write and a buffer upload a frame, times however many meshes the
 * model was split into. A bus of seven materials would be seven times the
 * hottest loop in the renderer for a vehicle two units long. Vertex colours
 * collapse that back to one of everything, at the cost of the only thing a
 * material could have given the parts that any of them needed: the night ramp.
 * So the lit parts of a vehicle are merged separately, by their material, and
 * everything that is merely a colour comes through here.
 *
 * Colours go through `THREE.Color` exactly as a material's would, so a part
 * baked here lands on the same value it would have had as `color:` on a
 * material of its own — whatever the renderer's colour management is doing.
 */
export function mergeColoured(parts: readonly ModelPart[]): THREE.BufferGeometry {
  const colour = new THREE.Color();
  const geometries = parts.map((part) => {
    const geometry = geometryOf(part);
    const count = geometry.getAttribute('position').count;
    const colours = new Float32Array(count * 3);
    colour.setHex(part.colour);
    for (let i = 0; i < count; i++) colour.toArray(colours, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return geometry;
  });
  return geometries.length === 1
    ? (geometries[0] as THREE.BufferGeometry)
    : mergeGeometries(geometries);
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
