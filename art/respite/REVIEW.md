# Respite first-pass review

The five destination buildings, habitat wall, and court are editable in
[respite.blend](scenes/respite.blend). The scene has a working GLB export loop and a three.js
preview with three independent treatments. This is a complete first pass for art review; the
proportions and appearance remain open to refinement.

![Respite concept treatment](renders/comparison-concept-final.png)

## Compare the scene

These browser captures use the same Blender camera at 1600 × 1000.

| Treatment                 | Capture                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| Plain inspection          | [Open inspection](renders/comparison-inspection-final.png)       |
| Dark concept atmosphere   | [Open concept treatment](renders/comparison-concept-final.png)   |
| Original viewer influence | [Open ink and warmth study](renders/comparison-legacy-final.png) |

The [plan view](renders/browser-plan-final.png) shows the enclosure and arrangement. The
[portrait check](renders/portrait-check-final.png) shows the camera adaptation at 900 × 1200. Open
the live preview at `http://localhost:4599/?treatment=concept` while the server runs. The
[workspace instructions](README.md) explain how to restart it and use its controls.

## Inspect the buildings

The Blender studies show the forms under inspection lights. The browser studies show the exported
models and textures.

| Building | Blender                                           | Browser                                          |
| -------- | ------------------------------------------------- | ------------------------------------------------ |
| Codex    | [Study](renders/codex-study-final.png)            | [Export](renders/browser-codex-final.png)        |
| Stash    | [Study](renders/stash-study-final.png)            | [Export](renders/browser-stash-final.png)        |
| Workshop | [Study](renders/workshop-study-final.png)         | [Export](renders/browser-workshop-final.png)     |
| Bazaar   | [Study](renders/bazaar-study-final.png)           | [Export](renders/browser-bazaar-final.png)       |
| Exit     | [Study in the wall](renders/exit-study-final.png) | [Entrance asset](renders/browser-exit-final.png) |

The renders folder includes an opposite-angle Blender study for each building. The exit file
contains the entrance and observation tower; the habitat file owns the passage lining. The bazaar
retains all three roofed wings and both return walls. The workshop has one drum, and the stash has a
thick open door with a dark vestibule.

## Inspection results

- The [source audit](renders/source-audit.json) records ten disjoint pairs of destination footprints
  and seven packed texture images.
- The [entrance check](renders/entrance-check-final.json) records 45 clear sightline samples. The
  same check projects the building vertices and confirms that all five destinations fit inside the
  review frame.
- The [rebuild check](renders/rebuild-check.json) confirms that rebuilding the Codex preserves the
  other assets, custom-object hierarchy, and material adjustments. Export preserves the authoring
  geometry.
- The [WebGPU validation](renders/validation-webgpu-final.json) and
  [WebGL2 validation](renders/validation-webgl2-final.json) record repeated asset reloads and
  treatment changes. Their resource counts remain stable after the initial allocation.

## Delivery cost

The [export audit](renders/export-audit.json) records 69,052 triangles across seven GLBs. The files
total about 10.1MiB and produce 48 material groups in the preview. The viewer shares seven 1024 ×
1024 paint textures across the assets. Shadows, fog, bloom, and the optional ink pass add draw calls
beyond those material groups.

The validation captures include frame intervals and three.js memory reports for the Windows browser.
These describe this workstation and preview configuration; frame interval includes browser
scheduling and is not a direct GPU measurement.

## Decisions for the next review

1. Assess the building proportions from the court camera, especially the Codex fins and the
   workshop's drum-to-hall relationship.
2. Compare the sparse paint scuffs with the texture reference. Their size and contrast are
   independent of the geometry.
3. Compare the concept treatment with the original viewer influence. Fog density, ink weight, bloom,
   and exposure have separate controls.

The Codex uses mirrored tall front panels and paired lower windows. The bazaar sits one metre
farther forward to expose the workshop doorway. Those choices remain editable in the source scene.
