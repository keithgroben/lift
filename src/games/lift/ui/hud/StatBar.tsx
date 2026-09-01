import { hud } from './store';

/**
 * The telemetry column, now behind the `D` toggle (issue #13). What a player
 * reads at a glance moved to `TopBar`; what is read while inspecting the
 * simulation stayed here — utilization and its trend, the historical wait,
 * room evaluation, tower desirability. It is the instrument the balance work
 * is done with, so nothing was deleted on the way across, only relocated.
 *
 * Markup, ids, and classes are unchanged from the static HTML this replaced,
 * so the existing `<style>` block in index.html still applies without edits.
 */
export function StatBar() {
  return (
    <>
      <div class="stat">
        <span>tenants / capacity</span>
        <b>
          <span
            id="tenant-total"
            style={{ color: hud.tenantTotal.color }}
            title={hud.tenantTotal.title}
            aria-label={hud.tenantTotal.ariaLabel}
          >
            {hud.tenantTotal.text}
          </span>
          <small id="tenant-utilization" style={{ color: hud.tenantUtilization.color }} title={hud.tenantUtilization.title}>
            {hud.tenantUtilization.text}
          </small>
          <small
            id="tenant-utilization-change"
            style={{ color: hud.tenantUtilizationChange.color }}
            title={hud.tenantUtilizationChange.title}
          >
            {hud.tenantUtilizationChange.text}
          </small>
          <small
            id="tenant-utilization-trend"
            style={{ color: hud.tenantUtilizationTrendColor }}
            title="recent utilization, oldest to newest; taller bars mean more occupied capacity"
            innerHTML={hud.tenantUtilizationTrendHtml}
          />
          <small
            id="tenant-utilization-recovery"
            style={{ color: hud.tenantUtilizationRecovery.color }}
            title={hud.tenantUtilizationRecovery.title}
          >
            {hud.tenantUtilizationRecovery.text}
          </small>
        </b>
      </div>
      <div class="metric-key" aria-label="headline metric key">
        <b>W</b> waiting people · <b>T</b> tenants / capacity<br />
        <b>W</b>: <span class="diag-good">green 0 clear</span> · <span class="diag-warn">amber 1–11 watch/busy</span> · <span class="diag-bad">red 12+ critical</span><br />
        <b>T</b>: <span class="diag-good">green 75%+ full</span> · <span class="diag-warn">amber 50–74% partial</span> · <span class="diag-bad">red &lt;50% light</span><br />
        route focus: <span style={{ color: '#ffcf55' }}>yellow outline = selected shaft route</span> · <span class="diag-bad">red dashed outline = no assigned shaft</span>
      </div>
      <div class="stat"><span>avg wait</span><b id="wait" style={{ color: hud.wait.color }} title={hud.wait.title}>{hud.wait.text}</b></div>
      <div class="stat"><span>room eval</span><b id="eval" style={{ color: hud.roomEval.color }}>{hud.roomEval.text}</b></div>
      <div class="stat">
        <span>desirability</span>
        <b>
          <span
            id="desirability"
            style={{ color: hud.desirability.color }}
            title={hud.desirability.title}
            aria-label={hud.desirability.ariaLabel}
          >
            {hud.desirability.text}
          </span>
          <small id="desirability-trend" style={{ color: hud.desirabilityTrend.color }} title={hud.desirabilityTrend.title}>
            {hud.desirabilityTrend.text}
          </small>
        </b>
      </div>
    </>
  );
}
