import { Show } from 'solid-js';
import { hud } from './store';

/**
 * The player HUD (issue #13). Fixed across the top, never scrolls, and carries
 * only what a decision is made from at a glance:
 *
 *   identity — star, money, day/clock/rush, population
 *   signals  — waiting, delivery, reputation
 *
 * Everything else lives behind the `D` toggle. The rule for adding anything
 * here is the one Keith's complaint came from: if it is read while inspecting
 * one thing rather than while playing, it does not belong in the bar.
 *
 * The context row underneath carries the three lines that are about the tower
 * rather than about a number: the hovered room's appeal cause (#11), the
 * week's tenant-loss pattern (#12), and the next star milestone. Each is one
 * line, and each is silent when it has nothing to say.
 */

function Readout(props: { label: string; value: string; color?: string; title?: string; ariaLabel?: string }) {
  return (
    <div class="hud-readout" title={props.title}>
      <span class="hud-label">{props.label}</span>
      <b class="hud-value" style={{ color: props.color ?? '#dbe4ee' }} aria-label={props.ariaLabel}>{props.value}</b>
    </div>
  );
}

export function TopBar() {
  return (
    <>
      <div class="hud-group hud-group-identity">
        <Readout label="rating" value={hud.star} title={hud.milestone} />
        <Readout label="money" value={hud.money.text} color={hud.money.color} />
        <div class="hud-readout hud-readout-time" title="day, time of day, and the rush window in progress">
          <span class="hud-label">day {hud.day}</span>
          <b class="hud-value">
            <span id="clock-time">{hud.clock}</span>
            <Show when={hud.rush}><span class="hud-rush">{hud.rush}</span></Show>
          </b>
        </div>
        <Readout label="population" value={hud.population} />
      </div>

      {/* The three signals a build decision is actually made from. Kept in one
          group, separated from the identity numbers, because they are read
          together: a queue that is growing while delivery falls and reputation
          follows is one story, not three readings. */}
      <div class="hud-group hud-group-signals" aria-label="decision signals">
        <Readout
          label="waiting"
          value={hud.waitingNow.text}
          color={hud.waitingNow.color}
          title={hud.waitingNow.title}
          ariaLabel={hud.waitingNow.ariaLabel}
        />
        <Readout label="delivered" value={hud.rate.text} color={hud.rate.color} title="share of trips completed on the last closed day" />
        <Readout label="reputation" value={hud.rep.text} color={hud.rep.color} title="recent transport reliability; replacement tenants read this" />
      </div>
    </>
  );
}

/**
 * The second bar row. Separate export because it is mounted separately: it sits
 * under the readouts and spans the full width, so a sentence has room to be a
 * sentence.
 */
export function ContextLine() {
  return (
    <>
      <div class="hud-context-why" title={hud.appealWhy.title}>
        <Show when={hud.appealWhy.text}>
          <span style={{ color: hud.appealWhy.color }}>{hud.appealWhy.text}</span>
        </Show>
      </div>
      <div class="hud-context-pattern" title={hud.weekPattern.title}>
        <Show when={hud.weekPattern.text}>
          <span style={{ color: hud.weekPattern.color }}>{hud.weekPattern.text}</span>
        </Show>
      </div>
      <div class="hud-context-milestone" title="the next star rating and what it takes">{hud.milestone}</div>
    </>
  );
}
