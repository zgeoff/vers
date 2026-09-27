# Respite plaza layout

The plaza is a rectangle with two rear corners cut back at 45 degrees. Its centre line aligns with
the tunnel. The stash and bazaar face each other across the straight side edges. The Codex and
workshop follow the angled rear edges, with their entrances facing the shared court.

![Game camera](renders/plaza-shape-court.png)

The [top view](renders/plaza-shape-plan.png) shows the shape and the four frontages. The buildings
sit outside the plaza perimeter; their doors and the Codex steps open directly onto its pedestrian
space. The tunnel connects to the centre of the rear edge through a short apron. The foreground
stays open.

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
