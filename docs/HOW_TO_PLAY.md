# How to play Lift

## The short version

1. A new game opens on bare ground with the `lobby` tool already armed. Click
   the ground floor: that first click places the entrance and the storey it
   stands on.
2. Stack storeys with `floor`, run a `shaft` up them, then fill them with
   rooms. A tool stays armed, so eight offices is eight clicks.
3. Watch the building for a few seconds. People will use the elevator during
   rushes.
4. When waiting rises, select `car`, then click the highlighted elevator
   shaft. Press `Esc` when you are done adding cars, and let the next rush
   run — delivery and reputation should recover.
5. Add rooms or floors only when the building can afford them and transport
   can serve them.
6. If a room becomes unhealthy or abandoned, select it and follow the
   recovery action shown in the room panel.

The repeating loop is:

> build rentable space → attract tenants → observe movement → solve the
> bottleneck → protect occupancy and reputation → expand carefully

Use the visible TIME controls to pause, slow down, or speed up the simulation.
The keyboard shortcuts are optional: Space pauses, and 1/2/3 select the same
speeds.

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
- `floor` stacks one more storey on top of the tower.
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

## What to watch

- `W` waiting: people currently waiting for transport. Green is clear, amber
  is building pressure, and red is critical.
- `T` tenants/capacity: how full the rentable rooms are. Green is healthy,
  amber is partial, and red means much of the built capacity is unused.
- Room colors identify the space type: blue office, green condo, amber shop,
  violet hotel, and gray empty. A redder room is losing appeal; the thin
  yellow/red line along its bottom shows tenant stress.
- Delivery: the share of trips completed. Low delivery creates stress and
  harms reputation.
- Room appeal/desirability: how attractive a space is after access, stress,
  rent, noise, views, layout, and services are considered.
- Reputation: recent transport reliability. It affects whether replacement
  tenants are willing to arrive.
- Money/runway: construction cash plus the recent daily operating result.

## Recovery

Select an unhealthy, vacant, or abandoned room. Read the cause before acting:

- transport/access problems call for a shaft, car, stairs, or escalator;
- missing services call for the named facility;
- low appeal may call for renovation, rent adjustment, or a better tenant mix;
- a room that cannot recover can be converted or demolished when vacant and
  affordable.

Some actions intentionally use a preview before confirmation. Read the
projected effect and confirm only when it matches your plan.
