/**
 * OBJ + MTL -> a part table of primitives.
 *
 * Recognises axis-aligned boxes and discs/rings only, and REFUSES anything else
 * rather than approximating it. A refusal is the signal to change the model, not
 * to hand-write geometry: see the authoring contract in README.md.
 *
 * Two solids welded at a shared corner are one refusal, because a group's faces
 * are split into solids by shared vertex *position*. The fix is a group each,
 * which costs the model nothing: see the police station's yard wall.
 *
 * Usage: node tools/model2parts.mjs <name.obj> <name.mtl> [--ts]
 */
import { readFileSync } from 'node:fs';

/* ---- colour ------------------------------------------------------------- */
/* MTL Kd from a glTF-lineage exporter is LINEAR. The palette is sRGB hex. */
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const toHex = (r, g, b) =>
  [r, g, b].map((c) => Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255))
    .reduce((a, v) => (a << 8) | v, 0);

/* Names lifted from src/render/palette.ts, so a palette change still propagates. */
const PALETTE = {
  0xd8dee8: 'hospital', 0x63c6a8: 'hospitalRoof', 0x2e3e55: 'parapet',
  0x54637c: 'stack', 0x2a3140: 'runway', 0xf0a64b: 'sodium',
  0xe8ecf2: 'marking', 0xd8453c: 'emergency',
  0x6d2f2c: 'fire', 0xe0574b: 'fireRoof', 0xc9d1da: 'concrete',
  0x3d5a52: 'depot', 0xc2d24f: 'depotRoof', 0x5f8f5a: 'bus',
  0x1c2740: 'police', 0x7fa8ff: 'policeRoof', 0x9ea1a8: 'kerb',
  0xe4dccb: 'landmark', 0x9c6f4f: 'landmarkRoof', 0x3f8f57: 'park',
};

/* ---- parsing ------------------------------------------------------------ */
function readMtl(path) {
  const out = {}; let cur = null;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'newmtl') out[(cur = t[1])] = 0;
    else if (t[0] === 'Kd' && cur) out[cur] = toHex(+t[1], +t[2], +t[3]);
  }
  return out;
}

function readObj(path) {
  const verts = []; const groups = []; let g = null;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v') verts.push([+t[1], +t[2], +t[3]]);
    else if (t[0] === 'o') groups.push((g = { name: t[1], mtl: null, faces: [] }));
    else if (t[0] === 'usemtl' && g) g.mtl = t[1];
    else if (t[0] === 'f' && g) g.faces.push(t.slice(1).map((s) => +s.split('/')[0] - 1));
  }
  return { verts, groups };
}

/* ---- one group may hold several solids: split on shared positions -------- */
const key = (p) => p.map((n) => n.toFixed(4)).join(',');
function solids(faces, verts) {
  const seen = new Map(); const parent = faces.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a, b) => { const [x, y] = [find(a), find(b)]; if (x !== y) parent[x] = y; };
  faces.forEach((f, i) => f.forEach((vi) => {
    const k = key(verts[vi]);
    seen.has(k) ? join(i, seen.get(k)) : seen.set(k, i);
  }));
  const out = new Map();
  faces.forEach((f, i) => (out.get(find(i)) ?? out.set(find(i), []).get(find(i))).push(f));
  return [...out.values()];
}

function aabb(pts) {
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let a = 0; a < 3; a++) {
    if (p[a] < lo[a]) lo[a] = p[a];
    if (p[a] > hi[a]) hi[a] = p[a];
  }
  return { lo, hi, centre: lo.map((v, a) => (v + hi[a]) / 2), size: lo.map((v, a) => hi[a] - v) };
}

/* ---- recognisers, strictest first --------------------------------------- */
function asBox(pts, tris) {
  if (tris !== 12) return null;
  if (new Set(pts.map(key)).size !== 8) return null;
  const b = aabb(pts);
  for (const p of pts) for (let a = 0; a < 3; a++)
    if (Math.abs(p[a] - b.lo[a]) > 1e-4 && Math.abs(p[a] - b.hi[a]) > 1e-4) return null;
  return { shape: 'box', centre: b.centre, size: b.size };
}

/**
 * A disc or a ring. Both are two rims of evenly spaced vertices.
 *
 * The angular-spacing test is not decoration: an extruded plus-sign also has
 * exactly two corner radii and two y levels, and without it every red cross in
 * the city converts to an annulus. Ask how it was found.
 */
function asRound(pts, tris) {
  const ys = [...new Set(pts.map((p) => +p[1].toFixed(4)))];
  if (ys.length !== 2) return null;
  const b = aabb(pts);
  const [cx, , cz] = b.centre;
  const radii = [...new Set(pts.map((p) => +Math.hypot(p[0] - cx, p[2] - cz).toFixed(3)))].sort((a, z) => a - z);
  if (radii.length !== 2) return null;

  const rim = radii[1];
  const angles = [...new Set(pts.filter((p) => Math.abs(Math.hypot(p[0] - cx, p[2] - cz) - rim) < 1e-3)
    .map((p) => +(((Math.atan2(p[2] - cz, p[0] - cx) + 2 * Math.PI) % (2 * Math.PI)).toFixed(4))))].sort((a, z) => a - z);
  if (angles.length < 8) return null;
  const step = (2 * Math.PI) / angles.length;
  for (let i = 0; i < angles.length; i++)
    if (Math.abs(angles[i] - i * step) > 1e-2) return null;

  const height = Math.abs(ys[1] - ys[0]);
  return radii[0] === 0
    ? { shape: 'disc', centre: b.centre, radius: rim, height, segments: angles.length }
    : { shape: 'ring', centre: b.centre, inner: radii[0], outer: rim, height, segments: angles.length };
}

/* ---- drive -------------------------------------------------------------- */
const [objPath, mtlPath, flag] = process.argv.slice(2);
const mtl = readMtl(mtlPath);
const { verts, groups } = readObj(objPath);

const parts = []; const refused = [];
for (const g of groups) {
  for (const faces of solids(g.faces, verts)) {
    const pts = faces.flatMap((f) => f.map((i) => verts[i]));
    const part = asBox(pts, faces.length) ?? asRound(pts, faces.length);
    const colour = mtl[g.mtl];
    if (part) parts.push({ ...part, from: g.name, mtl: g.mtl, colour, tris: faces.length });
    else refused.push({ from: g.name, mtl: g.mtl, tris: faces.length, verts: new Set(pts.map(key)).size });
  }
}

const n = (v) => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(3));
const name = (c) => (PALETTE[c] ? `PALETTE.${PALETTE[c]}` : `0x${c.toString(16).padStart(6, '0')} /* NEW */`);

if (flag === '--ts') {
  console.log('const PARTS: readonly Part[] = [');
  for (const p of parts) {
    const geo = p.shape === 'box'
      ? `size: [${p.size.map(n).join(', ')}]`
      : p.shape === 'disc'
        ? `radius: ${p.radius}, height: ${n(p.height)}, segments: ${p.segments}`
        : `inner: ${p.inner}, outer: ${p.outer}, height: ${n(p.height)}, segments: ${p.segments}`;
    console.log(`  { shape: '${p.shape}', at: [${p.centre.map(n).join(', ')}], ${geo}, mtl: '${p.mtl}', colour: ${name(p.colour)} }, // ${p.from}`);
  }
  console.log('];');
} else {
  const boxes = parts.filter((p) => p.shape === 'box').length;
  console.log(`${parts.length} parts (${boxes} box, ${parts.length - boxes} round), ${refused.length} refused, ${parts.reduce((a, p) => a + p.tris, 0)} tris\n`);
  for (const p of parts) {
    const geo = p.shape === 'box' ? `[${p.size.map(n).join(', ')}]`
      : p.shape === 'disc' ? `r${p.radius} h${n(p.height)} x${p.segments}`
      : `r${p.inner}-${p.outer} h${n(p.height)} x${p.segments}`;
    console.log(`  ${p.shape.padEnd(4)} ${p.from.padEnd(17)} at [${p.centre.map(n).join(', ')}]`.padEnd(60)
      + `${geo.padEnd(24)} ${p.mtl.padEnd(15)} ${name(p.colour)}`);
  }
}
if (refused.length) {
  console.log('\nREFUSED — rebuild these from boxes and cylinders, or add a recogniser:');
  for (const r of refused) console.log(`   ${r.from}  (${r.tris} tris, ${r.verts} distinct verts, ${r.mtl})`);
  process.exitCode = 1;
}
