# Lift — agent brief

A prototyping rig for **throughput games**: the genre where the player is a
logistics bottleneck and the game is about seeing and widening it. SimTower,
Melvor, Particle Fleet, tower defense, incremental trees. The first slice is
SimTower's real mechanic — elevator throughput.

This file is the only agent-instruction file in the repo. Do not create
`AGENTS.md`.

## The one architectural rule

**The sim is pure. The renderer is disposable.**

- `src/sim/**` must run in Node with no stubs, no DOM, no `Math.random`.
  A test enforces both. If you break this, the headless harness dies and the
  entire point of the repo goes with it.
- `src/render/**` and `src/ui/**` read state and draw. They never mutate sim
  state. Anything in `config.feel` is theirs; nothing else is.
- Every state change goes through `applyAction()` — human clicks and autoplayer
  decisions use the identical seam. That is what makes replay work.

## Where you may work, by blast radius

| Path | Freedom |
|---|---|
| `src/config/` | **Free.** Data only. Tune anything, always. This is the intended playground. |
| `harness/policy.js` | **Free.** Policies are experiments, not game code. Add as many as you like. |
| `spec/` | **Free.** Loop teardowns are research. More is better. |
| `src/render/`, `src/ui/` | **Open.** Feel, readability, juice. Cannot affect outcomes. |
| `src/sim/` | **Careful.** Changes the game. Add a test with the change. |
| `test/` | **Careful.** Never weaken an assertion to make a run pass. |

## Commands

```bash
npm test                        # 9 invariant + determinism tests, zero deps
npm run play                    # http://localhost:5173
node harness/run.js naive 40 1  # one run: policy, days, seed -> table + out/run-*.json
node harness/sweep.js 60 5      # all policies x 5 seeds -> out/sweep.csv
```

No dependencies, no build step, Node 20+. `npm install` does nothing and is not
needed.

## The two questions, and which one you can answer

This repo exists to keep these apart:

1. **Is the math interesting?** Does the curve bend, where is the wall, when
   does the oh-shit moment land. Answered by `harness/`, over thousands of
   simulated days, in seconds. **You can do this alone, unattended.**
2. **Does it feel good to press?** Answered only by Keith, playing, for five
   minutes. **You cannot answer this. Do not claim to.**

If you tune something, report it as a curve from a sweep, not as an opinion.

## What the sim already caught that playing would not have

Kept here because each one is a class of mistake, not a one-off:

- **In-transit riders were deleted at midnight.** `trips` stopped equalling
  `delivered + abandoned`, and a tower failing 90% of its trips reported a
  *falling* average wait. Accounting holes read as good news.
- **Stranded riders were logged as zero wait.** A tower with no elevator posted
  the shortest queues in the sweep.
- **Rent tracked office count, never service.** A tower delivering 2.5% of its
  trips netted +$6,260/day. The bottleneck was fully ignorable — the game had no
  wall. `config.occupancy` is the fix; do not delete it.
- **A 276-deep queue rendered as a thin green line.** Per-person dots cap out
  and stop growing, so catastrophe and mild congestion looked identical.

The pattern: every one of these made the game look *fine*. Distrust metrics that
improve while the thing they measure gets worse.

## Conventions

- Plain ES modules. Same files run in the browser and in Node — no bundler, no
  transpile, no `vm` sandbox trick.
- Fixed timestep everywhere. The sim never sees a variable `dt`.
- Comments explain *why*, especially where a number was chosen by a sweep.
- `out/` and `node_modules/` are gitignored. `replay/` is committed.
