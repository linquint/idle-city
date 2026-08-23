import { fmt, fmtDuration, fmtInt } from '../core/format';
import {
  ANNEX_MIN_OCCUPANCY,
  HAPPINESS_MIN_BUILD,
  HOMES_PER_PARK,
  LEVEL_EDUCATION,
  LEVEL_NAMES,
  LEVELS,
  MAX_DISTRICTS,
  SERVICES,
} from '../sim/config';
import {
  abandonedBuildings,
  activeDeveloped,
  annexBlocker,
  annexCost,
  bindingTerm,
  canAnnex,
  canBuildHome,
  canBuildIndustry,
  canBuildPark,
  canBuildService,
  canBuildShop,
  demandTargets,
  educationCoverage,
  homeBlocker,
  homeCapacity,
  homeCost,
  income,
  industryCapacity,
  industryCost,
  parkBlocker,
  parkCapacity,
  parkCost,
  priceModifier,
  population,
  recreationCoverage,
  residents,
  serviceBlocker,
  serviceCost,
  serviceReadings,
  shopCapacity,
  shopCost,
  willAutoAnnex,
} from '../sim/economy';
import type { AwayReport, Game } from '../sim/game';
import type { GameState } from '../sim/state';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

export interface HudHooks {
  onReset: () => void;
  /** Dev-only time travel, wired to a button that only exists in dev builds. */
  onSkip?: (seconds: number) => void;
}

/** Below this a chip would say "-0%", which is noise rather than information. */
const CHIP_DEADBAND = 0.005;
/** Demand moves slowly; without a deadband the arrow flickers on rounding. */
const TREND_DEADBAND = 0.004;

const pct = (n: number): string => `${Math.round(n * 100)}%`;

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
    residents: el('residents'),
    plotsResidential: el('plots-r'),
    plotsCommercial: el('plots-c'),
    plotsIndustrial: el('plots-i'),
    plots: el('plots'),
    districts: el('districts'),
    happiness: el('happiness'),
    mood: el('mood'),
    moodPct: el('mood-pct'),
    moodWhy: el('mood-why'),
    moodFill: el('mood-fill'),
    rci: el('rci'),
    demandRFill: el('demand-r-fill'),
    demandCFill: el('demand-c-fill'),
    demandIFill: el('demand-i-fill'),
    demandRNum: el('demand-r-num'),
    demandCNum: el('demand-c-num'),
    demandINum: el('demand-i-num'),
    services: el('services'),
    education: el('education'),
    educationReach: el('education-reach'),
    educationNext: el('education-next'),
    zoneName: el('zone-name'),
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
    welcome: el('welcome'),
    welcomeAway: el('welcome-away'),
    welcomeRows: el('welcome-rows'),
    welcomeClose: el<HTMLButtonElement>('welcome-close'),
  };

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

  constructor(
    private readonly game: Game,
    private readonly hooks: HudHooks,
  ) {
    const n = this.nodes;
    n.home.addEventListener('click', () => this.act(() => this.game.buildHome()));
    n.shop.addEventListener('click', () => this.act(() => this.game.buildShop()));
    n.industry.addEventListener('click', () => this.act(() => this.game.buildIndustry()));
    n.park.addEventListener('click', () => this.act(() => this.game.buildPark()));
    n.annex.addEventListener('click', () => this.act(() => this.game.annex()));

    for (const { service, button } of this.serviceNodes) {
      button.addEventListener('click', () => this.act(() => this.game.buildService(service)));
    }

    n.auto.addEventListener('click', () => {
      this.game.setAutoDevelop(!this.game.state.autoDevelop);
      this.paint();
    });

    n.reset.addEventListener('click', () => {
      if (!confirm('Clear the city and start over? This cannot be undone.')) return;
      this.game.reset();
      this.hooks.onReset();
      this.paint();
    });

    n.welcomeClose.addEventListener('click', () => {
      n.welcome.hidden = true;
    });

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

  private act(run: () => boolean): void {
    if (run()) this.paint();
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

  paint(): void {
    const s = this.game.state;
    const n = this.nodes;
    const target = demandTargets(s);

    n.cash.textContent = fmt(s.cash);
    n.rate.textContent = fmt(income(s));
    n.residents.textContent = fmtInt(residents(s));
    // One number per zone rather than one city-wide total: each building type is
    // now capped by its own zone's plot count, so a single total would hide the
    // cap that is actually about to bite.
    const homes = homeCapacity(s);
    const shops = shopCapacity(s);
    const industry = industryCapacity(s);
    n.plotsResidential.textContent = `${fmtInt(s.homes)}/${fmtInt(homes)}`;
    n.plotsCommercial.textContent = `${fmtInt(s.shops)}/${fmtInt(shops)}`;
    n.plotsIndustrial.textContent = `${fmtInt(s.industry)}/${fmtInt(industry)}`;
    n.plots.setAttribute(
      'aria-label',
      `Plots: residential ${s.homes} of ${homes}, ` +
        `commercial ${s.shops} of ${shops}, industrial ${s.industry} of ${industry}`,
    );
    n.districts.textContent = `${s.districts} / ${MAX_DISTRICTS}`;
    n.happiness.textContent = pct(s.happiness);

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

    // The happiness panel. A bare percentage says nothing a player can act on,
    // so the binding term is named beside it: "Health coverage 41%" is the whole
    // reason this block exists rather than the number on its own.
    const people = population(s);
    const worst = bindingTerm(s);
    const why = `${worst.coverLabel} ${pct(worst.coverage)}`;
    n.moodPct.textContent = pct(s.happiness);
    n.moodWhy.textContent = why;
    n.moodFill.style.width = `${Math.max(0, Math.min(100, s.happiness * 100)).toFixed(1)}%`;
    n.mood.classList.toggle('short', s.happiness < HAPPINESS_MIN_BUILD);
    n.mood.setAttribute('aria-label', `Happiness ${pct(s.happiness)}. Weakest: ${why}.`);

    const spoken: string[] = [];
    const taught: string[] = [];
    for (const { service, built, allowed, covered, coverage: reach } of serviceReadings(s)) {
      const row = this.serviceNodes.find((entry) => entry.service.key === service.key);
      if (!row) continue;
      row.built.textContent = fmtInt(built);
      row.covers.textContent = `covers ${fmtInt(covered)} of ${fmtInt(people)}`;
      row.row.classList.toggle('covered', reach >= 1);
      row.allowance.textContent = `${fmtInt(built)}/${fmtInt(allowed)}`;
      row.cost.textContent = fmt(serviceCost(s, service));
      row.button.disabled = !canBuildService(s, service);
      row.button.title = serviceBlocker(s, service) ?? service.buildLabel;
      (service.weight > 0 ? spoken : taught).push(
        `${service.name} ${built} of ${allowed} allowed, covering ${Math.round(covered)} of ${Math.round(people)} residents`,
      );
    }
    // Recreation is the fourth happiness term but not a service: it has no
    // staffing, no site and a denominator in homes, so it gets its own row
    // rather than being forced through `serviceReadings`.
    const parkLand = parkCapacity(s);
    const reach = recreationCoverage(s);
    n.parksBuilt.textContent = `${fmtInt(s.parks)}/${fmtInt(parkLand)}`;
    n.parksCovers.textContent = `covers ${fmtInt(Math.min(s.homes, s.parks * HOMES_PER_PARK))} of ${fmtInt(s.homes)} homes`;
    n.parksRow.classList.toggle('covered', reach >= 1);
    spoken.push(
      `Parks ${s.parks} of ${parkLand} plots, covering ${Math.round(reach * 100)} percent of homes`,
    );
    n.services.setAttribute('aria-label', `Services: ${spoken.join('; ')}`);

    // Education gets its own panel because it answers a different question: not
    // "is the city happy" but "how tall is it allowed to build". The row that
    // matters is the last one — what the next level costs in coverage.
    const taughtShare = educationCoverage(s);
    const next = nextLevelRequirement(s);
    n.educationReach.textContent = pct(taughtShare);
    n.educationNext.textContent =
      next === null
        ? 'every level unlocked'
        : `next level needs ${pct(next)}`;
    n.education.classList.toggle('covered', next !== null && taughtShare >= next);
    taught.push(
      `Education reaches ${Math.round(taughtShare * 100)} percent` +
        (next === null
          ? ', every level unlocked'
          : `, next level needs ${Math.round(next * 100)} percent`),
    );
    n.education.setAttribute('aria-label', `Education: ${taught.join('; ')}`);

    // There is no single zoning any more, so the readout names the tallest
    // thing standing rather than one city-wide tier — "towers" once the first
    // tower is up, which is the milestone a player actually wants told.
    n.zoneName.textContent = LEVEL_NAMES[topLevel(s.homeLevels)] ?? '';
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

    n.auto.textContent = `Auto-develop · ${s.autoDevelop ? 'on' : 'off'}`;
    n.auto.setAttribute('aria-pressed', String(s.autoDevelop));
  }

  /** The "while you were away" sheet. Skipped entirely for a trivial absence. */
  showAway(report: AwayReport): void {
    // A building lost is worth a sheet on its own. The earnings floor exists to
    // skip a report with nothing in it; a fire is something in it.
    const notable = report.firesLost > 0 || report.abandoned > 0;
    if (report.seconds < 60 || (report.earned < 1 && !notable)) return;
    const n = this.nodes;
    n.welcomeAway.textContent = fmtDuration(report.seconds);

    const rows: Array<[string, string]> = [['Collected', fmt(report.earned)]];
    if (report.homes > 0) rows.push(['Homes built', fmtInt(report.homes)]);
    if (report.shops > 0) rows.push(['Shops opened', fmtInt(report.shops)]);
    if (report.industry > 0) rows.push(['Works built', fmtInt(report.industry)]);
    if (report.parks > 0) rows.push(['Parks laid out', fmtInt(report.parks)]);
    if (report.services > 0) rows.push(['Services opened', fmtInt(report.services)]);
    if (report.districts > 0) rows.push(['Districts annexed', fmtInt(report.districts)]);
    if (report.spent > 1) rows.push(['Reinvested', fmt(report.spent)]);
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
}
