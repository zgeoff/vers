/**
 * The asset gym: one model at real-world scale, orbitable, judged in the renderer under either
 * the canon night rig or a neutral inspection rig, beside a 1.8 m reference figure. No scene
 * fog — nothing between the eye and the asset.
 */
import { color } from 'three/tsl';
import {
  AmbientLight,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardNodeMaterial,
  Scene,
  SphereGeometry,
} from 'three/webgpu';
import { trackBuiltScene } from './lifecycle';
import { getModel } from './models';
import { NIGHT_AMBIENT, NIGHT_KEY, NIGHT_SKY } from './palette';
import { buildGrain } from './surfaces';

export type GymLighting = 'neutral' | 'night';

export interface GymFrame {
  readonly radius: number;
  readonly scene: Scene;
  readonly targetY: number;
}

export function buildGymScene(modelName: string | null, lighting: GymLighting): GymFrame {
  const scene = new Scene();

  trackBuiltScene(scene);

  if (lighting === 'night') {
    scene.background = new Color(NIGHT_SKY);

    const ambient = new AmbientLight(new Color(NIGHT_AMBIENT), 0.84);
    const key = new DirectionalLight(new Color(NIGHT_KEY), 1.92);
    const bounce = new HemisphereLight(new Color(NIGHT_AMBIENT), new Color('#54402e'), 1.05);

    key.position.set(-30, 42, 26);
    scene.add(ambient, key, bounce);
  } else {
    scene.background = new Color('#3a4150');

    const hemisphere = new HemisphereLight(new Color('#cfd6e6'), new Color('#8a7f72'), 1.2);
    const sun = new DirectionalLight(new Color('#ffffff'), 2.2);
    const fill = new AmbientLight(new Color('#aab2c4'), 0.4);

    sun.position.set(-18, 24, 14);
    scene.add(hemisphere, sun, fill);
  }

  const groundBase = new Color(lighting === 'night' ? '#2a3046' : '#565d70');
  const groundMaterial = new MeshStandardNodeMaterial({ color: groundBase, roughness: 0.9 });

  groundMaterial.colorNode = color(groundBase).mul(buildGrain(0.03).add(1));

  const disc = new Mesh(new CircleGeometry(150, 64), groundMaterial);

  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.01;
  scene.add(disc);

  const entry = modelName ? getModel(modelName) : undefined;
  let halfWidth = 1.5;
  let maxDimension = 3;
  let modelHeight = 2;

  if (entry) {
    const model = entry.group.clone(true);

    scene.add(model);
    halfWidth = Math.max(entry.bounds.max.x, -entry.bounds.min.x);
    modelHeight = entry.bounds.max.y - entry.bounds.min.y;
    maxDimension = Math.max(
      entry.bounds.max.x - entry.bounds.min.x,
      modelHeight,
      entry.bounds.max.z - entry.bounds.min.z,
    );
  }

  addReferenceFigure(scene, halfWidth + 1.4);

  return {
    radius: Math.max(7, maxDimension * 1.7),
    scene,
    targetY: modelHeight * 0.45,
  };
}

/** A 1.8 m human silhouette — the scale truth every asset is judged against. */
function addReferenceFigure(scene: Scene, x: number) {
  const material = new MeshStandardNodeMaterial({ color: new Color('#d7a866'), roughness: 0.8 });
  const body = new Mesh(new CylinderGeometry(0.18, 0.22, 1.44, 16), material);
  const head = new Mesh(new SphereGeometry(0.16, 16, 12), material);

  body.position.set(x, 0.72, 0);
  head.position.set(x, 1.64, 0);
  scene.add(body, head);
}
