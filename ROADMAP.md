# Lift roadmap

## Goal

Grow Lift from an elevator-throughput prototype into a SimTower-like building
management game without adding several interacting systems at once.

## Working rule

One feature per task. Each feature gets a small playable change, a visible
explanation in the UI, and a regression test or measured scenario before the
next feature starts. Transport behavior comes before desirability because
desirability will create demand for the transport system.

## Roadmap status — normalized

All recorded incremental milestones through Step 484 are complete. Step 485
is the only active task: expose the combined vacancy choice in the player
guidance. Every
historical incremental task
below now uses an explicit numbered `Step N — complete` or `Step N — in
progress` heading; legacy numbering gaps are preserved rather than guessed.

## Current baseline — complete

- Deterministic, headless elevator simulation.
- Floors, offices, shafts, elevator cars, queues, stress, rent, reputation,
  vacancy, and bankruptcy.
- Basic elevator parameters: capacity, speed, door/loading time, shaft span,
  and a three-car-per-shaft limit.
- Onboarding copy, visible build costs, placement modes, and two-step car
  placement.
- Existing automated checks pass.

## Incremental sequence

### 1. Make transport legible — complete

Added a compact legend and useful per-shaft/per-floor feedback: queue size,
car load, shaft coverage, and accumulated unit stress.

The canvas now makes queue pressure immediate: every floor has a waiting-count
badge that moves from green through amber to red as the queue grows, while the
existing dots and crowd bar show its shape. Occupied rooms also display their
tenant headcount in a separate badge, so room quality and room population are
not conflated. Covered by `test/legibility.test.js` and a live browser check.

Done when a player can look at the screen and answer: “Who is waiting, which
shaft are they using, and why is this car not moving?”

### 2. Model access to shafts — complete

Added horizontal walking time and a shaft-choice score that combines access
distance with the current queue per car. Trips now retain their endpoint units,
so walking time contributes to tenant stress while elevator wait remains a
separate HUD metric.

Done when two shafts serving the same floor can produce different tenant
stress because one is farther away.

### 3. Balance elevator capacity — baseline complete

Tune and test car capacity, number of cars per shaft, travel speed, loading and
unloading time, stop behavior, and shaft span. Add focused scenarios that show
when a second car helps, when a second shaft helps, and when extra cars stop
being useful.

The fixed 15-office scenario across 10 seeds now verifies that a second car
reduces wait substantially, a third car still helps with diminishing returns,
and lower capacity, lower speed, or longer door time each worsen service. The
default values remain unchanged because the measured relationships are already
the intended shape; future playtesting can retune them without losing the
regression coverage in `test/capacity.test.js`.

Done when the major transport choices have understandable tradeoffs rather
than “always buy more cars.”

### 4. Build the evaluation foundation — complete

Added a visible room evaluation layer using only elevator stress and shaft
access distance. Room color and diagnostics now use the score, the HUD shows
the occupied-room average, and vacant rooms need both adequate service
reputation and adequate room evaluation before they can re-let. The existing
delivery-rate reputation remains as a separate tower-wide service signal until
the later tenant-lifecycle pass.

Done when a room’s evaluation explains its tenant behavior and can be improved
by either reducing waits or improving access.

### 5. Add rent as a tradeoff — complete

Added five rent bands for each unit type. Rent now changes daily income and
room evaluation in opposite directions, is adjustable in the UI for the
selected unit type, and is retained for newly built units. The evaluation
diagnostics show the active rent alongside stress and access.

Done when changing rent visibly changes both income and evaluation, with
regression coverage for the direction of both effects.

### 6. Add noise and floor adjacency — complete

Added local, deterministic noise as a separate room-evaluation component.
Occupied offices and shops emit noise, condos are more sensitive than offices,
same-floor neighbors receive the full effect, and rooms directly above or below
receive a smaller effect. The diagnostics now show each room's noise level and
the legend explains that room color includes noise.

Done when placing occupied units beside or above one another visibly changes
evaluation, while vacant units and unrelated transport changes do not create
noise. Covered by `test/noise.test.js`.

### 7. Add services and facilities — complete

Introduced the first real facility: a cafeteria. It occupies a floor slot,
covers its own floor plus one floor above and below, improves room evaluation
when present, and exposes uncovered room/person demand in the diagnostics.
Food coverage is independent of elevator throughput, rent, and noise, and the
canvas shows the facility as a distinct building element.

Done for these first two services when a player can place each facility, see
exactly which floors it covers, and see its own room-evaluation signal improve
only inside that coverage. Covered by `test/food.test.js` and
`test/parking.test.js`.

Added a third independent service: clinics unlock with the condo tier, cover
their floor plus three floors above and below, and affect only unit types with
a medical need. Condo medical demand is shown separately from food and
parking, while offices receive no artificial medical penalty. Covered by
`test/medical.test.js`.

Added a fourth independent service: security desks cover their floor plus four
floors above and below, apply a small security need to occupied unit types,
and expose uncovered room/person demand separately. The UI now labels the
combined diagnostics as systems and includes facilities in the legend. Covered
by `test/security.test.js`.

Added the final first-pass service: recycling. Occupied rooms produce a small,
unit-type-specific waste demand; recycling facilities cover their floor plus
two floors above and below, improve room evaluation inside that range, and
show covered waste separately in the systems panel. Covered by
`test/recycling.test.js`.

### 8. Improve vacancy and tenant lifecycle — recovery actions and move-in selection complete

Make abandoned units inspectable, then add one deliberate recovery action at a
time: re-rent, renovate, convert, or demolish. Connect move-in decisions to
evaluation instead of only delivery rate.

Abandoned rooms are now labeled `EMPTY`, clickable, and inspectable. The room
inspector shows vacancy age, evaluation, stress, and rent, explains why
re-renting is unavailable when it is gated, and offers a paid re-rent action
when the room evaluation is high enough. Re-renting costs $600, restores
occupancy and tenant stress, resets the vacancy counter, and records a
`rerented` event. Covered by `test/lifecycle.test.js` and a live browser check.

Renovation is a separate recovery action. A vacant room can be renovated once
for $900; it gains a persistent +12 room-evaluation bonus, remains vacant, and
can then be re-rented as a separate action. Occupied rooms and already
renovated rooms are rejected, and the inspector shows both actions and their
gating. Covered by `test/lifecycle.test.js` and a live browser check.

Conversion is now a separate recovery action for abandoned rooms. The player
can convert a vacancy to any other unlocked unit type for $1,000; the room
updates its tenant headcount, rent, and lifecycle rules, stays vacant, and
resets its renovation state so the new use must be evaluated on its own. The
inspector only offers unlocked target types, and re-renting remains explicit.
Covered by `test/lifecycle.test.js`.

Move-in demand is now finite and evaluation-driven. Each day, eligible vacant
rooms compete for a limited number of replacement tenants; the highest room
evaluations are selected first, while rooms below the evaluation or reputation
gate remain vacant. The systems panel reports how many vacancies are ready and
explains the 55+ evaluation / good-reputation requirement. Covered by
`test/lifecycle.test.js` and a live browser check.

Demolition is now a deliberate, confirmed recovery action. A vacant room can
be permanently removed for $250; the room disappears, its floor slot becomes
available for reuse, and the action records a `demolished` event. Occupied and
unaffordable rooms are protected, and the inspector requires a second click
after showing a permanent-action warning. Covered by `test/lifecycle.test.js`
and a live browser check.

### 9. Expand the SimTower ecosystem

Add richer offices, condos, shops, hotels, lobbies, stairs/escalators, and
special facilities only after their demand and evaluation rules are clear.

The first ecosystem element is now an explicit lobby. It occupies a chosen
ground-floor slot, prevents a shaft from being built through that slot, and
adds the lobby-to-shaft walk to ground-floor trips and room evaluation. The
starter setup places the lobby before the initial shaft, and the canvas,
building panel, and transport diagnostics identify it clearly. Covered by
`test/lobby.test.js` and a live browser check.

Stairs are now the first separate access system. A stairwell starts at the
lobby, occupies one continuous column through a bounded local span, and offers
a slower route that does not consume elevator-car capacity or queue time.
Stair travel is considered by trip routing and room evaluation, and the build
panel, canvas, and transport diagnostics make the route visible. Covered by
`test/stairs.test.js` and a live browser check.

Escalators are now a faster transport variant. They use their own cost and
travel speed, still occupy a continuous local column from the lobby, and are
selected ahead of stairs when their route is faster. They do not consume an
elevator car or add elevator queue time. Covered by `test/escalator.test.js`
and a live browser check.

The lobby can now expand into additional ground-floor entrance slots for $350
each. Trips use the nearest lobby entrance to their selected circulation, so
expansion can reduce ground-floor walking while preserving elevator and local
transport bottlenecks. The expanded footprint is visible and protected from
other building columns. Covered by `test/lobby.test.js` and a live browser
check.

Hotels are now a distinct tenant type unlocked at 160 population. A hotel
starts with six booked guests, creates one check-in and one check-out trip per
guest each day, and earns rent per occupied guest-night. Building reputation
controls the next booking load down to a two-guest floor instead of making the
hotel behave like a permanent office; the guest count is visible in the room
badge and room evaluation uses the hotel profile. Covered by
`test/hotel.test.js` and a live browser gate check.

Star progression now has one-time milestone rewards. Reaching 60, 160, or 320
population awards $4,000, $8,000, or $16,000 respectively; rewards are tracked
in state and events, included in day accounting, and remain claimed if the
tower later loses population. The HUD shows the next target, remaining
population, and reward. Covered by `test/progression.test.js` and a live HUD
check.

### 10. Add progression and tower identity

Turn population, evaluation, facilities, VIPs, events, and milestones into a
proper star-rating progression. Add desirability features such as amenities,
layout quality, prestige, and tenant preferences after the underlying needs
are working.

The first desirability signal is now a capped view premium: each higher floor
adds a small room-evaluation bonus up to +12, while transport access remains a
separate penalty. The contribution is shown in the room diagnostics and
inspector so a better view cannot be mistaken for better elevator service.
Covered by `test/evaluation.test.js` and a live diagnostics check.

Cafeterias now provide a separate amenity bonus of +6 evaluation to covered
rooms, in addition to removing the existing food-need penalty. The bonus is
per room rather than per cafeteria, so adding duplicate coverage cannot create
an unbounded desirability exploit. The food systems panel and room diagnostics
explain the contribution. Covered by `test/evaluation.test.js` and a live
placement check.

Tenant floor preference is now a bounded evaluation signal. Office, condo, shop,
and hotel profiles each declare a preferred floor; rooms farther from that
floor lose a capped fit score, and the contribution is shown in diagnostics
and the inspector. Covered by `test/evaluation.test.js` and a live diagnostics
check.

Mixed-use floor layout now has a small, non-stacking bonus. A room gains the
bonus when a nearby slot on the same floor contains a different occupied tenant
type; existing noise penalties still apply, so grouping uses is a meaningful
tradeoff rather than a free desirability exploit. Covered by
`test/evaluation.test.js` and a live diagnostics-label check.

Vacancy refill now includes a bounded tenant-mix demand signal. Tenant profiles
declare target population shares; when a type is underrepresented, eligible
vacancies of that type receive up to +6 move-in priority. Room evaluation and
reputation gates still apply, and the selection event records the demand bonus.
The leasing panel explains the rule before vacancies occur. Covered by
`test/lifecycle.test.js` and a live leasing-panel check.

The same tenant-mix model is now visible in a dedicated demand breakdown. The
systems panel reports each unlocked type's occupied people, current share,
target share, and whether it is oversupplied or in demand. This makes the refill
priority actionable before the player converts or builds a room. Covered by
`test/lifecycle.test.js` and a live systems-panel check.

Vacancies now expose their active lease gate instead of only showing an age
counter. A room is classified as a new vacancy, needing improvement, blocked
by reputation, or ready to lease; the inspector and systems panel use the same
classification, while manual re-renting remains a separate paid action.
Covered by `test/lifecycle.test.js` and a live systems-panel check.

Shop demand is now spatially tenant-specific. Office workers create lunch
traffic only for occupied shops within the configured three-floor catchment,
so a shop's location matters and out-of-range shops do not receive phantom
customers. The systems panel shows each shop's customers served today and
explains the catchment. Covered by `test/commercial.test.js` and a live
systems-panel check.

Hotel demand is now visible as its own capacity signal. The systems panel shows
booked guests against total hotel capacity for each room and explains that
reputation controls the nightly load between the configured minimum and maximum.
The existing per-guest booking trips and rent remain separate from room
evaluation and elevator service. Covered by `test/hotel.test.js` and a live
systems-panel check.

Hotel booking load now also responds to hotel-specific room quality. A healthy
reputation cannot fully fill a hotel with no usable access or a sub-threshold
room evaluation; the load falls toward the configured minimum while preserving
the guaranteed floor. The occupancy event records both reputation and room
evaluation, and the live panel shows the evaluation beside each hotel room.
Covered by `test/hotel.test.js` and a live systems-panel check.

Hotel room diagnostics now break that quality into required services. Each hotel
row reports how many of its food, parking, security, and recycling needs are
covered and lists missing services, so improving bookings has an actionable
service path rather than an opaque score. Covered by `test/hotel.test.js` and a
live systems-panel guidance check.

Hotels now expose a separate guest-experience score. It combines tenant stress
and required-service coverage, reports both penalties, and appears beside the
hotel's booking count; it is deliberately not another booking-load input yet,
so players can see the experience signal before we tune its downstream effect.
Covered by `test/hotel.test.js` and a live systems-panel guidance check.

Hotel guest feedback now persists as a daily trend signal. Day close records
average hotel experience, occupied hotel rooms, and booked guests; the live
panel reports the first reading and whether the latest feedback rose, fell, or
held steady. This is observational for now and does not add another hidden
booking rule. Covered by `test/hotel.test.js` and a live systems-panel check.

Prior hotel feedback now gently affects the next night's booking load. The
bounded factor can reduce demand by up to the configured 25% while preserving
the room's minimum guest count; occupancy events record the factor, and the
hotel panel shows it directly. Reputation and room evaluation remain separate
inputs. Covered by `test/hotel.test.js` and a live systems-panel check.

Hotel feedback is now guest-weighted across occupied rooms. A room with more
booked guests contributes proportionally more to the building's feedback
signal, while the panel and day log continue to expose the room count and total
guests used. Covered by `test/hotel.test.js` and a live systems-panel check.

Hotel booking feedback now uses a configurable three-day guest-weighted history.
One unusually good or bad night therefore has a measured effect on the next
booking load instead of replacing the whole signal; the panel identifies the
smoothing window. Covered by `test/hotel.test.js` and a live systems-panel
check.

The hotel panel now exposes the individual recent feedback records behind that
window, including day, score, and represented guests. Scores use the same
good/watch/poor colors as room experience, so the booking factor can be traced
back to visible history. Covered by `test/hotel.test.js` and a live
systems-panel check.

Building reputation now has its own compact recent history. Each record shows
the reputation reading alongside delivery rate, average wait, and riders who
gave up, making transport pressure visible instead of leaving reputation as an
opaque percentage. Covered by `test/lifecycle.test.js` and a live
systems-panel check.

The reputation panel now turns those causes into one recommended next move. It
distinguishes observing a first day, building a missing shaft, adding a car,
adding route capacity, and checking floor coverage; it never performs the
action automatically. Covered by `test/lifecycle.test.js` and a live
systems-panel check.

Recommendations now respect the current game state. They account for money,
unlock milestones, shaft car limits, required lobby access, and clear route
columns, switching to a save, unlock, or placement message when a proposed
fix is not currently possible. Covered by `test/lifecycle.test.js` and a live
systems-panel check.

The recommended next move now highlights its matching build control and adds a
recommendation marker to the control's title. The player still has to choose
and place the improvement manually; the highlight only closes the gap between
diagnosis and action. Covered by a live bad-delivery check and the
recommendation assertions in `test/lifecycle.test.js`.

Reputation now gently scales the existing underrepresented-tenant demand bonus.
A poor but still leasable building attracts fewer of those replacement tenants,
while room evaluation remains a separate desirability signal; the tenant-demand
panel shows the active reputation multiplier. Covered by `test/lifecycle.test.js`
and a live systems-panel check.

That multiplier is calibrated against the transport gate: it ranges from a
75% floor to 100% at healthy reputation, while the existing 55% relist gate
still controls whether leasing can happen at all. This keeps reputation from
overpowering transport failure or room quality. Covered by
`test/lifecycle.test.js` and a live systems-panel check.

Healthy reputation now also shortens an eligible vacancy's market delay by up
to one day. The effect never bypasses the 55% reputation gate, and the same
calculation drives the vacancy status, inspector explanation, and day-close
move-in eligibility. Covered by `test/lifecycle.test.js` and a live
systems-panel check.

Leasing now has a player-visible forecast backed by the same candidate ranking
as day close. It reports vacancies that pass evaluation and market timing,
whether the reputation gate is open, and the number of move-ins the daily
capacity can accept; the forecast does not create a second eligibility rule.
Covered by `test/lifecycle.test.js` and a live systems-panel check.

The forecast now identifies its highest-priority eligible vacancy and provides
an inspect button that selects the room in the existing inspector. This is a
read-only handoff into the player's repair or re-rent decisions; it does not
change occupancy or spend money. Covered by `test/lifecycle.test.js` and a
live leasing-panel check.

The tenant-demand panel now forecasts the next tenant type and the projected
occupied mix after the forecasted move-in batch. It reuses the same ranked
vacancies and daily capacity, so the projection is explanatory rather than a
second demand system. Covered by `test/lifecycle.test.js` and a live
systems-panel check.

The forecast now highlights the matching tenant build control when a next type
exists. When it does not, the panel distinguishes locked tenant types from
unlocked types with no current demand, keeping the forecast explanatory and
manual. Covered by `test/lifecycle.test.js` and a live systems-panel check.

The tenant-demand panel now keeps a compact daily mix history. Each snapshot
reports a balance score and color-coded direction toward or away from target
shares, so the forecast can be compared with the building's actual trend.
Covered by `test/lifecycle.test.js` and a live systems-panel check.

The tenant-demand panel now identifies the largest under- or over-supplied
unlocked tenant type and offers a direct room inspection. Vacant rooms remain
actionable; occupied rooms are explicitly read-only, so this diagnostic does
not change leasing behavior. Covered by `test/lifecycle.test.js` and a live
read-only inspector check.

When a tenant type is under target, the mix focus now offers an explicit
`select build` response. It only arms the existing placement tool; the player
still chooses the floor and confirms construction. Over-supplied types remain
inspection-only. Covered by the simulation suite and live visible-control
verification.

Over-supplied types now explain the next safe response: review converting a
vacant over-supplied room toward the largest under-supplied type. Occupied
rooms remain protected and read-only, and no conversion is performed by the
diagnostic itself. Covered by the lifecycle regression suite and live
over-supply guidance verification.

Conversion review is now a two-step preview and confirmation. The inspector
shows the room-capacity change and projected tenant share after re-renting,
while the first click only arms the conversion. Covered by the lifecycle
regression suite and live page-load verification.

Tenant-unit placement now uses the same clear preview language before a floor
is chosen: the selected type shows its expected capacity, role, and target
population share. Covered by the evaluation suite and live placement-preview
verification.

The tenant-demand panel now includes a compact upper-floor mix view. Each row
shows actual occupants by type against the building-wide target, plus vacant
rooms and remaining buildable slots, so placement has a visible spatial
context. Covered by the evaluation suite and live floor-view verification.

Hovering an upper floor while a tenant unit is selected now previews that
room's contribution to the building-wide mix, including floor availability,
capacity added, and actual share versus target after construction. The preview
does not change state until the player clicks. Covered by the evaluation suite
and live hover verification.

Placement now adds a small safety affordance: full floors clearly ask the
player to choose another floor, while a placement that would materially reduce
mix balance requires a second click after showing the before/after balance.
Ordinary placements remain one click, and no warning changes state on its own.
Covered by the evaluation suite and live normal-placement verification.

Placement preview now carries the floor-level room evaluation alongside the
mix impact. It shows the projected evaluation and access route for the selected
room on the hovered floor, and a risky-placement confirmation keeps those
quality details visible. Covered by the evaluation suite and live combined
preview verification.

The placement preview now explains why the hovered floor differs from the best
available floor for that tenant type. It surfaces the largest quality signals
directly—access, fit, view, noise, and missing services—without choosing the
floor for the player. Covered by the evaluation suite and live why-this-floor
verification.

The floor mix view now lets the player select two open candidate floors and
compare their room evaluations and quality signals side by side. The
comparison is read-only and does not select or build a floor automatically.
Covered by the evaluation suite and live two-floor comparison verification.

The comparison now supports a pinned preferred floor. The pin and both
candidate floors remain in place while the player changes tenant type, with
the quality scores recalculated for the new type. Removing the pinned floor or
starting a different build action clears the comparison intentionally. Covered
by the evaluation suite and live tenant-type persistence verification.

The placement status now carries the pinned floor's expected tenant fit before
the player commits a room. Hovering another candidate also reports its score
difference from the pinned floor, while the pinned floor is identified as the
preferred choice. Covered by the evaluation suite and live pinned-fit preview
verification.

Each compared floor now also shows the selected tenant type's projected mix
share, target share, and building-wide balance change. The values are shown on
both cards and recalculate when the tenant type changes, so desirability and
tenant mix can be weighed together. Covered by the evaluation suite and live
projected-mix comparison verification.

Each comparison card now adds a concise decision label: quality and mix
aligned, quality works with a mix tradeoff, mix-safe with a quality warning,
or a combined warning. This gives the player an immediate read before the
underlying scores and reasons. Covered by the evaluation suite and live
decision-label verification.

The comparison summary now handles a candidate that becomes full after a
placement. It identifies an unavailable pinned floor, retains the reason on
its card, and provides a remove action so the player can choose a replacement
without losing the remaining candidate. Covered by the evaluation suite and
live full-floor comparison verification.

Unavailable comparison cards now offer one-click replacement choices from
open floors. Replacing a pinned candidate transfers the preferred pin to the
new floor, while the other candidate remains in place. Covered by the
evaluation suite and live replacement-flow verification.

Replacement choices now carry the same decision label as the main comparison
cards, alongside the candidate floor and room score. The player can therefore
see whether the replacement is aligned or a tradeoff before swapping it in.
Covered by the evaluation suite and live labeled-replacement verification.

Replacement choices now also show the projected tenant-mix share, target, and
balance change before the swap. This keeps the full quality-and-mix decision
context visible even while replacing a floor that has just become full.
Covered by the evaluation suite and live projected-mix replacement verification.

Replacement choices now explicitly identify the current tenant type they are
calculated for. After a type switch, their decision label, projected mix, and
pin-preserving swap all recalculate for the new type rather than using stale
context. Covered by the evaluation suite and live tenant-type replacement
verification.

Replacement choices now identify the strongest combined decision first, then
use room score and floor number as tie-breakers. This keeps the replacement
list aligned with both desirability and tenant-mix tradeoffs as floor-sensitive
mix rules grow. Covered by the evaluation suite and live combined-ranking
verification.

When the strongest replacement is a quality-and-mix tradeoff, the replacement
panel now explains that room quality clears the relist minimum while tenant-mix
balance falls. This makes the combined-ranking choice legible instead of
leaving the player to infer why a warning-colored option is still first.
Covered by the evaluation suite and live replacement-panel verification.

That explanation now names the next lower decision category and its floor when
one exists. The player can see the tradeoff and the weaker alternative it
outranks, instead of treating the combined ranking as a hidden rule. Covered
by the evaluation suite and live replacement-panel verification.

Selecting the first still-available comparison floor now immediately shows its
room evaluation, combined decision label, and projected tenant-mix balance in
the mode line. The player gets the same quality-and-mix context before choosing
the second floor, rather than waiting for the comparison pair to be complete.
Covered by the evaluation suite and live one-floor comparison verification.

Once two floors are compared, each available card now explicitly identifies
itself as the stronger or weaker combined choice, with ties called out as the
same signal. The labels follow decision strength first and room score second,
matching replacement ranking. Covered by the evaluation suite and live
two-floor comparison verification.

The weaker card now also shows the size of its disadvantage: decision-tier
distance when the categories differ, or the room-evaluation-point gap when the
categories match. This turns the stronger/weaker label into a measurable
comparison while preserving the combined ranking. Covered by the evaluation
suite and live comparison-gap verification.

The stronger card now states which signal made it win: a higher decision
category when quality and mix disagree, or a higher room evaluation when the
categories match. Together with the weaker-card gap, the completed comparison
now explains both the cause and size of the recommendation. Covered by the
evaluation suite and live winner-reason verification.

When both compared floors have the same combined signal and room score, the
pair now explicitly says there is no measurable combined advantage. This keeps
the comparison honest and prevents a visual tie from implying a hidden winner.
Covered by the evaluation suite and live equal-comparison verification.

Normal placement hover now includes the same combined decision label as the
comparison cards, alongside room evaluation, projected mix, and the underlying
reasons. A player can therefore read the quality/mix outcome before committing
to a build or comparison choice. Covered by the evaluation suite and live
placement-hover verification.

When the hover decision is driven by a negative tenant-mix signal, it now names
that cause and the size of the balance drop: a mix tradeoff, or a combined
mix-and-quality warning. Safe-mix quality warnings remain concise because mix
is not the cause there. Covered by the evaluation suite and live placement
hover verification.

The same negative-mix explanation is now available on completed comparison
cards and replacement options, so the cause does not disappear after the
player moves from hovering to deciding. Safe-mix candidates do not receive
duplicate warning text. Covered by the evaluation suite and live comparison
verification.

The pre-construction confirmation warning now carries that same explicit
mix-signal reason before asking for the second click. A player sees the named
tradeoff and balance drop before construction commits, rather than only seeing
the raw before-and-after percentages. Covered by the evaluation suite and live
placement-confirmation path verification.

The confirmation warning now also explains the benefit of changing floors: it
names the best alternative and its room-evaluation gain, or says when no
higher-quality alternative exists. This gives the player a concrete response
to the warning before construction commits. Covered by the evaluation suite
and live placement-warning path verification.

Alternative-floor guidance now also calls out component gains when the better
floor improves them: reduced access walking and newly covered services appear
alongside the room-evaluation gain. This keeps the warning tied to the actual
desirability model instead of treating its total score as a black box.
Covered by the evaluation suite and live placement-warning path verification.

The confirmation warning now separates the two strategic responses: move the
tenant to the better floor, or keep the selected floor and invest in the access
route and uncovered services that are lowering its evaluation. The player can
therefore choose between a location change and a building improvement instead
of reading every problem as a reason to abandon the floor. Covered by the
evaluation suite and live game verification.

That investment path now names the actual build tools and visible costs: a
shaft base plus span for access, or the matching cafeteria, parking, clinic,
security, and recycling prices for uncovered services. The player can connect
the warning to a concrete next button instead of translating a generic “invest
in services” hint. Covered by the evaluation suite and live build-panel
verification.

Investment guidance now checks the same constraints as the build panel before
describing an option as ready: it reports the amount still needed, the
population unlock milestone, or the lack of an open covered floor when the
investment cannot happen yet. This prevents the desirability warning from
pointing at a fictional immediate fix. Covered by the evaluation suite and
live availability-state verification.

When several usable fixes remain, the warning now identifies the smallest
useful first move by cost, with evaluation impact breaking ties. The player can
see all relevant tradeoffs without having to decide which affordable repair to
try first. Covered by the evaluation suite and live placement-guidance
verification.

The smallest useful investment is now surfaced directly on its matching build
button with a distinct “best fix for warning” marker. This connects the text
recommendation to the control the player must select, while preserving the
disabled state when the fix still needs money or an unlock. Covered by the
evaluation suite and live build-panel verification.

Choosing that marked tool now preserves the warned floor as an improvement
target in the placement mode line, and the target clears after a successful
build or when the player chooses a different tool. This keeps the player from
losing the original context while moving from diagnosis to construction.
Covered by the evaluation suite and live tool-selection verification.

The preserved target now guides the placement click itself: shafts must reach
the target floor, while service buildings may be placed on any open floor in
their coverage range. Out-of-range clicks are stopped with the exact valid
range, so an investment cannot be spent somewhere that leaves the warned room
unimproved. Covered by the evaluation suite and live placement-mode
verification.

The same target is now visible on the tower canvas: the target floor receives a
strong highlight, and valid reach or service-coverage floors receive a lighter
guide. This lets the player read the construction choice spatially before
clicking, without obscuring the rooms, shafts, or queues underneath. Covered by
the renderer test and live canvas verification.

The canvas guide now distinguishes usable floors from floors that are in range
but have no open placement column. Open options retain blue guidance, while
full or blocked options use a red treatment and explicit FULL labels. This
prevents a service-coverage highlight from implying that the player can place
there. Covered by the renderer test and live canvas placement verification.

The guide now reacts to the hovered floor: the pointer gets a stronger outline
on the canvas, and the mode line explains whether that floor is an open target,
full, blocked, or outside the valid range before the click. This makes the next
placement and its reason visible in advance. Covered by the renderer test and
live hovered-canvas verification.

The placement guide now includes a compact legend that explains TARGET, VALID,
and FULL, and it appears only while an improvement target is active. This keeps
the canvas colors self-explanatory without adding noise to ordinary play.
Covered by the renderer test and live legend verification.

The suggested infrastructure path now includes a room-evaluation preview before
placement. As the player hovers a valid floor, the panel shows the target room's
current score, projected score, and signed improvement for the cafeteria or
shaft. The preview is calculated without mutating the building. Covered by the
evaluation suite and live placement-preview wiring verification.

The investment preview now identifies the causes behind that score change, such
as access, food or parking coverage, and amenity. The player can see both the
overall score delta and the evaluation components that produced it before
committing the build. Covered by focused component-impact assertions and live
ordinary-play verification.

After a suggested shaft or service is placed, the same target-specific panel
reports the realized score transition and the components that changed, then
clears itself after a short interval. Ordinary infrastructure placement remains
free of unrelated result messaging. Covered by forecast-versus-outcome tests
and live ordinary-placement verification.

The investment result now remains available through the next placement of the
suggested tenant type. The forecast accounts for the room slot that remains
after the infrastructure is installed, and the UI records the occupied room's
actual evaluation beside the forecast for comparison. Covered by the
forecast-versus-actual evaluation test and live ordinary-placement verification.

The occupied-room check now also observes the first full simulated day. It
reports the day-one score, stress, and drift from the move-in evaluation, making
rent and tenant-stress effects visible before changing their balance. Covered
by the first-day stress-drift test and a live day-boundary check.

The first-day report now names the components behind any drift, including
stress, noise, rent, access, service coverage, amenity, and fit. Measurement
across baseline and constrained towers found no global weight change justified
yet; the component evidence is now visible for the next tuning pass. Covered
by the drift-component test and live display-wiring verification.

The result now keeps a bounded three-day trend for the tracked room rather than
letting one first-day outlier stand alone. Each new day-close reading replaces
the oldest reading after the window is full, while the move-in score remains the
baseline for comparison. Covered by the bounded-trend test and live day-close
verification.

The trend now flags SUSTAINED LOW EVAL only when two occupied readings in a row
fall below the relisting threshold. A single bad day or a room that has already
vacated does not trigger the warning, keeping the signal useful for tuning and
player decisions. Covered by repeated-reading and vacated-reading assertions,
plus live display-wiring verification.

Sustained low evaluation now leads to a concrete room response: occupied rooms
offer an inspection, vacant unrenovated rooms point toward renovation before
re-renting, and renovated vacancies point back to leasing blockers. The initial
game remains quiet until the sustained warning exists. Covered by response-rule
tests and live clean-state verification.

The sustained room-health warning now appears in the main diagnostics list as
well as the investment result panel, with the same room-opening action. It
remains absent until the repeated occupied-reading rule is satisfied. Covered
by response tests and live clean-state verification.

Sustained room warnings now remain in a bounded three-entry room-health history
after the temporary investment result expires. Rechecking a room refreshes its
entry instead of duplicating it, and the current room state still determines the
next action. Restarting a tower clears the history. Covered by bounded-history
tests and live clean-state verification.

The retained entries now compare their historical warning with the room's live
evaluation: unresolved problems show ACTIVE LOW EVAL, while recovered rooms stay
visible as RESOLVED HISTORY with their current score. Both states keep the room
open action available for inspection. Covered by active/resolved status tests and
live clean-state verification.

Active history entries now expose the most relevant repair action directly:
unrenovated vacancies can be renovated from diagnostics, while occupied or
already-renovated rooms open for inspection. Resolved entries remain visible as
monitor-only history. Covered by action-selection tests and live clean-state
verification.

Room-health history now shows the current score delta against its retained
warning average as improved, worsened, or steady. This gives the player a quick
direction-of-travel signal without opening the room, and stays absent until
history exists. Covered by score-change tests and live clean-state verification.

Each retained warning now records the score and delta from its latest history
refresh, labeled by day, while still showing the live score change separately.
This makes it clear when the checkpoint was taken and whether later movement is
new or historical. Covered by refresh-delta assertions and live clean-state
verification.

Starting a new tower now explicitly announces that room-health history was
reset, while the reset removes all prior entries and temporary investment
results. Covered by live restart verification alongside the existing clean-state
checks.

The diagnostics panel now includes a compact room-health legend even before any
warning exists. It defines ACTIVE LOW EVAL, RESOLVED HISTORY, and the
improved/worsened/steady score-change labels, while the empty state confirms
that no warnings are being carried forward. Covered by live clean-state
verification.

Retained room warnings now show both their refresh day and age: fresh, 1 day
old, or a longer day count. This makes stale history distinguishable at a glance
without changing the warning itself. Covered by age-label assertions and live
clean-state verification.

Active warnings that are at least two days old now use a stronger
STALE ACTIVE LOW EVAL label and heavier visual treatment; fresh active warnings
and resolved history retain their normal emphasis. The legend explains the
stale threshold. Covered by urgency-boundary assertions and live clean-state
verification.

Room-health history is now ordered by urgency: stale active warnings first,
then fresh active warnings, then resolved history; older entries lead within
each group. Covered by priority-boundary assertions and live clean-state
verification.

The urgency ordering is now applied directly to the diagnostics list without
mutating the stored history. A deterministic priority keeps stale active rooms
at the top, while age and refresh day break ties. Covered by priority assertions
and live clean-state verification.

Room evaluation diagnostics now show each occupied room's tenants against its
configured capacity, with full, partial, and light-load color cues. The cue is
derived from the same per-room capacity data used by placement and leasing.
Covered by tenant-load assertions and live clean-state verification.

The room evaluation section now explains those load colors in place: full is at
least 75%, partial is 50–74%, and light load is below 50%. The legend is present
even before any warning history exists. Covered by live clean-state verification.

Canvas room badges now mirror the tenant-load signal with a tenants/capacity
readout and a matching colored outline/text: full, partial, or light load. The
canvas uses the same load classification as the diagnostics rather than creating
a second occupancy rule. Covered by shared tenant-load assertions and live page
rendering verification.

The HUD now shows a tower-wide tenants/capacity total alongside population. It
counts tenants only in occupied rooms but includes every built room's capacity,
including vacant rooms, so the number represents actual building utilization.
Covered by tenant-summary assertions and live HUD verification.

The HUD now adds the utilization percentage beside that total, using the same
load color as the room and canvas indicators. Starting utilization is shown as
100%, and vacant built rooms continue to reduce the percentage. Covered by live
HUD verification.

The HUD now reports day-over-day utilization change in percentage points after
each day closes, with positive, negative, and steady states color-coded. A new
tower begins with no prior-day delta and establishes a fresh baseline. Covered
by utilization-delta assertions and live day-close verification.

The HUD now keeps a compact six-reading utilization history and renders it as
an oldest-to-newest sparkline. The sparkline shares the improved, worsened, and
steady colors and explains its direction through a hover label. Covered by
trend-shape assertions and live multi-day verification.

Building diagnostics now expose the same recent utilization history as exact
day/percentage readings beside the sparkline, so the trend is readable without
hovering. The diagnostics explain that readings run oldest to newest and that
higher percentages mean more occupied capacity. Covered by history-label
assertions and live multi-day diagnostics verification.

Building diagnostics now add a plain-language management hint once enough daily
readings exist. A sustained decline points first to vacant rooms, then to low
tenant experience, with a demand fallback; shorter histories simply tell the
player to keep watching. Covered by hint-priority assertions and live startup
and day-2 diagnostics verification.

The management hint now points into the existing action flow: vacancy warnings
offer an inspect-vacancy button, experience warnings offer the lowest room, and
demand warnings point to the tenant-demand diagnostics. The action target is
chosen from the current tower state rather than a hard-coded room. Covered by
action-target assertions and live hint rendering verification.

Selecting a management-hint room now confirms the handoff in three places: the
room inspector opens, the mode line names the room as opened from the hint, and
the diagnostics retain a “now in focus” confirmation while a toast provides an
immediate acknowledgment. Covered by focus-label assertions and a live stress
scenario that opened a vacant room from the warning.

The focused room inspector now includes a “why this matters” line tied to the
tower utilization summary. Vacancies explain their unused capacity, while
occupied rooms explain how their tenant count and evaluation protect or risk
the current utilization level. Covered by room-context assertions and live
focused-inspector verification.

Ready vacant rooms now expose a direct “re-rent now” recovery action inside the
utilization context. It respects the existing lease-readiness, evaluation, and
funds gates, then restores occupancy, closes the inspector, and confirms the
recovery in the mode line and toast. Covered by recovery-path assertions and a
paused live stress scenario that raised utilization from 25% to 38%.

Successful re-rents now add an immediate `R` recovery reading to the compact
utilization history, including the percentage-point gain; normal day-close
readings remain marked `D`. The diagnostics legend explains both markers, making
the start of a recovery visible before the next day closes. Covered by recovery
result and history-label assertions plus a live paused recovery scenario.

Recovery readings are now visually distinct in the HUD sparkline: the recovery
bar receives an outlined info-color marker while daily readings remain plain.
The marker keeps a “re-rent recovery” label, and the exact `R` reading remains in
diagnostics. Covered by trend-segment assertions and a live recovery-marker
verification.

The HUD now shows a short latest-recovery summary beside the utilization trend,
such as `R +6 tenants`, after a successful re-rent. It stays blank until an
intervention happens and its tooltip includes the utilization-point gain, while
diagnostics retain the exact history entry. Covered by recovery-summary
assertions and a live paused recovery scenario.

After a later day closes, the same badge now ages to a muted `last R +6 tenants`
label and its tooltip reports how many days ago the intervention happened. This
keeps the latest recovery useful as context without making it look like a new
actionable warning. Covered by aged-summary assertions and a live day-close
transition check.

Waiting and tenant-load indicators now share one traffic-light vocabulary:
green means healthy or clear, yellow means watch, and red means critical
pressure or unused capacity. The shared color key drives the HUD utilization
value, room `tenants/capacity` badges (including vacant rooms), floor queue
badges, and transport diagnostics. A compact legend explains the meaning in
the transport panel. Covered by shared color-key assertions and a live check
showing `0`/small queues, `6/6` rooms, and a red `12/48` tower load.

The HUD now adds a live tower-wide `waiting now` count. It updates during the
simulation rather than only at day close, uses the same queue thresholds as the
floor badges, and labels `avg wait` as the separate historical service metric.
Covered by the existing queue-threshold tests and a live run that observed
green, yellow, and red queue states before returning to zero.

The transport panel now offers a selectable row for every floor, combining its
current waiting count with local `tenants/capacity`, room count, and vacancies.
The selected floor adds a plain-language diagnosis that distinguishes elevator
queue pressure from unused leasing capacity. Rows refresh when the live queue
changes, so the local view stays current mid-day. Covered by floor-summary
assertions and a live selected-floor check during an active queue.

Selected-floor diagnoses now offer a guarded next-action handoff: queue pressure
can select the car or shaft control, while local vacancies can open a room for
inspection. These links only prepare or focus the next step; construction and
re-renting still require the player's final click. Covered by live checks for
both the transport and vacancy paths.

Those handoffs now show a small expected-effect preview before commitment. A
car preview states its added rider capacity per dispatch, a shaft preview
explains the independent route, and a vacancy preview shows the local
`tenants/capacity` change if the room is re-rented. The preview clears when the
floor focus changes or the action completes. Covered by handoff-preview
assertions and live transport and vacancy flows.

The selected floor now remembers its reading through the next day close. After
an intervention, the local panel reports an improved, worsened, mixed, or
steady result with before/after waiting and tenant counts, and identifies the
handoff that was tested. The baseline resets when the player changes floor
focus, so the comparison stays local and understandable. Covered by diagnosis
change assertions and a live car intervention that reduced `11 → 0` waiting.

## Step 110 — complete

Task: use the local result to refine the next-action recommendation, so an
intervention that did not help points to a different transport or leasing
response instead of repeating the same control.

The selected-floor recommendation now reacts to the last result: successful
interventions say to monitor, while an ineffective car or shaft handoff points
to the alternate transport response. A failed vacancy recovery points back to
room-quality inspection instead of repeating leasing blindly. Covered by
next-action assertions and a live selected-floor handoff check. Completed
results now stay visible until the player starts a new test, so the recommendation
does not lose the handoff source at the next day close.

The floor list now adds a green `working` marker to the floor that just showed
an improved local result. It lasts for that confirmation day only, keeping the
feedback visible without turning an old success into a permanent status.
The recent result is now retained per floor, so changing focus does not erase
the earlier floor's marker or its explanation. Covered by working-state
assertions and the existing live floor-list check.

The marker now explains its age: `working today`, `1d old`, or `2d old`, with
older results fading out. The first state is green; older cues turn yellow and
tell the player to take a fresh reading. Covered by age-transition assertions.

The focused floor diagnosis now repeats the same age cue beside the last local
result and explains what that age means, keeping the floor list and detail
panel in one visual language. Covered by the same age-transition assertions.

The selected floor now keeps a compact history of the last four completed,
player-started tests, showing the day, response type, result, and before/after
reading. Passive floor readings are excluded, so the history stays about
interventions rather than becoming a general event log. Covered by history
retention assertions and a browser smoke check.

The history now warns when the same response has failed twice on one floor.
Transport failures still redirect to the alternate route, while repeated
leasing failures remove the next vacancy handoff and explain why room quality
should be checked first. Covered by repeated-failure assertions.

The repeat warning now names the latest triggering day and before/after reading,
so the evidence is visible next to the recommendation as well as in the
history list. Covered by the repeated-failure evidence assertion.

Alternate transport reasons now include route coverage: a shaft is described as
a separate vertical route, while another car is described as added capacity on
the existing route. Covered by transport-recommendation assertions.

Alternate transport buttons now carry a concise reason at the action point—for
example, `select shaft control (the last car test did not clear the queue)`—and
retain the fuller explanation in the diagnosis panel. Covered by transport
recommendation assertions.

The main transport summary now states the shared coverage rule: each shaft
serves its floor span as a separate vertical route, while cars add capacity
within that route. The same wording is reused in the floor handoff previews and
alternate recommendation reasons. Covered by transport-coverage assertions
and a browser smoke check.

Each shaft row now compares its actual span with the other shafts and labels
overlapping floors or an independent span. This makes route redundancy visible
as the tower grows without hiding the actual floor range. Covered by route-label
assertions.

Floor-level shaft recommendations now describe the proposed lobby-to-floor span:
they identify duplicate coverage when existing shafts already serve it and call
out newly added floors when the route would extend coverage. Covered by route
recommendation assertions.

The shaft tool now shows a pre-placement coverage preview using the hovered top
floor (or the longest legal span by default). It identifies duplicate versus new
floor coverage and warns when the hovered span exceeds the shaft limit. Covered
by the route-label assertions and browser smoke check.

The car, stair, and escalator tools now show a before-spend preview. Cars state
their added riders per dispatch and existing-route capacity; local routes state
their floor span, no-car-wait behavior, cost, and span-limit warning. Covered by
browser smoke checks and the transport regression suite.

The car preview now updates when the pointer is over a shaft, naming that shaft's
waiting queue, fullest current car load, and car count before the purchase. With
no shaft hovered, it asks the player to hover one rather than implying a generic
choice. Covered by browser smoke checks.

Route previews now check placement conflicts before spending: shaft, stair, and
escalator previews report blocked columns or invalid spans, while the car preview
reports a shaft at its car limit. Covered by placement-status assertions and a
live full-shaft browser check.

Blocked route previews now identify a next action: a full car shaft points to
another shaft when one has room or recommends a new shaft; blocked columns point
to an available car or freeing a route column; invalid spans suggest a shorter
span. Covered by placement-status assertions and a live browser check.

Blocked route previews now include a selectable handoff. The player can switch
directly to a new shaft or to a specific alternate shaft's CAR action without
spending money; the last hovered shaft is preserved while moving to the button.
Covered by a live no-spend handoff check.

Route handoffs now preserve their target in the canvas guidance: CAR highlights
the selected shaft, while a shaft handoff can highlight the selected target floor.
The mode text and preview repeat the same target, so the next click remains
explicit after leaving the preview. Covered by live alternate-shaft guidance.

Highlighted route targets now show READY or BLOCKED directly on the canvas. A
ready car target uses a gold outline and a blocked car target uses red; shaft
floor targets use the same status treatment based on the actual clear-column
check. Covered by a visual alternate-shaft browser check.

## Step 111 — complete

The CAR build control now disables when every shaft is at the configured car
limit and explains that a new shaft is needed. It remains enabled when another
shaft can accept the car, preserving the broader route choice. Covered by a live
control-state browser check.

The shaft build control now checks the actual clear-column layout. It stays
available when the full-height span is blocked but a shorter span remains
possible, and explains the highest shorter floor to try; it disables when no
legal span remains. Covered by placement-status regression assertions.

When a shorter span is recommended, shaft mode now defaults to that top floor
in the coverage preview, mode text, and canvas outline. The highlighted row is
labelled `SHORTER READY`, while hovering another floor previews that choice.
Covered by a live blocked-full-span browser check.

The shaft placement action now adopts the same selected target used by the
guidance and preflights it with the shared clear-column rule. Clicking the
highlighted shorter row therefore builds exactly the recommended span, while
an unavailable row is rejected before spending. Covered by a live construction
check.

The recommended shaft target now shows its total cost, including the per-floor
span charge, in both the mode line and coverage preview. The amount follows
the hovered target when the player compares another span. Covered by cost
assertions and a live shorter-span preview check.

Insufficient funds are now explicit before a shaft placement click: the mode
line, span preview, and build-control tooltip show the required and available
amounts, and a valid-but-unaffordable click is rejected without spending.
Covered by a live funds-warning check.

The shaft preview now pairs its cost with the projected result: floors covered,
the one starting car and its riders-per-dispatch capacity, and the maximum car
capacity available in that shaft. Covered by projection assertions and a live
shaft-preview check.

The capacity projection now separates what the shaft purchase includes from
what remains a later CAR purchase: the first car and its capacity are labelled
as included, while remaining car slots and their additional capacity are shown
separately. Covered by projection assertions and a live preview check.

The remaining capacity line now includes the per-car price, so the player can
see both the number of future cars and the cost of each one before committing
to the shaft. Covered by projection assertions and a live cost preview check.

## Step 112 — complete

The CAR preview now uses the same purchased-versus-future vocabulary for the
selected shaft: current cars and riders per dispatch, remaining car slots with
their per-car price and added capacity, and the route maximum. Covered by
capacity projection assertions and a live CAR preview check.

## Step 113 — complete

The CAR preview now estimates the selected shaft's current queue wait and the
reduced wait expected after adding one car, using the same service-wave model
as route selection. It also says when there is no current queue or when the
shaft has reached its car limit. Covered by queue-relief projection assertions
and the full test suite.

## Step 114 — complete

The CAR tool now compares every shaft with an open car slot, highlights the
strongest queue-relief target when CAR is selected, and explains when the
currently inspected shaft is not the best available choice. Hovering still
lets the player inspect another shaft before committing. Covered by ranking
assertions and a live highlighted-target check.

## Step 115 — complete

The CAR preview now refreshes when waiting riders move between shafts or
accumulate during a rush, even when the tower-wide waiting total is unchanged.
The best-shaft highlight is recalculated while no shaft is being manually
inspected, and the preview shows the live queue-wait estimate. Covered by a
live 12× speed check that observed the estimate change from 2.0s to 12.2s and
back as the queue moved.

## Step 116 — complete

The CAR preview now keeps the latest eight queue readings for each shaft and
renders a compact oldest-to-newest sparkline. It labels the selected shaft's
pattern as rising, falling, steady, or a spike, so a temporary rush is not
mistaken for a sustained bottleneck. Covered by trend-shape assertions and a
live rush-speed check.

## Step 117 — complete

Each shaft now retains its own bounded queue history while the game runs. When
the player hovers a different shaft, the CAR preview shows that shaft's trend
and also includes the recommended alternate shaft's recent pattern beside its
relief estimate. Covered by a live two-shaft comparison at 12× speed.

## Step 118 — complete

The CAR preview now labels its forecast with the current simulation speed and
rush phase, and timed queue readings report the simulation-minute span they
cover. The preview therefore distinguishes a live 12× rush reading from a
paused or off-peak reading without changing the underlying service model.
Covered by context assertions and a live speed-change check.

## Step 119 — complete

Queue history is now sampled every 30 simulation minutes, rather than only
when the count changes. The CAR preview states that interval and reports the
elapsed simulation-minute window, keeping each sparkline bar comparable.
Covered by configuration/context assertions and a live speed-change check.

## Step 120 — complete

The SYSTEMS panel now connects the latest daily delivery, wait, and reputation
reading to each shaft's local queue trend. It explicitly explains that the
daily result aggregates all routes, while the local trends help locate whether
pressure was temporary or sustained. Covered by summary assertions and a live
day-close check.

## Step 121 — complete

The SYSTEMS panel now records up to six closed days of local queue history per
shaft. Each shaft shows a daily-average sparkline, its direction, and the
highest observed queue, alongside the live queue trend and daily service
outcome. Covered by daily aggregation assertions and a live readability check.

## Step 150 — complete

Task: make repeated daily queue pressure feed the recommended transport
response without confusing it with a one-day spike.

Completed: closed-day pressure now distinguishes a one-day spike from at least
two consecutive pressured days. Live queue relief remains the first priority;
when no live queue needs relief, the CAR recommendation can point to the shaft
with sustained historical pressure and labels that basis explicitly. The
SYSTEMS panel shows "one-day spike — keep watching" versus "repeated for N
days," and the CAR preview/toast uses the same language. Covered by pure
recommendation assertions and a live multi-day check.

## Step 151 — complete

Task: make the sustained-pressure response explain whether to add a car,
build a second shaft, or use a local route when car capacity is no longer the
right answer.

Completed: the transport response now uses live relief first, then identifies
when queued shafts have reached their car limit and recommends a second shaft.
If a new shaft cannot be placed, it points to an existing or buildable stair/
escalator route; if there is no repeated pressure, it tells the player to watch
the next reading. The SYSTEMS panel and CAR preview use the same response
language. Covered by car/shaft/local-route assertions and a live panel check.

## Step 152 — complete

Task: make transport response recommendations account for route coverage,
so a second shaft is recommended for the floors that are actually underserved.

Completed: capacity-bound responses now inspect the waiting riders' target
floors and choose a new shaft span that reaches the highest pressured floor.
The recommendation includes those floors, and the SHAFT tool follows the same
target. If the only legal span stops short, the response says so and falls
back to a covered local route or a clear placement warning instead of claiming
the investment will solve the queue. Covered by target-floor and short-span
assertions plus a live response-panel check.

## Step 153 — complete

Task: show route coverage and floor demand together when comparing a new
shaft with an existing shaft, so duplicate coverage has a deliberate reason.

Completed: shaft comparisons now classify a proposed span as adding needed
pressure coverage, providing parallel capacity on already-served pressure
floors, adding unrelated coverage, or duplicating coverage without a demand
reason. The live SHAFT preview uses that classification, and the response
target keeps the pressured floors visible. A span that misses demand is
flagged rather than presented as a solution. Covered by coverage-comparison
assertions and a live SHAFT preview check.

## Step 154 — complete

Task: make the coverage comparison include the cost and capacity gained,
so parallel shafts can be weighed against adding cars on the existing route.

Completed: the SHAFT preview now compares the proposed shaft's exact cost,
starting riders-per-dispatch capacity, and separate-route benefit with one
additional car's cost and capacity gain on the selected existing shaft. When
that car is at its limit, the comparison says so; when a queue exists, it also
shows the projected wait change. Covered by investment-comparison assertions
and a live SHAFT preview check.

## Step 155 — complete

Task: make route alternatives account for walking distance and travel time,
so a local route is recommended only when it is actually useful for the
pressured floors.

Completed: local-route alternatives now have to cover the pressured trip
floors, and existing/buildable stairs or escalators are ranked by estimated
walking plus vertical travel time. The response names the useful route and
reports its estimated time; unsupported local routes are ignored. Covered by
faster-route and coverage assertions plus a live transport/preview check.

## Step 156 — complete

Task: make route recommendations account for cost and available budget,
so a useful local route is not presented as immediately buildable when the
tower cannot afford it.

Completed: car, second-shaft, and buildable local-route responses now report
when the action is correct but unaffordable, changing the wording to "save
for" while keeping the correct control highlighted. Existing stairs and
escalators remain immediately usable. The live panel preserves the separate
monitor state and the SHAFT preview keeps its cost/capacity comparison.
Covered by affordability assertions and a live panel/preview check.

## Step 157 — complete

Task: show the affordability gap and expected earnings runway for a
recommended transport investment, so “save for” becomes a concrete plan.

Completed: unaffordable transport responses now report the exact shortfall.
With closed-day history, they estimate days to afford the action from the
recent average net; without history they tell the player to run a day first,
and with negative net they do not invent a runway. The guidance remains
visible alongside the transport response and keeps the appropriate control
highlighted. Covered by affordability, positive-runway, no-history, and live
panel assertions.

## Step 158 — complete

Task: begin the next SimTower layer by making tenant demand respond to
floor services and access quality, not only room type and elevator pressure.

Completed: the leasing forecast now gives otherwise-ready vacancies a bounded
experience-demand preference based on route access and required floor-service
coverage. The forecast, vacancy priority, tenant forecast, room inspector, and
move-in event all expose that quality bonus and its access/service breakdown;
room evaluation remains the hard relisting gate. Covered by the demand-quality
ranking assertion, the full deterministic suite (150 passing tests), syntax
checks, and workspace diff validation.

## Step 159 — complete

Task: make the demand-quality signal visible while choosing where to build
a new room, so the player can compare likely tenant interest before committing
to a floor.

Completed: floor placement previews and side-by-side comparisons now show the
bounded demand-quality bonus plus the access and required-service breakdown.
The hover guidance, pinned comparison, and room inspector use the same signal,
so a player can see likely tenant interest before spending on a room. Covered
by placement-preview assertions, the full deterministic suite (150 passing
tests), syntax checks, and workspace diff validation.

## Step 160 — complete

Task: give the tenant-demand signal a visible reason when services or access
change after construction, so improvements can be tied to actual leasing lift.

Completed: each closed day now records the vacancies that won move-in slots,
including evaluation, tenant-mix priority, and access/service demand score and
bonus. The SYSTEMS leasing panel reports the last close, while move-in events
retain the same evidence for replay and inspection. Covered by lifecycle
telemetry assertions, the full deterministic suite (150 passing tests), syntax
checks, local HTTP verification, and a live placement-preview check.

## Step 161 — complete

Task: add a compact history of leasing outcomes, so repeated service or
access improvements can be compared with earlier tenant demand results.

Completed: the last three closed days now retain move-in count, available
leasing slots, eligible candidates, and average access/service demand score and
bonus. The SYSTEMS panel shows that history alongside the latest close, while
the deterministic event payload remains available for replay. Covered by
bounded-history assertions, the full deterministic suite (151 passing tests),
syntax checks, local HTTP verification, and a live panel check.

## Step 162 — complete

Task: make a service or access investment show its expected leasing impact
before construction, connecting transport/service spending to tenant demand.

Completed: non-mutating investment previews now calculate demand-quality before
and after the proposed cafeteria, parking, clinic, security, recycling, or
shaft placement. The preview reports the expected leasing-demand score and
bounded bonus change next to the room-evaluation change; a missing room kind in
the shared preview path was also corrected so condo and hotel forecasts use
their own service needs. Covered by investment-preview assertions, the full
deterministic suite (151 passing tests), syntax checks, local HTTP verification,
and a live panel check.

## Step 163 — complete

Task: make the observed leasing history distinguish demand-quality gains
from tenant-mix gains, so the player can tell why a vacancy was selected.

Completed: leasing outcomes and the compact history now label access/service
quality bonuses separately from tenant-mix bonuses. The next-tenant forecast,
last-close line, and recent-day history all use the same split, so a move-in's
reason is readable instead of collapsing into one generic demand number.
Covered by the full deterministic suite (151 passing tests), syntax checks,
local HTTP verification, and a live app smoke load.

## Step 164 — complete

Task: let the player inspect a vacancy's likely tenant type and leasing
reason before deciding whether to re-rent, renovate, or convert the room.

Completed: vacant-room inspection now reports whether the room is a current
leasing candidate, its market rank, the likely tenant type, and separate
quality versus tenant-mix demand contributions. It also distinguishes a
reputation-gated vacancy from one that is not yet eligible, while occupied
rooms remain read-only. Covered by vacancy-summary assertions, the full
deterministic suite (152 passing tests), syntax checks, local HTTP verification,
and a live app smoke load.

## Step 165 — complete

Task: make conversion previews compare the target tenant type's likely
leasing demand, not only its capacity and population-mix effect.

Completed: conversion previews now compare the current and target room's
access/service quality bonus, tenant-mix bonus, and combined demand-priority
change. The result appears alongside capacity and projected population mix
before the second click confirms conversion. Covered by conversion assertions,
the full deterministic suite (152 passing tests), syntax checks, and workspace
diff validation.

## Step 166 — complete

Task: make vacancy recovery choices compare re-rent, renovate, and convert
using one shared tenant-demand outcome, so the recommended action is explicit.

Completed: vacant-room inspection now compares re-rent, renovation, and each
unlocked conversion with shared quality and tenant-mix demand signals. It also
shows projected room evaluation, cost affordability, readiness, and a plain-
language recovery recommendation without taking the action automatically.
Covered by recovery-comparison assertions, the full deterministic suite (152
passing tests), syntax checks, local HTTP verification, and a live app smoke
load.

## Step 167 — complete

Task: make recovery recommendations account for market timing and
reputation gates in the same comparison, so waiting is clearly explained when
spending would not solve the vacancy.

Completed: recovery comparisons now expose the current market days remaining,
the reputation value and replacement gate, every option's projected timing and
reputation readiness, and all active blockers. The recommendation now prioritizes
restoring reputation, waiting for market time, or improving room quality when
re-rent or conversion spending cannot produce occupancy yet. Covered by timing
and reputation recovery assertions, the full deterministic suite (153 passing
tests), syntax checks, local HTTP verification, and a live recovery UI smoke
load.

## Step 168 — complete

Task: make the recovery comparison include demolition as an explicit
last-resort option, with its permanent consequence and the value of the freed
floor space visible before confirmation.

Completed: the shared vacancy comparison now includes demolition as a distinct
last-resort choice. Before confirmation it labels the action permanent, shows
the exact floor slot that would be freed for a new room, and keeps demolition
separate from actions that can restore occupancy. Covered by demolition-
comparison assertions, the full deterministic suite (153 passing tests), syntax
checks, local HTTP verification, and the recovery UI smoke load.

## Step 169 — complete

Task: make every recovery action's confirmation state repeat the same
projected outcome, cost, and consequence so the final click cannot surprise the
player.

Completed: renovation and re-rent now use an explicit preview-then-confirm
state, while conversion repeats its cost and vacancy-clock consequence and
demolition repeats its permanent slot consequence. Confirmation warnings and
button labels stay aligned with the shared recovery comparison. Covered by the
full deterministic suite (153 passing tests), syntax checks, local HTTP
verification, and a live confirmation-UI smoke load.

## Step 170 — complete

Task: show the daily income consequence of each recovery choice, including
the rent change from conversion and the income removed by demolition.

Completed: recovery comparisons now show each option's projected daily rent and
the change from the vacant room's current rent. Conversion previews include the
current-to-target rent stream, while demolition shows zero future rent and the
lost daily amount. Confirmation text repeats the same economic consequence.
Covered by conversion and demolition income assertions, the full deterministic
suite (153 passing tests), syntax checks, local HTTP verification, and a live
income-UI smoke load.

## Step 171 — complete

Task: separate a shop's predictable base rent from its variable customer
revenue, so recovery comparisons do not hide traffic-dependent income.

Completed: shop recovery projections now split stable base rent from expected
customer revenue. Expected traffic is calculated from nearby occupied office
workers, lunch-trip rate, and the number of reachable shops, while all other
room types keep their predictable rent stream. Conversion previews,
comparisons, and confirmations use the same breakdown. Covered by commercial
recovery-income assertions, the full deterministic suite (154 passing tests),
syntax checks, local HTTP verification, and a live income-UI smoke load.

## Step 172 — complete

Task: make projected shop traffic reflect the tower's recent delivery
reliability, so elevator pressure can reduce variable commercial income before
it becomes a surprise in the economy.

Completed: projected shop traffic now keeps its full local demand potential
visible while scaling realized variable revenue by recent delivery reliability.
The same factor is used by recovery comparisons, conversion previews, and
confirmation text, so elevator pressure can reduce commercial income without
changing predictable base rent. Covered by delivery-aware commercial assertions,
the full deterministic suite (154 passing tests), syntax checks, local HTTP
verification, and a live shop-income UI smoke load.

## Step 173 — complete

Task: show the recent delivery factor behind a shop's traffic estimate, so
the player can tell whether lost commercial income comes from weak local demand
or elevator service.

Completed: the shop traffic panel now reports local office demand, full traffic
potential, delivery-adjusted expected customers, the recent delivery factor,
and expected versus potential traffic income. It explicitly identifies when
elevator delivery is limiting commercial traffic; the recovery and conversion
income estimates use the same shared estimate. Covered by shop-estimate and
delivery-aware commercial assertions, the full deterministic suite (154 passing
tests), syntax checks, local HTTP verification, and a live shop-traffic smoke
load.

## Step 174 — complete

Task: show a shop's actual served customers and realized traffic income
beside its delivery-adjusted forecast, so the player can compare expectation to
what the tower delivered today.

Completed: each closed day now records per-shop served customers and realized
traffic revenue before live counters reset. The shop panel shows today's
realized customers and income beside local potential, delivery-adjusted
forecast, and the previous close when available. Covered by realized-shop
telemetry assertions, the full deterministic suite (155 passing tests), syntax
checks, local HTTP verification, and a live shop-traffic UI smoke load.

## Step 175 — complete

Task: retain a short per-shop traffic history, so a single bad delivery day
can be distinguished from a sustained commercial decline.

Completed: closed-day shop records now retain a configurable short history with
served customers, potential customers, delivery factor, and realized revenue.
The shop panel renders the recent served/potential sequence and labels traffic
as rising, steady, or falling. Covered by bounded-history assertions, the full
deterministic suite (156 passing tests), syntax checks, local HTTP verification,
and a live shop-history UI smoke load.

## Step 176 — complete

Task: make the shop traffic trend distinguish delivery-driven decline from
local-demand decline, so the next management action points to elevators or
tenant mix.

Completed: bounded shop history now compares potential-customer change with
delivery-factor change and classifies a decline as service-driven,
demand-driven, mixed, or not yet identifiable. The shop panel shows the cause
and a next-action phrase pointing toward elevator delivery or tenant mix.
Covered by service- and demand-cause assertions, the full deterministic suite
(156 passing tests), syntax checks, local HTTP verification, and a live traffic
diagnosis UI smoke load.

## Step 177 — complete

Task: turn the shop traffic diagnosis into a clickable management focus,
opening the relevant elevator or tenant-mix response from the shop panel.

Completed: populated shop rows now include a focus action selected from the
diagnosis. Service-driven or mixed declines focus the elevator/car response;
demand-driven or otherwise stable/unknown shops focus tenant-mix review. The
action also selects the shop's floor so the relevant local context remains
visible; when no shaft exists, the shaft placement preview targets that shop
floor. Covered by diagnosis-path assertions, the full deterministic suite
(156 passing tests), syntax checks, local HTTP verification, and a live
actionable shop UI smoke load.

## Step 178 — complete

Task: carry the selected shop diagnosis into the relevant investment
preview, so the player can see the likely cost and effect immediately after
choosing an elevator or tenant-mix response.

Completed: elevator-focused shop actions now carry the shop floor into the
shaft/car preview alongside existing cost, capacity, and queue-relief details.
Tenant-mix actions now show a shop-demand preview for adding the nearest open
office, including its cost, projected local customers, expected shop revenue,
and office evaluation; hovering another open floor updates the forecast.
The focus clears after the investment is placed. Covered by the tenant-mix
forecast assertion, the full deterministic suite (157 passing tests), syntax
checks, local HTTP verification, and a live investment-preview UI smoke load.

## Step 179 — complete

Task: visually guide the recommended office placement floor from the shop
demand preview, so the tenant-mix response is as direct to place as the
elevator response.

Completed: the shop-demand focus now supplies the recommended office floor to
the tower's existing placement guide, marking it as TARGET and leaving other
open floors as hoverable alternatives. The guide and demand forecast follow
the same hovered floor, while the existing service-fix guidance remains
unchanged. Covered by the preferred-floor forecast assertion, the full
deterministic suite (157 passing tests), syntax checks, local HTTP
verification, and a live placement-guidance UI smoke load.

## Step 180 — complete

Task: add a clear confirmation cue when the player chooses a different
office floor than the shop-demand recommendation, so the tradeoff is visible
before construction.

Completed: clicking a materially weaker office floor during shop-demand focus
now pauses before construction and explains the selected versus recommended
expected customers per day. A second click confirms the weaker placement, while
the preview also calls out the recommended floor and its better demand result.
Covered by the shop-demand tradeoff assertion, the full deterministic suite
(157 passing tests), syntax checks, local HTTP verification, and a live
confirmation-cue UI smoke load.

## Step 181 — complete

Task: close the shop-demand loop by showing the realized traffic change
after the recommended office is built and the next day closes.

Completed: a shop-demand office placement now records its pre-build and
forecast customer counts. The next closed day compares that forecast with the
shop's actual served customers, realized revenue, and forecast gap directly in
the shop panel; the result is retained until another response is made or the
tower restarts. Covered by first-day follow-up assertions, the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live shop follow-up UI smoke load.

## Step 182 — complete

Task: retain a bounded history of shop-demand response outcomes so several
interventions can be compared instead of only the latest response.

Completed: shop-demand office responses are now retained in a configurable
bounded history. Each shop can show several response days, pending outcomes,
realized customers and revenue, forecast values, and the change against its
pre-build expectation. The history is trimmed as new responses arrive and is
reset with a new tower. Covered by bounded-history assertions, the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live shop-response-history UI smoke load.

## Step 183 — complete

Task: distinguish successful and underperforming shop responses in the
history so the player can quickly see which investments paid off.

Completed: each retained shop response is now labeled and color-coded as met
forecast, below forecast, pending, or no record. The status uses the actual
forecast gap and remains visible alongside realized customers and revenue.
Covered by outcome-status assertions, the full deterministic suite (158
passing tests), syntax checks, local HTTP verification, and a live color-coded
response-history UI smoke load.

## Step 184 — complete

Task: summarize the shop-response history with a compact success rate and
average forecast gap, so the player can judge the overall investment pattern.

Completed: the shop traffic panel now summarizes retained responses with a
color-coded met-forecast rate, completed-response count, average customer gap,
and pending or missing counts. Pending outcomes do not distort the success
rate or average. Covered by summary assertions, the full deterministic suite
(158 passing tests), syntax checks, local HTTP verification, and a live
shop-response summary UI smoke load.

## Step 185 — complete

Task: make the shop-response summary filterable by shop, so a strong result
at one location does not hide a weak result at another.

Completed: the shop panel now offers an all-shops response view plus a button
for each occupied shop. Selecting one filters the response summary and that
shop's retained outcomes while leaving current traffic rows visible for
context. Covered by the full deterministic suite (158 passing tests), syntax
checks, local HTTP verification, and a live shop-response filter UI smoke
load.

## Step 186 — complete

Task: add a clear way to return from a shop-specific response view to the
overall building response summary after inspecting an individual shop.

Completed: the filtered response view now labels its reset control explicitly
as “return to all shops,” and the control is disabled when the overall view is
already active. Covered by the full deterministic suite (158 passing tests),
syntax checks, local HTTP verification, and a live shop-response view UI smoke
load.

## Step 187 — complete

Task: keep the shop-response filter coherent when a selected shop becomes
vacant or is removed from the building.

Completed: the response filter now validates itself against the currently
occupied shops during refresh. If the selected shop becomes vacant or is
removed, the filter clears back to the overall response view while retained
history remains available in aggregate. Covered by stale-filter assertions,
the full deterministic suite (158 passing tests), syntax checks, local HTTP
verification, and a live stale-filter UI smoke load.

## Step 188 — complete

Task: show the shop-response filter's active shop and reset state in a
more prominent panel heading, so the current scope is unmistakable.

Completed: the shop traffic heading now names its active scope as either
“all response view” or the specific floor/shop response view. The summary and
response controls retain the same scope, so the heading cannot be mistaken for
an all-building result. Covered by the full deterministic suite (158 passing
tests), syntax checks, local HTTP verification, and a live shop-heading UI
smoke load.

## Step 189 — complete

Task: add a compact per-shop response score beside each shop row, so the
filtered summary can be scanned without opening the response history.

Completed: every occupied shop row now shows a compact response score: the
percentage of completed responses that met forecast, or a pending/no-record
state when appropriate. The score is color-coded with the same outcome colors
as the detailed history and remains independent of the active shop filter.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP verification, and a live per-shop score UI smoke load.

## Step 190 — complete

Task: add a tooltip or detail cue that explains the per-shop response score
without requiring the player to infer what the percentage means.

Completed: each per-shop response score now has explanatory hover text and an
accessible label stating the completed-response count and that pending outcomes
are excluded. Covered by score-detail assertions, the full deterministic suite
(158 passing tests), syntax checks, local HTTP verification, and a live score
detail UI smoke load.

## Step 191 — complete

Task: expose the response score's average forecast gap in the shop row, so
the percentage is paired with the size of the outcome difference.

Completed: completed shop rows now pair the met-forecast percentage with an
average customer gap per day, including a signed value for above- or
below-forecast results. The same detail is included in the score tooltip.
Covered by the existing summary assertions, the full deterministic suite (158
passing tests), syntax checks, local HTTP verification, and a live per-shop
gap-display UI smoke load.

## Step 192 — complete

Task: distinguish whether a shop response changed customers, revenue, or
both, so the score reflects the management outcome the player actually cares
about.

Completed: each realized shop response now labels its measurable outcome as
customers + revenue, customers only, revenue only, or no measurable change,
alongside the met/below-forecast status. Customer and revenue deltas are both
recorded for the follow-up comparison. Covered by outcome assertions, the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live outcome-label UI smoke load.

## Step 193 — complete

Task: add separate customer and revenue totals to the shop-response
summary, so the building-level result matches the per-shop outcome detail.

Completed: the shop-response summary now reports realized versus forecast
customers and revenue separately, plus their signed gaps, while continuing to
exclude pending outcomes. Covered by expanded summary assertions, the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live customer/revenue totals UI smoke load.

## Step 194 — complete

Task: make the shop-response summary's customer and revenue gaps
color-coded, so underperformance is visible without reading the numbers.

Completed: customer and revenue gaps in the building-level shop-response
summary now use independent good/bad colors, with signed values retained for
precise reading. Covered by the full deterministic suite (158 passing tests),
syntax checks, local HTTP verification, and a live gap-color UI smoke load.

## Step 195 — complete

Task: add hover detail to the customer and revenue gap indicators, so each
color explains whether it measures customers or money.

Completed: both summary gap indicators now include hover text and accessible
labels that explicitly identify realized versus forecast customers or revenue.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP verification, and a live gap-detail UI smoke load.

## Step 196 — complete

Task: add a compact “last response” marker to each shop row, so the latest
intervention can be identified without scanning the full history.

Completed: each shop row now shows the latest response day and its outcome
status beside the compact response score. Pending, successful, underperforming,
and missing latest responses retain their corresponding colors. Covered by the
full deterministic suite (158 passing tests), syntax checks, local HTTP
verification, and a live latest-response UI smoke load.

## Step 197 — complete

Task: add the latest response's outcome type to the shop-row marker, so the
player can see whether the newest intervention changed customers, revenue, or
both.

Completed: completed latest-response markers now append the measurable outcome
type—customers + revenue, customers only, revenue only, or no measurable
change—beside the day and forecast status. Pending and missing records remain
clearly distinct. Covered by the existing outcome assertions, the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live latest-outcome UI smoke load.

## Step 198 — complete

Task: add a direct “inspect response history” action to each shop row, so
the player can open the relevant filtered response view from the row itself.

Completed: every occupied shop row now includes a view-history action that
opens that shop's response filter through the existing response-view control.
The action preserves the live traffic rows for context. Covered by the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live row-history UI smoke load.

## Step 199 — complete

Task: make the row-level history action indicate when its shop is already
the active response filter.

Completed: a shop row's history action now changes to “history selected” and
disables itself while that shop is the active response filter. Other rows keep
their view-history actions available. Covered by the full deterministic suite
(158 passing tests), syntax checks, local HTTP verification, and a live active
row-state UI smoke load.

## Step 200 — complete

Task: add a compact response-history count to each shop row, so the player
can distinguish shops with no recorded intervention from shops with results.

Completed: each shop row now shows its retained response count, including an
explicit “no responses” state for untouched shops. The count sits beside the
score and latest-response marker without changing the detailed history view.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP verification, and a live response-count UI smoke load.

## Step 201 — complete

Task: add a response-count tooltip that explains the bounded history window
and prevents the count from being mistaken for total shop traffic.

Completed: response counts now include hover and accessible detail explaining
that only the latest configured response records are retained and that the
count is not total shop traffic. Covered by the full deterministic suite (158
passing tests), syntax checks, local HTTP verification, and a live response
count-detail UI smoke load.

## Step 202 — complete

Task: make the bounded response-history limit visible in the shop panel,
so the player understands how much history is available before filtering.

Completed: the shop panel now states the configured retained-history limit
directly as “response history: latest 3 records,” including before any shop
exists. Filter controls remain attached when occupied shops are available.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP verification, and a live response-history-limit UI smoke load.

## Step 203 — complete

Task: show how many records are currently retained against the configured
response-history limit, so the panel distinguishes an empty window from a
full window.

Completed: the shop panel now reports the bounded window as retained versus
available, such as “0/3 retained · latest 3 records.” A small pure helper keeps
the count capped and labels empty and full windows consistently. Covered by
the commercial regression suite, the full deterministic suite (158 passing
tests), syntax checks, local HTTP verification, and a live history-window UI
smoke load.

## Step 204 — complete

Task: add a compact indicator for whether the retained response window is
still collecting or has reached its limit, so players know when older results
will roll off.

Completed: the response-history line now says “collecting” while the bounded
window has room and “full · oldest results roll off” once it reaches capacity.
The state is derived from the same capped window helper used for the retained
count. Covered by the commercial regression suite, the full deterministic
suite (158 passing tests), syntax checks, local HTTP verification, and a live
collecting-state UI smoke load.

## Step 205 — complete

Task: add a small retained-history reset explanation, so players understand
that the response window is intentionally short-lived rather than a permanent
shop ledger.

Completed: the response-history line now identifies itself as a short-lived
diagnostic period, while its tooltip explains that only the latest configured
shop-response records are kept and this is not a permanent shop ledger.
Covered by the commercial regression suite, the full deterministic suite (158
passing tests), syntax checks, local HTTP verification, and a live retention
explanation UI smoke load.

## Step 206 — complete

Task: make the retained-history count visibly distinct from the response
outcome score, so volume and effectiveness are not read as the same signal.

Completed: per-shop response volume now uses a separate info-colored “history:
N response(s)” label, while the adjacent colored score remains reserved for
forecast effectiveness. The count formatter is tested independently, including
singular and plural forms. Covered by the commercial regression suite, the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live response-volume styling UI smoke load.

## Step 207 — complete

Task: add a short inline key for the response row signals, so the player
can decode score, history volume, and today’s served traffic at a glance.

Completed: the shop panel now includes an inline row key defining score as
outcome quality, history as retained response count, and served as today’s
customers. The retained-history volume also keeps its distinct info color.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP verification, and a live shop-row-key UI smoke load.

## Step 208 — complete

Task: add accessible labels to the three shop-row signal terms, so the
meaning remains available to screen readers and keyboard users.

Completed: the inline shop-row key now labels score as outcome quality, history
as retained response count, and served as today’s customers for assistive
technology. Covered by the full deterministic suite (158 passing tests), syntax
checks, local HTTP verification, and a live accessible-label UI smoke load.

## Step 209 — complete

Task: add a tooltip to today’s served count, so players know it resets at
day close and is separate from retained response history.

Completed: each shop’s served-today value now has an accessible tooltip stating
that it resets at day close and is separate from retained response history. The
explanation is produced by a tested formatter, including the live count.
Covered by the commercial regression suite, the full deterministic suite (158
passing tests), syntax checks, local HTTP verification, and a live shop-panel
load smoke check.

## Step 210 — complete

Task: make the shop panel’s served-today total explicitly identify its
day-close reset, so the panel summary matches the individual shop rows.

Completed: the aggregate shop served-today total now says “served today” and
carries the same reset-at-day-close and retained-history distinction as each
shop row, with an accessible label. Covered by the commercial regression
suite, the full deterministic suite (158 passing tests), syntax checks, local
HTTP verification, and a live shop-total label smoke load.

## Step 211 — complete

Task: clarify that shop served totals aggregate across all visible shops,
so a filtered response view is not mistaken for a different daily counter.

Completed: the shop panel now states that served totals cover all occupied
shops and that response filters affect history only. The aggregate tooltip
also carries the same scope clarification for accessible users. Covered by the
full deterministic suite (158 passing tests), syntax checks, local HTTP
verification, and a live aggregate-scope UI smoke load.

## Step 212 — complete

Task: add a matching scope label to the response-history summary, so the
player can tell whether its outcomes cover all shops or one selected shop.

Completed: response summaries now explicitly label their scope as “all shops”
or the selected floor’s shop. A pure scope formatter keeps the two views
consistent and testable. Covered by the commercial regression suite, the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live all-shop-scope UI smoke load.

## Step 213 — complete

Task: make the selected-shop response summary carry the same scope wording
into its accessible description, so filtered results are equally clear to
assistive technology.

Completed: the response-summary scope now has an explicit accessible label
matching its visible all-shop or selected-shop wording. A pure formatter keeps
both scope forms consistent. Covered by the commercial regression suite, the
full deterministic suite (158 passing tests), syntax checks, local HTTP
verification, and a live accessible-scope UI smoke load.

## Step 214 — complete

Task: add a selected-scope count to the response summary, so filtering to
one shop also makes its retained-record volume immediately visible.

Completed: response summaries now include the retained response count for
their active scope. A selected shop with no records still shows its scope,
“history: 0 responses,” and “no outcomes yet” instead of disappearing.
Covered by the commercial regression suite, the full deterministic suite (158
passing tests), syntax checks, local HTTP verification, and a live response
scope-count UI smoke load.

## Step 215 — complete

Task: add retained-record counts to the shop filter controls, so players
can compare available history before switching scopes.

Completed: shop response filters now show their retained counts, including
“all shops · N responses” and zero-record individual shops. The all-shop return
button keeps its count while a filter is active. Covered by the commercial
regression suite, the full deterministic suite (158 passing tests), syntax
checks, local HTTP verification, and a live response-filter UI load smoke.

## Step 216 — complete

Task: add accessible descriptions to the response filter buttons, so each
button announces both its shop scope and retained-record count.

Completed: response filter buttons now expose accessible descriptions such as
“show response history for F2 shop; 1 retained response,” with correct
singular/plural wording and an all-shop form. Covered by the commercial
regression suite, the full deterministic suite (158 passing tests), syntax
checks, local HTTP verification, and a live response-panel load smoke.

## Step 217 — complete

Task: announce the active response-history scope when a filter is selected,
so the resulting view change is clear beyond the button state itself.

Completed: response-filter selection now announces the active scope and
retained count through the status message, and the status region uses polite
ARIA live semantics so assistive technology receives the view change.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP verification, and a live status-region UI smoke load.

## Step 218 — complete

Task: make the active response-history filter’s selected state visible in
the control text as well as through its disabled state.

Completed: active response filters now visibly say “selected:” before their
scope and retained count, while inactive filters keep their normal labels.
Covered by the commercial regression suite, the full deterministic suite (158
passing tests), syntax checks, local HTTP verification, and a live selected
filter-state UI load smoke.

## Step 219 — complete

Task: add a concise “filtered” marker to the response summary when a shop
scope is selected, so the summary and control state reinforce each other.

Completed: selected-shop response summaries now read “response summary ·
filtered · F2 shop,” while all-shop summaries remain unmarked. A pure heading
formatter keeps both forms consistent and testable. Covered by the commercial
regression suite, the full deterministic suite (158 passing tests), syntax
checks, local HTTP verification, and a live summary-panel load smoke.

## Step 220 — complete

Task: carry the filtered marker into the response-summary accessible label,
so assistive technology receives the same distinction as the visible heading.

Completed: filtered response summaries now expose “response summary filtered
scope: F2 shop” to assistive technology, matching the visible filtered heading.
All-shop summaries retain their unfiltered scope wording. Covered by the
commercial regression suite, the full deterministic suite (158 passing tests),
syntax checks, local HTTP verification, and a live response-panel load smoke.

## Step 221 — complete

Task: include the active shop scope in the response-score accessible
description, so the effectiveness score is scoped as clearly as the heading.

Completed: each shop response score now exposes an accessible description such
as “response score for F2 shop,” followed by its outcome detail. This keeps the
effectiveness signal tied to the shop it represents. Covered by the commercial
regression suite, the full deterministic suite (158 passing tests), syntax
checks, local HTTP verification, and a live shop-panel load smoke.

## Step 222 — complete

Task: include the active shop scope in the retained-history accessible
description, so score and volume use matching context.

Completed: each shop’s retained-history label now exposes an accessible
description naming the shop, retained count, history limit, and distinction
from total traffic. Covered by the commercial regression suite, the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live shop-panel load smoke.

## Step 223 — complete

Task: scope the served-today accessible description to its shop, so all
three row signals carry matching shop context.

Completed: each shop’s served-today description now names its floor/shop and
retains the day-close reset and response-history distinction. The aggregate
total continues to use tower-wide wording. Covered by the commercial regression
suite, the full deterministic suite (158 passing tests), syntax checks, local
HTTP verification, and a live shop-panel load smoke.

## Step 224 — complete

Task: add the shop scope to the served-today visible tooltip, so hover users
receive the same context as screen-reader users.

Completed: the served-today row tooltip uses the shop-scoped detail introduced
in Step 223, so hover and accessible users receive matching context without a
second wording path. Covered by the commercial regression suite, the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live served-tooltip binding check.

## Step 225 — complete

Task: explain that “last close” traffic is historical and separate from
the live served-today counter.

Completed: closed-day shop traffic now reads “last close (historical)” and
explicitly distinguishes itself from live served-today traffic. A pure detail
formatter keeps the wording stable and testable. Covered by the commercial
regression suite, the full deterministic suite (158 passing tests), syntax
checks, local HTTP verification, and a live shop-panel load smoke.

## Step 226 — complete

Task: add the shop scope to the historical “last close” accessible detail,
so all historical traffic descriptions identify their source shop.

Completed: historical last-close details now identify their source floor/shop
when rendered in a shop row, while the shared formatter preserves the
historical-versus-live distinction. Covered by the commercial regression suite,
the full deterministic suite (158 passing tests), syntax checks, local HTTP
verification, and a live shop-panel load smoke.

## Step 227 — complete

Task: add the shop scope to the historical “last close” visible text, so
hover and sighted users see the same source context.

Completed: the rendered last-close line now uses the shop-scoped historical
detail directly, so sighted users see the same source context as tooltip and
screen-reader users. Covered by the commercial regression suite, the full
deterministic suite (158 passing tests), syntax checks, local HTTP verification,
and a live visible-traffic panel load smoke.

## Step 228 — complete

Task: distinguish historical last-close revenue from live daily revenue,
so both traffic and money use clear time context.

Completed: last-close shop rows now label realized money as “historical
revenue,” keeping it distinct from the live served-today amount. Covered by
the commercial regression suite, the full deterministic suite (158 passing
tests), syntax checks, local HTTP verification, and a live shop-panel load
smoke.

## Step 229 — complete

Task: add an accessible description to historical last-close revenue, so
assistive technology receives the same time distinction as visible users.

Completed: each historical last-close revenue value now exposes an accessible
description naming its shop and identifying the value as last-close revenue
separate from live daily revenue. Covered by the commercial regression suite,
the full deterministic suite (158 passing tests), syntax checks, local HTTP
verification, and a live shop-panel load smoke.

## Step 230 — complete

Task: add a visible historical-revenue marker to the shop traffic legend,
so the time distinction is discoverable before any last-close row exists.

Completed: the shop-row key now defines “last close” as historical
traffic/revenue, with a matching accessible label. The distinction is visible
even before a shop has a closed-day record. Covered by the full deterministic
suite (158 passing tests), syntax checks, local HTTP verification, and a live
shop-key accessibility smoke load.

## Step 231 — complete

Task: add a compact “today vs last close” label to shop rows, so live and
historical readings are visually grouped as two time periods.

Completed: shop rows now use a stronger live-today treatment and a bordered
historical last-close treatment, keeping the two time periods visually
grouped but distinct. Covered by the full deterministic suite (158 passing
tests), syntax checks, local HTTP verification, and a live today/history
styling smoke load.

## Step 232 — complete

Task: add accessible labels to the today/history visual group, so the
time relationship is explicit beyond color and borders.

Completed: each shop's live and historical traffic lines now sit inside a
single labeled accessibility group. The label explains that today is current,
that last close is the previous closed day, and when no closed day exists yet.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP verification, and a live page-boot smoke; the current initial game
state has no shops, so the dynamic group is not rendered in that smoke state.

## Step 233 — complete

Task: give the today/history group a small visible heading, so the time
comparison is discoverable without relying on color, borders, or assistive
technology.

Completed: shop traffic groups now show “today vs last close” when history is
available, or “today · last close pending” before the first close. Covered by
the full deterministic suite (158 passing tests), syntax checks, local HTTP
verification, and a live page-boot/style smoke.

## Step 234 — complete

Task: add a visible legend cue for the today/history heading, so the
comparison remains understandable when scanning multiple shop rows.

Completed: the shop row key now repeats “today vs last close” with a visible
current-versus-historical explanation and an accessible label. Covered by the
full deterministic suite (158 passing tests), syntax checks, local HTTP
verification, and a live legend/style smoke.

## Step 235 — complete

Task: add a subtle divider before the today/history key, so it reads as a
time-context cue rather than another traffic metric.

Completed: the today/history legend cue now has a restrained divider and
spacing, visually separating time context from the other row definitions.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP verification, and a live computed-style smoke.

## Step 236 — complete

Task: add a short tooltip to the today/history legend cue, so its meaning
is available on hover as well as in the visible key.

Completed: the today/history legend cue now explains on hover that it compares
current traffic with historical closed-day traffic, while keeping its
accessible label. Covered by the full deterministic suite (158 passing tests),
syntax checks, local HTTP verification, and a live tooltip smoke.

## Step 237 — complete

Task: make the today/history legend cue keyboard-focusable, so the same
explanation is reachable without a mouse.

Completed: the today/history legend cue now has a keyboard tab stop and a
visible focus ring, while retaining its hover explanation and accessible
label. Covered by the full deterministic suite (158 passing tests), syntax
checks, local HTTP verification, and a live DOM/style smoke.

## Step 238 — complete

Task: add a short accessible description to the visible today/history
heading, so each shop row repeats the time relationship in the row itself.

Completed: each shop time heading now exposes a semantic heading role and a
concise accessible description for either the current-versus-historical state
or the pending first close. Covered by the full deterministic suite (158
passing tests), syntax checks, local HTTP verification, and a live page-boot
smoke.

## Step 239 — complete

Task: add a small gap between the today/history heading and its first
traffic reading, so the heading reads as a label rather than inline data.

Completed: the today/history heading now has a compact 5px bottom gap before
the first reading, improving scanability without expanding the shop panel
substantially. Covered by the full deterministic suite (158 passing tests),
syntax checks, local HTTP verification, and a live page/style smoke.

## Step 240 — complete

Task: add a matching small gap before the historical last-close line, so
the two time periods remain visually distinct within each shop row.

Completed: historical last-close rows now have a compact 4px top gap in
addition to their divider, balancing the spacing between the two periods.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP verification, and a live computed-style smoke.

## Step 241 — complete

Task: add a muted color treatment to the historical last-close label, so
its prior-day status is clear without competing with current traffic color.

Completed: the historical last-close line now uses a restrained muted color,
while current traffic retains its stronger status color and the historical
divider remains visible. Covered by the full deterministic suite (158 passing
tests), syntax checks, local HTTP verification, and a live computed-style
smoke.

## Step 242 — complete

Task: add a compact “live” cue to the today reading, so the current period
is equally explicit when historical data is present.

Completed: current shop traffic readings now show a compact green “live” cue,
paired with the muted historical treatment for last close. Covered by the
full deterministic suite (158 passing tests), syntax checks, local HTTP source
verification, and a live page/style smoke.

## Step 243 — complete

Task: add an accessible description to the live cue, so its current-period
meaning is explicit independently of color and placement.

Completed: the live cue now exposes “live current-period traffic” to
assistive technology while retaining its hover text and visual treatment.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP source verification, and a live page-boot/legend smoke.

## Step 244 — complete

Task: add a short visible label to the live cue’s tooltip treatment, so
the current-period meaning is consistent across hover and focus states.

Completed: the live cue now uses the same “live current-period traffic” wording
for both its hover title and accessible label. Covered by the full deterministic
suite (158 passing tests), syntax checks, local HTTP source verification, and a
live page-boot/legend smoke.

## Step 245 — complete

Task: add an explicit “historical” cue to the last-close line, so its
muted styling is reinforced by matching visible wording.

Completed: the existing “last close (historical)” wording is now emphasized
as a compact labeled cue with its own hover description, while the rest of the
historical line stays muted. Covered by the full deterministic suite (158
passing tests), syntax checks, local HTTP source verification, and a live
page/style smoke.

## Step 246 — complete

Task: add an accessible label to the historical cue itself, so its
previous-day meaning is explicit independently of the parent line.

Completed: the emphasized historical cue now exposes “historical previous-
closed-day traffic” to assistive technology, matching its hover description.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP source verification, and a live page-boot/legend smoke.

## Step 247 — complete

Task: add a compact “historical” cue to the revenue value as well, so
traffic and money share the same visible time language.

Completed: historical revenue now uses the same emphasized cue as historical
traffic, including a matching previous-closed-day hover and accessible label.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP source verification, and a live page/style smoke.

## Step 248 — complete

Task: add a compact “current” cue to today’s revenue value, so both live
traffic and live money share the same time language.

Completed: today’s revenue now shows a matching “live revenue” cue alongside
the live customer count, keeping current traffic and current money aligned.
Covered by the full deterministic suite (158 passing tests), syntax checks,
local HTTP source verification, and a live page-boot/legend smoke.

## Step 249 — complete

Task: add a shared live-period color treatment to the today revenue cue,
so current money and current traffic read as one visual group.

Completed: verification confirms both current customer traffic and current
revenue cues use the shared `.shop-traffic-live` green treatment, with two
served-source uses and a live stylesheet check. Covered by the full
deterministic suite (158 passing tests), syntax checks, local HTTP source
verification, and a live page/style smoke.

## Step 250 — complete

Task: add a compact live-period cue to the aggregate served-today total,
so the panel summary matches each shop row.

Completed: the aggregate served-today summary now shows “live total” with the
same accessible current-period wording and green treatment as shop rows; an
empty shop list still says “no shops.” Covered by the full deterministic suite
(158 passing tests), syntax checks, local HTTP source verification, and a live
page/style smoke.

## Step 251 — complete

Task: add a matching historical-period cue to the aggregate summary when
closed-day shop records are available.

Completed: the aggregate panel now reports the latest closed-day served and
realized-revenue totals for currently occupied shops, with a labeled
historical cue and no output when there is no matching history. Covered by the
commercial regression coverage, the full deterministic suite (159 passing
tests), syntax checks, local HTTP source verification, and a live page-boot
smoke.

## Step 252 — complete

Task: add a compact closed-day identifier to the aggregate historical cue,
so the summary’s time point is immediately scannable.

Completed: aggregate historical totals now show the closed-day identifier as a
small outlined `D#` badge with an accessible description. Covered by the
commercial regression coverage, the full deterministic suite (159 passing
tests), syntax checks, local HTTP source verification, and a live page/style
smoke.

## Step 253 — complete

Task: add the same closed-day identifier to each shop’s historical line,
so row-level and aggregate history use the same time reference.

Completed: each shop’s historical line now shows the matching closed-day `D#`
badge with a shop-history accessible description. Covered by the full
deterministic suite (159 passing tests), syntax checks, local HTTP source
verification, and a live page/style smoke.

## Step 254 — complete

Task: add the closed-day identifier to the shop history trend line, so
multi-day history keeps its time references explicit.

Completed: every point in the per-shop history trend now shows its closed-day
`D#` badge with an accessible identifier, matching the aggregate and last-close
lines. Covered by the full deterministic suite (159 passing tests), syntax
checks, local HTTP source verification, and a live page/style smoke.

## Step 255 — complete

Task: add a compact “latest” marker to the final shop history point, so
the most recent historical reading is easy to find in a longer trend.

Completed: the final per-shop history point now shows an accessible “latest”
marker with a restrained info-color treatment, leaving earlier points
unchanged. Covered by the full deterministic suite (159 passing tests), syntax
checks, local HTTP source verification, and a live page/style smoke.

## Step 256 — complete

Task: add a matching “latest” marker to the aggregate historical total,
so the summary and row-level trends identify the same newest period.

Completed: the aggregate historical total now marks its newest closed-day
reading with the same accessible “latest” cue used by per-shop history.
Covered by the full deterministic suite (159 passing tests), syntax checks,
local HTTP source verification, and a live page/style smoke.

## Step 257 — complete

Task: add a compact historical-period marker to the aggregate revenue
value, so the summary’s money reading carries the same cue as its traffic.

Completed: aggregate historical revenue now uses the same emphasized cue and
accessible previous-closed-day wording as aggregate traffic and row-level
revenue. Covered by the full deterministic suite (159 passing tests), syntax
checks, local HTTP source verification, and a live page/style smoke.

## Step 258 — complete

Task: add a compact live-period cue to the aggregate revenue value, so the
summary’s current money reading pairs with “live total.”

Completed: the aggregate shop summary now reports live revenue alongside its
live served total, using the shared live cue and accessible current-period
wording. Covered by the full deterministic suite (159 passing tests), syntax
checks, local HTTP source verification, and a live page/style smoke.

## Step 259 — complete

Task: add a compact revenue label to the aggregate historical line, so
live and historical totals use parallel money wording.

Completed: the aggregate historical line already carries the parallel
“historical revenue” cue, with previous-closed-day hover and accessible
wording matching the live aggregate revenue cue. Covered by the full
deterministic suite (159 passing tests), syntax checks, local HTTP source
verification, and a live page/style smoke.

## Step 260 — complete

Task: add a compact live-versus-last-close served delta to the aggregate
summary, so the player can see whether current traffic is improving.

Completed: the aggregate summary now compares live served customers with the
latest closed-day total and labels the result as improvement, decline, or no
change with matching status color and accessible text. Covered by the
commercial regression coverage, the full deterministic suite (159 passing
tests), syntax checks, local HTTP source verification, and a live empty-state
smoke.

## Step 261 — complete

Task: add the same served delta to each shop row, so local problem spots
are visible instead of only the building-wide trend.

Completed: each shop row now shows a live-versus-last-close served delta when
history exists, colored and labeled as improvement, decline, or no change;
shops without history remain uncluttered. Covered by the full deterministic
suite (159 passing tests), syntax checks, local HTTP source verification, and a
live empty-state smoke.

## Step 262 — complete

Task: add the corresponding revenue delta to each shop row, so local
traffic and money trends can be read together.

Completed: each shop row now shows a live-versus-last-close revenue delta
alongside its served-customer delta, with improvement, decline, and no-change
states matching the traffic indicator colors and accessible wording. Covered
by the full deterministic suite (159 passing tests), syntax checks, local HTTP
source verification, and a live empty-state smoke.

## Step 263 — complete

Task: add the corresponding revenue delta to the aggregate summary, so
building-wide traffic and money trends can be read together.

Completed: the aggregate shop summary now compares live revenue with the
latest closed-day revenue total and labels the result as improvement, decline,
or no change with matching status color and accessible text. Covered by the
full deterministic suite (159 passing tests), syntax checks, local HTTP source
verification, and a corrected live rendered-page smoke.

## Step 264 — complete

Task: make the aggregate traffic and revenue deltas share one compact
trend treatment, so the building-wide summary is easier to scan at a glance.

Completed: the aggregate last-close line now groups served and revenue change
under one compact, color-coded trend cue, while retaining full hover and
screen-reader descriptions for each measure. Covered by the full deterministic
suite (159 passing tests), syntax checks, local HTTP source verification, and a
live rendered-page/style smoke.

## Step 265 — complete

Task: apply the same compact trend treatment to each shop row, so local
traffic and revenue changes are equally easy to scan.

Completed: each shop row now groups served and revenue change under the same
compact, color-coded trend cue as the aggregate summary, with full hover and
screen-reader descriptions retained and no trend clutter before history exists.
Covered by the full deterministic suite (159 passing tests), syntax checks,
local HTTP source verification, and a live rendered-page/style smoke.

## Step 266 — complete

Task: add a compact trend legend entry explaining the served and revenue
delta colors, so the new cues are self-explanatory in context.

Completed: the shop traffic legend now explicitly explains that green means
improvement, red means decline, and amber means no change for both served and
revenue trends, with matching visible color samples and accessible wording.
Covered by the full deterministic suite (159 passing tests), syntax checks,
local HTTP source verification, and a live rendered-page legend smoke.

## Step 267 — complete

Task: add an explicit “no comparison yet” cue to the aggregate summary
before the first closed day, so missing history is distinguishable from a
neutral trend.

Completed: when occupied shops exist without a closed-day baseline, the
aggregate summary now says “comparison pending · first close establishes the
last-close baseline,” with warning styling and accessible wording; the cue is
hidden when there are no shops. Covered by the full deterministic suite (159
passing tests), syntax checks, local HTTP source verification, and a live
pre-history smoke.

## Step 268 — complete

Task: add the same explicit pending-comparison cue to each shop row before
its first closed day, keeping local and aggregate states consistent.

Completed: each shop row now says “comparison pending · first close
establishes a last-close baseline for this shop” before history exists, using
the shared warning style and accessible wording; rows switch back to their
historical comparison once a close is available. Covered by the full
deterministic suite (159 passing tests), syntax checks, local HTTP source
verification, and a live pre-history smoke.

## Step 269 — complete

Task: distinguish the aggregate and shop pending cues with concise scope
labels, so players can immediately tell which comparison will be established.

Completed: pending cues now begin with explicit “building” or “shop” scope
labels, use matching accessible descriptions, and remain absent in the empty
starting state. Covered by the full deterministic suite (159 passing tests),
syntax checks, local HTTP source verification, and a live scope-label smoke.

## Step 270 — complete

Task: add the same scope language to historical trend descriptions, so
hover and screen-reader feedback stays consistent after the first close.

Completed: aggregate trend descriptions now identify the building scope, while
shop-row delta and historical cues identify the shop scope; the visible trend
labels, hover text, and accessible descriptions stay aligned. Covered by the
full deterministic suite (159 passing tests), syntax checks, local HTTP source
verification, and a live rendered-page smoke.

## Step 271 — complete

Task: add a compact “baseline” label to historical aggregate and shop
readings, so the comparison reference is unmistakable at a glance.

Completed: shop historical cues now identify the previous closed-day reading
as the local baseline, and the aggregate historical total carries the same
baseline label; both include matching hover and accessible descriptions.
Covered by the full deterministic suite (159 passing tests), syntax checks,
local HTTP source verification, and a live baseline-style smoke.

## Step 272 — complete

Task: add a concise baseline explanation to the legend, so players know
which historical day the trend values use before reading the deltas.

Completed: the legend now explains that “baseline” means the latest closed
day used by trend values, with matching visible styling and accessible text.
Covered by the full deterministic suite (159 passing tests), syntax checks,
local HTTP source verification, and a live rendered-page legend smoke.

## Step 273 — complete

Task: add a compact “first close” hint beside the pending cues, so players
know exactly when the baseline will become available.

Completed: both building and shop pending messages now include a compact
“first close” badge, with accessible text explaining that the baseline appears
when the first simulated day ends. Covered by the full deterministic suite
(159 passing tests), syntax checks, local HTTP source verification, and a live
pre-history timing-cue smoke.

## Step 274 — complete

Task: make the pending cue update to historical baseline state immediately
after day close, so the transition is clear without a manual refresh.

Completed: the day-close path now announces “SHOP BASELINE READY” once when
the first shop history is recorded, then refreshes the UI so pending cues are
replaced immediately by the historical baseline and trend comparison. The
announcement resets on restart. Covered by the full deterministic suite (159
passing tests), syntax checks, local HTTP source verification, and a live
clean-boot smoke.

## Step 275 — complete

Task: show the baseline-ready transition in the shop traffic panel itself,
so the state change remains visible after the toast fades.

Completed: the shop traffic panel now retains a scoped “baseline ready ·
latest close D# anchors building trends” status after a shop close, while the
one-time toast still announces the transition and restart clears the status.
Covered by the full deterministic suite (159 passing tests), syntax checks,
local HTTP source verification, and a live clean-boot/style smoke.

## Step 276 — complete

Task: scope the persistent baseline-ready status to the currently visible
shop set, so filtered or changed occupancy cannot imply a stale building-wide
comparison.

Completed: the persistent status now says “building” only when every visible
shop is covered by the latest baseline; otherwise it reports the covered
fraction (for example, “the 1/2 visible shops”), with matching title and
accessible descriptions. Covered by the full deterministic suite (159 passing
tests), syntax checks, local HTTP source verification, and a live empty-state
scope smoke.

## Step 277 — complete

Task: make the historical aggregate line use the same covered-scope
wording, so its baseline total and persistent status cannot disagree.

Completed: the historical aggregate line now reuses the same building or
covered-fraction scope phrase as the persistent baseline status, including its
title and accessible description. Covered by the full deterministic suite (159
passing tests), syntax checks, local HTTP source verification, and a live
clean-boot scope smoke.

## Step 278 — complete

Task: add a compact “partial baseline” cue when only some visible shops
have historical coverage, so incomplete comparisons are visually distinct.

Completed: incomplete historical coverage now uses an amber “partial baseline”
cue in both the historical aggregate line and persistent status, while a
complete visible-shop set retains the blue baseline cue; both include the
covered scope in their descriptions. Covered by the full deterministic suite
(159 passing tests), syntax checks, local HTTP source verification, and a live
partial-state/style smoke.

## Step 279 — complete

Task: add a legend explanation for “partial baseline,” so the amber state
is understandable without hover text.

Completed: the legend now explains that “partial baseline” means only some
visible shops have historical coverage, with the same amber styling used by
the partial state and matching accessible wording. Covered by the full
deterministic suite (159 passing tests), syntax checks, local HTTP source
verification, and a live rendered-page/style smoke.

## Step 280 — complete

Task: add a compact “covered shops” count to the aggregate trend cue, so
the partial-baseline scope is visible without reading the longer label.

Completed: the aggregate trend cue now shows a compact `covered X/Y` count,
with a title and accessible description stating how many visible shops have a
closed-day baseline. The count is hidden when no historical aggregate exists.
Covered by the full deterministic suite (159 passing tests), syntax checks,
local HTTP source verification, and a live empty-state/style smoke.

## Step 281 — complete

Task: add the same covered-count cue to the persistent baseline status, so
its short summary and detailed trend line agree at a glance.

Completed: the persistent baseline status now includes the same compact
`covered X/Y` count as the aggregate trend cue, and its accessible description
reports the identical visible-shop coverage. Covered by the full deterministic
suite (159 passing tests), syntax checks, local HTTP source verification, and a
live empty-state/style smoke.

## Step 282 — complete

Task: add a compact “baseline scope” heading to the aggregate history
block, so the count and baseline label read as one clear unit.

Completed: the aggregate historical block now begins with a compact semantic
“baseline scope” heading that groups its day, coverage, baseline, and trend
details, with matching accessible text. Covered by the full deterministic suite
(159 passing tests), syntax checks, local HTTP source verification, and a live
empty-state/style smoke.

## Step 283 — complete

Task: add the same baseline-scope heading treatment to each shop history
block, so local history has the same visual structure as aggregate history.

Completed: each shop historical block now begins with a semantic “baseline
scope” heading identifying its local baseline context, matching the aggregate
history structure and accessible treatment. Covered by the full deterministic
suite (159 passing tests), syntax checks, local HTTP source verification, and a
live empty-state/style smoke.

## Step 284 — complete

Task: make the shop baseline-scope heading include its compact coverage
state, so complete and partial local history are distinguishable immediately.

Completed: shop history headings now show `baseline scope · covered 1/1` when
that shop has a matching closed-day baseline, while pre-history rows retain the
explicit pending cue. Covered by the full deterministic suite (159 passing
tests), syntax checks, local HTTP source verification, and a live
empty-state/style smoke.

## Step 285 — complete

Task: add a compact “baseline day” marker to each shop history heading, so
the local reference day is visible before reading the detailed line.

Completed: each shop history heading now includes its closed-day baseline
badge and accessible day description, with the duplicate day marker removed
from the detail line for a cleaner local reading. Covered by the full
deterministic suite (159 passing tests), syntax checks, local HTTP source
verification, and a live empty-state/style smoke.

## Step 286 — complete

Task: add a compact baseline-day marker to the persistent aggregate status,
so its quick summary and historical block expose the same reference day.

Completed: the persistent aggregate status now includes an explicit `baseline
day D#` badge alongside its coverage count, with matching title and accessible
description. Covered by the full deterministic suite (159 passing tests),
syntax checks, local HTTP source verification, and a live empty-state/style
smoke.

## Step 287 — complete

Task: add a baseline-day marker to the shop traffic legend, so the current
reference convention is visible without opening a history block.

Completed: the shop traffic legend now names the reference as `baseline day
D#` and explains that it is the latest closed day used by trend values, with
matching visible and accessible wording. Covered by the full deterministic
suite (159 passing tests), syntax checks, local HTTP source verification, and
a live rendered-page accessibility smoke.

## Step 288 — complete

Task: add an explicit “current period” marker to the shop traffic legend,
so the live side of each comparison is equally clear.

Completed: the shop traffic legend now labels `current period` as live today,
balancing the explicit baseline-day convention and including matching hover and
accessible wording. Covered by the full deterministic suite (159 passing
tests), syntax checks, local HTTP source verification, and a live rendered-page
accessibility smoke.

## Step 289 — complete

Task: add a compact current-period marker to the aggregate live summary,
so the panel’s live values and legend use the same vocabulary.

Completed: the aggregate live summary now labels its live traffic as
`current period` and its live money as `current revenue`, with matching
accessible descriptions; the no-shops state remains clean. Covered by the
full deterministic suite (159 passing tests), syntax checks, local HTTP source
verification, and a live empty-state/vocabulary smoke.

## Step 290 — complete

Task: align each shop row’s live traffic and revenue labels with the same
current-period vocabulary used by the aggregate summary and legend.

Completed: each shop row now labels live traffic as `current period` and live
money as `current revenue`, with shop-specific accessible descriptions matching
the aggregate summary and legend. Covered by the full deterministic suite (159
passing tests), syntax checks, local HTTP source verification, and a live
empty-state/vocabulary smoke.

## Step 291 — complete

Task: add a compact current-period heading to each shop row, so its live
values are grouped before the trend cue.

Completed: each shop traffic section now begins with a compact `current period`
heading beside its today-versus-last-close context, with matching accessible
labeling and styling. Covered by the full deterministic suite (159 passing
tests), syntax checks, local HTTP source verification, and a live
empty-state/style smoke.

## Step 292 — complete

Task: add a current-period heading to the aggregate shop summary, so its
live totals use the same visual structure as individual shop rows.

Completed: the aggregate shop summary now begins with a compact `current
period · aggregate shop totals` heading matching individual shop rows, with
accessible labeling and no heading in the no-shops state. Covered by the full
deterministic suite (159 passing tests), syntax checks, local HTTP source
verification, and a live empty-state/style smoke.

## Step 293 — complete

Task: align the aggregate current-period heading with the live
current-value cue, so the heading and values share one consistent label.

Completed: the aggregate `current period` heading now shares the same live
cue styling as its current traffic and revenue values, keeping the visual
signal consistent while preserving the accessible aggregate label. Covered
by the full deterministic suite (159 passing tests), syntax checks, local
source verification, and a live page/style smoke.

## Step 294 — complete

Task: make the aggregate current-period heading identify the live values
as a single grouped summary before the historical baseline appears.

Completed: the aggregate current-period heading and live traffic/revenue
values now share one semantic \`current period aggregate shop totals\` group,
which closes before historical baseline, pending-comparison, and response
filter content. Covered by the full deterministic suite (159 passing tests),
syntax checks, source verification, and a live empty-state/style smoke.

## Step 295 — complete

Task: add a concise legend for the building’s waiting and tenant-count
indicators, so the occupancy and service colors are understandable at a
glance.

Completed: the legend now documents the exact waiting bands (green 0, amber
1–11, red 12+) and tenant-load bands (red below 50%, amber 50–74%, green
75%+) using matching segmented swatches. Covered by the full deterministic
suite (159 passing tests), syntax checks, source verification, and a live
rendered-legend/style smoke.

## Step 296 — complete

Task: add explicit non-color wording to the floor and room indicators,
so their numbers remain understandable when the canvas colors are hard to
distinguish.

Completed: canvas floor badges now read \`W count\` and room badges read
\`T tenants/capacity\`, while retaining their waiting-pressure and occupancy
colors. The legend defines both abbreviations and their thresholds. Covered
by the full deterministic suite (160 passing tests), syntax checks, source
verification, and a live canvas/legend load smoke.

## Step 297 — complete

Task: expose the same W/T labels in the floor-selection controls, so the
sidebar and canvas use one consistent vocabulary.

Completed: floor-selection buttons now show \`W count\` and \`T
tenants/capacity\` with the existing waiting and occupancy colors, and their
accessible labels spell out the full meanings. Covered by the full
deterministic suite (160 passing tests), syntax checks, source verification,
and a live floor-control smoke.

## Step 298 — complete

Task: add the W/T vocabulary to the selected-floor detail, so focusing a
floor preserves the same compact signals across the whole sidebar.

Completed: selected-floor detail now shows \`W count\` and \`T
tenants/capacity\`, matching floor buttons and canvas badges while preserving
the existing room and vacancy context. Covered by the full deterministic suite
(160 passing tests), syntax checks, source verification, and a live
selected-floor smoke.

## Step 299 — complete

Task: align room inspection’s tenant-load line with the same T
tenants/capacity vocabulary.

Completed: the room evaluation list now shows \`T tenants/capacity\` beside
the existing full/partial/light-load status, matching the canvas, floor
controls, and selected-floor detail. Covered by the full deterministic suite
(160 passing tests), syntax checks, source verification, and a live room-load
panel smoke.

## Step 300 — complete

Task: align the selected room inspector’s occupied status with the T
tenant-count vocabulary.

Completed: an occupied room’s inspector status now shows \`T
tenants/capacity\` instead of a bare tenant count, matching the room
evaluation list and canvas while leaving abandoned-room status intact.
Covered by the full deterministic suite (160 passing tests), syntax checks,
source verification, and a live source/load smoke.

## Step 301 — complete

Task: add the T tenant-count cue to the building-wide tenant total, so
the headline occupancy metric matches room and floor indicators.

Completed: the headline tenant total now reads \`T tenants/capacity\` (for
example, \`T 18/18\`) while retaining its load color, percentage, and trend
readouts. Covered by the full deterministic suite (160 passing tests), syntax
checks, source verification, and a live HUD smoke.

## Step 302 — complete

Task: add a matching W waiting-count cue to the building-wide waiting
headline, completing the shared top-level indicator vocabulary.

Completed: the building-wide waiting headline now reads \`W count\`, keeping
the pressure color and full tooltip while matching floor badges and selected
floor detail. Covered by the full deterministic suite (160 passing tests),
syntax checks, source verification, and a live HUD/color smoke.

## Step 303 — complete

Task: add an explicit top-level legend cue for the headline W and T
metrics, so the shared vocabulary is visible before the player studies the
canvas legend.

Completed: the HUD now includes a compact \`W waiting people · T tenants /
capacity\` key beneath the headline waiting metric, making the shared labels
discoverable before the canvas legend. Covered by the full deterministic suite
(160 passing tests), syntax checks, source verification, and a live HUD
visibility/style smoke.

## Step 304 — complete

Task: add compact good/warn/bad samples to the HUD key, tying the headline
W/T values to the color bands already used on the building.

Completed: the HUD key now connects the shared W/T labels to the existing
status colors with \`green clear/full\`, \`amber watch/partial\`, and
\`red critical/light\` samples. Covered by the full deterministic suite (160
passing tests), syntax checks, source verification, and a live HUD color-key
smoke.

## Step 305 — complete

Task: add the exact waiting thresholds to the HUD key, so the W headline
color has an actionable numeric boundary without opening the full legend.

Completed: the HUD key now spells out the exact W bands—green 0 clear, amber
1–11 watch/busy, and red 12+ critical—alongside the matching T occupancy
bands. Covered by the full deterministic suite (160 passing tests), syntax
checks, source verification, and a live six-sample HUD threshold smoke.

## Step 306 — complete

Task: make the headline W/T key visually subordinate to the live numbers,
so it explains the signals without competing with the primary metrics.

Completed: the W/T threshold key is now a smaller, muted, inset diagnostic
under the headline waiting metric, while its six colored samples remain
visible and readable. Covered by the full deterministic suite (160 passing
tests), syntax checks, source verification, and a live computed-style smoke.

## Step 307 — complete

Task: add W/T wording to canvas hover feedback, so inspecting a floor or
room gives the same meaning even when the player is not reading the sidebar.

Completed: the canvas hover status now appends the hovered floor’s live
\`W waiting\` and \`T tenants/capacity\` values to its existing placement or
inspection guidance. The cue is generated only for a valid floor and does not
alter explicit action confirmations. Covered by the full deterministic suite
(160 passing tests), syntax checks, source verification, and a live page-load
smoke.

## Step 308 — complete

Task: make the W/T hover cue include the same color-band status words as
the HUD key, so the pointer feedback explains both count and urgency.

Completed: valid-floor hover feedback now reports the calculated waiting band
and tenant-load band, such as \`W 8 busy\` and \`T 4/6 partial\`, alongside
the counts. Invalid-floor hover remains silent. Covered by the full
deterministic suite (160 passing tests), syntax checks, source verification,
and a live page/status smoke.

## Step 309 — complete

Task: add explicit W/T status wording to the selected-floor action
recommendation, so the next-action guidance names the signal it responds to.

Completed: actionable selected-floor guidance now names its trigger, using
\`responds to W count band\` for transport pressure and \`responds to T
tenants/capacity band\` for vacancy pressure. Quiet floors keep the existing
recommendation text. Covered by the full deterministic suite (160 passing
tests), syntax checks, source verification, and a live selected-floor smoke.

## Step 310 — complete

Task: add the W/T trigger cue to the selected-floor focus heading, so the
signal remains visible while the player reads the recommendation details.

Completed: selected-floor focus now keeps live W count-band and T
tenants/capacity-band cues in its heading, with matching hover descriptions
and shared status wording. Covered by the full deterministic suite (160
passing tests), syntax checks, source verification, and a live selected-floor
header smoke.

## Step 311 — complete

Task: make selected-floor W/T header cues announce their exact color
meaning in accessible descriptions, not only their status words.

Completed: selected-floor W/T cues now expose exact color meanings in both
aria labels and hover descriptions, such as green meaning clear waiting or
full tenant capacity. Covered by the full deterministic suite (161 passing
tests), syntax checks, source verification, and a live selected-floor cue
smoke.

## Step 312 — complete

Task: extend the exact W/T color meanings to floor-list accessible labels,
so scanning floors explains urgency and load before a floor is selected.

Completed: floor-list buttons now include the exact W/T color meanings in
their accessible labels, so a player can scan waiting urgency and tenant load
before selecting a floor. Covered by the full deterministic suite (161
passing tests), syntax checks, source verification, and a live floor-list
label smoke.

## Step 313 — complete

Task: add the same exact W/T color meanings to floor-list hover text, so
mouse users can understand the indicators without selecting a floor.

Completed: floor-list buttons now use the full W/T color explanation as their
hover title as well as their accessible label, keeping mouse and assistive
scanning aligned. Covered by the full deterministic suite (161 passing
tests), syntax checks, source verification, and a live floor-hover-label
smoke.

## Step 314 — complete

Task: add the exact tenant-load color meaning to room-evaluation rows, so
the T indicator remains understandable while comparing individual spaces.

Completed: room-evaluation rows now expose the exact tenant-load color meaning
in both hover text and accessible labels, while retaining the compact T count
and full/partial/light status. Covered by the full deterministic suite (161
passing tests), syntax checks, source verification, and a live room-row label
smoke.

## Step 315 — complete

Task: add the exact tenant-load color meaning to the selected room
inspector status, so the detailed room view keeps the same T explanation.

Completed: the selected room inspector now shows the T load band beside its
occupied status and exposes the exact color meaning in hover and accessible
text. Abandoned rooms retain a clear non-active-load explanation. Covered by
the full deterministic suite (161 passing tests), syntax checks, source
verification, and a live room-inspector smoke.

## Step 316 — complete

Task: add the exact waiting-pressure color meaning to the building-wide W
headline hover text, so the top-level queue signal is self-explanatory.

Completed: the building-wide W headline now exposes its exact waiting-pressure
color meaning in both hover and accessible text, while retaining the compact
W count and live color. Covered by the full deterministic suite (161 passing
tests), syntax checks, source verification, and a live HUD-label smoke.

## Step 317 — complete

Task: add the exact tenant-load color meaning to the building-wide T
headline hover text, completing the top-level W/T explanation pair.

Completed: the building-wide T headline now exposes its exact tenant-load
color meaning in both hover and accessible text, completing the top-level W/T
explanation pair. Covered by the full deterministic suite (161 passing tests),
syntax checks, source verification, and a live HUD-label smoke.

## Step 318 — complete

Task: add a separate tower-wide desirability summary using the existing
room-evaluation signals, so desirability can grow toward SimTower without
being confused with elevator-service reputation.

Completed: the HUD and systems panel now show a separate tower desirability
index built from room appeal and livability signals—view, amenities, layout,
renovation, floor fit, noise, required services, and rent fit—while explicitly
excluding elevator wait, walking access, stress, and reputation. The score is
observational only for now. A live verification also caught and fixed a
missing build-panel lookup that blocked page initialization. Covered by the
full deterministic suite (162 passing tests), syntax checks, source
verification, and a clean live load with no page errors.

## Step 319 — complete

Task: record a bounded daily desirability history, so players can see
whether tower appeal is improving before it influences future tenant demand.

Completed: day close now records the current tower desirability in the
deterministic log, and the HUD and systems panel show a bounded oldest-to-
newest daily sparkline plus readable day values. The history is observational
only and does not affect tenant demand. Covered by the full deterministic
suite (163 passing tests), syntax checks, source verification, and a live
accelerated day-cycle smoke with no page errors.

## Step 320 — complete

Task: add an exact numeric desirability change to the daily trend cue, so
players can distinguish a small movement from a flat reading at a glance.

Completed: desirability trends now show an exact point delta beside the
sparkline—positive, negative, zero, or unavailable—in the HUD and systems
panel. Covered by the full deterministic suite (163 passing tests), syntax
checks, source verification, and a live accelerated day-cycle smoke.

## Step 321 — complete

Task: add a bounded desirability effect to tenant-demand quality, with a
logged and visible room-level modifier that cannot overpower transport,
reputation, or tenant-mix signals.

Completed: each candidate room's desirability now adds a visible, bounded
appeal modifier of at most ±4 points to tenant-demand quality. The tower
desirability HUD remains an aggregate summary, while the vacancy ranking uses
the candidate room's own appeal signals. Reputation remains the hard move-in
gate; access/service demand and tenant-mix demand stay separate. The score and
modifier are recorded in move-in events and leasing outcomes, and the UI names
them in vacancy guidance and history. Covered by the full deterministic suite
(165 passing tests), syntax checks, source verification, and a clean live
demand-path load with no page errors.

## Step 322 — complete

Task: add a deterministic tied-vacancy scenario proving candidate-room
desirability can break an otherwise equal demand ranking without exceeding
its ±4-point cap.

Completed: a controlled tied-vacancy test now verifies that equal room
evaluation and market demand can be separated by room desirability, with the
winner staying within the configured ±4-point modifier. Covered by the full
deterministic suite (165 passing tests), syntax checks, source verification,
and a clean live load with no page errors.

## Step 323 — complete

Task: make vacancy guidance state explicitly when room desirability is the
reason one otherwise-ready room ranks above another.

Completed: the leasing panel now calls out the exact case where the top two
vacancies match on room quality, access/services, and tenant-mix demand, but
the higher room-appeal modifier determines the winner. Covered by the full
deterministic suite (165 passing tests), syntax checks, source verification,
and a clean live load with no page errors.

## Step 324 — complete

Task: add a bounded, separately logged tenant-retention pressure from
room desirability while keeping elevator stress as a distinct exit cause.

Completed: low room appeal now builds a slow, recoverable pressure meter for
occupied rooms. Reaching its conservative threshold can create a
`room_desirability` departure, while elevator-related departures remain
`transport_stress`; both causes are recorded in events and daily retention
summary data. The room list, inspector, and systems panel expose the pressure
and the separate cause counts. Covered by the full deterministic suite (167
passing tests), syntax checks, source verification, and a clean live load with
no page errors.

## Step 325 — complete

Task: retain a short daily history of appeal pressure so the player can
see accumulation or recovery before a tenant leaves.

Completed: each closed day now records bounded average appeal pressure and
the number of affected rooms. The systems panel shows an oldest-to-newest
pressure trend with an exact delta and marks rising pressure as bad and
recovery as good. Covered by the full deterministic suite (168 passing
tests), syntax checks, source verification, and a clean live load with no
page errors.

## Step 326 — complete

Task: turn rising room-level appeal pressure into a concrete management
recommendation that points to the room's likely improvement.

Completed: the largest visible appeal penalty now produces a plain-language
recommendation—such as adding food service, adding parking, reducing nearby
noise, lowering rent, or using a better-fit floor. Recommendations appear in
the systems panel, occupied-room rows, and the room inspector; clear-pressure
rooms do not receive a distracting action prompt. Covered by the full
deterministic suite (169 passing tests), syntax checks, source verification,
and a clean live load with no page errors.

## Step 327 — complete

Task: make a retention recommendation focusable so the player can inspect
the affected room before choosing an improvement.

Completed: the systems-panel recommendation now includes an inspect-room
button for the highest-pressure occupied room. Clicking it opens the normal
room inspector and identifies the source as a retention recommendation; it
does not build or modify anything automatically. Covered by the full
deterministic suite (169 passing tests), syntax checks, source verification,
and a live accelerated-day click check with no page errors.

## Step 328 — complete

Task: let a service recommendation select the matching build tool and
placement flow without bypassing player placement.

Completed: service recommendations now offer a matching “select tool” action
in addition to room inspection. It selects the existing service build tool,
focuses the affected room's floor, and leaves the normal floor/slot placement
to the player; it cannot build the service automatically. Covered by the full
deterministic suite (169 passing tests), syntax checks, source verification,
and a live accelerated-day selection check showing the tool selected while
the service remained unbuilt, with no page errors.

## Step 329 — complete

Task: show the recommended service's best nearby placement floor while
keeping final placement under player control.

Completed: service recommendations now rank open floors by target coverage,
tenant heads served, rooms served, distance from the affected room, and a
stable lower-floor tie-break. The retention panel shows the recommendation;
selecting the service highlights that floor and the valid coverage range while
leaving the final click to the player. Covered by the full deterministic
suite (170 passing tests), syntax checks, source verification, and a live
accelerated-day check showing recommended F2, the selected food tool, the
unbuilt service, and no page errors.

## Step 330 — complete

Task: show the expected coverage improvement before the player places the
recommended service.

Completed: the placement preview now projects required-room and tenant-head
coverage before construction, alongside the existing room-evaluation change.
The preview follows the recommended floor by default and updates if the
player hovers another valid floor. Covered by the full deterministic suite
(170 passing tests), syntax checks, source verification, and a live
accelerated-day check showing `service coverage 0/3 → 3/3 rooms · heads 0 →
18`, the selected food tool, the unbuilt service, and no page errors.

## Step 331 — complete

Task: make the recommended service placement preview distinguish a strong
coverage gain from a weak or unchanged one at a glance.

Completed: service projections now carry explicit `strong coverage gain`,
`partial coverage gain`, or `no coverage gain` labels, with matching preview
border/background emphasis and no dependence on color alone. Covered by the
full deterministic suite (170 passing tests), syntax checks, source
verification, and a live accelerated-day check showing the strong label and
`coverage-strong` state while the service remained unbuilt.

## Step 332 — complete

Task: show the realized service coverage change after the player places a
recommended facility.

Completed: guided facility placement now carries its before-state coverage
snapshot into the post-build result. After the player places the service, the
preview changes to an `INVESTMENT RESULT` with `REALIZED` coverage strength
and actual room/head counts, closing the forecast-to-action feedback loop.
Covered by the full deterministic suite (170 passing tests), syntax checks,
source verification, and a live placement check showing `REALIZED strong
coverage gain`, `0/3 → 3/3 rooms`, `0 → 18 heads`, and no page errors.

## Step 333 — complete

Task: let the realized coverage result remain readable while the game
continues running and the next daily readings arrive.

Completed: the latest realized facility result is retained independently from
the short-lived placement preview. The systems panel now keeps a compact
historical line with the build day, age cue, service, floor, strength, and
actual room/head coverage, so daily simulation refreshes do not erase the
feedback. Covered by the full deterministic suite (170 passing tests), syntax
checks, source verification, and a live accelerated-day check showing the
same `REALIZED strong coverage gain` after the next daily close, with no page
errors.

## Step 334 — complete

Task: make the historical facility result point back to the rooms and
service area it changed.

Completed: realized facility history now names the newly covered room floors,
the service coverage area, and provides a `focus area` action. Focusing it
selects the built service floor, opens an affected occupied room when one is
still present, and preserves the existing room/floor inspection flow. Covered
by the full deterministic suite (170 passing tests), syntax checks, source
verification, and a live placement-and-focus check with no page errors.

## Step 335 — complete

Task: make the focused facility result visible on the tower canvas as a
service-area highlight.

Completed: focusing a facility result now shades every floor in the service
coverage range, outlines the facility floor, and marks newly covered room
floors as `CHANGED`; `SERVICE`, `COVERED`, and `CHANGED` are also explained in
the legend. The highlight is a separate focus state, so it does not build or
replace anything and can coexist with the affected-room inspector. Covered
by the full deterministic suite (171 passing tests), syntax checks, source
verification, and a live placement-and-focus check showing the highlighted
mode, open affected room, updated legend, and no page errors.

## Step 336 — complete

Task: let the player clear or change the focused service area without
losing the historical facility result.

Completed: retained facility results are independently focusable, and an
active focus exposes a `clear focus` control. Clearing removes only the
canvas highlight; the historical result and its `focus area` action remain
available, while retained older results can be selected as a different focus.
Covered by the full deterministic suite (171 passing tests), syntax checks,
source verification, and a live focus/clear check showing the cleared mode,
preserved history, refocus control, and no page errors.

## Step 337 — complete

Task: make the focused service area show live covered-room counts as rooms
change or become vacant.

Completed: the focused facility result now recalculates its local covered-room
and covered-head counts from the current occupied rooms. The transport history
line shows the live `now` count while focused, and the canvas service marker
shows the current covered/required room count. Vacancies therefore reduce the
live count without rewriting the historical before/after result. Covered by
the full deterministic suite (171 passing tests), syntax checks, source
verification, and a live focus check showing the `now` count and no page
errors.

## Step 338 — complete

Task: make a focused service area call out when occupied rooms are still
uncovered, so the player can see where service demand remains.

Completed: focused service coverage now tracks uncovered rooms and heads by
floor. A missing-service floor is shaded and labeled `UNCOVERED`, the facility
floor keeps its live `SERVICE covered/required` marker plus an uncovered count,
and the transport history line explicitly calls out the remaining uncovered
rooms. The all-covered state is also labeled, so the cue does not rely on
color alone. Covered by the full deterministic suite (171 passing tests),
syntax checks, source verification, and a live focus check showing the
all-covered cue with no page errors.

## Step 339 — complete

Task: make an uncovered-room service cue provide a direct path to inspect
the affected room and choose the matching service tool.

Completed: an uncovered service result now identifies the first affected room
and offers both `inspect room` and `select [service] tool` actions. Inspection
uses the existing room inspector; tool selection reuses the existing guided
placement flow and keeps the affected room as the improvement target. Covered
by the full deterministic suite (171 passing tests), syntax checks, source
verification, and a live regression check confirming the shared service-tool
selection path still opens guided placement without page errors.

## Step 340 — complete

Task: show the focused service area's uncovered-room count in the floor
inspector, so the canvas focus and room-level diagnosis tell the same story.

Completed: selecting a floor inside the active service area now adds a local
service-focus row to the floor inspector with covered/required rooms and
heads. It distinguishes all covered demand, uncovered demand, and floors with
no occupied rooms requiring that service, keeping the W/T floor indicators
separate. Covered by the full deterministic suite (171 passing tests), syntax
checks, source verification, and a live focused-result check showing both the
floor service row and area-wide live coverage with no page errors.

## Step 341 — complete

Task: make the selected room inspector repeat the focused service status,
so a room opened from a coverage cue retains the missing-service context.

Completed: a room opened inside an active service focus now repeats the
service kind and its room-level status in the inspector's context panel. It
shows covered, `UNCOVERED`, or not-required, and includes the room's tenant
heads so the room view agrees with the floor and tower indicators. Covered by
the full deterministic suite (171 passing tests), syntax checks, source
verification, and a live focus check showing the room service context with no
page errors.

## Step 342 — complete

Task: add the matching service-tool action directly to the selected room
inspector when that room is uncovered.

Completed: an uncovered room's service-focus row now offers the matching
service-tool action directly inside the room inspector. It reuses the shared
guided-placement routine, preserves the room as the improvement target, and
keeps the existing re-rent and utilization actions separate. Covered by the
full deterministic suite (171 passing tests), syntax checks, source
verification, and a live focused-room regression check showing the service
context with no page errors.

## Step 343 — complete

Task: show the selected room's service result after a matching facility is
placed, so the player can confirm the room actually improved.

Completed: service placement outcomes now retain the triggering room ID. The
selected room inspector shows a room-level result—covered now or still
uncovered—alongside the area's aggregate before/after room and head counts.
Launching a service tool from retention guidance also keeps that room
selected, so the result appears in the same context after construction.
Covered by the full deterministic suite (171 passing tests), syntax checks,
source verification, and a live end-to-end placement check showing the room
result and realized coverage with no page errors.

## Step 344 — complete

Task: keep the selected room's service result visible through the next
daily close, while separating the historical placement result from live status.

Completed: the room-level service result is now tied to the bounded facility
result history by target room ID. The inspector keeps the recorded placement
day and before/after area counts, then separately reports the room's current
live coverage after later refreshes and daily-close updates. Covered by the
full deterministic suite (171 passing tests), syntax checks, source
verification, and live placement/result checks with no page errors.

## Step 345 — complete

Task: make the room-level service result distinguish a live vacancy from a
room that remains occupied but has lost coverage.

Completed: the selected room's retained service result now reports `room
vacant · no live tenant demand` when the tenant has left, instead of treating
vacancy as a service failure. Occupied rooms continue to report `room covered
now` or `room still uncovered`, while the recorded placement result remains
unchanged. Covered by the full deterministic suite (171 passing tests),
syntax checks, source verification, and live service-result checks with no
page errors.

## Step 346 — complete

Task: make the retained service result refresh its live tenant-head count
when the selected room's occupancy changes.

Completed: retained room service results now report a separate live tenant-head
count, using the current occupied load and zero when the room is vacant. The
recorded placement heads remain unchanged, so an occupancy change cannot be
mistaken for a change to the facility result. Covered by the full deterministic
suite (171 passing tests), syntax checks, source verification, and a live
placement check showing the recorded result plus live tenant heads with no
page errors.

## Step 347 — complete

Task: add a compact live-versus-recorded headcount delta to the selected
room service result.

Completed: the selected room result now shows recorded room heads before and
after placement, the current live tenant heads, and a signed delta from the
recorded after-placement count. This makes a vacancy or refill visible without
changing the historical facility result. Covered by the full deterministic
suite (171 passing tests), syntax checks, source verification, and a live
placement check showing the recorded-head and live-delta text with no page
errors.

## Step 348 — complete

Task: add the same live-versus-recorded headcount cue to the focused floor
service row.

Completed: facility results now retain covered heads by floor. When a result
is focused, the selected floor row compares its recorded covered heads before
and after placement with its current live covered heads and signed delta,
alongside the local covered/required room count. Neighboring floors no longer
distort the comparison. Covered by the full deterministic suite (171 passing
tests), syntax checks, source verification, and a live focused-floor check
showing both local service status and the headcount delta with no page errors.

## Step 349 — complete

Task: make the live floor service row distinguish a vacancy-driven head
count drop from a coverage-driven head count drop.

Completed: facility history now retains required heads by floor, and a
negative live covered-head delta is classified as `VACANCY-DRIVEN` when
occupied demand also fell, or `COVERAGE-DRIVEN` when occupied demand remains.
Stable floors receive no false drop label. Covered by the full deterministic
suite (172 passing tests), syntax checks, source verification, and a live
focused-floor check showing local service status and no false cause label with
no page errors.

## Step 350 — complete

Task: carry the vacancy-versus-coverage explanation into the selected room
service result.

Completed: the selected room result now labels an occupied room that remains
uncovered as `coverage-driven`, while a vacant room keeps the separate `room
vacant · no live tenant demand` status. The floor and room diagnoses now use
the same vacancy-versus-coverage vocabulary. Covered by the full deterministic
suite (172 passing tests), syntax checks, source verification, and a live
focused room/floor check showing consistent headcount deltas with no page
errors.

## Step 351 — complete

Task: add a daily service-status history for the selected room, so coverage
loss and recovery can be distinguished over time.

Completed: the selected room now records a bounded daily history tied to its
retained service result. Each entry shows day, covered/uncovered/vacant status,
live tenant heads, and transition cues, while the placement result remains
separate. History is reset on restart and retained per room. Covered by the
full deterministic suite (173 passing tests), syntax checks, source
verification, and a live service-placement/result check with no page errors.

## Step 352 — complete

Task: add a compact service-status trend label to the selected room
inspector, so the history quickly communicates recovering, worsening, or stable.

Completed: the selected room now summarizes its recorded service history as
`recovering`, `worsening`, or `stable`, with the same green, red, and amber
meaning used by the rest of the diagnosis UI. The trend is derived from the
chronological room readings and does not replace the detailed day-by-day line.
Covered by the full deterministic suite (174 passing tests), syntax checks,
source verification, and a live service-placement/result check with no page
errors.

## Step 353 — complete

Task: seed the selected room's service history at placement time, so its
current service baseline is visible before the first daily close.

Completed: placing a service for a guided room now records its current
covered/uncovered/vacant status immediately, and a later same-day close updates
that baseline instead of duplicating it. The selected room can therefore show
its first service trend as soon as placement finishes. Covered by the full
deterministic suite (175 passing tests), syntax checks, source verification,
and a live placement check confirming the service result and trend with no
page errors.

## Step 354 — complete

Task: make a worsening service trend point to the room's next concrete
coverage action.

Completed: a worsening uncovered-room trend now names the missing service and
offers its room-targeted service-tool action; a worsening vacant-room trend
points to re-renting before adding coverage. Stable and recovering trends stay
informational. Covered by the full deterministic suite (176 passing tests),
syntax checks, source verification, and a live service-placement/result check
with no page errors.

## Step 355 — complete

Task: carry the worsening-room action into the service placement preview,
so the recommended floor is explicit before the player clicks to build.

Completed: room-guided service placement now stores the recommendation detail
and shows the recommended floor together with its coverage payoff, including
the target floor, covered room count, and tenant-head count before construction.
Covered by the full deterministic suite (176 passing tests), syntax checks,
source verification, and a live preview showing `recommended F2`, its covered
rooms and heads, with no page errors.

## Step 356 — complete

Task: show the coverage difference when hovering an alternate service floor,
so the player can compare it with the recommendation before building.

Completed: the service placement preview now compares a hovered alternate with
the recommended floor using signed room and tenant-head differences. The
comparison appears alongside the existing coverage totals, so a weaker choice
is readable before construction. Covered by the full deterministic suite (176
passing tests), syntax checks, source verification, and a live hover check
showing the alternate-floor comparison with no page errors.

## Step 357 — complete

Task: require confirmation before accepting an alternate service placement
that loses coverage versus the recommendation.

Completed: a guided alternate service floor that loses rooms or tenant heads
against the recommendation now requires a second click on that same floor.
Recommended and equal choices remain one-click, and the warning clears after
successful placement so the success notice is authoritative. Covered by the
full deterministic suite (176 passing tests), syntax checks, source
verification, and a live two-click check confirming warning, placement, and
warning removal with no page errors.

## Step 358 — complete

Task: show service construction cost and remaining funds in the guided
placement preview before building.

Completed: room-guided service placement now shows the service cost and current
funds in both the mode line and the detailed placement preview. The preview
also turns red and names the shortfall when funds are insufficient. Covered by
the full deterministic suite (176 passing tests), syntax checks, source
verification, and a live preview check confirming cost and funds in both views
with no page errors.

## Step 359 — complete

Task: show remaining funds in the post-build service result, so the player
can immediately see the budget impact of the decision.

Completed: service placement results now show the actual funds remaining and
amount spent after construction alongside the realized coverage change. The
values come from the post-action budget, so they reflect the real decision
rather than a forecast. Covered by the full deterministic suite (176 passing
tests), syntax checks, source verification, and a live placement check showing
`funds remaining` and `spent` with no page errors.

## Step 360 — complete

Task: add daily operating costs for service facilities to the tower's
budget and day-close feedback.

Completed: every built service facility now contributes its configured daily
operating cost to total upkeep and net income at day close. The budget panel
breaks service upkeep out from floor and vacancy upkeep, and closed-day data
retains the separate `serviceUpkeep` amount. Covered by the full deterministic
suite (177 passing tests), syntax checks, source verification, and a live
day-close budget check showing `services $45` with no page errors.

## Step 361 — complete

Task: show each service facility's daily operating cost on its build
control before purchase.

Completed: unlocked service controls now show the upfront price plus the
configured daily upkeep, and their tooltips spell out both costs. Locked
services keep their population gate visible. Covered by the full deterministic
suite (177 passing tests), syntax checks, source verification, and a live
control check confirming the food, parking, and security labels with no page
errors.

## Step 362 — complete

Task: show the recurring-cost impact in the guided service placement
preview, so the player sees the ongoing budget effect before building.

Completed: room-guided service placement now shows the configured daily upkeep
beside the one-time cost in both the mode line and detailed placement preview.
This makes the ongoing budget effect visible before construction, while the
day-close budget panel remains the authoritative realized charge. Covered by
the full deterministic suite (177 passing tests), syntax checks, source
verification, and a live preview check confirming upkeep in both views with no
page errors.

## Step 363 — complete

Task: show the projected daily net change after a guided service placement,
so the player can weigh operating cost against the current budget.

Completed: the guided service placement preview now projects the direct daily
net effect of the facility's recurring upkeep, showing the current net, the
post-upkeep net, and the daily delta before construction. It deliberately
excludes uncertain future retention gains, keeping the estimate honest.
Covered by the full deterministic suite (177 passing tests), syntax checks,
source verification, and a live preview check confirming the projected net,
upkeep delta, and no page errors.

## Step 364 — complete

Task: show the realized daily net and service-upkeep breakdown in the
post-build service result, so the player can compare the estimate with the
actual day-close outcome.

Completed: a service placement now reports its upfront cost and daily upkeep
immediately, then updates after the first close with the realized daily net
and the total-upkeep versus service-upkeep breakdown. The transport history
row carries the realized figures as well, so the result remains inspectable
after the placement notice changes. Covered by the full deterministic suite
(177 passing tests), syntax checks, source verification, and a live paused
placement check confirming both the pending and realized states with no page
errors.

## Step 365 — complete

Task: keep the latest realized service budget result available in the
focused service history even after the player changes tools.

Completed: realized service budget values remain attached to the service
history entry after the placement notice is cleared by a tool change. The
focused history row continues to show the closed-day net and the total-upkeep
versus service-upkeep split. Covered by a live placement, day-close, tool
change, and history check with no page errors.

## Step 366 — complete

Task: show the current total daily upkeep from active service facilities
in the live budget panel before the next day closes.

Completed: the live budget panel now shows total active service upkeep per day
and the number of active service facilities, including a clear zero-cost state
before any service is built. The value updates immediately after construction
and remains separate from the realized day-close accounting. Covered by the
full deterministic suite (177 passing tests), syntax checks, source
verification, and a live check confirming both $0/day and a built cafeteria at
$45/day with no page errors.

## Step 367 — complete

Task: make a built service facility directly inspectable, showing its
covered floors, covered tenant demand, and daily upkeep.

Completed: clicking a built service facility while using the normal office
tool now selects it, highlights its service area, and reports the covered
floor range, covered rooms and tenant heads, and daily upkeep. Existing
placement tools keep their placement behavior. Covered by the full
deterministic suite (177 passing tests), syntax checks, source verification,
and a live canvas inspection check with no console errors.

## Step 368 — complete

Task: add a clear instruction that built service facilities can be clicked
for inspection, so the new management view is discoverable.

Completed: the START HERE guide now explicitly tells players to click a built
service to inspect its coverage and upkeep. Covered by the full deterministic
suite (177 passing tests), syntax checks, source verification, and a live DOM
check confirming the instruction with no console errors.

## Step 369 — complete

Task: visibly mark the inspected service facility itself while its service
area is focused.

Completed: the directly inspected facility now receives a bright selection
outline while the existing service-area highlight remains visible. This keeps
the selected building distinguishable from the floors it serves. Covered by
the full deterministic suite (177 passing tests), syntax checks, source
verification, and a rendered live inspection check with no console errors.

## Step 370 — complete

Task: add a hover cue for built service facilities so players can discover
that they are clickable before selecting one.

Completed: hovering a built service facility in the normal office tool now
adds a white outline and a mode-line cue explaining that a click opens its
coverage and upkeep inspection. Covered by the full deterministic suite (177
passing tests), syntax checks, source verification, and a rendered live hover
check with no console errors.

## Step 371 — complete

Task: preserve the exact facility selection when reopening a result from
service history.

Completed: service history entries now retain the facility ID created by the
placement, and reopening one restores the exact facility outline along with
the service-area focus. Older entries without an ID continue to focus their
coverage area safely. Covered by the full deterministic suite (177 passing
tests), syntax checks, source verification, and a live history round-trip
check with no console errors.

## Step 372 — complete

Task: label the service-history action as focusing the facility when an
exact facility is available, while retaining “focus area” for older entries.

Completed: exact-facility service-history actions now say “focus facility” and
explain in their tooltip that they restore the specific building and its
service area. Legacy area-only entries retain “focus area.” Covered by the
full deterministic suite (177 passing tests), syntax checks, source
verification, and a live history check confirming the label and tooltip with
no console errors.

## Step 373 — complete

Task: distinguish the focused-state label for an exact facility from an
area-only service focus.

Completed: exact facility history rows now become “focused facility” when
their facility is active, while area-only rows become “focused area.” Matching
also includes the facility identity, preventing same-kind facilities on one
floor from being conflated. Covered by the full deterministic suite (177
passing tests), syntax checks, source verification, and a live focus-label
transition check with no console errors.

## Step 374 — complete

Task: keep selected service-facility details in a dedicated sidebar
inspector while the player continues managing the tower.

Completed: selecting a facility now opens a persistent sidebar inspector with
its floor and type, active daily upkeep, covered floor range, covered rooms,
and covered tenant heads. The inspector remains visible after changing build
tools and updates with live demand. Covered by the full deterministic suite
(177 passing tests), syntax checks, source verification, and a live persistence
check with no console errors.

## Step 375 — complete

Task: show the selected facility's latest realized day-close budget result
in the persistent inspector when that result is available.

Completed: the persistent facility inspector now shows a pending state before
the first close and the latest realized close afterward, including net,
total upkeep, and service upkeep. Covered by the full deterministic suite
(177 passing tests), syntax checks, source verification, and a live pending-to-
realized transition check with no console errors.

## Step 376 — complete

Task: add a clear-focus control to the dedicated facility inspector.

Completed: the dedicated facility inspector now has a clear-focus control
that removes the facility selection and service-area highlight without
deleting the service history. Covered by the full deterministic suite (177
passing tests), syntax checks, source verification, and a live clear-focus
check confirming history retention with no console errors.

## Step 377 — complete

Task: keep the facility inspector's active selection and budget reading
stable through a day-close refresh.

Completed: the facility inspector remains open on the same facility through a
day-close refresh, keeps its live coverage and tenant-head counts, and changes
its budget line from pending to the realized close result. Covered by a live
day-close persistence check with no console errors.

## Step 378 — complete

Task: make an elevator shaft directly inspectable, showing its cars,
capacity, queue, and served floor span.

Completed: clicking an elevator shaft in the normal office tool now opens a
persistent shaft inspector with car count and limit, dispatch capacity,
current riders, queue count, moving/door status, and served floor span. The
selected shaft receives a visible outline, and facility focus is cleared when
switching to shaft inspection. Covered by the full deterministic suite (177
passing tests), syntax checks, source verification, and a live shaft click
check with no console errors.

## Step 379 — complete

Task: add a hover cue for elevator shafts so players can discover that
they are clickable for inspection.

Completed: hovering a shaft in the normal office tool now adds a white outline
and a mode-line cue describing the inspection details available on click.
Covered by the full deterministic suite (177 passing tests), syntax checks,
source verification, and a rendered live hover check with no console errors.

## Step 380 — complete

Task: apply the shared green/amber/red waiting-pressure meaning to the
queue status inside the shaft inspector.

Completed: shaft inspection now uses the shared waiting-pressure bands and
meaning, so queue status is green for clear, amber for watch/busy, and red for
critical pressure. The meaning appears in both the status line and queue
detail. Covered by the full deterministic suite (177 passing tests), syntax
checks, source verification, and a live zero-queue check confirming the green
state and no console errors.

## Step 381 — complete

Task: show each elevator car's current load and operating state in the
shaft inspector.

Completed: the shaft inspector now lists every car with its current riders
versus capacity and operating state, while retaining the aggregate load and
queue summary. Covered by the full deterministic suite (177 passing tests),
syntax checks, source verification, and a live shaft inspection check with no
console errors.

## Step 382 — complete

Task: show the selected shaft's available car-upgrade action, cost, and
resulting dispatch capacity in the inspector.

Completed: the selected shaft inspector now shows the next car's cost, added
riders per dispatch, and current-to-projected dispatch capacity. Its “select +
car” action preserves the deliberate two-step confirmation: select the car
tool first, then click the highlighted shaft to add it. Covered by the full
deterministic suite (177 passing tests), syntax checks, source verification,
and a live two-step upgrade check with no console errors.

## Step 383 — complete

Task: keep the selected shaft name and projected capacity visible while
the car tool is armed for its second click.

Completed: the armed car prompt now names the target shaft and shows its
current-to-projected dispatch capacity, while the detailed preview retains
the queue and load context. Covered by syntax checks, source verification,
and a live armed-tool check with no console errors.

## Step 384 — complete

Task: confirm the upgraded shaft's new car count and dispatch capacity
after the second click.

Completed: adding a car now keeps the upgraded shaft selected and reports its
new car count and dispatch capacity immediately, while still selecting the
office tool for the next building action. Covered by the full deterministic
suite (177 passing tests), syntax checks, source verification, and a live
post-upgrade focus check with no console errors.

## Step 385 — complete

Task: show the upgraded shaft's remaining car slots and next upgrade cost
after the confirmation.

Completed: the shaft inspector now explicitly reports the remaining car-slot
count alongside the next car's cost and added dispatch capacity, making the
per-shaft upgrade ceiling readable after each purchase. Covered by the full
deterministic suite (177 passing tests), syntax checks, source verification,
and a live post-upgrade check with no console errors.

## Step 386 — complete

Task: show the selected shaft's queue pressure directly on the building
canvas, with the same count and color meaning as the shaft inspector.

Completed: a selected shaft now displays a compact W waiting-count badge on
the building canvas, using the same green/amber/red pressure bands and
color-independent count as the shaft inspector. Covered by the full
deterministic suite (177 passing tests), syntax checks, source verification,
and a live rendered check showing the green W 0 badge with no console errors.

## Step 387 — complete

Task: make the selected shaft canvas badge identify the shaft and explain
that its count is the queue assigned to that route.

Completed: the selected shaft canvas badge now reads `S1 · W 0` (or the live
route equivalent), pairing the shaft label with the color-independent waiting
count. The W meaning remains consistent with the shared legend and inspector.
Covered by the full deterministic suite (177 passing tests), syntax checks,
source verification, and a live rendered check with no console errors.

## Step 388 — complete

Task: make the selected shaft's canvas queue badge update through the
green, amber, and red pressure states as its assigned queue changes.

Completed: the selected shaft badge is recalculated from its live route queue
each render, so it follows the shared green clear, amber watch/busy, and red
critical bands as the queue changes. The deterministic legibility tests cover
the shared thresholds, and live runs confirmed green-to-amber synchronization
between the canvas badge and shaft inspector with no console errors.

## Step 389 — complete

Task: show the same compact queue badge while hovering another shaft, so
route pressure can be compared before changing the selected focus.

Completed: hovering a shaft now shows its own `S# · W#` queue badge, while the
selected shaft retains its focused badge and inspector. The rendered check
confirmed both shaft labels at once with no console errors; the full suite
remains at 177 passing tests.

## Step 390 — complete

Task: distinguish selected and hovered shaft queue badges without adding
another color meaning.

Completed: selected shaft badges use a stronger yellow outline and hovered
shaft badges use a lighter white outline, while both retain the same
green/amber/red queue-pressure fills and readable W counts. The rendered
two-shaft check confirmed the distinction with no console errors; all 177
tests pass.

## Step 391 — complete

Task: add a compact queue-trend cue for the selected shaft when enough
route history exists to show whether pressure is rising or falling.

Completed: the selected shaft inspector now shows a compact recent-queue
trend, including its sparkline and rising, falling, steady, or spike meaning;
it stays in a collecting state until enough readings exist. Rising or spiking
pressure is marked urgent and falling pressure healthy. Covered by the full
deterministic suite (177 passing tests), syntax checks, source verification,
and a live history check with no console errors.

## Step 392 — complete

Task: expose the selected shaft's queue trend on its canvas badge when
history is available, while keeping the W count primary.

Completed: route-history samples now reach the canvas renderer, and selected
shaft badges append a compact trend marker after the primary `S# · W#` count:
`↑` rising, `↓` falling, `→` steady, and `!` spike. The shared marker tests,
full deterministic suite (177 passing tests), syntax checks, source
verification, and a live history check all pass with no console errors.

## Step 393 — complete

Task: add a short legend explaining the selected-shaft queue trend
markers so the canvas glyphs are discoverable.

Completed: the selected shaft inspector now includes a visible trend key for
`↑` rising, `↓` falling, `→` steady, and `!` spike beside the route status.
Covered by the full deterministic suite (177 passing tests), syntax checks,
source verification, and a live focused-shaft check confirming the legend
appears with no console errors.

## Step 394 — complete

Task: show the selected shaft queue trend's history span so its recent
versus longer-running pressure is easier to judge.

Completed: selected shaft trend readouts now include their number of readings
and simulated time span, distinguishing a fresh signal from sustained route
pressure. Covered by the full deterministic suite (177 passing tests), syntax
checks, source verification, and live checks for both the one-reading state
and a multi-reading span with no console errors.

## Step 395 — complete

Task: show the selected shaft's waiting queue broken down by origin floor
so route pressure points to a concrete part of the building.

Completed: selected shaft inspection now groups assigned waiting riders by
origin floor, showing labeled entries such as `F2 1` with the same pressure
color bands and a clear `none` state. Covered by the full deterministic suite
(177 passing tests), syntax checks, source verification, and live checks for
both empty and active origin queues with no console errors.

## Step 396 — complete

Task: connect selected-shaft origin floors to the corresponding canvas
floor queue badges for faster visual diagnosis.

Completed: selected shaft origin floors now receive the same yellow focus
outline as the selected route on the canvas, while their W badge keeps its
live pressure fill and count. The origin helper is covered by legibility
tests, and a live active-queue check confirmed the highlighted floor and
inspector list stay synchronized with no console errors.

## Step 397 — complete

Task: explain the selected-route outline on the canvas so the origin-floor
highlight is discoverable without relying on the shaft inspector.

Completed: selecting a shaft now explains directly in the mode line that
yellow W badges belong to that route, and the shaft inspector repeats the
origin-floor mapping. Covered by the full deterministic suite (177 passing
tests), syntax checks, source verification, and a live focused-shaft check
with no console errors.

## Step 398 — complete

Task: distinguish a selected shaft's route queue from the building-wide
waiting total in the focused transport readout.

Completed: the focused shaft inspector now labels its local `route queue`,
the `building-wide W` total, and the selected route's percentage of that
total. Covered by the full deterministic suite (177 passing tests), syntax
checks, source verification, and live empty/active queue checks with no
console errors.

## Step 399 — complete

Task: add route-share context to the all-shafts transport summary so the
player can compare queue concentration without selecting each shaft.

Completed: every shaft row now reports its local queue share as a percentage
of the building-wide W total, alongside its local count and operating state.
The two-shaft live check confirmed both rows use the shared total with no
console errors; the full deterministic suite remains at 177 passing tests.

## Step 400 — complete

Task: show any unassigned waiting people separately so all-shaft route
shares are not mistaken for a complete partition of building-wide W.

Completed: the all-shaft transport summary now reports unassigned waiting as
its own color-coded W count and explicitly states that route shares exclude
those people. Live empty/active queue checks confirmed the wording with no
console errors; the full deterministic suite remains at 177 passing tests.

## Step 401 — complete

Task: show the origin floors of unassigned waiting people so missing-route
pressure also points to a concrete building location.

Completed: the transport summary now includes unassigned waiting origins as
color-coded floor/count entries, with `none` when no unassigned queue exists.
It retains the explicit route-share exclusion note. Live empty/active checks
confirmed the display with no console errors; the full deterministic suite
remains at 177 passing tests.

## Step 402 — complete

Task: give unassigned origin floors a distinct canvas cue so missing-route
pressure is visible before opening the transport summary.

Completed: floor queue badges fed by people without an assigned shaft now use
a red dashed outline, distinct from the yellow selected-route outline, while
preserving the W count and pressure fill. The unassigned-origin helper is
covered by legibility tests, the full deterministic suite remains at 177
passing tests, and live rendering completed with no console errors.

## Step 403 — complete

Task: explain the red dashed missing-route outline in the canvas legend so
its meaning is discoverable.

Completed: the always-visible W/T legend now explains that yellow outlines
mark a selected shaft route and red dashed outlines mark queues with no
assigned shaft. A live focused-canvas check confirmed the legend and normal
shaft rendering with no console errors; the full deterministic suite remains
at 177 passing tests.

## Step 404 — complete

Task: add a concrete response hint for unassigned waiting queues so the
player knows whether to build a route or use a local alternative.

Completed: the transport panel now classifies missing-route pressure as clear,
local, elevator, or split. It names the affected origin floors, tells the
player when existing stairs/escalators can serve those trips, and identifies
the floors that need a new or extended elevator shaft. The deterministic suite
now has 178 passing tests, the live panel shows the clear state on startup, and
syntax checks completed cleanly.

## Step 405 — complete

Task: make the missing-route response hint focusable so selecting it can
bring the affected floor queues into view without making the player hunt for
the red dashed badges.

Completed: every reported missing-route origin now gets a `focus F#` control.
It selects the same floor-focus view used by the normal floor list, preserves
the W/T summary, and opens the local queue context before the player chooses a
route. The full deterministic suite remains at 178 passing tests, syntax checks
are clean, and a live startup/expanded-floor check completed with no browser
errors.

## Step 406 — complete

Task: make a focused missing-route floor choose the correct next transport
control—local route, new shaft, or added car—so the response hint leads all the
way to the appropriate build decision.

Completed: floor focus now checks whether its waiting queue is unassigned.
Unassigned floors outside local-route coverage select the shaft response and
explain that no assigned shaft reaches them; floors covered by existing stairs
or escalators show a no-car-wait local-route cue; ordinary assigned queues keep
their existing car/shaft behavior. The full deterministic suite remains at 178
passing tests, syntax checks are clean, and a live floor-focus check completed
with no browser errors.

## Step 407 — complete

Task: let the focused missing-route response distinguish an existing local
route from a local route that still needs to be built.

Completed: missing-route analysis now checks both existing local routes and
legally placeable stairs/escalators. Existing coverage says to use the route;
placeable coverage selects the fastest local option to build; only trips beyond
those spans are sent to the shaft response. Floor focus can select the local
build control and its handoff explains that the route removes those trips from
the elevator queue. The full deterministic suite remains at 178 passing tests,
syntax checks are clean, and the live panel loads with no browser errors.

## Step 408 — complete

Task: show the cost and legal span of a recommended local-route build so
the player can compare it fairly with adding a car or extending a shaft.

Completed: buildable local-route recommendations now include the legal span and
estimated cost to reach the highest named floor, and floor focus repeats those
details beside the local build action. The fastest available local route remains
the recommendation when both stairs and an escalator can cover the trip. The
full deterministic suite remains at 178 passing tests, syntax and diff checks
are clean, and the live panel loads with no browser errors.

## Step 409 — complete

Task: show the same per-dispatch capacity and cost comparison for the
recommended elevator car or shaft response so transport choices use one shared
decision language.

Completed: car recommendations now state their cost and added riders per
dispatch, while new-shaft recommendations state their cost, legal floor span,
and included starting car/capacity. The comparison is also present for
sustained queue pressure, so live and daily recommendations use the same terms.
The full deterministic suite remains at 178 passing tests, syntax checks are
clean, and the live transport panel loads with no browser errors.

## Step 410 — complete

Task: add a compact side-by-side transport choice summary so the player can
compare the recommended car and shaft investments before selecting one.

Completed: when transport pressure recommends a car or shaft, the systems panel
now puts both investments side by side. Each option shows cost, capacity added
per dispatch, existing-route wait relief for a car, and legal span/starting
capacity for a shaft; the recommended option is outlined. The full deterministic
suite now has 179 passing tests, syntax and diff checks are clean, and the live
transport panel loads without browser errors; the comparison stays hidden until
there is an actionable car-or-shaft response.

## Step 411 — complete

Task: keep the same car-versus-shaft comparison visible while the player
selects either transport tool, so the choice remains available during placement.

Completed: selecting CAR or SHAFT now keeps the comparison visible even when the
live system has no active recommendation. The selected card is outlined, while
the other option remains available for comparison; a full shaft still reports
the car limit and a blocked shaft still reports its placement reason. The full
deterministic suite remains at 179 passing tests, syntax and diff checks are clean.
Live selection verification shows both cards after selecting SHAFT, marks SHAFT
as selected, and reports zero browser errors.

## Step 412 — complete

Task: make the comparison cards point directly to the relevant placement
target, so choosing the recommended card can focus the exact shaft or span.

Completed: CAR and SHAFT comparison cards are now actionable. CAR focuses the
recommended open shaft, while SHAFT focuses the recommended legal top floor and
opens the normal placement preview. Live checks confirmed both paths and zero
browser errors; the full deterministic suite remains at 179 passing tests.

## Step 413 — complete

Task: make unavailable comparison cards explain the exact blocker and point
to the next viable transport action instead of simply disabling themselves.

Completed: unavailable cards now name the concrete blocker, such as “S1 is at
its car limit” or a blocked shaft column, and offer a direct next-action button
when the other investment is viable. A live full-car test confirmed the CAR
card offered “next: select SHAFT,” which entered shaft placement mode with the
correct target and zero browser errors. The full deterministic suite remains at
179 passing tests.

## Step 414 — complete

Task: add the same direct next-action guidance to the other infrastructure
warnings, including local-route limits and insufficient funds.

Completed: buildable local-route responses now offer a direct next: select
STAIRS/ESCALATOR action, while funds-short car and shaft choices are labeled
with the exact gap and point to an affordable alternative when one exists.
Unavailable structural choices retain their precise blocker and fallback
action. The full deterministic suite remains at 179 passing tests, syntax and
diff checks are clean, and the live full-car fallback still completes with zero
browser errors.

## Step 415 — complete

Task: make the response actions preserve their target floor or shaft when
the systems panel refreshes, so a live queue update cannot move the player’s
focused next action.

Completed: response-selected CAR and SHAFT targets are now locked through live
systems refreshes. The lock clears when the player deliberately changes tools,
hovers a different placement target, completes the build, or restarts. A live
12× simulation check kept CAR focused on S1 after refreshes with zero browser
errors; the full deterministic suite remains at 179 passing tests.

## Step 416 — complete

Completed: response-selected STAIRS and ESCALATOR targets now preserve their
focused floor through live placement-preview refreshes. Hovering another floor
still previews that floor, and leaving the canvas restores the focused response
target. The full deterministic suite remains at 179 passing tests; syntax and
diff checks are clean.

## Step 417 — complete

Completed: response-selected STAIRS and ESCALATOR targets now outline the
focused endpoint floor and the first clear construction column directly on the
building canvas. The endpoint changes to a blocked warning when the span is too
long or no column is available, while hover previews still take precedence.
The full deterministic suite is now 180 passing tests; syntax and diff checks
are clean.

## Step 418 — complete

Completed: local-route response cards now show the target floor, planned span,
and existing or first clear construction column before the player clicks. The
systems panel uses the same placement calculation as the canvas, and existing
routes identify their actual span and column. The full deterministic suite is
now 180 passing tests; syntax, diff, and live-load checks are clean with zero
browser errors.

## Step 419 — complete

Completed: local-route response cards now show the expected average travel time
and current pressure relief beside the target/span/column preview. The relief
is explicitly described as trips shifted off elevator capacity, while the
route itself is labeled as having no car wait. The full deterministic suite
remains at 180 passing tests; syntax, diff, and live-load checks are clean with
zero browser errors.

## Step 420 — complete

Completed: local-route responses now separate current pressure relief from a
planning throughput estimate derived from the configured day length and route
travel time. The panel labels that estimate as provisional and explicitly says
it is not yet a hard route capacity limit, so the UI does not promise a mechanic
the simulator has not modeled. The full deterministic suite remains at 180
passing tests; syntax, diff, and live-load checks are clean with zero browser
errors.

## Step 421 — complete

Completed: stairs and escalators now have explicit simultaneous occupancy
capacities (6 and 12 respectively). Full local routes form their own waiting
queue, queued riders enter when space opens, and elevator routing remains an
alternative when it can serve the trip. Canvas and systems rows show
occupancy/capacity, and full routes change to the pressure color. The full
deterministic suite is now 181 passing tests; syntax, diff, and live-load checks
are clean with zero browser errors.

## Step 422 — complete

Completed: local-route queueing now records local and elevator trips,
delivered/abandoned counts, and separate wait totals/maxima. Daily service and
reputation history expose the split, while the live systems panel shows
elevator, local-route, and unassigned waiting separately. Local waiting no
longer appears as a missing route. The full deterministic suite is now 181
passing tests; syntax, diff, and live-load checks are clean with zero browser
errors.

## Step 423 — complete

Completed: transport response selection now skips a local route at its
simultaneous occupancy limit, uses an available alternate route when one
exists, and explains when every relevant local route is full. The full
deterministic suite is now 182 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 424 — complete

Completed: local route choice now applies a bounded crowding penalty to the
current occupancy. The faster route remains preferred when lightly loaded, but
parallel stairs and escalators share new trips as one route fills; the live
systems rows explain that behavior. The full deterministic suite is now 183
passing tests; syntax, diff, and live-load checks are clean with zero browser
errors.

## Step 425 — complete

Completed: local routes now collect compact six-day occupancy histories, with
normalized load sparklines, direction, average, and peak shown beside each
stairs/escalator row. Histories reset with a new tower and refresh as live
occupancy changes. The full deterministic suite is now 184 passing tests;
syntax, diff, and live-load checks are clean with zero browser errors.

## Step 426 — complete

Completed: transport response now classifies repeated local-route load, ignores
the overloaded route when searching for relief, and recommends an available
alternate or buildable route. A single high day remains a watch signal; the
recommendation explains the sustained local pressure when it acts. The full
deterministic suite is now 185 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 427 — complete

Completed: the investment panel now compares cars, shafts, and a local-route
option before building. The local card reports route type, span, clear column,
cost, simultaneous capacity, and total local capacity before/after; selecting
it enters the existing two-step route placement flow. The full deterministic
suite remains at 185 passing tests; syntax, diff, and live-load checks are
clean with zero browser errors.

## Step 428 — complete

Completed: the investment comparison now renders stairs and escalators as
separate selectable alternatives. Each shows speed per floor, simultaneous
capacity, total local capacity before/after, legal span, clear column, and
cost, while the selected option enters the normal placement flow. The full
deterministic suite remains at 185 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 429 — complete

Completed: each local-route investment now projects how many current waits it
could cover, splits that relief between elevator, local-route, and unassigned
waits, and reports average travel time alongside capacity and cost. The full
deterministic suite remains at 185 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 430 — complete

Completed: when current waits span more than one response type, the
recommendation now compares the broader local-route coverage with the
narrower car response. It favors the route that covers more current demand,
then keeps route speed, capacity, and cost visible as tradeoffs. The full
deterministic suite is now 186 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 431 — complete

Completed: car, shaft, stairs, and escalator investment cards now expose the
same current-waits-covered measure. Cars count waits assigned to the target
shaft, shafts count waits within the proposed span, and local routes use their
existing span projection; the cards retain their capacity, speed, and cost
details. The full deterministic suite remains at 186 passing tests; syntax,
diff, and live-load checks are clean with zero browser errors.

## Step 432 — complete

Completed: investment cards now add a compact coverage comparison label. A
unique leader is called out, lower-coverage choices state how many waits they
miss, and ties explicitly defer to speed and cost. The full deterministic
suite remains at 186 passing tests; syntax, diff, and live-load checks are
clean with zero browser errors.

## Step 433 — complete

Completed: every actionable investment card now reports an approximate
cost-per-covered-wait figure, while still showing its full cost and coverage
count. This makes the relief-versus-budget tradeoff visible before placement;
options with no covered waits leave the ratio blank rather than inventing a
number. The full deterministic suite remains at 186 passing tests; syntax,
diff, and live-load checks are clean with zero browser errors.

## Step 434 — complete

Completed: when a local route covers the same current waits as the best car
response, its cost per covered wait can break the tie. The recommendation
still exposes the route's estimated travel time, so the cheaper choice does
not hide its speed tradeoff. The full deterministic suite is now 187 passing
tests; syntax, diff, and live-load checks are clean with zero browser errors.

## Step 435 — complete

Completed: transport comparisons now distinguish total span coverage from
first-wave capacity. Cards report the immediate wave and any waits left
queued, and recommendations no longer favor a broad but undersized local
route over stronger immediate relief. The full deterministic suite is now 188
passing tests; syntax, diff, and live-load checks are clean with zero browser
errors.

## Step 436 — complete

Completed: live route pressure indicators now distinguish reachable demand
from immediate capacity. Local routes show reachable waits, first-wave slots,
and remaining queue; elevator routes show current queue versus first-dispatch
capacity. The full deterministic suite is now 189 passing tests; syntax, diff,
and live-load checks are clean with zero browser errors.

## Step 437 — complete

Completed: local routes now record first-wave overflow over time. A capped
reputation penalty is applied at day close, and the transport summary warns
when local capacity was exceeded while preserving delivery-rate context. The
full deterministic suite remains at 189 passing tests; syntax, diff, and
live-load checks are clean with zero browser errors.

## Step 438 — complete

Completed: the transport panel now shows a compact multi-day local-overflow
trend with direction, peak, and a clear distinction between a one-day spike
and repeated crowding. The full deterministic suite is now 190 passing tests;
syntax, diff, and live-load checks are clean with zero browser errors.

## Step 439 — complete

Completed: sustained local-overflow history now participates in transport
recommendations. When a legal alternate exists, the game recommends a
separate local-capacity path and explains why; a one-day spike does not
override the normal recommendation. The full deterministic suite is now 191
passing tests; syntax, diff, and live-load checks are clean with zero browser
errors.

## Step 440 — complete

Completed: daily overflow records now preserve the local route ID and floor
span. Transport recommendations use the route-specific history first, so a
sustained stairwell problem can target an alternate route for that span
instead of treating all local crowding as global. The full deterministic suite
remains at 191 passing tests; syntax, diff, and live-load checks are clean with
zero browser errors.

## Step 441 — complete

Completed: each stairs and escalator diagnostic row now shows its own overflow
history, average excess riders, peak, and spike-versus-sustained status. The
player can trace the transport recommendation back to the pressured route and
span. The full deterministic suite is now 192 passing tests; syntax, diff,
and live-load checks are clean with zero browser errors.

## Step 442 — complete

Completed: an overflowing local-route row now offers a direct “next: select”
handoff when a recommended alternate route is available. The handoff focuses
the alternate tool and target span without building automatically, preserving
the player’s two-step placement decision. The full deterministic suite remains
at 192 passing tests; syntax, diff, and live-load checks are clean with zero
browser errors.

## Step 443 — complete

Completed: selecting a recommended alternate route now adds source context to
the placement preview, naming the overflowing route and its pressured span
before the player places the new route. The two-step build interaction remains
intact. The full deterministic suite remains at 192 passing tests; syntax,
diff, and live-load checks are clean with zero browser errors.

## Step 444 — complete

Completed: alternate local-route interventions now capture the source route's
overflow baseline, mark the route as awaiting its first result day after
placement, and report whether average and peak overflow was relieved,
unchanged, or worse. The full deterministic suite is now 193 passing tests;
syntax, diff, and live-load checks are clean with zero browser errors.

## Step 445 — complete

Completed: the first post-placement result now compares the source route's
before/after overflow with the newly built alternate route's same-day overflow.
The transport panel distinguishes pressure absorbed from pressure shifted onto
the alternate route. The full deterministic suite is now 194 passing tests;
syntax, diff, and live-load checks are clean with zero browser errors.

## Step 446 — complete

Completed: a pressured alternate route now produces a follow-up transport
decision with a direct “next: select” action for another route of that type,
carrying the pressured route's span as the next source context. Absorbed
pressure recommends monitoring instead. The full deterministic suite is now
195 passing tests; syntax, diff, and live-load checks are clean with zero
browser errors.

## Step 447 — complete

Completed: follow-up route decisions now check the proposed span against
clear-column legality and current funds. A valid affordable follow-up keeps
the direct selection action; blocked or unaffordable choices explain the
specific constraint without offering a misleading build button. The full
deterministic suite remains at 195 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 448 — complete

Completed: an actionable follow-up now previews the route's current and
projected aggregate local capacity, the maximum expected reduction in the
observed average overflow, and its build cost before selection. The same
legality and funds gates remain in force. The full deterministic suite remains
at 195 passing tests; syntax, diff, and live-load checks are clean with zero
browser errors.

## Step 449 — complete

Completed: the follow-up relief preview now uses the alternate route's actual
floor span and travel time, reports its live occupancy and waiting load, and
folds current live overflow into the observed daily-overflow estimate. The
full deterministic suite remains at 195 passing tests; syntax, diff, and
live-load checks are clean with zero browser errors.

## Step 450 — complete

Completed: projected follow-up routes now explain their tenant-facing access
impact with actual span travel time, live route load, and the route capacity
that can absorb waiting demand. The preview remains explicit that the relief
estimate is an overflow estimate rather than a promise for every floor. The
full deterministic suite remains at 195 passing tests; syntax, diff, and
live-load checks are clean with zero browser errors.

## Step 451 — complete

Task: connect a completed route intervention to tenant stress and
reputation outcomes in the day-close result.

Completed: the first day-close result after a guided local-route intervention
now records tenant-facing local wait, people who gave up, average occupied-room
stress, and reputation before versus after the build. The SYSTEMS panel shows a
plain-language improved/worsened/unchanged tenant-experience result alongside
the route-overflow result. The full deterministic suite is now 196 passing
tests; syntax, diff, and live-load checks are clean with zero browser errors.

## Step 452 — in progress

Task: use the recorded tenant-experience result to make the next transport
recommendation more explicit.

Completed: transport follow-up recommendations now consume the tenant result.
An improved experience supports monitoring, while a worsened or unchanged
experience calls for another reading instead of blindly repeating a build.
When the alternate route remains pressured, the recommendation explains that
tenant evidence alongside the additional-capacity action. The full
deterministic suite is now 197 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 453 — complete

Task: retain a bounded history of route-intervention tenant outcomes so
repeated transport choices can be judged over time.

Completed: completed guided route tests now retain the day, source and target
route, overflow result, and tenant-experience result in a four-entry bounded
history. The SYSTEMS panel shows the retained route tests so repeated transport
choices can be compared without expanding the general event log. The full
deterministic suite is now 198 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 454 — complete

Task: summarize the bounded route-intervention history so the player can see
whether transport changes are helping over time.

Completed: the SYSTEMS route-history display now summarizes retained tenant
outcomes as mostly improved, mostly worsened, or mixed, with counts for each
result and the individual day/route records beneath it. The full deterministic
suite is now 199 passing tests; syntax, diff, and live-load checks are clean
with zero browser errors.

## Step 455 — complete

Task: keep the route-intervention summary visible when no single route test is
selected.

Completed: the retained route-history summary is now rendered independently of
the current route-test result, so changing tools or focus does not hide the
evidence from earlier interventions. The full deterministic suite remains at
199 passing tests; syntax, diff, and live-load checks are clean with zero
browser errors.

## Step 456 — complete

Task: show the key tenant deltas in each retained route history entry.

Completed: each retained route-history entry now shows signed local-wait,
average-stress, reputation, and abandonment deltas alongside its route and
tenant-experience label. The full deterministic suite remains at 199 passing
tests; syntax, diff, and live-load checks are clean with zero browser errors.

## Step 457 — complete

Task: use repeated route-history outcomes to distinguish a stable transport
improvement from a one-day result.

Completed: the retained route-history summary now labels a single result as a
one-day signal, differing recent results as mixed, and repeated matching tenant
outcomes as stable improvement, stable worsening, or stable unchanged. The
full deterministic suite is now 200 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 458 — complete

Task: use the stability signal to qualify the next route recommendation.

Completed: route follow-up decisions now use retained-history stability. A
one-day improvement or mixed recent evidence asks for another reading, while
repeated improvement can recommend monitoring; pressured alternates still
receive a direct capacity action with the stability evidence attached. The
full deterministic suite is now 201 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 459 — complete

Task: connect stable route outcomes to the tenant-demand and desirability
forecast without double-counting reputation.

Completed: stable route outcomes now feed a small access-confidence bonus into
vacancy demand, scaled by each candidate room's access quality. The tenant
forecast displays that signal separately, and route evidence is derived only
from wait, stress, and abandonment—not reputation. Room desirability and
delivery reputation remain independent. The full deterministic suite is now
203 passing tests; syntax, diff, and live-load checks are clean with zero
browser errors.

## Step 460 — complete

Task: make the separate transport-access forecast visible beside room
desirability so the two signals are not conflated.

Completed: the desirability panel now repeats a clearly separate transport
access forecast beside room appeal and its daily history. The wording explains
that the access signal is independent from both room desirability and delivery
reputation. The full deterministic suite remains at 203 passing tests; syntax,
diff, and live-load checks are clean with zero browser errors.

## Step 461 — complete

Task: give the separate transport-access forecast its own short trend history.

Completed: the separate transport-access forecast now keeps a bounded
four-entry history and a compact improving/worsening/mixed trend cue. The
signal uses only wait, stress, and abandonment outcomes, remaining separate
from room desirability and delivery reputation. The deterministic suite is
now 204 passing tests; syntax, diff, and live-load checks are clean with zero
browser errors.

## Step 462 — in progress

Task: retain the transport-access forecast in daily tenant-demand history so
the player can audit when the signal changed.

Completed: each closed-day leasing record now retains the access forecast that
was active for that batch, including its direction, confidence bonus, test
count, and trend bars. The leasing history displays that signal beside the
move-in result, making changes auditable without mixing it into room appeal
or reputation. The deterministic suite is now 205 passing tests; syntax,
diff, and live-load checks are clean with zero browser errors.

## Step 463 — complete

Task: expose the retained access signal when inspecting a vacant room's
leasing decision.

Completed: vacant-room inspection now exposes the current transport-access
forecast with its direction, demand bonus, route-test count, and trend bars.
The cue explicitly keeps access separate from room appeal and reputation, so
an abandoned room's leasing decision has the same readable transport context
as the building forecast. The deterministic suite is now 206 passing tests;
syntax, diff, and live-load checks are clean with zero browser errors.

## Step 464 — complete

Task: show access confidence separately in the vacancy ranking panel.

Completed: the vacancy-ranking area now shows the building access forecast
and the priority room's individual access contribution as separate signals.
The panel makes clear that access is distinct from room appeal and delivery
reputation while retaining the combined demand score used for ordering. The
deterministic suite is now 207 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 465 — complete

Task: show access contribution for the visible ranked vacancy candidates.

Completed: the vacancy panel now lists the visible ranked rooms and shows
each room's access contribution separately from its combined demand and room
appeal. The empty state also explains when ranked access contributions become
available. The deterministic suite is now 208 passing tests; syntax, diff,
and live-load checks are clean with zero browser errors.

## Step 466 — complete

Task: retain each moved-in room's access contribution in the closed-day
leasing result.

Completed: each moved-in room now retains its access contribution in both the
closed-day leasing record and the move-in event, while the leasing history
shows the batch's average access contribution beside quality, appeal, and
tenant-mix results. The deterministic suite remains at 208 passing tests;
syntax, diff, and live-load checks are clean with zero browser errors.

## Step 467 — complete

Task: distinguish the access forecast from the realized outcome in the
leasing history.

Completed: leasing history now labels the building-level expectation as
forecast access and the per-room move-in contribution as realized access.
Days with no move-ins explicitly show that no realized result exists yet,
preventing the two readings from being conflated. The deterministic suite
remains at 208 passing tests; syntax, diff, and live-load checks are clean
with zero browser errors.

## Step 468 — complete

Task: expose the forecast-versus-realized access result when inspecting an
occupied room.

Completed: occupied-room inspection now identifies the room's leasing day,
shows the access forecast that was active then, and compares it with the
room's realized access contribution. Room identity is preserved in leasing
records, and rooms without a recorded move-in result say so explicitly. The
deterministic suite is now 209 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 469 — complete

Task: surface the realized access result in the floor tenant-load view.

Completed: selected-floor focus now lists the realized access contribution
for rooms with recorded move-in results and clearly reports when no room-level
result exists. The cue keeps realized access separate from live tenant load,
room appeal, and reputation. The deterministic suite remains at 209 passing
tests; syntax, diff, and live-load checks are clean with zero browser errors.

## Step 470 — complete

Task: show room desirability's separate ranking effect beside access confidence
for competing vacant rooms.

Completed: the vacancy ranking now compares the top candidates' room appeal
and access contributions in a compact, separate explanation while preserving
the existing combined ranking formula. The deterministic suite is now 210
passing tests; syntax, diff, and live-load checks are clean with zero browser
errors.

## Step 471 — complete

Task: retain daily desirability-versus-access ranking evidence so the player
can see why vacancy order changes.

Completed: each closed-day leasing record now retains the top-two vacancy
comparison, and leasing history displays whether room appeal or access
favored either room. The evidence is read-only and does not change the
existing candidate order. The deterministic suite remains at 210 passing
tests; syntax, diff, and live-load checks are clean with zero browser errors.

## Step 472 — complete

Task: record which room-appeal factors changed between vacancy-ranking days.

Completed: ranking snapshots now retain the top room's appeal components,
and leasing history compares them across days with readable changes such as
view, noise, services, rent fit, and floor fit. If the top vacancy changes,
the history explicitly resets the comparison instead of implying a false
factor change. The deterministic suite is now 211 passing tests; syntax,
diff, and live-load checks are clean with zero browser errors.

## Step 473 — complete

Task: turn the latest appeal-factor change into a plain-language next action
for vacant rooms.

Completed: the latest negative appeal change now maps to one plain-language
vacant-room action—such as inspecting services, reviewing rent, reducing
noise, choosing a better-fit floor, or renovating. Favorable and unchanged
readings recommend keeping the room market-ready and monitoring. The
deterministic suite is now 212 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 474 — complete

Task: show the affected room-appeal value beside the recommended vacant-room
action.

Completed: the vacant-room action now includes the current signed value of
the affected appeal factor on the priority room, such as services, noise,
rent fit, or floor fit, before the player commits to a change. The
deterministic suite remains at 212 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 475 — complete

Task: measure whether a recommended appeal action improved the vacancy after
the next day close.

Completed: renovation actions on vacant rooms now retain their pre-action
evaluation, wait for the first following closed day, and compare the room's
result against that baseline. The management panel keeps the latest three
appeal-action results, while the room inspector shows whether the room
improved, stayed unchanged, or failed to improve and whether it remains
vacant. The deterministic suite is now 213 passing tests; syntax, diff, and
live-load checks are clean with zero browser errors.

## Step 476 — complete

Task: make the one-day appeal-action result easier to find while inspecting a
room.

Completed: appeal-action results now appear in the management history and the
selected room inspector. Each completed result says whether the room's
evaluation improved, stayed unchanged, or failed to improve, and separately
reports whether the room is still vacant, ready to lease, or blocked by a
lease gate such as market timing or reputation. The deterministic suite is
now 213 passing tests; syntax, diff, and live-load checks are clean with zero
browser errors.

## Step 477 — complete

Task: extend the one-day appeal-action result to service coverage actions.

Completed: a service placement selected from a room-level warning now records
that targeted room's pre-action evaluation and service-appeal value. After the
next closed day, the same follow-up reports whether the room improved and
whether it is occupied or still blocked by a lease gate, even when the
facility was placed on another floor. The deterministic suite is now 214
passing tests; syntax, diff, and live-load checks are clean with zero browser
errors.

## Step 478 — complete

Task: show building-level desirability movement beside a room-level
appeal-action result.

Completed: room-appeal follow-ups now retain the building desirability before
the action and compare it with the next closed-day desirability. Renovation and
targeted service placements show the room evaluation change, lease status, and
the building-level desirability movement together. The deterministic suite is
now 214 passing tests; syntax, diff, and live-load checks are clean with zero
browser errors.

## Step 479 — complete

Task: connect a room-appeal result to the next tenant-demand reading.

Completed: renovation and targeted service follow-ups now retain the room's
pre-action demand state and read the next closed-day leasing result. The
result identifies when demand fills the room, when the room becomes a ranked
vacancy, or when it remains outside the market, while keeping demand separate
from room evaluation, lease gates, and building desirability. The
deterministic suite remains at 214 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 480 — complete

Task: expose the demand transition clearly in the vacancy history.

Completed: the appeal-action history now gives tenant demand its own visible
transition line instead of hiding it inside the room-evaluation sentence. It
shows readable states such as not eligible, ranked vacancy, or filled by
tenant demand, with the candidate rank when available. The deterministic suite
remains at 214 passing tests; syntax, diff, and live-load checks are clean with
zero browser errors.

## Step 481 — complete

Task: identify the tenant type that fills a vacancy after an appeal action.

Completed: appeal-action follow-ups now retain the tenant type from the next
leasing result. Filled rooms identify the arriving type, while still-vacant
rooms expose the likely type in their next demand reading. The deterministic
suite is now 215 passing tests; syntax, diff, and live-load checks are clean
with zero browser errors.

## Step 482 — complete

Task: connect tenant-type demand to the building's target tenant mix.

Completed: appeal-action follow-ups now identify the arriving tenant type and
compare its resulting share with the configured building target. The result
labels that type underrepresented, on target, or oversupplied and shows the
actual and target percentages, keeping tenant mix separate from room appeal,
transport, and reputation. The deterministic suite is now 215 passing tests;
syntax, diff, and live-load checks are clean with zero browser errors.

## Step 483 — complete

Task: show the tenant-mix effect before filling a vacancy.

Completed: pre-fill vacancy ranking now labels the tenant-mix contribution
separately from room quality, access, and general demand. It also shows the
candidate tenant type's actual share against its target and labels the type
underrepresented, on target, or oversupplied before the move-in occurs. The
deterministic suite remains at 215 passing tests; syntax, diff, and live-load
checks are clean with zero browser errors.

## Step 484 — complete

Task: compare the tenant-mix effect of competing vacant rooms.

Completed: the vacancy ranking comparison now includes a direct tenant-mix
comparison beside the existing room-appeal and access comparisons. When two
eligible vacancies compete, the player can see which one better serves the
building's target mix and by how much; the comparison remains gated until two
rooms are actually eligible. The deterministic suite remains at 215 passing
tests; syntax, diff, and live-load checks are clean with zero browser errors.

## Step 485 — in progress

Task: expose the combined vacancy choice in the player guidance.
