# Loop teardown — Bloom Rush (watering-plants)

Ported from `keithgroben/watering-plants` v0.3 (`plant_play.html`). All base
numbers come from that file's `CFG` object; anything new is marked NEW in
`src/games/bloom/config.js` with the reason.

**The stated premise, in the author's words:**

> prove where you need more time and automation

That sentence is the spec. Everything below is measured against it, and it is a
sharper goal than "is it fun" because it is falsifiable: either the game makes
the moment of saturation legible and makes automation the obvious answer, or it
does not.

---

## 1. One sentence

Carry water up a hill in a cup, one trip at a time, and find out how few plants
one pair of hands can actually keep alive.

## 2. Currencies

| Currency | Earned by | Spent on | Capped? |
|---|---|---|---|
| Water | Hauling (4.5s round trip, 0.6 per cup) | Pouring (0.5 per pour) | Yes — reservoir holds 4 |
| Seeds | Harvesting (~1.95 per plant) | Planting | No |
| Cash | Harvesting (3 fruit × $5) | Pots and upgrades | No |
| **Daylight** | — (34s, fixed) | Everything | **Yes. This is the real currency.** |

Cash and seeds stop binding around day 10. Daylight never stops binding.

## 3. Converters

- trip → 0.6 water (costs 4.5s)
- 0.5 water → half a plant's daily need (costs 0.75s)
- 3 fully-watered days → 1 ripe plant → $15 + 1.95 seeds
- cash → upgrades → **a higher ceiling**

## 4. THE BOTTLENECK

**One pair of hands, doing exactly one thing at a time.**

Hauling, pouring, harvesting and planting all draw on the same single-threaded
actor. This is modelled explicitly: `applyAction` rejects everything while
`state.busy` is set, and that rejection *is* the game.

It is **temporal**, not spatial. Money cannot buy your way past it — only a
faster trip, a bigger cup, or water that arrives without you.

### The arithmetic

Seconds of daylight per plant per day:

```
byHand   = waterNeed − drip                  (drip arrives free at dawn)
secs     = byHand × (tripSeconds / cupSize)  ← hauling
         + ceil(byHand / pourAmount) × pourSeconds
         + (harvestSeconds + plantSeconds) / growDays
ceiling  = daySeconds / secs
```

At v0.3's numbers: **haul ceiling 3.78 plants, real ceiling 3.59.** With 8 pots
available, the field is more than twice what the hands can serve — which is the
correct shape for this genre.

## 5. Reward cadence

| Reward | Interval | Feels like |
|---|---|---|
| A cup delivered | 4.5s | The heartbeat — and the thing that must not be tedious |
| A plant fully watered | ~9s | A small completed unit of work |
| A harvest | every 3 days per plant | The payoff |
| An upgrade | rare, chosen | A change of strategy |

## 6. The walls, measured

1. **Haul ceiling — 3.78 plants.** What the hands can water if they do nothing else.
2. **Real ceiling — 3.59 plants.** The same, once harvesting and replanting take their cut.
3. **Saturation — the automation trigger.** Measured directly:

   | | idle time | income |
   |---|---|---|
   | hold 3 plants | **16%** | $13.0/day |
   | hold 4 plants | **0%** | $13.0/day |

   One plant over the ceiling consumes every second of remaining slack and
   returns **nothing**. That is the game's whole thesis in two rows: you are now
   working flat out for no gain, and trying harder is definitionally impossible.

`state.log[].saturated` flags this in the sim (`idle < 0.5s && died > 0`).

## 7. The oh-shit moment

The first day you finish with zero idle time and still watch a plant die. In
prototype time this arrives around **day 6–8**. The cheapest automation must be
affordable within a few days of it, or the lesson lands and the answer isn't
there.

## 8. Time constants — original vs prototype

| Thing | v0.3 | Here | Why |
|---|---|---|---|
| One day | 34s | 34s | Unchanged — v0.3's day length was already right |
| Round trip to the river | 4.5s | 4.5s | Unchanged |
| Days to ripen | 3 | 3 | Unchanged |
| Harvest / plant | **free** | **0.6s / 0.8s** | NEW. Wall 2 cannot exist if churn costs nothing |

## 9. What we are NOT rebuilding (yet)

Daily customer orders · weather · missed-order stakes · harvest combos ·
reputation ranks · achievements · rare blooms.

v0.3 shipped **seven of these at once**, against the repo's own locked rule —
*"add one curve at a time"*. They live in `config.layers`, all `false`. Turn one
on and re-sweep: if it doesn't move the curve, it is decoration compensating for
a loop that isn't carrying itself yet.

## 10. The headless question

> **Does the game actually prove you need automation?**

**Answered, and the first answer was no.**

`node harness/ladder.js` prices every upgrade by what it does to the ceiling and
how long it takes to repay itself:

| upgrade | cost | Δ ceiling | Δ $/day | payback | kind |
|---|---|---|---|---|---|
| Wide Can | $42 | +1.29 | +$4.30 | **10 d** | effort |
| Hill Boots | $60 | +0.77 | +$4.30 | **14 d** | effort |
| Drip Lines | $110 | +0.68 | +$0.50 | **220 d** | AUTOMATION |
| Mist Nozzles | $240 | +0.48 | +$0.50 | **480 d** | AUTOMATION |

**The premise was inverted by its own pricing.** The two automation upgrades
were the worst purchases on the board by a factor of 20. A player following the
incentives buys more hauling speed and never automates anything — the exact
opposite of the lesson. Measured end to end: the `climber` policy, which engages
with the ladder, earned **$12.8/day against $14.0 for ignoring it entirely.**

Four more upgrades (Deep Tank, both Trays, Seed Press) moved neither ceiling nor
income at all.

### The fix

Drip Lines gave `+0.2` against a `waterNeed` of 1.0 — a fifth of a plant. At
`+0.5` the hands cover only half a plant's need, which also **halves the pours**
(`ceil(0.5/0.5) = 1` instead of 2). One number:

| | before | after |
|---|---|---|
| Drip Lines Δ ceiling | +0.68 | **+3.25** |
| Drip Lines payback | 220 d | **13 d** |
| `climber` vs best fixed play | $12.8 vs $14.0 | **$26.4 vs $14.4** |

A climbing run now walks `3.59 → 4.88 (Wide Can) → 5.81 (Hill Boots) → **10.76
(Drip Lines)**`. Automation is the single biggest jump on the ladder, and it
lands *after* effort upgrades are exhausted — which is precisely the premise.

Both facts are now tests (`test/bloom.test.js`): *climbing the ladder beats
ignoring it*, and *automation is the largest single jump in the ceiling*.

### One more thing the ladder table gets wrong

It prices each upgrade against a **bare** config, so anything that stacks reads
as worse than it is. Mist Nozzles shows a 480-day payback in isolation but takes
you from 9.1 to 13.8 once you own Drip Lines. The in-game shop previews from
your *current* config and gets this right; the table has a cumulative pass
appended for the same reason.

## 11. The feel question

> **Is hauling satisfying or tedious?**

Still unanswered, and still the only question that matters. It is question 1 in
watering-plants' own README and no amount of simulation can touch it. A good run
spends **~67% of its daylight on the hill** — two-thirds of this game is the
haul. If pressing that button is not pleasurable in itself, nothing above
matters, because every number in this document is downstream of a player being
willing to do it a few hundred times.

The sim has now done everything it can: the wall is real, it is legible, and
automation is the answer to it. The rest is your hands on the button.
