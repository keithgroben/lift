# How to play Lift

## The short version

1. A new game opens on bare ground with the `lobby` tool already armed. Click
   the ground floor: that first click places the entrance and the storey it
   stands on.
2. Add a room above it — every room raises and pays for its own storey — then
   run a `shaft` up to it. A tool stays armed, so eight offices is eight
   clicks.
3. Watch the building for a few seconds. People will use the elevator during
   rushes.
4. When waiting rises, select `car`, then click the highlighted elevator
   shaft. Press `Esc` when you are done adding cars, and let the next rush
   run — delivery and reputation should recover.
5. Add rooms only when the building can afford them and transport can serve
   them.
6. If a room becomes unhealthy or abandoned, select it and follow the
   recovery action shown in the room panel.

The repeating loop is:

> build rentable space → attract tenants → observe movement → solve the
> bottleneck → protect occupancy and reputation → expand carefully

Use the visible TIME controls to pause, slow down, or speed up the simulation.
The keyboard shortcuts are optional: Space pauses, and 1/2/3 select the same
speeds.

## Saving

A tower is a long session, so the game saves one for you and lets you keep as
many as you like.

- **It autosaves once a day** as you play. You do not have to do anything.
- **`saves`, beside `new session`** — or the **S** key — opens the list. Name
  the tower and press *save* to keep a copy you can come back to; every row
  says what the tower was, so you can recognise your own: *day 212 · 26 floors
  · 84 people · $4,180,000*.
- **Loading replaces the tower on screen**, so it asks first, and the loaded
  tower arrives paused.
- **`new session` autosaves the tower it is about to replace**, so starting
  again is not the one button that throws away an afternoon.
- **Export a save to a file** to keep it beyond this browser — a file survives
  a cleared cache, and can be sent to whoever is debugging. Import puts it back
  in the list without loading it.

A save carries the tuning the tower was played at, so it resumes into the game
you were playing. If the simulation's rules have changed too much since a save
was written, loading it is refused with the reason rather than half-loaded into
a tower that plays by neither set of rules.

## What to do on the first screen

The tower starts as an empty lot: street, sky, and nothing built. The `lobby`
tool is already armed, so the first click of a new game places the entrance —
the same first move the guided path asks for. The player HUD should tell you
the current objective and next action. When a transport response is needed, the
top `NEXT ACTION` button opens the matching build flow for you; you still
confirm the placement in the tower. Use the detailed developer view only when
you want to inspect the simulation closely.

Use `new session` beside the objective when you want to restart the first loop;
click the follow-up `confirm new session` control before the tower resets.
If you change your mind about an armed tool, press `Esc`, right-click the
tower, or use `cancel action`. Any of the three returns to `WATCHING` without
changing the tower, and while `WATCHING` a click on the tower inspects rather
than builds.

For the structured first-session check, see
[`HUMAN_PLAYTEST_RELEASE_0.md`](HUMAN_PLAYTEST_RELEASE_0.md).

## Building

Building is a tool, not a list. Pick a tile from the palette and it arms; the
tower then shows a ghost under the cursor — green where the thing may land,
red with the reason where it may not (`$1,400 short`, `slot taken`, `build a
lobby first`). Clicking places it, and the tool **stays armed** for the next
one. `Esc` or a right-click puts it away.

Every tile shows its price. A tile you cannot afford stays where it is and
says how far short you are; a tile you have not unlocked yet says the
population that unlocks it. Nothing disappears from the palette.

- `lobby` places the ground-floor entrance, and on bare ground it buys the
  storey it stands on. Once placed it stays armed as the wing tool, for
  widening the entrance.
- `office`, `condo`, `shop`, and `hotel` place a room in the slot you click.
- `shaft` runs a new elevator route from the lobby. Hover a clear building
  column, then click the top floor for the shaft span; the ghost turns red
  and names the problem if that column is blocked or the span is invalid.
- `car` adds capacity to an existing shaft: arm it, then click the shaft.
- `stairs`, `escalator`, and `express` are the other routes out of the lobby.
- Services such as cafeterias and parking are placed on a floor and cover a
  nearby range.
- `demolish` clears a vacant room and frees its slot. It is a tool in the
  palette like any other; an occupied room refuses, and says so.

Every construction choice spends money and can add operating costs. Empty
rooms still have upkeep, so a larger tower is not automatically a better one.

## Where things are

The screen has three parts, and each answers a different question.

- **The bar across the top — "how am I doing?"** It never scrolls. On the left
  it carries who you are: star rating, money, the day with the clock and the
  rush window, and population. Next to those, boxed together, are the three
  numbers a build decision is actually made from: **waiting**, **delivered**,
  and **reputation**. Speed controls sit at the right end.
- **The line under the bar — "what is happening, and why?"** Point at a room
  and it says that room's appeal, what the tower is currently held to, and the
  single largest cause with its cost, e.g. `F3 office · appeal 21 · expected
  30 — no food service within 1 floor (−12) · add food service`. Beside it,
  once tenants start leaving, is the week's pattern — how many rooms were lost
  and whether they left over **room appeal** or **slow lifts**. Those two take
  different money to fix. On the right is the next star milestone.
- **The sidebar — "what do I do next?"** The recommended next action, then the
  build palette. When you select a room, shaft, or facility, its panel appears
  below the palette; when nothing is selected, nothing is there.

The bar also carries the **appeal view** toggle (also `A`), which tints the
whole tower by room appeal on demand.

`HOW TO READ THE TOWER` and `FIRST SESSION PATH` are collapsed at the bottom of
the sidebar. Everything else — the full telemetry column, transport
diagnostics, the legend, and the tuning knobs — is behind
`show developer details`, or the `D` key.

### Appeal, and the number beside it

The appeal line always shows an **expected** value next to the score, and it is
not decoration. The bar a room has to clear rises as the tower grows, so an
appeal of 30 can be comfortable in a three-storey building and failing in a
tall one. Read the pair, never the score alone.

## What to watch

- `W` waiting: people currently waiting for transport, in the top bar. Green
  is clear, amber is building pressure, and red is critical.
- `T` tenants/capacity: how full the rentable rooms are. Green is healthy,
  amber is partial, and red means much of the built capacity is unused. It is
  a reading for inspecting rather than for glancing, so it sits with the rest
  of the telemetry behind `D`.
- Room colors identify the space type: blue office, green condo, amber shop,
  violet hotel, and gray empty. A redder room is losing appeal.
- **Two warnings sit on a room, and they are different problems.** A bar
  filling up the room's **left** edge is a departure wick: this tenant is
  walking out over **room appeal**, one notch per day left. A line along the
  room's **bottom** edge is **tenant stress** from slow lifts. Both run amber
  to red, so read the *edge*, not the colour — appeal is answered with
  services, rent or noise, and stress with cars and shafts. A healthy room
  shows neither.
- Press **A**, or the **appeal view** toggle in the top bar, to tint every room
  by appeal at once. That is the view for "which half of my tower is rotting";
  the wick is for "which room, and how soon".
- Delivery: the share of trips completed. Low delivery creates stress and
  harms reputation.
- Room appeal/desirability: how attractive a space is after access, stress,
  rent, noise, views, layout, and services are considered.
- Reputation: recent transport reliability. It affects whether replacement
  tenants are willing to arrive.
- Money/runway: construction cash plus the recent daily operating result.

## Recovery

Point at or select an unhealthy room. The line under the top bar names the
single largest cause and what it costs the room, so read that before acting:

- transport/access problems call for a shaft, car, stairs, or escalator;
- missing services call for the named facility;
- low appeal may call for renovation, rent adjustment, or a better tenant mix;
- a room that cannot recover can be converted or demolished when vacant and
  affordable.

Some actions intentionally use a preview before confirmation. Read the
projected effect and confirm only when it matches your plan.
