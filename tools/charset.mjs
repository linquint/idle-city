/**
 * Every character this game can put on screen.
 *
 * Its own module because two things need the same answer and must not each have
 * their own: `tools/fonts.mjs` subsets the four faces to it, and
 * `test/fonts.test.ts` recomputes it and refuses a build whose fonts were cut
 * to a different set. A copy in each would be a copy that drifts, and the way
 * it would drift is a character rendering in the fallback stack — one glyph in
 * a different typeface, which is exactly the kind of bug nobody files.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where the characters come from, and it is deliberately everything.
 *
 * Both halves of the HUD write text: `index.html` carries the static markup and
 * `src/ui/hud.ts` writes the live numbers and prose — but the event log, the
 * config's own service and rank names, and the achievement table all end up on
 * screen too. So the sweep is every source file rather than the two obvious
 * ones. A character reaching the DOM from a file this missed would render in
 * the fallback stack, so the net is cast wide and the cost of a few dozen
 * unused glyphs is nothing.
 */
const SOURCES = ['index.html', 'src'];

const walk = (path, out = []) => {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) walk(join(path, entry), out);
    return out;
  }
  if (/\.(ts|css|html)$/.test(path)) out.push(path);
  return out;
};

/**
 * The set, sorted, as a string.
 *
 * Everything printable in the sources plus the whole of printable ASCII, and
 * the second half is not laziness: `fmt` and `fmtDuration` build strings the
 * source never spells out, so a digit or a `+` can reach the screen in a
 * combination that appears in no literal. ASCII is 95 glyphs and costs almost
 * nothing beside the outlines that are there anyway.
 *
 * Bounded above at U+2FFF, which is past every typographic mark the HUD uses —
 * the multiplication sign, the em and en dashes, the middot, the degree sign,
 * the arrows in the away report — and short of the CJK blocks, which nothing
 * here writes and which would be a font an order of magnitude larger.
 */
export function charset(root = '.') {
  const seen = new Set();
  for (let code = 0x20; code < 0x7f; code++) seen.add(String.fromCharCode(code));
  for (const source of SOURCES) {
    for (const file of walk(join(root, source))) {
      for (const ch of readFileSync(file, 'utf8')) {
        const code = ch.codePointAt(0) ?? 0;
        if (code < 0x20 || code === 0x7f) continue;
        if (code > 0x2fff) continue;
        seen.add(ch);
      }
    }
  }
  return [...seen].sort().join('');
}
