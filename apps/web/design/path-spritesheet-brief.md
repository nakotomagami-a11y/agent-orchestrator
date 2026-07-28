# Path spritesheet — art brief for image-gen AI

Companion file: **`path-autotile-demo.svg`** (open in any browser). That SVG is the
*exact* current in-engine geometry rendered as flat vectors — it looks bad on
purpose. Your job: produce a beautiful **PNG** that drops into the same 16-frame
grid and tiles seamlessly.

---

## 1. What this asset is

A **ground path / trail** that the user paints cell-by-cell onto a top-down
tile map. Wherever two path cells touch, the path must visually connect. We use
**4-neighbour cardinal autotiling**: each tile only needs to know whether its
North / East / South / West neighbours are also path — 4 bits → **16 tiles**.

It sits *on top of* a grass ground layer, so everything outside the path shape
must be **fully transparent** (alpha 0).

## 2. Art style (match the existing game exactly)

The map is **top-down 2D pixel art** in the **"Tiny Swords / Cute Fantasy RPG"**
aesthetic (think Pixel Frog "Tiny Swords", Stardew-adjacent). Reference traits:

- **Chunky, soft pixel art** — hand-painted feel, not clean geometric pixels.
- **Thick dark outline** hugging the shape (deep desaturated brown/navy, ~1–2px
  at this scale), same treatment the grass clumps and buildings use.
- **Saturated, warm palette**; gentle top-down lighting (light from above, no
  long cast shadows on the ground plane).
- **Subtle internal texture** — a few darker pebbles / cracks / scuffs and a
  lighter worn centre, but low-contrast so agents/props stay readable on top.
- **No isometric skew.** Tiles are flat squares seen from directly above.
- Palette starting point (current engine colours — you may enrich, keep the
  family): outline `#4a2e10`, dirt fill `#b8884e`, worn highlight `#d0a86a`.
  A packed-dirt trail *or* light cobblestones both fit — pick dirt unless noted.

## 3. Technical spec (hard requirements)

| Property        | Value |
|-----------------|-------|
| Tile size       | **64 × 64 px** |
| Sheet layout    | **4 columns × 4 rows** |
| Sheet size      | **256 × 256 px** |
| Frames          | 16 (one per NESW combination) |
| Background      | **Transparent** (PNG, straight alpha) |
| Pixel style     | Crisp — designed for **nearest-neighbour** scaling. No soft/blurry anti-aliased edges bleeding into the transparent area. |
| Gutter/padding  | **None.** Tiles are flush in a tight grid (no gaps, no margins). |

## 4. The seamless-connection rule (most important)

Autotiling only works if connected edges line up. So:

- The path is a **band centred in the tile, exactly 36 px wide** (14 px of grass
  margin on each side). This width and centre position must be **identical on
  every tile and every edge** so any two tiles connect without a jog.
- Where a tile **connects** to a neighbour (that direction's bit is on), the band
  runs **all the way to that tile edge at full 36 px width**, so it meets the
  neighbour's band pixel-perfectly. The dark outline must **not** cross the
  connected edge (outline only runs along the *open* sides).
- Where a tile does **not** connect, that side is a **rounded, organic cap** with
  the full dark outline, fading to transparent.
- Keep the internal texture *tileable-friendly*: avoid a distinct motif right at
  a connecting edge that would visibly repeat/clash against the adjoining tile.

## 5. Frame layout (which tile goes in which cell)

Bit values: **N = 1, E = 2, S = 4, W = 8**. Frame index = the bitmask.
Grid position: **column = mask & 3**, **row = mask >> 2** (row-major, top-left is
mask 0). This is what the demo SVG shows and what the engine will index.

| Cell (row,col) | mask | binary NESW | Shape |
|---|---|---|---|
| 0,0 | 0  | 0000 | **Node** — isolated round patch, no connections |
| 0,1 | 1  | 0001 | Dead-end, opening **N** |
| 0,2 | 2  | 0010 | Dead-end, opening **E** |
| 0,3 | 3  | 0011 | **Elbow** N+E |
| 1,0 | 4  | 0100 | Dead-end, opening **S** |
| 1,1 | 5  | 0101 | **Straight** vertical (N+S) |
| 1,2 | 6  | 0110 | **Elbow** E+S |
| 1,3 | 7  | 0111 | **T-junction** N+E+S |
| 2,0 | 8  | 1000 | Dead-end, opening **W** |
| 2,1 | 9  | 1001 | **Elbow** N+W |
| 2,2 | 10 | 1010 | **Straight** horizontal (E+W) |
| 2,3 | 11 | 1011 | **T-junction** N+E+W |
| 3,0 | 12 | 1100 | **Elbow** S+W |
| 3,1 | 13 | 1101 | **T-junction** N+S+W |
| 3,2 | 14 | 1110 | **T-junction** E+S+W |
| 3,3 | 15 | 1111 | **4-way cross** (N+E+S+W) |

(4 dead-ends, 4 elbows, 2 straights, 4 T-junctions, 1 cross, 1 node = 16.)

## 6. Do / Don't

**Do**
- Keep the 36 px centred band width rock-steady across all edges.
- Make elbows curve/round the corner naturally (not a hard L notch).
- Vary the surface texture subtly *within* the band, symmetric enough that
  neighbours don't clash.
- Deliver a single 256×256 PNG, transparent, tiles flush.

**Don't**
- No drop shadow on the transparent ground (the map layer handles shadows).
- No grass, no background fill, no grid lines, no labels in the final PNG.
- No gaps/margins between tiles; no off-centre or variable-width bands.
- No anti-aliased fuzz — must survive nearest-neighbour upscaling cleanly.

## 7. Paste-ready prompt

> A 256×256 pixel-art spritesheet, 4×4 grid of 64×64 tiles, transparent
> background. Top-down 2D "Tiny Swords / Cute Fantasy RPG" style: a packed-dirt
> trail with a thick dark-brown outline, warm tan surface (#b8884e), lighter
> worn centre, small scattered pebbles and scuffs, soft overhead lighting, no
> cast shadow. The 16 tiles are the 16 cardinal-connection pieces of an
> autotiling path: an isolated round node, four dead-ends (opening up/right/
> down/left), two straights (vertical, horizontal), four rounded elbows, four
> T-junctions, and one 4-way crossroads. The trail is a centred band 36px wide;
> where a tile connects to a neighbour the band runs full-width to that edge so
> pieces line up seamlessly; open sides get a rounded outlined cap. Crisp pixels
> for nearest-neighbour scaling, tiles flush with no gaps, no text, no grid.

See `path-autotile-demo.svg` for the exact 16-frame layout and connection
geometry to reproduce.
