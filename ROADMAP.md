# Lift release roadmap

## Product goal

Lift is a human-first tower-management game inspired by SimTower. The player
builds rentable spaces, watches people move through the building, and solves
the problems that make tenants leave. Elevator throughput is the first deep
system, not the whole user experience.

## Current truth

The simulation has more systems than the interface can teach. The current
build is not yet a playable beta for a new human player. The former
step-by-step roadmap is preserved at
[`docs/roadmaps/ROADMAP-history-steps-001-561.md`](docs/roadmaps/ROADMAP-history-steps-001-561.md)
for implementation history and developer reference.

No post-beta feature work is active until Release 0 and Release 1 pass their
human-playability gates.

## Release 0 — playable alpha: learn the tower

Purpose: a new player can look at the game and understand what to do without
reading the developer sidebar.

Ship gate:

- The screen has one obvious player objective and one obvious next action.
- Core status fits in a compact, glanceable player HUD without repeated
  scrolling.
- A player can learn the loop: build space → people arrive → transport gets
  busy → improve the problem → tenants stay.
- The first elevator is visibly on the far-left service column.
- Choosing `+ shaft` enters a placement mode with a visible column preview;
  the player decides where the new shaft goes before confirming it.
- A player can tell what money, tenants, waiting, reputation, and desirability
  mean from the interface itself.
- A short “How to play” document exists, but the first session does not depend
  on opening it.

Release 0 work, in order:

1. [x] Player-first information architecture and compact HUD.
2. [x] Developer mode toggle for the full diagnostic sidebar.
3. [x] Clear first-session objective card and contextual next-action prompts.
4. [x] Explicit shaft-column placement and left-side initial shaft treatment.
5. [x] Top-of-screen recommended action shortcut that opens the matching build
   flow without requiring sidebar scrolling.
6. [x] Move the primary build controls directly below first-session guidance so
   room and transport actions are visible before telemetry.
7. [x] Add a plain-language key for waiting, tenants, delivery, reputation, and
   desirability beside the objective.
8. [x] Start the first session in a neutral watch state so the player cannot
   accidentally place a room before choosing a build action.
9. [x] Return to the neutral watch state after a transport intervention so the
   player observes the result instead of being armed to build another room.
10. [x] Add a confirmed `new session` control beside the objective so the first
    loop can be replayed without knowing a keyboard shortcut.
11. [x] Add a visible `cancel action` escape from room, route, and car placement
    modes without changing the tower.
12. [x] Explain room type colors, low-appeal red fade, and tenant-stress lines
    directly in the player HUD.
13. [ ] Human playtest pass: observe a new player completing the first loop without
   verbal coaching.

### Blocking Release 0: the tower view

Keith's ruling, 2026-08-31: **the loop cannot be finished while the UI is the
way it is**, so item 13 cannot be run honestly yet. Full spec in
[`spec/tower-view.md`](spec/tower-view.md); in short:

- [x] Camera — fixed 48×32 world scale, click-and-drag panning, integer zoom
      steps, all picking through the inverse transform. A slot is 48×32 px at
      1× no matter how tall the tower gets, and only the floors in view are
      painted.
- [x] Ground line and street under floor 0.
- [x] Lobby-first opening: `startFloors: 0`, palette reordered so the first
      click of a new game places the entrance, not a floor.
- [x] Build palette — arm a tool, ghost-preview it in the world with the
      reason it cannot land, confirm, stay armed for the next placement.
- [x] Underground floors `B1..B10` as a sim floor *range*, with cheaper,
      less appealing slots, services that belong down there, and shafts that
      must be extended to reach them. Depth and dig cost came from sweeps
      (`config.underground`), and the view, the palette's `dig` tool and the
      minimap all speak the range.
- [x] Minimap strip, SimTower-style: the whole tower in miniature, one row
      per floor, a box showing the current view, click or drag to jump.
- [x] The art: 28 native-size sheets, sidecars generated from
      `tools/sprite-catalog.json`, and a renderer seam that falls back to the
      old rectangle whenever a sheet is missing or broken. Rooms, the lobby,
      the street and the earth draw from art now.
- [ ] `palette-icons.png` redo — the delivered strip came back in a different
      style with a different tool list (no floor, shaft or car). The tiles
      carry text placeholders until it lands.
- [ ] **Then** the recorded playthrough, and the loop balance pass it feeds.
- [ ] **Only then** the developer sidebar comes out and its numbers move
      in-world. Deliberately gated on the playthrough, not on a date.

## Release 1 — closed beta: manage a small tower

Purpose: the first management loop is understandable, recoverable, and worth
repeating.

Ship gate:

- Build lobby, floor, room, shaft, and elevator car with visible cost and
  affordability.
- Read waiting pressure, tenant load, elevator delivery, stress, room appeal,
  desirability, and reputation in plain language.
- Add an elevator car in two clear steps: choose car, then choose shaft.
- See why a room is unhealthy and make a valid recovery choice.
- Place a required service and understand which rooms/floors it covers.
- A failed or abandoned room can be inspected and recovered, converted,
  renovated, re-rented, or demolished when the rules allow it.
- A fresh human session reaches a meaningful next goal without needing the
  developer diagnostics.

Release 1 will not be called ready from automated tests alone. It requires a
recorded human playtest plus the deterministic suite and a clean live browser
run.

## Release 2 — SimTower foundation: mixed-use demand

Only begin after Release 1 is human-playable.

- Distinct offices, shops, condos, and hotels with understandable tenant
  needs.
- Services that create meaningful floor-planning tradeoffs.
- Desirability/reputation that affects demand without hiding the cause.
- Multiple shafts and local routes that make placement topology matter.
- A stable small-tower economy with measured expansion pacing.

## Release 3 — tower expansion

Only begin after the mixed-use foundation is enjoyable and legible.

- Express/local elevator structure and transfer floors.
- More building zones and neighborhood-facing demand.
- Longer progression, events, and richer SimTower-style content.

## Working rules

1. One player-facing feature at a time.
2. Every feature gets a visible explanation and either a regression test or a
   measured human-play scenario.
3. Keep simulation rules in the pure simulation layer; keep presentation in
   the UI/renderer layer.
4. Preserve the full diagnostics, but do not make players parse them to play.
5. Do not tune or add post-beta content while a Release 0 or Release 1 gate is
   failing.

## Active work

Release: 0 — playable alpha.

Completed in the current pass: the player HUD now leads with the objective,
next action, compact first-session guidance, a plain-language metric key, a
top-of-screen shortcut for the current transport response, and primary build
controls before telemetry. Detailed
transport diagnostics, the legend, tuning knobs, and keyboard reference are
behind the developer-mode control. Player docs are linked from the objective.
The zero-dependency UI contract suite now protects these player-facing
invariants alongside the simulation tests, and `new session` makes the human
playtest loop repeatable without a hidden keyboard shortcut. Placement modes
also have an explicit cancel path back to `WATCHING`, and room colors now have a
player-facing explanation.

Current task: human-playtest Release 0. The simulation honors an explicit
shaft column, the UI previews it and requires that choice, and the opening
shaft is fixed to the leftmost clear column. Automated and fresh-browser
checks pass. A live first-session run also now transitions from “watch the
next rush” during a quiet period to “select + car” when W turns amber. A new
player still needs to complete the first loop without verbal coaching before
this becomes a playable beta candidate.

Playtest procedure: [`docs/HUMAN_PLAYTEST_RELEASE_0.md`](docs/HUMAN_PLAYTEST_RELEASE_0.md).
