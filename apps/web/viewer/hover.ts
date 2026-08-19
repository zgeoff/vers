/**
 * Hover interactivity: the nav buildings are the menu. A hover lifts the building's emissive
 * subtly and shows its prebuilt inverted-hull halo — additive teal behind the silhouette,
 * spread into an outer glow by the bloom pass. Hulls live on the ink-exempt layer so the halo
 * never gets outlined.
 */
import { color, normalLocal, positionLocal } from 'three/tsl';
import { AdditiveBlending, BackSide, Color, type Group, type Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { persistentResources } from './lifecycle';
import { GATE_TEAL } from './palette';

export const hoverPickBoxes: Array<Mesh> = [];
export const hoverMaterials: Record<string, Array<{ emissive: Color }>> = {};
export const hoverHulls: Record<string, Group> = {};

/**
 * Procedural/placeholder parts inflate by scaling their centered unit geometry; authored
 * models push along their normals instead, because their mesh origins sit at the model root
 * where center-scaling would displace the shell.
 */
export const hoverHullPartsMaterial = new MeshBasicNodeMaterial({
  blending: AdditiveBlending,
  depthWrite: false,
  opacity: 0.5,
  side: BackSide,
  transparent: true,
});

hoverHullPartsMaterial.colorNode = color(GATE_TEAL).mul(1.6);

export const hoverHullModelMaterial = new MeshBasicNodeMaterial({
  blending: AdditiveBlending,
  depthWrite: false,
  opacity: 0.5,
  side: BackSide,
  transparent: true,
});

hoverHullModelMaterial.colorNode = color(GATE_TEAL).mul(1.6);
hoverHullModelMaterial.positionNode = positionLocal.add(normalLocal.mul(0.28));
persistentResources.add(hoverHullPartsMaterial);
persistentResources.add(hoverHullModelMaterial);

/** Wiped by every scene build before it registers its own pick boxes, materials, and hulls. */
export function resetHoverRegistry() {
  hoverPickBoxes.length = 0;

  for (const key of Object.keys(hoverMaterials)) {
    delete hoverMaterials[key];
  }

  for (const key of Object.keys(hoverHulls)) {
    delete hoverHulls[key];
  }
}

const HOVER_LIFT = new Color(0.025, 0.045, 0.04);
const hoverRestore: Array<[{ emissive: Color }, Color]> = [];

let hoveredKey: string | null = null;

export function getHoveredKey(): string | null {
  return hoveredKey;
}

export function applyHoverGlow(key: string | null, canvas: HTMLElement) {
  for (const [hoverMaterial, previous] of hoverRestore) {
    hoverMaterial.emissive.copy(previous);
  }

  hoverRestore.length = 0;
  hoveredKey = key;
  canvas.style.cursor = key ? 'pointer' : '';

  for (const [hullKey, hull] of Object.entries(hoverHulls)) {
    hull.visible = hullKey === key;
  }

  if (key) {
    for (const hoverMaterial of new Set(hoverMaterials[key] ?? [])) {
      hoverRestore.push([hoverMaterial, hoverMaterial.emissive.clone()]);
      hoverMaterial.emissive.add(HOVER_LIFT);
    }
  }
}
