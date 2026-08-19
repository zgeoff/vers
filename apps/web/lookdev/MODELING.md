# Respite modeling handoff

The buildings are authored in Blender; everything around them already exists. The camera, the
plaza layout, the night lighting rig, the atmosphere (fog sea and wall, banks, mist, gate haze,
vent plumes), the motion layer (window flicker, far rays, skyline streaks), the ink outlines,
the tuner, and the hover-glow menu are all built and settled. A model dropped into a placement
slot inherits all of it.

## Pipeline

Blender → glTF Binary (`.glb`) → this directory's `models/` folder. The viewer
(`apps/web/viewer/`) watches that directory and picks up **every** `.glb` in it: save in
Blender, and the asset appears in the gym's list and hot-reloads into the live view within a
second or so. No registration step and no code change — adding a building is adding a file.

One `.glb` per building, whole building per file. The file's name is its identity, so keep it
stable across re-exports.

To put a new asset into the town, open it in the viewer's gym and press the placement button —
no JSON editing. **Name the file after the slot it belongs to** (`respite-market.glb` for the
`market` slot; the `respite-` prefix is optional) and it drops straight into the position
already composed for that building; anything else joins the town as a new slot near the plaza,
ready to drag into place.

That rule doubles as the kit's filing discipline: a file named for a slot **is** that building,
and anything else is a module or a prop. The distinction shows up at the filesystem level before
it exists anywhere in the data.

Slot keys: `market`, `stash`, `codex`, `gate`, `avatar`, `fountain`.

## Conventions

- **Scale**: 1 Blender unit = 1 scene unit (roughly 1 m). Model at real size.
- **Origin**: at the building's ground center — the point that lands on the placement (x, z).
  Ground plane is y = 0; nothing below it except intentionally sunken detail.
- **Facing**: the entrance faces **−Y in Blender** (the exporter's default mapping turns that
  into the scene's local +z, which every placement rotates toward the plaza). If it comes in
  backwards, one constant flips it — don't sweat it.
- **Apply transforms** before export (Ctrl+A → All Transforms). Export with the default glTF
  settings (+Y up), no Draco.
- **Emissive by material name**: any material whose name starts with a glow prefix is treated as
  scene light — it joins the bloom pass, and warm windows can flicker:
  - `glow-warm` — sodium interior light (windows, kiosks, lanterns)
  - `glow-teal` — system light (the gate frame, instruments)
  - `glow-violet` — high signals
  - `glow-amber` — service markers

  Model the pane or strip as its own small face carrying that material, and author its albedo as
  roughly the glow color so it previews sensibly in Blender.
- Everything non-glow ships exactly as authored. Palette-texture and vertex-color workflows both
  survive glTF fine; embed textures when texturing starts.
- **Flat authored albedo, no baked directional light.** Painted ambient shading is fine; a baked
  sun direction fights the scene's sodium rig.
- **Judge albedo in the viewer, not the Blender viewport.** Under the night rig plus AgX tone
  mapping, everything reads darker and warmer than it looks while modeling. The gym's neutral
  lighting toggle is for reading the asset's true color; the night toggle is for judging how it
  will actually appear.

## Asset state

| Asset  | File                | State |
| ------ | ------------------- | ----- |
| gate   | `respite-gate.glb`  | modeled; surface detail is placeholder (see below) |
| market | —                   | not started; renders as a placeholder box |
| stash  | —                   | not started; renders as a placeholder box |
| codex  | —                   | not started; renders as a placeholder box |
| avatar | —                   | not started; renders as a placeholder box |
| fountain | —                 | not started; renders as a placeholder box |

The gate's panel texture — the seams and rivets on the concrete frame and some crown pieces —
is **script-generated placeholder art**, not intended art. It exists to answer one question:
does drawn surface detail survive the night grade? It does, visibly and subtly, which is the
result worth keeping. The look it implies is not.

That texture is referenced rather than packed, from
`C:\Users\User\Documents\respite-tile-panels.png`. Replacing that PNG with real hand-drawn tile
art and re-saving the `.blend` re-embeds it automatically — no model edit, no re-wiring.

## Direction

The town is built from a **kit**, not from bespoke buildings: building classes, module shapes,
four to six tiles, trim, and fixtures that recombine. Hero structures may carry hand-painted
unique textures while the surrounding city fabric uses tiling ones.

Sizes below are the current placeholder volumes — deviate freely. The plan editor drags
placements, derives footprints from the real model bounds, and re-runs the overlap check, so
growing or shrinking an asset costs nothing.

| Building | Footprint (w × d) | Height | Notes |
| -------- | ----------------- | ------ | ----- |
| market   | ~12 × 5           | ~5     | stacked bazaar; canopy bays and a stall row on the front |
| stash    | ~7 × 5            | ~3.5   | asymmetric double drum; vestibule entrance |
| codex    | ~8 × 5            | ~5.5   | severe archive hall; steps and banner fins at the entrance |
| gate     | 27 × 10.6 scaled  | ~14    | built; the widest thing in the composition |
| avatar   | ~5 × 5            | ~6     | stacked drums |
| fountain | ~4 ⌀              | ~1.4   | tiers and a hub; instrument light on the hub (`glow-teal`) |

Background massing and the skyline stay procedural boxes — the fidelity gradient holds: only the
focal buildings deserve authored models.

## Placements the models drop into

Live values are in `apps/web/viewer/data/placements.json`, and the plan view is the way to
change them. The current arrangement pushes most background massing far west and back, so the
plaza reads as an island of light with shapes looming out of the fog.

## What the camera sees

The stage camera sits at (35.82, 29.77, 41.11), fov 36, looking at (0, 4, −7) — a high
three-quarter view from the plaza's open end. Front faces and rooflines carry almost everything;
backs are never seen. Silhouette first, front detail second, roofs third, flanks fourth, backs
never.

Fog closes off distance: the fog sea and wall ring the plaza at radius ~23–27, so anything past
it reads as an inked silhouette rather than a surface. Detail spent out there is wasted.
