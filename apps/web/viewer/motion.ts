/**
 * Skyline motion: distant pulsing light shafts and the skybox streak fleet — animated parts of
 * the skybox, distant shooting stars. Both are fog-exempt: scene fog flattens anything past
 * fogFar to fog color, so these materials opt out. The flicker material feeds the stage's
 * window slice.
 */
import { color, materialColor, mix, float, mx_noise_float, positionWorld, time, uv, vec3 } from 'three/tsl';
import {
  AdditiveBlending,
  BoxGeometry,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  type Scene,
} from 'three/webgpu';
import { motionKnobs, motionState } from './knobs';
import { sceneAnimations } from './lifecycle';
import { GATE_TEAL, SIGNAL_VIOLET, WARM_WINDOW_SOFT } from './palette';

interface RaySpec {
  readonly color: string;
  readonly height: number;
  readonly phase: number;
  readonly width: number;
  readonly x: number;
  readonly z: number;
}

/** Far light shafts: bases hidden behind the skyline, tops pulsing above it out of phase. */
const RAY_SPECS: ReadonlyArray<RaySpec> = [
  { color: GATE_TEAL, height: 40, phase: 0, width: 5.5, x: -65, z: -95 },
  { color: SIGNAL_VIOLET, height: 50, phase: 1.7, width: 8, x: -30, z: -110 },
  { color: GATE_TEAL, height: 35, phase: 3.1, width: 4.5, x: 7.5, z: -100 },
  { color: SIGNAL_VIOLET, height: 55, phase: 4.4, width: 6.5, x: 40, z: -115 },
  { color: GATE_TEAL, height: 42.5, phase: 5.6, width: 5, x: 75, z: -95 },
];

export function addRays(scene: Scene) {
  for (const ray of RAY_SPECS) {
    // fog would swallow the shaft color at this distance — these are sky, not scenery
    const rayMaterial = new MeshBasicNodeMaterial({
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: DoubleSide,
      transparent: true,
    });
    const vertical = uv().y.oneMinus().pow(1.6);
    const sideFade = uv().x.mul(uv().x.oneMinus()).mul(4);
    const pulse = time.mul(0.25).add(ray.phase).sin().mul(0.35).add(0.65);

    rayMaterial.colorNode = color(ray.color);
    rayMaterial.opacityNode = vertical.mul(sideFade).mul(pulse).mul(motionKnobs.rays);

    const shaft = new Mesh(new PlaneGeometry(ray.width, ray.height), rayMaterial);

    shaft.position.set(ray.x, 10 + ray.height / 2, ray.z);
    scene.add(shaft);
  }
}

export function addStreaks(scene: Scene) {
  const streakGeometry = new BoxGeometry(8.5, 0.4, 0.4);
  const streakMaterials = [SIGNAL_VIOLET, GATE_TEAL, WARM_WINDOW_SOFT, '#dbeafe'].map((streakColor) => {
    // beyond the fog far distance every fogged material flattens to fog color — exempt these
    const material = new MeshBasicNodeMaterial({ fog: false });

    material.colorNode = color(streakColor).mul(3.2).mul(motionKnobs.streaks);

    return material;
  });

  for (let index = 0; index < 18; index += 1) {
    const material = streakMaterials[index % streakMaterials.length];

    if (!material) {
      continue;
    }

    const streak = new Mesh(streakGeometry, material);
    const streakY = 32.5 + ((index * 37) % 50);
    const streakZ = -150 - ((index * 13) % 62.5);
    const period = 8 + ((index * 7.1) % 26);
    // wide per-streak speed spread: crossings from darting (~2.5s) to drifting (~11.5s)
    const travel = 2.5 + ((index * 5.3) % 9);
    const offset = index * 7.7;
    const direction = index % 2 === 0 ? 1 : -1;
    // each streak sinks a little as it crosses, like a slow shooting star
    const sink = 2.5 + ((index * 11) % 7.5);

    streak.scale.x = 0.8 + ((index * 3) % 4) * 0.3;
    streak.position.set(0, streakY, streakZ);
    streak.visible = false;
    scene.add(streak);
    sceneAnimations.push((elapsed) => {
      const phase = (elapsed * motionState.streakSpeed + offset) % period;
      const progress = phase / travel;
      const crossing = progress < 1;

      streak.visible = crossing;

      if (crossing) {
        // distance scales depth, height, and crossing span together so the fleet still spans
        // the whole sky however far back it sits
        const distance = motionState.streakDistance;
        const spanHalf = (65 + Math.abs(streakZ) * distance) * 0.66;

        streak.position.x = direction * (progress * 2 * spanHalf - spanHalf);
        streak.position.y = (streakY - progress * sink) * (0.75 + 0.25 * distance);
        streak.position.z = streakZ * distance;
      }
    });
  }
}

/**
 * One shared node graph for window flicker: each window's world position seeds its own waver
 * and rare deep drop. Clone per window and set the clone's color.
 */
export function makeFlickerMaterialBase(): MeshBasicNodeMaterial {
  const flickerBase = new MeshBasicNodeMaterial();
  const slow = mx_noise_float(
    vec3(positionWorld.x.mul(1.24), positionWorld.y.mul(1.24).add(positionWorld.z.mul(1.08)), time.mul(1.6)),
  )
    .mul(0.5)
    .add(0.5);
  const drop = mx_noise_float(vec3(positionWorld.x.mul(0.68), positionWorld.z.mul(0.76), time.mul(0.35)))
    .mul(0.5)
    .add(0.5)
    .smoothstep(0.7, 0.78);
  const flick = slow.mul(0.55).add(0.6).mul(drop.oneMinus().mul(0.95).add(0.05));

  flickerBase.colorNode = materialColor.mul(mix(float(1), flick, motionKnobs.flicker));

  return flickerBase;
}
