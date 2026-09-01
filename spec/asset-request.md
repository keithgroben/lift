# Lift — asset request list (for an image-gen assistant)

The paste-ready version of `spec/sprite-manifest.md`, cut down to what the new
tower view actually needs first, with a file name and an exact pixel size for
every item. Keith drives the art direction; this file only fixes the
**names, sizes, and states** so the results drop into the renderer without
re-cutting.

Everything here is **Tier 0 + Tier 1** — the shell and the minimum viable
reskin. Tiers 2 and 3 stay in the sprite manifest until these land.

---

## How to ask for it (workflow, not art direction)

Image models cannot output a 48x32 PNG. Ask for **one subject per image,
drawn large**, then downscale:

1. Request a single 1024x1024 image, subject centred, filling the frame, on a
   flat magenta `#FF00FF` background (easy to key out) — not on a scene.
2. Say **"pixel art on a 48x32 pixel grid, each pixel a clean square block,
   hard edges, no anti-aliasing, no gradients, no drop shadow, no text"**.
   Naming the grid is what keeps the result downscalable.
3. Downscale to the native size below with **nearest-neighbour** resampling,
   then key out the magenta.
4. Multi-frame items: ask for the frames **side by side in one image, evenly
   spaced, identical framing**, then slice.

Expect to redraw the fiddly ones by hand. The value of a generated pass is
the palette and the read, not pixel-perfect output.

## Constants to repeat in every prompt

- **Style:** mixel — crisp pixel art, dark and warm, readable at a glance.
  SimTower is the ancestor, not the reference to copy.
- **Native grid:** 1 building slot = **48x32 px**. Every room is exactly one
  slot. Shafts and stairs occupy a 48 px-wide column.
- **People:** 16 px tall.
- **Palette anchors:** bg `#0e1116` · panel `#1b2430` · good `#3ddc97` ·
  warn `#ffb703` · bad `#ef476f` · info blue `#8ecae6` · hotel violet
  `#c77dff`.
- **Room hue families:** office = blue, condo = green, shop = amber,
  hotel = violet.
- **Night:** sprites need **lit-window night variants**. The sky itself is
  drawn by code — never bake sky or lighting into a sprite.
- **Delivery:** PNG, 1x native size, transparent background, kebab-case file
  names, one file per subject with frames laid left to right.

---

## Delivery: the sidecar JSON

Every PNG ships with a JSON file of the same name. The two together are what
`render/sprites.js` loads; a PNG on its own cannot be drawn, because nothing
tells the renderer where one state stops and the next begins.

**All the frames of a subject go in a single strip, left to right, in the
order the "Frames / states" column lists them.** One row, one file. The
sidecar then names each state by the column it starts at:

```json
{
  "frameW": 48,
  "frameH": 32,
  "animations": {
    "vacant":         { "col": 0, "frames": 1 },
    "occupied-day":   { "col": 1, "frames": 2, "speed": "idle" },
    "occupied-night": { "col": 3, "frames": 1 },
    "stressed":       { "col": 4, "frames": 1, "speed": "blink" }
  }
}
```

That file describes `office.png` — a 240x32 strip of five 48x32 frames.

| Field | Meaning |
|---|---|
| `frameW` / `frameH` | one frame at 1x. A room slot is `48x32`; a person is 16 px tall. |
| `col` | the state's first column, counting from 0. Default `0`. |
| `frames` | how many frames the state uses, running left to right. |
| `row` | only for the rare grid sheet (people, with a row per facing). Default `0`. |
| `speed` | a **name**, never a number — see below. Default `"default"`. |
| `loop` | `false` for a one-shot such as doors opening. Default `true`. |

Animation keys are the "Frames / states" entries, kebab-cased:
`vacant`, `occupied-day`, `occupied-night`, `stressed`, `doors-opening`,
`walk-left`, `wait-annoyed`.

**Speeds are named, not numbered.** The legal names live in
`config.feel.sprites.fps` and are `idle`, `blink`, `walk`, `doors`,
`construction`, `escalator`, `default`. An fps *number* in a sidecar is
refused by the loader and the animation drops to the default speed — timing is
a feel constant, and feel constants live in config so the whole game can be
retimed in one edit. If a state needs a speed that is not in that list, say so
and the constant gets added; do not put the number in the art file.

Drop the pair into `src/games/lift/assets/sprites/` — see
`src/games/lift/assets/README.md`. Sheets load one subject at a time and
anything missing or malformed simply keeps drawing the coloured rectangle it
draws today, so partial delivery is expected and safe: send subjects as they
finish, not in a batch at the end.

---

## Tier 0 — the shell (new; the tower view needs these first)

The ground line, the underground, and the build palette. None of this exists
today.

| # | File name | Size (1x) | Frames / states | What it is |
|---|---|---|---|---|
| 1 | `ground-street.png` | 48x16 tile | 1 | Sidewalk and curb, tiles horizontally under floor 0. The horizon line of the whole game. |
| 2 | `ground-entrance.png` | 48x16 | day · night | The apron directly under the lobby — steps, doormat, a lit sign at night. |
| 3 | `earth-fill.png` | 48x32 tile | 1 | Packed dirt behind the underground floors. Tiles both directions, must stay quiet — it is a backdrop. |
| 4 | `earth-edge.png` | 48x32 | 1 | The dug edge where earth meets a basement slot; used at the outer wall. |
| 5 | `basement-empty.png` | 48x32 | 1 | Bare concrete basement slot — colder and dimmer than `slot-empty`. |
| 6 | `basement-parking.png` | 48x32 | empty · 1 car · 2 cars | Parking bay. The main reason to dig. |
| 7 | `basement-storage.png` | 48x32 | 1 | Crates and shelving. |
| 8 | `basement-utility.png` | 48x32 | idle (2f) | Boilers, pipes, a slow blinking indicator. |
| 9 | `foundation-slab.png` | 48x6 tile | 1 | The heavier slab that separates ground floor from B1. |
| 10 | `palette-icons.png` | 32x32 each, 17 across | 1 each | Build-menu tool icons, in this order: lobby · floor · office · condo · shop · hotel · shaft · car · express · stairs · escalator · cafeteria · parking · clinic · security · recycling · demolish. Flat, single-subject, silhouette-readable at 32 px. |

## Tier S — the sky (new; `render/sky.js` draws shapes until these land)

The sky is what tells the player it is morning without them reading the clock,
and what gives the eye somewhere to rest between rushes. All of it is
decoration: the game plays identically with every one of these missing.

Everything here flies against an open sky, so **transparent background, and no
baked-in lighting** — the sky behind them is a live gradient that changes
through the day.

| # | File name | Size (1x) | Frames / states | What it is |
|---|---|---|---|---|
| 29 | `sky-cloud.png` | 96x32 | small · medium · large | Three cloud masses, one per frame, each centred in its 96x32 box and drawn at a different apparent size. Soft and low-contrast — they sit behind everything and must never compete with the tower. |
| 30 | `sky-bird.png` | 16x16 | fly (4f) | One bird, wings up through wings down. Flies in flocks of 2-7, so it must read at a glance as a silhouette. |
| 31 | `sky-plane.png` | 48x16 | fly (2f) | A small airliner in level flight, side on, nose to the right. The second frame is a subtle bob, not a different pose. |
| 32 | `sky-balloon.png` | 32x48 | drift (2f) | An ordinary hot-air balloon: striped envelope, wicker basket. Two frames of gentle sway. |
| 33 | `sky-blimp.png` | 64x24 | drift (2f) | A small airship with a gondola and a blank banner panel on its flank. |
| 34 | `sky-explorer.png` | 48x64 | drift (4f) | **A surprise.** A tall adventurer's balloon — patched envelope, rope rigging, a laden basket with an explorer leaning out waving, a dog beside them. The four frames are the burner flaring and the basket swaying. Seen perhaps twice a session, at dawn or dusk. |
| 35 | `sky-stunt.png` | 48x24 | fly (4f) | **A surprise.** An aerobatic biplane in a bold racing livery — invented, no real-world team or sponsor — banking as it passes, with a smoke trail starting at the tail. Four frames of roll. |

## Tier 1 — rooms and structure (replaces the coloured rectangles)

| # | File name | Size (1x) | Frames / states | Notes |
|---|---|---|---|---|
| 11 | `office.png` | 48x32 | vacant · occupied-day (2f) · occupied-night lit · stressed | Stressed = subtle mess and a red accent; must read at 1x. |
| 12 | `condo.png` | 48x32 | vacant · occupied-day (2f) · occupied-night lit · stressed | Homier and warmer than office. |
| 13 | `shop.png` | 48x32 | vacant · open (3f awning/sign) · closed-night | Two visual variants (grocery, cafe) to break repetition. |
| 14 | `hotel.png` | 48x32 | vacant · booked-day · booked-night lit · poor-review | Violet accent. |
| 15 | `slot-empty.png` | 48x32 | 1 | Bare concrete and studs. |
| 16 | `slot-construction.png` | 48x32 | 3f | Scaffold and dust; plays while a build lands. |
| 17 | `lobby.png` | 48x32 | day · night | Glass entrance. Tiles horizontally with `lobby-wing`. |
| 18 | `lobby-wing.png` | 48x32 | day · night | Seamless continuation of the lobby. |
| 19 | `floor-slab.png` | 48x4 tile | 1 | The line between floors; tiles horizontally. |
| 20 | `roof-cap.png` | 48x12 | plain · antenna | Sits on the top floor. |

## Tier 1 — transport

| # | File name | Size (1x) | Frames / states | Notes |
|---|---|---|---|---|
| 21 | `shaft-column.png` | 48x32 tile | 1 | Dark interior with guide rails; tiles vertically. |
| 22 | `elevator-car.png` | 40x26 | closed · opening (3f) · open | Riders are silhouettes in the window; the count is drawn by code. |
| 23 | `elevator-car-express.png` | 40x26 | same set | Violet trim — express is already a distinct kind in the sim. |
| 24 | `stairs-segment.png` | 48x32 tile | 1 | Diagonal flight; tiles vertically. |
| 25 | `escalator-segment.png` | 48x32 tile | 4f loop | Moving-step animation. |

## Tier 1 — people

Three palette swaps each, so a crowd is not one person repeated.

| # | File name | Size (1x) | Frames / states | Notes |
|---|---|---|---|---|
| 26 | `person-worker.png` | 16 px tall | walk L/R (4f) · stand (2f fidget) · wait-annoyed (2f) | The default commuter. |
| 27 | `person-resident.png` | 16 px tall | same set | Condo dweller; casual. |
| 28 | `person-guest.png` | 16 px tall | same set, plus a luggage variant | Hotel guest. |

---

## Delivered vs requested (first pass, 2026-09-01)

All 28 subjects arrived, native size, transparent, with every frame distinct
and non-blank — verified against the real pixels, not the delivery note. The
sheet on disk wins wherever it disagrees with this document, because that is
what the renderer has to draw. What it does not yet cover:

- **`palette-icons.png` is a different 17 tools** — it carries bulldozer,
  inspect, repair and finances, and is missing **floor, shaft and car**. Six
  buildable tools have no icon, and the style is glossy rather than mixel. The
  redo request is in `ROADMAP.md`. Tiles run on text monograms until it lands.
- **Walk cycles came back 2 frames, not 4.** People walk, but the gait is
  coarser than the manifest asks for.
- **`elevator-car` has a single `opening` frame**, not the 3-frame door
  animation. Doors pop rather than slide.
- **`escalator-segment`'s four frames are nearly identical**, so the loop may
  not read as movement at 1x.
- **`roof-cap` is very faint** against the sky.
- **`lobby-wing` does not tile seamlessly.** Each frame carries its own bright
  vertical edge, so a widened lobby reads as a row of separate panels rather
  than one frontage. The renderer now puts the doors in the middle with wings
  either side (Keith, 2026-09-01: "it should connect in the middle with its
  own ends"), which is as far as composition can carry it. Finishing it needs
  art: a **left end cap**, a **seamless middle** with no vertical edge of its
  own, and a **right end cap** — three 48x32 frames, day and night, replacing
  the single `lobby-wing`. The doors piece (`lobby`) stays as it is.
- Bonus nobody asked for: **`slot-empty` came back as four UI states** —
  empty, selected, unavailable, highlighted. The highlighted frame is the
  build-palette ghost, and it is already wired.

## Order to produce in

1. **1, 3, 5, 9** — ground and earth. The horizon is the single biggest
   change to how the game reads, and it is four tiles.
2. **10** — palette icons, so the build menu can stop being a text list.
3. **15, 17, 18, 19, 11** — empty slot, lobby, slab, office: the opening
   screen of a new game, complete.
4. **21, 22** — the shaft and the car: the thing the whole game is about.
5. **26** — one person type, walking. The tower comes alive at this item.
6. Everything else, in table order.

## What not to ask for yet

Interior life, shop customers, queue crowds, fireworks, star plaques, cranes,
clouds, pigeons — all real, all specified in `spec/sprite-manifest.md`, none
of it useful until the shell in `spec/tower-view.md` is standing.
