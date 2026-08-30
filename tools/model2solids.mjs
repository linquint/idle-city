/**
 * Splits welded groups in an OBJ into one group per solid, losslessly.
 *
 * The other half of `model2parts.mjs`'s refusal. That tool splits a group's
 * faces into solids by shared vertex *position*, so two boxes touching at a
 * corner arrive as one lump it cannot recognise, and it refuses rather than
 * approximating. The README calls that a modelling instruction, and the fix has
 * been the same every time: give each box its own `o` group, which leaves the
 * geometry untouched. Fourteen refusals over five remodels have all been that.
 *
 * Doing it by hand means editing an exported file, and then the copy in
 * `models/` quietly differs from whatever the modeller exports next — with no
 * record of how. So it is a pass instead: re-export, run this, and the split is
 * reproduced exactly.
 *
 * **It touches only what the converter would refuse, and only where the split
 * is provably free.** It runs the same position-based union-find, finds the
 * lumps that are not a recognisable primitive, and cuts one of those apart only
 * when its faces divide into consecutive runs of exactly twelve that are each
 * an axis-aligned box: eight distinct corners, every vertex on the box's own
 * bounds. Everything else is copied through untouched — a group that already
 * converts, a disc, a ring, and a welded lump that does *not* divide cleanly,
 * which stays refused so the modeller still hears about it. A wrong guess here
 * would be a silent geometry change, and those are the worst kind.
 *
 * Vertex lines are never touched and faces keep their global indices and their
 * order, so the file still describes the same triangles in the same sequence;
 * only the `o` lines between them are new. Running it twice changes nothing the
 * second time, because the first run left no welded lumps behind.
 *
 *   node tools/model2solids.mjs <name.obj> [--write]
 *
 * Without --write it reports what it would do and changes nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [path, flag] = process.argv.slice(2);
if (!path) {
  console.error('usage: node tools/model2solids.mjs <name.obj> [--write]');
  process.exit(2);
}

const lines = readFileSync(path, 'utf8').split('\n');

/* Parse just enough to know which line each face is on, and where it sits. */
const verts = [];
const groups = [];
let group = null;
lines.forEach((raw, n) => {
  const t = raw.trim().split(/\s+/);
  if (t[0] === 'v') verts.push([+t[1], +t[2], +t[3]]);
  else if (t[0] === 'o') groups.push((group = { name: t[1], mtl: null, faces: [] }));
  else if (t[0] === 'usemtl' && group) group.mtl = t[1];
  else if (t[0] === 'f' && group) {
    group.faces.push({ line: n, idx: t.slice(1).map((s) => +s.split('/')[0] - 1) });
  }
});

const key = (p) => p.map((n) => n.toFixed(4)).join(',');

/**
 * Whether `faces` is exactly an axis-aligned box.
 *
 * Twelve triangles and eight distinct positions is not enough on its own — a
 * cube's worth of vertices can describe other things — so every vertex is also
 * required to sit on the box's own bound in all three axes. That is what makes
 * "these twelve triangles are a box" a statement about the geometry rather than
 * about its size.
 */
function isBox(faces) {
  if (faces.length !== 12) return false;
  const pts = faces.flatMap((f) => f.idx.map((vi) => verts[vi]));
  if (new Set(pts.map(key)).size !== 8) return false;
  const lo = [0, 1, 2].map((a) => Math.min(...pts.map((p) => p[a])));
  const hi = [0, 1, 2].map((a) => Math.max(...pts.map((p) => p[a])));
  const eps = 1e-6;
  return pts.every((p) =>
    p.every((c, a) => Math.abs(c - lo[a]) < eps || Math.abs(c - hi[a]) < eps),
  );
}

/**
 * A group's faces grouped into solids by shared vertex position.
 *
 * The same union-find `model2parts.mjs` runs, and it has to be the same or this
 * tool would be splitting groups that tool was perfectly happy with. Two boxes
 * meeting at a corner share a position and so land in one lump; two boxes with
 * air between them do not.
 */
function weld(faces) {
  const seen = new Map();
  const parent = faces.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a, b) => {
    const [x, y] = [find(a), find(b)];
    if (x !== y) parent[x] = y;
  };
  faces.forEach((f, i) =>
    f.idx.forEach((vi) => {
      const k = key(verts[vi]);
      if (seen.has(k)) join(i, seen.get(k));
      else seen.set(k, i);
    }),
  );
  const out = new Map();
  faces.forEach((f, i) => {
    const root = find(i);
    if (!out.has(root)) out.set(root, []);
    out.get(root).push(f);
  });
  return [...out.values()];
}

/**
 * A welded lump as consecutive runs of twelve boxes, or null if it does not fit.
 *
 * Sorted into file order first, because union-find hands its members back in
 * whatever order it merged them. The runs have to be consecutive *in the file*
 * or the cut cannot be made by inserting a line: an exporter writes a box's
 * twelve triangles together, and this is the check that it did.
 */
function runs(faces) {
  if (faces.length < 24 || faces.length % 12 !== 0) return null;
  const ordered = [...faces].sort((a, b) => a.line - b.line);
  const found = [];
  for (let i = 0; i < ordered.length; i += 12) found.push(ordered.slice(i, i + 12));
  return found.every(isBox) ? found : null;
}

/* Every face line that should be preceded by a fresh `o` + `usemtl`. */
const cuts = new Map();
let split = 0;
let stuck = 0;
for (const g of groups) {
  for (const lump of weld(g.faces)) {
    // One box, a disc, a ring: whatever it is, the converter can read it.
    if (isBox(lump) || lump.length <= 12) continue;
    const found = runs(lump);
    if (!found) {
      stuck++;
      console.log(`  ${g.name}: ${lump.length} welded faces that are not a run of boxes — left alone`);
      continue;
    }
    split++;
    console.log(`  ${g.name}: ${lump.length} welded faces -> ${found.length} solids`);
    // The lump's first run stays in the group it is already in; each of the
    // rest opens one, at the line its first face is on.
    for (const run of found.slice(1)) cuts.set(run[0].line, g);
  }
}

if (split === 0 && stuck === 0) {
  console.log('  nothing welded: every group is already something the converter can read');
} else {
  console.log(`\n${split} lump(s) split into ${cuts.size + split} solids, ${stuck} left refused`);
}

if (flag !== '--write') {
  if (cuts.size) console.log('(pass --write to apply)');
  process.exit(0);
}

const out = [];
lines.forEach((raw, n) => {
  const g = cuts.get(n);
  if (g) {
    out.push(`o ${g.name}`);
    if (g.mtl) out.push(`usemtl ${g.mtl}`);
  }
  out.push(raw);
});
writeFileSync(path, out.join('\n'));
console.log(`wrote ${path}`);
