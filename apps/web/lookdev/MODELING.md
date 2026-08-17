# Respite modeling handoff

The spike is on hold while the buildings get authored in Blender. Everything around the models
survives: the fixed camera, the plaza layout, the night lighting rig (entrance spill, gate wash,
lamps), the atmosphere (fog banks, mist, gate haze, vent plumes), the motion layer (flicker,
rays, skyline streaks), the tuner panel, and the journal. A model dropped into a placement slot
inherits all of it.

## Pipeline

Blender → glTF Binary (`.glb`) → loaded by the lookdev page (loader wiring is a small task on
the code side once the first model exists). One `.glb` per building, whole building per file.

## Conventions

- **Scale**: 1 Blender unit = 1 scene unit (roughly 1 m). Model at real size per the table below.
- **Origin**: at the building's ground center — the point that lands on the placement (x, z).
  Ground plane is y = 0; nothing below it except intentionally sunken detail.
- **Facing**: the entrance faces **−Y in Blender** (the glTF exporter's default mapping turns
  that into the scene's local +z, which every placement rotates toward the plaza). If it comes
  in backwards we flip it with one constant — don't sweat it.
- **Apply transforms** before export (Ctrl+A → All Transforms). Export with the default glTF
  settings (+Y up).
- **Emissive by material name**: any material whose name starts with a glow prefix gets replaced
  at load with the scene's bloom-friendly emissive of that color family — so windows glow, join
  the bloom pass, and (warm windows) can flicker:
  - `glow-warm` — sodium interior light (windows, kiosks, lanterns)
  - `glow-teal` — system light (the gate frame, instruments)
  - `glow-violet` — high signals
  - `glow-amber` — service markers
  Model the pane/strip as its own small face or mesh carrying that material; author its albedo
  as roughly the glow color so it previews sensibly in Blender.
- Everything non-glow ships exactly as authored (base color, roughness, vertex colors, textures).
  Palette-texture and vertex-color workflows both survive glTF fine.

## What to model (sizes = current procedural bounding volumes; deviate freely — the plan editor
drags placements and the overlap checker re-verifies, so growing or shrinking is fine)

| Building | Footprint (w × d) | Height | Notes |
| -------- | ----------------- | ------ | ----- |
| market   | ~13.5 × 6         | ~5.7   | stacked bazaar; canopy bays + stall row on the front |
| stash    | ~8.5 × 6          | ~3.7   | asymmetric double drum; vestibule entrance extrudes past the collar bands |
| codex    | ~8 × 6 (+ rear annex) | ~5.4 | severe archive hall; steps + banner fins at the entrance |
| gate     | ~15 × 4 (+ kiosks in front) | ~16 | current register: B1.6i civic checkpoint — but this is exactly the building most worth re-imagining by hand |
| avatar   | ~6 ⌀ (+ side kiosk) | ~7.9 | stacked drums |
| fountain | ~4.5 ⌀            | ~1.4  | three tiers + hub; instrument light on the hub (`glow-teal`) |

Lamp posts, filler massing, and the background skyline stay procedural — the fidelity-gradient
rule holds: only the six focal buildings deserve authored models.

## Placements the models drop into (live values; draggable in the plan editor)

| key      | x     | z     | ry     |
| -------- | ----- | ----- | ------ |
| market   | −14.3 | 2.2   | 1.631  |
| stash    | −12.7 | −10.6 | 1.063  |
| codex    | −4.6  | −14.7 | 0.06   |
| gate     | 6.4   | −16.4 | 0.05   |
| avatar   | 16.1  | −5.3  | −1.451 |
| fountain | −3.9  | 0.7   | 0      |

## What the camera sees (spend detail where it counts)

Fixed camera at (0, 9, 26), fov 36, looking at (0, 3, −7): a shallow high three-quarter view
from the plaza's open end, buildings 25–45 units away. Front faces and rooflines carry almost
everything; backs are never seen. Silhouette and front detail first, roofs second, flanks third,
backs never.

## Suggested path

1. Model the **fountain** first — smallest, no windows, validates the whole pipeline
   (export → load → position → glow material) in an afternoon of Blender skill.
2. Then one nav building end-to-end (market or stash) before batching the rest.
3. The Bevel modifier and a palette-texture (or vertex-color) workflow get the chunky
   stylized read with no UV pain — standard low-poly-stylized technique.
