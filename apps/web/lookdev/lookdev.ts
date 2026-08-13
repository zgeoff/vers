/**
 * Respite style probes — spike only, never merged to a shipping path.
 *
 * Three variants of one fixed-camera dusk composition, differing only in palette, atmosphere,
 * massing density, and emissive mix:
 *   1 sodium-terrace  (anchor A pure)
 *   2 sodium-quiet    (A crossed with F: sparser, darker, instrument lights)
 *   3 sodium-canyon   (A crossed with C: denser, signal color, heavier fog)
 */
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PostProcessing,
  Scene,
  WebGPURenderer,
} from 'three/webgpu';

interface WindowPaletteEntry {
  readonly color: string;
  readonly weight: number;
}

interface ProbeConfig {
  readonly ambient: string;
  readonly ambientIntensity: number;
  readonly bloomStrength: number;
  readonly bloomThreshold: number;
  readonly buildingLit: string;
  readonly canyonFlanks: boolean;
  readonly density: number;
  readonly dirColor: string;
  readonly dirIntensity: number;
  readonly fog: string;
  readonly fogFar: number;
  readonly fogNear: number;
  readonly ground: string;
  readonly groundRoughness: number;
  readonly instrumentLights: boolean;
  readonly key: string;
  readonly litChance: number;
  readonly name: string;
  readonly sky: string;
  readonly windowDark: string;
  readonly windowPalette: ReadonlyArray<WindowPaletteEntry>;
}

const PROBES: ReadonlyArray<ProbeConfig> = [
  {
    ambient: '#42507a',
    ambientIntensity: 1.1,
    bloomStrength: 0.55,
    bloomThreshold: 0.55,
    buildingLit: '#8fa0c2',
    canyonFlanks: false,
    density: 1,
    dirColor: '#6d7fb8',
    dirIntensity: 1.4,
    fog: '#344066',
    fogFar: 78,
    fogNear: 18,
    ground: '#343e54',
    groundRoughness: 0.9,
    instrumentLights: false,
    key: 'sodium-terrace',
    litChance: 0.62,
    name: '1 · Sodium Terrace (A)',
    sky: '#2b3557',
    windowDark: '#161d2e',
    windowPalette: [
      { color: '#ffc082', weight: 0.9 },
      { color: '#5eead4', weight: 0.1 },
    ],
  },
  {
    ambient: '#2c3554',
    ambientIntensity: 0.7,
    bloomStrength: 0.45,
    bloomThreshold: 0.5,
    buildingLit: '#5b6b8a',
    canyonFlanks: false,
    density: 0.55,
    dirColor: '#4a5a8c',
    dirIntensity: 0.9,
    fog: '#0d1220',
    fogFar: 95,
    fogNear: 30,
    ground: '#0e1320',
    groundRoughness: 0.85,
    instrumentLights: true,
    key: 'sodium-quiet',
    litChance: 0.26,
    name: '2 · Sodium Quiet (A×F)',
    sky: '#05070f',
    windowDark: '#10151f',
    windowPalette: [
      { color: '#ffc082', weight: 0.62 },
      { color: '#e5c79c', weight: 0.2 },
      { color: '#7dd3fc', weight: 0.18 },
    ],
  },
  {
    ambient: '#39406b',
    ambientIntensity: 1.15,
    bloomStrength: 0.85,
    bloomThreshold: 0.42,
    buildingLit: '#66738c',
    canyonFlanks: true,
    density: 1.35,
    dirColor: '#5a6aa8',
    dirIntensity: 1.2,
    fog: '#151a2c',
    fogFar: 82,
    fogNear: 16,
    ground: '#10141f',
    groundRoughness: 0.25,
    instrumentLights: false,
    key: 'sodium-canyon',
    litChance: 0.7,
    name: '3 · Sodium Canyon (A×C)',
    sky: '#0a0e18',
    windowDark: '#131826',
    windowPalette: [
      { color: '#ffc082', weight: 0.6 },
      { color: '#5eead4', weight: 0.22 },
      { color: '#a78bfa', weight: 0.18 },
    ],
  },
];

interface BuildingSpec {
  readonly d: number;
  readonly h: number;
  readonly kind: 'back' | 'fore' | 'nav';
  readonly mast: boolean;
  readonly w: number;
  readonly x: number;
  readonly z: number;
}

/**
 * Deterministic RNG so every variant shares one massing/window pattern.
 */
function makeRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function buildMassing(config: ProbeConfig): Array<BuildingSpec> {
  const random = makeRandom(1337);
  const specs: Array<BuildingSpec> = [];

  // foreground anchors: low dark masses cropping the bottom corners, leaving a plaza open
  specs.push({ d: 5, h: 3.5, kind: 'fore', mast: false, w: 8, x: -16, z: 10 }, { d: 5, h: 2.8, kind: 'fore', mast: false, w: 7, x: 15.5, z: 11 });

  // nav band: three distinct silhouettes — market (wide low), industry (mid + stack),
  // authority (tall slim + antenna)
  specs.push({ d: 4.5, h: 4, kind: 'nav', mast: false, w: 7, x: -6.5, z: 0 }, { d: 4, h: 7, kind: 'nav', mast: true, w: 4.5, x: 1.5, z: -0.5 });
  specs.push({ d: 3.2, h: 11, kind: 'nav', mast: true, w: 3, x: 8.5, z: -1.5 });

  // terraced background rows rising away from camera
  const rows = [
    { count: 6, y: 0, z: -7 },
    { count: 7, y: 2.2, z: -13 },
    { count: 8, y: 4.8, z: -19 },
    { count: 9, y: 7.5, z: -26 },
    { count: 9, y: 10.5, z: -33 },
  ];

  for (const row of rows) {
    const count = Math.round(row.count * config.density);

    for (let index = 0; index < count; index += 1) {
      const spread = 30 + Math.abs(row.z) * 0.7;
      const x = (random() - 0.5) * spread;
      const w = 2.2 + random() * 3.4;
      const h = 3 + random() * (6 + Math.abs(row.z) * 0.28);
      const d = 2.2 + random() * 2.2;

      // row.y lifts each terrace; taller variance deeper in
      specs.push({ d, h: h + row.y, kind: 'back', mast: random() < 0.18, w, x, z: row.z + (random() - 0.5) * 2.5 });
    }
  }

  if (config.canyonFlanks) {
    specs.push({ d: 9, h: 17, kind: 'back', mast: true, w: 6, x: -17, z: -2 }, { d: 8, h: 20, kind: 'back', mast: false, w: 6, x: 17.5, z: -4 });
    specs.push({ d: 7, h: 15, kind: 'back', mast: true, w: 5, x: -15.5, z: -11 }, { d: 7, h: 18, kind: 'back', mast: false, w: 5.5, x: 15.5, z: -12 });
  }

  return specs;
}

interface WindowInstance {
  readonly color: Color;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function pickWindowColor(config: ProbeConfig, random: () => number): Color {
  if (random() > config.litChance) {
    return new Color(config.windowDark);
  }

  let roll = random();

  for (const entry of config.windowPalette) {
    if (roll < entry.weight) {
      return new Color(entry.color).multiplyScalar(2.4);
    }

    roll -= entry.weight;
  }

  const fallback = config.windowPalette[0] ?? { color: '#ffc082', weight: 1 };

  return new Color(fallback.color).multiplyScalar(2.4);
}

function buildWindows(specs: ReadonlyArray<BuildingSpec>, config: ProbeConfig): Array<WindowInstance> {
  const random = makeRandom(9001);
  const windows: Array<WindowInstance> = [];

  for (const spec of specs) {
    if (spec.kind === 'fore') {
      continue;
    }

    // the nav band is the focal layer: denser lit windows pull the eye to the clickable buildings
    const litBoost = spec.kind === 'nav' ? 1.4 : 1;
    const cols = Math.max(1, Math.floor((spec.w - 0.6) / 0.62));
    const rowCount = Math.max(1, Math.floor((spec.h - 0.8) / 0.72));
    const baseY = spec.h / 2;

    for (let col = 0; col < cols; col += 1) {
      for (let row = 0; row < rowCount; row += 1) {
        const x = spec.x - (spec.w - 0.9) / 2 + col * ((spec.w - 0.9) / Math.max(1, cols - 1) || 0);
        const y = spec.h - baseY - 0.6 - row * 0.72 + baseY;

        windows.push({
          color: pickWindowColor({ ...config, litChance: Math.min(0.92, config.litChance * litBoost) }, random),
          x,
          y: y - spec.h / 2 + spec.h / 2,
          z: spec.z + spec.d / 2 + 0.03,
        });
      }
    }
  }

  return windows;
}

function buildInstruments(specs: ReadonlyArray<BuildingSpec>): Array<WindowInstance> {
  const points: Array<WindowInstance> = [];
  const cold = new Color('#7dd3fc').multiplyScalar(2.2);

  for (const spec of specs) {
    if (!spec.mast) {
      continue;
    }

    points.push({ color: cold, x: spec.x, y: spec.h + 2.1, z: spec.z });
  }

  return points;
}

/**
 * A row of warm plaza lamps grounding the empty foreground between camera and nav band.
 */
function buildPlazaLamps(): Array<WindowInstance> {
  const lamp = new Color('#ffc082').multiplyScalar(2.6);
  const lamps: Array<WindowInstance> = [];

  for (let index = 0; index < 12; index += 1) {
    const x = -15 + index * 2.7 + (index % 2) * 0.4;

    lamps.push({ color: lamp, x, y: 1.05, z: 5.5 + (index % 3) * 0.6 });
  }

  return lamps;
}

const dummy = new Object3D();

function buildScene(config: ProbeConfig): Scene {
  const scene = new Scene();

  scene.background = new Color(config.sky);
  scene.fog = new Fog(new Color(config.fog), config.fogNear, config.fogFar);

  const ambient = new AmbientLight(new Color(config.ambient), config.ambientIntensity * 0.7);
  const directional = new DirectionalLight(new Color(config.dirColor), config.dirIntensity * 1.6);
  const bounce = new HemisphereLight(new Color(config.ambient), new Color('#54402e'), 0.75);

  directional.position.set(-30, 42, 26);
  scene.add(ambient, directional, bounce);

  const ground = new Mesh(
    new PlaneGeometry(220, 220),
    new MeshStandardNodeMaterial({ color: new Color(config.ground), roughness: config.groundRoughness }),
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);

  const specs = buildMassing(config);
  const buildingGeometry = new BoxGeometry(1, 1, 1);
  const buildingMaterial = new MeshStandardNodeMaterial({ roughness: 0.85 });
  const buildings = new InstancedMesh(buildingGeometry, buildingMaterial, specs.length);
  const litColor = new Color(config.buildingLit);
  const foreColor = new Color(config.buildingLit).multiplyScalar(0.35);

  for (const [index, spec] of specs.entries()) {
    dummy.position.set(spec.x, spec.h / 2, spec.z);
    dummy.scale.set(spec.w, spec.h, spec.d);
    dummy.updateMatrix();
    buildings.setMatrixAt(index, dummy.matrix);
    buildings.setColorAt(index, spec.kind === 'fore' ? foreColor : litColor);
  }

  buildings.instanceMatrix.needsUpdate = true;
  buildings.computeBoundingSphere();
  scene.add(buildings);

  // masts as thin instanced boxes above flagged buildings
  const masts = specs.filter((spec) => spec.mast);
  const mastMesh = new InstancedMesh(
    buildingGeometry,
    new MeshStandardNodeMaterial({ color: litColor.clone().multiplyScalar(0.7), roughness: 0.9 }),
    masts.length,
  );

  for (const [index, spec] of masts.entries()) {
    dummy.position.set(spec.x, spec.h + 1, spec.z);
    dummy.scale.set(0.12, 2.2, 0.12);
    dummy.updateMatrix();
    mastMesh.setMatrixAt(index, dummy.matrix);
  }

  mastMesh.instanceMatrix.needsUpdate = true;
  mastMesh.computeBoundingSphere();
  scene.add(mastMesh);

  const windows = buildWindows(specs, config);
  const windowMesh = new InstancedMesh(
    new BoxGeometry(0.13, 0.2, 0.04),
    new MeshBasicNodeMaterial(),
    windows.length,
  );

  for (const [index, window] of windows.entries()) {
    dummy.position.set(window.x, window.y, window.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    windowMesh.setMatrixAt(index, dummy.matrix);
    windowMesh.setColorAt(index, window.color);
  }

  windowMesh.instanceMatrix.needsUpdate = true;
  windowMesh.computeBoundingSphere();
  scene.add(windowMesh);

  const points = [...buildPlazaLamps(), ...(config.instrumentLights ? buildInstruments(specs) : [])];
  const pointMesh = new InstancedMesh(
    new BoxGeometry(0.16, 0.16, 0.16),
    new MeshBasicNodeMaterial(),
    points.length,
  );

  for (const [index, point] of points.entries()) {
    dummy.position.set(point.x, point.y, point.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pointMesh.setMatrixAt(index, dummy.matrix);
    pointMesh.setColorAt(index, point.color);
  }

  pointMesh.instanceMatrix.needsUpdate = true;
  pointMesh.computeBoundingSphere();
  scene.add(pointMesh);

  return scene;
}

async function main() {
  const renderer = new WebGPURenderer({ antialias: true });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  document.body.append(renderer.domElement);
  await renderer.init();

  const camera = new PerspectiveCamera(26, window.innerWidth / window.innerHeight, 0.1, 300);

  camera.position.set(0, 21, 52);
  camera.lookAt(0, 8, -14);

  let scene = buildScene(PROBES[0]!);
  let postProcessing = buildPost(renderer, scene, camera, PROBES[0]!);
  let activeKey = PROBES[0]!.key;

  function buildPost(
    target: WebGPURenderer,
    activeScene: Scene,
    activeCamera: PerspectiveCamera,
    config: ProbeConfig,
  ): PostProcessing {
    const scenePass = pass(activeScene, activeCamera);
    const scenePassColor = scenePass.getTextureNode();
    const bloomPass = bloom(scenePassColor, config.bloomStrength, 0.4, config.bloomThreshold);
    const post = new PostProcessing(target);

    post.outputNode = scenePassColor.add(bloomPass);

    return post;
  }

  function selectProbe(config: ProbeConfig) {
    scene = buildScene(config);
    postProcessing = buildPost(renderer, scene, camera, config);
    activeKey = config.key;
    renderHUD();
  }

  const hud = document.querySelector('#hud')!;

  function renderHUD() {
    hud.innerHTML = '';

    for (const config of PROBES) {
      const button = document.createElement('button');

      button.textContent = config.name;
      button.className = config.key === activeKey ? 'active' : '';
      button.dataset['probe'] = config.key;
      button.addEventListener('click', () => selectProbe(config));
      hud.append(button);
    }
  }

  renderHUD();

  window.addEventListener('keydown', (event) => {
    const index = Number.parseInt(event.key, 10) - 1;
    const config = PROBES[index];

    if (config) {
      selectProbe(config);
    }
  });

  const params = new URLSearchParams(window.location.search);
  const initial = PROBES.find((config) => config.key === params.get('v'));

  if (initial) {
    selectProbe(initial);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(() => {
    postProcessing.render();
  });
}

void main();
