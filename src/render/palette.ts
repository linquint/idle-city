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
  // Civic buildings are told apart by their roof, not their mass — they stand
  // on residential plots and should still read as part of the neighbourhood.
  civic: 0x22314a,
  civicSchool: 0x7fa8ff,
  civicClinic: 0x63c6a8,
  civicSafety: 0xf0a64b,
  // Demand overlay (the Z key, second press). Green where a discount is live,
  // red where the zone is oversupplied, grey at the balance point.
  demandHigh: 0x5fd08a,
  demandNeutral: 0x46536a,
  demandLow: 0xe0574b,
} as const;
