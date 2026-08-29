import { EventLog, type GameEvent } from '../core/events';
import {
  HISTORY_SAMPLES,
  HISTORY_TIER_LABELS,
  readTier,
  tierLength,
  tierOf,
  type HistorySample,
  type HistoryTierKey,
} from '../sim/history';
import {
  ACHIEVEMENT_GROUPS,
  achievementDenominator,
  unlockedCount,
  visibleReadings,
  type Achievement,
  type AchievementGroup,
} from '../sim/achievements';
import { fmt, fmtDuration, fmtInt } from '../core/format';
import {
  systemPrefersReducedMotion,
  type MotionSetting,
  type Settings,
  type SettingsStore,
  type ShadowQuality,
} from '../core/settings';
import {
  ANNEX_MIN_OCCUPANCY,
  CELL,
  LANDMARKS,
  LANDMARK_MOOD,
  CONGESTION_MOOD,
  CRIME_MOOD,
  EDUCATION_SERVICES,
  GARBAGE_MOOD,
  HAPPINESS_MIN_BUILD,
  PLOTS_PER_PARK,
  LEVEL_EDUCATION,
  INDUSTRY_JOBS,
  INDUSTRY_OUTPUT,
  LEVEL_HOUSING,
  SHOP_BONUS,
  SHOP_JOBS,
  SHOP_TRIPS,
  INDUSTRY_BONUS,
  DISTRICT_BONUS,
  SKILL_YIELD,
  FREE_TRANSPORT_MOOD,
  FREE_TRANSPORT_REACH,
  TAX_STEPS,
  ZONE_LEVEL_NAMES,
  LEVELS,
  MAX_DISTRICTS,
  MERGE_LEVEL,
  SERVICES,
  TAX_NEUTRAL,
  AIRPORT_EXPORT_LIFT,
  AIRPORT_VISITORS,
  ROAD_VISITORS,
  CARGO_EXPORT_LIFT,
  GOODS_TRADE_ANSWER,
  GOODS_TRADE_LIFT,
  HIGHWAY_MIN_DISTRICTS,
  POWER_TRADES,
  RIVAL_MATCH_DISTRICTS,
  TERMINALS,
  TRANSIT_LINES,
  CULTURE,
  CRIME_FROM_IDLENESS,
  LIBRARY_CRIME_RELIEF,
  THEATRE_VISITORS,
  NETWORK_EXPORT_LIFT,
  FIRE_RESPONSE,
  POLICE_RESPONSE,
  RAIL_VISITORS,
  type PowerTrade,
} from '../sim/config';
import {
  abandonedBuildings,
  activeDeveloped,
  annexBlocker,
  annexCost,
  bindingTerm,
  buildingIncome,
  canAnnex,
  canBuildHome,
  canBuildIndustry,
  canBuildPark,
  canBuildService,
  canBuildEstate,
  canBuildHighway,
  canBuildShop,
  airportAllowed,
  airportBlocker,
  airportCost,
  berthsLanding,
  canBuildAirport,
  canBuildCityHall,
  canBuildPlant,
  canBuildTerminal,
  canBuildLine,
  canBuildCulture,
  cultureBlocker,
  cultureReadings,
  libraryCoverage,
  theatreCoverage,
  lineBlocker,
  missesDeadline,
  responseSeconds,
  responseThreshold,
  networkCapacity,
  networkReach,
  networkService,
  transitLineReadings,
  ascendBlocker,
  canAscend,
  cityHallBlocker,
  cityRank,
  crime,
  garbage,
  legacyGain,
  legacyMultiplier,
  nextRank,
  population,
  rankProgress,
  cityHallCost,
  cruiseIncome,
  demandLift,
  demandTargets,
  demandTerms,
  ZONE_KINDS,
  educationCoverage,
  estateBlocker,
  estateCapacity,
  estateCost,
  estateJobs,
  estatePlots,
  estateSupply,
  exportMarket,
  fareIncome,
  goodsTraded,
  highwayAllowed,
  highwayBlocker,
  highwayCost,
  homeBlocker,
  labourReach,
  homeCapacity,
  homeCost,
  canBuildLandmark,
  income,
  industryCapacity,
  landmarkBlocker,
  landmarkCoverage,
  landmarkReadings,
  industryCost,
  netIncome,
  parcelLandValue,
  faresWaived,
  parkBlocker,
  parkCapacity,
  plantBlocker,
  plantCapacity,
  plantCost,
  policyBlocker,
  powerCap,
  powerDemand,
  powerImported,
  powerRatio,
  powerSurplus,
  powerTradeCost,
  powerTradeIncome,
  powerTradeStep,
  rivalDemand,
  rivalStrength,
  levelAt,
  mergedOf,
  parkCost,
  plotsOf,
  promotionBlocker,
  taxStep,
  transitCoverage,
  workforceSkill,
  effectiveOf,
  estateEarning,
  congestion,
  transitShare,
  zoneOf,
  priceModifier,
  housingPlots,
  recreationCoverage,
  residents,
  serviceBlocker,
  serviceCost,
  happinessFix,
  serviceReadings,
  shopCapacity,
  shopCost,
  terminalBlocker,
  terminalReadings,
  tradeUpkeep,
  upkeep,
  visitors,
  visitorShare,
  visitorSources,
  willAutoAnnex,
} from '../sim/economy';
import { ESTATE_CELLS } from '../sim/estates';
import type { BuildingRef } from '../render/buildings';
import { ZONE_MODES, type ZoneMode } from '../render/zones';
import type { AwayReport } from '../sim/game';
import type { Command, GameFacade } from '../sim/commands';
import {
  createPlacement,
  districtOfPlot,
  housingCentrality,
  portDistrict,
  type CityLayout,
  networkedDistricts,
} from '../sim/layout';
import type { GameState, ZoneKind } from '../sim/state';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

export interface HudHooks {
  onReset: () => void;
  /**
   * Steps the map overlay to one mode, and reports what it settled on.
   *
   * The overlay is view state and stays in the view — nothing about it reaches
   * `GameState` — so the HUD asks rather than deciding. The return is what the
   * view actually chose, which is what the picker marks.
   */
  onZoneMode?: (mode: ZoneMode) => ZoneMode;
  /** What the view is showing now, so the picker opens marked correctly. */
  zoneMode?: () => ZoneMode;
  /**
   * Drops the camera to street level, or brings it back, and reports where it
   * ended up. Same contract as `onZoneMode`: the camera is view state and the
   * HUD asks rather than deciding.
   */
  onStreet?: () => boolean;
  /** Whether the camera is at street level, so the switch opens marked right. */
  street?: () => boolean;
  /**
   * Starts the camera tour, or stops it, and reports what it settled on. Same
   * contract again: the camera is view state and the HUD asks rather than
   * deciding.
   */
  onTour?: () => boolean;
  /** Whether the tour is running, so the switch opens marked correctly. */
  touring?: () => boolean;
  /** Dev-only time travel, wired to a button that only exists in dev builds. */
  onSkip?: (seconds: number) => void;
  /** Told when the card is dismissed, so the outline goes with it. */
  onDeselect?: () => void;
  /**
   * The display preferences, if this build has any.
   *
   * The store rather than a pair of hooks, and it is the one thing in here that
   * is not a hook, because it is not a request: the HUD reads the current value
   * to mark the controls and writes the new one, and `main.ts` is subscribed to
   * the same store and applies whatever comes out. Nothing about it touches the
   * game — the panel would render identically against a `Game` that had been
   * thrown away.
   *
   * Optional, exactly as `onZoneMode` is: without one the disclosure is hidden
   * rather than rendered empty.
   */
  settings?: SettingsStore;
}

/**
 * One row of the display panel.
 *
 * `choices` present means a radiogroup and absent means a switch, which is the
 * only structural difference between the four rows — everything else about them
 * is a name and a line of prose.
 */
interface SettingRow {
  readonly key: keyof Settings;
  readonly name: string;
  readonly choices?: readonly { readonly value: string; readonly label: string }[];
  /** What to say under the control, given what it is set to. Empty says nothing. */
  readonly note: (value: Settings[keyof Settings]) => string;
}

/** What each zone is called in the inspector, and what its capacity is called. */
const ZONE_LABEL: Record<ZoneKind, string> = {
  home: 'Residential',
  shop: 'Commercial',
  industry: 'Industrial',
};

/** The tabs the docked control is split into, in the order they are shown. */
const TAB_KEYS = [
  'build',
  'treasury',
  'demand',
  'taxes',
  'landmarks',
  'trade',
  'estates',
  'graphs',
  'awards',
] as const;
type TabKey = (typeof TAB_KEYS)[number];

/**
 * Seconds a ticker line stays on screen, in simulated time.
 *
 * Longer than EVENT_COALESCE_SECONDS on purpose: a promotion wave keeps merging
 * into its line for thirty seconds at a time, and a line that expired inside
 * that window would vanish and reappear with the count reset while the same wave
 * was still running. Forty-five leaves it standing until the run is genuinely
 * over.
 */
const TICKER_SECONDS = 45;

/**
 * Lines the ticker shows at once.
 *
 * Four, against a buffer of sixteen. The buffer is bounded so nothing can grow
 * without limit; this is bounded because a stack of notices tall enough to reach
 * the hint text is a wall rather than a ticker, and the newest four are the ones
 * worth reading.
 */
const TICKER_LINES = 4;

/**
 * Lines the away timeline shows before it says "and N more".
 *
 * Against a log bounded at AWAY_EVENT_BUFFER, so this is a rendering cap rather
 * than the bound: twelve is what a modal sheet holds without the button
 * scrolling off the bottom of a phone, and the list scrolls past that. Measured
 * on a twelve-hour absence of a mid-size auto-developing city, the log holds 24.
 */
const AWAY_TIMELINE_LINES = 12;

/**
 * Pixels a thumb has to travel on the sheet's handle before it is a drag.
 *
 * The same idea `cameraRig`'s CLICK_SLOP carries and the same reason: nobody
 * taps a phone without moving, so a control that treated any movement as a
 * drag would never register a tap at all.
 */
const SHEET_DRAG_SLOP = 8;

/** What the ticker calls each zone, in the plural a count reads well against. */
/** What the ticker calls each zone's land when the surveyor moves it. */
const ZONE_LAND: Record<ZoneKind, string> = {
  home: 'Housing',
  shop: 'Commercial',
  industry: 'Industrial',
};

const ZONE_PLURAL: Record<ZoneKind, string> = {
  home: 'homes',
  shop: 'shops',
  industry: 'works',
};

/**
 * The singular, for the lines that can carry a count of one.
 *
 * "1 shops became high street" was a wart the ticker could carry — four lines
 * that scroll past in forty-five seconds — and the away timeline cannot: it
 * shows a dozen at once on a modal sheet with the player's whole attention.
 * Works is the one that does not inflect, which is why this is a table rather
 * than a rule about trailing letters.
 */
const ZONE_SINGULAR: Record<ZoneKind, string> = {
  home: 'home',
  shop: 'shop',
  industry: 'works',
};

/** The right one of the two, for a count. */
const zonePlural = (zone: ZoneKind, count: number): string =>
  count === 1 ? ZONE_SINGULAR[zone] : ZONE_PLURAL[zone];

/** Below this a chip would say "-0%", which is noise rather than information. */
const CHIP_DEADBAND = 0.005;
/** Demand moves slowly; without a deadband the arrow flickers on rounding. */
const TREND_DEADBAND = 0.004;

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** A demand contribution, always signed — a term reading +0.00 is not the same
 *  statement as one reading -0.00, and an unsigned 0.10 says nothing at all. */
const signed = (n: number): string => `${n >= 0 ? '+' : '\u2212'}${Math.abs(n).toFixed(2)}`;

/** What the breakdown calls each zone. The bars above it are R / C / I. */
const ZONE_LIFT_NAMES: Record<ZoneKind, string> = {
  home: 'Residential',
  shop: 'Commercial',
  industry: 'Industrial',
};

/** The three series the Graphs tab draws. */
type GraphKey = 'population' | 'income' | 'happiness';

/**
 * What each series is called, how it is read out of a sample, and what shape its
 * y-axis is.
 *
 * Population and income are logarithmic and have to be: income spans 54/s at the
 * opening to 9.04e9/s at 49 districts of megastructures, so a linear axis over a
 * whole game would draw the first eight orders of magnitude as a flat line along
 * the bottom. Happiness is a share of one and is drawn against 0..1 fixed, so the
 * height of the line means the same thing on every chart rather than being
 * rescaled to whatever range the city happened to sit in.
 */
const GRAPH_SERIES: readonly {
  key: GraphKey;
  label: string;
  log: boolean;
  read: (sample: HistorySample) => number;
  format: (value: number) => string;
}[] = [
  {
    key: 'population',
    label: 'Residents',
    log: true,
    read: (sample) => sample.population,
    format: (value) => fmtInt(value),
  },
  {
    key: 'income',
    label: 'Income',
    log: true,
    read: (sample) => sample.income,
    format: (value) => `${fmt(value)}/s`,
  },
  {
    key: 'happiness',
    label: 'Happiness',
    log: false,
    read: (sample) => sample.happiness,
    format: (value) => pct(value),
  },
];

/** Padding at the top and bottom of a plot, in the 100-unit user space. */
const GRAPH_INSET = 6;

/**
 * One series as an SVG path, in a fixed 100 x 100 user space.
 *
 * The viewBox is stretched to whatever width the dock is, which is why the
 * stroke carries `vector-effect`. Time runs left to right with the oldest sample
 * at x = 0 and the newest at x = 100 whether the ring holds five samples or a
 * hundred and twenty: a chart that grew in from the left would redraw its whole
 * x-axis every minute for the first two hours.
 *
 * A log axis is taken over the *decades the data actually spans*, padded by one
 * so a flat series is a line through the middle rather than a line pinned to an
 * edge. Zero and anything negative are dropped to the floor of the range, which
 * is the honest reading: a city with no residents has no point on a log axis.
 *
 * The plot is inset by GRAPH_INSET at the top and bottom, because the stroke is
 * centred on the path and a series sitting at either extreme — happiness at 100%
 * is the everyday case — would otherwise be drawn half outside the box and come
 * out looking like a hairline.
 */
function graphPath(values: readonly number[], log: boolean): string {
  if (values.length === 0) return '';
  let lo: number;
  let hi: number;
  if (log) {
    const positive = values.filter((v) => v > 0);
    // Nothing to plot yet: one flat line along the bottom says "not yet" better
    // than an empty box does.
    lo = positive.length > 0 ? Math.log10(Math.min(...positive)) : 0;
    hi = positive.length > 0 ? Math.log10(Math.max(...positive)) : 0;
    if (hi - lo < 1) {
      const mid = (hi + lo) / 2;
      lo = mid - 0.5;
      hi = mid + 0.5;
    }
  } else {
    lo = 0;
    hi = 1;
  }
  const span = hi - lo || 1;
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  let d = '';
  for (let i = 0; i < values.length; i++) {
    const raw = values[i] ?? 0;
    const at = log ? (raw > 0 ? Math.log10(raw) : lo) : raw;
    const y = 100 - GRAPH_INSET - ((at - lo) / span) * (100 - GRAPH_INSET * 2);
    // Two decimal places is a tenth of a pixel at any width the dock reaches,
    // and it keeps the path string short enough to compare cheaply.
    d += `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)} ${Math.max(0, Math.min(100, y)).toFixed(2)}`;
  }
  return d;
}

/** The highest level anything in a cohort has reached. 0 for an empty city. */
function topLevel(levels: readonly number[]): number {
  for (let l = LEVELS - 1; l > 0; l--) if ((levels[l] ?? 0) > 0) return l;
  return 0;
}

/**
 * Education coverage the next promotion needs, or null once nothing is left to
 * unlock.
 *
 * The lowest cohort with anything in it is the one that would climb next — the
 * wave drains the bottom first — so its requirement is the number the player
 * can act on. A city whose every building is at the top has none.
 */
function nextLevelRequirement(s: Readonly<GameState>): number | null {
  for (let l = 0; l < LEVELS - 1; l++) {
    if ((s.homeLevels[l] ?? 0) > 0) return LEVEL_EDUCATION[l + 1] ?? 0;
  }
  return null;
}

/**
 * The HUD is a read-only subscriber, exactly like the renderer. It reads the
 * simulation and writes text nodes; it never caches game numbers of its own.
 */
export class Hud {
  private readonly nodes = {
    cash: el('cash'),
    rate: el('rate'),
    rank: el('rank'),
    ticker: el('ticker'),
    ledgerCash: el('ledger-cash'),
    ledgerGross: el('ledger-gross'),
    ledgerUpkeep: el('ledger-upkeep'),
    ledgerRate: el('ledger-rate'),
    earned: el('earned'),
    residents: el('residents'),
    plotsResidential: el('plots-r'),
    plotsCommercial: el('plots-c'),
    plotsIndustrial: el('plots-i'),
    plots: el('plots'),
    districts: el('districts'),
    happiness: el('happiness'),
    bonuses: el('bonuses'),
    bonusShop: el('bonus-shop'),
    bonusShopNote: el('bonus-shop-note'),
    bonusIndustry: el('bonus-industry'),
    bonusIndustryNote: el('bonus-industry-note'),
    bonusSkill: el('bonus-skill'),
    bonusSkillNote: el('bonus-skill-note'),
    bonusDistrict: el('bonus-district'),
    bonusDistrictNote: el('bonus-district-note'),
    mood: el('mood'),
    moodPct: el('mood-pct'),
    moodWhy: el('mood-why'),
    moodFill: el('mood-fill'),
    rci: el('rci'),
    demandRFill: el('demand-r-fill'),
    demandCFill: el('demand-c-fill'),
    demandIFill: el('demand-i-fill'),
    demandLift: el('demand-lift'),
    demandRNum: el('demand-r-num'),
    demandCNum: el('demand-c-num'),
    demandINum: el('demand-i-num'),
    services: el('services'),
    awardsList: el('awards-list'),
    graphs: el('graphs'),
    graphTiers: el('graph-tiers'),
    graphsNote: el('graphs-note'),
    overlays: el('overlays'),
    overlayNote: el('overlay-note'),
    streetView: el('street-view'),
    tour: el('tour'),
    tourNote: el('tour-note'),
    settings: el('settings'),
    settingsBody: el('settings-body'),
    corner: el('corner'),
    sheetGrip: el<HTMLButtonElement>('sheet-grip'),
    education: el('education'),
    educationReach: el('education-reach'),
    educationNext: el('education-next'),
    zoneName: el('zone-name'),
    zoneShop: el('zone-shop'),
    zoneIndustry: el('zone-industry'),
    occupancy: el('occupancy'),
    occupancyFill: el('occupancy-fill'),
    occupancyMark: el('occupancy-mark'),
    homeLabel: el('build-home-label'),
    homeCost: el('build-home-cost'),
    homeChip: el('build-home-chip'),
    homeTrend: el('build-home-trend'),
    shopCost: el('build-shop-cost'),
    shopChip: el('build-shop-chip'),
    shopTrend: el('build-shop-trend'),
    industryCost: el('build-industry-cost'),
    industryChip: el('build-industry-chip'),
    industryTrend: el('build-industry-trend'),
    park: el<HTMLButtonElement>('build-park'),
    parkCost: el('build-park-cost'),
    parkAllowance: el('build-park-built'),
    parksBuilt: el('svc-parks-built'),
    parksCovers: el('svc-parks-covers'),
    parksRow: el('svc-parks-built').parentElement as HTMLElement,
    annexLabel: el('annex-label'),
    annexCost: el('annex-cost'),
    home: el<HTMLButtonElement>('build-home'),
    shop: el<HTMLButtonElement>('build-shop'),
    industry: el<HTMLButtonElement>('build-industry'),
    annex: el<HTMLButtonElement>('annex'),
    auto: el<HTMLButtonElement>('auto'),
    reset: el<HTMLButtonElement>('reset'),
    ascend: el<HTMLButtonElement>('ascend'),
    ascendLabel: el('ascend-label'),
    ascendGain: el('ascend-gain'),
    welcome: el('welcome'),
    welcomeAway: el('welcome-away'),
    welcomeRows: el('welcome-rows'),
    welcomeTimeline: el('welcome-timeline'),
    welcomeMore: el('welcome-more'),
    welcomeTotals: el<HTMLDetailsElement>('welcome-totals'),
    welcomeClose: el<HTMLButtonElement>('welcome-close'),
    inspect: el('inspect'),
    inspectTitle: el('inspect-title'),
    inspectWhere: el('inspect-where'),
    inspectRows: el('inspect-rows'),
    inspectClose: el<HTMLButtonElement>('inspect-close'),
    taxSteps: el('tax-steps'),
    taxIncome: el('tax-income'),
    taxMood: el('tax-mood'),
    cityHall: el<HTMLButtonElement>('build-cityhall'),
    cityHallLabel: el('build-cityhall-label'),
    cityHallCost: el('build-cityhall-cost'),
    cityHallNote: el('cityhall-note'),
    freeTransport: el<HTMLButtonElement>('free-transport'),
    freeFares: el('free-fares'),
    freeEffect: el('free-effect'),
    plant: el<HTMLButtonElement>('build-plant'),
    plantCost: el('build-plant-cost'),
    plantAllowance: el('build-plant-built'),
    power: el('power'),
    powerBuilt: el('power-built'),
    powerRatio: el('power-ratio'),
    powerRow: el('power-built').parentElement as HTMLElement,
    powerDraw: el('power-draw'),
    powerEffect: el('power-effect'),
    transit: el('transit'),
    transitFares: el('transit-fares'),
    transitLabour: el('transit-labour'),
    transitCongestion: el('transit-congestion'),
    crimeRate: el('crime-rate'),
    crimeMood: el('crime-mood'),
    callResponse: el('call-response'),
    callOutcome: el('call-outcome'),
    fireResponse: el('fire-response'),
    fireOutcome: el('fire-outcome'),
    garbageRate: el('garbage-rate'),
    garbageMood: el('garbage-mood'),
    culture: el('culture'),
    cultureLibrary: el('culture-library'),
    cultureIdleness: el('culture-idleness'),
    cultureTheatre: el('culture-theatre'),
    cultureAudience: el('culture-audience'),
    network: el('network'),
    networkReach: el('network-reach'),
    networkWhere: el('network-where'),
    networkCapacity: el('network-capacity'),
    networkService: el('network-service'),
    networkFreight: el('network-freight'),
    networkArrivals: el('network-arrivals'),
    transitCongestionMood: el('transit-congestion-mood'),
    landmarkShare: el('landmark-share'),
    landmarkMood: el('landmark-mood'),
    portBerths: el('port-berths'),
    portWhere: el('port-where'),
    portVisitors: el('port-visitors'),
    portSpend: el('port-spend'),
    portExports: el('port-exports'),
    portSources: el('port-sources'),
    portShopping: el('port-shopping'),
    portLift: el('port-lift'),
    rivalStrength: el('rival-strength'),
    rivalCost: el('rival-cost'),
    powerSteps: el('power-steps'),
    powerTradeFlow: el('power-trade-flow'),
    powerTradeWorth: el('power-trade-worth'),
    goodsTrade: el<HTMLButtonElement>('goods-trade'),
    goodsFee: el('goods-fee'),
    goodsEffect: el('goods-effect'),
    airport: el<HTMLButtonElement>('build-airport'),
    airportLabel: el('build-airport-label'),
    airportCost: el('build-airport-cost'),
    highway: el<HTMLButtonElement>('build-highway'),
    highwayLabel: el('build-highway-label'),
    highwayCost: el('build-highway-cost'),
    estate: el<HTMLButtonElement>('build-estate'),
    estateLabel: el('build-estate-label'),
    estateCost: el('build-estate-cost'),
    estateBuilt: el('estate-built'),
    estateRoom: el('estate-room'),
    estatePlots: el('estate-plots'),
    estateJobs: el('estate-jobs'),
    estateLedger: el('estate-ledger'),
    estateSupply: el('estate-supply'),
  };

  /**
   * One row of controls and readouts per landmark type, keyed the same way the
   * service rows are. Two types, two sizes, one shape.
   */
  private readonly landmarkNodes = LANDMARKS.map((landmark) => ({
    landmark,
    button: el<HTMLButtonElement>(`build-${landmark.key}`),
    cost: el(`build-${landmark.key}-cost`),
    allowance: el(`build-${landmark.key}-built`),
    built: el(`svc-${landmark.key}-built`),
    covers: el(`svc-${landmark.key}-covers`),
  }));

  /**
   * The four tabs, and which panel each shows.
   *
   * Real buttons with `role="tab"` and `aria-selected`, a roving tabindex, and
   * arrow keys across the row: a tab strip built out of divs is a tab strip
   * nobody can reach without a mouse.
   */
  /**
   * One row of controls and readouts per terminal, keyed the same way the
   * landmark rows are. Two kinds, one shape, and the same land gate on both.
   */
  private readonly terminalNodes = TERMINALS.map((terminal) => ({
    terminal,
    button: el<HTMLButtonElement>(`build-${terminal.key}`),
    cost: el(`build-${terminal.key}-cost`),
    allowance: el(`build-${terminal.key}-built`),
  }));

  /**
   * One row per rung of the network, in the same shape as the two above.
   *
   * In the Services tab rather than in Trade, because the thing a line is a
   * rung *above* — the depot — lives there, and a player looking for what to do
   * about their traffic should find both in one place.
   */
  /** One row per culture type, in the same shape as the landmark rows. */
  private readonly cultureNodes = CULTURE.map((culture) => ({
    culture,
    button: el<HTMLButtonElement>(`build-${culture.key}`),
    cost: el(`build-${culture.key}-cost`),
    allowance: el(`build-${culture.key}-built`),
  }));

  private readonly lineNodes = TRANSIT_LINES.map((line) => ({
    line,
    button: el<HTMLButtonElement>(`build-${line.key}`),
    cost: el(`build-${line.key}-cost`),
    allowance: el(`build-${line.key}-built`),
  }));

  private readonly tabs = TAB_KEYS.map((key) => ({
    key,
    button: el<HTMLButtonElement>(`tab-${key}`),
    panel: el(`panel-${key}`),
  }));

  /**
   * Which tab is open. The one number that decides how much `paint` does.
   *
   * `paint` runs ten times a second and used to touch every node in the HUD.
   * With four tabs that would be four times the DOM writes for one tab's worth
   * of information, so the panels are painted one at a time — a hidden node is
   * not information, it is a write nobody can read.
   */
  private open: TabKey = 'build';
  /** One control per TAX_STEPS entry, built once. */
  private readonly taxButtons: HTMLButtonElement[] = [];
  /** The same, per POWER_TRADES entry. Two tables, one idiom. */
  private readonly powerButtons: HTMLButtonElement[] = [];

  /**
   * The building the card is showing, or null.
   *
   * A reference, never a copy: the numbers are re-read from the simulation on
   * every paint, so a building that climbs a level or merges while its card is
   * open updates in place rather than going stale. It is view state and never
   * reaches the save.
   */
  private selected: BuildingRef | null = null;
  /** Reused by the card, which asks the layout where its building stands. */
  private readonly at = createPlacement();
  /**
   * What the card last said, as one string.
   *
   * `paint` runs at 10Hz and the card is a `replaceChildren` of eight rows;
   * doing that when nothing has changed is eighty DOM nodes a second thrown
   * away for no new information. Comparing the rendered text first costs one
   * string compare.
   */
  private cardShown = '';

  /**
   * One row of controls and readouts per service, keyed the same way.
   *
   * All five, including the two that gate levelling rather than happiness: they
   * have the same shape — a count, an allowance, a price, a coverage — so they
   * get the same row. Which panel a row is *painted into* is decided by the
   * service's weight, below.
   */
  private readonly serviceNodes = SERVICES.map((service) => ({
    service,
    button: el<HTMLButtonElement>(`build-${service.key}`),
    cost: el(`build-${service.key}-cost`),
    /** `built / allowed` on the button itself, so the gate is visible. */
    allowance: el(`build-${service.key}-built`),
    row: el(`svc-${service.key}-built`).parentElement as HTMLElement,
    built: el(`svc-${service.key}-built`),
    covers: el(`svc-${service.key}-covers`),
  }));

  private since = 0;

  /**
   * The ticker's own log, and the reason there are two.
   *
   * The simulation's log is drained every paint, so by the time the second
   * building of a wave climbs the first has already been taken out of it and
   * there is nothing to merge into. Coalescing therefore has to happen on this
   * side of the handover as well — same class, same merge rule, and this one is
   * never drained. See `EventLog`.
   */
  private readonly ticker = new EventLog();
  /** What the ticker last rendered, so an unchanged live region is left alone. */
  private tickerShown = '';
  /** What the demand breakdown was last built for. See `paintLift`. */
  private liftShown = '';
  /**
   * One row per achievement, built once and then only written to.
   *
   * The table is static, so the *markup* is static: what a paint changes is a
   * class and one time string. Rebuilding twenty-odd rows from scratch on every
   * paint would be the same DOM churn the card and the ticker are both arranged
   * to avoid.
   */
  private readonly awardRows = new Map<string, { row: HTMLElement; at: HTMLElement }>();
  /**
   * The last node in each group's run, so a row that appears later lands in the
   * right section.
   *
   * The markup is one flat list of headings and rows rather than a container
   * per group, and it stays that way — the sections are a `margin-top` on the
   * heading, and wrapping them would change the layout to buy nothing. So the
   * one thing an insert needs is where its section currently ends, which is
   * this. Updated on every insert, so two secrets found in the same group keep
   * their table order.
   *
   * Only hidden rows ever use it: everything else is in the list from the
   * first paint. See `buildAwards`.
   */
  private readonly awardGroupTail = new Map<AchievementGroup, HTMLElement>();
  /** What the awards list last rendered, so an unchanged panel is left alone. */
  private awardsShown = '';
  /** What the awards tab label last said. Painted on every tick — see `paint`. */
  private awardsTabShown = '';
  /** One chip per overlay mode, built once. See `buildOverlays`. */
  private readonly overlayButtons = new Map<ZoneMode, HTMLButtonElement>();
  /** Every control on the display panel, with the row and value it stands for. */
  private readonly settingButtons: Array<{
    row: SettingRow;
    button: HTMLButtonElement;
    /** The choice this button selects, or null for a switch. */
    value: string | null;
  }> = [];
  /** The line under each setting, so it can be repainted when the value moves. */
  private readonly settingNotes = new Map<keyof Settings, HTMLElement>();
  /** The mode the picker is marking, so the note can be repainted live. */
  private overlayShown: ZoneMode = 'off';
  /** What the tour note last said, so an unchanged one is left alone. */
  private tourNoteShown = '';
  /** What that note last said, so an unchanged one is left alone. */
  private overlayNoteShown = '';
  /** What the rank strip last said, so a repaint a frame is a string compare. */
  private rankShown = '';
  /**
   * Which tier the chart is showing. View state, and it stays in the view: the
   * ring the simulation keeps is the same whichever span is on screen.
   */
  private graphTier: HistoryTierKey = 'fine';
  /** One block per series, built once. Same reasoning as `awardRows`. */
  private readonly graphRows = new Map<
    GraphKey,
    { block: HTMLElement; now: HTMLElement; path: SVGPathElement }
  >();
  /** What the chart last drew, so an unchanged panel is left alone. */
  private graphsShown = '';

  constructor(
    private readonly game: GameFacade,
    private readonly layout: CityLayout,
    private readonly hooks: HudHooks,
  ) {
    const n = this.nodes;
    n.home.addEventListener('click', () => this.act({ kind: 'home' }, n.home));
    n.shop.addEventListener('click', () => this.act({ kind: 'shop' }, n.shop));
    n.industry.addEventListener('click', () => this.act({ kind: 'industry' }, n.industry));
    n.park.addEventListener('click', () => this.act({ kind: 'park' }, n.park));
    n.plant.addEventListener('click', () => this.act({ kind: 'plant' }, n.plant));
    for (const row of this.landmarkNodes) {
      row.button.addEventListener('click', () =>
        this.act({ kind: 'landmark', key: row.landmark.key }, row.button),
      );
    }
    for (const row of this.terminalNodes) {
      row.button.addEventListener('click', () =>
        this.act({ kind: 'terminal', key: row.terminal.key }, row.button),
      );
    }
    for (const row of this.lineNodes) {
      row.button.addEventListener('click', () =>
        this.act({ kind: 'line', key: row.line.key }, row.button),
      );
    }
    for (const row of this.cultureNodes) {
      row.button.addEventListener('click', () =>
        this.act({ kind: 'culture', key: row.culture.key }, row.button),
      );
    }
    n.airport.addEventListener('click', () => this.act({ kind: 'airport' }, n.airport));
    n.highway.addEventListener('click', () => this.act({ kind: 'highway' }, n.highway));
    n.estate.addEventListener('click', () => this.act({ kind: 'estate' }, n.estate));
    n.annex.addEventListener('click', () => this.act({ kind: 'annex' }, n.annex));

    for (const { service, button } of this.serviceNodes) {
      button.addEventListener('click', () =>
        this.act({ kind: 'service', key: service.key }, button),
      );
    }

    n.cityHall.addEventListener('click', () => this.act({ kind: 'cityHall' }, n.cityHall));

    n.freeTransport.addEventListener('click', () => {
      this.act({ kind: 'freeTransport', on: !this.game.state.freeTransport });
    });

    n.auto.addEventListener('click', () => {
      this.act({ kind: 'autoDevelop', on: !this.game.state.autoDevelop });
    });

    n.reset.addEventListener('click', () => {
      if (!confirm('Clear the city and start over? This cannot be undone.')) return;
      this.act({ kind: 'reset' });
      // The ticker is the one part of the HUD that holds anything across a
      // paint, so it is the one part a reset has to be told about.
      this.ticker.clear();
      this.tickerShown = '';
      this.hooks.onReset();
      this.paint();
    });

    n.ascend.addEventListener('click', () => {
      const s = this.game.state;
      if (!canAscend(s)) return;
      const gain = legacyGain(s);
      const after = legacyMultiplier({ ...s, legacy: s.legacy + gain });
      if (
        !confirm(
          `Give up ${fmtInt(s.districts)} district${s.districts === 1 ? '' : 's'} and found the ` +
            `city again on the same land?\n\nEverything goes: the buildings, the treasury, ` +
            `the awards and the charts. What comes back is a permanent ` +
            `${after.toFixed(2)}x on everything the next city earns.`,
        )
      ) {
        return;
      }
      this.act({ kind: 'ascend' });
      // The ticker is the one part of the HUD that holds anything across a
      // paint, so it is the one part a founding has to be told about — same as
      // a reset, because underneath it is one.
      this.ticker.clear();
      this.tickerShown = '';
      this.hooks.onReset();
      this.paint();
    });

    n.welcomeClose.addEventListener('click', () => {
      n.welcome.hidden = true;
    });

    n.inspectClose.addEventListener('click', () => {
      this.hooks.onDeselect?.();
      this.inspect(null);
    });

    for (const tab of this.tabs) {
      tab.button.addEventListener('click', () => this.show(tab.key));
      tab.button.addEventListener('keydown', (event) => this.onTabKey(event, tab.key));
    }

    // The tax control, built once from TAX_STEPS rather than typed into the
    // markup: the steps are balance, and balance lives in config.ts.
    for (let i = 0; i < TAX_STEPS.length; i++) {
      const step = TAX_STEPS[i] as (typeof TAX_STEPS)[number];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step';
      button.setAttribute('role', 'radio');
      button.textContent = step.label;
      button.addEventListener('click', () => this.act({ kind: 'taxRate', step: i }));
      this.taxButtons.push(button);
      n.taxSteps.append(button);
    }

    // And the power agreement, from POWER_TRADES for the same reason. Off,
    // import, export: one index in the save, so one radio group here.
    for (let i = 0; i < POWER_TRADES.length; i++) {
      const trade = POWER_TRADES[i] as PowerTrade;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step';
      button.setAttribute('role', 'radio');
      button.textContent = trade.label;
      button.addEventListener('click', () => this.act({ kind: 'powerTrade', step: i }));
      this.powerButtons.push(button);
      n.powerSteps.append(button);
    }

    n.goodsTrade.addEventListener('click', () => {
      this.act({ kind: 'goodsTrade', on: !this.game.state.goodsTrade });
    });

    this.wireSheet();
    this.buildOverlays();
    this.buildStreetView();
    this.buildTour();
    this.buildSettings();
    this.buildGraphs();
    this.buildAwards();

    n.occupancyMark.style.left = `${ANNEX_MIN_OCCUPANCY * 100}%`;

    if (import.meta.env.DEV && this.hooks.onSkip) {
      const skip = document.createElement('button');
      skip.className = 'ghost';
      skip.type = 'button';
      skip.textContent = 'Skip 8h (dev)';
      skip.addEventListener('click', () => this.hooks.onSkip?.(8 * 3600));
      n.auto.parentElement?.append(skip);
    }

    this.paint();
  }

  /**
   * Sends one command, and acknowledges the click at once.
   *
   * The whole of the answer to a simulation that is a message away. `send` is
   * fire-and-forget — the worker applies the command and the next state reply
   * carries the result, which is at most one tick behind — so without this a
   * button would sit there for up to a tenth of a second having visibly done
   * nothing, which is exactly how a broken button feels.
   *
   * What it does *not* do is guess. There is no optimistic mutation of the
   * state: a second write path on this side would be a second implementation of
   * `Game.buildHome`, and the two would drift the first time a cost curve
   * moved. The acknowledgement is a class on the button and nothing more, and
   * the numbers change when the simulation says they changed.
   *
   * So what happens when the worker refuses a purchase the player just clicked?
   * Nothing visible. The button flashes, no state arrives that spent the money,
   * and the panel goes on saying what it said — which is precisely what the
   * game already did when a click landed on a button the last paint had
   * disabled. The refusal has never been reported and does not start being.
   */
  private act(command: Command, button?: HTMLElement): void {
    this.game.send(command);
    if (!button) return;
    // Restarted rather than added: a second click inside the animation would
    // otherwise do nothing at all, which is the failure this exists to fix.
    button.classList.remove('acted');
    void button.offsetWidth;
    button.classList.add('acted');
  }

  /** Opens one tab. Nothing about the data moves; only which nodes are visible. */
  show(key: TabKey): void {
    this.open = key;
    for (const tab of this.tabs) {
      const on = tab.key === key;
      tab.button.setAttribute('aria-selected', String(on));
      // A roving tabindex, so the strip is one stop rather than four.
      tab.button.tabIndex = on ? 0 : -1;
      tab.panel.hidden = !on;
    }
    this.paint();
  }

  /** Left and right walk the strip; Home and End jump to its ends. */
  private onTabKey(event: KeyboardEvent, key: TabKey): void {
    const at = TAB_KEYS.indexOf(key);
    let next = -1;
    if (event.key === 'ArrowRight') next = (at + 1) % TAB_KEYS.length;
    else if (event.key === 'ArrowLeft') next = (at + TAB_KEYS.length - 1) % TAB_KEYS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TAB_KEYS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const target = TAB_KEYS[next] as TabKey;
    this.show(target);
    this.tabs.find((tab) => tab.key === target)?.button.focus();
  }

  /** Throttled from the frame loop; the ledger does not need 144 updates a second. */
  tick(dt: number): void {
    this.since += dt;
    if (this.since < 0.1) return;
    this.since = 0;
    this.paint();
  }

  /**
   * The price chip: what demand did to this button, as a signed percentage.
   *
   * This is the number the whole demand model exists to show — a player who
   * cannot see the discount has no way to tell a lagging signal from a broken
   * one. Nothing is drawn at the balance point, so a neutral city reads quiet.
   */
  private paintChip(chip: HTMLElement, demand: number): void {
    const delta = priceModifier(demand) - 1;
    const discount = delta < 0;
    chip.classList.toggle('discount', discount && Math.abs(delta) >= CHIP_DEADBAND);
    chip.classList.toggle('surcharge', !discount && Math.abs(delta) >= CHIP_DEADBAND);
    if (Math.abs(delta) < CHIP_DEADBAND) {
      chip.textContent = '';
      return;
    }
    // A minus sign, not a hyphen: this sits next to a price and has to read as
    // arithmetic rather than as a dash.
    chip.textContent = `${discount ? '−' : '+'}${Math.round(Math.abs(delta) * 100)}%`;
  }

  /**
   * Which way the signal is still moving, from the sign of `target - current`.
   *
   * More actionable than the level: a discount that is still deepening is worth
   * waiting on, and one that has turned is worth spending into now.
   */
  private paintTrend(arrow: HTMLElement, current: number, target: number): void {
    const gap = target - current;
    arrow.textContent =
      Math.abs(gap) < TREND_DEADBAND ? '' : gap > 0 ? '▲' : '▼';
  }

  private paintBar(fill: HTMLElement, demand: number): void {
    const half = Math.min(1, Math.abs(demand)) * 50;
    fill.style.left = demand >= 0 ? '50%' : `${50 - half}%`;
    fill.style.width = `${half}%`;
    fill.classList.toggle('short', demand < 0);
  }

  /**
   * The whole HUD, ten times a second.
   *
   * Two always-on numbers, the open tab, and the card. Everything else is
   * behind a `hidden` panel, and a write to a hidden node is a write nobody can
   * read — with four tabs, painting them all would be four times the DOM
   * traffic for one tab's worth of information.
   */
  paint(): void {
    const s = this.game.state;
    const n = this.nodes;

    n.cash.textContent = fmt(s.cash);
    // Net, not gross. The dock's one rate is what the treasury is actually
    // gaining, so a city whose wage bill has passed its rent reads as falling
    // rather than as earning — see `netIncome`. What the buildings *earn* is a
    // separate row in the Treasury tab, where the difference is the point.
    n.rate.textContent = `${fmt(netIncome(s))}/s`;
    this.paintRank(s);

    this.paintTicker(s);

    if (this.open === 'build') this.paintBuild(s);
    else if (this.open === 'treasury') this.paintTreasury(s);
    else if (this.open === 'demand') this.paintDemand(s);
    else if (this.open === 'taxes') this.paintTaxes(s);
    else if (this.open === 'landmarks') this.paintLandmarks(s);
    else if (this.open === 'trade') this.paintTrade(s);
    else if (this.open === 'estates') this.paintEstates(s);
    else if (this.open === 'graphs') this.paintGraphs(s);
    else this.paintAwards(s);

    // The one label painted whatever tab is open, because the count is the
    // reason to open the tab at all. Cheap: one integer compare and, on the
    // handful of ticks it changes, one string write.
    this.paintAwardsTab(s);
    // The traffic overlay's number, which the map cannot carry — see
    // `paintOverlayNote`. Cheap and guarded, like the tab label above it.
    if (this.overlayShown !== 'off') this.paintOverlayNote();

    this.paintCard(s);
  }

  /**
   * One ticker line, in words.
   *
   * The wording lives here rather than in `core/events.ts` for the reason every
   * label in this file does: an event is data about what the city did, and what
   * to call it is a decision about the HUD. `core/` imports nothing and would
   * have to be handed LEVEL names and service names to say any of this.
   *
   * The tone is what a `tick` class picks up: `bad` for something lost, `warn`
   * for something stuck, `good` for something earned, and nothing for the rest.
   */
  private tickLine(event: GameEvent): { text: string; tone: string } {
    const many = (n: number): string => fmtInt(n);
    switch (event.kind) {
      case 'fire-started':
        return {
          text: event.count > 1
            ? `${many(event.count)} fires in the ${ZONE_LABEL[event.zone].toLowerCase()} zone`
            : `Fire in the ${ZONE_LABEL[event.zone].toLowerCase()} zone`,
          tone: 'warn',
        };
      case 'fire-out':
        return {
          text: event.count > 1 ? `${many(event.count)} fires put out` : 'Fire put out',
          tone: 'good',
        };
      case 'fire-lost':
        return {
          text: `${many(event.count)} ${zonePlural(event.zone, event.count)} lost to fire`,
          tone: 'bad',
        };
      case 'call-missed':
        // Nothing is lost, so this is the one `bad` line in the log that names
        // no casualty. What it costs is on the crime bar — see UNANSWERED_CRIME.
        return {
          text: event.count > 1
            ? `${many(event.count)} calls in the ${ZONE_LABEL[event.zone].toLowerCase()} zone went unanswered`
            : `A call in the ${ZONE_LABEL[event.zone].toLowerCase()} zone went unanswered`,
          tone: 'bad',
        };
      case 'blocked':
        // The blocker string itself, because it is already the sentence every
        // other disabled control in this HUD says. Two wordings for one state
        // would be two things for a player to reconcile.
        return { text: `Housing stalled — ${event.reason.toLowerCase()}`, tone: 'warn' };
      case 'level-up': {
        const names = ZONE_LEVEL_NAMES[event.zone];
        const to = names[event.level] ?? `level ${event.level + 1}`;
        // The merge rung counts what results rather than what was consumed —
        // two buildings go onto one parcel and one comes back — so it says
        // "pairs" and every other rung does not. The alternative was a count
        // that meant a different thing at one rung than at the others.
        const from =
          event.level === MERGE_LEVEL
            ? `${event.count === 1 ? 'pair' : 'pairs'} of ${ZONE_PLURAL[event.zone]}`
            : zonePlural(event.zone, event.count);
        return { text: `${many(event.count)} ${from} became ${to}`, tone: 'good' };
      }
      case 'abandoned':
        return {
          text: `${many(event.count)} ${zonePlural(event.zone, event.count)} boarded up`,
          tone: 'bad',
        };
      case 'recovered':
        return {
          text: `${many(event.count)} ${zonePlural(event.zone, event.count)} reopened`,
          tone: 'good',
        };
      case 'annexed':
        return { text: `District ${many(event.districts)} annexed`, tone: 'good' };
      case 'surveyed':
        return {
          // What the zone holds now, not what was added: "commercial land now 31
          // plots" is something a player can act on, and "one parcel surveyed"
          // is trivia. The zone name carries which map colour just grew.
          text: `${ZONE_LAND[event.zone]} land now ${fmtInt(event.plots)} plots`,
          tone: 'good',
        };
      case 'brownout':
        return {
          text: `Power short — occupancy capped at ${pct(event.cap)}`,
          tone: 'bad',
        };
      case 'coverage': {
        const service = SERVICES.find((entry) => entry.key === event.service);
        return {
          text: `${service?.coverLabel ?? 'Coverage'} fell to ${pct(event.coverage)}`,
          tone: 'warn',
        };
      }
      case 'unlocked':
        // The name and nothing else. An achievement grants nothing, so there is
        // no consequence to report — the line is the whole of it.
        return { text: `Unlocked — ${event.name}`, tone: 'good' };
    }
  }

  /**
   * The bottom sheet's handle: tap to toggle, drag to the same end.
   *
   * The one place this feature reaches `hud.ts` at all, and it is here because
   * a sheet you can only *tap* open is a sheet that fights the gesture every
   * phone has trained its owner to make. Everything else about the small-screen
   * layout is CSS.
   *
   * A real `<button>` underneath, so the same control works by keyboard and to
   * a screen reader, and `aria-expanded` says which way it is. The drag is
   * pointer events on top of that rather than instead of it: a short drag is a
   * tap and the button handles it, and a long one settles by direction.
   */
  private wireSheet(): void {
    const grip = this.nodes.sheetGrip;
    const corner = this.nodes.corner;
    let from = 0;
    let dragging = false;

    const set = (collapsed: boolean): void => {
      corner.classList.toggle('collapsed', collapsed);
      grip.setAttribute('aria-expanded', String(!collapsed));
    };

    grip.addEventListener('click', () => {
      // Suppressed after a drag that actually went somewhere, or the pointer's
      // own click would undo what the drag just did.
      if (dragging) return;
      set(!corner.classList.contains('collapsed'));
    });

    grip.addEventListener('pointerdown', (event) => {
      from = event.clientY;
      dragging = false;
      grip.setPointerCapture(event.pointerId);
    });

    grip.addEventListener('pointermove', (event) => {
      if (!grip.hasPointerCapture(event.pointerId)) return;
      const moved = event.clientY - from;
      // A threshold, because a thumb never moves zero: under it this is still a
      // tap and the click handler owns it.
      if (Math.abs(moved) < SHEET_DRAG_SLOP) return;
      dragging = true;
      // Down collapses, up expands — the direction the sheet itself moves.
      set(moved > 0);
    });

    const done = (event: PointerEvent): void => {
      if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
      // Cleared on the next frame rather than now: the click event that follows
      // a pointerup has to see the flag the drag set.
      requestAnimationFrame(() => {
        dragging = false;
      });
    };
    grip.addEventListener('pointerup', done);
    grip.addEventListener('pointercancel', done);
  }

  /**
   * Builds the overlay picker once, and keeps it marked.
   *
   * Rendered whether or not the view wired the hooks, because the markup is in
   * `index.html` either way and an empty row of chips would be worse than none:
   * with no hook the picker simply is not built.
   */
  private buildOverlays(): void {
    if (!this.hooks.onZoneMode) return;
    for (const mode of ZONE_MODES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'overlay';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', 'false');
      button.title = mode.note;
      button.textContent = mode.label;
      button.addEventListener('click', () => {
        this.markOverlay(this.hooks.onZoneMode?.(mode.key) ?? mode.key);
      });
      this.overlayButtons.set(mode.key, button);
      this.nodes.overlays.append(button);
    }
    this.markOverlay(this.hooks.zoneMode?.() ?? 'off');
  }

  /**
   * Wires the street-level switch, if the view offered one.
   *
   * A switch rather than a chip in the radio group above it: the overlays are
   * one-of-seven and this is on-or-off, and a screen reader told otherwise
   * would announce it as one of eight overlays.
   */
  private buildStreetView(): void {
    const button = this.nodes.streetView;
    if (!this.hooks.onStreet) {
      button.hidden = true;
      return;
    }
    button.addEventListener('click', () => this.markStreet(this.hooks.onStreet?.() ?? false));
    this.markStreet(this.hooks.street?.() ?? false);
  }

  /**
   * The display settings, as a table.
   *
   * A table rather than four hand-written blocks, because the four rows differ
   * only in what they choose between and what they are called — and writing
   * that out four times is how a panel ends up with three chips that mark
   * themselves and one that does not. Each row is either a set of choices (a
   * radiogroup) or a switch, and that distinction is real rather than
   * cosmetic: a screen reader told that "Fog" is one of two overlays would be
   * told something false.
   *
   * The order is what a player reaches for in anger. Shadows first because it
   * is the one with real frame time behind it, fog second because it is the
   * most visible change, motion third because most people who want it have
   * already set it at the OS level, and the frame-rate readout last because it
   * is an instrument rather than a preference.
   */
  private settingRows(): readonly SettingRow[] {
    const shadow = (key: ShadowQuality, label: string) => ({ value: key, label });
    const motion = (key: MotionSetting, label: string) => ({ value: key, label });
    return [
      {
        key: 'shadows',
        name: 'Shadows',
        choices: [shadow('high', 'High'), shadow('low', 'Low'), shadow('off', 'Off')],
        note: (value) =>
          value === 'off'
            ? 'No shadow pass at all. The cheapest thing on this panel.'
            : value === 'low'
              ? 'A quarter of the texels and a cheaper filter.'
              : 'A soft 2048px map. What the game has always drawn.',
      },
      {
        key: 'fog',
        name: 'Haze',
        note: (value) =>
          value ? '' : 'The grassland now ends at a line rather than fading into one.',
      },
      {
        key: 'motion',
        name: 'Motion',
        choices: [motion('system', 'System'), motion('full', 'Full'), motion('reduced', 'Reduced')],
        note: (value) =>
          value === 'system'
            ? `Following your machine, which currently asks for ${
                systemPrefersReducedMotion() ? 'reduced' : 'full'
              } motion.`
            : value === 'reduced'
              ? 'Traffic held still, the sun held at midday, buildings arriving without ceremony.'
              : 'Traffic, the day/night cycle and the arrival animations, whatever your machine asks for.',
      },
      {
        key: 'fps',
        name: 'Frame rate',
        note: () => '',
      },
    ];
  }

  /**
   * Builds the display panel once, and keeps it marked.
   *
   * Hidden rather than rendered empty when no store was handed in, which is the
   * rule `buildStreetView` already follows: the markup is in `index.html`
   * either way and an empty disclosure is worse than none.
   */
  private buildSettings(): void {
    const store = this.hooks.settings;
    if (!store) {
      this.nodes.settings.hidden = true;
      return;
    }
    for (const row of this.settingRows()) {
      const block = document.createElement('div');
      block.className = 'setting';
      const name = document.createElement('p');
      name.className = 'setting-name';
      name.textContent = row.name;
      const controls = document.createElement('div');
      controls.className = 'setting-row';
      const note = document.createElement('p');
      note.className = 'setting-note';
      block.append(name, controls, note);

      if (row.choices) {
        controls.setAttribute('role', 'radiogroup');
        controls.setAttribute('aria-label', row.name);
        for (const choice of row.choices) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'overlay';
          button.setAttribute('role', 'radio');
          button.textContent = choice.label;
          button.addEventListener('click', () => {
            store.set(row.key, choice.value as Settings[typeof row.key]);
            this.markSettings();
          });
          controls.append(button);
          this.settingButtons.push({ row, button, value: choice.value });
        }
      } else {
        // A switch, and it says so. The overlays above are one-of-seven and
        // these are on-or-off; a screen reader told otherwise would announce a
        // fog toggle as an eighth map overlay.
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'overlay';
        button.addEventListener('click', () => {
          store.set(row.key, !store.value[row.key] as Settings[typeof row.key]);
          this.markSettings();
        });
        controls.append(button);
        this.settingButtons.push({ row, button, value: null });
      }
      this.settingNotes.set(row.key, note);
      this.nodes.settingsBody.append(block);
    }
    this.markSettings();
  }

  /**
   * Marks every control against what the store currently holds.
   *
   * Read back from the store rather than from what was clicked, so a value the
   * store refused — or one another surface changed — cannot leave the panel
   * saying something the renderer is not doing.
   */
  private markSettings(): void {
    const store = this.hooks.settings;
    if (!store) return;
    const settings = store.value;
    for (const { row, button, value } of this.settingButtons) {
      const current = settings[row.key];
      if (value === null) {
        button.setAttribute('aria-pressed', String(current === true));
        button.textContent = current === true ? 'On' : 'Off';
      } else {
        button.setAttribute('aria-checked', String(current === value));
      }
    }
    for (const row of this.settingRows()) {
      const note = this.settingNotes.get(row.key);
      if (note) note.textContent = row.note(settings[row.key]);
    }
  }

  /**
   * Marks whether the camera is at street level.
   *
   * Public for the reason `markOverlay` is: the V key belongs to the view, so
   * the view reports what it did and the switch follows rather than the two
   * disagreeing.
   */
  markStreet(street: boolean): void {
    this.nodes.streetView.setAttribute('aria-pressed', String(street));
  }

  /** Wires the tour switch, if the view offered one. Same shape as the street one. */
  private buildTour(): void {
    const button = this.nodes.tour;
    if (!this.hooks.onTour) {
      button.hidden = true;
      return;
    }
    button.addEventListener('click', () => this.markTour(this.hooks.onTour?.() ?? false));
    this.markTour(this.hooks.touring?.() ?? false);
  }

  /**
   * Marks whether the tour is running, and says where it has got to.
   *
   * Public for the reason `markStreet` is: the T key belongs to the view, and
   * so does *every other key* — any input ends the tour — so the view reports
   * what happened and the switch follows rather than the two disagreeing.
   */
  markTour(running: boolean, where?: string): void {
    this.nodes.tour.setAttribute('aria-pressed', String(running));
    // `where` left out means "the switch moved and nobody said where" — which
    // is the click handler, firing after the view has already announced the
    // first stop. Clearing the note there would wipe the name a moment after
    // writing it.
    const text = !running ? '' : (where ?? this.tourNoteShown);
    if (text === this.tourNoteShown) return;
    this.tourNoteShown = text;
    this.nodes.tourNote.textContent = text;
  }

  /**
   * The city's rank, and how far it is through the rung it is climbing.
   *
   * In the strip rather than in a tab, because the rank decides which buttons
   * in the Build tab exist: a player reading "Needs a town" on a disabled
   * button has to be able to find out what they are without going looking. The
   * name is the label and the detail is the title, which is the split the rest
   * of this HUD already uses for a blocker.
   */
  private paintRank(s: Readonly<GameState>): void {
    const rank = cityRank(s);
    const next = nextRank(s);
    const label = next === null ? rank.name : `${rank.name} · ${pct(rankProgress(s) ?? 0)}`;
    if (label === this.rankShown) return;
    this.rankShown = label;
    this.nodes.rank.textContent = label;
    this.nodes.rank.title =
      next === null
        ? `${rank.name} — the top of the ladder`
        : `${rank.name}. Next: ${next.name}, at ${fmtInt(next.districts)} district` +
          `${next.districts === 1 ? '' : 's'} and ${fmtInt(next.population)} people` +
          ` (${fmtInt(s.districts)} and ${fmtInt(population(s))} now)`;
  }

  /**
   * Marks the mode the view is showing.
   *
   * Public because the Z key belongs to the view, not to this panel: the view
   * cycles and tells the HUD what it landed on, so one control cannot get out
   * of step with the other.
   */
  markOverlay(mode: ZoneMode): void {
    for (const [key, button] of this.overlayButtons) {
      button.setAttribute('aria-checked', String(key === mode));
    }
    this.overlayShown = mode;
    this.paintOverlayNote();
  }

  /**
   * The note under the picker.
   *
   * Repainted every tick rather than only on a mode change, because the traffic
   * mode has to carry its *number*: congestion is a city-wide scalar, so the
   * map can only show that the streets are tinted and not how badly — the
   * reading itself has to be in words. Guarded on the string, like every other
   * live region in this file.
   */
  private paintOverlayNote(): void {
    const mode = this.overlayShown;
    const entry = ZONE_MODES.find((one) => one.key === mode);
    const text =
      mode === 'off' ? ''
      : mode === 'traffic'
        ? `${pct(congestion(this.game.state))} jammed. ${entry?.note ?? ''}`
        : (entry?.note ?? '');
    if (text === this.overlayNoteShown) return;
    this.overlayNoteShown = text;
    this.nodes.overlayNote.textContent = text;
  }

  /**
   * Builds the three charts and the span toggle once.
   *
   * SVG rather than a canvas, and no library at all: three polylines over a
   * hundred and twenty points is a `d` attribute, and a chart package would be a
   * dependency and a build step for something the DOM already draws. Only the
   * path and the current value are written on a paint.
   */
  private buildGraphs(): void {
    const n = this.nodes;
    for (const key of ['fine', 'coarse'] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(key === this.graphTier));
      button.textContent = HISTORY_TIER_LABELS[key];
      button.addEventListener('click', () => {
        this.graphTier = key;
        for (const other of n.graphTiers.children) {
          other.setAttribute('aria-checked', String(other === button));
        }
        // The panel is keyed on the tier, so the guard has to be cleared or the
        // toggle would change the label and leave the old span on screen.
        this.graphsShown = '';
        this.paint();
      });
      n.graphTiers.append(button);
    }

    for (const series of GRAPH_SERIES) {
      const block = document.createElement('div');
      block.className = `graph ${series.key === 'happiness' ? 'mood' : ''}`.trim();
      const head = document.createElement('div');
      head.className = 'graph-head';
      const label = document.createElement('span');
      label.className = 'k';
      label.textContent = series.label;
      const now = document.createElement('span');
      now.className = 'now';
      head.append(label, now);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      // The aspect ratio is deliberately not preserved: the plot is stretched to
      // the dock's width, which is what makes one x-axis span the panel at any
      // size. `vector-effect` on the stroke is what keeps that from thickening
      // the line — see the stylesheet.
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', `${series.label} over time`);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'line');
      svg.append(path);

      block.append(head, svg);
      this.nodes.graphs.append(block);
      this.graphRows.set(series.key, { block, now, path });
    }
  }

  /**
   * The graphs panel: three series over the span the toggle selects.
   *
   * Read out of the save's ring rather than out of a buffer the HUD keeps, which
   * is the whole point of the feature: a city that was away for six hours comes
   * back with six hours of chart rather than with an empty one. The current value
   * is the *live* reading rather than the last sample, because a sample can be a
   * minute old and the number next to a chart should agree with the dock.
   */
  private paintGraphs(s: Readonly<GameState>): void {
    const tier = tierOf(s, this.graphTier);
    const held = tierLength(tier);
    // Keyed on the tier and on how much of it is filled plus the head, which is
    // exactly what changes when a sample lands. Cheaper than decoding 120
    // samples ten times a second to find out nothing moved.
    const shown = `${this.graphTier}:${held}:${tier.head}:${Math.floor(s.elapsed)}`;
    if (shown === this.graphsShown) return;
    this.graphsShown = shown;

    const samples = readTier(tier);
    for (const series of GRAPH_SERIES) {
      const row = this.graphRows.get(series.key);
      if (!row) continue;
      row.path.setAttribute('d', graphPath(samples.map(series.read), series.log));
      row.block.classList.toggle('empty', samples.length === 0);
      row.now.textContent = series.format(
        series.key === 'population' ? residents(s)
        : series.key === 'income' ? income(s)
        : s.happiness,
      );
    }

    this.nodes.graphsNote.textContent =
      held === 0
        ? 'Nothing charted yet — the first point lands a minute in.'
        : held < HISTORY_SAMPLES
          ? `${held} of ${HISTORY_SAMPLES} points, oldest on the left.`
          : `The last ${HISTORY_TIER_LABELS[this.graphTier]}, oldest on the left.`;
  }

  /**
   * Builds the awards list once, grouped.
   *
   * Sectioned rather than flat because the groups are the only structure a list
   * of two dozen one-line facts has: "Land" and "Adversity" say what a row is
   * about before it is read, and a player looking for what to do next reads the
   * headings rather than every note.
   */
  private buildAwards(): void {
    const list = this.nodes.awardsList;
    const readings = visibleReadings(this.game.state);
    for (const group of ACHIEVEMENT_GROUPS) {
      const rows = readings.filter((reading) => reading.achievement.group === group.key);
      if (rows.length === 0) continue;
      const heading = document.createElement('p');
      heading.className = 'award-group';
      heading.textContent = group.name;
      list.append(heading);
      // The heading is the section's tail until a row lands under it, which is
      // the case that matters: a group whose only entries are secrets nobody
      // has found yet still has somewhere to put the first one.
      this.awardGroupTail.set(group.key, heading);
      for (const { achievement } of rows) {
        list.append(this.awardRow(achievement));
      }
    }
  }

  /**
   * One row's markup, and the record of where it went.
   *
   * Split out of `buildAwards` because a hidden row is built by the *paint*
   * rather than by the build — it does not exist in the list until the tick it
   * fires on. Everything about it is the same row every other award gets, which
   * is the point: once found, a secret is an ordinary award forever.
   */
  private awardRow(achievement: Achievement): HTMLElement {
    const row = document.createElement('div');
    row.className = 'award locked';
    const name = document.createElement('span');
    name.className = 'k';
    name.textContent = achievement.name;
    const at = document.createElement('span');
    at.className = 'at';
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = achievement.note;
    row.append(name, at, note);
    this.awardRows.set(achievement.key, { row, at });
    this.awardGroupTail.set(achievement.group, row);
    return row;
  }

  /**
   * The awards panel: what is unlocked, and when it fired.
   *
   * The time is `fmtDuration` against the `elapsed` the row was stamped with —
   * how long the city had been running when it happened, which is the only
   * clock the simulation has and the only one that means anything across a
   * twelve-hour absence. A locked row keeps its note, because the note is the
   * instruction and a greyed instruction is still an instruction.
   */
  private paintAwards(s: Readonly<GameState>): void {
    const readings = visibleReadings(s);
    // One string compare against a list of two dozen rows, for the reason the
    // card does it: the panel is static between unlocks and rewriting it ten
    // times a second is DOM traffic carrying no new information. A secret
    // firing changes the *length* of the list, which this catches for free.
    const shown = readings.map((reading) => `${reading.achievement.key}:${reading.at ?? ''}`).join('|');
    if (shown === this.awardsShown) return;
    this.awardsShown = shown;

    for (const { achievement, at } of readings) {
      let row = this.awardRows.get(achievement.key);
      if (!row) {
        // A secret, on the tick it was found. It has no markup yet — that is
        // what hiding it meant — so it is built now and inserted at the end of
        // its own section rather than at the end of the list.
        const node = this.awardRow(achievement);
        this.awardGroupTail.get(achievement.group)?.after(node);
        // `awardRow` moved the tail to this node, so a second secret in the
        // same group lands after this one and the section keeps table order.
        row = this.awardRows.get(achievement.key);
        if (!row) continue;
      }
      const locked = at === null;
      row.row.classList.toggle('locked', locked);
      row.at.textContent = locked ? '' : fmtDuration(at);
    }
  }

  /**
   * The count on the tab itself, which is the reason to open it.
   *
   * The denominator is this city's, not the table's — see
   * `achievementDenominator`. A secret moves both halves at once, so the label
   * never states how many are left to find.
   */
  private paintAwardsTab(s: Readonly<GameState>): void {
    const label = `Awards ${unlockedCount(s)}/${achievementDenominator(s)}`;
    if (label === this.awardsTabShown) return;
    this.awardsTabShown = label;
    const tab = this.tabs.find((entry) => entry.key === 'awards');
    if (tab) tab.button.textContent = label;
  }

  /**
   * The ticker, drained and rendered.
   *
   * Rewritten only when the words change, which matters more here than
   * elsewhere: this is a live region, so every mutation is something a screen
   * reader may read out. A `replaceChildren` on every paint would announce the
   * same four lines ten times a second.
   */
  private paintTicker(s: Readonly<GameState>): void {
    for (const event of this.game.drainEvents()) this.ticker.push(event);
    this.ticker.expire(s.elapsed - TICKER_SECONDS);

    const shown = this.ticker.entries.slice(-TICKER_LINES).map((event) => this.tickLine(event));
    const rendered = shown.map((line) => `${line.tone}|${line.text}`).join('\n');
    if (rendered === this.tickerShown) return;
    this.tickerShown = rendered;

    this.nodes.ticker.replaceChildren(
      ...shown.map((line) => {
        const node = document.createElement('p');
        node.className = line.tone ? `tick ${line.tone}` : 'tick';
        node.textContent = line.text;
        return node;
      }),
    );
  }

  private paintTreasury(s: Readonly<GameState>): void {
    const n = this.nodes;
    n.ledgerCash.textContent = fmt(s.cash);
    // Three rows rather than one, because with upkeep the single "per second"
    // number could no longer answer either question a player asks of it: what
    // the city earns and what it keeps are different amounts now, and the
    // difference is the decision the tab exists for.
    const due = upkeep(s);
    n.ledgerGross.textContent = fmt(income(s));
    n.ledgerUpkeep.textContent = due > 0 ? `−${fmt(due)}` : fmt(0);
    n.ledgerRate.textContent = fmt(netIncome(s));
    n.earned.textContent = fmt(s.earned);
    n.residents.textContent = fmtInt(residents(s));
    // Plots taken, not buildings owned. A merged building covers two plots, so
    // a row that counted buildings would show a district emptying as it grew.
    const homes = homeCapacity(s);
    const shops = shopCapacity(s);
    const industry = industryCapacity(s);
    const takenR = plotsOf(s, 'home');
    const takenC = plotsOf(s, 'shop');
    const takenI = plotsOf(s, 'industry');
    n.plotsResidential.textContent = `${fmtInt(takenR)}/${fmtInt(homes)}`;
    n.plotsCommercial.textContent = `${fmtInt(takenC)}/${fmtInt(shops)}`;
    n.plotsIndustrial.textContent = `${fmtInt(takenI)}/${fmtInt(industry)}`;
    n.plots.setAttribute(
      'aria-label',
      `Plots: residential ${takenR} of ${homes}, ` +
        `commercial ${takenC} of ${shops}, industrial ${takenI} of ${industry}`,
    );
    n.districts.textContent = `${s.districts} / ${MAX_DISTRICTS}`;
    n.happiness.textContent = pct(s.happiness);

    // What multiplies the rent, spelled out. Three of these have always been in
    // the ledger and none of them was ever on screen, which made the fourth —
    // the workforce skill — impossible to introduce honestly: a player told
    // "+30% industrial yield" on a school button has no way to find out what
    // the industrial term was worth in the first place.
    const trading = effectiveOf(s, 'shop');
    const works = effectiveOf(s, 'industry') + estateEarning(s);
    const skill = workforceSkill(s);
    n.bonusShop.textContent = `+${(SHOP_BONUS * trading * 100).toFixed(0)}%`;
    n.bonusShopNote.textContent = `${fmtInt(trading)} shop plots trading`;
    n.bonusIndustry.textContent = `+${(INDUSTRY_BONUS * works * skill * 100).toFixed(0)}%`;
    n.bonusIndustryNote.textContent = `${fmtInt(works)} works plots running`;
    n.bonusSkill.textContent = `x${skill.toFixed(2)}`;
    n.bonusSkillNote.textContent =
      skill <= 1
        ? 'no schooling yet'
        : `${pct(educationCoverage(s))} taught, on industry only`;
    n.bonusDistrict.textContent = `+${(DISTRICT_BONUS * (s.districts - 1) * 100).toFixed(0)}%`;
    n.bonusDistrictNote.textContent =
      s.districts === 1 ? 'one district' : `${s.districts} districts`;
    n.bonuses.setAttribute(
      'aria-label',
      `Rent multipliers: commerce plus ${Math.round(SHOP_BONUS * trading * 100)} percent, ` +
        `industry plus ${Math.round(INDUSTRY_BONUS * works * skill * 100)} percent ` +
        `at a workforce skill of ${skill.toFixed(2)}, ` +
        `districts plus ${Math.round(DISTRICT_BONUS * (s.districts - 1) * 100)} percent`,
    );
  }

  /**
   * What the city's services are doing to each signal, term by term.
   *
   * The bars above say a signal moved; this says what moved it. Without it the
   * player watches three numbers drift and has no way to tell a museum from a
   * tax rise — which would leave the whole of DEMAND_TERMS as numbers moving on
   * screen for reasons nobody can act on. Same job the happiness panel's binding
   * term does, and the same reason it exists.
   *
   * Rebuilt only when the words change. This is a live region's neighbour and
   * runs on every paint, so a `replaceChildren` per frame would churn nine rows
   * ten times a second for a signal that moves on a 25-second constant.
   */
  private paintLift(s: Readonly<GameState>): void {
    const rows: Array<{ zone: boolean; label: string; reads: string; value: number }> = [];
    for (const kind of ZONE_KINDS) {
      const terms = demandTerms(s, kind);
      if (terms.length === 0) continue;
      rows.push({ zone: true, label: ZONE_LIFT_NAMES[kind], reads: '', value: demandLift(s, kind) });
      for (const entry of terms) {
        rows.push({
          zone: false,
          label: entry.term.label,
          // The tax pressure is the one reading that is not a *share* of
          // anything, so it is shown signed rather than as a percentage. The
          // rival is not a coverage either, but it is a fraction — "the city
          // next door is 30% established" is the sentence — so it reads like
          // one. See `demandReading`.
          reads: entry.term.key === 'tax' ? entry.reading.toFixed(2) : pct(entry.reading),
          value: entry.value,
        });
      }
    }

    const stamp = rows.map((row) => `${row.label}${row.reads}${row.value.toFixed(3)}`).join('|');
    if (stamp === this.liftShown) return;
    this.liftShown = stamp;

    if (rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'none';
      // The gate in `demandLift`, said in words. A city with no housing has no
      // coverage to read, so the terms are off rather than reading zero.
      empty.textContent = 'Build housing to see what the city asks for.';
      this.nodes.demandLift.replaceChildren(empty);
      return;
    }

    this.nodes.demandLift.replaceChildren(
      ...rows.map((row) => {
        const node = document.createElement('div');
        const tone = row.value > 0.0005 ? ' up' : row.value < -0.0005 ? ' down' : '';
        node.className = (row.zone ? 'lift-zone' : 'lift-row') + tone;
        const key = document.createElement('span');
        key.className = 'k';
        key.textContent = row.label;
        node.append(key);
        if (!row.zone) {
          const reads = document.createElement('span');
          reads.className = 'reads';
          reads.textContent = row.reads;
          node.append(reads);
        }
        const value = document.createElement('span');
        value.className = row.zone ? 'total' : 'val';
        value.textContent = signed(row.value);
        node.append(value);
        return node;
      }),
    );
  }

  private paintDemand(s: Readonly<GameState>): void {
    const n = this.nodes;
    this.paintBar(n.demandRFill, s.demandR);
    this.paintBar(n.demandCFill, s.demandC);
    this.paintBar(n.demandIFill, s.demandI);
    n.demandRNum.textContent = pct(s.demandR);
    n.demandCNum.textContent = pct(s.demandC);
    n.demandINum.textContent = pct(s.demandI);
    n.rci.setAttribute(
      'aria-label',
      `Demand: residential ${pct(s.demandR)}, commercial ${pct(s.demandC)}, ` +
        `industrial ${pct(s.demandI)}. Negative is oversupplied.`,
    );

    this.paintLift(s);

    // The happiness panel. A bare percentage says nothing a player can act on,
    // so the binding term is named beside it: "Health coverage 41%" is the whole
    // reason this block exists rather than the number on its own.
    //
    // And the term alone turned out not to be enough either. It names what is
    // short, which early on is always the hospital, so a city with 60 in the
    // bank read "Health coverage 0%" about a 130 building while the 45 park that
    // would also have lifted it went unmentioned — the panel naming a problem the
    // player could not afford to solve. `happinessFix` names the button instead,
    // with its price, and falls back to the cheapest one when nothing is
    // affordable, because "save 130" is an instruction and a percentage is not.
    const worst = bindingTerm(s);
    const term = `${worst.coverLabel} ${pct(worst.coverage)}`;
    const fix = happinessFix(s);
    const why = fix === null ? term : `${term} — ${fix.label.toLowerCase()}, ${fmt(fix.cost)}`;
    n.moodPct.textContent = pct(s.happiness);
    n.moodWhy.textContent = why;
    n.moodWhy.classList.toggle('can', fix !== null && fix.affordable);
    n.moodFill.style.width = `${Math.max(0, Math.min(100, s.happiness * 100)).toFixed(1)}%`;
    n.mood.classList.toggle('short', s.happiness < HAPPINESS_MIN_BUILD);
    n.mood.setAttribute('aria-label', `Happiness ${pct(s.happiness)}. Weakest: ${why}.`);

    const spoken: string[] = [];
    const taught: string[] = [];
    // Coverage is land now, so the row says how much of the housing a service
    // reaches rather than how many people. Plots are also the unit the player
    // buys in, which the residents figure never was.
    const plots = housingPlots(s);
    for (const { service, built, covered, coverage: reach } of serviceReadings(s)) {
      const row = this.serviceNodes.find((entry) => entry.service.key === service.key);
      if (!row) continue;
      row.built.textContent = fmtInt(built);
      row.covers.textContent = `covers ${fmtInt(covered)} of ${fmtInt(plots)}`;
      row.row.classList.toggle('covered', reach >= 1);
      // Split by what the row is *about* rather than by its weight: police
      // carry 0 since crime became a quantity, and a weight test would have
      // read them into the education block. See the police row in SERVICES.
      (EDUCATION_SERVICES.some((entry) => entry.key === service.key) ? taught : spoken).push(
        `${service.name} ${built}, covering ${Math.round(covered)} of ${Math.round(plots)} housing plots`,
      );
    }
    // Recreation is the fourth happiness term but not a service: it has no
    // staffing and no site of its own, so it gets its own row rather than being
    // forced through `serviceReadings`. Same denominator as the rest now.
    const parkLand = parkCapacity(s);
    const reach = recreationCoverage(s);
    n.parksBuilt.textContent = `${fmtInt(s.parks)}/${fmtInt(parkLand)}`;
    n.parksCovers.textContent = `covers ${fmtInt(Math.min(plots, s.parks * PLOTS_PER_PARK))} of ${fmtInt(plots)} plots`;
    n.parksRow.classList.toggle('covered', reach >= 1);
    spoken.push(
      `Parks ${s.parks} of ${parkLand} plots, covering ${Math.round(reach * 100)} percent of housing land`,
    );
    // Crime, under the stations that answer it. Stated as the rate and what it
    // costs, in the units every other modifier in this HUD uses — see the
    // Traffic row, which says the same two things about the same target.
    const crimeAt = crime(s);
    n.crimeRate.textContent = pct(crimeAt);
    n.crimeMood.textContent =
      crimeAt <= 0
        ? 'no effect on mood'
        : `−${(CRIME_MOOD * crimeAt * 100).toFixed(1)} points of mood`;
    spoken.push(
      `Crime ${Math.round(crimeAt * 100)} percent` +
        (crimeAt > 0 ? `, costing ${(CRIME_MOOD * crimeAt * 100).toFixed(1)} points of mood` : ''),
    );

    // The two emergency responses, in one shape because they are one model.
    // Both say the same three things: how long the answer takes, whether that
    // beats the deadline, and what is open right now. See RESPONSES.
    for (const [row, seconds, outcome, open, lost] of [
      [POLICE_RESPONSE, n.callResponse, n.callOutcome, s.calls.length, 'goes unanswered'],
      [FIRE_RESPONSE, n.fireResponse, n.fireOutcome, s.fires.length, 'takes the building'],
    ] as const) {
      const answer = responseSeconds(s, row);
      const misses = missesDeadline(s, row);
      seconds.textContent = `${answer.toFixed(0)}s`;
      const at = `${Math.round(responseThreshold(row) * 100)}%`;
      outcome.textContent =
        open > 0
          ? `${fmtInt(open)} open, ${misses ? `each ${lost}` : 'all answered in time'}`
          : misses
            ? `too slow — ${at} coverage answers in time`
            : 'inside the deadline';
      spoken.push(
        `${row.key === 'fire' ? 'Fire' : 'Police'} response ${answer.toFixed(0)} seconds, ` +
          `${misses ? 'past' : 'inside'} the ${row.deadline} second deadline.`,
      );
    }
    n.services.setAttribute('aria-label', `Services: ${spoken.join('; ')}`);

    // Power gets a block of its own because it is the one thing the city can run
    // *out* of. Three numbers, and the third is the one that matters: what a
    // shortfall is currently costing, in the units the player watches — a cap on
    // how full the city can get. A ratio on its own would be a number with no
    // consequence attached to it.
    const ratio = powerRatio(s);
    const cap = powerCap(s);
    n.powerBuilt.textContent = `${fmtInt(s.plants)}/${fmtInt(plantCapacity(s))}`;
    n.powerRatio.textContent =
      s.plants <= 0 && ratio >= 1 ? 'on the grid alone' : `${pct(Math.min(9.99, ratio))} supplied`;
    n.powerRow.classList.toggle('short', ratio < 1);
    n.powerDraw.textContent = fmtInt(powerDemand(s));
    n.powerEffect.textContent =
      ratio >= 1 ? 'no effect on occupancy' : `occupancy capped at ${pct(cap)}`;
    n.power.setAttribute(
      'aria-label',
      `Power: ${s.plants} plants supplying ${Math.round(Math.min(9.99, ratio) * 100)} percent of ` +
        `a load of ${Math.round(powerDemand(s))}` +
        (ratio < 1 ? `, occupancy capped at ${Math.round(cap * 100)} percent` : ''),
    );

    // Transport gets a block of its own for the same reason education does: it
    // answers a different question from happiness. What it says is what the
    // network earns, what it reaches, and — since congestion arrived — what the
    // streets are like, which is the third thing a depot is for.
    const fares = fareIncome(s);
    const spare = labourReach(s);
    n.transitFares.textContent = s.freeTransport ? 'free' : `${fmt(fares)}/s`;
    n.transitLabour.textContent =
      spare < 1
        ? 'no spare labour reached'
        : `reaches ${fmtInt(spare)} spare workers`;
    // The number and what it costs, in the units every other modifier in this
    // HUD is stated in — see the tax and landmark rows, which both say "points
    // of mood" against the same happiness target.
    const jam = congestion(s);
    const carried = transitShare(s);
    n.transitCongestion.textContent = pct(jam);
    n.transitCongestionMood.textContent =
      jam <= 0
        ? 'no effect on mood'
        : `−${(CONGESTION_MOOD * jam * 100).toFixed(1)} points of mood`;
    // And the bins, which the same depots empty. Fourth thing this block says a
    // depot is for — see `garbageCollection`.
    const bins = garbage(s);
    n.garbageRate.textContent = pct(bins);
    n.garbageMood.textContent =
      bins <= 0
        ? 'no effect on mood'
        : `−${(GARBAGE_MOOD * bins * 100).toFixed(1)} points of mood`;
    // And the network above it. Two numbers rather than one, because
    // `networkService` is the *lesser* of reach and capacity and a single
    // figure would leave the player unable to tell which line to lay next.
    for (const { line, built, allowed, cost } of transitLineReadings(s)) {
      const row = this.lineNodes.find((entry) => entry.line.key === line.key);
      if (!row) continue;
      row.allowance.textContent = `${fmtInt(built)}/${fmtInt(allowed)}`;
      row.cost.textContent = fmt(cost);
      row.button.disabled = !canBuildLine(s, line);
      row.button.title = lineBlocker(s, line) ?? line.buildLabel;
    }
    const joined = networkReach(s);
    const room = networkCapacity(s);
    const served = networkService(s);
    const lines = s.tramLines + s.railLines;
    n.networkReach.textContent = pct(joined);
    n.networkWhere.textContent =
      lines <= 0
        ? 'no line laid'
        : `${fmtInt(networkedDistricts(s.tramLines, s.railLines, s.districts))} of ` +
          `${fmtInt(s.districts)} districts joined`;
    n.networkCapacity.textContent = pct(room);
    n.networkService.textContent =
      served <= 0 ? 'carries nothing yet'
      : room < reach ? 'short of capacity — more lines'
      : reach < room ? 'short of track — more districts'
      : 'the whole city, carried';
    n.networkFreight.textContent =
      served <= 0 ? '—' : `+${Math.round(NETWORK_EXPORT_LIFT * served * 100)}%`;
    n.networkArrivals.textContent =
      served <= 0
        ? 'no arrivals by rail'
        : `${fmt(visitorSources(s).rail)} arriving by rail`;
    n.network.setAttribute(
      'aria-label',
      `Network: ${lines} lines reaching ${Math.round(joined * 100)} percent of the city ` +
        `and carrying ${Math.round(room * 100)} percent of it.`,
    );

    n.transit.setAttribute(
      'aria-label',
      `Transport: ${s.depots} depots covering ${Math.round(transitCoverage(s) * 100)} percent, ` +
        (s.freeTransport ? 'fares free' : `${Math.round(fares * 10) / 10} per second in fares`) +
        `. Traffic ${Math.round(jam * 100)} percent, with ${Math.round(carried * 100)} percent of ` +
        'trips on the network.',
    );

    // Education gets its own panel because it answers a different question: not
    // "is the city happy" but "how tall is it allowed to build". The row that
    // matters is the last one — what the next level costs in coverage.
    const taughtShare = educationCoverage(s);
    const next = nextLevelRequirement(s);
    n.educationReach.textContent = pct(taughtShare);
    n.educationNext.textContent =
      next === null ? 'every level unlocked' : `next level needs ${pct(next)}`;
    n.education.classList.toggle('covered', next !== null && taughtShare >= next);
    taught.push(
      `Education reaches ${Math.round(taughtShare * 100)} percent` +
        (next === null
          ? ', every level unlocked'
          : `, next level needs ${Math.round(next * 100)} percent`),
    );
    n.education.setAttribute('aria-label', `Education: ${taught.join('; ')}`);
  }

  /**
   * The policy tab: what the city charges, and what that costs it.
   *
   * The blocker-reason pattern in a different key — every other control in the
   * HUD says why it is off, and this one says what it is doing, because a rate
   * with no stated consequence is a rate nobody moves.
   */
  private paintTaxes(s: Readonly<GameState>): void {
    const n = this.nodes;
    const why = policyBlocker(s);
    n.cityHall.disabled = !canBuildCityHall(s);
    n.cityHall.hidden = s.cityHall;
    n.cityHallLabel.textContent = cityHallBlocker(s) ?? 'Build the city hall';
    n.cityHallCost.textContent = fmt(cityHallCost());
    n.cityHall.title = cityHallBlocker(s) ?? 'Build the city hall';
    // The blocker-reason idiom, given a line of its own because it answers for
    // the whole panel rather than for one control. Empty once the hall is up,
    // and `.note:empty` takes the space back with it.
    n.cityHallNote.textContent = why === null
      ? ''
      : `${why} — until then the city runs at ${
          (TAX_STEPS[TAX_NEUTRAL] as (typeof TAX_STEPS)[number]).label
        } with fares on.`;

    // The rate the city is *on*, which is neutral while there is nobody to set
    // one. `taxStep` says so, and the radio group has to agree with it or the
    // panel shows a rate the ledger is not using.
    const on = taxStep(s);
    const at = TAX_STEPS.indexOf(on);
    for (let i = 0; i < this.taxButtons.length; i++) {
      const button = this.taxButtons[i];
      if (!button) continue;
      const step = TAX_STEPS[i] as (typeof TAX_STEPS)[number];
      button.setAttribute('aria-checked', String(i === at));
      button.disabled = why !== null;
      button.title = why ?? `${step.label}: income x${step.income.toFixed(2)}`;
    }
    const step = taxStep(s);
    n.taxIncome.textContent = `x${step.income.toFixed(2)}`;
    n.taxMood.textContent =
      step.mood === 0
        ? 'no effect on mood'
        : `${step.mood > 0 ? '+' : '−'}${Math.round(Math.abs(step.mood) * 100)} points of mood`;

    // A trade rather than an upgrade, so the panel states both sides of it: what
    // the fares are worth is what turning them off costs.
    // `faresWaived` rather than the stored flag: a save carried over from a
    // build with no city hall keeps its setting, and the panel has to say
    // whether the city is acting on it rather than what it once chose.
    const waived = faresWaived(s);
    n.freeTransport.textContent = `Free transport · ${waived ? 'on' : 'off'}`;
    n.freeTransport.setAttribute('aria-pressed', String(waived));
    n.freeTransport.disabled = why !== null;
    n.freeTransport.title = why ?? 'Waive the fares';
    n.freeFares.textContent = waived
      ? 'fares waived'
      : `${fmt(fareIncome(s))}/s in fares`;
    n.freeEffect.textContent = `reach +${Math.round(FREE_TRANSPORT_REACH * 100)}%, mood +${Math.round(
      FREE_TRANSPORT_MOOD * 100,
    )}`;
  }

  /**
   * The landmarks panel: what each type costs, and what the pair of them is
   * currently worth.
   *
   * The covered share is the whole story here, so it gets a row of its own
   * rather than being implied by two counts. A player who has bought six
   * museums needs to know they are covering 30% of the city, not that they own
   * six of something.
   */
  private paintLandmarks(s: Readonly<GameState>): void {
    const n = this.nodes;
    // Culture first, because it is the cheap tier and sits above the landmarks
    // in the panel. Neither row says "points of mood", and that is the feature
    // rather than an omission — see CULTURE.
    for (const { culture, built, allowed, cost } of cultureReadings(s)) {
      const row = this.cultureNodes.find((entry) => entry.culture.key === culture.key);
      if (!row) continue;
      row.allowance.textContent = `${fmtInt(built)}/${fmtInt(allowed)}`;
      row.cost.textContent = fmt(cost);
      row.button.disabled = !canBuildCulture(s, culture);
      row.button.title = cultureBlocker(s, culture) ?? culture.buildLabel;
    }
    const reading = libraryCoverage(s);
    const stage = theatreCoverage(s);
    n.cultureLibrary.textContent = pct(reading);
    // Stated as what it takes off the idleness half rather than as a coverage,
    // because a coverage on its own says nothing a player can act on.
    n.cultureIdleness.textContent =
      reading <= 0
        ? 'no effect on crime'
        : `−${Math.round(LIBRARY_CRIME_RELIEF * reading * CRIME_FROM_IDLENESS * 100)}% of crime pressure`;
    n.cultureTheatre.textContent = pct(stage);
    n.cultureAudience.textContent =
      stage <= 0
        ? 'no audience yet'
        : `${fmt(visitorSources(s).stage)} arriving for the show`;
    n.culture.setAttribute(
      'aria-label',
      `Culture: libraries reaching ${Math.round(reading * 100)} percent of the city, ` +
        `theatres ${Math.round(stage * 100)} percent, worth ` +
        `${(THEATRE_VISITORS * stage).toFixed(1)} berths of arrivals.`,
    );

    for (const { landmark, built, allowed, cost } of landmarkReadings(s)) {
      const row = this.landmarkNodes.find((entry) => entry.landmark.key === landmark.key);
      if (!row) continue;
      row.allowance.textContent = `${fmtInt(built)}/${fmtInt(allowed)}`;
      row.cost.textContent = fmt(cost);
      row.button.disabled = !canBuildLandmark(s, landmark);
      row.button.title = landmarkBlocker(s, landmark) ?? landmark.buildLabel;
      row.built.textContent = `${fmtInt(built)}/${fmtInt(allowed)}`;
      // Reach in *plots* rather than world units, because a plot is the unit
      // the player buys in and a world unit is not a thing they can see.
      row.covers.textContent = `${landmark.span}x${landmark.span} site, reaches ${Math.round(
        landmark.reach / CELL,
      )} plots`;
    }
    const share = landmarkCoverage(s);
    n.landmarkShare.textContent = pct(share);
    n.landmarkMood.textContent =
      share <= 0
        ? 'no effect on mood'
        : `+${(LANDMARK_MOOD * share * 100).toFixed(1)} points of mood`;
  }

  /**
   * The trade panel: what a berth or a runway costs, and what they are earning.
   *
   * Called Trade rather than Port because an inland city has no port and does
   * have an airport, and a player who has just built a runway should not have to
   * look for it under the waterfront. The element ids are still `port-*`: they
   * name the readouts the waterfront owns, which is what they are.
   *
   * Three readouts rather than two counts, because the halves pay back in
   * currencies a count cannot show. Visitors are people a second and tourism is
   * cash a second, so both are worth saying; exports are the tap industrial
   * demand is drawn against, and the lift is only legible next to it.
   */
  private paintTrade(s: Readonly<GameState>): void {
    const n = this.nodes;
    let berths = 0;
    for (const { terminal, built, allowed, cost } of terminalReadings(s)) {
      berths = allowed;
      const row = this.terminalNodes.find((entry) => entry.terminal.key === terminal.key);
      if (!row) continue;
      row.allowance.textContent = `${fmtInt(built)}/${fmtInt(allowed)}`;
      row.cost.textContent = fmt(cost);
      row.button.disabled = !canBuildTerminal(s, terminal);
      row.button.title = terminalBlocker(s, terminal) ?? terminal.buildLabel;
    }

    const why = airportBlocker(s);
    n.airport.disabled = !canBuildAirport(s);
    n.airport.hidden = s.airport;
    n.airportLabel.textContent = why ?? 'Build the airport';
    n.airportCost.textContent = airportAllowed(s) ? fmt(airportCost()) : '—';
    n.airport.title = why ?? `Worth ${AIRPORT_VISITORS} berths of arrivals, without a coast`;

    const first = portDistrict(s.districts);
    // Berths *landing* rather than berths owned, because the runway lands on the
    // same path a quay does — see `berthsLanding`. An inland city reads three
    // and no coast, which is the whole point of the building.
    // `fmt` rather than `fmtInt`, because a berth is no longer a whole number:
    // road tourism is ROAD_VISITORS berths times a coverage, so a city with two
    // museums is landing a fraction of one and flooring it to zero would say it
    // had none. The allowance counts the road's two the same way.
    const allowed =
      berths +
      (s.airport ? AIRPORT_VISITORS : 0) +
      ROAD_VISITORS +
      RAIL_VISITORS +
      THEATRE_VISITORS;
    n.portBerths.textContent = `${fmt(berthsLanding(s))}/${fmt(allowed)}`;
    n.portWhere.textContent =
      first >= 0 ? `first quay on district ${fmtInt(first + 1)}`
      : s.airport ? 'by air and road'
      : 'by road only';

    const heads = visitors(s);
    n.portVisitors.textContent = fmt(heads);
    n.portSpend.textContent =
      berthsLanding(s) <= 0 ? 'nowhere to arrive' : `${fmt(cruiseIncome(s))}/s in tourism`;

    // Where they came from, and — the row that matters — what they are worth.
    // The spend line above is honest and asymptotically nothing: tourism sits
    // outside the income bracket, so one berth is 3.4% of a one-district
    // ledger and 0.0003% of a finished one. What a berth is actually worth now
    // is the shopping, which reaches income through SHOP_BONUS like everyone
    // else's. See VISITOR_TRIPS.
    const from = visitorSources(s);
    const parts: string[] = [];
    if (from.quay > 0) parts.push(`${fmt(from.quay)} sea`);
    if (from.air > 0) parts.push(`${fmt(from.air)} air`);
    if (from.road > 0) parts.push(`${fmt(from.road)} road`);
    if (from.rail > 0) parts.push(`${fmt(from.rail)} rail`);
    if (from.stage > 0) parts.push(`${fmt(from.stage)} stage`);
    n.portSources.textContent = parts.length > 0 ? parts.join(' · ') : '—';
    const share = visitorShare(s);
    n.portShopping.textContent =
      heads <= 0
        ? 'no visitors yet'
        : `${pct(share)} of the city's shopping`;

    n.portExports.textContent = fmt(exportMarket(s));
    const lift =
      CARGO_EXPORT_LIFT * s.cargoTerminals +
      (s.airport ? AIRPORT_EXPORT_LIFT : 0) +
      (goodsTraded(s) ? GOODS_TRADE_LIFT : 0) +
      NETWORK_EXPORT_LIFT * networkService(s);
    n.portLift.textContent =
      lift <= 0 ? 'no freight yet' : `+${Math.round(lift * 100)}% on the tap`;

    this.paintTreaties(s);
  }

  /**
   * The lower half of the trade tab: the city next door, and the two agreements
   * that answer it.
   *
   * On this tab rather than on the policy one, even though both switches are
   * gated on the city hall exactly as the tax rate is. Policy is what the city
   * does to itself; this is what it does with everybody else, and the rival is
   * only legible next to the export tap it is competing for.
   *
   * The rival row is the first thing painted and it is the one that has to be
   * there. A rival the player cannot find is indistinguishable from commerce
   * being mysteriously expensive — so the row says how established it is *and*
   * what that is costing, in the same points the demand tab is read in.
   */
  private paintTreaties(s: Readonly<GameState>): void {
    const n = this.nodes;
    const why = policyBlocker(s);
    const rival = rivalStrength(s);
    n.rivalStrength.textContent = pct(rival);
    // Both signals, because the rival takes more off industry than off commerce
    // and a single averaged number would hide the one decision it informs.
    n.rivalCost.textContent =
      rival <= 0
        ? s.districts >= RIVAL_MATCH_DISTRICTS
          ? 'outgrown — a suburb now'
          : 'not settled yet'
        : `${signed(rivalDemand(s, 'shop'))} trade, ${signed(rivalDemand(s, 'industry'))} industry`;

    // The step the city is *on*, not the one it stored — `powerTradeStep`
    // answers with Off for a save that predates its own city hall, and the
    // radio group has to agree with the grid rather than with the save.
    const step = powerTradeStep(s);
    const at = POWER_TRADES.indexOf(step);
    for (let i = 0; i < this.powerButtons.length; i++) {
      const button = this.powerButtons[i];
      if (!button) continue;
      const trade = POWER_TRADES[i] as PowerTrade;
      button.setAttribute('aria-checked', String(i === at));
      button.disabled = why !== null;
      button.title =
        why ??
        (trade.imports > 0
          ? `Buy ${Math.round(trade.imports * 100)}% of the draw at ${trade.price.toFixed(2)} a unit`
          : trade.sells > 0
            ? `Sell the spare at ${trade.sells.toFixed(2)} a unit`
            : 'Neither buy nor sell');
    }

    const bought = powerImported(s);
    const sold = step.sells > 0 ? powerSurplus(s) : 0;
    n.powerTradeFlow.textContent =
      bought > 0 ? `${fmt(bought)} bought`
      : sold > 0 ? `${fmt(sold)} sold`
      : step.sells > 0 ? 'nothing spare'
      : 'none traded';
    // What it is worth per second, which is the number the switch is decided
    // on. A city exporting with no surplus reads nothing rather than reading a
    // price it is not being paid.
    n.powerTradeWorth.textContent =
      bought > 0 ? `${fmt(powerTradeCost(s))}/s on the bill`
      : sold > 0 ? `${fmt(powerTradeIncome(s))}/s earned`
      : why ?? 'no agreement';

    // `goodsTraded` rather than the stored flag, for the reason `faresWaived` is
    // read that way: the flag is what the player chose and this is whether the
    // city can act on it.
    const treaty = goodsTraded(s);
    n.goodsTrade.textContent = `Goods agreement · ${treaty ? 'on' : 'off'}`;
    n.goodsTrade.setAttribute('aria-pressed', String(treaty));
    n.goodsTrade.disabled = why !== null;
    n.goodsTrade.title = why ?? 'Open the market next door';
    n.goodsFee.textContent = treaty ? `${fmt(tradeUpkeep(s))}/s to keep` : 'nothing to keep';
    n.goodsEffect.textContent = `tap +${Math.round(GOODS_TRADE_LIFT * 100)}%, rival \u2212${Math.round(
      GOODS_TRADE_ANSWER * 100,
    )}%`;
  }

  /**
   * The estates panel: the road, the parcels, and what the band is worth.
   *
   * The ledger row is the one that has to be there. An estate pays back through
   * the income multiplier rather than by earning on its own, so "what did that
   * buy me" is a share of the whole ledger and cannot be read off a price.
   */
  private paintEstates(s: Readonly<GameState>): void {
    const n = this.nodes;
    const allowed = estateCapacity(s);

    n.highway.disabled = !canBuildHighway(s);
    n.highwayLabel.textContent = s.highway ? 'Highway open' : 'Build the highway';
    n.highwayCost.textContent = s.highway ? '' : fmt(highwayCost());
    n.highway.title = highwayBlocker(s) ?? 'Build the highway';
    n.highway.setAttribute('aria-pressed', String(s.highway));

    n.estate.disabled = !canBuildEstate(s);
    n.estateLabel.textContent = estateBlocker(s) ?? 'Break ground on an estate';
    n.estateCost.textContent = fmt(estateCost(s));

    n.estateBuilt.textContent = `${fmtInt(s.estates)}/${fmtInt(allowed)}`;
    // Three states, not two: a city can be big enough for the road and not have
    // bought it, and "needs 18 districts" to a city with twenty-four is the
    // panel telling a player something they can see is untrue.
    n.estateRoom.textContent =
      s.highway ? `${fmtInt(ESTATE_CELLS)} parcels in the band`
      : highwayAllowed(s) ? 'needs the highway'
      : `needs ${fmtInt(HIGHWAY_MIN_DISTRICTS)} districts`;

    n.estatePlots.textContent = fmtInt(estatePlots(s));
    n.estateJobs.textContent = `${fmt(estateJobs(s))} jobs`;

    // What the band adds to the ledger, measured the way a player would ask it:
    // the same city without it. Cheap — `income` is a handful of reads.
    const without = income({ ...s, estates: 0 });
    n.estateLedger.textContent =
      s.estates <= 0 || without <= 0 ?
        '+0%'
      : `+${(((income(s) - without) / without) * 100).toFixed(0)}%`;
    n.estateSupply.textContent =
      s.estates <= 0 ? 'no goods yet' : `${fmt(estateSupply(s))} goods a second`;
  }

  private paintBuild(s: Readonly<GameState>): void {
    const n = this.nodes;
    const target = demandTargets(s);

    for (const { service, built, allowed } of serviceReadings(s)) {
      const row = this.serviceNodes.find((entry) => entry.service.key === service.key);
      if (!row) continue;
      row.allowance.textContent = `${fmtInt(built)}/${fmtInt(allowed)}`;
      row.cost.textContent = fmt(serviceCost(s, service));
      row.button.disabled = !canBuildService(s, service);
      // The two education types carry a second reason to buy them now: what the
      // schooling is worth to the city's industry. On the tooltip rather than
      // the face of the button, which is a price and a count and has no room —
      // and quoted at the coverage the city *would* have, because "+30% at full
      // coverage" is a promise and "+11% right now" is a fact.
      const why = serviceBlocker(s, service);
      row.button.title =
        why ??
        (service.key === 'school' || service.key === 'university'
          ? `${service.buildLabel} — schooling is worth +${Math.round(
              SKILL_YIELD * educationCoverage(s) * 100,
            )}% industrial yield now, +${Math.round(SKILL_YIELD * 100)}% at full coverage`
          : service.buildLabel);
    }

    // There is no single zoning any more, so the readout names the tallest
    // thing standing rather than one city-wide tier — "towers" once the first
    // tower is up, which is the milestone a player actually wants told. One per
    // zone, because commerce and industry climb the same ladder and "retail
    // park" is the milestone for a player watching the high street.
    n.zoneName.textContent = ZONE_LEVEL_NAMES.home[topLevel(s.homeLevels)] ?? '';
    n.zoneShop.textContent = ZONE_LEVEL_NAMES.shop[topLevel(s.shopLevels)] ?? '';
    n.zoneIndustry.textContent = ZONE_LEVEL_NAMES.industry[topLevel(s.industryLevels)] ?? '';
    // Same pattern as annex: when the button is dead for a reason worth
    // stating, the label states it instead of the verb.
    n.homeLabel.textContent = homeBlocker(s) ?? 'Build home';
    n.homeCost.textContent = fmt(homeCost(s));
    n.shopCost.textContent = fmt(shopCost(s));
    n.industryCost.textContent = fmt(industryCost(s));
    this.paintChip(n.homeChip, s.demandR);
    this.paintChip(n.shopChip, s.demandC);
    this.paintChip(n.industryChip, s.demandI);
    this.paintTrend(n.homeTrend, s.demandR, target.r);
    this.paintTrend(n.shopTrend, s.demandC, target.c);
    this.paintTrend(n.industryTrend, s.demandI, target.i);
    n.home.disabled = !canBuildHome(s);
    n.shop.disabled = !canBuildShop(s);
    n.industry.disabled = !canBuildIndustry(s);
    n.parkCost.textContent = fmt(parkCost(s));
    n.parkAllowance.textContent = `${fmtInt(s.parks)}/${fmtInt(parkCapacity(s))}`;
    n.park.disabled = !canBuildPark(s);
    n.park.title = parkBlocker(s) ?? 'Lay out a park';
    n.plantCost.textContent = fmt(plantCost(s));
    n.plantAllowance.textContent = `${fmtInt(s.plants)}/${fmtInt(plantCapacity(s))}`;
    n.plant.disabled = !canBuildPlant(s);
    n.plant.title = plantBlocker(s) ?? 'Break ground on a power plant';

    // The bar shows what the annexation gate actually reads, which is the
    // *working* share: a plot with a ruin on it is developed but not active,
    // and a bar that counted it would sit above a gate that never opened.
    const filled = activeDeveloped(s);
    n.occupancyFill.style.width = `${Math.min(100, filled * 100).toFixed(1)}%`;
    n.occupancy.classList.toggle('ready', filled >= ANNEX_MIN_OCCUPANCY);
    const ruins = abandonedBuildings(s);
    n.occupancy.setAttribute(
      'aria-label',
      `Land developed and working: ${Math.round(filled * 100)} percent` +
        (ruins > 0 ? `, with ${ruins} abandoned` : ''),
    );

    // Annexation runs itself now, so the label's job changed: it says what the
    // city is waiting for rather than offering a purchase. The button stays as
    // the override — it asks only what `canAnnex` asks, where the automatic
    // pass waits for a surplus on top.
    const annexWhy = annexBlocker(s);
    const capped = s.districts >= MAX_DISTRICTS;
    n.annexLabel.textContent = annexWhy ?? (willAutoAnnex(s) ? 'Expanding…' : 'Annex now');
    n.annexCost.textContent = capped ? '—' : fmt(annexCost(s));
    n.annex.disabled = !canAnnex(s);
    n.annex.title = annexWhy ?? 'Take the next district without waiting for a surplus';

    // Auto-development is policy too, so it answers to the same gate the Taxes
    // tab does — and says so on the label rather than only going grey.
    const govern = policyBlocker(s);
    const developing = s.autoDevelop && govern === null;
    n.auto.textContent = govern ?? `Auto-develop · ${developing ? 'on' : 'off'}`;
    n.auto.setAttribute('aria-pressed', String(developing));
    n.auto.disabled = govern !== null;
    n.auto.title = govern ?? 'Spend surplus cash while you are away';

    // Founding again. The button carries what it is worth rather than what it
    // costs, which is the one place in this HUD that reads the other way round
    // — the cost is the whole city and it is on the button's face already.
    const ascendWhy = ascendBlocker(s);
    const gain = legacyGain(s);
    const after = legacyMultiplier({ ...s, legacy: s.legacy + gain });
    n.ascendLabel.textContent =
      ascendWhy ?? (s.foundings > 1 ? `Found again · city ${fmtInt(s.foundings)}` : 'Found again');
    n.ascendGain.textContent = ascendWhy === null ? `${after.toFixed(2)}x` : '';
    n.ascend.disabled = !canAscend(s);
    n.ascend.title =
      ascendWhy ??
      `Give up ${fmtInt(s.districts)} districts for a permanent ${after.toFixed(2)}x` +
        ` on everything the next city earns (now ${legacyMultiplier(s).toFixed(2)}x)`;
  }

  /**
   * Opens the card on one building, or closes it.
   *
   * Called by the host when the view's selection changes. The card is painted
   * from `paint`, not from here, so everything in it stays a read over the
   * current state rather than a snapshot of the moment it was clicked.
   */
  inspect(ref: BuildingRef | null): void {
    this.selected = ref;
    this.cardShown = '';
    this.nodes.inspect.hidden = ref === null;
    this.paint();
  }

  /**
   * The card. Every line is a read over the state, the seed and the layout, and
   * nothing in it is per-building state — because there is none.
   *
   * What it may say is bounded by what a building actually knows. Levels are
   * cohorts, and happiness, occupancy, demand and education are city-wide
   * scalars, so two buildings of the same level are identical by construction:
   * there is no per-building age, no per-building mood and no per-building
   * occupancy to show, and inventing one would be a lie the rest of the game
   * would immediately contradict. Where a number *is* city-wide it says so.
   */
  private paintCard(s: Readonly<GameState>): void {
    const ref = this.selected;
    const n = this.nodes;
    if (!ref) return;

    const levels = ref.kind === 'home' ? s.homeLevels : ref.kind === 'shop' ? s.shopLevels : s.industryLevels;
    const level = levelAt(levels, ref.slot);
    const names = ZONE_LEVEL_NAMES[ref.kind];
    const at = this.layout
      .ensure(s)
      .place(zoneOf(ref.kind), ref.slot, mergedOf(s, ref.kind), s, this.at);
    // Asked of the layout rather than divided out of a per-district constant:
    // districts sell different amounts of each zone now, so there is no divisor
    // to use. See `districtOfPlot`.
    const district = districtOfPlot(s, zoneOf(ref.kind), at.plot);

    n.inspectTitle.textContent =
      level < 0 ? 'Boarded up' : (names[level] ?? `level ${level}`);
    n.inspectWhere.textContent = `${ZONE_LABEL[ref.kind]} · district ${district + 1}`;

    const rows: Array<[string, string]> = [];
    rows.push(['Level', level < 0 ? '—' : `${level + 1} of ${LEVELS}`]);
    rows.push([
      'Footprint',
      at.plots > 1
        ? '2 plots · merged'
        : at.parcelPlots > 1
          ? '1 plot · can merge'
          : '1 plot · no pair',
    ]);
    if (ref.kind === 'home') {
      rows.push(['Houses', level < 0 ? '0' : fmtInt(LEVEL_HOUSING[level] ?? 0)]);
    } else if (ref.kind === 'shop') {
      rows.push(['Employs', level < 0 ? '0' : fmtInt(SHOP_JOBS[level] ?? 0)]);
      rows.push(['Serves', level < 0 ? '0' : `${fmtInt(SHOP_TRIPS[level] ?? 0)} trips`]);
    } else {
      rows.push(['Employs', level < 0 ? '0' : fmtInt(INDUSTRY_JOBS[level] ?? 0)]);
      rows.push(['Makes', level < 0 ? '0' : fmtInt(INDUSTRY_OUTPUT[level] ?? 0)]);
    }
    // The first line in this card that is about *where* rather than about what.
    // Two identical houses are worth different rents now — see `landValue` —
    // and a card that showed the income without the reason would read as a bug.
    if (ref.kind === 'home') {
      const land = parcelLandValue(s, at.plot, at.plots);
      rows.push([
        'Land value',
        `${land >= 1 ? '+' : '−'}${Math.abs(Math.round((land - 1) * 100))}% · ${
          Math.round(housingCentrality(at.plot, s) * 100)
        }% central`,
      ]);
    }
    // Marginal, and labelled: what the ledger loses if this one goes. Every
    // other term in it belongs to the whole city — except the land, which is
    // this building's alone and is why the parcel is handed in.
    rows.push([
      'Adds to income',
      `${fmt(buildingIncome(s, ref.kind, level, { plot: at.plot, plots: at.plots }))}/s`,
    ]);
    rows.push(['Expansion', promotionBlocker(s, ref.kind, level, at.parcelPlots) ?? 'Ready to climb']);
    rows.push(['Parcel', `#${at.plot + 1} · slot ${ref.slot + 1}`]);

    const shown = `${n.inspectTitle.textContent}|${rows.map((row) => row.join('=')).join('|')}`;
    if (shown === this.cardShown) return;
    this.cardShown = shown;

    n.inspectRows.replaceChildren(
      ...rows.map(([key, value]) => {
        const row = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = key;
        const dd = document.createElement('dd');
        dd.textContent = value;
        row.append(dt, dd);
        return row;
      }),
    );
  }

  /** The "while you were away" sheet. Skipped entirely for a trivial absence. */
  showAway(report: AwayReport): void {
    // A building lost is worth a sheet on its own. The earnings floor exists to
    // skip a report with nothing in it; a fire is something in it.
    const notable = report.firesLost > 0 || report.abandoned > 0;
    if (report.seconds < 60 || (report.earned < 1 && !notable)) return;
    const n = this.nodes;
    n.welcomeAway.textContent = fmtDuration(report.seconds);
    this.paintTimeline(report);

    const rows: Array<[string, string]> = [['Collected', fmt(report.earned)]];
    if (report.homes > 0) rows.push(['Homes built', fmtInt(report.homes)]);
    if (report.shops > 0) rows.push(['Shops opened', fmtInt(report.shops)]);
    if (report.industry > 0) rows.push(['Works built', fmtInt(report.industry)]);
    // Reported alongside the counts rather than folded into them: a merge takes
    // two buildings off the books without taking anything off the map, so the
    // count on its own reads as a loss.
    if (report.merges > 0) rows.push(['Buildings merged', fmtInt(report.merges)]);
    if (report.parks > 0) rows.push(['Parks laid out', fmtInt(report.parks)]);
    if (report.services > 0) rows.push(['Services opened', fmtInt(report.services)]);
    if (report.plants > 0) rows.push(['Power plants opened', fmtInt(report.plants)]);
    if (report.districts > 0) rows.push(['Districts annexed', fmtInt(report.districts)]);
    if (report.spent > 1) rows.push(['Reinvested', fmt(report.spent)]);
    // Alongside the reinvestment rather than folded into the collection, because
    // they are two different stories: one is the city spending what it earned on
    // itself, the other is what it owed whether or not it earned anything. A
    // player whose services came back browned out is owed the second one.
    if (report.wages > 1) rows.push(['Wages paid', fmt(report.wages)]);
    // Fires are reported even when none started, once any did: "0 lost" is the
    // half of the story that tells the player the fire service is working.
    if (report.firesStarted > 0) {
      rows.push(['Fires', fmtInt(report.firesStarted)]);
      rows.push(['Put out', fmtInt(report.firesExtinguished)]);
    }
    if (report.firesLost > 0) rows.push(['Lost to fire', fmtInt(report.firesLost)]);
    // Both halves, and only when there is a story: "3 boarded up" on its own
    // reads as a punishment, "3 boarded up, 2 reopened" reads as a city.
    if (report.abandoned > 0) rows.push(['Boarded up', fmtInt(report.abandoned)]);
    if (report.recovered > 0) rows.push(['Reopened', fmtInt(report.recovered)]);
    if (report.forfeited > 60) rows.push(['Uncollected', fmtDuration(report.forfeited)]);

    n.welcomeRows.replaceChildren(
      ...rows.map(([key, value]) => {
        const row = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = key;
        const dd = document.createElement('dd');
        dd.textContent = value;
        row.append(dt, dd);
        return row;
      }),
    );

    n.welcome.hidden = false;
    n.welcomeClose.focus();
  }

  /**
   * The timeline, above the totals.
   *
   * Offsets rather than an absolute clock: an event carries `elapsed`, which
   * for a city that has been running for three days is a six-figure number
   * meaning nothing to anybody. Against `report.startedAt` it becomes "+2h14m",
   * which reads directly against the sheet's own "6h 12m" headline.
   *
   * Capped, and the cap is on the *rendering* rather than on the log: the log
   * is already bounded at AWAY_EVENT_BUFFER, and this is the shorter number a
   * modal sheet can show without scrolling past the button. What is kept is the
   * newest end, because the last thing that happened is the state the player is
   * looking at.
   *
   * Wording comes from `tickLine`, so the sheet and the ticker say the same
   * thing about the same event — two vocabularies for one set of facts would be
   * two things to learn.
   */
  private paintTimeline(report: AwayReport): void {
    const n = this.nodes;
    const all = report.timeline;
    const shown = all.slice(-AWAY_TIMELINE_LINES);
    n.welcomeTimeline.replaceChildren(
      ...shown.map((event) => {
        const line = this.tickLine(event);
        const row = document.createElement('li');
        row.className = line.tone;
        const at = document.createElement('span');
        at.className = 'at';
        // Floored at zero: the first step of a catch-up lands a hair past the
        // origin, and "-0s" would be a stray minus sign on the first line.
        at.textContent = `+${fmtDuration(Math.max(0, event.at - report.startedAt))}`;
        const what = document.createElement('span');
        what.className = 'what';
        what.textContent = line.text;
        row.append(at, what);
        return row;
      }),
    );
    // Both halves of what is not on screen: the lines this list did not render,
    // and the ones the log itself ran out of room for. They are the same fact
    // to a player — things happened that are not shown — and splitting them
    // into two sentences would be an implementation detail on a modal sheet.
    const more = all.length - shown.length + report.dropped;
    n.welcomeMore.textContent = more > 0 ? `and ${fmtInt(more)} more, earlier` : '';
    // Open when there is no timeline to explain them, closed when there is: a
    // sheet that led with a fold nobody opened would have buried the report.
    n.welcomeTotals.open = all.length === 0;
  }
}
