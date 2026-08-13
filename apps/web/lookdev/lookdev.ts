/**
 * Respite style probes — spike only, never merged to a shipping path.
 *
 * The town square, irregular plan: four nav buildings (market, stash, codex, avatar hall) carry
 * the light and the eye; filler buildings sit dim and inactive; the explore gate breaks the ring
 * on the far side, glowing world-teal toward the outside. Variant 2 layers dusk-colored fog
 * banks through the same night scene.
 */
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
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
  readonly duskFogBanks: boolean;
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

const DUSK_FOG = '#2e3a5e';

const PROBES: ReadonlyArray<ProbeConfig> = [
  {
    ambient: '#39406b',
    ambientIntensity: 1,
    backgroundLitChance: 0.14,
    bloomStrength: 0.55,
    bloomThreshold: 0.45,
    buildingLit: '#6a7794',
    dirColor: '#5a6aa8',
    dirIntensity: 1.2,
    duskFogBanks: false,
    fog: '#151a2c',
    fogFar: 72,
    fogNear: 20,
    ground: '#141927',
    key: 'night',
    litChance: 0.3,
    name: '1 · Plaza · night',
    sky: '#0a0e18',
    windowDark: '#131826',
  },
  {
    ambient: '#39406b',
    ambientIntensity: 1,
    backgroundLitChance: 0.12,
    bloomStrength: 0.55,
    bloomThreshold: 0.45,
    buildingLit: '#6a7794',
    dirColor: '#5a6aa8',
    dirIntensity: 1.1,
    duskFogBanks: true,
    fog: '#232c48',
    fogFar: 64,
    fogNear: 16,
    ground: '#141927',
    key: 'dusk-fog',
    litChance: 0.3,
    name: '2 · Plaza · dusk fog',
    sky: '#0a0e18',
    windowDark: '#131826',
  },
];

/** Which side of the box carries windows, in the building's local frame before yaw. */
type Facing = 'nx' | 'px' | 'pz';

type Role = 'avatar' | 'back' | 'codex' | 'filler' | 'fore' | 'market' | 'stash';

interface BuildingSpec {
  readonly d: number;
  readonly facing: Facing;
  readonly h: number;
  readonly mast: boolean;
  readonly role: Role;
  readonly ry: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function isNavRole(role: Role): boolean {
  return role === 'avatar' || role === 'codex' || role === 'market' || role === 'stash';
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
    // far side: the codex tower off-center left; the explore gate breaks the ring to its right
    { d: 4, facing: 'pz', h: 10.5, mast: true, role: 'codex', ry: 0.06, w: 3.6, x: -2, y: 0, z: -14.5 },
    { d: 4.2, facing: 'pz', h: 5, mast: false, role: 'filler', ry: 0.11, w: 4.8, x: -8.5, y: 0, z: -13.2 },
    { d: 4, facing: 'pz', h: 6, mast: false, role: 'filler', ry: -0.14, w: 3.8, x: 11.8, y: 0, z: -12.6 },

    // left row: the market wide and angled inward, the stash a heavy low block behind it
    { d: 8, facing: 'px', h: 4.5, mast: false, role: 'market', ry: 0.16, w: 4.5, x: -14, y: 0, z: -2.5 },
    { d: 5.5, facing: 'px', h: 3.6, mast: false, role: 'stash', ry: -0.07, w: 5, x: -13.6, y: 0, z: -9.2 },

    // right row: the avatar hall with its mast, one dim filler beside it
    { d: 6.5, facing: 'nx', h: 7, mast: true, role: 'avatar', ry: -0.13, w: 4.5, x: 14.6, y: 0, z: -4 },
    { d: 5, facing: 'nx', h: 4.6, mast: false, role: 'filler', ry: 0.09, w: 4.5, x: 15.8, y: 0, z: -10.5 },

    // near flanks cropping the frame edges, dark
    { d: 6, facing: 'px', h: 5.5, mast: false, role: 'fore', ry: 0.1, w: 6, x: -18, y: 0, z: 12 },
    { d: 6, facing: 'nx', h: 4.5, mast: false, role: 'fore', ry: -0.08, w: 6, x: 18, y: 0, z: 13 },
  ];

  // terraced mass climbing behind the far side, fading into haze
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
        mast: random() < 0.16,
        role: 'back',
        ry: (random() - 0.5) * 0.3,
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
const GATE_TEAL = '#2dd4bf';

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

/** Rotate a local offset by the building's yaw and translate it to world space. */
function toWorldOffset(spec: BuildingSpec, lx: number, lz: number): { x: number; z: number } {
  const cos = Math.cos(spec.ry);
  const sin = Math.sin(spec.ry);

  return { x: spec.x + lx * cos + lz * sin, z: spec.z - lx * sin + lz * cos };
}

function buildWindows(specs: ReadonlyArray<BuildingSpec>, config: ProbeConfig): Array<EmissiveInstance> {
  const random = makeRandom(9001);
  const windows: Array<EmissiveInstance> = [];

  for (const spec of specs) {
    if (spec.role === 'fore') {
      continue;
    }

    const roleLitChance = isNavRole(spec.role)
      ? config.litChance * 1.9
      : spec.role === 'filler'
        ? config.litChance * 0.35
        : config.backgroundLitChance;

    // nav side-row buildings also carry windows on their camera-facing front, at lower density,
    // so they read as buildings rather than dark slabs
    const faces: Array<{ facing: Facing; litChance: number }> =
      isNavRole(spec.role) && spec.facing !== 'pz'
        ? [
            { facing: spec.facing, litChance: roleLitChance },
            { facing: 'pz', litChance: roleLitChance * 0.55 },
          ]
        : [{ facing: spec.facing, litChance: roleLitChance }];

    for (const face of faces) {
      const faceExtent = face.facing === 'pz' ? spec.w : spec.d;
      const cols = Math.max(1, Math.floor((faceExtent - 0.6) / 0.6));
      const rowCount = Math.max(1, Math.floor((spec.h - 0.8) / 0.7));
      const step = cols > 1 ? (faceExtent - 0.9) / (cols - 1) : 0;

      for (let col = 0; col < cols; col += 1) {
        for (let row = 0; row < rowCount; row += 1) {
          const along = -(faceExtent - 0.9) / 2 + col * step;
          const y = spec.y + spec.h - 0.6 - row * 0.7;
          const color = pickWindowColor(config, random, y, face.litChance);

          if (face.facing === 'pz') {
            const world = toWorldOffset(spec, along, spec.d / 2 + 0.03);

            windows.push({ color, x: world.x, y, z: world.z });
          } else {
            const lx = face.facing === 'px' ? spec.w / 2 + 0.03 : -spec.w / 2 - 0.03;
            const world = toWorldOffset(spec, lx, along);

            windows.push({ color, x: world.x, y, z: world.z });
          }
        }
      }
    }

    // a lit entrance at the base of each nav building, facing the plaza
    if (isNavRole(spec.role)) {
      const doorColor = new Color(WARM_WINDOW).multiplyScalar(2.6);

      if (spec.facing === 'pz') {
        const world = toWorldOffset(spec, 0, spec.d / 2 + 0.05);

        windows.push({ color: doorColor, x: world.x, y: 0.75, z: world.z });
      } else {
        const lx = spec.facing === 'px' ? spec.w / 2 + 0.05 : -spec.w / 2 - 0.05;
        const world = toWorldOffset(spec, lx, 0);

        windows.push({ color: doorColor, x: world.x, y: 0.75, z: world.z });
      }
    }
  }

  return windows;
}

interface LampSpec {
  readonly x: number;
  readonly z: number;
}

/** Hand-scattered lamp posts — deliberately off-grid so the square doesn't read master-planned. */
const LAMPS: ReadonlyArray<LampSpec> = [
  { x: -10.5, z: 3.5 },
  { x: -11.8, z: -4 },
  { x: -8, z: -10 },
  { x: -2.5, z: -12 },
  { x: 3, z: -11 },
  { x: 10.2, z: -8.5 },
  { x: 11.5, z: 0.5 },
  { x: 9, z: 6 },
  { x: -4, z: 6.5 },
];

function buildPlazaLights(): Array<EmissiveInstance> {
  const lamp = new Color(WARM_WINDOW).multiplyScalar(2.6);
  const lights: Array<EmissiveInstance> = LAMPS.map((spec) => ({
    color: lamp,
    x: spec.x,
    y: 1.15,
    z: spec.z,
  }));

  // the monument's single cold instrument light, in the F register
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

  // the paved plaza, skewed off the world axes so the square doesn't read as a perfect rectangle
  const plazaFloor = new Mesh(
    new PlaneGeometry(25, 21),
    new MeshStandardNodeMaterial({
      color: new Color(config.ground).multiplyScalar(2.4),
      roughness: 0.45,
    }),
  );

  plazaFloor.rotation.x = -Math.PI / 2;
  plazaFloor.rotation.z = 0.07;
  plazaFloor.position.set(0.8, 0.005, -1.5);
  scene.add(plazaFloor);

  // a smaller apron spilling toward the gate, breaking the plaza's outline further
  const apron = new Mesh(
    new PlaneGeometry(9, 10),
    new MeshStandardNodeMaterial({
      color: new Color(config.ground).multiplyScalar(2.1),
      roughness: 0.5,
    }),
  );

  apron.rotation.x = -Math.PI / 2;
  apron.rotation.z = -0.12;
  apron.position.set(5.5, 0.004, -11);
  scene.add(apron);

  // warm pools of lamp light on the pavement — the square's stage lighting
  for (const lamp of [LAMPS[1], LAMPS[4], LAMPS[6], LAMPS[8]]) {
    if (!lamp) {
      continue;
    }

    const light = new PointLight(new Color(WARM_WINDOW), 16, 14, 2);

    light.position.set(lamp.x, 2.9, lamp.z);
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
  const navColor = litColor.clone().multiplyScalar(1.15);
  const fillerColor = litColor.clone().multiplyScalar(0.6);
  const foreColor = litColor.clone().multiplyScalar(0.35);

  for (const [index, spec] of specs.entries()) {
    dummy.position.set(spec.x, spec.y + spec.h / 2, spec.z);
    dummy.rotation.set(0, spec.ry, 0);
    dummy.scale.set(spec.w, spec.h, spec.d);
    dummy.updateMatrix();
    buildings.setMatrixAt(index, dummy.matrix);

    const color = isNavRole(spec.role)
      ? navColor
      : spec.role === 'filler'
        ? fillerColor
        : spec.role === 'fore'
          ? foreColor
          : litColor;

    buildings.setColorAt(index, color);
  }

  dummy.rotation.set(0, 0, 0);
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

  // the explore gate: two pylons in the far-side gap, world-teal edges, teal glow beyond
  const pylonMaterial = new MeshStandardNodeMaterial({
    color: litColor.clone().multiplyScalar(0.5),
    roughness: 0.8,
  });

  for (const px of [4.2, 8.2]) {
    const pylon = new Mesh(new BoxGeometry(0.9, 6.2, 1.1), pylonMaterial);

    pylon.position.set(px, 3.1, -14);
    scene.add(pylon);
  }

  const gateGlow = new PointLight(new Color(GATE_TEAL), 30, 20, 2);

  gateGlow.position.set(6.2, 2.5, -17.5);
  scene.add(gateGlow);

  // the monument the plaza's instrument light sits on, off the square's center line
  const monument = new Mesh(
    new BoxGeometry(0.8, 3.4, 0.8),
    new MeshStandardNodeMaterial({ color: litColor.clone().multiplyScalar(0.55), roughness: 0.8 }),
  );

  monument.position.set(4.5, 1.7, 1.5);
  scene.add(monument);

  // lamp posts under the plaza lights
  const postMesh = new InstancedMesh(
    boxGeometry,
    new MeshStandardNodeMaterial({ color: new Color('#1c2333'), roughness: 0.9 }),
    LAMPS.length,
  );

  for (const [index, lamp] of LAMPS.entries()) {
    dummy.position.set(lamp.x, 0.5, lamp.z);
    dummy.scale.set(0.1, 1, 0.1);
    dummy.updateMatrix();
    postMesh.setMatrixAt(index, dummy.matrix);
  }

  postMesh.instanceMatrix.needsUpdate = true;
  postMesh.computeBoundingSphere();
  scene.add(postMesh);

  const emissives = [...buildWindows(specs, config), ...buildPlazaLights(), ...buildInstruments(specs)];

  // gate edge strips join the emissive set: vertical teal lines on the pylons' inner edges
  for (const px of [4.7, 7.7]) {
    for (let index = 0; index < 8; index += 1) {
      emissives.push({
        color: new Color(GATE_TEAL).multiplyScalar(1.9),
        x: px,
        y: 0.7 + index * 0.72,
        z: -13.4,
      });
    }
  }

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

  if (config.duskFogBanks) {
    addDuskFogBanks(scene);
  }

  return scene;
}

/**
 * Translucent dusk-colored planes at staggered depths: the dusk palette as rolling atmosphere
 * layered through the night scene rather than a time of day.
 */
function addDuskFogBanks(scene: Scene) {
  const banks = [
    { opacity: 0.1, y: 2.5, z: -10 },
    { opacity: 0.16, y: 3.5, z: -18 },
    { opacity: 0.24, y: 5, z: -26 },
  ];

  for (const bank of banks) {
    const plane = new Mesh(
      new PlaneGeometry(90, 11),
      new MeshBasicNodeMaterial({
        color: new Color(DUSK_FOG),
        depthWrite: false,
        opacity: bank.opacity,
        side: DoubleSide,
        transparent: true,
      }),
    );

    plane.position.set(0, bank.y, bank.z);
    scene.add(plane);
  }
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

  const selectProbe = (config: ProbeConfig) => {
    postProcessing = buildPost(config, buildScene(config));
    activeKey = config.key;
    renderHUD();
  };

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
