import { fmt, fmtDuration, fmtInt } from '../core/format';
import { ANNEX_MIN_OCCUPANCY, MAX_DISTRICTS, SERVICES } from '../sim/config';
import {
  annexBlocker,
  annexCost,
  canAnnex,
  canBuildHome,
  canBuildIndustry,
  canBuildService,
  canBuildShop,
  canRezone,
  demandTargets,
  happiness,
  homeCapacity,
  homeCost,
  income,
  industryCapacity,
  industryCost,
  nextTier,
  occupancy,
  priceModifier,
  residents,
  rezoneBlocker,
  rezoneCost,
  serviceCost,
  serviceReadings,
  shopCapacity,
  shopCost,
  tierOf,
} from '../sim/economy';
import type { AwayReport, Game } from '../sim/game';

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
    rci: el('rci'),
    demandRFill: el('demand-r-fill'),
    demandCFill: el('demand-c-fill'),
    demandIFill: el('demand-i-fill'),
    demandRNum: el('demand-r-num'),
    demandCNum: el('demand-c-num'),
    demandINum: el('demand-i-num'),
    services: el('services'),
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
    rezoneLabel: el('rezone-label'),
    rezoneCost: el('rezone-cost'),
    annexLabel: el('annex-label'),
    annexCost: el('annex-cost'),
    home: el<HTMLButtonElement>('build-home'),
    shop: el<HTMLButtonElement>('build-shop'),
    industry: el<HTMLButtonElement>('build-industry'),
    rezone: el<HTMLButtonElement>('rezone'),
    annex: el<HTMLButtonElement>('annex'),
    auto: el<HTMLButtonElement>('auto'),
    reset: el<HTMLButtonElement>('reset'),
    welcome: el('welcome'),
    welcomeAway: el('welcome-away'),
    welcomeRows: el('welcome-rows'),
    welcomeClose: el<HTMLButtonElement>('welcome-close'),
  };

  /** One row of civic controls and readouts per service, keyed the same way. */
  private readonly serviceNodes = SERVICES.map((service) => ({
    service,
    button: el<HTMLButtonElement>(`build-${service.key}`),
    cost: el(`build-${service.key}-cost`),
    row: el(`svc-${service.key}-built`).parentElement as HTMLElement,
    built: el(`svc-${service.key}-built`),
    pct: el(`svc-${service.key}-pct`),
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
    n.rezone.addEventListener('click', () => this.act(() => this.game.rezone()));
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
    n.happiness.textContent = pct(happiness(s));

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

    const readings = serviceReadings(s);
    const spoken: string[] = [];
    for (const { service, built, needed, coverage } of readings) {
      const row = this.serviceNodes.find((entry) => entry.service.key === service.key);
      if (!row) continue;
      row.built.textContent = `${fmtInt(built)}/${fmtInt(needed)}`;
      row.pct.textContent = pct(coverage);
      row.row.classList.toggle('covered', coverage >= 1);
      row.cost.textContent = fmt(serviceCost(s, service));
      row.button.disabled = !canBuildService(s, service);
      spoken.push(`${service.name} ${built} of ${needed}, ${pct(coverage)} covered`);
    }
    n.services.setAttribute('aria-label', `Services: ${spoken.join('; ')}`);

    const tier = tierOf(s);
    n.zoneName.textContent = tier.name;
    n.homeLabel.textContent = tier.buildLabel;
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

    const filled = occupancy(s);
    n.occupancyFill.style.width = `${Math.min(100, filled * 100).toFixed(1)}%`;
    n.occupancy.classList.toggle('ready', filled >= ANNEX_MIN_OCCUPANCY);
    n.occupancy.setAttribute(
      'aria-label',
      `Land developed: ${Math.round(filled * 100)} percent`,
    );

    const rezoneWhy = rezoneBlocker(s);
    const upgrade = nextTier(s);
    n.rezoneLabel.textContent = rezoneWhy ?? `Rezone to ${upgrade?.name ?? ''}`;
    n.rezoneCost.textContent = upgrade ? fmt(rezoneCost(s)) : '—';
    n.rezone.disabled = !canRezone(s);

    const annexWhy = annexBlocker(s);
    const capped = s.districts >= MAX_DISTRICTS;
    n.annexLabel.textContent = annexWhy ?? 'Annex district';
    n.annexCost.textContent = capped ? '—' : fmt(annexCost(s));
    n.annex.disabled = !canAnnex(s);

    n.auto.textContent = `Auto-develop · ${s.autoDevelop ? 'on' : 'off'}`;
    n.auto.setAttribute('aria-pressed', String(s.autoDevelop));
  }

  /** The "while you were away" sheet. Skipped entirely for a trivial absence. */
  showAway(report: AwayReport): void {
    if (report.seconds < 60 || report.earned < 1) return;
    const n = this.nodes;
    n.welcomeAway.textContent = fmtDuration(report.seconds);

    const rows: Array<[string, string]> = [['Collected', fmt(report.earned)]];
    if (report.homes > 0) rows.push(['Homes built', fmtInt(report.homes)]);
    if (report.shops > 0) rows.push(['Shops opened', fmtInt(report.shops)]);
    if (report.industry > 0) rows.push(['Works built', fmtInt(report.industry)]);
    if (report.services > 0) rows.push(['Services opened', fmtInt(report.services)]);
    if (report.spent > 1) rows.push(['Reinvested', fmt(report.spent)]);
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
