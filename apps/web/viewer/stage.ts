/**
 * The stage: the composed Respite scene, built entirely from the placements file and the model
 * registry. Authored assets enter only as GLBs; a slot without a file renders as a placeholder
 * box so the composition and hover menu stay testable. Background blocks, windows, skyline
 * motion, atmosphere, and the grade treatment reproduce the settled night look.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
} from 'three/webgpu';
import { addAtmosphere, type SmokeAnchor } from './atmosphere';
import {
  hoverHulls,
  hoverHullModelMaterial,
  hoverHullPartsMaterial,
  hoverMaterials,
  hoverPickBoxes,
  resetHoverRegistry,
} from './hover';
import { liveRefs } from './knobs';
import { persistentResources, trackBuiltScene } from './lifecycle';
import { getModel } from './models';
import { addRays, addStreaks, makeFlickerMaterialBase } from './motion';
import {
  BUILDING_LIT,
  COLD_INSTRUMENT,
  NIGHT_AMBIENT,
  NIGHT_FOG,
  NIGHT_GROUND,
  NIGHT_KEY,
  NIGHT_SKY,
  SIGNAL_TEAL,
  SIGNAL_VIOLET,
  WARM_WINDOW,
  WARM_WINDOW_SOFT,
  WINDOW_DARK,
} from './palette';
import { applyGroundSurface, applyGrounding } from './surfaces';
import type { BlockPlacement, ModelPlacement, PlacementsFile } from './types';
import { makeRandom, toWorldOffset } from './util';

const dummy = new Object3D();

// shared across every build, so it must survive the teardown that disposes a scene's geometry
const boxGeometry = new BoxGeometry(1, 1, 1);

persistentResources.add(boxGeometry);

/** Local-frame vent mouths on the slots that carry rooftop machinery. */
const SMOKE_SOURCES = [
  { height: 12.5, key: 'market', rise: 0.3, seed: 31, width: 6.5, x: -4, z: -1.25 },
  { height: 10, key: 'stash', rise: 0.24, seed: 37, width: 5, x: 6.5, z: 0 },
];

export function buildStageScene(placements: PlacementsFile): Scene {
  const scene = new Scene();

  trackBuiltScene(scene);
  resetHoverRegistry();
  scene.background = new Color(NIGHT_SKY);
  scene.fog = new Fog(new Color(NIGHT_FOG), 65, 340);

  const ambient = new AmbientLight(new Color(NIGHT_AMBIENT), 0.84);
  const key = new DirectionalLight(new Color(NIGHT_KEY), 1.92);
  const bounce = new HemisphereLight(new Color(NIGHT_AMBIENT), new Color('#54402e'), 1.05);

  key.position.set(-75, 105, 65);
  scene.add(ambient, key, bounce);
  liveRefs.fog = scene.fog as Fog;
  liveRefs.ambient = ambient;
  liveRefs.keyLight = key;
  liveRefs.bounce = bounce;

  addGroundPlanes(scene);
  addBlocks(scene, placements.blocks);
  addModelSlots(scene, placements.models);
  addWindowEmissives(scene, placements.blocks);
  addRays(scene);
  addStreaks(scene);

  const smokeAnchors: Array<SmokeAnchor> = [];

  for (const source of SMOKE_SOURCES) {
    const slot = placements.models.find((entry) => entry.key === source.key);

    if (!slot) {
      continue;
    }

    const world = toWorldOffset(slot.x, slot.z, slot.ry, source.x, source.z);
    const roof = slotHeight(slot);

    smokeAnchors.push({
      height: source.height,
      rise: source.rise,
      seed: source.seed,
      width: source.width,
      x: world.x,
      y: roof,
      z: world.z,
    });
  }

  addAtmosphere(scene, { smokeAnchors });

  return scene;
}

function slotHeight(slot: ModelPlacement): number {
  const entry = slot.file ? getModel(slot.file) : undefined;

  if (entry) {
    return (entry.bounds.max.y - entry.bounds.min.y) * slot.scale;
  }

  return slot.size?.[1] ?? 10;
}

function addGroundPlanes(scene: Scene) {
  const groundBase = new Color(NIGHT_GROUND);
  const groundMaterial = new MeshStandardNodeMaterial({ color: groundBase, roughness: 0.6 });

  applyGroundSurface(groundMaterial, groundBase);

  // large enough that its edges sit past full fog from any camera the viewer uses
  const ground = new Mesh(new PlaneGeometry(2000, 2000), groundMaterial);

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  scene.add(ground);

  // the paved plaza, skewed off the world axes so the square doesn't read as a perfect rectangle
  const plazaBase = new Color(NIGHT_GROUND).multiplyScalar(2.4);
  const plazaMaterial = new MeshStandardNodeMaterial({ color: plazaBase, roughness: 0.45 });

  applyGroundSurface(plazaMaterial, plazaBase);

  const plazaFloor = new Mesh(new PlaneGeometry(62.5, 52.5), plazaMaterial);

  plazaFloor.rotation.x = -Math.PI / 2;
  plazaFloor.rotation.z = 0.07;
  plazaFloor.position.set(2, 0.0125, -3.75);
  scene.add(plazaFloor);

  // a smaller apron spilling toward the gate, breaking the plaza's outline further
  const apron = new Mesh(
    new PlaneGeometry(22.5, 25),
    new MeshStandardNodeMaterial({
      color: new Color(NIGHT_GROUND).multiplyScalar(2.1),
      roughness: 0.5,
    }),
  );

  apron.rotation.x = -Math.PI / 2;
  apron.rotation.z = -0.12;
  apron.position.set(13.75, 0.01, -27.5);
  scene.add(apron);
}

function addBlocks(scene: Scene, blocks: ReadonlyArray<BlockPlacement>) {
  const blockMaterial = new MeshStandardNodeMaterial({ roughness: 0.85 });

  applyGrounding(blockMaterial);

  const litColor = new Color(BUILDING_LIT);
  const fillerColor = litColor.clone().multiplyScalar(0.6);
  const foreColor = litColor.clone().multiplyScalar(0.35);
  const meshes = new InstancedMesh(boxGeometry, blockMaterial, blocks.length);

  for (const [index, block] of blocks.entries()) {
    dummy.position.set(block.x, block.h / 2, block.z);
    dummy.rotation.set(0, block.ry, 0);
    dummy.scale.set(block.w, block.h, block.d);
    dummy.updateMatrix();
    meshes.setMatrixAt(index, dummy.matrix);
    meshes.setColorAt(
      index,
      block.role === 'filler' ? fillerColor : block.role === 'fore' ? foreColor : litColor,
    );
  }

  dummy.rotation.set(0, 0, 0);
  meshes.instanceMatrix.needsUpdate = true;
  meshes.computeBoundingSphere();
  scene.add(meshes);

  const masts = blocks.filter((block) => block.mast);
  const mastMesh = new InstancedMesh(
    boxGeometry,
    new MeshStandardNodeMaterial({ color: litColor.clone().multiplyScalar(0.7), roughness: 0.9 }),
    masts.length,
  );

  for (const [index, block] of masts.entries()) {
    dummy.position.set(block.x, block.h + 2.5, block.z);
    dummy.scale.set(0.3, 5.5, 0.3);
    dummy.updateMatrix();
    mastMesh.setMatrixAt(index, dummy.matrix);
  }

  mastMesh.instanceMatrix.needsUpdate = true;
  mastMesh.computeBoundingSphere();
  scene.add(mastMesh);
}

function addModelSlots(scene: Scene, models: ReadonlyArray<ModelPlacement>) {
  const pickMaterial = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false });

  for (const slot of models) {
    const entry = slot.file ? getModel(slot.file) : undefined;

    if (entry) {
      const model = entry.group.clone(true);

      model.scale.setScalar(slot.scale);
      model.position.set(slot.x, 0, slot.z);
      model.rotation.y = slot.ry;
      scene.add(model);

      if (slot.nav) {
        const slotHoverMaterials: Array<{ emissive: Color }> = [];

        model.traverse((child) => {
          const mesh = child as Mesh;

          if (mesh.isMesh) {
            const meshMaterial = mesh.material as { emissive?: Color };

            if (meshMaterial.emissive) {
              slotHoverMaterials.push(meshMaterial as { emissive: Color });
            }
          }
        });
        hoverMaterials[slot.key] = slotHoverMaterials;

        const hull = entry.group.clone(true);

        hull.traverse((child) => {
          const mesh = child as Mesh;

          if (mesh.isMesh) {
            mesh.material = hoverHullModelMaterial;
            mesh.layers.set(1);
          }
        });
        hull.scale.setScalar(slot.scale);
        hull.position.copy(model.position);
        hull.rotation.copy(model.rotation);
        hull.visible = false;
        scene.add(hull);
        hoverHulls[slot.key] = hull;
      }
    } else {
      // no asset yet: a placeholder box keeps the slot visible, hoverable, and draggable
      const [width, height, depth] = slot.size ?? [15, 10, 15];
      const material = new MeshStandardNodeMaterial({
        color: new Color(BUILDING_LIT).multiplyScalar(slot.key === 'fountain' ? 0.55 : 1.15),
        roughness: 0.85,
      });

      applyGrounding(material);

      const box = new Mesh(boxGeometry, material);

      box.position.set(slot.x, height / 2, slot.z);
      box.rotation.y = slot.ry;
      box.scale.set(width, height, depth);
      scene.add(box);

      if (slot.nav) {
        hoverMaterials[slot.key] = [material];

        const hull = new Group();
        const hullMesh = new Mesh(boxGeometry, hoverHullPartsMaterial);

        hullMesh.position.copy(box.position);
        hullMesh.rotation.copy(box.rotation);
        hullMesh.scale.copy(box.scale).multiplyScalar(1.05);
        hullMesh.layers.set(1);
        hull.add(hullMesh);
        hull.visible = false;
        scene.add(hull);
        hoverHulls[slot.key] = hull;
      }
    }

    if (slot.nav) {
      const pick = buildPickBox(slot, pickMaterial);

      scene.add(pick);
      hoverPickBoxes.push(pick);
    }
  }
}

/** An invisible raycast volume covering the slot: model bounds when loaded, size otherwise. */
function buildPickBox(slot: ModelPlacement, material: MeshBasicNodeMaterial): Mesh {
  const entry = slot.file ? getModel(slot.file) : undefined;

  if (entry) {
    const width = (entry.bounds.max.x - entry.bounds.min.x) * slot.scale;
    const height = (entry.bounds.max.y - entry.bounds.min.y) * slot.scale;
    const depth = (entry.bounds.max.z - entry.bounds.min.z) * slot.scale;
    const centerX = ((entry.bounds.max.x + entry.bounds.min.x) / 2) * slot.scale;
    const centerY = ((entry.bounds.max.y + entry.bounds.min.y) / 2) * slot.scale;
    const centerZ = ((entry.bounds.max.z + entry.bounds.min.z) / 2) * slot.scale;
    const world = toWorldOffset(slot.x, slot.z, slot.ry, centerX, centerZ);
    const pick = new Mesh(new BoxGeometry(width, height, depth), material);

    pick.position.set(world.x, centerY, world.z);
    pick.rotation.y = slot.ry;
    pick.userData['hoverKey'] = slot.key;

    return pick;
  }

  const [width, height, depth] = slot.size ?? [15, 10, 15];
  const pick = new Mesh(new BoxGeometry(width, height, depth), material);

  pick.position.set(slot.x, height / 2, slot.z);
  pick.rotation.y = slot.ry;
  pick.userData['hoverKey'] = slot.key;

  return pick;
}

interface EmissiveInstance {
  readonly color: Color;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Sodium warmth owns street level; teal/violet signals only join above it, so the square reads
 * human at eye height with the machine city climbing behind.
 */
function pickWindowColor(random: () => number, worldY: number, litChance: number): Color {
  if (random() > litChance) {
    return new Color(WINDOW_DARK);
  }

  const roll = random();

  if (worldY < 11.25) {
    const warm = roll < 0.85 ? WARM_WINDOW : WARM_WINDOW_SOFT;

    return new Color(warm).multiplyScalar(2.2);
  }

  if (roll < 0.6) {
    return new Color(WARM_WINDOW).multiplyScalar(2);
  }

  const signal = roll < 0.82 ? SIGNAL_TEAL : SIGNAL_VIOLET;

  return new Color(signal).multiplyScalar(2);
}

function collectBlockWindows(blocks: ReadonlyArray<BlockPlacement>): Array<EmissiveInstance> {
  const random = makeRandom(9001);
  const windows: Array<EmissiveInstance> = [];

  for (const block of blocks) {
    if (block.role === 'fore') {
      continue;
    }

    const litChance = block.role === 'filler' ? 0.105 : 0.14;
    const faceExtent = block.facing === 'pz' ? block.w : block.d;
    const cols = Math.max(1, Math.floor((faceExtent - 1.5) / 1.5));
    const rowCount = Math.max(1, Math.floor((block.h - 2) / 1.75));
    const step = cols > 1 ? (faceExtent - 2.25) / (cols - 1) : 0;

    for (let col = 0; col < cols; col += 1) {
      for (let row = 0; row < rowCount; row += 1) {
        const along = -(faceExtent - 2.25) / 2 + col * step;
        const y = block.h - 1.5 - row * 1.75;
        const windowColor = pickWindowColor(random, y, litChance);

        if (block.facing === 'pz') {
          const world = toWorldOffset(block.x, block.z, block.ry, along, block.d / 2 + 0.08);

          windows.push({ color: windowColor, x: world.x, y, z: world.z });
        } else {
          const lx = block.facing === 'px' ? block.w / 2 + 0.08 : -block.w / 2 - 0.08;
          const world = toWorldOffset(block.x, block.z, block.ry, lx, along);

          windows.push({ color: windowColor, x: world.x, y, z: world.z });
        }
      }
    }
  }

  return windows;
}

function addWindowEmissives(scene: Scene, blocks: ReadonlyArray<BlockPlacement>) {
  const windows = collectBlockWindows(blocks);

  // the cold instrument points above the masts join the steady set
  const instruments: Array<EmissiveInstance> = blocks
    .filter((block) => block.mast)
    .map((block) => ({
      color: new Color(COLD_INSTRUMENT).multiplyScalar(2),
      x: block.x,
      y: block.h + 5.25,
      z: block.z,
    }));

  // a slice of the windows flickers; everything else stays steady
  const isFlickerWindow = (index: number) => index % 4 === 1;
  const flickerWindows = windows.filter((_, index) => isFlickerWindow(index));
  const steady = [...windows.filter((_, index) => !isFlickerWindow(index)), ...instruments];
  const windowGeometry = new BoxGeometry(0.33, 0.5, 0.13);
  const emissiveMesh = new InstancedMesh(windowGeometry, new MeshBasicNodeMaterial(), steady.length);

  for (const [index, emissive] of steady.entries()) {
    dummy.position.set(emissive.x, emissive.y, emissive.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    emissiveMesh.setMatrixAt(index, dummy.matrix);
    emissiveMesh.setColorAt(index, emissive.color);
  }

  emissiveMesh.instanceMatrix.needsUpdate = true;
  emissiveMesh.computeBoundingSphere();
  scene.add(emissiveMesh);

  if (flickerWindows.length > 0) {
    const flickerBase = makeFlickerMaterialBase();

    for (const emissive of flickerWindows) {
      const material = flickerBase.clone();

      material.color.set(emissive.color);

      const windowMesh = new Mesh(windowGeometry, material);

      windowMesh.position.set(emissive.x, emissive.y, emissive.z);
      scene.add(windowMesh);
    }
  }
}
