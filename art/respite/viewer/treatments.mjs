import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  color,
  float,
  fog,
  mrt,
  mx_noise_float,
  normalView,
  output,
  pass,
  positionWorld,
  screenSize,
  screenUV,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import * as THREE from 'three/webgpu';

export const PRESETS = {
  neutral: { exposure: 1, fog: 0, bloom: 0, ink: 0 },
  concept: { exposure: 1, fog: 1, bloom: 0.3, ink: 0 },
  legacy: { exposure: 1.1, fog: 0.85, bloom: 0.4, ink: 0.4 },
};

export function buildTreatment(
  scene,
  camera,
  renderer,
  lighting,
  loaded,
  subject,
  preset,
  settings,
) {
  const neutral = preset === 'neutral';
  const legacy = preset === 'legacy';
  const isCourt = subject === 'court';
  renderer.toneMappingExposure = settings.exposure;
  const backgroundColor = neutral ? '#333d50' : '#080c20';
  scene.background = new THREE.Color(backgroundColor);
  scene.fog = null;
  scene.fogNode = null;
  scene.environmentIntensity = neutral ? 0.24 : 0.07;
  if (!neutral && isCourt) {
    const depth = positionWorld.z.negate().sub(9).div(72).clamp(0, 1).pow(1.3);
    const height = positionWorld.y.sub(10).div(60).clamp(0, 1);
    const fogColor = legacy ? '#27304b' : '#26315c';
    scene.fogNode = fog(
      color(fogColor),
      depth.mul(0.8).add(height.mul(0.2)).mul(settings.fog).clamp(0, 0.95),
    );
    createFogBanks(lighting, settings.fog, legacy);
  }
  const ambientColor = neutral ? '#cbd7f5' : '#788be7';
  const ambientIntensity = neutral ? 1.5 : 0.34;
  const ambient = new THREE.HemisphereLight(ambientColor, '#252432', ambientIntensity);
  const keyColor = neutral ? '#fff3e5' : '#829ceb';
  const keyIntensity = neutral ? 2.4 : 0.85;
  const key = new THREE.DirectionalLight(keyColor, keyIntensity);
  key.position.set(-25, 40, 20);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, far: 160 });
  key.shadow.bias = -0.0004;
  lighting.add(ambient, key);
  const fillColor = neutral ? '#9aabdf' : '#6b589b';
  const fillIntensity = neutral ? 0.7 : 0.2;
  const fill = new THREE.DirectionalLight(fillColor, fillIntensity);
  fill.position.set(30, 20, -10);
  lighting.add(fill);
  if (!neutral) {
    createDestinationLights(lighting, loaded, subject, legacy);
  }
  camera.layers.enable(1);
  if (neutral) {
    return { render: () => renderer.render(scene, camera), dispose() {} };
  }

  const scenePass = pass(scene, camera);
  const sceneColor = scenePass.getTextureNode();
  const glow = bloom(sceneColor, settings.bloom, 0.35, 1.05);
  const pipeline = new THREE.RenderPipeline(renderer);
  const resources = [scenePass, glow];
  let combined = sceneColor.add(glow);
  let edgeCamera = null;
  if (settings.ink > 0) {
    edgeCamera = camera.clone();
    edgeCamera.layers.set(0);
    const edgePass = pass(scene, edgeCamera);
    edgePass.setMRT(mrt({ normal: normalView, output }));
    resources.push(edgePass);
    const depth = edgePass.getTextureNode('depth');
    const normals = edgePass.getTextureNode('normal');
    const texel = vec2(renderer.getPixelRatio() * 0.7).div(screenSize);
    const getDepth = (x, y) => {
      const offset = texel.mul(vec2(x, y));
      return depth.sample(screenUV.add(offset)).x;
    };
    const getNormal = (x, y) => {
      const offset = texel.mul(vec2(x, y));
      return normals.sample(screenUV.add(offset)).xyz;
    };
    const center = getDepth(0, 0);
    const delta = getDepth(1, 0)
      .sub(center)
      .abs()
      .add(getDepth(-1, 0).sub(center).abs())
      .add(getDepth(0, 1).sub(center).abs())
      .add(getDepth(0, -1).sub(center).abs());
    const depthEdge = delta.div(float(1).sub(center).add(0.0005)).smoothstep(0.008, 0.016);
    const normal = getNormal(0, 0);
    const agreement = normal
      .dot(getNormal(1, 0))
      .add(normal.dot(getNormal(-1, 0)))
      .add(normal.dot(getNormal(0, 1)))
      .add(normal.dot(getNormal(0, -1)));
    const ink = depthEdge.max(float(4).sub(agreement).smoothstep(0.3, 0.55)).mul(settings.ink);
    combined = sceneColor.mul(ink.oneMinus()).add(glow);
  }
  const vignette = screenUV.sub(0.5).length().pow(2).mul(0.24).oneMinus();
  combined = combined.mul(vignette);
  if (legacy) {
    combined = combined.mul(vec3(1.05, 1, 0.94));
  }
  pipeline.outputNode = combined;
  return {
    render() {
      if (edgeCamera) {
        edgeCamera.copy(camera);
        edgeCamera.layers.set(0);
      }
      pipeline.render();
    },
    dispose() {
      pipeline.dispose();
      for (const resource of resources) {
        resource.dispose();
      }
    },
  };
}

function createDestinationLights(group, loaded, subject, legacy) {
  const emitters = {
    codex: [
      [[0, 2.6, 5.7], '#ffe3b4', 45],
      [[-3.5, 4.7, 5.7], '#be7dff', 25],
    ],
    stash: [[[0, 3.5, 5.9], '#ffe8c2', 65]],
    workshop: [
      [[-3.5, 2.7, 6.4], '#ffd5a0', 45],
      [[2, 3.5, 6.8], '#ff641f', 38],
    ],
    bazaar: [
      [[0, 3, 3], '#d697ff', 36],
      [[-2.5, 3.3, 0], '#ffe0b4', 28],
      [[2.5, 3.3, 0], '#ffd6a4', 28],
    ],
    exit: [
      [[0, 7, -2], '#48bcff', 320],
      [[-4, 3, 0], '#4ec4ff', 90],
      [[4, 3, 0], '#4ec4ff', 90],
    ],
  };
  for (const [id, entries] of Object.entries(emitters)) {
    if (subject !== 'court' && subject !== id) {
      continue;
    }
    const asset = loaded.get(id);
    if (!asset) {
      continue;
    }
    asset.updateWorldMatrix(true, false);
    for (const [position, tint, intensity] of entries) {
      const light = new THREE.PointLight(tint, intensity * (legacy ? 1.25 : 1), 17, 2);
      light.position.copy(asset.localToWorld(new THREE.Vector3(...position)));
      group.add(light);
    }
  }
}

function createFogBanks(group, strength, legacy) {
  const edge = uv().x.mul(uv().x.oneMinus()).mul(uv().y).mul(uv().y.oneMinus()).mul(16);
  for (const [index, z] of [-23, -39, -57].entries()) {
    const material = new THREE.MeshBasicNodeMaterial({
      color: legacy ? '#394361' : '#465797',
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const coord = vec3(positionWorld.x.mul(0.055), positionWorld.y.mul(0.11), index * 7 + 3);
    const warp = mx_noise_float(coord.mul(0.5)).mul(1.1);
    const body = mx_noise_float(coord.add(warp)).add(1).mul(0.5).smoothstep(0.4, 0.84);
    material.opacityNode = body.mul(edge).mul(0.42 * strength);
    const bank = new THREE.Mesh(new THREE.PlaneGeometry(140, 38), material);
    bank.position.set(-10, 17, z);
    bank.layers.set(1);
    group.add(bank);
  }
}
