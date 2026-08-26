# Lift

A prototyping rig for **throughput games** — the genre where the player is a
logistics bottleneck and the game is about seeing and widening it. SimTower,
Melvor Idle, Particle Fleet, tower-defense RTS, incremental trees. They are all
the same shape underneath: sources, converters, sinks, and one constraint
everything routes through.

The first slice rebuilds SimTower's actual mechanic: **elevator throughput.**

```bash
npm run play     # http://localhost:5173
npm test         # 9 tests, zero dependencies
node harness/sweep.js 60 5
```

No dependencies. No build step. Node 20+. The same source files run in the
browser and in Node.

---

## Why it is built this way

Two questions decide whether a prototype is worth continuing, and they need
completely different tools. Using a playable build for both is what makes
prototyping feel slow.

| Question | Tool | Who answers it |
|---|---|---|
| **Is the math interesting?** Does the curve bend, where is the wall, when does the oh-shit moment land | `harness/` — thousands of simulated days in seconds | The graph |
| **Does it feel good to press?** | Five minutes of playing | Only you |

So: **the sim is pure and headless, and the renderer is disposable.**
`src/sim/**` runs in Node with no DOM and no `Math.random` — enforced by a test.
That single constraint is what lets a background agent grind on tuning all night
while the feel question stays where it belongs.

```
spec/       loop teardowns — how a game you like actually works
src/sim/    pure, deterministic, seeded. step(state, dt, config). no DOM.
src/config/ all tuning. data only. the intended playground.
src/render/ reads state, draws. never mutates.
src/ui/     controls, HUD, dev knobs (press D)
harness/    headless runners + autoplayer policies
test/       invariants. weakening one to make a run pass is never the fix.
replay/     recorded sessions, re-runnable against new tuning
```

## Replay

The sim is deterministic and seeded, so a session is just its list of actions.
Press **E** in the playable to export a tape, then re-run it after a tuning
change to see what the change did to *your* play rather than the autoplayer's.
Cheap to build in on day one; impossible to retrofit later.

## What the headless sweep found

`node harness/sweep.js 60 5` — three autoplayer policies, five seeds each:

| Policy | Dies around | Reaches |
|---|---|---|
| `naive` — never buys another car | day 6–11 | 5–6 floors |
| `reactive` — buys after the pain | day 6–23 | 5–8 floors |
| `balanced` — holds a cars:offices ratio | day 32–58 | 11–25 floors |

Managing the bottleneck buys **~5× the runway**, reproducibly. The elevator is
load-bearing, not decoration — and that claim is now a test, so it cannot
silently stop being true.

**Still open:** every policy eventually goes bankrupt. There is no long-run
equilibrium, so the difficulty curve is a cliff rather than a slope.

## Four things the sim caught that playing would not have

Each is a class of mistake, not a one-off:

1. **In-transit riders were deleted at midnight.** `trips` stopped equalling
   `delivered + abandoned`, and a tower failing 90% of its trips reported a
   *falling* average wait.
2. **Stranded riders were logged as zero wait.** A tower with no elevator posted
   the shortest queues in the sweep.
3. **Rent tracked office count, never service.** A tower delivering 2.5% of its
   trips netted +$6,260/day — the bottleneck was entirely ignorable, so the game
   had no wall at all.
4. **A 276-deep queue rendered as a thin green line.** Catastrophe and mild
   congestion looked identical on screen.

All four made the game look *fine*. The lesson worth keeping: distrust a metric
that improves while the thing it measures gets worse.

## Adding another game

1. Write `spec/<game>.md` from `spec/_TEMPLATE.md`. Name the bottleneck. If you
   cannot name exactly one, stop — the prototype will be about the wrong thing.
2. Fill in the time-constants table. Old games have great loops and brutal
   pacing; that table is where you compress.
3. New `src/config/<game>.config.js`, new sim module, reuse the harness.
4. Write the autoplayer policies *before* the renderer. If no policy can find a
   strategy that beats ignoring the mechanic, there is no game yet.

See `CLAUDE.md` for the agent brief and blast-radius rules.
