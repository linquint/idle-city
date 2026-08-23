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
} as const;
