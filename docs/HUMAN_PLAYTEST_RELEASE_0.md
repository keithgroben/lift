# Lift Release 0 human playtest

This is the gate for deciding whether the current build is understandable to a
new player. It is intentionally about the first tower loop only; do not test
post-beta features.

## Fresh-session test

Click `new session` beside the objective to start a fresh game, then leave it
at 1x unless a step says otherwise.

1. Without opening Developer Details or reading another document, identify the
   objective and the “DO THIS NOW” instruction.
2. Use the visible TIME controls to pause, resume, and speed up the simulation.
3. Choose `office`, click an upper-floor room slot, and confirm that the mode
   message explains what was placed.
4. Let the tower run through a rush. Explain what the `W` waiting badge and
   `T` tenant badge mean.
5. When W turns amber or red, follow the visible action. Select `+ car`, then
   click the highlighted shaft. Confirm that the car is added and that the
   message explains the new capacity.
6. Let the next rush run. Say whether delivery, reputation, and waiting make
   sense as the result of that intervention.
7. Select `+ shaft`. Hover a clear column, then click its top floor. Confirm
   that the preview shows the chosen column and that the new shaft is built
   there. Try a blocked column only if the warning is easy to understand.
8. Open Developer Details only after the player flow is complete. Confirm that
   the detailed transport and expansion diagnostics are still available.

## Pass criteria

- The player can describe the loop as: build space → people arrive → watch
  waiting → add capacity when needed → observe the result.
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
