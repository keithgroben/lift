# Lift Release 0 human playtest

This is the gate for deciding whether the current build is understandable to a
new player. It is intentionally about the first tower loop only; do not test
post-beta features.

## Fresh-session test

Click `new session` beside the objective to start a fresh game, then leave it
at 1x unless a step says otherwise.

1. Without opening Developer Details or reading another document, identify the
   objective and the “DO THIS NOW” instruction. The tower starts as an empty
   lot with the `lobby` tool already armed.
2. Click the ground floor to place the entrance, and confirm the message
   explains that it bought the storey it stands on.
3. Use the visible TIME controls to pause, resume, and speed up the simulation.
4. Choose `office` and click the row above the lobby. Confirm the room raised
   its own storey, and that the tool stays armed between clicks.
5. Click a second room slot on that storey and confirm the mode message
   explains what was placed, without returning to the palette.
6. Let the tower run through a rush. Without opening Developer Details,
   read `waiting`, `delivered`, and `reputation` off the top bar and explain
   what each one means.
6a. Point at a room and read the appeal line under the bar aloud. Say which
   number is the room's score, which is what the tower is held to, and what
   the named cause would cost to fix.
7. When W turns amber or red, follow the visible action. Select `car`, then
   click the highlighted shaft. Confirm that the car is added and that the
   message explains the new capacity.
8. Let the next rush run. Say whether delivery, reputation, and waiting make
   sense as the result of that intervention.
9. Select `shaft`. Hover a clear column, then click its top floor. Confirm
   that the ghost shows the chosen column and that the new shaft is built
   there. Hover a blocked column and read the reason the ghost gives.
10. Press `Esc` and confirm the tool is put away and the tower reads as
    `WATCHING`.
11. Open Developer Details only after the player flow is complete. Confirm that
    the detailed transport and expansion diagnostics are still available.

## Pass criteria

- The player places the lobby on the first click without being told to.
- The player can describe the loop as: build space → people arrive → watch
  waiting → add capacity when needed → observe the result.
- The player reads a red ghost and can say why the thing will not go there.
- The player completes the car intervention without verbal coaching.
- The player understands that a shaft requires a column choice and a top-floor
  choice before construction.
- The player does not need to scroll continuously to find the next action.
- The player can name at least one cause of a red or amber signal.

## Record the result

- Date/build:
- Tester:
- First confusion:
- Action that was difficult to find:
- Signal that was unclear:
- Did the tester complete the loop without coaching? Yes / No
- Did the tester understand shaft placement? Yes / No
- Release 0 result: Pass / Needs another UI pass

Any “No” result is a UI task for Release 0. Do not move on to mixed-use,
long-term economy, or other post-beta work until the first loop passes.
