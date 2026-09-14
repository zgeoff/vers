# Respite authoring workspace

Blender owns the editable buildings, court layout, and camera. The browser preview loads separate
GLBs and the layout that Blender exports. Inspection, concept atmosphere, and the original viewer
study are independent treatments. The [art direction](DIRECTION.md) defines the reference
priorities; [reference provenance](reference-provenance.json) records the original files and their
checksums.

## Open the scene

Open [scenes/respite.blend](scenes/respite.blend) in Blender. The `Respite.*` collections contain
the buildings, habitat, ground, and presentation objects. Each building has a named parent at ground
level. One Blender unit represents one metre, and each building's local entrance faces negative Y.

The `Court` camera defines the proposed game composition. `Court-alternate` checks the opposite
angle. `Plan` shows the arrangement from above. Individual inspection cameras remain available for
the Codex and asset reviews.

## Run the browser preview

Run these commands from `art/respite/viewer`:

```bash
bun install --frozen-lockfile
node server.mjs
```

Open `http://localhost:4599`. Add `?backend=webgl` to force the WebGL2 fallback. The server serves
local files and has no write endpoint. The preview has no connection to the game's accounts or
services.

Select a building to inspect it alone. Select `Court` to inspect the composition. The camera menu
selects the Blender camera, and the treatment menu selects the appearance. Exposure, fog, bloom, and
ink controls save per treatment in browser local storage. `Reset treatment` restores that
treatment's defaults. The inspection treatment disables fog, bloom, and ink.

The preview polls the export manifest every 1.5 seconds. A completed export reloads the assets; a
failed load keeps the last complete scene. `Reload assets` forces a reload. The diagnostics show the
backend, geometry, textures, export size, and frame interval. Frame interval includes browser
scheduling and is not a GPU duration measurement.

## Change an asset

Edit the Blender objects directly for manual adjustments. The scripts construct the generated
geometry and support rebuilding one asset.

**CAUTION:** Rebuilding an asset replaces its generated objects. The builder saves a checkpoint
first and preserves custom objects without the `respite_generated` property.

Run this in Blender's Python console, with the workspace path for your machine:

```python
import runpy
from pathlib import Path
root = Path(r"\\wsl.localhost\ArchLinux\home\geoff\projects\vers\.worktrees\respite-modeling\art\respite")
builders = runpy.run_path(str(root / "scripts/build_scene.py"))
builders["build"](["codex"])
```

The builder preserves existing asset placement and shared material adjustments. The
[construction script](scripts/build_scene.py) defines the generated forms. Its placement constants
apply when an asset has no existing parent; the saved Blender scene owns subsequent placement
changes.

## Export and render

Run the exporter from the same Blender console:

```python
runpy.run_path(str(root / "scripts/export_scene.py"), run_name="__main__")
```

The [exporter](scripts/export_scene.py) evaluates modifiers on temporary copies and joins static
geometry for delivery. The authoring objects remain separate. The vault door remains a separate
exported mesh. Asset files have local origins; `exports/scene.json` carries their world placement
and the Blender cameras. The exporter writes the manifest after the asset files.

Schedule court review renders:

```python
render = runpy.run_path(str(root / "scripts/render_views.py"))
render["schedule"]([("Court", "court-review.png"), ("Plan", "plan-review.png")], 100, 48)
```

Schedule individual building reviews:

```python
render = runpy.run_path(str(root / "scripts/render_assets.py"))
render["schedule_assets"](("codex", "stash", "workshop", "bazaar", "exit"), "review")
```

These jobs run through Blender timers. Their JSON status files live beside the renders. Check the
status before another Blender operation; a render occupies Blender until it finishes. The scripts
save images without opening Windows Image Viewer.

## Textures and saved files

[bake_materials.py](scripts/bake_materials.py) authors seamless paint textures in Blender and bakes
them to PNG. The materials use those images directly, with metre-scaled UVs. The `.blend` packs its
used images. The texture recipes use no external texture assets.

The committed sources include the `.blend`, scripts, and preview code. The working bundle includes
reference images, textures, exports, checkpoints, and review renders. These supporting files stay
outside Git. Preserve the complete bundle when moving the workspace; the reference-provenance file
identifies its original art.

The preview uses the project's three.js version and its node render pipeline. Runtime integration
into the persistent game canvas remains separate from this art workspace. The original aesthetic
experiment remains on `spike/respite-lookdev` at checkpoint `68a84afd`.
