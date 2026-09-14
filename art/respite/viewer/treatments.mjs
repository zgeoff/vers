import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
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
  renderOutput,
  screenSize,
  screenUV,
  texture,
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
  const rig = {
    neutral: { environment: 0.24, ambient: 1.5, key: 2.4, fill: 0.7 },
    legacy: { environment: 0.07, ambient: 0.34, key: 0.85, fill: 0.2 },
    concept: { environment: 0.05, ambient: 0.22, key: 0.58, fill: 0.13 },
  }[preset];
  renderer.toneMappingExposure = settings.exposure;
  const backgroundColor = neutral ? '#333d50' : '#080c20';
  scene.background = new THREE.Color(backgroundColor);
  scene.fog = null;
  scene.fogNode = null;
  scene.environmentIntensity = rig.environment;
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
  const ambientIntensity = rig.ambient;
  const ambient = new THREE.HemisphereLight(ambientColor, '#252432', ambientIntensity);
  const keyColor = neutral ? '#fff3e5' : '#829ceb';
  const keyIntensity = rig.key;
  const key = new THREE.DirectionalLight(keyColor, keyIntensity);
  key.position.set(-25, 40, 20);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, far: 160 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  lighting.add(ambient, key);
  const fillColor = neutral ? '#9aabdf' : '#6b589b';
  const fillIntensity = rig.fill;
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
  const outputTarget = new THREE.RenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  const finalPipeline = new THREE.RenderPipeline(renderer, fxaa(texture(outputTarget.texture)));
  const bufferSize = new THREE.Vector2();
  pipeline.outputNode = renderOutput(combined, renderer.toneMapping, renderer.outputColorSpace);
  pipeline.outputColorTransform = false;
  finalPipeline.outputColorTransform = false;
  return {
    render() {
      if (edgeCamera) {
        edgeCamera.copy(camera);
        edgeCamera.layers.set(0);
      }
      renderer.getDrawingBufferSize(bufferSize);
      if (outputTarget.width !== bufferSize.x || outputTarget.height !== bufferSize.y) {
        outputTarget.setSize(bufferSize.x, bufferSize.y);
      }
      const previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(outputTarget);
      try {
        pipeline.render();
      } finally {
        renderer.setRenderTarget(previousTarget);
      }
      finalPipeline.render();
    },
    dispose() {
      pipeline.dispose();
      finalPipeline.dispose();
      outputTarget.dispose();
      for (const resource of resources) {
        resource.dispose();
      }
    },
  };
}

function createDestinationLights(group, loaded, subject, legacy) {
  const emitters = {
    codex: [
      [[0, 2.6, 6.5], '#ffe3b4', 18],
      [[-3.5, 4.7, 6], '#be7dff', 10],
    ],
    stash: [[[0, 3.5, 6.6], '#ffe8c2', 27]],
    workshop: [
      [[-3.5, 2.7, 6.7], '#ffd5a0', 17],
      [[2, 3.5, 7.1], '#ff641f', 20],
    ],
    bazaar: [
      [[0, 2.2, 0], '#d697ff', 24],
      [[-2.7, 2.3, 0], '#ffe0b4', 9],
      [[2.7, 2.3, 0], '#ffd6a4', 9],
      [[0, 2.4, -2.4], '#ffe0b4', 12],
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
