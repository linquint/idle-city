import { DAY_SECONDS } from '../sim/config.ts';

/**
 * The day/night cycle, as pure arithmetic over `elapsed`.
 *
 * No state of its own, and deliberately no three.js import: the sun is a
 * function of a field the simulation already persists, so it belongs to the
 * view exactly the way building positions do — derived, never stored. Keeping
 * it free of three also keeps it testable in the plain-Node harnesses.
 */

const TAU = Math.PI * 2;
const deg = (d: number): number => (d * Math.PI) / 180;

/**
 * The floor on sun elevation.
 *
 * A sun at the horizon is not a long shadow, it is an infinite one: shadow
 * length is height / tan(elevation), which at 1 degree is 57 times the
 * building and at 0 is undefined. The 150-unit shadow box would hold none of
 * it, so the map fills with a smear and the city loses its shadows entirely at
 * exactly the hour they read best. Eight degrees puts an arcology's shadow at
 * about seven times its height — long, raking, and still inside the box.
 */
export const MIN_SUN_ELEVATION = deg(8);

/** Elevation at local noon. Short of vertical, or midday has no shadows at all. */
export const MAX_SUN_ELEVATION = deg(62);

/**
 * Where phase 0 sits in the *solar* day, measured from sunrise.
 *
 * Phase 0 is local noon. It used to be dusk, for two good reasons that are
 * still good: a fresh save opens at `elapsed` 0 and should open on the city
 * looking like itself, and reduced motion holds the cycle at phase 0, so phase
 * 0 has to be the frame worth holding. What changed is the answer to "which
 * frame is that". A city meant to be looked at in daylight should not open at
 * the end of the day, and a player who has asked for reduced motion should not
 * be the only one who never sees it lit.
 *
 * 0.25 is a quarter of the way from sunrise to sunrise, which is noon exactly.
 * The sodium dusk is still in the table — it is the best-looking moment in the
 * game — it is simply no longer the only one anybody sees.
 */
const NOON_SOLAR_PHASE = 0.25;

/**
 * Compass bearing of the sun at phase 0.
 *
 * Chosen so the dusk keyframe still lights the city from where it always did:
 * dusk moved from phase 0 to phase 0.19, and the bearing runs one full turn a
 * day, so the noon bearing is the old dusk bearing wound back 0.19 of a turn.
 */
const NOON_AZIMUTH = 0.55 - TAU * 0.19;

/** The phase reduced motion holds at, and the one a fresh save opens on. */
export const RESTING_PHASE = 0;

/** Where the sodium keyframe sits, now that phase 0 is noon. */
export const DUSK_PHASE = 0.19;

/** Time of day in [0, 1). Pure, and wraps cleanly for any finite `elapsed`. */
export function dayPhase(elapsed: number): number {
  if (!Number.isFinite(elapsed)) return RESTING_PHASE;
  const phase = (elapsed % DAY_SECONDS) / DAY_SECONDS;
  // `%` keeps the sign of the dividend, so a negative clock would run the sun
  // backwards through a negative phase and index off the front of the keyframe
  // table. Nothing produces one today; the save is what would.
  return phase < 0 ? phase + 1 : phase;
}

/** Sun elevation in radians, never below `MIN_SUN_ELEVATION`. */
export function sunElevation(phase: number): number {
  const solar = phase + NOON_SOLAR_PHASE;
  return Math.max(MIN_SUN_ELEVATION, MAX_SUN_ELEVATION * Math.sin(TAU * solar));
}

/**
 * Sun bearing in radians. One full turn a day, so the sun rises on one horizon
 * and sets on the opposite one with local noon a quarter turn between them.
 */
export function sunAzimuth(phase: number): number {
  return NOON_AZIMUTH + TAU * phase;
}

interface Keyframe {
  /** Phase this keyframe is exact at. Ascending, and the table wraps. */
  readonly at: number;
  readonly key: number;
  readonly keyIntensity: number;
  readonly sky: number;
  readonly ground: number;
  readonly hemiIntensity: number;
  /** Background and fog take the same colour; a fog that disagrees reads as haze. */
  readonly background: number;
  /** How lit the city's own lamps run, 0 at midday and 1 at midnight. */
  readonly night: number;
}

/**
 * The palette, keyed to the sun.
 *
 * Rotated so phase 0 is midday and lifted throughout. The old table was built
 * around a single anchor — the dusk the game shipped with — and everything else
 * was a departure from it, which is why the whole city read as permanently
 * overcast: the brightest frame in the table had a background of `0x46618a`,
 * darker than most skies are at dusk.
 *
 * The sodium dusk is kept exactly as it was, at 0.19. It is the best-looking
 * moment in the game and nothing here touches it. What moved is everything
 * around it: midday is a real midday now, the two shoulders either side of it
 * are bright rather than merely less dark, and night is the only part of the
 * cycle the old palette had roughly right.
 *
 * `background` is also the fog colour, which is what makes the grassland plane
 * work at all — the ground has to fade into the same colour the sky is, or the
 * horizon reads as a seam. The two are tuned together, never separately.
 */
const KEYFRAMES: readonly Keyframe[] = [
  { at: 0.00, key: 0xfff6e6, keyIntensity: 3.05, sky: 0xbcd9f7, ground: 0x6f7f5e, hemiIntensity: 1.95, background: 0x9cc4e8, night: 0.00 },
  { at: 0.11, key: 0xffe9c4, keyIntensity: 2.80, sky: 0xa8c8ec, ground: 0x62735a, hemiIntensity: 1.75, background: 0x89b3dc, night: 0.06 },
  { at: 0.19, key: 0xffce96, keyIntensity: 2.30, sky: 0x86a5cb, ground: 0x3b4a44, hemiIntensity: 1.40, background: 0x5f7ea6, night: 0.45 },
  { at: 0.29, key: 0x8b8fbe, keyIntensity: 1.05, sky: 0x3f5477, ground: 0x141c26, hemiIntensity: 0.95, background: 0x1b2739, night: 0.88 },
  { at: 0.50, key: 0x4a6494, keyIntensity: 0.40, sky: 0x22314f, ground: 0x080d15, hemiIntensity: 0.62, background: 0x0a1220, night: 1.00 },
  { at: 0.67, key: 0x8aa6dc, keyIntensity: 0.95, sky: 0x47679d, ground: 0x1a2a2c, hemiIntensity: 1.15, background: 0x2b4364, night: 0.70 },
  { at: 0.77, key: 0xffc79a, keyIntensity: 2.35, sky: 0x8fb9e4, ground: 0x4d5c4a, hemiIntensity: 1.60, background: 0x76a2ce, night: 0.16 },
];

/** Channel-wise lerp on packed sRGB. Allocates nothing; returns a packed hex. */
function lerpHex(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 0xff) + (((b >> 16) & 0xff) - ((a >> 16) & 0xff)) * t;
  const g = ((a >> 8) & 0xff) + (((b >> 8) & 0xff) - ((a >> 8) & 0xff)) * t;
  const bl = (a & 0xff) + ((b & 0xff) - (a & 0xff)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Everything the renderer needs for one frame's sky. Mutated in place. */
export interface SkyReading {
  phase: number;
  /** Radians above the horizon, floored at `MIN_SUN_ELEVATION`. */
  elevation: number;
  azimuth: number;
  /** Unit vector from the city toward the sun. */
  dirX: number;
  dirY: number;
  dirZ: number;
  keyColor: number;
  keyIntensity: number;
  skyColor: number;
  groundColor: number;
  hemiIntensity: number;
  background: number;
  night: number;
}

export const createSkyReading = (): SkyReading => ({
  phase: 0,
  elevation: 0,
  azimuth: 0,
  dirX: 0,
  dirY: 1,
  dirZ: 0,
  keyColor: 0,
  keyIntensity: 0,
  skyColor: 0,
  groundColor: 0,
  hemiIntensity: 0,
  background: 0,
  night: 0,
});

/**
 * Fills `out` with the sky at `phase`.
 *
 * Writes into a caller-owned object rather than returning a fresh one: this
 * runs once a frame forever, and a per-frame object is a per-frame allocation.
 */
export function sampleSky(phase: number, out: SkyReading): SkyReading {
  const p = phase - Math.floor(phase);

  let i = KEYFRAMES.length - 1;
  for (let k = 0; k < KEYFRAMES.length; k++) {
    if ((KEYFRAMES[k] as Keyframe).at <= p) i = k;
    else break;
  }
  const from = KEYFRAMES[i] as Keyframe;
  const to = KEYFRAMES[(i + 1) % KEYFRAMES.length] as Keyframe;
  // The last span wraps past 1 back onto the first keyframe, so its width is
  // measured the long way round rather than as a negative difference.
  const span = to.at > from.at ? to.at - from.at : to.at + 1 - from.at;
  const t = span <= 0 ? 0 : (p - from.at) / span;

  out.phase = p;
  out.elevation = sunElevation(p);
  out.azimuth = sunAzimuth(p);
  const horizontal = Math.cos(out.elevation);
  out.dirX = Math.cos(out.azimuth) * horizontal;
  out.dirY = Math.sin(out.elevation);
  out.dirZ = Math.sin(out.azimuth) * horizontal;

  out.keyColor = lerpHex(from.key, to.key, t);
  out.keyIntensity = lerp(from.keyIntensity, to.keyIntensity, t);
  out.skyColor = lerpHex(from.sky, to.sky, t);
  out.groundColor = lerpHex(from.ground, to.ground, t);
  out.hemiIntensity = lerp(from.hemiIntensity, to.hemiIntensity, t);
  out.background = lerpHex(from.background, to.background, t);
  out.night = lerp(from.night, to.night, t);
  return out;
}
