/** Kept in step with the CSS custom properties in src/style.css. */
export const PALETTE = {
  ink: 0x111a26,
  // The district's own ground, which sits on top of the grassland and has to
  // read as made rather than grown: a pale dry earth, lighter than the streets
  // it carries so the block structure still reads from the play camera.
  land: 0x8f8a7c,
  asphalt: 0x4a4f57,
  kerb: 0x9ea1a8,
  // The world outside the districts. Two greens and a sand, mixed per vertex by
  // seeded noise — see `Grassland`. The dry tone is close enough in value to the
  // grass that the patches read as ground cover rather than as holes.
  grass: 0x7a9557,
  grassDeep: 0x638049,
  sand: 0xc3b489,
  concrete: 0xc9d1da,
  tile: 0x8b5c42,
  parapet: 0x2e3e55,
  shop: 0x27364c,
  // Shopfront dressing: a canvas canopy at street level or a sign fin above the
  // roofline. Warm and pale against the dark shop blue, so a parade of shops
  // reads as a parade from the play camera rather than as one long block.
  awning: 0xb9c2cf,
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
  // Plant equipment: vents, hoppers and housings on an industrial roof. A shade
  // off the stack it stands beside, so the two read as two things.
  vent: 0x3c4a60,
  // Civic buildings span 2x2 plots, so unlike the rest of the city they can
  // afford a silhouette each. Roof colour is the second signal, not the only one.
  hospital: 0xd8dee8,
  hospitalRoof: 0x63c6a8,
  police: 0x1c2740,
  policeRoof: 0x7fa8ff,
  fire: 0x6d2f2c,
  fireRoof: 0xe0574b,
  // Education. Warm stone against the cool civic blues, so the two panels the
  // HUD splits them into read as two things on the map as well.
  school: 0xb9ab8e,
  schoolRoof: 0x8d7f63,
  university: 0xd6c9a8,
  universityRoof: 0x9a7f4e,
  // Zoned land nobody will ever build on: the interior of a deep block, and the
  // civic sites still standing empty. Drawn, or the blocks read as holes.
  courtyard: 0x5b7f57,
  // Parks. A shade up from the courtyard they stand on, so a laid-out plot
  // reads as planted rather than as the same interior land in a new colour.
  park: 0x3f8f57,
  trunk: 0x4a3524,
  canopy: 0x53a86a,
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
  // The selection outline. Deliberately not a colour anything else in the city
  // uses: it has to read as chrome laid over the world rather than as part of it.
  select: 0xffffff,
  // Demand overlay (the Z key, second press). Green where a discount is live,
  // red where the zone is oversupplied, grey at the balance point.
  demandHigh: 0x5fd08a,
  demandNeutral: 0x46536a,
  demandLow: 0xe0574b,
} as const;
