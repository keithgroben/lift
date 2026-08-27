# Lift rules reference

This is the plain-language rules reference for the current playable model.
Numbers may be tuned during development; the interface should explain the
current result rather than require players to memorize constants.

## Resources and outcomes

- Money comes from occupied-room rent, shop customers, condo sales, and star
  milestone rewards. It is spent on construction, recovery, and services.
- Population is the number of people living or working in occupied spaces.
- Reputation is based on recent transport delivery. It is separate from room
  appeal/desirability.
- Tenants accumulate stress when their trips take too long or cannot be
  served. Stress can cause them to leave.
- Vacant rooms can have a market delay and a minimum appeal/delivery gate
  before they can be re-rented.

## Transport

- A shaft is a vertical route with a bottom floor, top floor, and occupied
  column.
- Cars add dispatch capacity inside a shaft; they do not extend its floor
  span.
- Speed, car capacity, and loading/door time determine throughput.
- A shaft column consumes the same building slot on every floor it crosses.
- Stairs and escalators are local alternatives with their own span, speed, and
  simultaneous-capacity rules.
- A tenant chooses an available route using reachability, walking distance,
  wait, and route crowding. A nearby alternate route can therefore be better
  than a distant elevator.

## Rooms and tenants

- A room has a type, floor, slot, capacity, tenant count, rent, appeal, and
  transport experience.
- Offices create worker traffic. Condos create resident trips. Shops create
  lunch demand and variable customer revenue. Hotels turn over guest demand.
- Tenant mix has target shares. Mix is a bounded preference, not a replacement
  for transport or room quality.
- Higher rent increases income but lowers appeal. Noise from nearby occupied
  rooms lowers appeal, especially for condos.

## Services

Facilities cover a floor range and occupy a placement slot. Different tenant
types require different services, including food, parking, medical, security,
and recycling. Missing required coverage lowers room appeal and may block
re-renting. Services also have recurring daily upkeep.

## Failure and recovery

- Poor delivery lowers reputation and increases tenant stress.
- Poor appeal creates a separate retention pressure.
- When tenants leave, the room becomes vacant rather than disappearing.
- Vacant rooms can be inspected. Depending on their state and the current
  gates, the player may improve access, restore services, renovate, change the
  room type, re-rent, or demolish it.
- Bankruptcy is a real failure state. The player is expected to keep a cash
  reserve instead of spending every dollar on new capacity.

## Visual signals

Color reinforces a named signal; it is never the only source of meaning.

- Green: healthy, clear, improving, or affordable.
- Amber/yellow: watch, partial, uncertain, or a decision that needs review.
- Red: critical pressure, unhealthy conditions, unaffordable action, or unused
  capacity.
- Yellow route outlines identify the currently selected or recommended shaft.
- Red dashed room outlines identify floors without an assigned shaft route.
