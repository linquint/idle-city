/** Kept in step with the CSS custom properties in src/style.css. */
export const PALETTE = {
  ink: 0x0b111b,
  land: 0x16202e,
  asphalt: 0x161d28,
  kerb: 0x3a4962,
  concrete: 0xc9d1da,
  tile: 0x8b5c42,
  parapet: 0x2e3e55,
  shop: 0x27364c,
  sodium: 0xf0a64b,
  // Zone overlay (the Z key). Distinct at dusk and distinct from each other,
  // which matters more here than fitting the city's own palette.
  zoneResidential: 0x6fbf8b,
  zoneCommercial: 0x4f8fd6,
  zoneIndustrial: 0xe0a84e,
  // Industry reads as a wide, low shed: darker than a shop, with a pale flat
  // roof and a stack, so the silhouette carries the type from any angle.
  industry: 0x232d3d,
  industryRoof: 0x46566f,
  stack: 0x54637c,
  // Civic buildings span 2x2 plots, so unlike the rest of the city they can
  // afford a silhouette each. Roof colour is the second signal, not the only one.
  hospital: 0xd8dee8,
  hospitalRoof: 0x63c6a8,
  police: 0x1c2740,
  policeRoof: 0x7fa8ff,
  fire: 0x6d2f2c,
  fireRoof: 0xe0574b,
  // Zoned land nobody will ever build on: the interior of a deep block, and the
  // civic sites still standing empty. Drawn, or the blocks read as holes.
  courtyard: 0x3d6349,
  // Traffic. One shared body colour rather than a per-instance tint: at the
  // distance this is played from a car is two world units long, so the variety
  // would not read, and instance colours would have to be rewritten every frame
  // because distance culling reshuffles which slot holds which car.
  car: 0x39465e,
  headlight: 0xffe6b0,
  // Fire. Brighter than the sodium the city lights itself with, because a
  // burning roof has to be the thing you look at first.
  flame: 0xff7a2e,
  flameGlow: 0xff4a1c,
  // Demand overlay (the Z key, second press). Green where a discount is live,
  // red where the zone is oversupplied, grey at the balance point.
  demandHigh: 0x5fd08a,
  demandNeutral: 0x46536a,
  demandLow: 0xe0574b,
} as const;
