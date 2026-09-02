/**
 * Saves. The question this file exists to answer is not "did the JSON come
 * back" — it is **does the resumed tower have the same future as the one that
 * was saved**. A snapshot that reloads with the right floor count and the
 * wrong rng cursor looks completely correct and plays a different game, so
 * the load-bearing test here steps both towers forward and compares the days
 * they produce.
 */
import { CONFIG } from '../src/games/lift/config.js';
import { boot, step } from '../src/games/lift/sim/index.js';
import { POLICIES } from '../src/games/lift/policies.js';
import {
  SAVE_SCHEMA, SAVE_VERSION, applyConfigPatch, configDiff, missingKeys,
  restore, shouldAutosave, snapshot, summarise,
} from '../src/games/lift/sim/save.js';

const assert = (c, m) => { if (!c) throw new Error(m); };

/** A tower with a real history: money spent, rooms let, tenants gone. */
function playedTower(days = 60, seed = 7, policy = 'skyscraper') {
  const config = structuredClone(CONFIG);
  const state = boot(config, seed);
  POLICIES[policy].open?.(state, config);
  while (state.day <= days && !state.over) {
    if (POLICIES[policy].tick && !state.busy) POLICIES[policy].tick(state, config);
    const closed = step(state, config.time.dt, config);
    if (closed) POLICIES[policy].decide?.(state, config);
  }
  return { state, config };
}

function advance(state, config, days, policy = 'skyscraper') {
  const target = state.day + days;
  while (state.day < target && !state.over) {
    if (POLICIES[policy].tick && !state.busy) POLICIES[policy].tick(state, config);
    const closed = step(state, config.time.dt, config);
    if (closed) POLICIES[policy].decide?.(state, config);
  }
}

/** A save written to a string and read back, the way a file or a slot works. */
const roundTrip = (blob) => JSON.parse(JSON.stringify(blob));

export const tests = {
  'a restored tower produces the same future as the one that was saved'() {
    const { state, config } = playedTower();
    assert(state.day > 30 && state.units.length > 5, 'fixture never grew a tower to save');

    const loaded = restore(roundTrip(snapshot(state, config)), config);
    assert(loaded.ok, 'a fresh save must load: ' + loaded.reason);

    // The saved copy and the original both walk forward under the same policy.
    // Identical logs is the only assertion that catches a lost rng cursor.
    advance(state, config, 40);
    advance(loaded.state, config, 40);

    assert(loaded.state.day === state.day, 'resumed tower ended on a different day');
    assert(
      JSON.stringify(loaded.state.log) === JSON.stringify(state.log),
      'the resumed tower diverged: it has the same shape and a different future',
    );
    assert(loaded.state.rng.seed === state.rng.seed, 'rng cursors drifted apart');
  },

  'the rng cursor travels, not the seed the tower started from'() {
    const { state, config } = playedTower(30);
    // Mid-run the cursor has moved a long way from the seed. A restore that
    // rebuilt the generator from `state.seed` would look right here and replay
    // the whole run's randomness from the beginning.
    assert(state.rng.seed !== state.seed, 'fixture never advanced the rng, so this proves nothing');

    const loaded = restore(roundTrip(snapshot(state, config)), config);
    assert(loaded.ok, loaded.reason);
    assert(loaded.state.rng.seed === state.rng.seed, 'restore did not carry the cursor');
    assert(loaded.state.rng.seed !== loaded.state.seed, 'restore reset the cursor to the seed');
    assert(loaded.state.rng.next() === state.rng.next(), 'the next draw differs, so the futures differ');
  },

  'a snapshot stops changing the moment it is taken'() {
    const { state, config } = playedTower(20);
    const blob = snapshot(state, config);
    const before = JSON.stringify(blob);

    // Everything the sim mutates in place: the arrays, the nested day stats,
    // and the ledger. A snapshot that aliased any of them would follow along.
    advance(state, config, 10);
    state.money = -999;
    state.units.push({ id: -1, kind: 'office' });
    state.today.movedIn = 4242;

    assert(JSON.stringify(blob) === before, 'the snapshot is a view of the live tower, not a copy');
  },

  'one save loaded twice gives two independent towers'() {
    const { state, config } = playedTower(20);
    const blob = roundTrip(snapshot(state, config));
    const a = restore(blob, config), b = restore(blob, config);
    assert(a.ok && b.ok, 'both loads must succeed');

    a.state.money = 1;
    a.state.units.push({ id: -1 });
    assert(b.state.money !== 1, 'two loads share the ledger');
    assert(b.state.units.length !== a.state.units.length, 'two loads share the room list');
    assert(blob.state.money !== 1, 'a load wrote back into the file it came from');
  },

  'a save that has lost any part of the tower is refused by name'() {
    const { state, config } = playedTower(15);
    const blob = snapshot(state, config);
    assert(missingKeys(blob.state, config).length === 0, 'a fresh snapshot must be complete');

    // Bounded and negated: EVERY top-level key the sim boots with has to be
    // detectable, not just the one that broke last time. This is what stops
    // the check rotting into a hand-maintained list.
    const keys = Object.keys(boot(structuredClone(CONFIG), 1)).filter((k) => k !== 'rng');
    assert(keys.length > 15, 'the reference tower has suspiciously few keys');
    for (const key of keys) {
      const damaged = roundTrip(blob);
      delete damaged.state[key];
      const result = restore(damaged, config);
      assert(!result.ok, 'a save missing "' + key + '" loaded anyway');
      assert(result.reason.includes(key), 'the refusal for "' + key + '" does not name it: ' + result.reason);
    }
  },

  'a save missing one of the day counters is refused before it crashes at midnight'() {
    const { state, config } = playedTower(15);
    const blob = roundTrip(snapshot(state, config));
    delete blob.state.today.movedIn;
    const result = restore(blob, config);
    assert(!result.ok, 'a save with a hollow day-stats block loaded');
    assert(result.reason.includes('today.movedIn'), 'the refusal does not name the counter: ' + result.reason);
  },

  'a save from another version of Lift is refused, in the direction it came from'() {
    const { state, config } = playedTower(10);
    const older = roundTrip(snapshot(state, config));
    older.version = SAVE_VERSION - 1;
    const olderResult = restore(older, config);
    assert(!olderResult.ok && /older version/.test(olderResult.reason), 'an older save loaded: ' + olderResult.reason);

    const newer = roundTrip(snapshot(state, config));
    newer.version = SAVE_VERSION + 1;
    const newerResult = restore(newer, config);
    assert(!newerResult.ok && /newer version/.test(newerResult.reason), 'a newer save loaded: ' + newerResult.reason);
    assert(newerResult.reason.includes('v' + (SAVE_VERSION + 1)), 'the refusal does not say which version wrote it');
  },

  'an action tape dropped on the loader is told what it actually is'() {
    const { state, config } = playedTower(10);
    const tape = { schema: 'lift-tape/v1', seed: state.seed, config, tape: [] };
    const result = restore(tape, config);
    assert(!result.ok, 'a tape loaded as a save');
    assert(/action tape/.test(result.reason), 'a tape is refused as generic junk: ' + result.reason);
  },

  'junk, and a save with no cursor, are refused rather than half-loaded'() {
    const { state, config } = playedTower(10);
    for (const junk of [null, undefined, 'a string', 42, []]) {
      assert(!restore(junk, config).ok, 'restore accepted ' + JSON.stringify(junk ?? null));
    }
    assert(!restore({ schema: SAVE_SCHEMA, version: SAVE_VERSION }, config).ok, 'a save with no tower loaded');

    const cursorless = roundTrip(snapshot(state, config));
    delete cursorless.rngSeed;
    const result = restore(cursorless, config);
    assert(!result.ok && /cursor/.test(result.reason), 'a cursorless save loaded: ' + result.reason);
  },

  'the tuning a tower was played at comes back with it, and is reported'() {
    const { state, config } = playedTower(10);
    // The dev knobs mutate the live config; a save taken after one has to
    // carry it, or the tower resumes into different physics.
    config.elevator.capacity = CONFIG.elevator.capacity + 5;
    config.units.office.rent = CONFIG.units.office.rent + 100;
    const blob = roundTrip(snapshot(state, config));

    const fresh = structuredClone(CONFIG);
    const loaded = restore(blob, fresh);
    assert(loaded.ok, loaded.reason);
    const paths = loaded.configPatch.map((c) => c.path).sort();
    assert(
      JSON.stringify(paths) === JSON.stringify(['elevator.capacity', 'units.office.rent']),
      'the patch did not name exactly the two changed knobs: ' + paths.join(', '),
    );

    applyConfigPatch(fresh, loaded.configPatch);
    assert(fresh.elevator.capacity === CONFIG.elevator.capacity + 5, 'the patch did not apply');
    assert(fresh.units.office.rent === CONFIG.units.office.rent + 100, 'the patch did not apply');
  },

  'a knob added since the save keeps today’s default, and one deleted stays deleted'() {
    const current = { a: 1, b: { c: 2 }, addedSince: 9 };
    const saved = { a: 1, b: { c: 5 }, goneNow: 3 };
    const patch = configDiff(current, saved);
    assert(patch.length === 1 && patch[0].path === 'b.c', 'diff read the wrong paths: ' + JSON.stringify(patch));

    applyConfigPatch(current, patch);
    assert(current.addedSince === 9, 'a knob the save predates was reset');
    assert(!('goneNow' in current), 'a save resurrected a knob this build deleted');
  },

  'a config array is one value, never half a table'() {
    const current = { stars: { tiers: [{ pop: 0 }, { pop: 100 }] } };
    const saved = { stars: { tiers: [{ pop: 0 }, { pop: 250 }] } };
    const patch = configDiff(current, saved);
    assert(patch.length === 1 && patch[0].path === 'stars.tiers', 'an array was walked into: ' + JSON.stringify(patch));
    applyConfigPatch(current, patch);
    assert(current.stars.tiers[1].pop === 250 && current.stars.tiers.length === 2, 'the table was not replaced whole');
  },

  'the row a save draws in the list matches the tower inside it'() {
    const { state, config } = playedTower(40);
    const blob = roundTrip(snapshot(state, config));
    const live = summarise(state, config);
    assert(blob.summary.day === state.day, 'the summary day disagrees with the tower');
    assert(blob.summary.floors === state.floors, 'the summary floor count disagrees');
    assert(blob.summary.money === state.money, 'the summary ledger disagrees');
    assert(blob.summary.population === live.population, 'the summary population disagrees');
    assert(typeof blob.summary.star === 'string' && blob.summary.star.length > 0, 'the summary has no star rating');
    assert(blob.schema === SAVE_SCHEMA, 'the save does not declare its schema');
  },

  'the action tape rides along with the snapshot'() {
    const { state, config } = playedTower(10);
    const tape = [{ day: 1, tod: 0.1, type: 'build_lobby' }];
    const blob = roundTrip(snapshot(state, config, { tape, name: 'first tower' }));
    assert(blob.name === 'first tower', 'the save lost its name');
    assert(JSON.stringify(blob.tape) === JSON.stringify(tape), 'the save lost the tape');
    tape.push({ day: 2, type: 'build_shaft' });
    assert(blob.tape.length === 1, 'the save aliased the live tape');
  },

  'the autosave waits for the tower AND for the player'() {
    const base = { day: 10, now: 100000, lastSavedDay: 9, lastSavedAt: 99000, minDays: 1, minMs: 20000 };
    assert(shouldAutosave({ ...base, lastSavedDay: null }), 'the first autosave of a session must fire');
    assert(!shouldAutosave(base), 'a day passed but only a second of wall clock did');
    assert(shouldAutosave({ ...base, lastSavedAt: 70000 }), 'a day and twenty seconds passed and nothing saved');
    assert(!shouldAutosave({ ...base, day: 9, lastSavedAt: 0 }), 'a paused game autosaved the same day again');
    assert(!shouldAutosave({ ...base, day: NaN }), 'a nonsense day autosaved');
  },
};
