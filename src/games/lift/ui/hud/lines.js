import { tenantRetentionPressure, tenantRetentionRecommendation, unitEvaluation } from '../../sim/evaluation.js';

/**
 * The two sentences the HUD says (issues #11 and #12).
 *
 * They live here rather than in `app.js` because they are pure — state and
 * config in, one line of text out, no DOM — and a sentence a player is meant to
 * act on deserves a test that reads the sentence, not one that reads the source
 * that builds it. Nothing in here decides anything: every number and every
 * ranking already exists in `sim/`, and this only reads the answer out.
 */

const palette = (config) => {
  const [, , good, warn, bad, info] = config.feel.palette;
  return { good, warn, bad, info };
};

const SERVICE_CAUSE_LABEL = {
  food: 'food service',
  parking: 'parking',
  medical: 'medical service',
  security: 'security',
  recycling: 'recycling',
};

/**
 * The largest cause, phrased for a player. The KEY comes from the sim's own
 * ranking — this never re-ranks — and the number beside it is the same
 * evaluation field the sim's detail sentence quotes.
 */
export function appealCauseText(unit, recommendation, evaluation, config) {
  if (!recommendation) return null;
  switch (recommendation.key) {
    case 'service': {
      const reach = config.services[recommendation.kind]?.coverageFloors ?? 0;
      return 'no ' + (SERVICE_CAUSE_LABEL[recommendation.kind] ?? recommendation.kind) +
        ' within ' + reach + ' floor' + (reach === 1 ? '' : 's') + ' (−' + recommendation.penalty + ')';
    }
    case 'noise': return 'noise from nearby uses (−' + evaluation.noisePenalty + ')';
    case 'rent': return 'rent above the room baseline (−' + Math.abs(evaluation.rentAdjustment) + ')';
    case 'floor_fit': return 'wrong floor for a ' + unit.kind + ' (−' + evaluation.preferencePenalty + ')';
    case 'renovation': return 'no single cause dominates';
    default: return 'holding above the retention line';
  }
}

/**
 * Issue #11. `tenantRetentionRecommendation()` already ranks the causes of a
 * room's appeal problem and names the largest one with its penalty attached —
 * and nothing read it out, which is how the answer stayed buried. One line, on
 * hover or select, never a panel:
 *
 *   F3 office · appeal 21 · expected 30 — no food service within 1 floor (−12) · add food service
 *
 * The expected half is load-bearing. `retentionThresholdFor()` ramps the
 * threshold with the tower's height, so 21 on its own says nothing: a player
 * needs to see what THIS building is being held to.
 */
export function appealWhyLine(state, unit, config) {
  if (!unit) return null;
  const { good, warn, bad, info } = palette(config);
  const pressure = tenantRetentionPressure(state, unit, config);
  if (pressure.score == null) return null;
  const head = 'F' + unit.floor + ' ' + unit.kind + ' · appeal ' + Math.round(pressure.score) +
    ' · expected ' + Math.round(pressure.threshold);
  if (!unit.occupied) {
    return {
      text: head + ' — vacant, no tenant to lose',
      color: info,
      title: 'A vacant room is not under retention pressure; re-rent it from the room panel.',
    };
  }
  const recommendation = tenantRetentionRecommendation(state, unit, config);
  const cause = appealCauseText(unit, recommendation, unitEvaluation(state, unit, config), config);
  const action = recommendation && recommendation.key !== 'monitor' ? ' · ' + recommendation.label : '';
  const below = pressure.score < pressure.threshold;
  return {
    text: head + (cause ? ' — ' + cause : '') + action,
    // Amber while the room is close enough to the line that one more storey can
    // push it under: the threshold ramps as the tower grows.
    color: below ? bad : pressure.score < pressure.threshold + 10 ? warn : good,
    title: recommendation?.detail ??
      'Expected is the retention threshold for a tower this tall; it rises as the building grows.',
  };
}

/** How many closed days "this week" covers. */
export const LOSS_PATTERN_DAYS = 7;

/**
 * Issue #12. One room leaving is noise; three is a lesson. The day log keeps
 * `vacatedByStress` apart from `vacatedByDesirability`, and the two need
 * different answers — a player losing tenants to slow lifts and a player losing
 * them to a bare building must not be told the same thing.
 */
export function weekLossPattern(state, config) {
  const { warn, bad } = palette(config);
  const week = (Array.isArray(state?.log) ? state.log : []).slice(-LOSS_PATTERN_DAYS);
  let appeal = 0;
  let stress = 0;
  for (const day of week) {
    appeal += Number(day?.vacatedByDesirability) || 0;
    stress += Number(day?.vacatedByStress) || 0;
  }
  const total = appeal + stress;
  if (total === 0) return null;
  const cause = appeal && stress ? appeal + ' room appeal · ' + stress + ' slow lifts'
    : appeal ? 'room appeal' : 'slow lifts';
  const advice = appeal >= stress
    ? 'Appeal exits answer to services, rent, and noise — select a room for the largest cause.'
    : 'Transport exits answer to cars, shafts, and local routes, not to room quality.';
  return {
    text: total + ' room' + (total === 1 ? '' : 's') + ' lost this week — ' + cause,
    // One is noise, three is a lesson.
    color: total >= 3 ? bad : warn,
    title: 'Over the last ' + week.length + ' closed day' + (week.length === 1 ? '' : 's') + ': ' +
      appeal + ' left over room appeal, ' + stress + ' left over transport stress. ' + advice,
  };
}
