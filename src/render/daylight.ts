import { DAY_SECONDS } from '../sim/config';

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
 * Where the dusk keyframe sits in the *solar* day, measured from sunrise.
 *
 * Phase 0 of the cycle is dusk rather than midnight, for two reasons: a fresh
 * save opens at `elapsed` 0 and should open on the city as it has always
 * looked, not on a black screen; and reduced motion holds the cycle at phase 0,
 * so phase 0 has to be the keyframe worth holding.
 *
 * 0.44 rather than 0.5 because the sodium hour is *before* the sun touches the
 * horizon, not at it: it puts the dusk keyframe at 22.8 degrees of elevation,
 * with true sunset a tenth of a day later.
 */
const DUSK_SOLAR_PHASE = 0.44;

/** Compass bearing of the sun at the dusk keyframe. Matches the old LIGHT_DIR. */
const DUSK_AZIMUTH = 0.55;

/** The phase reduced motion holds at. */
export const DUSK_PHASE = 0;

/** Time of day in [0, 1). Pure, and wraps cleanly for any finite `elapsed`. */
export function dayPhase(elapsed: number): number {
  if (!Number.isFinite(elapsed)) return DUSK_PHASE;
  const phase = (elapsed % DAY_SECONDS) / DAY_SECONDS;
  // `%` keeps the sign of the dividend, so a negative clock would run the sun
  // backwards through a negative phase and index off the front of the keyframe
  // table. Nothing produces one today; the save is what would.
  return phase < 0 ? phase + 1 : phase;
}

/** Sun elevation in radians, never below `MIN_SUN_ELEVATION`. */
export function sunElevation(phase: number): number {
  const solar = phase + DUSK_SOLAR_PHASE;
  return Math.max(MIN_SUN_ELEVATION, MAX_SUN_ELEVATION * Math.sin(TAU * solar));
}

/**
 * Sun bearing in radians. One full turn a day, so the sun rises on one horizon
 * and sets on the opposite one with local noon a quarter turn between them.
 */
export function sunAzimuth(phase: number): number {
  return DUSK_AZIMUTH + TAU * phase;
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
 * Phase 0 is the dusk the game already had — key `0xffce96` at 2.1 over a
 * `0x5e7fa8` hemisphere on an ink background — so the opening frame and the
 * reduced-motion hold are both the build this replaces, unchanged. Everything
 * else is a departure from that one anchor: nightfall drains the warmth out of
 * the key, midnight takes the whole scene down to a blue-black with a weak fill
 * standing in for skyglow, pre-dawn comes back cold before it comes back warm,
 * and midday is the only neutral in the table.
 */
const KEYFRAMES: readonly Keyframe[] = [
  { at: 0.00, key: 0xffce96, keyIntensity: 2.10, sky: 0x5e7fa8, ground: 0x0b111b, hemiIntensity: 1.15, background: 0x0b111b, night: 0.45 },
  { at: 0.10, key: 0x8b8fbe, keyIntensity: 1.00, sky: 0x35476d, ground: 0x080d16, hemiIntensity: 0.86, background: 0x080d16, night: 0.88 },
  { at: 0.31, key: 0x4a6494, keyIntensity: 0.38, sky: 0x1d2a45, ground: 0x05080f, hemiIntensity: 0.58, background: 0x05080f, night: 1.00 },
  { at: 0.48, key: 0x8aa6dc, keyIntensity: 0.80, sky: 0x3b578a, ground: 0x0b1422, hemiIntensity: 1.02, background: 0x0e1828, night: 0.72 },
  { at: 0.58, key: 0xffb37a, keyIntensity: 1.90, sky: 0x7ba5d2, ground: 0x1b2537, hemiIntensity: 1.20, background: 0x223146, night: 0.20 },
  { at: 0.81, key: 0xfff2dd, keyIntensity: 2.55, sky: 0xa8ccf0, ground: 0x30405a, hemiIntensity: 1.45, background: 0x46618a, night: 0.00 },
  { at: 0.92, key: 0xffdfae, keyIntensity: 2.35, sky: 0x8fb4dd, ground: 0x27364c, hemiIntensity: 1.30, background: 0x33496b, night: 0.10 },
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
