# How to play Lift

## The short version

1. Watch the building for a few seconds. People will use the elevator during
   rushes.
2. When waiting rises, select `+ car`, then click the highlighted elevator
   shaft.
3. After the car is added, the game returns to `WATCHING`. Let the next rush
   run. Delivery and reputation should recover.
4. Add rooms or floors only when the building can afford them and transport
   can serve them.
5. If a room becomes unhealthy or abandoned, select it and follow the
   recovery action shown in the room panel.

The repeating loop is:

> build rentable space → attract tenants → observe movement → solve the
> bottleneck → protect occupancy and reputation → expand carefully

Use the visible TIME controls to pause, slow down, or speed up the simulation.
The keyboard shortcuts are optional: Space pauses, and 1/2/3 select the same
speeds.

## What to do on the first screen

The tower starts with a lobby, a left-side elevator shaft, and a few offices
so the first problem is visible quickly. The player HUD should tell you the
current objective and next action. When a transport response is needed, the
top `NEXT ACTION` button opens the matching build flow for you; you still
confirm the placement in the tower. Use the detailed developer view only when
you want to inspect the simulation closely.

The opening mode is `WATCHING`, so clicking the tower cannot accidentally build
anything. Choose a build button first when you want to place a room or route.
Use `new session` beside the objective when you want to restart the first loop;
click the follow-up `confirm new session` control before the tower resets.
If you choose a build action and change your mind, use `cancel action`; it
returns to `WATCHING` without changing the tower.

For the structured first-session check, see
[`HUMAN_PLAYTEST_RELEASE_0.md`](HUMAN_PLAYTEST_RELEASE_0.md).

## Building

- `+ floor` adds another floor.
- `office`, `condo`, `shop`, and `hotel` select a room type, then you click an
  open upper-floor slot.
- `+ shaft` selects a new elevator route. Hover a clear building column to
  choose it, then click the top floor for the shaft span. The game will warn
  you before building if that column is blocked or the span is invalid.
- `+ car` adds capacity to an existing shaft. It is a two-step action: select
  the car tool, then select the shaft.
- Services such as cafeterias and parking are placed on a floor and cover a
  nearby range.

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
