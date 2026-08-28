# Lift — vision and roadmap

Captured 2026-08-28 from a design conversation with Keith. This is the
north-star document: what the game IS, what it is not, and the order of work.
`ROADMAP.md` stays the release-gated execution tracker; this file holds the
destination.

## Identity in one sentence

**SimTower's bottleneck, SimCity's appeal-shaping, none of SimTower's
micromanagement.**

Not a clone. The elevator is still the heart — but where SimTower asked you to
fiddle rents room-by-room, Lift asks you to shape *desirability* and lets the
market react.

## The core loop (name it, protect it)

Everything in the game feeds one loop, which we call **the pressure loop**:

```
appeal ↑ → tenants move in → more trips → queues grow → stress ↑ → appeal ↓
                    ↑                                        |
                    └── transport spending (the release valve) ┘
```

- Desirability attracts tenants (view, quiet, services, mix, fair rent).
- Tenants generate traffic (commutes, lunch, condo errands, hotel churn).
- Traffic exceeds capacity → waits → stress → tenants leave → appeal collapses.
- The player's money converts back into capacity (cars, shafts, routes) or
  appeal (services, renovation, placement) — never both at once comfortably.

This loop is *self-balancing*, which is what makes it a game: success creates
the next problem. Every feature below must either feed this loop or get cut.

## What the prototype already has (don't rebuild these)

| Wanted | Status |
|---|---|
| Simple rent (not per-unit like SimTower) | **Done.** One lever per room *type*, five bands (−2…+2). Rent trades income against evaluation. |
| SimCity-style needs | **Mostly done.** food / parking / medical / security / recycling needs per room type, plus noise, view, layout mix, floor preference, renovation. |
| Desirability → traffic coupling | **Done in sim.** Appeal drives move-ins; occupancy drives trips; shops literally earn per *delivered* customer. |
| Shaft limits | **Done.** `maxSpan: 24` floors, `maxCarsPerShaft: 7`, capacity 12/dispatch. |
| Tall-tower transfers | **Exists.** Trips chain multi-leg through stacked shafts (sky-lobby style) when no single shaft reaches. |
| Milestones | **Partial.** Star tiers (population gates with cash rewards + unlocks). Achievements proper: not yet. |
| Pan / zoom | **Not yet.** Renderer squeezes the whole tower into view. |
| Express elevators | **Not yet.** |

## The economy on paper (the "spreadsheet before code")

Statics, straight from `config.js` (all per day unless noted):

| Room | Build | Income | Naive payback | Traffic it creates | Noise |
|---|---|---|---|---|---|
| Office | $120k | $30k rent | ~4 days | 2 commute trips/worker + 55% lunch | loud, tolerant |
| Condo | $200k | $260k sale (+$60k instant) then $9k | instant + trickle | 1.4 trips/resident | quiet, *sensitive* |
| Shop | $150k | $4k + **$2.2k per delivered lunch customer** | ~5 days *if delivered* | destination traffic | loudest |
| Hotel | $320k | $11k × 2–6 guest-nights | 5–15 days, quality-driven | 2 trips/guest/day | medium |

Transport: shaft $90k + $12k/floor · car $140k (+12 riders/dispatch) · stairs
$70k+$22k/floor (4.5s/floor, cap 6) · escalator $180k+$30k/floor (1.8s/floor,
cap 12). Fixed drains: $3.5k/floor/day, $5k/day per *vacant* room, service
upkeep $2.5k–$6k each.

Two readings from this table:

1. **Statics are generous on purpose.** A delivered tower prints money —
   payback in days, not weeks. The game is not "can you afford it," it is
   "can you *deliver* it." The shop is the purest expression: its income *is*
   the delivery rate.
2. **The dividing line for tooling:** anything computable in this table
   (costs, paybacks, upkeep ratios) belongs in a spreadsheet and can be tuned
   before writing code. Anything involving *queues* (waits, abandonment,
   cliffs) cannot — that's what `harness/` sweeps are for. Use the sheet for
   "is this purchase ever worth it," use the harness for "when does the tower
   break."

## The endgame guarantee ("fill the whole canvas and be profitable — right?")

Right — but today that's a *hope*, not a fact. Max canvas is 60 floors; one
shaft spans at most 24, so a full tower is forcibly a 3-zone sky-lobby
structure, and the best autoplayer ever recorded topped out around 150–230
population. Nobody — human or bot — has proven a full canvas is viable.

So we make it a **permanent, falsifiable test**, in this repo's spirit. The
"maxed-out win" is now a computable predicate — `meta.win` in `game.js`,
covered by `test/win.test.js`, reported by every harness run and shown in the
lab's outcome column. Keith's framing ("90% of the map covered and some
variable of traffic flow and profitability") formalized:

> **WIN = full × healthy × profitable, sustained 14 consecutive days:**
> floors = maxFloors · built rooms ≥ 75% of gross slots (≈90% of what
> transport leaves buildable) · ≥85% of rooms tenanted · delivery ≥ 80% ·
> reputation ≥ 80% · net income positive every day of the window.
>
> Sustained matters: one golden day crowns nothing. Profit-as-flow matters:
> a banked fortune must not carry a bleeding tower. And because `net`
> includes construction spending, a winning tower is necessarily *finished* —
> standing on operations, not still digging.

The win predicate is also the intended trigger for the 5-star fireworks: one
source of truth for "won" across harness, lab, and game UI.

**First frontier probe (2026-08-28, `skyscraper` 400 days seed 1):** the best
known strategy reaches 60 floors and banks $87M — but the tower is a hollow
shell: ~57 rooms built out of 480 gross slots (~12% coverage vs the 75%
standard), and it lives in a violent boom-bust churn cycle — population
oscillating 28↔225, vacancies 0↔44, delivery bouncing 42–74% (vs the
sustained-80 standard), the wait cliff hit on day 74 at 19 floors. Verdict:
**height is reachable today; FULL is not even close.** Two tuning questions
fall straight out of it:

1. **The boom-bust churn cycle** (plain words): the tower fills faster than
   the elevators can absorb. Tenants flood in → traffic spikes the same day →
   delivery collapses → tenants rage-quit → the near-empty tower's elevators
   look great again → reputation recovers → the gate reopens → tenants flood
   in. Round and round forever; the tower never settles at a population it
   can actually serve. The move-in gate is *binary* (reputation above 55 =
   doors wide open, below = shut), which is what makes the swings violent.
   Candidate dampers to test in the lab: move-ins throttled *proportionally*
   to service quality instead of all-or-nothing; slower stress accrual with
   longer memory; arrival trickle caps. A winnable tower must be able to sit
   *stable* at high occupancy. (Keith briefed 2026-08-28.)

   **Dampers built + first A/B (2026-08-28).** Three knobs in
   `config.occupancy`, all defaulting to historical behavior (existing seeds
   replay identically; `test/damping.test.js` proves it): `moveInFullFlowRate`
   (proportional gate), `moveInCapacityMax` (flood cap), `vacateJitterRange`
   + `graceJitterDays` (desynchronized exodus). `harness/run.js` now takes
   `--set path=value`. A/B at fullFlow=85, cap=6, jitter=0.3/±2 days,
   skyscraper, 400 days, seed 1:
   - Population swing **halved** (38↔128 vs 28↔225) and delivery improved
     (49–91% vs 42–74%) — but the tower still oscillates; no plateau yet.
     The dampers help; they are not sufficient alone. Next suspects: stress
     accrues much faster than the ~3-day reaction loop, and the policy
     under-provisions transport during rushes regardless of gate behavior.
   - **Side effect, welcome:** wealth halved too ($37M vs $87M) — the churn
     flood was itself profitable, so damping it partially answers the
     wealth-punishment question for free.
   - ~~Watch for over-damping~~ — **correction (same day):** the "naive
     survives" reading was a truncated-output misread; the isolation sweep
     shows naive goes bankrupt day ~47–50 with dampers on OR off, cap or no
     cap. **The wall stands.** The dampers never softened it.

   **Isolation sweep (2026-08-28, 7 variants + verification):** the humbling
   result — *no gate-side combo produces a plateau.* Best variant
   (gate+cap+jitter) ties the undamped baseline on stability (CV 0.36 vs
   0.37) and goes bankrupt on seed 2. Softening tenant stress is outright
   fatal (bankrupt day 109): tenant anger is the pacing signal the whole
   tower runs on — muffle it and towers overbuild into oblivion. **Diagnosis:
   the oscillation is structural, not gate physics.** Healthy population
   bounces off a hard transport ceiling (~100–150 pop at 7 cars/shaft ×
   12 riders × ≤24-floor spans); gate tuning only reshapes the bounce. The
   fix must raise real throughput — which is where express elevators /
   zoning enter on merit, or elevator capacity/dispatch tuning. Dampers stay
   available as knobs (defaults off) pending the transport-side fix.

   **Throughput probe confirms it (2026-08-28):** raising the hardware
   ceiling (elevator capacity 12→20, maxCarsPerShaft 7→10) beats every
   gate-side variant on its own: pop ~150–165 sustained, CV 0.31, both
   seeds survive. **And combined with gate+jitter, seed 2 produced the
   healthiest tower ever recorded: pop 199, never below 101, CV 0.15, 48
   floors, $168M** — the wave genuinely flattens toward a plateau when the
   ceiling rises. Seed 1 stays bumpier (CV 0.31, one crash to 12), so
   throughput+dampers is the right *structure* but the numbers aren't final.
   ~~Open design fork~~ — **resolved: express elevators, built 2026-08-28.**

   **Express elevators are LIVE.** Keith chose the feature over the tuning
   shortcut. Implemented end-to-end: `config.elevator.express` (speed 4.8,
   capacity 20, 8 cars, span up to 60) + express costs; `build_shaft` /
   `extend_shaft` / `add_car` enforce per-kind rules; `shaftParams()` gives
   express cars their own physics; express counts as room access only at its
   two landings; routing and car stepping were already express-aware. UI:
   "+ express" build button (click a sky-lobby floor), violet skip-stop
   rendering, browser-verified. `test/express.test.js`; 261 tests green.

   **First post-express expedition (skyscraper, 400d):** towers now reach
   **60 floors on every seed** (the zoned policy's express calls finally
   succeed) with pop 139–165 sustained, CV 0.31–0.40, $83–121M, delivery
   ~65% — matching the "magic big elevators" probe through real structure
   instead of cheated physics, and *consistent across seeds* where every
   earlier variant was fragile. Naive still dies (day 49–61). Notables:
   (1) each tower only managed **one** express shaft — the zoned policy
   wants ~4 but later columns get blocked by rooms; column reservation is
   the next policy/design lever, and more express should mean more
   stability; (2) the gate dampers HURT in the express world (CV 0.48–0.54)
   — transfer waits drag reputation, throttling inflow the tower could
   actually serve; leave dampers off for now. The maxed-out win is still
   far away on population, but for the first time the tower's structure
   matches the win condition's assumptions.

   **Column-planning follow-up (same day):** teaching the builder to fill
   rooms from the far RIGHT (to keep left columns clear for shafts)
   bankrupted both seeds by day 41 — every room sat maximally far from its
   shaft, the access penalty gutted evaluations below the re-lease
   threshold, and vacancy upkeep bled the tower out. **Lesson: access
   quality vs column discipline is a real spatial tradeoff — the tower has
   a geography.** Fix: planned reservations (policies.js
   `plannedReservedSlots`) — locals alternate core columns 1-2, tier-t
   express reserves column 2+t only on the floors it passes, rooms take the
   lowest unreserved slot (snug beside the core, never on it), and
   reservations expire above the top sky lobby. `zoneHeight` 12 → 20:
   every extra zone costs a full-height express column, and 8 slots per
   floor only affords two sky lobbies. **Geometry finding for the win
   predicate:** with a real zoned core, transport eats ~35-45% of the
   low-zone grid, not the ~15% the 75%-coverage threshold assumed — either
   `slotsPerFloor` widens (already planned alongside decorations) or the
   win's coverage bar recalibrates to net-buildable slots. Keith call.

   **The column-war rounds (same day, 2–5):** each fix exposed the next
   interlock, all traceable to grid scarcity. (R2) planned columns + 20-floor
   zones deadlocked at 3 rooms — the floor-headroom goal (`zoneHeight+2`=22
   floors) blocked room-building entirely, and facilities (not
   reserve-gated) drained the cash first: slow bankruptcy on 20 empty
   floors. (R4 fix: rooms build before services; headroom is a fixed lead
   of 6.) (R4) then the reservation's "any free slot" fallback poisoned the
   shaft columns under pressure, and the rooms-per-floor estimate ignored
   reservations, freezing floors below the first sky lobby. (R5 fix: no
   fallback — overflow goes UP; estimate counts reserved columns; capacity
   twins search columns right-to-left.) **R5 results:** at 8 slots, record
   population (219–237 sustained, peaks 445, 30+ floors) but capacity twins
   still eventually squat the express columns — 0 express built. At **10
   slots: the best service ever recorded at scale — delivery 73–74% mean,
   min 53–56%, CV 0.25–0.29** — genuine plateau territory, though towers
   stayed short (17–19 floors). The grid-width hypothesis is confirmed from
   the transport side; remaining blockers for a true express tower are
   (a) floor growth must *want* the zone boundary once zone-1 occupancy is
   strong, (b) twins must never take a planned express column.

   **Process lesson (caught by the test suite):** giving the column plan to
   ALL policies made `naive` survive 10× longer and broke the
   knowing-beats-ignoring invariant — placement intelligence is a policy
   HYPOTHESIS, so it's now opt-in (`grow(..., pickSlot)`); naive stays
   naive, and the invariant stands. 261 tests green.

   **Summit campaign, rounds 6–12 (2026-08-28): the first self-built
   express tower.** `slotsPerFloor` is now 10 by default (the round-5
   verdict, formally adopted — comment in config.js). What it took, each
   its own lesson: a zone-reach floor builder whose "thriving" gate had to
   mean *built-out*, not merely occupied (a 3-room tower is 100% occupied);
   gates tuned to what `grow`'s own headroom makes structurally reachable;
   a reserved twin column (protecting everything left twins nowhere legal
   and capacity froze at 2 shafts); and sealing THREE separate leaks that
   parked squatters in the express column — twins, the last-resort shaft
   fallback, and facilities whose `slot: undefined` fell back to
   first-free (a parking garage sat in the shuttle's path for 500
   in-game days). Round 11 proved the transport math clears the win bar:
   **delivery 86% mean, never below 66** — but as beautiful empty shells
   (the facility fix over-skipped, coverage collapsed, appeal followed).
   Round 12, with radius-hunting facility placement, lands the complete
   organism: 2 zones, sky lobby at F20, an 8-car express shuttle, twins,
   services, 29–30 floors, $254–312M, both seeds surviving 800 days,
   naive still dying on schedule.

   **Where the summit stands now:** the structural frontier is CLOSED —
   nothing about the tower's shape blocks the win anymore. The remaining
   gap is balance: population 130–196 vs the ~1,500 a full canvas implies,
   because the pressure loop still churns occupancy (16–40 of ~62 rooms).
   Next levers are pure tuning, all lab-testable: leasing pace vs churn,
   service coverage economics, express-fed zone-2 buildout, and possibly
   the dampers revisited now that transport is no longer the binding
   constraint.
2. ~~Wealth punishment~~ — **answered:** decorations + rising expectations;
   see "Decorations — the wealth sink" above.

Closing the gap between 12%-hollow and 75%-full-at-standard IS Phase B.

- If the harness finds such a policy → the endgame is real; lock it in as a
  regression test so no tuning change ever silently makes the summit
  unreachable.
- If it can't → the transport math doesn't support the ceiling. Tune
  (capacity, express, maxFloors) until the test passes *and* the spread stays
  wide — the summit should be provably reachable and humanly hard.

This is the single highest-leverage piece of pre-art design work available.

## Design positions (decided unless Keith overrules)

- **Rent stays per-type.** Five bands, global per room kind. If it ever needs
  to get simpler, the next step is an *auto-rent* toggle (market prices the
  room off desirability), not more granularity. Per-unit rent is banned.
- **Express elevators** are the mid-game answer to the `maxSpan` wall:
  stop only at designated transfer floors, faster and bigger, expensive,
  unlocked at 3-star. They don't remove the wall; they reward planning around
  it. (Spec to be written as `spec/express.md` when Phase C starts.)
- **Fun = visible pressure + real choices.** A moment is fun when the player
  can (a) see the problem coming (the W badges, the crowd bar), (b) choose
  between genuinely different answers (car vs stairs vs escalator vs slow
  growth), and (c) see whether it worked (delivery/reputation recovery).
  Tuning target is *spread* — the gap between good and bad play — per
  CLAUDE.md. A change that makes every policy richer made the game easier,
  not better.
- **Achievements are style goals, not economy.** Star tiers remain the
  economic spine. Achievements read the day-close log and award play *style*:
  "zero abandoned riders for a week," "profitable before your first
  escalator," "full canvas" (the endgame test, as a trophy), "five-star with
  no rent above standard." Log everything, award from the log — no new sim
  state.
- **Pan/zoom is renderer-only.** Camera `{x, y, zoom}` with wheel-zoom,
  drag-pan, clamped to tower bounds; hit-testing goes through the camera
  transform; badges get level-of-detail (zoomed out = per-floor heat, zoomed
  in = individual dots). No sim change. Prerequisite for the mixel art pass —
  pixel art has a native resolution, and a fixed squeeze-to-fit camera would
  destroy it.
- **The tower can die.** (Keith, 2026-08-28.) Bankruptcy is a real loss — and
  the sim already enforces it: money < 0 at day close sets `state.over` and
  the world stops (`economy.js`). What's missing is the *moment*: the UI
  currently just goes quiet. Needs a proper game-over screen — what killed
  you (the day log knows), how tall you got, and one-click new session. The
  `vacancyBufferDays` construction gate stays: the game warns you away from
  the bankruptcy *trap*, then lets you die anyway if you insist.
- **5-star ends in fireworks.** (Keith, 2026-08-28.) The crowning moment is a
  literal fireworks show over the finished tower — night sky, the tower lit,
  fireworks above the roof, a plaque with the tower's stats. The renderer
  already owns a day/night sky and a juice layer; fireworks are a
  particle-burst effect in `render/`, sim-free. This is the emotional payoff
  the whole climb points at; treat it as a feature, not a flourish.

## Decorations — the wealth sink (Keith, 2026-08-28; build in Phase C)

Wealth needs a punishment. Keith's direction: not a tax — **competition for
space**. Decorations (SimCity's parks-beside-industry move, scaled down):

- A **decoration** is a facility-shaped thing: occupies a build slot, earns
  nothing, costs money up front plus daily upkeep, and *reduces effective
  noise and adds appeal* in a **slot-radius effective area** — NOT the whole
  floor (Keith, 2026-08-28). It works exactly like noise already does, in
  reverse: full effect on same-floor neighbors within ~±2 slots, a reduced
  fraction to the slot directly above/below (mirror `noiseRadiusSlots` /
  `verticalNoiseWeight`). Placement becomes a spatial puzzle that interlocks
  with the noise map — the park goes *beside the noisy shop*, and one
  decoration shelters ~4 rooms, not a floor. That geometry is also what
  makes it a real wealth sink: beautifying a full tower takes many slots.
- **Why it punishes wealth:** tenant expectations rise with the tower's star
  tier — but the rise **rolls through the tower gradually, floor by floor**,
  never as one building-wide jump (Keith, 2026-08-28: an instant tower-wide
  raise is another synchronized shock — every marginal room fails the same
  day and you get a resident collapse, the same disease as the boom-bust
  gate). Design: on reaching a tier, the new retention threshold climbs the
  tower from the lobby upward, one floor per day (knob). This desynchronizes
  departures AND creates a visible, chaseable mechanic: the player watches
  the expectation wave rise and races ahead of it with decorations. A rich
  tower must keep converting money into appeal, and every decoration slot is
  income or transport surrendered — max income and max appeal cannot coexist
  on the same grid. Still simple: one new build kind, one rising threshold,
  one rollout speed.
- **Map size:** the 8-slot floor is already tight (rooms vs shafts vs stairs).
  When decorations land, widen `slotsPerFloor` (10–12) in the same change and
  re-balance with the lab — never before, since width changes every transport
  number.
- **Parked for later, deliberately:** trash (a load that scales with traffic,
  needing recycling coverage to keep up) and maintenance (random breakdown
  events). Neither is needed for the initial balance; logged so they don't
  get reinvented badly.

## Roadmap

- **Phase A — prove the loop is fun** *(current, gates everything)*
  Release 0 human playtest per `docs/HUMAN_PLAYTEST_RELEASE_0.md`. Tutorial
  now starts from an empty lot with the FIRST SESSION PATH checklist.
- **Phase B — prove the endgame** *(design, no art)*
  1. Economy spreadsheet export (CSV from config: the statics table above).
  2. The full-canvas viability sweep + lock it in as a test.
  3. Save/continue (seed + action-tape replay; localStorage + file export).
  4. Tune from its findings: does 3-zone transfer play well? Where's the wall?
  - *Shipped early:* the **Lab** (`harness/lab.html`) — the headless sim
    visualized in the browser: every policy overlaid, any config number
    overridable, decision-spread readout. This is how Keith feels the tuning
    himself instead of trusting agent summaries.
- **Phase C — the differentiators**
  1. Express elevators / transfer floors (spec first).
  2. Desirability overlay views (noise map, coverage map, appeal map) —
     SimCity's data layers, reading existing evaluation fields.
  3. Auto-rent toggle, if playtests say rent is still too fiddly.
- **Phase D — the feel**
  1. Pan/zoom camera (before art, it's the canvas the art lives on).
  2. Mixel art pass (rooms, cars, people, sky — day/night already in).
  3. The two big moments: 5-star fireworks show · bankruptcy game-over screen.
  4. Achievements.
  5. Sound.

## Open questions for Keith

1. ~~Failure~~ — **answered:** yes, bankruptcy is game over. Already enforced
   in the sim; the UI moment is Phase D work.
2. ~~The 5-star moment~~ — **answered:** fireworks. Phase D work.
3. ~~Session length~~ — **answered:** a great tower is a ~6-hour investment,
   so **saves are required**, not optional. Design: the sim is deterministic
   and every action is already recorded on a timestamped tape — so a save is
   just `{seed, config version, action tape}` and loading is a fast headless
   replay (a 6-hour tower replays in seconds). Persist to localStorage with
   file export/import as backup. This also future-proofs saves against most
   balance patches: a saved tape can replay under new tuning. Scheduled as
   Phase B work (long play sessions are needed to validate the endgame
   anyway).

## The living tower (added 2026-08-28)

Keith's north star for the art: **you can watch people doing things in the
tower** — working at desks, shopping, sleeping, queuing. Architectural
consequence, decided now so nothing fights it later:

- The sim stays headcount-based. It will never simulate individual daily
  routines — that's cost without gameplay.
- Visible life is **decorative puppetry in the renderer**, driven entirely by
  state the sim already exposes (heads, time of day, stress, delivered
  customers, queue depths). SimTower worked exactly this way.
- Full inventory of required art lives in `spec/sprite-manifest.md`, tiered:
  T1 reskin → T2 living tower → T3 delight (fireworks, plaque, game-over).
