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
  // Water. Two tones and no third: the deep one is what a flat translucent
  // plane reads as from the play camera, and the pale one is a band along every
  // shore, which is the only cue that says where the land stops without a
  // reflection or an animated normal to say it. Both are lit by the same key
  // and hemisphere the city is, so the sea goes through the day with it.
  water: 0x2f6076,
  shallow: 0x6ba8ad,
  concrete: 0xc9d1da,
  tile: 0x8b5c42,
  parapet: 0x2e3e55,
  shop: 0x27364c,
  // Shopfront dressing: a canvas canopy at street level or a sign fin above the
  // roofline. Warm and pale against the dark shop blue, so a parade of shops
  // reads as a parade from the play camera rather than as one long block.
  awning: 0xb9c2cf,
  sodium: 0xf0a64b,
  // Scaffolding, up around whatever is being built and down the frame it
  // finishes. A warm ochre against a city of cool concrete, dark shop blue and
  // darker industry: a site has to be findable across a district, and the only
  // other warm things on the map are a pitched roof (browner) and a sodium lamp
  // (which is a glow material and reads as light rather than as timber).
  scaffold: 0xc99a4e,
  // Survey ground: sellable frontage the city owns and has zoned to nothing.
  // A dry, pale earth against the courtyard's grey — it has to read as *land*
  // rather than as an empty civic square, because the two are next to each other
  // in the same block and mean opposite things: one is held back forever and the
  // other is what the city is about to decide. Only the frontier district ever
  // carries any, so this is the colour of the edge of the map.
  scrub: 0xa8a086,
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
  // The cross on the hospital's wing roof, and the only place this red is used.
  // Deliberately not the fire station's: those two are the civic pair most
  // easily confused from overhead, and a shared red would be the one cue that
  // undid the silhouette work. Warmer and lighter than `fire`, cooler than
  // `flame`, so a burning roof still wins the eye over a painted marking.
  emergency: 0xd8453c,
  police: 0x1c2740,
  // The station's head band and cell cap, and its blue lights — over the door,
  // on the mast head and on each patrol car's roof bar. Paint and light in one
  // colour, which is why the model keeps them apart by material name rather
  // than by hex; see `policeStationSet`.
  policeRoof: 0x7fa8ff,
  fire: 0x6d2f2c,
  fireRoof: 0xe0574b,
  // Education. Warm stone against the cool civic blues, so the two panels the
  // HUD splits them into read as two things on the map as well.
  school: 0xb9ab8e,
  schoolRoof: 0x8d7f63,
  university: 0xd6c9a8,
  universityRoof: 0x9a7f4e,
  // Landmarks. Pale stone against every civic blue and teal on the map, because
  // a landmark's job is to be picked out from across the city. The two sizes
  // share a palette and differ in silhouette — a colonnaded hall against a bowl
  // of stands — and each keeps a lit fitting of its own, the museum's roof
  // lantern and the stadium's four floodlights, so both still say where they
  // are after dark when their neighbours have gone flat.
  landmark: 0xe4dccb,
  // The cornices and portico roof on the museum, the facade band and canopy on
  // the stadium. Warm brown against the stone, which is what draws every
  // horizontal line on a landmark from the play camera.
  landmarkRoof: 0x9c6f4f,
  // The city hall. Pale limestone like a landmark, on the one roof colour
  // nothing else in the city wears — the map already has mint, cornflower, red,
  // two browns and a lime on 2x2 roofs, and a seventh blue would be the police
  // station at a glance. There is exactly one of these in a city, so it has to
  // be findable rather than merely different.
  hall: 0xd3cfc4,
  hallRoof: 0x9a8fb8,
  // A power plant is industrial rather than civic, so it wears the industry's
  // own concrete and its stack colour — what tells it apart from a works is the
  // silhouette (two cooling towers on a 2x2 square) and the lit vent between
  // them, not a colour nothing else has.
  plant: 0x4c5a71,
  plantRoof: 0x38455a,
  // The airport. An apron is made ground like an estate's yard and a runway is
  // road, so both borrow what the city already uses for those — what makes the
  // shape legible from the play camera is the *markings*, which are the one
  // white surface anywhere on the map.
  apron: 0x6f7683,
  runway: 0x2a3140,
  marking: 0xe8ecf2,
  // The waterfront. A quay is a deck the colour of the kerbs the city already
  // has, because it is the same thing: made ground with something standing on
  // it. Hulls are darker than anything on land so a ship reads against the
  // water, and a container stack is the one warm block on the coast.
  quay: 0x8d939c,
  hull: 0x2b3644,
  container: 0xb4623f,
  // Transport. The depot is a shed over an apron rather than a civic slab, so
  // this is the shed and the fuel pump beside it and nothing else.
  depot: 0x3d5a52,
  // Not another teal: the hospital's roof is mint and the two 2x2 sheds would
  // read as the same building from the play camera. A transport livery instead
  // — the one hue nothing else in the city wears, and the only one worn by a
  // building *and* by vehicles: the depot's cap and sign, and a band down each
  // coach parked under it. See `busDepotSet`.
  depotRoof: 0xc2d24f,
  // The fleet, on the streets and standing on the depot's own apron. One colour
  // for both, because they are the same buses.
  bus: 0x5f8f5a,
  // Zoned land nobody will ever build on: the interior of a deep block, and the
  // civic sites still standing empty. Drawn, or the blocks read as holes.
  courtyard: 0x5b7f57,
  // Parks. A shade up from the courtyard they stand on, so a laid-out plot
  // reads as planted rather than as the same interior land in a new colour.
  park: 0x3f8f57,
  trunk: 0x4a3524,
  canopy: 0x53a86a,
  // Clipped planting: the hedge along the school's playground. Darker and
  // greyer than a tree's canopy and flatter than the park's lawn, because it is
  // neither — a hedge that borrowed either colour would read as a wall of park
  // pushed up against a school.
  hedge: 0x4a7a4e,
  // Traffic. One shared body colour rather than a per-instance tint: at the
  // distance this is played from a car is two world units long, so the variety
  // would not read, and instance colours would have to be rewritten every frame
  // because distance culling reshuffles which slot holds which car.
  car: 0x39465e,
  headlight: 0xffe6b0,
  // The network above the depot. Two vehicles and the structure one of them
  // runs on, and the three have to be told apart at play distance from a car,
  // a bus and a lorry — so a tram takes the depot's own yellow-green rather
  // than a fourth hue nothing else wears, and a train takes a cold pale metal
  // that reads against both the asphalt under it and the sky behind it.
  //
  // The viaduct is a shade of the parapet rather than of the asphalt: it is a
  // structure the city built and not a road, and at this distance the one cue
  // that says so is that it is the colour of the things that hold bridges up.
  tram: 0x9db83f,
  train: 0xb7c3ce,
  viaduct: 0x3a4c63,
  // People. One shared colour for the same reason the cars have one: a walker
  // is a third of a world unit across, so a per-instance tint would not read
  // and the distance cull reshuffles which slot holds which walker every frame.
  // Warmer and lighter than the car body, because the one thing that has to
  // read at this size is that the pavement is not more traffic.
  pedestrian: 0x8a6f63,
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
  // The sequential ramp the quantity overlays share — land value, build order,
  // traffic. Cold to warm rather than red to green, so it cannot be mistaken
  // for the demand ramp above it: demand has a sign and diverges around a
  // neutral, and these do not.
  overlayLow: 0x2f5d8c,
  overlayHigh: 0xf0a64b,
  // A plot the mode being shown has nothing to say about — a shop under the
  // land-value overlay, which is a statement about housing. Dim and neutral, so
  // it reads as "not measured" rather than as "measured low".
  overlayMute: 0x39435a,
} as const;
