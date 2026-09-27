# Respite plaza layout

The editable scene places the stash and bazaar on opposite sides of one court. The Codex and
workshop stand beside the tunnel approach. Shared paving, low service walls, and a west service
block connect the destinations. The background volumes are provisional design elements.

![Current three.js layout](renders/plaza-layout-current.png)

The [plan view](renders/plaza-layout-plan-current.png) shows the inward-facing entrances. The bazaar
preserves three roofed vendor wings and both return walls. Its wider courtyard exposes the vendor
bays from the game camera. The Codex steps meet the doorway threshold.

## Inspect the layout

Open [the Blender scene](scenes/respite.blend) or run the
[browser preview](README.md#run-the-browser-preview). The Court camera defines the game view. The
Plan camera checks the court boundaries and approaches.

The [geometry report](renders/plaza-layout-check.json) records destination framing, entrance
visibility samples, and clear approach segments from the tunnel. The route probe follows a normal
approach to each doorway. It samples a 0.7m-wide corridor at two heights; it is not a navigation
mesh or a general collision solver. Visual review remains necessary.

## Reapply the layout

The [layout script](scripts/layout_scene.py) owns the proposed placements, Court camera, and
generated connecting geometry. It saves a Blender checkpoint before replacing its tagged objects.
The market proportions and Codex steps belong to the [building script](scripts/build_scene.py).

Run these commands inside Blender with `root` set as described in the authoring README:

```python
runpy.run_path(str(root / "scripts/layout_scene.py"), run_name="__main__")
runpy.run_path(str(root / "scripts/check_layout.py"), run_name="__main__")
runpy.run_path(str(root / "scripts/export_scene.py"), run_name="__main__")
```

The original first-pass scene remains in `checkpoints/before-plaza-layout.blend`. The checkpoint
`checkpoints/before-resume-september27.blend` preserves the interrupted layout candidate.

## Environmental concepts

The [concept prompts](concepts/studies.json) record three built-in imagegen studies. The current
scene supplies the composition; the original references supply atmosphere and material direction.
These images are visual proposals, not screenshots of implemented geometry. Background structures,
added vegetation, windows, and lighting remain subject to selection.

| Study                                                        | Architectural proposal                                         | Review concern                                                |
| ------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------- |
| [A: Service galleries](concepts/a-service-galleries.png)     | An inhabited perimeter links the left buildings.               | Plants and repeated warm lamps exceed the intended restraint. |
| [B: Curved structural ribs](concepts/b-curved-structure.png) | Vast curved machinery recedes behind the settlement.           | The bright upper-left fog competes with the exit.             |
| [C: Shared utilities](concepts/c-shared-utilities.png)       | A connected conduit system explains the surrounding machinery. | The market gains unnecessary small goods.                     |

The generated studies change some wall heights and small building details. The Blender source
retains the approved asset forms and the continuous wall. Concept selection governs the background
character, not automatic adoption of every generated detail.
