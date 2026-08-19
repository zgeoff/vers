# Respite viewer

The asset-facing look-dev tool. Blender authors the models; this views them — alone at real
scale, composed into the town, and arranged on a plan. Spike code, outside lint and CI.

## Running

Two servers, from this directory:

```sh
bun ./serve.ts             # side server on :4601 — models + data files
BUN_PORT=4599 bun ./index.html   # the bundle on :4599  (never port 3000)
```

Then open `localhost:4599`. `?v=stage|gym|plan` opens straight into a view.

## Views

- **Stage** (`1`) — the composed town at the baked camera, full night treatment: warm sodium
  windows, ink outlines, fog sea and wall, drifting banks, vent plumes, skyline streaks. Built
  entirely from `data/placements.json`; nav buildings glow on hover, because the buildings are
  the menu.
- **Gym** (`2`) — one asset alone, orbitable, beside a 1.8 m reference figure. `L` or the HUD
  button toggles the canon night rig against a neutral inspection rig. Every `.glb` in the
  watched directory is listed down the left; click to switch subject.
- **Plan** (`3`) — the entity placer. Drag to move, `Q`/`E` to rotate, shift-drag to pan, wheel
  to zoom, `S` or the HUD button to save. Footprints come from the loaded model's real bounds,
  so the plan shows the shape that will actually be there. The overlap check runs live in the
  status line.

`C` copies the live camera as JSON in any 3D view.

## Data

Both files live in `data/` and are read and written through the side server, so tuning and
layout survive a reload with no copy-paste step.

- `placements.json` — the layout. `models[]` are asset slots: `file` names a `.glb`, and a slot
  whose `file` is `null` renders as a placeholder box of `size` so the composition stays
  testable before the asset exists. `blocks[]` are the background massing boxes.
- `knobs.json` — every tuner value, saved on change (debounced) and applied over the defaults at
  boot.

## Models

The side server watches `../lookdev/models/` — the directory Blender's auto-export already
targets. Re-export and the running page reloads the file, rebuilds the live view, and frees the
replaced model's GPU resources. Export conventions and per-asset state are in
`../lookdev/MODELING.md`.

The gate is the only authored asset so far, and the panel texture on its concrete is
script-generated placeholder art — it proved that drawn surface detail survives the night grade,
which is all it was for. Don't read it as the intended look.

## Notes for changing this code

- A scene build registers its live lights, materials, and bloom in `liveRefs` so setter knobs
  can re-apply onto it; uniform knobs drive their TSL node directly and need no rebuild.
- Anything shared across builds (the unit box geometry, hover hull materials, loaded model
  resources) must be in `persistentResources`, or the teardown between builds disposes it out
  from under the next one.
- Pass and effect nodes own render targets and must be disposed by hand — the post-processing
  wrapper has no dispose, and FXAA's internal render target has none either. `buildPost` tracks
  all of them; a new effect added there needs the same treatment or the GPU process dies after
  enough view flips.
- Atmosphere sits on layer 1, which the ink pass's camera never enables — that is what keeps fog
  from being outlined while buildings behind it keep their ink.
- Anything meant to read past the fog far distance (streaks, light shafts) needs `fog: false`,
  or scene fog flattens it to a dark card.
