import { createStore } from 'solid-js/store';

/**
 * Bridge between the imperative game loop (still `ui/app.js`, still the
 * source of truth for `state`) and the Solid HUD. `app.js` pushes computed
 * values in here via `setHud(...)` wherever it used to write `els[x] = ...`;
 * Solid components read `hud` reactively. One-way, one object, so migrating
 * a panel is: replace its `els[...]` writes with a `setHud` call, delete its
 * static markup, mount a component in its place.
 *
 * Two components read this store now, and which one a field lands in is the
 * whole point of issue #13: `TopBar` carries what a player needs at a glance
 * and must never scroll; `StatBar` carries the rest, behind the `D` toggle.
 * Adding a field here does not decide that — the component does.
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
  /** `hh:mm`, pushed from the clock's own rAF loop rather than from refresh(). */
  clock: string;
  /** 'MORNING RUSH' | 'LUNCH' | 'EVENING RUSH' | '' — empty means no rush. */
  rush: string;
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
  /**
   * Issue #11. One line for the hovered or selected room: its appeal, what
   * THIS tower is being held to, and the single largest cause with its
   * penalty. Empty text means no room is under the cursor — the slot then
   * says nothing rather than standing there with a dash in it.
   */
  appealWhy: HudColor;
  /**
   * Issue #12. The week's pattern, not today's event: how many rooms were
   * lost over the last seven closed days and which cause dominated. Empty
   * text means nothing has been lost, which is the normal state.
   */
  weekPattern: HudColor;
}

const initialColor: HudColor = { text: '—', color: '#dbe4ee' };
const emptyColor: HudColor = { text: '', color: '#dbe4ee' };

const initial: HudState = {
  money: initialColor,
  day: '—',
  clock: '--:--',
  rush: '',
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
  appealWhy: emptyColor,
  weekPattern: emptyColor,
};

export const [hud, setHud] = createStore<HudState>(initial);
