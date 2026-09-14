import CameraControls from 'camera-controls';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three/webgpu';
import { PRESETS, buildTreatment } from './treatments.mjs';

CameraControls.install({ THREE });
const params = new URLSearchParams(location.search);
const forceWebGL = params.get('backend') === 'webgl';
const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);
await renderer.init();

const scene = new THREE.Scene();
const environmentRoom = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(environmentRoom);
environmentRoom.dispose();
pmrem.dispose();
scene.environment = environment.texture;
const perspectiveCamera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.5, 500);
const planCamera = new THREE.OrthographicCamera(-40, 40, 25, -25, 0.5, 500);
let camera = perspectiveCamera;
const controls = new CameraControls(camera, renderer.domElement);
const loader = new GLTFLoader();
const loaded = new Map();
const lighting = new THREE.Group();
scene.add(lighting);
let manifest;
let revision = null;
let busy = false;
let subject = params.get('asset') ?? 'court';
let treatment = params.get('treatment') ?? 'neutral';
let cameraName = params.get('camera') ?? 'Court';
let lastTime = performance.now();
let frames = [];
let treatmentPipeline = null;
let savedSettings = {};
try {
  savedSettings = JSON.parse(localStorage.getItem('respite-treatments-v1') ?? '{}');
} catch {}
const info = document.querySelector('#info');
document.querySelector('#subject').value = subject;
document.querySelector('#treatment').value = treatment;
document.querySelector('#camera').value = cameraName;
if (params.has('capture')) {
  document.body.classList.add('capture');
}

function disposeGroup(group) {
  const resources = new Set();
  group.traverse((object) => {
    if (!object.isMesh) {
      return;
    }
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) {
          resources.add(value);
        }
      }
    }
  });
  for (const resource of resources) {
    resource.dispose();
  }
}

function applyPlacement(entry, group) {
  group.position.fromArray(entry.position);
  group.rotation.set(0, entry.rotationY, 0);
  group.scale.fromArray(entry.scale);
}

async function refreshAssets(force = false) {
  if (busy) {
    return;
  }
  busy = true;
  try {
    const response = await fetch('/exports/scene.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Export manifest missing');
    }
    const next = await response.json();
    if (!force && next.revision === revision) {
      return;
    }
    const results = await Promise.allSettled(
      next.assets.map(async (entry) => {
        const gltf = await loader.loadAsync(`/exports/${entry.file}?v=${next.revision}`);
        const group = gltf.scene;
        group.userData.assetID = entry.id;
        group.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = entry.id !== 'ground';
            object.receiveShadow = true;
          }
        });
        return [entry.id, group];
      }),
    );
    const replacements = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) {
      for (const [, group] of replacements) {
        disposeGroup(group);
      }
      throw failure.reason;
    }
    const sharedTextures = new Map();
    for (const [, group] of replacements) {
      group.traverse((object) => {
        if (!object.isMesh) {
          return;
        }
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          for (const [slot, value] of Object.entries(material)) {
            if (!value?.isTexture || !value.name) {
              continue;
            }
            const key = [
              value.name,
              value.colorSpace,
              value.wrapS,
              value.wrapT,
              value.flipY,
              ...value.repeat.toArray(),
              ...value.offset.toArray(),
            ].join(':');
            const shared = sharedTextures.get(key);
            if (shared && shared !== value) {
              material[slot] = shared;
              value.dispose();
            } else {
              sharedTextures.set(key, value);
            }
          }
        }
      });
    }
    for (const group of loaded.values()) {
      scene.remove(group);
      disposeGroup(group);
    }
    loaded.clear();
    for (const [key, group] of replacements) {
      loaded.set(key, group);
      scene.add(group);
    }
    manifest = next;
    revision = next.revision;
    applyView(true);

    // r185 binds geometry cleanup to the first pass's attributes. Initialize with
    // the colour pass before depth-only shadows omit the UV buffers from cleanup.
    renderer.shadowMap.enabled = false;
    try {
      renderer.render(scene, camera);
    } finally {
      renderer.shadowMap.enabled = true;
    }
    globalThis.respite.ready = true;
    globalThis.respite.error = null;
  } catch (error) {
    info.textContent = String(error);
    console.error(error);
    globalThis.respite.error = String(error);
  } finally {
    busy = false;
  }
}

function applyLighting() {
  treatmentPipeline?.dispose();
  disposeGroup(lighting);
  while (lighting.children.length > 0) {
    const [child] = lighting.children;
    lighting.remove(child);
    child.dispose?.();
  }
  const settings = { ...PRESETS[treatment], ...savedSettings[treatment] };
  treatmentPipeline = buildTreatment(
    scene,
    camera,
    renderer,
    lighting,
    loaded,
    subject,
    treatment,
    settings,
  );
  for (const key of Object.keys(PRESETS.neutral)) {
    document.querySelector(`#${key}`).value = settings[key];
    document.querySelector(`#${key}-value`).value = settings[key].toFixed(2);
    document.querySelector(`#${key}`).disabled = treatment === 'neutral' && key !== 'exposure';
  }
}

function applyView(resetCamera = false) {
  for (const entry of manifest.assets) {
    const group = loaded.get(entry.id);
    group.visible = subject === 'court' || entry.id === subject || entry.id === 'ground';
    if (entry.id === subject && subject !== 'court') {
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      group.scale.set(1, 1, 1);
    } else {
      applyPlacement(entry, group);
    }
  }
  if (!resetCamera) {
    applyLighting();
    return;
  }
  camera = subject === 'court' && cameraName === 'Plan' ? planCamera : perspectiveCamera;
  planCamera.up.set(0, 0, -1);
  perspectiveCamera.up.set(0, 1, 0);
  controls.camera = camera;
  if (subject === 'court') {
    const state = manifest.cameras[cameraName];
    if (camera.isOrthographicCamera) {
      const halfWidth = state.orthoScale / 2;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfWidth / (innerWidth / innerHeight);
      camera.bottom = -camera.top;
    } else {
      camera.fov = state.fov;
    }
    updateCameraAspect();
    controls.setLookAt(...state.position, ...state.target, false);
  } else {
    const bounds = new THREE.Box3().setFromObject(loaded.get(subject));
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 1.65;
    updateCameraAspect();
    controls.setLookAt(
      center.x + radius * 0.7,
      center.y + radius * 0.55,
      center.z + radius,
      ...center.toArray(),
      false,
    );
  }
  applyLighting();
}

function updateCameraAspect() {
  const aspect = innerWidth / innerHeight;
  if (camera.isPerspectiveCamera) {
    const sourceCamera = subject === 'court' ? manifest.cameras[cameraName] : null;
    const sourceFOV = sourceCamera?.fov ?? 36;
    const sourceAspect = sourceCamera?.aspect ?? 1.6;
    camera.aspect = aspect;
    const expansion = Math.max(1, sourceAspect / aspect);
    const halfAngle = THREE.MathUtils.degToRad(sourceFOV) / 2;
    const expandedAngle = 2 * Math.atan(Math.tan(halfAngle) * expansion);
    camera.fov = THREE.MathUtils.radToDeg(expandedAngle);
  } else {
    camera.top = camera.right / aspect;
    camera.bottom = -camera.top;
  }
  camera.updateProjectionMatrix();
}

function collectDiagnostics() {
  const totals = { triangles: 0, meshes: 0 };
  const materials = new Set();
  const textures = new Set();
  const assets = [];
  for (const [id, group] of loaded) {
    const box = new THREE.Box3().setFromObject(group);
    assets.push({
      id,
      visible: group.visible,
      bounds: { min: box.min.toArray(), max: box.max.toArray() },
    });
    group.traverse((object) => {
      if (!object.isMesh) {
        return;
      }
      if (group.visible) {
        totals.meshes++;
        totals.triangles +=
          (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture) {
            textures.add(value);
          }
        }
      }
    });
  }
  return {
    backend: renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2',
    subject,
    treatment,
    revision,
    meshes: totals.meshes,
    triangles: totals.triangles,
    materials: materials.size,
    textures: textures.size,
    assets,
    memory: { ...renderer.info.memory },
    render: { ...renderer.info.render },
    frameMs: frames.length > 0 ? frames.reduce((a, b) => a + b, 0) / frames.length : null,
    viewport: { width: innerWidth, height: innerHeight, pixelRatio: renderer.getPixelRatio() },
    settings: { ...PRESETS[treatment], ...savedSettings[treatment] },
    exportBytes: manifest.assets.reduce((sum, a) => sum + a.bytes, 0),
  };
}

globalThis.respite = {
  ready: false,
  diagnostics: collectDiagnostics,
  reload: () => refreshAssets(true),
  setView: (asset, preset, view = 'Court') => {
    subject = asset;
    treatment = preset;
    cameraName = view;
    applyView(true);
    document.querySelector('#subject').value = subject;
    document.querySelector('#treatment').value = treatment;
    document.querySelector('#camera').value = cameraName;
  },
  setSettings: (values) => {
    savedSettings[treatment] = { ...savedSettings[treatment], ...values };
    applyLighting();
  },
  captureMode: (enabled) => document.body.classList.toggle('capture', enabled),
  resetFrameStats: () => {
    frames = [];
    lastTime = performance.now();
  },
  renderer,
  scene,
  get camera() {
    return camera;
  },
};

document.querySelector('#subject').addEventListener('change', (event) => {
  subject = event.target.value;
  applyView(true);
});
document.querySelector('#treatment').addEventListener('change', (event) => {
  treatment = event.target.value;
  applyView(false);
});
document.querySelector('#camera').addEventListener('change', (event) => {
  cameraName = event.target.value;
  applyView(true);
});
document.querySelector('#reset').addEventListener('click', () => applyView(true));
document.querySelector('#reload').addEventListener('click', () => refreshAssets(true));
function updateSetting(event) {
  const key = event.target.id;
  savedSettings[treatment] = { ...savedSettings[treatment], [key]: Number(event.target.value) };
  localStorage.setItem('respite-treatments-v1', JSON.stringify(savedSettings));
  applyLighting();
}
for (const key of Object.keys(PRESETS.neutral)) {
  document.querySelector(`#${key}`).addEventListener('change', updateSetting);
}
document.querySelector('#reset-treatment').addEventListener('click', () => {
  delete savedSettings[treatment];
  localStorage.setItem('respite-treatments-v1', JSON.stringify(savedSettings));
  applyLighting();
});
addEventListener('resize', () => {
  updateCameraAspect();
  renderer.setSize(innerWidth, innerHeight);
});
await refreshAssets();
setInterval(() => refreshAssets(), 1500);
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  controls.update(delta);
  treatmentPipeline?.render();
  frames.push(delta * 1000);
  if (frames.length > 120) {
    frames.shift();
  }
});
setInterval(() => {
  if (!manifest) {
    return;
  }
  const d = collectDiagnostics();
  info.textContent = `${d.backend} · ${subject} · ${treatment}\n${d.meshes} meshes · ${Math.round(d.triangles).toLocaleString()} triangles · ${d.textures} textures\n${d.frameMs?.toFixed(1)} ms/frame · ${(d.exportBytes / 1_048_576).toFixed(1)} MiB exports`;
}, 1000);
