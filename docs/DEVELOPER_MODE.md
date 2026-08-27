# Developer mode and diagnostics

Lift contains a detailed diagnostic view for tuning the simulation and
debugging player reports. It is useful during development but is not the
intended way to learn the game.

## What belongs in developer mode

The detailed view may expose:

- per-shaft queue counts, route spans, car loads, and queue trends;
- elevator, local-route, and unassigned waiting broken out by system;
- first-wave capacity and daily delivery history;
- room evaluation factors such as access, stress, rent, noise, views, layout,
  and service penalties;
- tenant-mix shares, leasing forecasts, vacancy gates, and replacement choices;
- service coverage, served-room health, upkeep, and realized daily results;
- cash runway, operating flow, historical outcomes, and recovery comparisons;
- deterministic replay/export and tuning controls.

## Why the data is separate

The data answers “why did the simulation do that?” The player UI answers “what
should I do next?” Both views use the same state and action paths. Hiding a
diagnostic does not remove the rule behind it; it only keeps the first screen
focused.

## Diagnostic vocabulary

- `W`: waiting people.
- `T`: tenants divided by built room capacity.
- `delivery`: completed trips divided by emitted trips.
- `stress`: accumulated tenant travel frustration against that tenant type’s
  departure threshold.
- `appeal`: room quality independent of transport reputation.
- `desirability`: the tower’s bounded appeal summary, derived from occupied
  room appeal.
- `reputation`: recent delivery reliability used by leasing and tenant
  retention.
- `runway`: cash divided by the recent negative operating result, excluding
  one-time construction spend.

When a diagnostic conflicts with the player-facing summary, treat it as a bug
to investigate rather than asking players to reconcile the two views.
