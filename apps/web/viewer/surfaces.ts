/**
 * Procedural surface toolbox for the ground planes plus the grounding-occlusion node. Building
 * surfaces are authored in Blender now — only what has no asset (pavement, contact shadow)
 * stays procedural.
 */
import { color, mx_noise_float, positionWorld, vec3 } from 'three/tsl';
import type { Color, MeshStandardNodeMaterial } from 'three/webgpu';
import { groundKnobs, groundingKnobs } from './knobs';
import type { UniformKnob } from './tuner';

type Knob = number | UniformKnob;

/**
 * Grounding occlusion: ambient light falls off toward the base of every structure, faking
 * contact shadow where buildings meet the pavement. Applied via aoNode so emissives stay clean.
 */
const groundingNode = positionWorld.y
  .mul(groundingKnobs.falloff)
  .clamp(0, 1)
  .mul(groundingKnobs.depth)
  .add(groundingKnobs.depth.oneMinus());

export function applyGrounding(material: MeshStandardNodeMaterial) {
  material.aoNode = groundingNode;
}

export function buildGrain(amp: Knob = 0.04) {
  return mx_noise_float(positionWorld.mul(16)).mul(amp);
}

export function buildOrganic(scale: Knob, amp: Knob) {
  return mx_noise_float(positionWorld.mul(scale)).mul(amp);
}

/** Constant tone per quantized cell — the paneling tool. */
export function buildPanels(cellX: Knob, cellY: Knob, cellZ: Knob, amp: Knob) {
  const cell = vec3(
    positionWorld.x.mul(cellX).floor(),
    positionWorld.y.mul(cellY).floor(),
    positionWorld.z.mul(cellZ).floor(),
  );

  return mx_noise_float(cell.mul(0.37)).mul(amp);
}

/** Pavement: broad quiet pavers, soft wear mottle, crisp joints — calm underfoot, not graph paper. */
export function applyGroundSurface(material: MeshStandardNodeMaterial, base: Color) {
  const paver = buildPanels(groundKnobs.paverCell, 0.001, groundKnobs.paverCell, groundKnobs.paverAmp);
  const jointX = positionWorld.x.mul(groundKnobs.paverCell).fract();
  const jointZ = positionWorld.z.mul(groundKnobs.paverCell).fract();
  const joints = jointX
    .min(jointX.oneMinus())
    .min(jointZ.min(jointZ.oneMinus()))
    .smoothstep(0.0, 0.02)
    .oneMinus()
    .mul(groundKnobs.jointDepth);
  const wear = buildOrganic(groundKnobs.wearScale, groundKnobs.wearAmp);

  material.colorNode = color(base).mul(
    paver
      .sub(joints)
      .add(wear)
      .add(buildGrain(groundKnobs.grainAmp))
      .add(1)
      .clamp(groundKnobs.clampLo, groundKnobs.clampHi),
  );
}
