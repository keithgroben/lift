import { createStore } from 'solid-js/store';

/**
 * Bridge between the imperative game loop (still `ui/app.js`, still the
 * source of truth for `state`) and the Solid HUD. `app.js` pushes computed
 * values in here via `setHud(...)` wherever it used to write `els[x] = ...`;
 * Solid components read `hud` reactively. One-way, one object, so migrating
 * a panel is: replace its `els[...]` writes with a `setHud` call, delete its
 * static markup, mount a component in its place.
 */
export interface HudColor {
  text: string;
  color: string;
  title?: string;
  ariaLabel?: string;
}

export interface HudState {
  money: HudColor;
  day: string;
  population: string;
  tenantTotal: HudColor;
  tenantUtilization: HudColor;
  tenantUtilizationChange: HudColor;
  tenantUtilizationTrendHtml: string;
  tenantUtilizationTrendColor: string;
  tenantUtilizationRecovery: HudColor;
  star: string;
  milestone: string;
  waitingNow: HudColor;
  wait: HudColor;
  rate: HudColor;
  rep: HudColor;
  roomEval: HudColor;
  desirability: HudColor;
  desirabilityTrend: HudColor;
}

const initialColor: HudColor = { text: '—', color: '#dbe4ee' };

const initial: HudState = {
  money: initialColor,
  day: '—',
  population: '—',
  tenantTotal: initialColor,
  tenantUtilization: initialColor,
  tenantUtilizationChange: { text: 'Δ —', color: '#dbe4ee' },
  tenantUtilizationTrendHtml: 'trend —',
  tenantUtilizationTrendColor: '#dbe4ee',
  tenantUtilizationRecovery: initialColor,
  star: '—',
  milestone: '—',
  waitingNow: initialColor,
  wait: initialColor,
  rate: initialColor,
  rep: initialColor,
  roomEval: initialColor,
  desirability: initialColor,
  desirabilityTrend: initialColor,
};

export const [hud, setHud] = createStore<HudState>(initial);
