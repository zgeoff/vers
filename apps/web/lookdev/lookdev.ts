/**
 * Respite style probes — spike only, never merged to a shipping path.
 *
 * One composition: standing at the open end of the town square, buildings ringing the plaza,
 * the terraced mass of Respite climbing into haze behind the far side. Two variants differing
 * in sky value and lit-window density, both in the A×C color world (sodium warmth at street
 * level, teal/violet signals above).
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
  PointLight,
  PlaneGeometry,
  PostProcessing,
  Scene,
  WebGPURenderer,
} from 'three/webgpu';

interface ProbeConfig {
  readonly ambient: string;
  readonly ambientIntensity: number;
  readonly backgroundLitChance: number;
  readonly bloomStrength: number;
  readonly bloomThreshold: number;
  readonly buildingLit: string;
  readonly dirColor: string;
  readonly dirIntensity: number;
  readonly fog: string;
  readonly fogFar: number;
  readonly fogNear: number;
  readonly ground: string;
  readonly key: string;
  readonly litChance: number;
  readonly name: string;
  readonly sky: string;
  readonly windowDark: string;
}

const PROBES: ReadonlyArray<ProbeConfig> = [
  {
    ambient: '#39406b',
    ambientIntensity: 1,
    backgroundLitChance: 0.3,
    bloomStrength: 0.6,
    bloomThreshold: 0.45,
    buildingLit: '#6a7794',
    dirColor: '#5a6aa8',
    dirIntensity: 1.2,
    fog: '#151a2c',
    fogFar: 72,
    fogNear: 20,
    ground: '#141927',
    key: 'square-night',
    litChance: 0.52,
    name: '1 · Plaza · night',
    sky: '#0a0e18',
    windowDark: '#131826',
  },
  {
    ambient: '#42507a',
    ambientIntensity: 1.05,
    backgroundLitChance: 0.24,
    bloomStrength: 0.5,
    bloomThreshold: 0.5,
    buildingLit: '#8291b3',
    dirColor: '#6d7fb8',
    dirIntensity: 1.4,
    fog: '#2e3a5e',
    fogFar: 75,
    fogNear: 22,
    ground: '#2a3247',
    key: 'square-dusk',
    litChance: 0.4,
    name: '2 · Plaza · dusk',
    sky: '#252f52',
    windowDark: '#1a2133',
  },
];

/** Which side of the box carries windows: the face turned toward the plaza (or the camera). */
type Facing = 'nx' | 'px' | 'pz';

interface BuildingSpec {
  readonly d: number;
  readonly facing: Facing;
  readonly h: number;
  readonly kind: 'back' | 'fore' | 'plaza';
  readonly mast: boolean;
  readonly w: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Deterministic RNG so both variants share one massing and window pattern.
 */
function makeRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = Math.trunc(state);
    state = Math.trunc(state + 0x6d_2b_79_f5);
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function buildMassing(): Array<BuildingSpec> {
  const random = makeRandom(1337);

  const specs: Array<BuildingSpec> = [
    // far side of the square: the authority tall and centered, mid neighbours flanking
    { d: 4, facing: 'pz', h: 10.5, kind: 'plaza', mast: true, w: 3.6, x: 0, y: 0, z: -14 },
    { d: 4.5, facing: 'pz', h: 6, kind: 'plaza', mast: false, w: 5.5, x: -7.5, y: 0, z: -13 },
    { d: 4.5, facing: 'pz', h: 7.5, kind: 'plaza', mast: false, w: 5, x: 7.2, y: 0, z: -13.5 },

    // left row: the market wide and low, a neighbour beside it
    { d: 8, facing: 'px', h: 4.5, kind: 'plaza', mast: false, w: 4.5, x: -15, y: 0, z: -3 },
    { d: 5.5, facing: 'px', h: 6.5, kind: 'plaza', mast: false, w: 4.5, x: -15.5, y: 0, z: -10 },

    // right row: the industry with its stack, a neighbour beside it
    { d: 6.5, facing: 'nx', h: 7, kind: 'plaza', mast: true, w: 4.5, x: 15, y: 0, z: -4.5 },
    { d: 5, facing: 'nx', h: 5, kind: 'plaza', mast: false, w: 4.5, x: 15.5, y: 0, z: -10.5 },

    // corners closing the ring between the side rows and the far side
    { d: 4, facing: 'pz', h: 5.5, kind: 'plaza', mast: false, w: 3.5, x: -12.5, y: 0, z: -13 },
    { d: 4, facing: 'pz', h: 6, kind: 'plaza', mast: false, w: 3.5, x: 12.2, y: 0, z: -13.2 },

    // near flanks cropping the frame edges, dark
    { d: 6, facing: 'px', h: 5.5, kind: 'fore', mast: false, w: 6, x: -18, y: 0, z: 12 },
    { d: 6, facing: 'nx', h: 4.5, kind: 'fore', mast: false, w: 6, x: 18, y: 0, z: 13 },
  ];

  // terraced mass climbing behind the far side, fading into haze — kept low enough that sky
  // stays visible above it
  const rows = [
    { count: 6, y: 2, z: -27 },
    { count: 7, y: 4.5, z: -35 },
    { count: 8, y: 7.5, z: -43 },
  ];

  for (const row of rows) {
    for (let index = 0; index < row.count; index += 1) {
      const spread = 36 + Math.abs(row.z) * 0.5;
      const x = (random() - 0.5) * spread;
      const w = 2.4 + random() * 3.6;
      const h = 3.5 + random() * (4 + Math.abs(row.z) * 0.14);
      const d = 2.4 + random() * 2.4;

      specs.push({
        d,
        facing: 'pz',
        h: h + row.y,
        kind: 'back',
        mast: random() < 0.16,
        w,
        x,
        y: 0,
        z: row.z + (random() - 0.5) * 2.5,
      });
    }
  }

  return specs;
}

interface EmissiveInstance {
  readonly color: Color;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const WARM_WINDOW = '#ffc082';
const WARM_WINDOW_SOFT = '#e5c79c';
const SIGNAL_TEAL = '#5eead4';
const SIGNAL_VIOLET = '#a78bfa';

/**
 * Sodium warmth owns street level; teal/violet signals only join above it, so the square reads
 * human at eye height with the machine city climbing behind.
 */
function pickWindowColor(config: ProbeConfig, random: () => number, worldY: number, litChance: number): Color {
  if (random() > litChance) {
    return new Color(config.windowDark);
  }

  const roll = random();

  if (worldY < 4.5) {
    const warm = roll < 0.85 ? WARM_WINDOW : WARM_WINDOW_SOFT;

    return new Color(warm).multiplyScalar(2.2);
  }

  if (roll < 0.6) {
    return new Color(WARM_WINDOW).multiplyScalar(2);
  }

  const signal = roll < 0.82 ? SIGNAL_TEAL : SIGNAL_VIOLET;

  return new Color(signal).multiplyScalar(2);
}

function buildWindows(specs: ReadonlyArray<BuildingSpec>, config: ProbeConfig): Array<EmissiveInstance> {
  const random = makeRandom(9001);
  const windows: Array<EmissiveInstance> = [];

  for (const spec of specs) {
    if (spec.kind === 'fore') {
      continue;
    }

    const litChance = spec.kind === 'plaza' ? config.litChance : config.backgroundLitChance;

    // side-row buildings also carry windows on their camera-facing front, at lower density,
    // so they read as buildings rather than dark slabs
    const faces: Array<{ facing: Facing; litChance: number }> =
      spec.kind === 'plaza' && spec.facing !== 'pz'
        ? [
            { facing: spec.facing, litChance },
            { facing: 'pz', litChance: litChance * 0.55 },
          ]
        : [{ facing: spec.facing, litChance }];

    for (const face of faces) {
      const faceExtent = face.facing === 'pz' ? spec.w : spec.d;
      const cols = Math.max(1, Math.floor((faceExtent - 0.6) / 0.6));
      const rowCount = Math.max(1, Math.floor((spec.h - 0.8) / 0.7));
      const step = cols > 1 ? (faceExtent - 0.9) / (cols - 1) : 0;

      for (let col = 0; col < cols; col += 1) {
        for (let row = 0; row < rowCount; row += 1) {
          const along = -(faceExtent - 0.9) / 2 + col * step;
          const y = spec.y + spec.h - 0.6 - row * 0.7;

          if (face.facing === 'pz') {
            windows.push({
              color: pickWindowColor(config, random, y, face.litChance),
              x: spec.x + along,
              y,
              z: spec.z + spec.d / 2 + 0.03,
            });
          } else {
            const x = face.facing === 'px' ? spec.x + spec.w / 2 + 0.03 : spec.x - spec.w / 2 - 0.03;

            windows.push({
              color: pickWindowColor(config, random, y, face.litChance),
              x,
              y,
              z: spec.z + along,
            });
          }
        }
      }
    }
  }

  return windows;
}

/**
 * Warm lamp posts ringing the plaza, plus one cold instrument light on the central monument —
 * the one meaningful light in the F register.
 */
function buildPlazaLights(): Array<EmissiveInstance> {
  const lamp = new Color(WARM_WINDOW).multiplyScalar(2.6);
  const lights: Array<EmissiveInstance> = [];

  for (let z = -9; z <= 7; z += 4) {
    lights.push({ color: lamp, x: -11.5, y: 1.15, z }, { color: lamp, x: 11.5, y: 1.15, z });
  }

  for (let x = -8; x <= 8; x += 4) {
    lights.push({ color: lamp, x, y: 1.15, z: -10.5 });
  }

  lights.push({ color: new Color('#7dd3fc').multiplyScalar(2.4), x: 4.5, y: 3.7, z: 1.5 });

  return lights;
}

function buildInstruments(specs: ReadonlyArray<BuildingSpec>): Array<EmissiveInstance> {
  const cold = new Color('#7dd3fc').multiplyScalar(2);
  const points: Array<EmissiveInstance> = [];

  for (const spec of specs) {
    if (spec.mast) {
      points.push({ color: cold, x: spec.x, y: spec.y + spec.h + 2.1, z: spec.z });
    }
  }

  return points;
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
    new MeshStandardNodeMaterial({ color: new Color(config.ground), roughness: 0.6 }),
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);

  // the paved plaza itself, a step lighter than the surrounding ground so the square reads
  const plazaFloor = new Mesh(
    new PlaneGeometry(24, 20),
    new MeshStandardNodeMaterial({
      color: new Color(config.ground).multiplyScalar(2.4),
      roughness: 0.45,
    }),
  );

  plazaFloor.rotation.x = -Math.PI / 2;
  plazaFloor.position.set(0, 0.005, -1.5);
  scene.add(plazaFloor);

  // warm pools of lamp light on the pavement — the square's stage lighting
  const lampGlow = new Color(WARM_WINDOW);

  for (const position of [
    [-9, 4],
    [9, 4],
    [-9, -8],
    [9, -8],
    [0, -2],
  ] as const) {
    const light = new PointLight(lampGlow, 26, 14, 2);

    light.position.set(position[0], 2.4, position[1]);
    scene.add(light);
  }

  const specs = buildMassing();
  const boxGeometry = new BoxGeometry(1, 1, 1);
  const buildings = new InstancedMesh(
    boxGeometry,
    new MeshStandardNodeMaterial({ roughness: 0.85 }),
    specs.length,
  );
  const litColor = new Color(config.buildingLit);
  const foreColor = new Color(config.buildingLit).multiplyScalar(0.35);

  for (const [index, spec] of specs.entries()) {
    dummy.position.set(spec.x, spec.y + spec.h / 2, spec.z);
    dummy.scale.set(spec.w, spec.h, spec.d);
    dummy.updateMatrix();
    buildings.setMatrixAt(index, dummy.matrix);
    buildings.setColorAt(index, spec.kind === 'fore' ? foreColor : litColor);
  }

  buildings.instanceMatrix.needsUpdate = true;
  buildings.computeBoundingSphere();
  scene.add(buildings);

  const masts = specs.filter((spec) => spec.mast);
  const mastMesh = new InstancedMesh(
    boxGeometry,
    new MeshStandardNodeMaterial({ color: litColor.clone().multiplyScalar(0.7), roughness: 0.9 }),
    masts.length,
  );

  for (const [index, spec] of masts.entries()) {
    dummy.position.set(spec.x, spec.y + spec.h + 1, spec.z);
    dummy.scale.set(0.12, 2.2, 0.12);
    dummy.updateMatrix();
    mastMesh.setMatrixAt(index, dummy.matrix);
  }

  mastMesh.instanceMatrix.needsUpdate = true;
  mastMesh.computeBoundingSphere();
  scene.add(mastMesh);

  // the central monument the plaza's instrument light sits on
  const monument = new Mesh(
    new BoxGeometry(0.8, 3.4, 0.8),
    new MeshStandardNodeMaterial({ color: litColor.clone().multiplyScalar(0.55), roughness: 0.8 }),
  );

  monument.position.set(4.5, 1.7, 1.5);
  scene.add(monument);

  // lamp posts under the plaza lights
  const lampSpecs = buildPlazaLights().filter((light) => light.y < 2);
  const postMesh = new InstancedMesh(
    boxGeometry,
    new MeshStandardNodeMaterial({ color: new Color('#1c2333'), roughness: 0.9 }),
    lampSpecs.length,
  );

  for (const [index, light] of lampSpecs.entries()) {
    dummy.position.set(light.x, 0.5, light.z);
    dummy.scale.set(0.1, 1, 0.1);
    dummy.updateMatrix();
    postMesh.setMatrixAt(index, dummy.matrix);
  }

  postMesh.instanceMatrix.needsUpdate = true;
  postMesh.computeBoundingSphere();
  scene.add(postMesh);

  const emissives = [...buildWindows(specs, config), ...buildPlazaLights(), ...buildInstruments(specs)];
  const emissiveMesh = new InstancedMesh(
    new BoxGeometry(0.13, 0.2, 0.05),
    new MeshBasicNodeMaterial(),
    emissives.length,
  );

  for (const [index, emissive] of emissives.entries()) {
    dummy.position.set(emissive.x, emissive.y, emissive.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    emissiveMesh.setMatrixAt(index, dummy.matrix);
    emissiveMesh.setColorAt(index, emissive.color);
  }

  emissiveMesh.instanceMatrix.needsUpdate = true;
  emissiveMesh.computeBoundingSphere();
  scene.add(emissiveMesh);

  return scene;
}

async function main() {
  // bun's dev-server HMR can re-execute the module; a second renderer + loop fights the first
  const globalState = globalThis as { __lookdevBooted?: boolean };

  if (globalState.__lookdevBooted) {
    return;
  }

  globalState.__lookdevBooted = true;

  const renderer = new WebGPURenderer({ antialias: true });

  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio));
  document.body.appendChild(renderer.domElement);
  await renderer.init();

  const camera = new PerspectiveCamera(36, globalThis.innerWidth / globalThis.innerHeight, 0.1, 300);

  camera.position.set(0, 9, 26);
  camera.lookAt(0, 3, -7);

  const buildPost = (config: ProbeConfig, scene: Scene): PostProcessing => {
    const scenePass = pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode();
    const bloomPass = bloom(scenePassColor, config.bloomStrength, 0.4, config.bloomThreshold);
    const post = new PostProcessing(renderer);

    post.outputNode = scenePassColor.add(bloomPass);

    return post;
  };

  const first = PROBES[0];

  if (!first) {
    return;
  }

  let activeKey = first.key;
  let postProcessing = buildPost(first, buildScene(first));

  const hud = document.getElementById('hud');

  const renderHUD = () => {
    if (!hud) {
      return;
    }

    hud.innerHTML = '';

    for (const config of PROBES) {
      const button = document.createElement('button');

      button.textContent = config.name;
      button.className = config.key === activeKey ? 'active' : '';
      button.addEventListener('click', () => selectProbe(config));
      hud.appendChild(button);
    }
  };

  const selectProbe = (config: ProbeConfig) => {
    postProcessing = buildPost(config, buildScene(config));
    activeKey = config.key;
    renderHUD();
  };

  renderHUD();

  globalThis.addEventListener('keydown', (event) => {
    const index = Number(event.key) - 1;
    const config = PROBES[index];

    if (config) {
      selectProbe(config);
    }
  });

  const params = new URLSearchParams(globalThis.location.search);
  const initial = PROBES.find((config) => config.key === params.get('v'));

  if (initial) {
    selectProbe(initial);
  }

  globalThis.addEventListener('resize', () => {
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  });

  renderer.setAnimationLoop(() => {
    postProcessing.render();
  });
}

void main();
