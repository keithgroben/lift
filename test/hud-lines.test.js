import { CONFIG } from '../src/games/lift/config.js';
import { appealWhyLine, weekLossPattern, LOSS_PATTERN_DAYS } from '../src/games/lift/ui/hud/lines.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

const [, , GOOD, WARN, BAD, INFO] = CONFIG.feel.palette;

/**
 * A tower tall enough that the retention threshold has finished ramping, with
 * one occupied office and no services — the state issue #11 was written about.
 */
function towerWithOneRoom(overrides = {}) {
  const config = structuredClone(CONFIG);
  const floors = config.occupancy.desirabilityRetentionRampFloors + 2;
  return {
    config,
    state: {
      floors,
      units: [{
        id: 1, kind: 'office', floor: 3, slot: 1, heads: 6, occupied: true,
        stress: 0, desirabilityPressure: 0.8, rent: config.units.office.rent, ...overrides,
      }],
      facilities: [],
      shafts: [{ id: 10, bottom: 0, top: 3, slot: 0, cars: [] }],
      stairs: [], escalators: [], lobby: null, people: [], log: [],
    },
  };
}

const daysOfLosses = (entries) => ({ log: entries.map((entry, index) => ({ day: index + 1, ...entry })) });

export const tests = {
  /**
   * Issue #11's whole point: the score is meaningless alone, because
   * `retentionThresholdFor()` ramps the bar with the tower's height. The line
   * must carry both numbers, the one cause the sim ranked highest, its penalty,
   * and the action — in one line.
   */
  'the appeal line names the score, what the tower is held to, the cause and the fix'() {
    const { state, config } = towerWithOneRoom();
    const line = appealWhyLine(state, state.units[0], config);

    assert(line.text.startsWith('F3 office · appeal '), 'the line does not identify the room it is about');
    const [, score, expected] = line.text.match(/appeal (\d+) · expected (\d+)/) ?? [];
    assert(score != null && expected != null, 'the line does not carry both the score and the expected value');
    assert(Number(expected) > 0, 'the expected value is not a real threshold');
    assert(line.text.includes('no food service within 1 floor (−'),
      'the line does not name the largest cause with its reach: ' + line.text);
    assert(/\(−\d+\)/.test(line.text), 'the cause carries no penalty');
    assert(line.text.endsWith(' · add food service'), 'the line does not end in an action: ' + line.text);
    assert(!line.text.includes('\n'), 'the answer is not one line');
    assert(line.color === BAD, 'a room below its retention threshold does not read as failing');
  },

  /**
   * The same room, same score, in a shorter tower: the threshold is lower, so
   * the line must say something different. This is the assertion that would
   * have caught showing the score alone.
   */
  'the expected value moves with the tower, and the line moves with it'() {
    const tall = towerWithOneRoom();
    const tallLine = appealWhyLine(tall.state, tall.state.units[0], tall.config);

    const short = towerWithOneRoom();
    short.state.floors = 1;
    const shortLine = appealWhyLine(short.state, short.state.units[0], short.config);

    const at = (line) => Number(line.text.match(/expected (\d+)/)[1]);
    const scored = (line) => Number(line.text.match(/appeal (\d+)/)[1]);
    assert(scored(tallLine) === scored(shortLine), 'the fixture changed the room, not just the tower');
    assert(at(shortLine) < at(tallLine), 'the expected value does not ramp with the tower height');
    assert(shortLine.color !== BAD && tallLine.color === BAD,
      'the same appeal reads the same in a tall tower and a short one');
  },

  'a fixed room stops being told to fix it'() {
    const { state, config } = towerWithOneRoom();
    state.facilities = [
      { kind: 'food', floor: 3, slot: 2 },
      { kind: 'parking', floor: 3, slot: 3 },
      { kind: 'medical', floor: 3, slot: 4 },
      { kind: 'security', floor: 3, slot: 5 },
      { kind: 'recycling', floor: 3, slot: 6 },
    ];
    const line = appealWhyLine(state, state.units[0], config);
    assert(!line.text.includes('no food service'), 'a covered room is still told it has no food: ' + line.text);
    assert(line.color !== BAD, 'a covered room still reads as failing');
  },

  'a vacant room says so rather than naming a cure for a tenant it does not have'() {
    const { state, config } = towerWithOneRoom({ occupied: false });
    const line = appealWhyLine(state, state.units[0], config);
    assert(line.text.includes('appeal ') && line.text.includes('expected '),
      'a vacant room loses its appeal reading');
    assert(line.text.endsWith('vacant, no tenant to lose'), 'a vacant room is given a retention action: ' + line.text);
    assert(line.color === INFO, 'a vacant room reads as an alarm');
    assert(appealWhyLine(state, null, config) === null, 'pointing at nothing still says something');
  },

  /**
   * Issue #12. One room leaving is noise; three is a lesson — and the two
   * causes take different money, so they must not read the same.
   */
  'the week of losses reads as a pattern, and the two causes read differently'() {
    const appeal = weekLossPattern(daysOfLosses([
      { vacatedByDesirability: 1, vacatedByStress: 0 },
      { vacatedByDesirability: 2, vacatedByStress: 0 },
    ]), CONFIG);
    const transport = weekLossPattern(daysOfLosses([
      { vacatedByDesirability: 0, vacatedByStress: 3 },
    ]), CONFIG);

    assert(appeal.text === '3 rooms lost this week — room appeal', 'appeal exits do not read as appeal: ' + appeal.text);
    assert(transport.text === '3 rooms lost this week — slow lifts', 'transport exits do not read as transport: ' + transport.text);
    assert(appeal.text !== transport.text, 'the two causes read the same');
    assert(appeal.title.includes('services, rent, and noise'), 'the appeal case does not point at appeal money');
    assert(transport.title.includes('cars, shafts'), 'the transport case does not point at transport money');
    assert(appeal.color === BAD && transport.color === BAD, 'three losses in a week do not read as a lesson');
  },

  'one loss is noise, and a mixed week names both counts'() {
    const one = weekLossPattern(daysOfLosses([{ vacatedByDesirability: 1, vacatedByStress: 0 }]), CONFIG);
    assert(one.text === '1 room lost this week — room appeal', 'a single loss is misphrased: ' + one.text);
    assert(one.color === WARN, 'a single loss reads as loudly as a pattern');

    const mixed = weekLossPattern(daysOfLosses([{ vacatedByDesirability: 2, vacatedByStress: 1 }]), CONFIG);
    assert(mixed.text === '3 rooms lost this week — 2 room appeal · 1 slow lifts',
      'a mixed week hides one of its causes: ' + mixed.text);
  },

  'the pattern is silent with nothing to report, and bounded to a week'() {
    assert(weekLossPattern({ log: [] }, CONFIG) === null, 'an empty log still says something');
    assert(weekLossPattern(daysOfLosses([{ vacatedByDesirability: 0, vacatedByStress: 0 }]), CONFIG) === null,
      'a clean week still says something');
    assert(weekLossPattern({}, CONFIG) === null, 'a state with no log throws or speaks');

    // Older days must fall out of the window, or "this week" becomes "ever".
    const old = daysOfLosses([
      ...Array.from({ length: LOSS_PATTERN_DAYS }, () => ({ vacatedByDesirability: 0, vacatedByStress: 0 })),
    ]);
    old.log.unshift({ day: 0, vacatedByDesirability: 9, vacatedByStress: 0 });
    assert(weekLossPattern(old, CONFIG) === null, 'a loss older than the window is still counted as this week');
  },
};
