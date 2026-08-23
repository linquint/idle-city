import { fmt, fmtDuration, fmtInt } from '../core/format';
import { ANNEX_MIN_OCCUPANCY, MAX_DISTRICTS } from '../sim/config';
import {
  annexBlocker,
  annexCost,
  canAnnex,
  canBuildHome,
  canBuildShop,
  canRezone,
  homeCapacity,
  homeCost,
  income,
  industryCapacity,
  nextTier,
  occupancy,
  residents,
  rezoneBlocker,
  rezoneCost,
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
    zoneName: el('zone-name'),
    occupancy: el('occupancy'),
    occupancyFill: el('occupancy-fill'),
    occupancyMark: el('occupancy-mark'),
    homeLabel: el('build-home-label'),
    homeCost: el('build-home-cost'),
    shopCost: el('build-shop-cost'),
    rezoneLabel: el('rezone-label'),
    rezoneCost: el('rezone-cost'),
    annexLabel: el('annex-label'),
    annexCost: el('annex-cost'),
    home: el<HTMLButtonElement>('build-home'),
    shop: el<HTMLButtonElement>('build-shop'),
    rezone: el<HTMLButtonElement>('rezone'),
    annex: el<HTMLButtonElement>('annex'),
    auto: el<HTMLButtonElement>('auto'),
    reset: el<HTMLButtonElement>('reset'),
    welcome: el('welcome'),
    welcomeAway: el('welcome-away'),
    welcomeRows: el('welcome-rows'),
    welcomeClose: el<HTMLButtonElement>('welcome-close'),
  };

  private since = 0;

  constructor(
    private readonly game: Game,
    private readonly hooks: HudHooks,
  ) {
    const n = this.nodes;
    n.home.addEventListener('click', () => this.act(() => this.game.buildHome()));
    n.shop.addEventListener('click', () => this.act(() => this.game.buildShop()));
    n.rezone.addEventListener('click', () => this.act(() => this.game.rezone()));
    n.annex.addEventListener('click', () => this.act(() => this.game.annex()));

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

  paint(): void {
    const s = this.game.state;
    const n = this.nodes;

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
    // Nothing builds on industrial land yet; the zone is shown so the plan the
    // Z overlay draws matches the ledger.
    n.plotsIndustrial.textContent = `0/${fmtInt(industry)}`;
    n.plots.setAttribute(
      'aria-label',
      `Plots: residential ${s.homes} of ${homes}, ` +
        `commercial ${s.shops} of ${shops}, industrial 0 of ${industry}`,
    );
    n.districts.textContent = `${s.districts} / ${MAX_DISTRICTS}`;

    const tier = tierOf(s);
    n.zoneName.textContent = tier.name;
    n.homeLabel.textContent = tier.buildLabel;
    n.homeCost.textContent = fmt(homeCost(s));
    n.shopCost.textContent = fmt(shopCost(s));
    n.home.disabled = !canBuildHome(s);
    n.shop.disabled = !canBuildShop(s);

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
