# Lift WIP handoff

Updated: 2026-08-27

## Current state

Lift is a human-first tower-management prototype inspired by SimTower. The
active release is **Release 0 — playable alpha: learn the tower**. The game is
not yet a playable beta for an uncoached human; do not start post-beta feature
work until the Release 0 and Release 1 gates pass.

## What is in this WIP

- Player-first HUD with objective, next action, compact metrics, and visible
  primary build controls.
- Developer details hidden behind a toggle.
- First-session guidance, contextual build prompts, and a repeatable `new
  session` flow.
- Explicit shaft placement: the opening shaft is on the far left; new shafts
  require choosing a column before confirming.
- Elevator-car placement requires choosing the car action and then a shaft.
- Room, tenant, waiting, reputation, and desirability explanations in the
  player HUD, including color and stress-line keys.
- Visible time controls: `pause`, `1x`, `4x`, and `12x`; Space also toggles
  pause.
- Safe runtime guard: the page opens paused, visual rendering is capped at
  30 FPS, and expensive live sidebar refreshes are throttled to 200 ms.
- Player and developer documentation in `docs/`.
- Regression coverage for simulation behavior and player-facing UI contracts.

## Verification

Run from the repository root:

```text
npm run test
```

The last verified run passed 247 tests. Start the local game with:

```text
npm run play
```

Then open `/src/games/lift/index.html` on the local server.

## Next task

Follow [`docs/HUMAN_PLAYTEST_RELEASE_0.md`](docs/HUMAN_PLAYTEST_RELEASE_0.md)
with a fresh human session. Record whether a new player can complete the first
loop without verbal coaching. Update `ROADMAP.md` only from that observation;
the current Release 0 human-playtest item is intentionally still unchecked.

## Orientation

- Product roadmap: [`ROADMAP.md`](ROADMAP.md)
- Player instructions: [`docs/HOW_TO_PLAY.md`](docs/HOW_TO_PLAY.md)
- Rules: [`docs/RULES.md`](docs/RULES.md)
- Developer diagnostics: [`docs/DEVELOPER_MODE.md`](docs/DEVELOPER_MODE.md)
- Preserved implementation history: [`docs/roadmaps/ROADMAP-history-steps-001-561.md`](docs/roadmaps/ROADMAP-history-steps-001-561.md)
