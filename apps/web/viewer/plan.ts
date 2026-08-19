/**
 * The entity placer: a flat top-down editor where every model slot and background block is its
 * own draggable group. Dragging writes straight into the placements data, so a save posts the
 * moved layout to disk. Footprints come from the loaded model bounds when an asset exists, so
 * the plan shows the real shape rather than a stand-in.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  PlaneGeometry,
  Scene,
} from 'three/webgpu';
import { persistentResources, trackBuiltScene } from './lifecycle';
import { getModel } from './models';
import { SIGNAL_TEAL } from './palette';
import type { ModelPlacement, PlacementsFile } from './types';
import { toWorldOffset } from './util';

export interface PlanGroup {
  readonly baseColor: string;
  readonly group: Group;
  readonly label: string;
  readonly material: MeshStandardNodeMaterial;
  readonly target: { ry: number; x: number; z: number };
}

export const PLAN_SELECTED_COLOR = SIGNAL_TEAL;

const PLAN_MODEL_COLOR = '#8fa0c2';

const PLAN_ROLE_COLORS: Record<string, string> = {
  back: '#333e58',
  filler: '#4d5975',
  fore: '#3a465f',
};

// shared across every build, so it must survive the teardown that disposes a scene's geometry
const boxGeometry = new BoxGeometry(1, 1, 1);

persistentResources.add(boxGeometry);

export function buildPlanScene(placements: PlacementsFile): {
  groups: Array<PlanGroup>;
  scene: Scene;
} {
  const scene = new Scene();

  trackBuiltScene(scene);
  scene.background = new Color('#181d2c');

  const ambient = new AmbientLight(new Color('#aab6d0'), 1.6);
  const key = new DirectionalLight(new Color('#8fa0c2'), 0.9);

  key.position.set(-14, 40, 20);
  scene.add(ambient, key);

  const ground = new Mesh(
    new PlaneGeometry(220, 220),
    new MeshStandardNodeMaterial({ color: new Color('#10141f'), roughness: 1 }),
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const plazaFloor = new Mesh(
    new PlaneGeometry(25, 21),
    new MeshStandardNodeMaterial({ color: new Color('#232b40'), roughness: 1 }),
  );

  plazaFloor.rotation.x = -Math.PI / 2;
  plazaFloor.rotation.z = 0.07;
  plazaFloor.position.set(0.8, -0.01, -1.5);
  scene.add(plazaFloor);

  const groups: Array<PlanGroup> = [];

  for (const slot of placements.models) {
    const material = new MeshStandardNodeMaterial({ color: new Color(PLAN_MODEL_COLOR), roughness: 0.9 });
    const group = new Group();
    const footprint = buildSlotFootprint(slot);
    const block = new Mesh(boxGeometry, material);

    block.position.set(footprint.cx, footprint.height / 2, footprint.cz);
    block.scale.set(footprint.width, footprint.height, footprint.depth);
    group.add(block);
    group.position.set(slot.x, 0, slot.z);
    group.rotation.y = slot.ry;
    scene.add(group);
    groups.push({ baseColor: PLAN_MODEL_COLOR, group, label: slot.key, material, target: slot });
  }

  for (const [index, block] of placements.blocks.entries()) {
    const baseColor = PLAN_ROLE_COLORS[block.role] ?? '#39445e';
    const material = new MeshStandardNodeMaterial({ color: new Color(baseColor), roughness: 1 });
    const group = new Group();
    const mesh = new Mesh(boxGeometry, material);

    mesh.position.set(0, block.h / 2, 0);
    mesh.scale.set(block.w, block.h, block.d);
    group.add(mesh);
    group.position.set(block.x, 0, block.z);
    group.rotation.y = block.ry;
    scene.add(group);
    groups.push({ baseColor, group, label: `${block.role}${index}`, material, target: block });
  }

  return { groups, scene };
}

interface SlotFootprint {
  readonly cx: number;
  readonly cz: number;
  readonly depth: number;
  readonly height: number;
  readonly width: number;
}

/** The slot's true scaled bounds when its asset is loaded, its declared size otherwise. */
function buildSlotFootprint(slot: ModelPlacement): SlotFootprint {
  const entry = slot.file ? getModel(slot.file) : undefined;

  if (entry) {
    return {
      cx: ((entry.bounds.max.x + entry.bounds.min.x) / 2) * slot.scale,
      cz: ((entry.bounds.max.z + entry.bounds.min.z) / 2) * slot.scale,
      depth: (entry.bounds.max.z - entry.bounds.min.z) * slot.scale,
      height: (entry.bounds.max.y - entry.bounds.min.y) * slot.scale,
      width: (entry.bounds.max.x - entry.bounds.min.x) * slot.scale,
    };
  }

  const [width, height, depth] = slot.size ?? [6, 4, 6];

  return { cx: 0, cz: 0, depth, height, width };
}

interface Footprint {
  readonly angle: number;
  readonly cx: number;
  readonly cz: number;
  readonly hd: number;
  readonly hw: number;
  readonly label: string;
  /** Vertical extent, so an overhang doesn't false-flag against a low block beneath it. */
  readonly y0: number;
  readonly y1: number;
}

/**
 * Every pair of intersecting footprints, as "market×stash"-style labels — the machine check
 * that replaces eyeballing the render. Background blocks touching each other is the overbuilt
 * accretion look, by design, so those pairs are exempt.
 */
export function findOverlaps(placements: PlacementsFile): Array<string> {
  const footprints = collectFootprints(placements);
  const seen = new Set<string>();

  for (let a = 0; a < footprints.length; a += 1) {
    for (let b = a + 1; b < footprints.length; b += 1) {
      const fa = footprints[a];
      const fb = footprints[b];

      if (!fa || !fb || fa.label === fb.label) {
        continue;
      }

      if (fa.label.startsWith('back') && fb.label.startsWith('back')) {
        continue;
      }

      const pair = [fa.label, fb.label].sort().join('×');

      if (!seen.has(pair) && isFootprintOverlap(fa, fb)) {
        seen.add(pair);
      }
    }
  }

  return [...seen].sort();
}

function collectFootprints(placements: PlacementsFile): Array<Footprint> {
  const footprints: Array<Footprint> = [];

  for (const slot of placements.models) {
    const shape = buildSlotFootprint(slot);
    const world = toWorldOffset(slot.x, slot.z, slot.ry, shape.cx, shape.cz);

    footprints.push({
      angle: slot.ry,
      cx: world.x,
      cz: world.z,
      hd: shape.depth / 2,
      hw: shape.width / 2,
      label: slot.key,
      y0: 0,
      y1: shape.height,
    });
  }

  for (const [index, block] of placements.blocks.entries()) {
    footprints.push({
      angle: block.ry,
      cx: block.x,
      cz: block.z,
      hd: block.d / 2,
      hw: block.w / 2,
      label: `${block.role}${index}`,
      y0: 0,
      y1: block.h,
    });
  }

  return footprints;
}

function isFootprintOverlap(a: Footprint, b: Footprint): boolean {
  if (a.y1 <= b.y0 || b.y1 <= a.y0) {
    return false;
  }

  const cornersA = buildCorners(a);
  const cornersB = buildCorners(b);

  for (const angle of [a.angle, b.angle]) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    if (
      isSeparatedOnAxis(cornersA, cornersB, cos, -sin) ||
      isSeparatedOnAxis(cornersA, cornersB, sin, cos)
    ) {
      return false;
    }
  }

  return true;
}

function buildCorners(footprint: Footprint): Array<[number, number]> {
  const cos = Math.cos(footprint.angle);
  const sin = Math.sin(footprint.angle);
  const corners: Array<[number, number]> = [];

  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const lx = sx * footprint.hw;
    const lz = sz * footprint.hd;

    corners.push([footprint.cx + lx * cos + lz * sin, footprint.cz - lx * sin + lz * cos]);
  }

  return corners;
}

function isSeparatedOnAxis(
  a: ReadonlyArray<[number, number]>,
  b: ReadonlyArray<[number, number]>,
  axisX: number,
  axisZ: number,
): boolean {
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;

  for (const [x, z] of a) {
    const projection = x * axisX + z * axisZ;

    minA = Math.min(minA, projection);
    maxA = Math.max(maxA, projection);
  }

  for (const [x, z] of b) {
    const projection = x * axisX + z * axisZ;

    minB = Math.min(minB, projection);
    maxB = Math.max(maxB, projection);
  }

  return maxA < minB || maxB < minA;
}
