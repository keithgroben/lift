# Lift

> ## ⚠️ Superseded — the tower game continues at [`keithgroben/tower`](https://github.com/keithgroben/tower)
>
> **2026-09-02.** Keith, after hitting the same wall a fifth time while playing:
> *"I was attempting to add to the loop without having it first."*
>
> He was right, and the reason was written down here all along. This repo's north
> star said **"SimTower's bottleneck, SimCity's appeal-shaping — not a clone,"** so
> the tenant model was invented on purpose: appeal scores, desirability, a
> leasing-capacity curve, first-let and re-let bars. Nothing could ever settle
> *"is this right?"*, because by design it wasn't SimTower's.
>
> In SimTower an office rents when a worker's lobby-to-office route actually
> **resolves** — the elevator network decides whether you have tenants at all.
> Here it served tenants who arrived by a separate scoring system. That is the
> difference, and it is not a tuning pass.
>
> **[`keithgroben/tower`](https://github.com/keithgroben/tower)** rebuilds the loop
> faithfully, carrying over what worked: the elevator sim, the tower view, the art
> pipeline, saves, and the headless harness. The teardown that explains the whole
> decision is [`spec/simtower-loop.md`](spec/simtower-loop.md), written here before
> the move.
>
> This repo stays up, playable, and unchanged — it is the comparison.


A prototyping rig for **throughput games** — the genre where the player is a
logistics bottleneck and the game is about seeing and widening it. SimTower,
Melvor Idle, Particle Fleet, tower-defense RTS, incremental trees. They are all
the same shape underneath: sources, converters, sinks, and one constraint
everything routes through.

Two games live here so far:

| | bottleneck | premise |
|---|---|---|
| **Lift** | elevator throughput — car-trips per minute across the floors people need | SimTower's real mechanic |
| **Bloom Rush** | one pair of hands, one cup, one trip down the hill | prove where manual effort runs out and automation becomes the only way up |

```bash
npm run play                        # http://localhost:5173 — pick a game
npm test                            # 20 tests, zero dependencies
node harness/sweep.js bloom 60 5    # every policy x every seed
node harness/tune.js bloom plant.growthCurve 1 2 3 4
node harness/ladder.js              # does the upgrade ladder pay?
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
`src/games/*/sim/**` runs in Node with no DOM and no `Math.random` — enforced
by a test.
That single constraint is what lets a background agent grind on tuning all night
while the feel question stays where it belongs.

```
spec/                 loop teardowns — how a game you like actually works
src/games/<name>/
  config.js           all tuning. data only. the intended playground.
  sim/                pure, deterministic, seeded. no DOM, no Math.random.
  policies.js         autoplayers — each one is a hypothesis, not game code
  render/  ui/        reads state, draws. never mutates.
  game.js             the manifest. the ONLY thing the harness knows about a game.
harness/              run - sweep - tune - ladder. all game-agnostic.
test/                 invariants. weakening one to make a run pass is never the fix.
replay/               recorded sessions, re-runnable against new tuning
```

## Replay

The sim is deterministic and seeded, so a session is just its list of actions.
Press **E** in the playable to export a tape, then re-run it after a tuning
change to see what the change did to *your* play rather than the autoplayer's.
Cheap to build in on day one; impossible to retrofit later.

## Three instruments

- **`sweep`** — every policy x every seed. Answers *which strategy wins*.
- **`tune`** — sweeps one config value and reports the **spread** between best
  and worst play. Score alone is the wrong target: a change that makes every
  policy richer made the game easier, not better. Spread near 0% means the
  player's choice in that dimension is free, and there is no game there.
- **`ladder`** — prices every upgrade by ceiling gained and days to pay back.
  Built for Bloom Rush's premise, but any game with progression needs it.

## What the headless sweep found

`node harness/sweep.js lift 60 5` — three autoplayer policies, five seeds each:

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

## Bloom Rush: the premise was inverted by its own pricing

The game exists to prove you need automation. `harness/ladder.js` measured the
opposite — the two automation upgrades were the **worst purchases on the board
by a factor of 20**:

| upgrade | cost | ceiling gain | payback | kind |
|---|---|---|---|---|
| Wide Can | $42 | +1.29 | **10 d** | effort |
| Drip Lines | $110 | +0.68 | **220 d** | AUTOMATION |

End to end, the policy that engaged with the ladder earned **$12.8/day against
$14.0 for ignoring it entirely.** Following the incentives meant buying more
hauling speed and never automating anything.

The fix was one number — Drip Lines from `+0.2` water to `+0.5`, which also
halves the pours needed per plant. Payback 220 d → 13 d; `climber` 12.8 →
**$26.4/day vs $14.4**. A climbing run now walks `3.59 → 4.88 → 5.81 → 10.76`,
with automation as the single biggest jump, arriving after effort is exhausted.

The saturation signal itself was already working perfectly:

| | idle time | income |
|---|---|---|
| hold 3 plants (at the ceiling) | **16%** | $13.0/day |
| hold 4 plants (one over) | **0%** | $13.0/day |

One plant over the ceiling eats every second of slack and returns nothing. That
is the premise, in two rows.

## Six things the sims caught that playing would not have

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
5. **Bloom's plants grew linearly in hydration**, so total growth was
   independent of how water was spread — watering 8 plants half-way yielded
   exactly what watering 4 fully did. "How many plants" cost nothing.
6. **`maxPots: 8` with no way to add a pot.** Every hold-N policy above 4 was
   silently identical to hold4, and the sweep read as a flat curve that meant
   nothing.

All six made the game look *fine*. Two lessons worth keeping: distrust a metric
that improves while the thing it measures gets worse, and treat a flat curve as
a broken instrument until proven otherwise.

## Adding another game

1. Write `spec/<game>.md` from `spec/_TEMPLATE.md`. Name the bottleneck. If you
   cannot name exactly one, stop — the prototype will be about the wrong thing.
2. Fill in the time-constants table. Old games have great loops and brutal
   pacing; that table is where you compress.
3. New `src/games/<game>/` with `config.js`, `sim/`, `policies.js` and a
   `game.js` manifest. Reuse the harness — it needs no changes.
4. Write the autoplayer policies *before* the renderer. If no policy can find a
   strategy that beats ignoring the mechanic, there is no game yet.
5. Export a `meta.score` from `game.js` so `tune` has something to optimise
   against — then check the **spread**, not the score.

See `CLAUDE.md` for the agent brief and blast-radius rules.
