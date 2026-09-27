# Respite plaza layout

The current layout tests the bazaar beside the stash along the left perimeter. Both entrances face
across the shared court. The Codex and workshop follow the angled rear edges. The right perimeter
remains open for a possible future destination.

![Market beside the stash](renders/market-left-framed.png)

The [top view](renders/market-left-plan.png) shows the extended court. The
[comparison render](renders/oblique-before-market-move.png) preserves the market on the right from
the user's preferred oblique angle. The [camera reference](camera-reference.json) records the live
viewer camera; the current framing pans sideways to include the whole market while retaining that
angle and field of view.

The prior arrangement remains in `checkpoints/before-market-left.blend`. This candidate changes the
market placement and foreground extent, while the other destination placements remain fixed.

The wall is continuous on both sides of the tunnel. The passage sits within one broad mass behind
it, with no separate box-shaped roof. Curved machinery and shared utilities establish the approved
backdrop direction. Surrounding frontages and amenities remain a separate design pass.

## Inspect and rebuild

Open [the Blender scene](scenes/respite.blend) or run the
[browser preview](README.md#run-the-browser-preview). Court defines the game view; Plan shows the
arrangement from above. The [layout script](scripts/layout_scene.py) defines the plaza shape before
it places the buildings against its edges.

The script saves a checkpoint before replacing its generated paving and placement. It preserves the
building meshes and the habitat wall. Run these commands inside Blender with `root` set as described
in the authoring README:

```python
runpy.run_path(str(root / "scripts/layout_scene.py"), run_name="__main__")
runpy.run_path(str(root / "scripts/check_layout.py"), run_name="__main__")
runpy.run_path(str(root / "scripts/export_scene.py"), run_name="__main__")
```

The [geometry report](renders/plaza-layout-check.json) records framing, entrance visibility,
approach samples, and passage enclosure. It samples a 0.7m-wide approach at two heights. It is not a
navigation mesh or a general collision solver.

## Environment references

[Study D](concepts/d-continuous-wall.png) establishes the continuous wall, curved background
machinery, and connected pipework. [Study E](concepts/e-connected-perimeter.png) explores the
surrounding town frontage. These are image-generated art references; the actual building arrangement
comes from the scene and top view above.

The [study index](concepts/studies.json) records outputs, references, and prompts. The complete
working and Desktop review bundles retain the images, exports, and checkpoints outside Git.
