/**
 * Respite style probes — spike only, never merged to a shipping path.
 *
 * Views: the two plaza mood probes, shaded silhouette lineups for the elements still being
 * designed (stash, codex, gate), and a draft assembly placing the current best part sets into
 * the plaza to judge the silhouettes in context.
 */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import {
  color,
  float,
  materialColor,
  mix,
  mrt,
  mx_noise_float,
  normalView,
  output,
  pass,
  positionWorld,
  screenSize,
  screenUV,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
// @ts-expect-error bun's file loader turns the asset import into a served URL string
import gateModelURL from './models/respite-gate.glb';
import {
  AdditiveBlending,
  AgXToneMapping,
  Box3,
  CircleGeometry,
  ExtrudeGeometry,
  Shape,
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  NoToneMapping,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  PostProcessing,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
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

const NIGHT: ProbeConfig = {
  ambient: '#39406b',
  ambientIntensity: 1.2,
  backgroundLitChance: 0.14,
  bloomStrength: 0.46,
  bloomThreshold: 0.62,
  buildingLit: '#6a7794',
  dirColor: '#5a6aa8',
  dirIntensity: 1.2,
  duskFogBanks: false,
  fog: '#151a2c',
  fogFar: 136,
  fogNear: 26,
  ground: '#141927',
  key: 'night',
  litChance: 0.3,
  name: '1 · Plaza · night',
  sky: '#0a0e18',
  windowDark: '#131826',
};

const DUSK_FOG_PROBE: ProbeConfig = {
  ...NIGHT,
  backgroundLitChance: 0.12,
  dirIntensity: 1.1,
  duskFogBanks: true,
  fog: '#232c48',
  fogFar: 64,
  fogNear: 16,
  key: 'dusk-fog',
  name: '2 · Plaza · dusk fog',
};

const PROBES: ReadonlyArray<ProbeConfig> = [NIGHT, DUSK_FOG_PROBE];

/** Which side of the box carries windows, in the building's local frame before yaw. */
type Facing = 'nx' | 'px' | 'pz';

type Role = 'avatar' | 'back' | 'codex' | 'filler' | 'fore' | 'market' | 'stash';

interface BuildingSpec {
  readonly d: number;
  readonly facing: Facing;
  readonly h: number;
  readonly mast: boolean;
  readonly role: Role;
  ry: number;
  readonly w: number;
  x: number;
  readonly y: number;
  z: number;
}

function isNavRole(role: Role): boolean {
  return role === 'avatar' || role === 'codex' || role === 'market' || role === 'stash';
}

/**
 * Deterministic RNG so every view shares one massing and window pattern.
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
  return [
    // nav placeholder boxes: only the legacy box-mode probe views render these; the assembly and
    // plan views use the part-set placements instead
    { d: 4, facing: 'pz', h: 10.5, mast: true, role: 'codex', ry: 0.06, w: 3.6, x: -2, y: 0, z: -14.5 },
    { d: 8, facing: 'px', h: 4.5, mast: false, role: 'market', ry: 0.16, w: 4.5, x: -14, y: 0, z: -2.5 },
    { d: 5.5, facing: 'px', h: 3.6, mast: false, role: 'stash', ry: -0.07, w: 5, x: -13.6, y: 0, z: -9.2 },
    { d: 6.5, facing: 'nx', h: 7, mast: true, role: 'avatar', ry: -0.13, w: 4.5, x: 14.6, y: 0, z: -4 },

    // the fixed massing, laid out by hand in the plan editor
    { d: 3.6, facing: 'pz', h: 5, mast: false, role: 'filler', ry: 0.06, w: 4, x: -41.3, y: 0, z: -18.3 },
    { d: 4, facing: 'pz', h: 6, mast: false, role: 'filler', ry: 0.06, w: 3.8, x: -34, y: 0, z: 6.8 },
    { d: 5, facing: 'nx', h: 4.6, mast: false, role: 'filler', ry: 0.04, w: 4.5, x: -34.9, y: 0, z: 0.8 },
    { d: 6, facing: 'px', h: 5.5, mast: false, role: 'fore', ry: 0.05, w: 6, x: -39.7, y: 0, z: -4.9 },
    { d: 6, facing: 'nx', h: 4.5, mast: false, role: 'fore', ry: 0.07, w: 6, x: -39.4, y: 0, z: 5.6 },
    { d: 3.94, facing: 'pz', h: 11.81, mast: false, role: 'back', ry: 0.064, w: 3.08, x: -37.4, y: 0, z: -19.4 },
    { d: 2.89, facing: 'pz', h: 8.57, mast: false, role: 'back', ry: 0.07, w: 4.04, x: -40.1, y: 0, z: -10.4 },
    { d: 2.9, facing: 'pz', h: 7.05, mast: false, role: 'back', ry: 0.037, w: 2.71, x: -41.1, y: 0, z: 0.9 },
    { d: 2.69, facing: 'pz', h: 6.99, mast: false, role: 'back', ry: -1.495, w: 5.02, x: -35.1, y: 0, z: -11.7 },
    { d: 3.75, facing: 'pz', h: 5.77, mast: false, role: 'back', ry: 0.066, w: 5.29, x: -40.6, y: 0, z: -14.1 },
    { d: 3.18, facing: 'pz', h: 10.25, mast: false, role: 'back', ry: -0.062, w: 2.91, x: -26.19, y: 0, z: -34.82 },
    { d: 3.02, facing: 'pz', h: 9.42, mast: true, role: 'back', ry: -0.111, w: 2.56, x: 9.93, y: 0, z: -35.6 },
    { d: 2.78, facing: 'pz', h: 9.39, mast: false, role: 'back', ry: 0.012, w: 3.22, x: -9.17, y: 0, z: -34.94 },
    { d: 2.82, facing: 'pz', h: 8.48, mast: false, role: 'back', ry: 0.1, w: 4.45, x: 5.28, y: 0, z: -35.69 },
    { d: 3.84, facing: 'pz', h: 13.38, mast: false, role: 'back', ry: 0.106, w: 4.29, x: -11.65, y: 0, z: -35.9 },
    { d: 3.35, facing: 'pz', h: 10.79, mast: false, role: 'back', ry: 0.101, w: 4.72, x: 19.69, y: 0, z: -33.83 },
    { d: 3.23, facing: 'pz', h: 15.86, mast: true, role: 'back', ry: -0.037, w: 4.5, x: 8.24, y: 0, z: -42.66 },
    { d: 2.85, facing: 'pz', h: 17.16, mast: false, role: 'back', ry: -0.003, w: 3.62, x: 23.02, y: 0, z: -42.2 },
    { d: 3.57, facing: 'pz', h: 11.31, mast: false, role: 'back', ry: 0.014, w: 2.62, x: 24.1, y: 0, z: -42.54 },
    { d: 2.54, facing: 'pz', h: 18.28, mast: true, role: 'back', ry: -0.025, w: 2.78, x: 10.13, y: 0, z: -42.53 },
    { d: 4.06, facing: 'pz', h: 12.63, mast: false, role: 'back', ry: 0.082, w: 4.5, x: 5.88, y: 0, z: -43.61 },
    { d: 4.54, facing: 'pz', h: 17.98, mast: false, role: 'back', ry: 0.105, w: 4, x: -16.34, y: 0, z: -43.34 },
  ];
}

/**
 * The live fixed-massing state, materialized once so the plan editor can drag any block and
 * every consumer reads the same coordinates.
 */
const massing: Array<BuildingSpec> = buildMassing();

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

/** Rotate a local offset by a yaw and translate it to the anchor's world position. */
function toWorldOffset(anchorX: number, anchorZ: number, ry: number, lx: number, lz: number): { x: number; z: number } {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);

  return { x: anchorX + lx * cos + lz * sin, z: anchorZ - lx * sin + lz * cos };
}

function buildWindows(
  specs: ReadonlyArray<BuildingSpec>,
  config: ProbeConfig,
  includeNav: boolean,
): Array<EmissiveInstance> {
  const random = makeRandom(9001);
  const windows: Array<EmissiveInstance> = [];

  for (const spec of specs) {
    if (spec.role === 'fore' || (!includeNav && isNavRole(spec.role))) {
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
            const world = toWorldOffset(spec.x, spec.z, spec.ry, along, spec.d / 2 + 0.03);

            windows.push({ color, x: world.x, y, z: world.z });
          } else {
            const lx = face.facing === 'px' ? spec.w / 2 + 0.03 : -spec.w / 2 - 0.03;
            const world = toWorldOffset(spec.x, spec.z, spec.ry, lx, along);

            windows.push({ color, x: world.x, y, z: world.z });
          }
        }
      }
    }

    if (isNavRole(spec.role)) {
      const doorColor = new Color(WARM_WINDOW).multiplyScalar(2.6);
      const lx = spec.facing === 'pz' ? 0 : spec.facing === 'px' ? spec.w / 2 + 0.05 : -spec.w / 2 - 0.05;
      const lz = spec.facing === 'pz' ? spec.d / 2 + 0.05 : 0;
      const world = toWorldOffset(spec.x, spec.z, spec.ry, lx, lz);

      windows.push({ color: doorColor, x: world.x, y: 0.75, z: world.z });
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

function buildPlazaLights(fountainX: number, fountainZ: number): Array<EmissiveInstance> {
  const lamp = new Color(WARM_WINDOW).multiplyScalar(2.6);
  const lights: Array<EmissiveInstance> = LAMPS.map((spec) => ({
    color: lamp,
    x: spec.x,
    y: 1.15,
    z: spec.z,
  }));

  // the fountain's single cold instrument light, in the F register, on its low central hub
  lights.push({ color: new Color('#7dd3fc').multiplyScalar(2.4), x: fountainX, y: 1.6, z: fountainZ });

  return lights;
}

function buildInstruments(specs: ReadonlyArray<BuildingSpec>, includeNav: boolean): Array<EmissiveInstance> {
  const cold = new Color('#7dd3fc').multiplyScalar(2);
  const points: Array<EmissiveInstance> = [];

  for (const spec of specs) {
    if (spec.mast && (includeNav || !isNavRole(spec.role))) {
      points.push({ color: cold, x: spec.x, y: spec.y + spec.h + 2.1, z: spec.z });
    }
  }

  return points;
}

interface SilhouettePart {
  readonly g: 'box' | 'cyl' | 'sphere';
  readonly rx?: number;
  readonly rz?: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Market B, refined per feedback: the lower mast dropped. */
const MARKET_PARTS: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 12, sy: 2, sz: 4.6, x: 0, y: 1, z: 0 },
  { g: 'box', sx: 9, sy: 1.7, sz: 3.8, x: 1.6, y: 2.85, z: -0.3 },
  { g: 'box', sx: 2, sy: 1, sz: 2, x: -3.4, y: 2.5, z: 0 },
  { g: 'box', sx: 1.4, sy: 1.4, sz: 1.4, x: 0.8, y: 4.4, z: -0.6 },
  { g: 'box', sx: 2.6, sy: 0.8, sz: 1.8, x: 3.8, y: 4.1, z: 0.2 },
  { g: 'box', sx: 0.12, sy: 2, sz: 0.12, x: 4.2, y: 4.7, z: 0 },
];

/** Avatar A — stacked drums; C (the dome) stays a live alternative for the in-scene check. */
const AVATAR_PARTS: ReadonlyArray<SilhouettePart> = [
  { g: 'cyl', sx: 2.4, sy: 4.6, sz: 2.4, x: 0, y: 2.3, z: 0 },
  { g: 'cyl', sx: 1.6, sy: 1.3, sz: 1.6, x: 0, y: 5.25, z: 0 },
  { g: 'box', sx: 0.1, sy: 2, sz: 0.1, x: 0, y: 6.9, z: 0 },
  { g: 'box', sx: 1.4, sy: 1.1, sz: 1.4, x: 2.9, y: 0.55, z: 0 },
];

/** Avatar C — the half-sunk dome on a plinth, stageable in place of the drums for comparison. */
const AVATAR_DOME_PARTS: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 5.5, sy: 1.6, sz: 5.5, x: 0, y: 0.8, z: 0 },
  { g: 'sphere', sx: 3, sy: 3, sz: 3, x: 0, y: 1.6, z: 0 },
  { g: 'box', sx: 0.12, sy: 2.6, sz: 0.12, x: 0, y: 5.9, z: 0 },
];

/** Stash new-A — the bunker vault evolved: circular door face, buttress hips. */
const STASH_VAULT_FACE: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 7.5, sy: 2.2, sz: 5.5, x: 0, y: 1.1, z: 0 },
  { g: 'cyl', rz: 1.5708, sx: 1.9, sy: 6.8, sz: 1.9, x: 0, y: 2.1, z: 0 },
  { g: 'cyl', rx: 1.5708, sx: 1.5, sy: 0.3, sz: 1.5, x: 0, y: 1.6, z: 2.7 },
  { g: 'box', sx: 0.4, sy: 0.7, sz: 0.4, x: -1.6, y: 4.2, z: 0 },
  { g: 'box', sx: 0.4, sy: 0.7, sz: 0.4, x: 1.4, y: 4.3, z: 0 },
  { g: 'box', sx: 1.4, sy: 1.4, sz: 3, x: -3.9, y: 0.7, z: 0 },
  { g: 'box', sx: 1.4, sy: 1.4, sz: 3, x: 3.9, y: 0.7, z: 0 },
];

/**
 * The market's mid-scale form pass: the picked stacked-bazaar massing gains canopy bays over a
 * row of stalls, a roof vent and pipe run, and a projecting sign fin. Front is local +z.
 */
const MARKET_FORM_PARTS: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 12, sy: 2, sz: 4.6, x: 0, y: 1, z: 0 },
  { g: 'box', sx: 9, sy: 1.7, sz: 3.8, x: 1.6, y: 2.85, z: -0.3 },
  { g: 'box', sx: 2, sy: 1, sz: 2, x: -3.4, y: 2.5, z: 0 },
  { g: 'box', sx: 1.4, sy: 1.4, sz: 1.4, x: 0.8, y: 4.4, z: -0.6 },
  { g: 'box', sx: 2.6, sy: 0.8, sz: 1.8, x: 3.8, y: 4.1, z: 0.2 },
  { g: 'box', sx: 0.12, sy: 2, sz: 0.12, x: 4.2, y: 4.7, z: 0 },
  { g: 'box', rx: -0.32, sx: 2.1, sy: 0.25, sz: 1.9, x: -4.8, y: 2.15, z: 2.6 },
  { g: 'box', rx: -0.32, sx: 2.1, sy: 0.25, sz: 1.9, x: -2.4, y: 2.2, z: 2.55 },
  { g: 'box', rx: -0.32, sx: 2.1, sy: 0.25, sz: 1.9, x: 0, y: 2.15, z: 2.6 },
  { g: 'box', rx: -0.32, sx: 2.1, sy: 0.25, sz: 1.9, x: 2.4, y: 2.18, z: 2.58 },
  { g: 'box', rx: -0.32, sx: 2.1, sy: 0.25, sz: 1.9, x: 4.8, y: 2.15, z: 2.6 },
  { g: 'box', sx: 1.7, sy: 1.05, sz: 1.3, x: -3.7, y: 0.53, z: 2.7 },
  { g: 'box', sx: 1.6, sy: 1.1, sz: 1.3, x: -1.2, y: 0.55, z: 2.8 },
  { g: 'box', sx: 1.7, sy: 1, sz: 1.3, x: 1.4, y: 0.5, z: 2.65 },
  { g: 'box', sx: 1.6, sy: 1.1, sz: 1.3, x: 3.9, y: 0.55, z: 2.75 },
  { g: 'cyl', sx: 0.55, sy: 0.9, sz: 0.55, x: -1.6, y: 4.15, z: -0.5 },
  { g: 'box', sx: 6, sy: 0.18, sz: 0.18, x: 0.5, y: 2.15, z: -2.35 },
  { g: 'box', sx: 0.3, sy: 2.6, sz: 1.2, x: -6.15, y: 2.6, z: 1.6 },
];

/** Stash pick — the double drum made asymmetric: one large tank, one small, sharing a collar. */
const STASH_DOUBLE_DRUM: ReadonlyArray<SilhouettePart> = [
  { g: 'cyl', sx: 2.6, sy: 3.2, sz: 2.6, x: -1.4, y: 1.6, z: 0 },
  { g: 'cyl', sx: 1.7, sy: 2.3, sz: 1.7, x: 2.6, y: 1.15, z: 0 },
  { g: 'box', sx: 3.4, sy: 1.4, sz: 3, x: 0.6, y: 0.7, z: 0 },
  { g: 'box', sx: 1.1, sy: 0.5, sz: 1.1, x: -1.4, y: 3.45, z: 0 },
  { g: 'box', sx: 0.8, sy: 0.4, sz: 0.8, x: 2.6, y: 2.5, z: 0 },
  { g: 'box', sx: 0.15, sy: 1.1, sz: 0.15, x: 0.6, y: 1.9, z: 0 },
];

/** Codex new-A — plinth spire: a broad two-tier base carrying a slimmer instrument shaft. */
const CODEX_PLINTH_SPIRE: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 6, sy: 3, sz: 5, x: 0, y: 1.5, z: 0 },
  { g: 'box', sx: 4.5, sy: 2.5, sz: 4, x: 0, y: 4.25, z: 0 },
  { g: 'box', sx: 2.6, sy: 5.5, sz: 2.6, x: 0, y: 8.25, z: 0 },
  { g: 'box', sx: 1.8, sy: 1, sz: 1.8, x: 0, y: 11.5, z: 0 },
  { g: 'box', sx: 0.1, sy: 2, sz: 0.1, x: -0.5, y: 13, z: 0 },
  { g: 'box', sx: 0.1, sy: 2, sz: 0.1, x: 0.5, y: 13, z: 0 },
  { g: 'cyl', rx: 1.1, sx: 0.55, sy: 0.1, sz: 0.55, x: 0.75, y: 12.4, z: 0.25 },
];

/**
 * The codex hall's mid-scale form pass: cornices on hall and entrance, steps up to the door,
 * banner fins flanking it, a mounted dish, and an asymmetric annex — accreted growth on a severe
 * symmetric body.
 */
const CODEX_HALL_FORM_PARTS: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 8, sy: 3.6, sz: 4.5, x: 0, y: 1.8, z: 0 },
  { g: 'box', sx: 3, sy: 5, sz: 4.8, x: 0, y: 2.5, z: 0.2 },
  { g: 'box', sx: 0.35, sy: 3.2, sz: 0.5, x: -3.3, y: 1.6, z: 2.3 },
  { g: 'box', sx: 0.35, sy: 3.2, sz: 0.5, x: -2.2, y: 1.6, z: 2.3 },
  { g: 'box', sx: 0.35, sy: 3.2, sz: 0.5, x: 2.2, y: 1.6, z: 2.3 },
  { g: 'box', sx: 0.35, sy: 3.2, sz: 0.5, x: 3.3, y: 1.6, z: 2.3 },
  { g: 'box', sx: 8.3, sy: 0.4, sz: 4.8, x: 0, y: 3.8, z: 0 },
  { g: 'box', sx: 3.3, sy: 0.4, sz: 5.1, x: 0, y: 5.15, z: 0.2 },
  { g: 'box', sx: 3.4, sy: 0.35, sz: 1, x: 0, y: 0.17, z: 2.9 },
  { g: 'box', sx: 2.8, sy: 0.7, sz: 0.6, x: 0, y: 0.35, z: 2.6 },
  { g: 'box', sx: 0.18, sy: 2.2, sz: 0.7, x: -1.35, y: 3.4, z: 2.5 },
  { g: 'box', sx: 0.18, sy: 2.2, sz: 0.7, x: 1.35, y: 3.4, z: 2.5 },
  { g: 'box', sx: 2, sy: 2.2, sz: 2.6, x: -2.6, y: 1.1, z: -3.3 },
];

/**
 * The gate massing per concept B1.6i — civic bastion checkpoint: two light towers flanking a
 * tall aperture under an emblem band, a dark accreted service crown behind, warm kiosks at the
 * bases. This box set is the plan-editor / footprint representation; the rendered building is
 * the hi-fi construction.
 */
const GATE_FORM_PARTS: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 4.6, sy: 11, sz: 3, x: -4.4, y: 5.5, z: 0 },
  { g: 'box', sx: 4.6, sy: 11, sz: 3, x: 4.4, y: 5.5, z: 0 },
  { g: 'box', sx: 13.6, sy: 3.7, sz: 2.9, x: 0, y: 9.15, z: 0 },
  { g: 'box', sx: 3.2, sy: 2.8, sz: 2.2, x: -4.5, y: 12.8, z: -0.6 },
  { g: 'box', sx: 3.6, sy: 3.6, sz: 2.4, x: 4.3, y: 13.2, z: -0.7 },
  { g: 'box', sx: 2.2, sy: 1.9, sz: 1.6, x: -5.6, y: 0.95, z: 1.9 },
  { g: 'box', sx: 2.2, sy: 1.9, sz: 1.6, x: 5.6, y: 0.95, z: 1.9 },
];

/**
 * The fountain's mid-scale form pass: a rim lip on the basin, four radial spout stubs, and a
 * band on the hub the instrument light sits over.
 */
const FOUNTAIN_FORM_PARTS: ReadonlyArray<SilhouettePart> = [
  { g: 'cyl', sx: 2, sy: 0.45, sz: 2, x: 0, y: 0.22, z: 0 },
  { g: 'cyl', sx: 1.35, sy: 0.4, sz: 1.35, x: 0, y: 0.62, z: 0 },
  { g: 'cyl', sx: 0.5, sy: 0.85, sz: 0.5, x: 0, y: 1.05, z: 0 },
  { g: 'cyl', sx: 2.15, sy: 0.16, sz: 2.15, x: 0, y: 0.5, z: 0 },
  { g: 'box', sx: 0.25, sy: 0.3, sz: 0.6, x: 1.35, y: 0.72, z: 0 },
  { g: 'box', sx: 0.25, sy: 0.3, sz: 0.6, x: -1.35, y: 0.72, z: 0 },
  { g: 'box', sx: 0.6, sy: 0.3, sz: 0.25, x: 0, y: 0.72, z: 1.35 },
  { g: 'box', sx: 0.6, sy: 0.3, sz: 0.25, x: 0, y: 0.72, z: -1.35 },
  { g: 'cyl', sx: 0.62, sy: 0.2, sz: 0.62, x: 0, y: 1.32, z: 0 },
];

/** Codex pick — archive stack: offset slabs piled on a heavy plinth, like bound records. */
const CODEX_ARCHIVE_STACK: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 7, sy: 2.5, sz: 5.5, x: 0, y: 1.25, z: 0 },
  { g: 'box', sx: 4, sy: 1.3, sz: 3.6, x: 0.3, y: 3.15, z: 0 },
  { g: 'box', sx: 3.8, sy: 1.3, sz: 3.5, x: -0.3, y: 4.45, z: 0 },
  { g: 'box', sx: 3.7, sy: 1.3, sz: 3.4, x: 0.25, y: 5.75, z: 0 },
  { g: 'box', sx: 3.5, sy: 1.3, sz: 3.3, x: -0.25, y: 7.05, z: 0 },
  { g: 'box', sx: 3.4, sy: 1.3, sz: 3.2, x: 0.15, y: 8.35, z: 0 },
  { g: 'box', sx: 3.2, sy: 1.3, sz: 3.1, x: -0.15, y: 9.65, z: 0 },
  { g: 'box', sx: 2.6, sy: 0.2, sz: 0.2, x: 0, y: 10.6, z: 0 },
  { g: 'box', sx: 0.1, sy: 1.6, sz: 0.1, x: 0, y: 11.2, z: 0 },
];

/** The plaza fountain as a part set, so the plan editor can move it like any other element. */
const FOUNTAIN_PARTS: ReadonlyArray<SilhouettePart> = [
  { g: 'cyl', sx: 2, sy: 0.45, sz: 2, x: 0, y: 0.22, z: 0 },
  { g: 'cyl', sx: 1.35, sy: 0.4, sz: 1.35, x: 0, y: 0.62, z: 0 },
  { g: 'cyl', sx: 0.5, sy: 0.85, sz: 0.5, x: 0, y: 1.05, z: 0 },
];

/**
 * The stash's mid-scale form pass: the asymmetric drums gain collar bands, a connecting pipe run,
 * a surface pipe with a valve wheel, a door frame toward the plaza, and a maintenance ladder.
 */
const STASH_FORM_PARTS: ReadonlyArray<SilhouettePart> = [
  { g: 'cyl', sx: 2.6, sy: 3.2, sz: 2.6, x: -1.4, y: 1.6, z: 0 },
  { g: 'cyl', sx: 1.7, sy: 2.3, sz: 1.7, x: 2.6, y: 1.15, z: 0 },
  { g: 'box', sx: 3.4, sy: 1.4, sz: 3, x: 0.6, y: 0.7, z: 0 },
  { g: 'box', sx: 1.1, sy: 0.5, sz: 1.1, x: -1.4, y: 3.45, z: 0 },
  { g: 'box', sx: 0.8, sy: 0.4, sz: 0.8, x: 2.6, y: 2.5, z: 0 },
  { g: 'box', sx: 0.15, sy: 1.1, sz: 0.15, x: 0.6, y: 1.9, z: 0 },
  { g: 'cyl', sx: 2.7, sy: 0.32, sz: 2.7, x: -1.4, y: 2.85, z: 0 },
  { g: 'cyl', sx: 2.7, sy: 0.28, sz: 2.7, x: -1.4, y: 0.35, z: 0 },
  { g: 'cyl', sx: 1.78, sy: 0.26, sz: 1.78, x: 2.6, y: 1.85, z: 0 },
  { g: 'box', sx: 2.4, sy: 0.22, sz: 0.22, x: 0.6, y: 2.35, z: 0.3 },
  { g: 'box', sx: 0.2, sy: 2.8, sz: 0.2, x: -3.95, y: 1.4, z: 0 },
  { g: 'cyl', rz: 1.5708, sx: 0.35, sy: 0.12, sz: 0.35, x: -4.15, y: 1.7, z: 0 },
  // the entrance vestibule: extruded out past the collar bands so the way in reads
  { g: 'box', sx: 1.2, sy: 1.5, sz: 0.9, x: -1.4, y: 0.75, z: 2.85 },
  { g: 'box', sx: 1.4, sy: 0.25, sz: 1.1, x: -1.4, y: 1.62, z: 2.85 },
  { g: 'box', sx: 0.35, sy: 2.2, sz: 0.08, x: 2.6, y: 1.1, z: 1.72 },
];

/** Codex non-tower A — archive hall: long severe symmetric hall, finned facade, roof instruments. */
const CODEX_ARCHIVE_HALL: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 8, sy: 3.6, sz: 4.5, x: 0, y: 1.8, z: 0 },
  { g: 'box', sx: 3, sy: 5, sz: 4.8, x: 0, y: 2.5, z: 0.2 },
  { g: 'box', sx: 0.35, sy: 3.2, sz: 0.5, x: -3.3, y: 1.6, z: 2.3 },
  { g: 'box', sx: 0.35, sy: 3.2, sz: 0.5, x: -2.2, y: 1.6, z: 2.3 },
  { g: 'box', sx: 0.35, sy: 3.2, sz: 0.5, x: 2.2, y: 1.6, z: 2.3 },
  { g: 'box', sx: 0.35, sy: 3.2, sz: 0.5, x: 3.3, y: 1.6, z: 2.3 },
  { g: 'box', sx: 0.1, sy: 1.8, sz: 0.1, x: 0.9, y: 5.9, z: 0 },
  { g: 'cyl', rx: 1.1, sx: 0.7, sy: 0.1, sz: 0.7, x: -0.9, y: 5.6, z: 0.2 },
];

/** Codex non-tower B — listening bowl: a large tilted dish cradled on a low drum plinth. */
const CODEX_LISTENING_BOWL: ReadonlyArray<SilhouettePart> = [
  { g: 'cyl', sx: 3.2, sy: 2, sz: 3.2, x: 0, y: 1, z: 0 },
  { g: 'cyl', sx: 2.2, sy: 0.8, sz: 2.2, x: 0, y: 2.4, z: 0 },
  { g: 'cyl', rx: 0.95, sx: 3.1, sy: 0.22, sz: 3.1, x: 0, y: 4, z: -0.4 },
  { g: 'box', rz: 0.5, sx: 0.5, sy: 2.6, sz: 0.7, x: -2.2, y: 3, z: 0 },
  { g: 'box', rz: -0.5, sx: 0.5, sy: 2.6, sz: 0.7, x: 2.2, y: 3, z: 0 },
  { g: 'box', sx: 1.8, sy: 1.4, sz: 1.8, x: 3.6, y: 0.7, z: 1 },
];

/** Codex non-tower C — records precinct: a walled compound, record blocks rising above the wall. */
const CODEX_PRECINCT: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 2.8, sy: 2.4, sz: 0.6, x: -2.4, y: 1.2, z: 2.2 },
  { g: 'box', sx: 2.8, sy: 2.4, sz: 0.6, x: 2.4, y: 1.2, z: 2.2 },
  { g: 'box', sx: 0.6, sy: 2.4, sz: 5, x: -3.8, y: 1.2, z: 0 },
  { g: 'box', sx: 0.6, sy: 2.4, sz: 5, x: 3.8, y: 1.2, z: 0 },
  { g: 'box', sx: 8.2, sy: 2.4, sz: 0.6, x: 0, y: 1.2, z: -2.4 },
  { g: 'box', sx: 2.6, sy: 0.5, sz: 0.8, x: 0, y: 2.7, z: 2.2 },
  { g: 'box', sx: 2.2, sy: 3.4, sz: 2, x: -1.8, y: 1.7, z: -0.6 },
  { g: 'box', sx: 2, sy: 4, sz: 1.8, x: 1.6, y: 2, z: -1 },
  { g: 'box', sx: 1.6, sy: 2.8, sz: 1.6, x: 0.1, y: 1.4, z: 0.6 },
  { g: 'box', sx: 0.1, sy: 1.8, sz: 0.1, x: 1.6, y: 4.9, z: -1 },
];

/** Gate new-A — bastion slot: battered symmetric walls, deep header, centered beacon. */
const GATE_BASTION_SLOT: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 4.4, sy: 1.4, sz: 2.2, x: -3.9, y: 0.7, z: 0 },
  { g: 'box', sx: 4.4, sy: 1.4, sz: 2.2, x: 3.9, y: 0.7, z: 0 },
  { g: 'box', sx: 3.6, sy: 4.6, sz: 1.8, x: -3.7, y: 3.7, z: 0 },
  { g: 'box', sx: 3.6, sy: 4.6, sz: 1.8, x: 3.7, y: 3.7, z: 0 },
  { g: 'box', sx: 11, sy: 1.4, sz: 1.8, x: 0, y: 6.7, z: 0 },
  { g: 'box', sx: 1.6, sy: 1, sz: 1.2, x: 0, y: 7.9, z: 0 },
  { g: 'box', sx: 0.1, sy: 1.5, sz: 0.1, x: -4.9, y: 8, z: 0 },
  { g: 'box', sx: 0.1, sy: 1.5, sz: 0.1, x: 4.9, y: 8, z: 0 },
];

interface LineupElement {
  readonly camZ: number;
  readonly candidates: ReadonlyArray<ReadonlyArray<SilhouettePart>>;
  readonly key: string;
  readonly lookY: number;
  readonly name: string;
  readonly spacing: number;
}

/**
 * Revision lineups for the elements still being designed. Candidate order is A, B, C left to
 * right.
 */
const LINEUP_ELEMENTS: ReadonlyArray<LineupElement> = [
  {
    camZ: 26,
    key: 'lineup-market-form',
    lookY: 2.8,
    name: 'S · market',
    spacing: 18,
    candidates: [MARKET_PARTS, MARKET_FORM_PARTS],
  },
  {
    camZ: 27,
    key: 'lineup-stash-form',
    lookY: 2.2,
    name: 'S · stash',
    spacing: 12,
    candidates: [STASH_DOUBLE_DRUM, STASH_FORM_PARTS],
  },
  {
    camZ: 24,
    key: 'lineup-codex-form',
    lookY: 3,
    name: 'S · codex',
    spacing: 14,
    candidates: [CODEX_ARCHIVE_HALL, CODEX_HALL_FORM_PARTS],
  },
  {
    camZ: 24,
    key: 'lineup-gate-form',
    lookY: 4,
    name: 'S · gate',
    spacing: 16,
    candidates: [GATE_BASTION_SLOT, GATE_FORM_PARTS],
  },
  {
    camZ: 13,
    key: 'lineup-fountain-form',
    lookY: 1,
    name: 'S · fountain',
    spacing: 7,
    candidates: [FOUNTAIN_PARTS, FOUNTAIN_FORM_PARTS],
  },
];

const SILHOUETTE_SKY = '#3a4670';

const partGeometries = {
  box: new BoxGeometry(1, 1, 1),
  cyl: new CylinderGeometry(1, 1, 1, 32),
  sphere: new SphereGeometry(1, 32, 20),
};

/**
 * The gate's final-fidelity build per concept B1.6i. Light civic-concrete towers and emblem
 * band frame a tall aperture traced by a thin inset teal system-light frame; a dark accreted
 * service crown stacks behind and above with sparse ordered amber markers; warm-lit guard
 * kiosks shelter at the bases; three worn slabs floor the threshold. All placement jitter is
 * deterministic.
 */
function renderGateHiFi(
  scene: Scene,
  civic: MeshStandardNodeMaterial,
  core: MeshStandardNodeMaterial,
  trim: MeshStandardNodeMaterial,
  anchorX: number,
  anchorZ: number,
  ry: number,
) {
  const group = new Group();
  const chamfer = (w: number, h: number, d: number, radius: number) =>
    new RoundedBoxGeometry(w, h, d, 2, radius);
  const add = (
    material: MeshStandardNodeMaterial | MeshBasicNodeMaterial,
    geometry: RoundedBoxGeometry | BoxGeometry,
    px: number,
    py: number,
    pz: number,
    rx = 0,
    rz = 0,
    yaw = 0,
  ) => {
    const mesh = new Mesh(geometry, material);

    mesh.position.set(px, py, pz);
    mesh.rotation.set(rx, yaw, rz, 'YXZ');
    group.add(mesh);
  };

  // civic towers: plinth, two shaft slabs (upper slightly inset), cap course
  for (const side of [-1, 1]) {
    add(civic, chamfer(5, 1.2, 3.4, 0.07), side * 4.4, 0.6, 0);
    add(civic, chamfer(4.6, 4.9, 3, 0.08), side * 4.4, 3.65, 0);
    add(civic, chamfer(4.5, 4.8, 2.9, 0.08), side * 4.42, 8.5, 0.02);
    add(civic, chamfer(4.8, 0.5, 3.15, 0.05), side * 4.4, 11.15, 0);
  }

  // emblem band spanning the towers above the aperture, face recessed behind the tower faces
  add(civic, chamfer(13.6, 3.7, 2.9, 0.08), 0, 9.15, 0);

  // emblem: dark plate proud of the band, carrying the authority glyph in trim relief
  add(core, chamfer(2.7, 2.7, 0.24, 0.03), 0, 9.15, 1.5);
  add(trim, chamfer(0.2, 1.4, 0.14, 0.02), -0.62, 8.75, 1.66);
  add(trim, chamfer(0.2, 1.4, 0.14, 0.02), 0.62, 8.75, 1.66);
  add(trim, chamfer(0.2, 1.5, 0.14, 0.02), -0.35, 9.72, 1.66, 0, -0.52);
  add(trim, chamfer(0.2, 1.5, 0.14, 0.02), 0.35, 9.72, 1.66, 0, 0.52);

  // teal system-light frame tracing the aperture, inset from the tower faces
  const frameMaterial = new MeshBasicNodeMaterial({ color: new Color(GATE_TEAL).multiplyScalar(1.7) });

  add(frameMaterial, new BoxGeometry(0.14, 7.3, 0.14), -2.17, 3.65, 1.3);
  add(frameMaterial, new BoxGeometry(0.14, 7.3, 0.14), 2.17, 3.65, 1.3);
  add(frameMaterial, new BoxGeometry(4.62, 0.14, 0.14), 0, 7.37, 1.3);

  // dark service crown: asymmetric accreted stacks behind and above, modules clinging to flanks
  const coreModules = [
    { h: 1.6, w: 3.2, x: -4.5, y: 12.25, z: -0.5, d: 2.2 },
    { h: 1.1, w: 2.1, x: -4.9, y: 13.6, z: -0.8, d: 1.7 },
    { h: 2, w: 3.6, x: 4.3, y: 12.45, z: -0.5, d: 2.4 },
    { h: 1.4, w: 2.4, x: 4.7, y: 14.15, z: -0.9, d: 1.9 },
    { h: 0.9, w: 1.4, x: 4.2, y: 15.25, z: -0.6, d: 1.3 },
    { h: 1.3, w: 2.6, x: 0.3, y: 11.65, z: -0.9, d: 2 },
    { h: 2.2, w: 1.5, x: -7.3, y: 7.6, z: -0.3, d: 1.9 },
    { h: 1.7, w: 1.3, x: 7.25, y: 5.9, z: 0.2, d: 1.6 },
  ];

  for (const module of coreModules) {
    add(core, chamfer(module.w, module.h, module.d, 0.05), module.x, module.y, module.z);
  }

  // slim masts crown the service stacks
  add(trim, chamfer(0.12, 2.4, 0.12, 0.02), 4.7, 16.05, -0.9);
  add(trim, chamfer(0.1, 1.7, 0.1, 0.02), -4.9, 15, -0.8);

  // ordered amber service markers, sparse, seated at module corners
  const markerMaterial = new MeshBasicNodeMaterial({ color: new Color('#ffb04d').multiplyScalar(1.2) });

  for (const marker of [
    { x: -4.5, y: 12.9, z: 0.65 },
    { x: 4.3, y: 13.3, z: 0.75 },
    { x: 4.7, y: 14.75, z: 0.1 },
    { x: -7.3, y: 8.6, z: 0.7 },
    { x: 7.25, y: 6.65, z: 1.05 },
  ]) {
    add(markerMaterial, new BoxGeometry(0.09, 0.09, 0.09), marker.x, marker.y, marker.z);
  }

  // guard kiosks: civic body, dark canopy, warm-lit window — the inhabited base
  const kioskGlow = new MeshBasicNodeMaterial({ color: new Color(WARM_WINDOW).multiplyScalar(1.5) });

  for (const side of [-1, 1]) {
    add(civic, chamfer(2.2, 1.9, 1.6, 0.06), side * 5.6, 0.95, 1.9);
    add(core, chamfer(2.7, 0.16, 2.1, 0.03), side * 5.6, 2.02, 2.05);
    add(kioskGlow, new BoxGeometry(1.3, 0.55, 0.06), side * 5.6, 1.1, 2.72);
  }

  // threshold: three separate worn slabs, each seated at its own slight angle
  add(civic, chamfer(1.7, 0.28, 2.5, 0.06), -1.35, 0.14, 0.62, 0, 0, 0.04);
  add(civic, chamfer(1.5, 0.3, 2.6, 0.06), 0.25, 0.15, 0.58, 0, 0, -0.03);
  add(civic, chamfer(1.4, 0.26, 2.45, 0.06), 1.75, 0.13, 0.66, 0, 0, 0.05);

  group.position.set(anchorX, 0, anchorZ);
  group.rotation.y = ry;
  scene.add(group);
}

function renderPartSet(
  scene: Scene,
  parts: ReadonlyArray<SilhouettePart>,
  material: MeshStandardNodeMaterial | MeshBasicNodeMaterial,
  anchorX: number,
  anchorZ: number,
  ry: number,
) {
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);

  for (const part of parts) {
    const mesh = new Mesh(partGeometries[part.g], material);
    const x = anchorX + part.x * cos + part.z * sin;
    const z = anchorZ - part.x * sin + part.z * cos;

    // yaw must compose before the part's local tilts, matching the plan editor's group nesting
    mesh.position.set(x, part.y, z);
    mesh.rotation.set(part.rx ?? 0, ry, part.rz ?? 0, 'YXZ');
    mesh.scale.set(part.sx, part.sy, part.sz);
    scene.add(mesh);
  }
}

function buildLineupScene(element: LineupElement): Scene {
  const scene = new Scene();

  scene.background = new Color(SILHOUETTE_SKY);

  // ground barely darker than the sky: the base line reads without swallowing the profiles
  const ground = new Mesh(
    new PlaneGeometry(300, 120),
    new MeshStandardNodeMaterial({ color: new Color('#323d61'), roughness: 1 }),
  );

  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // shaded profiles: dark faces under a soft key, so form separates while silhouette dominates
  const ambient = new AmbientLight(new Color('#39406b'), 1.2);
  const key = new DirectionalLight(new Color('#8fa0c2'), 1.7);

  key.position.set(-18, 26, 34);
  scene.add(ambient, key);

  const material = new MeshStandardNodeMaterial({ color: new Color('#1a2032'), roughness: 0.85 });

  for (const [index, candidate] of element.candidates.entries()) {
    const offset = (index - (element.candidates.length - 1) / 2) * element.spacing;

    renderPartSet(scene, candidate, material, offset, 0, 0);
  }

  return scene;
}

const HALF_PI = 1.5708;

interface AssemblyPlacement {
  readonly key: string;
  /** Light a window grid on every substantial box, not only the largest — for stacked-slab forms. */
  readonly litAllBoxes?: boolean;
  /** A threshold or furniture piece, not an occupied building — no window grid. */
  readonly noWindows?: boolean;
  parts: ReadonlyArray<SilhouettePart>;
  ry: number;
  x: number;
  z: number;
}

/**
 * The live layout: each element's part set at its plaza anchor. Yaw turns each set's authored
 * front (+z) toward the plaza. Mutated by the plan editor; the assembly view rebuilds from it.
 */
const placements: Array<AssemblyPlacement> = [
  { key: 'market', parts: MARKET_FORM_PARTS, ry: 8.631, x: -9, z: 15.5 },
  { key: 'stash', parts: STASH_FORM_PARTS, ry: 7.913, x: -15, z: -5.3 },
  { key: 'codex', litAllBoxes: true, parts: CODEX_HALL_FORM_PARTS, ry: 0.36, x: -10.9, z: -14.9 },
  { key: 'gate', noWindows: true, parts: GATE_FORM_PARTS, ry: -0.15, x: 7.4, z: -17.7 },
  { key: 'avatar', parts: AVATAR_PARTS, ry: -1.501, x: -14.2, z: 3.9 },
  { key: 'fountain', noWindows: true, parts: FOUNTAIN_FORM_PARTS, ry: 0, x: -1.1, z: -4.2 },
];

interface Footprint {
  readonly angle: number;
  readonly cx: number;
  readonly cz: number;
  readonly hd: number;
  readonly hw: number;
  readonly kind: 'circle' | 'rect';
  readonly label: string;
  /** Vertical extent, so an overhang doesn't false-flag against a low block beneath it. */
  readonly y0: number;
  readonly y1: number;
}

function collectFootprints(): Array<Footprint> {
  const footprints: Array<Footprint> = [];

  for (const placement of placements) {
    for (const part of placement.parts) {
      // masts and other whisker-thin parts can't meaningfully collide
      if (part.sx < 0.3 && part.sz < 0.3) {
        continue;
      }

      const world = toWorldOffset(placement.x, placement.z, placement.ry, part.x, part.z);
      const round = part.g !== 'box';

      footprints.push({
        angle: round ? 0 : placement.ry,
        cx: world.x,
        cz: world.z,
        hd: round ? part.sx : part.sz / 2,
        hw: round ? part.sx : part.sx / 2,
        kind: round ? 'circle' : 'rect',
        label: placement.key,
        y0: part.y - part.sy / 2,
        y1: part.y + part.sy / 2,
      });
    }
  }

  for (const [index, spec] of massing.entries()) {
    if (isNavRole(spec.role)) {
      continue;
    }

    footprints.push({
      angle: spec.ry,
      cx: spec.x,
      cz: spec.z,
      hd: spec.d / 2,
      hw: spec.w / 2,
      kind: 'rect',
      label: `${spec.role}${index}`,
      y0: 0,
      y1: spec.h,
    });
  }

  return footprints;
}

function buildCorners(footprint: Footprint): Array<[number, number]> {
  const cos = Math.cos(footprint.angle);
  const sin = Math.sin(footprint.angle);
  const corners: Array<[number, number]> = [];

  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const lx = sx * footprint.hw;
    const lz = sz * footprint.hd;

    corners.push([footprint.cx + lx * cos + lz * sin, footprint.cz - lx * sin + lz * cos]);
  }

  return corners;
}

function isSeparatedOnAxis(
  a: ReadonlyArray<[number, number]>,
  b: ReadonlyArray<[number, number]>,
  axisX: number,
  axisZ: number,
): boolean {
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;

  for (const [x, z] of a) {
    const projection = x * axisX + z * axisZ;

    minA = Math.min(minA, projection);
    maxA = Math.max(maxA, projection);
  }

  for (const [x, z] of b) {
    const projection = x * axisX + z * axisZ;

    minB = Math.min(minB, projection);
    maxB = Math.max(maxB, projection);
  }

  return maxA < minB || maxB < minA;
}

function isCircleRectOverlap(circle: Footprint, rect: Footprint): boolean {
  // rotate the circle center into the rect's local frame, then clamp to the half extents
  const cos = Math.cos(rect.angle);
  const sin = Math.sin(rect.angle);
  const dx = circle.cx - rect.cx;
  const dz = circle.cz - rect.cz;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const nx = Math.max(-rect.hw, Math.min(rect.hw, lx));
  const nz = Math.max(-rect.hd, Math.min(rect.hd, lz));

  return (lx - nx) ** 2 + (lz - nz) ** 2 < circle.hw ** 2;
}

function isFootprintOverlap(a: Footprint, b: Footprint): boolean {
  if (a.y1 <= b.y0 || b.y1 <= a.y0) {
    return false;
  }

  if (a.kind === 'circle' && b.kind === 'circle') {
    return (a.cx - b.cx) ** 2 + (a.cz - b.cz) ** 2 < (a.hw + b.hw) ** 2;
  }

  if (a.kind === 'circle') {
    return isCircleRectOverlap(a, b);
  }

  if (b.kind === 'circle') {
    return isCircleRectOverlap(b, a);
  }

  const cornersA = buildCorners(a);
  const cornersB = buildCorners(b);

  for (const angle of [a.angle, b.angle]) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    if (
      isSeparatedOnAxis(cornersA, cornersB, cos, -sin) ||
      isSeparatedOnAxis(cornersA, cornersB, sin, cos)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Every pair of intersecting footprints across placements and the fixed massing, as
 * "market×stash"-style labels — the machine check that replaces eyeballing the render.
 */
function findOverlaps(): Array<string> {
  const footprints = collectFootprints();
  const movable = new Set(placements.map((placement) => placement.key));
  const seen = new Set<string>();

  for (let a = 0; a < footprints.length; a += 1) {
    for (let b = a + 1; b < footprints.length; b += 1) {
      const fa = footprints[a];
      const fb = footprints[b];

      if (!fa || !fb || fa.label === fb.label) {
        continue;
      }

      // background-on-background contact is the overbuilt accretion look, by design; everything
      // else counts as a defect
      if (!movable.has(fa.label) && !movable.has(fb.label) && fa.label.startsWith('back') && fb.label.startsWith('back')) {
        continue;
      }

      const pair = [fa.label, fb.label].sort().join('×');

      if (!seen.has(pair) && isFootprintOverlap(fa, fb)) {
        seen.add(pair);
      }
    }
  }

  return [...seen].sort();
}

/** Windows for an assembled part set: a lit grid on the front face of its largest box. */
function buildPartSetWindows(placement: AssemblyPlacement, config: ProbeConfig, seed: number): Array<EmissiveInstance> {
  const random = makeRandom(seed);
  const windows: Array<EmissiveInstance> = [];
  const largest = [...placement.parts].sort((a, b) => b.sx * b.sy - a.sx * a.sy)[0];

  // a cylinder-bodied building gets a radial window ring instead of a facade grid
  if (largest && largest.g === 'cyl') {
    const radius = largest.sx + 0.08;
    const litChance = Math.min(0.92, config.litChance * 1.9);

    for (const y of [largest.y - largest.sy * 0.3, largest.y + largest.sy * 0.15]) {
      for (let step = 0; step < 10; step += 1) {
        const angle = (step / 10) * Math.PI * 2;
        const world = toWorldOffset(
          placement.x,
          placement.z,
          placement.ry,
          largest.x + Math.cos(angle) * radius,
          largest.z + Math.sin(angle) * radius,
        );

        windows.push({ color: pickWindowColor(config, random, y, litChance), x: world.x, y, z: world.z });
      }
    }

    // the stash's door sits on its extruded vestibule face, past the drum radius
    const doorLz = largest.z + radius + (placement.key === 'stash' ? 0.68 : 0);
    const door = toWorldOffset(placement.x, placement.z, placement.ry, largest.x, doorLz);

    windows.push({ color: new Color(WARM_WINDOW).multiplyScalar(2.6), x: door.x, y: 0.75, z: door.z });

    return windows;
  }

  const boxes = placement.parts.filter((part) => part.g === 'box');
  const main = boxes.toSorted((a, b) => b.sx * b.sy - a.sx * a.sy)[0];

  if (!main) {
    return windows;
  }

  const litBoxes = placement.litAllBoxes
    ? boxes.filter((box) => box.sx >= 2 && box.sy >= 1.2)
    : [main];

  for (const box of litBoxes) {
    const cols = Math.max(1, Math.floor((box.sx - 0.6) / 0.6));
    const rowCount = Math.max(1, Math.floor((box.sy - 0.5) / 0.7));
    const step = cols > 1 ? (box.sx - 0.9) / (cols - 1) : 0;
    const chanceScale = box === main ? 1.9 : 1.1;
    const litChance = Math.min(0.92, config.litChance * chanceScale);

    for (let col = 0; col < cols; col += 1) {
      for (let row = 0; row < rowCount; row += 1) {
        const lx = box.x - (box.sx - 0.9) / 2 + col * step;
        const y = box.y + box.sy / 2 - 0.5 - row * 0.7;
        const world = toWorldOffset(placement.x, placement.z, placement.ry, lx, box.z + box.sz / 2 + 0.04);

        windows.push({ color: pickWindowColor(config, random, y, litChance), x: world.x, y, z: world.z });
      }
    }
  }

  const door = toWorldOffset(placement.x, placement.z, placement.ry, main.x, main.z + main.sz / 2 + 0.06);

  windows.push({ color: new Color(WARM_WINDOW).multiplyScalar(2.6), x: door.x, y: 0.75, z: door.z });

  return windows;
}

const dummy = new Object3D();

/**
 * Tuner: every surface/grade/light constant is a knob the panel can drive live. Uniform-backed
 * knobs update their TSL node in place (no rebuild); setter knobs re-apply onto whatever live
 * scene objects the latest build registered in liveRefs.
 */
type UniformKnob = ReturnType<typeof uniform<number>>;

type Knob = number | UniformKnob;

interface TunerKnob {
  readonly apply: (value: number) => void;
  readonly defaultValue: number;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly path: string;
  readonly step: number;
  value: number;
}

const tunerKnobs: Array<TunerKnob> = [];

function toKnobLabel(path: string): string {
  return (path.split('.')[1] ?? path).replaceAll(/([A-Z\d])/g, ' $1').toLowerCase();
}

function makeKnob(path: string, value: number, min: number, max: number, step = 0.01): UniformKnob {
  const node = uniform(value);

  tunerKnobs.push({
    apply: (next) => {
      node.value = next;
    },
    defaultValue: value,
    label: toKnobLabel(path),
    max,
    min,
    path,
    step,
    value,
  });

  return node;
}

function registerKnob(
  path: string,
  value: number,
  min: number,
  max: number,
  apply: (value: number) => void,
  step = 0.01,
) {
  tunerKnobs.push({ apply, defaultValue: value, label: toKnobLabel(path), max, min, path, step, value });
}

function applyTunerKnobs() {
  for (const knob of tunerKnobs) {
    knob.apply(knob.value);
  }
}

function buildTunerConfig(): Record<string, Record<string, number>> {
  const config: Record<string, Record<string, number>> = {};

  for (const knob of tunerKnobs) {
    const [section = 'misc', name = knob.path] = knob.path.split('.');

    (config[section] ??= {})[name] = Math.round(knob.value * 1000) / 1000;
  }

  return config;
}

type KnobSpec = readonly [value: number, min: number, max: number, step?: number];

function makeKnobGroup<K extends string>(
  section: string,
  specs: Readonly<Record<K, KnobSpec>>,
): Record<K, UniformKnob> {
  const group = {} as Record<K, UniformKnob>;

  for (const key of Object.keys(specs) as Array<K>) {
    const [value, min, max, step] = specs[key];

    group[key] = makeKnob(`${section}.${key}`, value, min, max, step);
  }

  return group;
}

/**
 * Hover interactivity: the five nav buildings are the menu. Pick boxes are invisible raycast
 * volumes built from each placement's footprint parts; the materials map is what a hover lifts.
 */
const NAV_HOVER_KEYS = ['market', 'stash', 'codex', 'gate', 'avatar'];

const hoverPickBoxes: Array<Mesh> = [];
const hoverMaterials: Record<string, Array<{ emissive: Color }>> = {};

/** Live scene objects the current view registered for setter knobs; null outside tuned views. */
const liveRefs = {
  ambient: null as AmbientLight | null,
  bloom: null as { strength: { value: number }; threshold: { value: number } } | null,
  bounce: null as HemisphereLight | null,
  gateGlow: null as PointLight | null,
  keyLight: null as DirectionalLight | null,
  fog: null as Fog | null,
  lamps: [] as Array<PointLight>,
  materials: {} as Record<string, MeshStandardNodeMaterial>,
  spills: [] as Array<{ base: number; light: PointLight }>,
  washes: [] as Array<{ base: number; light: PointLight }>,
};

const groundingKnobs = makeKnobGroup('grounding', {
  falloff: [0.67, 0.05, 1],
  depth: [0.1, 0, 1],
});

/**
 * Grounding occlusion: ambient light falls off toward the base of every structure, faking
 * contact shadow where buildings meet the pavement. Applied via aoNode so emissives stay clean.
 */
const groundingNode = positionWorld.y
  .mul(groundingKnobs.falloff)
  .clamp(0, 1)
  .mul(groundingKnobs.depth)
  .add(groundingKnobs.depth.oneMinus());

function applyGrounding(material: MeshStandardNodeMaterial) {
  material.aoNode = groundingNode;
}

/**
 * Surface toolbox. Both texture tools survive — organic noise and quantized cells — but neither
 * is ever applied uniformly: each building's recipe composes them selectively, anchored to its
 * architecture, with large areas of rest. Contributions are centered on zero and added to 1.
 */
function buildGrain(amp: Knob = 0.04) {
  return mx_noise_float(positionWorld.mul(16)).mul(amp);
}

function buildOrganic(scale: Knob, amp: Knob) {
  return mx_noise_float(positionWorld.mul(scale)).mul(amp);
}

/** Constant tone per quantized cell — the paneling tool. */
function buildPanels(cellX: Knob, cellY: Knob, cellZ: Knob, amp: Knob) {
  const cell = vec3(
    positionWorld.x.mul(cellX).floor(),
    positionWorld.y.mul(cellY).floor(),
    positionWorld.z.mul(cellZ).floor(),
  );

  return mx_noise_float(cell.mul(0.37)).mul(amp);
}

/** A single darker shadow line at one architectural height — under a cornice, along a course. */
function buildCourseShadow(height: Knob, halfWidth: Knob, depth: Knob) {
  return positionWorld.y.sub(height).abs().smoothstep(0, halfWidth).oneMinus().mul(depth);
}

/** Weathering that belongs low on a wall: organic noise faded out above the given band. */
function buildLowWear(scale: Knob, amp: Knob, fadeFrom: Knob, fadeTo: Knob) {
  const mask = positionWorld.y.smoothstep(fadeFrom, fadeTo).oneMinus();

  return mx_noise_float(positionWorld.mul(scale)).mul(amp).mul(mask);
}

const marketKnobs = makeKnobGroup('market', {
  cellX: [0.7, 0.05, 3, 0.05],
  cellY: [0.95, 0.05, 3, 0.05],
  cellZ: [0.7, 0.05, 3, 0.05],
  panelAmp: [0.34, 0, 1],
  grainAmp: [0.07, 0, 0.3, 0.005],
  clampLo: [0.6, 0, 1],
  clampHi: [1.25, 1, 2],
});

const stashKnobs = makeKnobGroup('stash', {
  bandCellY: [1.7, 0.05, 4, 0.05],
  bandAmp: [0.24, 0, 1],
  wearScale: [2.2, 0.05, 6, 0.05],
  wearAmp: [0.34, 0, 1],
  wearFadeFrom: [0.8, 0, 6, 0.1],
  wearFadeTo: [3.2, 0, 8, 0.1],
  grainAmp: [0.06, 0, 0.3, 0.005],
  clampLo: [0.55, 0, 1],
  clampHi: [1.2, 1, 2],
});

const codexKnobs = makeKnobGroup('codex', {
  mottleScale: [0.3, 0.05, 3, 0.05],
  mottleAmp: [0.12, 0, 1],
  courseHeight: [3.68, 0, 8, 0.02],
  courseWidth: [0.16, 0.02, 1],
  courseDepth: [0.2, 0, 1],
  grainAmp: [0.06, 0, 0.3, 0.005],
  clampLo: [0.72, 0, 1],
  clampHi: [1.14, 1, 2],
});

const gateKnobs = makeKnobGroup('gate', {
  civicCellX: [1.6, 0.1, 3, 0.05],
  civicCellY: [0.55, 0.1, 3, 0.05],
  civicPanelAmp: [0.55, 0, 1],
  civicWearAmp: [0.18, 0, 1],
  civicWearFadeTo: [3.5, 0.5, 9, 0.1],
  civicClampLo: [0.78, 0, 1],
  civicClampHi: [1.12, 1, 2],
  coreBandCellY: [1.9, 0.1, 4, 0.05],
  coreBandAmp: [0.3, 0, 1],
  coreClampLo: [0.6, 0, 1],
  coreClampHi: [1.15, 1, 2],
  grainAmp: [0.205, 0, 0.3, 0.005],
});

const avatarKnobs = makeKnobGroup('avatar', {
  bandCellY: [1.4, 0.05, 4, 0.05],
  bandAmp: [0.2, 0, 1],
  grainAmp: [0.06, 0, 0.3, 0.005],
  clampLo: [0.66, 0, 1],
  clampHi: [1.18, 1, 2],
});

const fountainKnobs = makeKnobGroup('fountain', {
  mottleScale: [0.8, 0.05, 3, 0.05],
  mottleAmp: [0.18, 0, 1],
  grainAmp: [0.06, 0, 0.3, 0.005],
  clampLo: [0.72, 0, 1],
  clampHi: [1.16, 1, 2],
});

const groundKnobs = makeKnobGroup('ground', {
  paverCell: [0.05, 0.05, 1.5],
  paverAmp: [0.37, 0, 1],
  jointDepth: [0.07, 0, 1],
  wearScale: [0.22, 0.05, 3],
  wearAmp: [0.16, 0, 1],
  grainAmp: [0.05, 0, 0.3, 0.005],
  clampLo: [0.77, 0, 1],
  clampHi: [1.14, 1, 2],
});

for (const [buildingKey, roughness] of [
  ['market', 0.85],
  ['stash', 0.55],
  ['codex', 0.85],
  ['gate', 0.34],
  ['avatar', 0.85],
  ['fountain', 0.85],
] as const) {
  registerKnob(`${buildingKey}.roughness`, roughness, 0, 1, (value) => {
    const material = liveRefs.materials[buildingKey];

    if (material) {
      material.roughness = value;
    }
  });
}

registerKnob('light.ambient', NIGHT.ambientIntensity * 0.7, 0, 4, (value) => {
  if (liveRefs.ambient) {
    liveRefs.ambient.intensity = value;
  }
});
registerKnob('light.bounce', 1.05, 0, 4, (value) => {
  if (liveRefs.bounce) {
    liveRefs.bounce.intensity = value;
  }
});
registerKnob('light.keyLight', NIGHT.dirIntensity * 1.6, 0, 6, (value) => {
  if (liveRefs.keyLight) {
    liveRefs.keyLight.intensity = value;
  }
});
registerKnob(
  'light.gateGlow',
  30,
  0,
  80,
  (value) => {
    if (liveRefs.gateGlow) {
      liveRefs.gateGlow.intensity = value;
    }
  },
  0.5,
);
registerKnob(
  'light.fogNear',
  NIGHT.fogNear,
  5,
  200,
  (value) => {
    if (liveRefs.fog) {
      liveRefs.fog.near = value;
    }
  },
  1,
);
registerKnob(
  'light.fogFar',
  NIGHT.fogFar,
  20,
  400,
  (value) => {
    if (liveRefs.fog) {
      liveRefs.fog.far = value;
    }
  },
  1,
);
registerKnob('light.entranceSpill', 1, 0, 3, (value) => {
  for (const spill of liveRefs.spills) {
    spill.light.intensity = spill.base * value;
  }
});
registerKnob('light.gateWash', 1, 0, 3, (value) => {
  for (const wash of liveRefs.washes) {
    wash.light.intensity = wash.base * value;
  }
});

/**
 * The lighting-cohesion fixtures: every entrance carries a warm wall-mounted light throwing
 * sodium onto its own facade — the entrance rule doubled as the lighting logic — and the gate
 * gets low teal uplights grazing its worn slab faces. Positions are in each building's local
 * frame (front is +z), transformed by its placement at build time.
 */
interface SpillFixture {
  readonly color: string;
  readonly distance: number;
  readonly intensity: number;
  readonly key: string;
  readonly kind: 'spill' | 'wash';
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const SPILL_FIXTURES: ReadonlyArray<SpillFixture> = [
  // market: under-canopy lights over the stall row
  { color: WARM_WINDOW, distance: 6, intensity: 7, key: 'market', kind: 'spill', x: -2.4, y: 1.75, z: 2.5 },
  { color: WARM_WINDOW, distance: 6, intensity: 7, key: 'market', kind: 'spill', x: 2.4, y: 1.75, z: 2.5 },
  { color: WARM_WINDOW, distance: 5, intensity: 5, key: 'market', kind: 'spill', x: -4.8, y: 1.75, z: 2.5 },
  // stash: one lamp over the vestibule lintel
  { color: WARM_WINDOW, distance: 5, intensity: 6, key: 'stash', kind: 'spill', x: -1.4, y: 1.95, z: 3.15 },
  // codex: a pair flanking the entrance block, inside the banner fins
  { color: WARM_WINDOW, distance: 6, intensity: 4.5, key: 'codex', kind: 'spill', x: -1, y: 2.7, z: 2.8 },
  { color: WARM_WINDOW, distance: 6, intensity: 4.5, key: 'codex', kind: 'spill', x: 1, y: 2.7, z: 2.8 },
  // avatar: one over the entrance kiosk beside the drum
  { color: WARM_WINDOW, distance: 5, intensity: 5, key: 'avatar', kind: 'spill', x: 2.9, y: 1.4, z: 0.9 },
  // gate: teal uplights a step out from each wall so the throw climbs the slab face
  { color: GATE_TEAL, distance: 9, intensity: 8, key: 'gate', kind: 'wash', x: -3.7, y: 0.3, z: 1.7 },
  { color: GATE_TEAL, distance: 9, intensity: 8, key: 'gate', kind: 'wash', x: 3.7, y: 0.3, z: 1.7 },
];

const inkKnobs = makeKnobGroup('ink', {
  width: [1, 0, 6, 0.1],
  depthThreshold: [0.015, 0.001, 0.2, 0.001],
  normalThreshold: [0.35, 0.05, 3, 0.05],
  strength: [0.55, 0, 1],
});

/**
 * The authored gate model, loaded once at boot; scale maps its real-world 42 m down onto the
 * composition's 16-unit gate height. Yaw corrects the export's forward axis onto the
 * placement's plaza-facing +z once verified visually.
 */
let gateModel: Group | null = null;

const GATE_MODEL_SCALE = 0.38;
const GATE_MODEL_YAW = 0;

const atmoKnobs = makeKnobGroup('atmo', {
  bankOpacity: [0.23, 0, 0.8],
  mistOpacity: [0.26, 0, 0.8],
  hazeOpacity: [0.56, 0, 1],
  smokeOpacity: [0.16, 0, 1],
  fogWall: [0.31, 0, 1],
  fogSea: [0.7, 0, 1],
  fogRadius: [23, 5, 45, 0.5],
  drift: [0.07, 0, 0.3, 0.005],
});

const motionKnobs = makeKnobGroup('motion', {
  flicker: [0.5, 0, 1],
  rays: [0.01, 0, 1],
  streaks: [0.03, 0, 2],
});

const motionState = { streakDistance: 3, streakSpeed: 5 };

registerKnob(
  'motion.streakSpeed',
  5,
  0.2,
  8,
  (value) => {
    motionState.streakSpeed = value;
  },
  0.05,
);
// 3 is the safe maximum: the deepest base streak times 3 stays inside the camera far plane
registerKnob(
  'motion.streakDistance',
  3,
  0.5,
  3,
  (value) => {
    motionState.streakDistance = value;
  },
  0.05,
);

/** Per-frame updaters for the current scene's animated meshes; rebuilt with each view select. */
const sceneAnimations: Array<(elapsed: number) => void> = [];

const gradeKnobs = makeKnobGroup('grade', {
  vignette: [0.53, 0, 1],
  vignetteMin: [0.4, 0, 1],
  warmth: [2, 0, 2],
});

registerKnob('grade.bloomStrength', NIGHT.bloomStrength, 0, 2, (value) => {
  if (liveRefs.bloom) {
    liveRefs.bloom.strength.value = value;
  }
});
registerKnob('grade.bloomThreshold', NIGHT.bloomThreshold, 0, 1, (value) => {
  if (liveRefs.bloom) {
    liveRefs.bloom.threshold.value = value;
  }
});

const SURFACE_RECIPES: Record<string, () => ReturnType<typeof buildGrain>> = {
  // retrofit paneling suits the market: coarse quantized steps plus grain
  market: () =>
    buildPanels(marketKnobs.cellX, marketKnobs.cellY, marketKnobs.cellZ, marketKnobs.panelAmp)
      .add(buildGrain(marketKnobs.grainAmp))
      .add(1)
      .clamp(marketKnobs.clampLo, marketKnobs.clampHi),

  // metal drums: horizontal sheet banding, rail stains bleeding down from the collar bands
  stash: () =>
    buildPanels(0.001, stashKnobs.bandCellY, 0.001, stashKnobs.bandAmp)
      .add(buildLowWear(stashKnobs.wearScale, stashKnobs.wearAmp, stashKnobs.wearFadeFrom, stashKnobs.wearFadeTo))
      .add(buildGrain(stashKnobs.grainAmp))
      .add(1)
      .clamp(stashKnobs.clampLo, stashKnobs.clampHi),

  // the authority keeps its hall severe: near-clean, one shadow line under the cornice
  codex: () =>
    buildOrganic(codexKnobs.mottleScale, codexKnobs.mottleAmp)
      .sub(buildCourseShadow(codexKnobs.courseHeight, codexKnobs.courseWidth, codexKnobs.courseDepth))
      .add(buildGrain(codexKnobs.grainAmp))
      .add(1)
      .clamp(codexKnobs.clampLo, codexKnobs.clampHi),

  avatar: () =>
    buildPanels(0.001, avatarKnobs.bandCellY, 0.001, avatarKnobs.bandAmp)
      .add(buildGrain(avatarKnobs.grainAmp))
      .add(1)
      .clamp(avatarKnobs.clampLo, avatarKnobs.clampHi),

  fountain: () =>
    buildOrganic(fountainKnobs.mottleScale, fountainKnobs.mottleAmp)
      .add(buildGrain(fountainKnobs.grainAmp))
      .add(1)
      .clamp(fountainKnobs.clampLo, fountainKnobs.clampHi),
};

/** The gate's civic concrete: large ordered panels, faint grain, grime pulled down low. */
function buildGateCivicSurface() {
  return buildPanels(gateKnobs.civicCellX, gateKnobs.civicCellY, gateKnobs.civicCellX, gateKnobs.civicPanelAmp)
    .sub(buildLowWear(0.8, gateKnobs.civicWearAmp, 1, gateKnobs.civicWearFadeTo))
    .add(buildGrain(gateKnobs.grainAmp))
    .add(1)
    .clamp(gateKnobs.civicClampLo, gateKnobs.civicClampHi);
}

/** The gate's service/core metal: tight horizontal sheet banding, kept dark. */
function buildGateCoreSurface() {
  return buildPanels(0.001, gateKnobs.coreBandCellY, 0.001, gateKnobs.coreBandAmp)
    .add(buildGrain(gateKnobs.grainAmp))
    .add(1)
    .clamp(gateKnobs.coreClampLo, gateKnobs.coreClampHi);
}

function applySurface(material: MeshStandardNodeMaterial, base: Color, key: string) {
  const recipe = SURFACE_RECIPES[key];

  if (recipe) {
    material.colorNode = color(base).mul(recipe());
  }
}

/** Pavement: broad quiet pavers, soft wear mottle, crisp joints — calm underfoot, not graph paper. */
function applyGroundSurface(material: MeshStandardNodeMaterial, base: Color) {
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

function buildScene(config: ProbeConfig, useParts: boolean, grounding = false, surfaces = false): Scene {
  const scene = new Scene();

  scene.background = new Color(config.sky);
  scene.fog = new Fog(new Color(config.fog), config.fogNear, config.fogFar);

  const ambient = new AmbientLight(new Color(config.ambient), config.ambientIntensity * 0.7);
  const directional = new DirectionalLight(new Color(config.dirColor), config.dirIntensity * 1.6);
  const bounce = new HemisphereLight(new Color(config.ambient), new Color('#54402e'), 1.05);

  directional.position.set(-30, 42, 26);
  scene.add(ambient, directional, bounce);

  // register live objects for the tuner only when this build carries the full treatment
  liveRefs.fog = surfaces ? (scene.fog as Fog) : null;
  liveRefs.ambient = surfaces ? ambient : null;
  liveRefs.bounce = surfaces ? bounce : null;
  liveRefs.keyLight = surfaces ? directional : null;
  liveRefs.gateGlow = null;
  liveRefs.lamps = [];
  liveRefs.materials = {};
  liveRefs.spills = [];
  liveRefs.washes = [];
  hoverPickBoxes.length = 0;

  for (const key of Object.keys(hoverMaterials)) {
    delete hoverMaterials[key];
  }

  const groundMaterial = new MeshStandardNodeMaterial({ color: new Color(config.ground), roughness: 0.6 });
  // large enough that its edges sit past full fog from any camera the spike uses
  const ground = new Mesh(new PlaneGeometry(800, 800), groundMaterial);

  if (surfaces) {
    applyGroundSurface(groundMaterial, new Color(config.ground));
  }

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);

  // the paved plaza, skewed off the world axes so the square doesn't read as a perfect rectangle
  const plazaMaterial = new MeshStandardNodeMaterial({
    color: new Color(config.ground).multiplyScalar(2.4),
    roughness: 0.45,
  });
  const plazaFloor = new Mesh(new PlaneGeometry(25, 21), plazaMaterial);

  if (surfaces) {
    applyGroundSurface(plazaMaterial, new Color(config.ground).multiplyScalar(2.4));
  }

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


  const specs = massing;
  const boxSpecs = useParts ? specs.filter((spec) => !isNavRole(spec.role)) : specs;
  const boxGeometry = partGeometries.box;
  const buildingMaterial = new MeshStandardNodeMaterial({ roughness: 0.85 });
  const buildings = new InstancedMesh(boxGeometry, buildingMaterial, boxSpecs.length);

  if (grounding) {
    applyGrounding(buildingMaterial);
  }
  const litColor = new Color(config.buildingLit);
  const navColor = litColor.clone().multiplyScalar(1.15);
  const fillerColor = litColor.clone().multiplyScalar(0.6);
  const foreColor = litColor.clone().multiplyScalar(0.35);

  for (const [index, spec] of boxSpecs.entries()) {
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

  const masts = boxSpecs.filter((spec) => spec.mast);
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

  const gate = placements.find((placement) => placement.key === 'gate');
  const fountain = placements.find((placement) => placement.key === 'fountain');
  const gateX = gate?.x ?? 6.2;
  const gateZ = gate?.z ?? -14.2;
  const fountainX = fountain?.x ?? 4.5;
  const fountainZ = fountain?.z ?? 1.5;

  if (useParts) {
    for (const placement of placements) {
      const base = placement.key === 'fountain' ? litColor.clone().multiplyScalar(0.55) : navColor;
      const material = new MeshStandardNodeMaterial({
        color: base,
        roughness: placement.key === 'stash' ? 0.55 : 0.85,
      });

      if (grounding) {
        applyGrounding(material);
      }

      if (surfaces) {
        applySurface(material, base, placement.key);
        liveRefs.materials[placement.key] = material;
      }

      if (placement.key === 'gate' && gateModel) {
        const model = gateModel.clone(true);

        model.scale.setScalar(GATE_MODEL_SCALE);
        model.position.set(placement.x, 0, placement.z);
        model.rotation.y = placement.ry + GATE_MODEL_YAW;
        scene.add(model);

        const gateHoverMaterials: Array<{ emissive: Color }> = [];

        model.traverse((child) => {
          const mesh = child as Mesh;

          if (mesh.isMesh) {
            const meshMaterial = mesh.material as { emissive?: Color };

            if (meshMaterial.emissive) {
              gateHoverMaterials.push(meshMaterial as { emissive: Color });
            }
          }
        });
        hoverMaterials[placement.key] = gateHoverMaterials;
      } else if (placement.key === 'gate') {
        // concept B1.6i's two-material story: light civic concrete against dark service metal
        const civicBase = new Color('#b9bdc6');
        const coreBase = new Color('#2d323e');
        const civicMaterial = new MeshStandardNodeMaterial({ color: civicBase, roughness: 0.8 });
        const coreMaterial = new MeshStandardNodeMaterial({ color: coreBase, roughness: 0.55 });
        const trimMaterial = new MeshStandardNodeMaterial({ color: new Color('#3a4150'), roughness: 0.7 });

        if (grounding) {
          applyGrounding(civicMaterial);
          applyGrounding(coreMaterial);
          applyGrounding(trimMaterial);
        }

        if (surfaces) {
          civicMaterial.colorNode = color(civicBase).mul(buildGateCivicSurface());
          coreMaterial.colorNode = color(coreBase).mul(buildGateCoreSurface());
          liveRefs.materials[placement.key] = civicMaterial;
        }

        renderGateHiFi(scene, civicMaterial, coreMaterial, trimMaterial, placement.x, placement.z, placement.ry);
        hoverMaterials[placement.key] = [civicMaterial, coreMaterial, trimMaterial];
      } else {
        renderPartSet(scene, placement.parts, material, placement.x, placement.z, placement.ry);

        if (NAV_HOVER_KEYS.includes(placement.key)) {
          hoverMaterials[placement.key] = [material];
        }
      }
    }

    // invisible raycast volumes for hover: one box per nav building, from its footprint parts
    const pickMaterial = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false });

    for (const placement of placements) {
      if (!NAV_HOVER_KEYS.includes(placement.key)) {
        continue;
      }

      let minX = Infinity;
      let minY = Infinity;
      let minZ = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let maxZ = -Infinity;

      for (const part of placement.parts) {
        minX = Math.min(minX, part.x - part.sx / 2);
        maxX = Math.max(maxX, part.x + part.sx / 2);
        minY = Math.min(minY, part.y - part.sy / 2);
        maxY = Math.max(maxY, part.y + part.sy / 2);
        minZ = Math.min(minZ, part.z - part.sz / 2);
        maxZ = Math.max(maxZ, part.z + part.sz / 2);
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const cos = Math.cos(placement.ry);
      const sin = Math.sin(placement.ry);
      const pick = new Mesh(new BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ), pickMaterial);

      pick.position.set(
        centerX * cos + centerZ * sin + placement.x,
        centerY,
        -centerX * sin + centerZ * cos + placement.z,
      );
      pick.rotation.y = placement.ry;
      pick.userData.hoverKey = placement.key;
      scene.add(pick);
      hoverPickBoxes.push(pick);
    }

    for (const fixture of SPILL_FIXTURES) {
      const placement = placements.find((entry) => entry.key === fixture.key);

      if (!placement) {
        continue;
      }

      const cos = Math.cos(placement.ry);
      const sin = Math.sin(placement.ry);
      const worldX = fixture.x * cos + fixture.z * sin + placement.x;
      const worldZ = -fixture.x * sin + fixture.z * cos + placement.z;
      const light = new PointLight(new Color(fixture.color), fixture.intensity, fixture.distance, 2);

      light.position.set(worldX, fixture.y, worldZ);
      scene.add(light);

      // the fixture housing: a small lit block so the light has a visible source on the wall
      const housing = new Mesh(
        partGeometries.box,
        new MeshBasicNodeMaterial({ color: new Color(fixture.color) }),
      );

      // wall spills hang their bracket above the bulb; washes sit as pucks on the ground
      if (fixture.kind === 'wash') {
        housing.scale.set(0.24, 0.16, 0.24);
        housing.position.set(worldX, 0.08, worldZ);
      } else {
        housing.scale.set(0.26, 0.09, 0.16);
        housing.position.set(worldX, fixture.y + 0.12, worldZ);
      }

      housing.rotation.y = placement.ry;
      scene.add(housing);

      if (surfaces) {
        (fixture.kind === 'wash' ? liveRefs.washes : liveRefs.spills).push({
          base: fixture.intensity,
          light,
        });
      }
    }
  } else {
    // the explore gate placeholder: two pylons in the far-side gap
    const pylonMaterial = new MeshStandardNodeMaterial({
      color: litColor.clone().multiplyScalar(0.5),
      roughness: 0.8,
    });

    for (const px of [4.2, 8.2]) {
      const pylon = new Mesh(new BoxGeometry(0.9, 6.2, 1.1), pylonMaterial);

      pylon.position.set(px, 3.1, -14);
      scene.add(pylon);
    }

    // in box mode the fountain keeps its fixed spot
    const fountainMaterial = new MeshStandardNodeMaterial({
      color: litColor.clone().multiplyScalar(0.55),
      roughness: 0.7,
    });

    renderPartSet(scene, FOUNTAIN_PARTS, fountainMaterial, 4.5, 1.5, 0);
  }

  const gateGlow = new PointLight(new Color(GATE_TEAL), 30, 20, 2);

  gateGlow.position.set(useParts ? gateX : 6.2, 2.5, (useParts ? gateZ : -14.2) - 3.3);
  scene.add(gateGlow);

  if (surfaces) {
    liveRefs.gateGlow = gateGlow;
  }

  const windowEmissives = [...buildWindows(specs, config, !useParts)];
  const otherEmissives = [...buildInstruments(specs, !useParts)];

  if (useParts) {
    for (const [index, placement] of placements.entries()) {
      if (placement.noWindows) {
        continue;
      }

      windowEmissives.push(...buildPartSetWindows(placement, config, 4200 + index));
    }
  }

  // box-mode gate placeholder keeps its teal edge strips; the hi-fi gate carries its own frame
  if (!useParts) {
    for (const offset of [-1.7, 1.7]) {
      const px = 6.2 + offset;
      const pz = -14.2 + 0.8;

      for (let index = 0; index < 8; index += 1) {
        otherEmissives.push({
          color: new Color(GATE_TEAL).multiplyScalar(1.9),
          x: px,
          y: 0.7 + index * 0.72,
          z: pz,
        });
      }
    }
  }

  // in treatment builds a slice of the windows flickers; everything else stays steady
  const isFlickerWindow = (index: number) => surfaces && index % 4 === 1;
  const flickerWindows = windowEmissives.filter((_, index) => isFlickerWindow(index));
  const steadyEmissives = [
    ...windowEmissives.filter((_, index) => !isFlickerWindow(index)),
    ...otherEmissives,
  ];
  const windowGeometry = new BoxGeometry(0.13, 0.2, 0.05);
  const emissiveMesh = new InstancedMesh(windowGeometry, new MeshBasicNodeMaterial(), steadyEmissives.length);

  for (const [index, emissive] of steadyEmissives.entries()) {
    dummy.position.set(emissive.x, emissive.y, emissive.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    emissiveMesh.setMatrixAt(index, dummy.matrix);
    emissiveMesh.setColorAt(index, emissive.color);
  }

  emissiveMesh.instanceMatrix.needsUpdate = true;
  emissiveMesh.computeBoundingSphere();
  scene.add(emissiveMesh);

  if (flickerWindows.length > 0) {
    // one shared node graph: each window's world position seeds its own waver and rare deep drop
    const flickerBase = new MeshBasicNodeMaterial();
    const slow = mx_noise_float(
      vec3(positionWorld.x.mul(3.1), positionWorld.y.mul(3.1).add(positionWorld.z.mul(2.7)), time.mul(1.6)),
    )
      .mul(0.5)
      .add(0.5);
    const drop = mx_noise_float(vec3(positionWorld.x.mul(1.7), positionWorld.z.mul(1.9), time.mul(0.35)))
      .mul(0.5)
      .add(0.5)
      .smoothstep(0.7, 0.78);
    const flick = slow.mul(0.55).add(0.6).mul(drop.oneMinus().mul(0.95).add(0.05));

    flickerBase.colorNode = materialColor.mul(mix(float(1), flick, motionKnobs.flicker));

    for (const emissive of flickerWindows) {
      const material = flickerBase.clone();

      material.color.set(emissive.color);

      const windowMesh = new Mesh(windowGeometry, material);

      windowMesh.position.set(emissive.x, emissive.y, emissive.z);
      scene.add(windowMesh);
    }
  }

  if (surfaces) {
    // distant light shafts pulsing out of phase among the far towers — broad ambience, not a siren
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

      shaft.position.set(ray.x, 4 + ray.height / 2, ray.z);
      scene.add(shaft);
    }

    // the skybox layer: bright streaks crossing the far skyline — distant shooting stars
    const streakGeometry = new BoxGeometry(3.4, 0.16, 0.16);
    const streakMaterials = ['#a78bfa', '#5eead4', '#e5c79c', '#dbeafe'].map((streakColor) => {
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
      const streakY = 13 + ((index * 37) % 20);
      const streakZ = -60 - ((index * 13) % 25);
      const period = 8 + ((index * 7.1) % 26);
      // wide per-streak speed spread: crossings from darting (~2.5s) to drifting (~11.5s)
      const travel = 2.5 + ((index * 5.3) % 9);
      const offset = index * 7.7;
      const direction = index % 2 === 0 ? 1 : -1;
      // each streak sinks a little as it crosses, like a slow shooting star
      const sink = 1 + ((index * 11) % 3);

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
          // distance scales depth, height, and crossing span together so the fleet still
          // spans the whole sky however far back it sits
          const distance = motionState.streakDistance;
          const spanHalf = (26 + Math.abs(streakZ) * distance) * 0.66;

          streak.position.x = direction * (progress * 2 * spanHalf - spanHalf);
          streak.position.y = (streakY - progress * sink) * (0.75 + 0.25 * distance);
          streak.position.z = streakZ * distance;
        }
      });
    }
  }

  if (config.duskFogBanks) {
    addDuskFogBanks(scene);
  }

  if (surfaces) {
    addAtmosphere(scene);
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

/**
 * The treatment atmosphere. Every layer is domain-warped noise thresholded into distinct
 * shapes — wisps with gaps between them, whose form changes as they move — never a uniform
 * sheet whose alpha wobbles. Banks drift between the far towers, mist rolls low across the
 * gate end, the gate slot's teal haze streams upward and pulses, and vent plumes rise off the
 * market and stash. No plane writes depth.
 */
const ATMO_LAYER = 1;

function addAtmosphere(scene: Scene) {
  // fades every plane to nothing at its own edges so no rectangle outline ever shows
  const edgeFade = uv().x.mul(uv().x.oneMinus()).mul(uv().y).mul(uv().y.oneMinus()).mul(16);

  const banks = [
    { seed: 3, y: 2.5, z: -10 },
    { seed: 7, y: 3.5, z: -18 },
    { seed: 11, y: 5, z: -26 },
  ];

  for (const bank of banks) {
    const material = new MeshBasicNodeMaterial({
      color: new Color(DUSK_FOG),
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    });
    const coord = vec3(
      positionWorld.x.mul(0.12).add(time.mul(atmoKnobs.drift.mul(3))),
      positionWorld.y.mul(0.28),
      bank.seed,
    );
    // the warp curls the wisps; the fine octave scuds past faster than the body
    const warp = mx_noise_float(coord.mul(0.5).add(time.mul(atmoKnobs.drift))).mul(1.2);
    const detail = mx_noise_float(coord.mul(2.3).sub(time.mul(atmoKnobs.drift.mul(5)))).mul(0.5);
    const body = mx_noise_float(coord.add(warp)).add(detail).add(0.75).mul(0.5).smoothstep(0.45, 0.95);

    material.opacityNode = body.mul(edgeFade).mul(atmoKnobs.bankOpacity);

    const plane = new Mesh(new PlaneGeometry(90, 11), material);

    plane.layers.set(ATMO_LAYER);
    plane.position.set(0, bank.y, bank.z);
    scene.add(plane);
  }

  // two stacked mist layers rolling at different speeds across the gate end of the plaza
  for (const layer of [
    { scale: 0.16, seed: 17, speed: 1, y: 0.7 },
    { scale: 0.11, seed: 29, speed: 0.55, y: 1.5 },
  ]) {
    const material = new MeshBasicNodeMaterial({
      color: new Color(DUSK_FOG),
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    });
    const coord = vec3(
      positionWorld.x.mul(layer.scale).add(time.mul(atmoKnobs.drift.mul(layer.speed * 2))),
      positionWorld.z.mul(layer.scale).sub(time.mul(atmoKnobs.drift.mul(layer.speed))),
      layer.seed,
    );
    const warp = mx_noise_float(coord.mul(0.45).add(time.mul(atmoKnobs.drift.mul(0.7)))).mul(1.3);
    const body = mx_noise_float(coord.add(warp)).add(1).mul(0.5).smoothstep(0.42, 0.9);

    material.opacityNode = body.mul(edgeFade).mul(atmoKnobs.mistOpacity);

    const mist = new Mesh(new PlaneGeometry(56, 34), material);

    mist.layers.set(ATMO_LAYER);
    mist.rotation.x = -Math.PI / 2;
    mist.position.set(1, layer.y, -9);
    scene.add(mist);
  }

  // teal haze streaming up the gate slot, pulsing slowly — the way out is alive
  const gate = placements.find((placement) => placement.key === 'gate');

  if (gate) {
    const hazeMaterial = new MeshBasicNodeMaterial({
      blending: AdditiveBlending,
      color: new Color(GATE_TEAL),
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    });
    const coord = vec3(positionWorld.x.mul(0.7), positionWorld.y.mul(0.45).sub(time.mul(0.25)), 23);
    const warp = mx_noise_float(coord.mul(0.6)).mul(0.8);
    const body = mx_noise_float(coord.add(warp)).add(1).mul(0.5).smoothstep(0.25, 0.9);
    const pulse = time.mul(0.6).sin().mul(0.15).add(0.9);

    hazeMaterial.opacityNode = body.mul(edgeFade).mul(atmoKnobs.hazeOpacity).mul(pulse);

    const haze = new Mesh(new PlaneGeometry(4.2, 7.2), hazeMaterial);

    haze.layers.set(ATMO_LAYER);
    const cos = Math.cos(gate.ry);
    const sin = Math.sin(gate.ry);
    const localZ = -1.2;

    haze.position.set(localZ * sin + gate.x, 3.65, localZ * cos + gate.z);
    haze.rotation.y = gate.ry;
    scene.add(haze);
  }

  // the fog sea: ground fog surrounding the plaza, creeping inward as thresholded wisps.
  // Radial distance from the plaza center gates the opacity so the square itself stays clear.
  const plazaCenter = vec2(-1, -5);
  const radial = positionWorld.xz.sub(plazaCenter).length();
  const creep = radial.smoothstep(atmoKnobs.fogRadius, atmoKnobs.fogRadius.add(14));

  for (const layer of [
    { scale: 0.1, seed: 41, speed: 0.8, y: 0.8 },
    { scale: 0.07, seed: 47, speed: 0.5, y: 2 },
  ]) {
    const material = new MeshBasicNodeMaterial({
      color: new Color(DUSK_FOG),
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    });
    const coord = vec3(
      positionWorld.x.mul(layer.scale).add(time.mul(atmoKnobs.drift.mul(layer.speed))),
      positionWorld.z.mul(layer.scale).sub(time.mul(atmoKnobs.drift.mul(layer.speed * 0.7))),
      layer.seed,
    );
    const warp = mx_noise_float(coord.mul(0.5).add(time.mul(atmoKnobs.drift.mul(0.4)))).mul(1.2);
    const body = mx_noise_float(coord.add(warp)).add(1).mul(0.5).smoothstep(0.3, 0.75);

    // near-opaque in its heart, wispy at the creeping inner edge
    material.opacityNode = creep.mul(body.mul(0.7).add(0.3)).mul(atmoKnobs.fogSea);

    const sea = new Mesh(new PlaneGeometry(320, 320), material);

    sea.layers.set(ATMO_LAYER);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(-1, layer.y, -5);
    scene.add(sea);
  }

  // the fog wall: a slowly turning cylinder of wisps encircling the plaza, dense low, gone high
  const wallMaterial = new MeshBasicNodeMaterial({
    color: new Color(DUSK_FOG),
    depthWrite: false,
    side: DoubleSide,
    transparent: true,
  });
  const wallCoord = vec3(
    positionWorld.x.mul(0.08).add(time.mul(atmoKnobs.drift.mul(0.6))),
    positionWorld.y.mul(0.16),
    positionWorld.z.mul(0.08),
  );
  const wallWarp = mx_noise_float(wallCoord.mul(0.5).add(time.mul(atmoKnobs.drift.mul(0.3)))).mul(1.3);
  const wallBody = mx_noise_float(wallCoord.add(wallWarp)).add(1).mul(0.5).smoothstep(0.28, 0.8);
  const wallFade = positionWorld.y.smoothstep(3, 13).oneMinus();

  wallMaterial.opacityNode = wallBody.mul(0.75).add(0.25).mul(wallFade).mul(atmoKnobs.fogWall);

  const wall = new Mesh(new CylinderGeometry(27, 27, 14, 64, 1, true), wallMaterial);

  wall.layers.set(ATMO_LAYER);
  wall.position.set(-1, 7, -5);
  scene.add(wall);
  sceneAnimations.push((elapsed) => {
    wall.rotation.y = elapsed * 0.004;
  });

  // vent plumes: ragged smoke columns rising off the rooftop machinery
  for (const source of SMOKE_SOURCES) {
    const placement = placements.find((entry) => entry.key === source.key);

    if (!placement) {
      continue;
    }

    const cos = Math.cos(placement.ry);
    const sin = Math.sin(placement.ry);
    const worldX = source.x * cos + source.z * sin + placement.x;
    const worldZ = -source.x * sin + source.z * cos + placement.z;
    const material = new MeshBasicNodeMaterial({
      color: new Color(SMOKE_BLUE),
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    });
    const coord = vec3(
      positionWorld.x.mul(0.9).add(source.seed),
      positionWorld.y.mul(0.55).sub(time.mul(source.rise)),
      source.seed,
    );
    const warp = mx_noise_float(coord.mul(0.6).add(time.mul(0.06))).mul(1.1);
    const body = mx_noise_float(coord.add(warp)).add(1).mul(0.5).smoothstep(0.3, 0.88);
    // solid at the vent mouth, ragged and gone by the top
    const taper = uv()
      .x.mul(uv().x.oneMinus())
      .mul(4)
      .mul(uv().y.smoothstep(0, 0.12))
      .mul(uv().y.oneMinus().pow(1.4));

    material.opacityNode = body.mul(taper).mul(atmoKnobs.smokeOpacity);

    const plume = new Mesh(new PlaneGeometry(source.width, source.height), material);

    plume.layers.set(ATMO_LAYER);
    plume.position.set(worldX, source.y + source.height / 2, worldZ);
    scene.add(plume);
  }
}

const SMOKE_BLUE = '#7d879f';

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
  { color: GATE_TEAL, height: 16, phase: 0, width: 2.2, x: -26, z: -38 },
  { color: '#a78bfa', height: 20, phase: 1.7, width: 3.2, x: -12, z: -44 },
  { color: GATE_TEAL, height: 14, phase: 3.1, width: 1.8, x: 3, z: -40 },
  { color: '#a78bfa', height: 22, phase: 4.4, width: 2.6, x: 16, z: -46 },
  { color: GATE_TEAL, height: 17, phase: 5.6, width: 2, x: 30, z: -38 },
];

interface SmokeSource {
  readonly height: number;
  readonly key: string;
  readonly rise: number;
  readonly seed: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Local-frame vent mouths: the market roof vent and the stash's small drum cap. */
const SMOKE_SOURCES: ReadonlyArray<SmokeSource> = [
  { height: 5, key: 'market', rise: 0.3, seed: 31, width: 2.6, x: -1.6, y: 4.6, z: -0.5 },
  { height: 4, key: 'stash', rise: 0.24, seed: 37, width: 2, x: 2.6, y: 2.7, z: 0 },
];

interface PlanGroup {
  readonly baseColor: string;
  readonly group: Group;
  readonly label: string;
  readonly material: MeshStandardNodeMaterial;
  readonly target: { ry: number; x: number; z: number };
}

const PLAN_ELEMENT_COLOR = '#8fa0c2';
const PLAN_SELECTED_COLOR = '#5eead4';

const PLAN_ROLE_COLORS: Record<string, string> = {
  back: '#333e58',
  filler: '#4d5975',
  fore: '#3a465f',
};

/**
 * The top-down layout editor's scene: flat-lit, fog-free, every element and every fixed block in
 * its own group so dragging repositions it without a rebuild.
 */
/**
 * The render-style probe: one small Respite building in the Townscaper register — shaped but
 * simple geometry (gabled extrusions, arches, bevels — never raw boxes), flat graphic color
 * blocking with a few very simple patterns, soft dusk light. Screen-space occlusion is added by
 * the view's post chain; nothing here reuses the town's night rig.
 */
function buildStyleProbeScene(): Scene {
  const scene = new Scene();

  scene.background = new Color('#454f78');

  const hemisphere = new HemisphereLight(new Color('#8d97c4'), new Color('#6e5a45'), 1.6);
  const sun = new DirectionalLight(new Color('#ffd9a8'), 2.2);
  const fill = new AmbientLight(new Color('#45507a'), 0.5);

  sun.position.set(-18, 24, 14);
  scene.add(hemisphere, sun, fill);

  const plaster = new Color('#cfc4b2');
  const plasterShade = new Color('#b9ad9c');
  const slate = new Color('#46506b');
  const trim = new Color('#59b3a5');
  const doorTeal = new Color('#2f6f68');

  const plasterMaterial = new MeshStandardNodeMaterial({ color: plaster, roughness: 0.9 });

  plasterMaterial.colorNode = color(plaster).mul(buildGrain(0.025).add(1));

  const shadeMaterial = new MeshStandardNodeMaterial({ color: plasterShade, roughness: 0.9 });
  const slateMaterial = new MeshStandardNodeMaterial({ color: slate, roughness: 0.75 });

  // roof courses: soft horizontal banding, low contrast — a simple texture, not noise
  slateMaterial.colorNode = color(slate).mul(
    buildPanels(0.001, 3.2, 0.001, 0.1).add(buildGrain(0.02)).add(1).clamp(0.85, 1.12),
  );

  const trimMaterial = new MeshStandardNodeMaterial({ color: trim, roughness: 0.7 });
  const doorMaterial = new MeshStandardNodeMaterial({ color: doorTeal, roughness: 0.7 });
  const paneMaterial = new MeshBasicNodeMaterial({ color: new Color(WARM_WINDOW).multiplyScalar(1.35) });

  const put = (
    mesh: Mesh,
    px: number,
    py: number,
    pz: number,
    ry = 0,
    rz = 0,
  ) => {
    mesh.position.set(px, py, pz);
    mesh.rotation.set(0, ry, rz, 'YXZ');
    scene.add(mesh);
    return mesh;
  };

  // gabled main mass: a house profile extruded with a chunky bevel
  const buildGableGeometry = (width: number, wallHeight: number, peak: number, depth: number) => {
    const half = width / 2;
    const profile = new Shape();

    profile.moveTo(-half, 0);
    profile.lineTo(half, 0);
    profile.lineTo(half, wallHeight);
    profile.lineTo(0, peak);
    profile.lineTo(-half, wallHeight);
    profile.closePath();

    const geometry = new ExtrudeGeometry(profile, {
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.06,
      bevelThickness: 0.06,
      depth,
    });

    geometry.translate(0, 0, -depth / 2);

    return geometry;
  };

  put(new Mesh(buildGableGeometry(4.6, 2.6, 3.9, 3.5), plasterMaterial), 0, 0, 0);

  // side annex: a smaller gable turned across the main ridge
  put(new Mesh(buildGableGeometry(2.4, 1.9, 2.7, 2.3), plasterMaterial), 2.9, 0, 0.3, Math.PI / 2);

  // roof shells overhanging the slopes
  const roofPitch = Math.atan2(1.3, 2.3);

  put(new Mesh(new RoundedBoxGeometry(2.85, 0.16, 4.1, 2, 0.05), slateMaterial), -1.2, 3.28, 0, 0, roofPitch);
  put(new Mesh(new RoundedBoxGeometry(2.85, 0.16, 4.1, 2, 0.05), slateMaterial), 1.2, 3.28, 0, 0, -roofPitch);
  put(new Mesh(new RoundedBoxGeometry(1.6, 0.14, 2.9, 2, 0.05), slateMaterial), 2.9, 2.36, 1, Math.PI / 2, roofPitch);
  put(new Mesh(new RoundedBoxGeometry(1.6, 0.14, 2.9, 2, 0.05), slateMaterial), 2.9, 2.36, -0.4, Math.PI / 2, -roofPitch);

  // base skirt and eave trim band
  put(new Mesh(new RoundedBoxGeometry(4.9, 0.36, 3.8, 2, 0.06), shadeMaterial), 0, 0.18, 0);
  put(new Mesh(new RoundedBoxGeometry(4.78, 0.16, 3.68, 2, 0.04), trimMaterial), 0, 2.62, 0);

  // arched door: trim surround, half-round arch, recessed teal leaf
  put(new Mesh(new RoundedBoxGeometry(1.04, 2.1, 0.14, 2, 0.04), trimMaterial), -1.15, 1.05, 1.78);

  const archGeometry = new CylinderGeometry(0.52, 0.52, 0.14, 24, 1, false, 0, Math.PI);

  archGeometry.rotateX(Math.PI / 2);
  put(new Mesh(archGeometry, trimMaterial), -1.15, 2.1, 1.78);
  put(new Mesh(new RoundedBoxGeometry(0.84, 1.9, 0.12, 2, 0.03), doorMaterial), -1.15, 0.95, 1.82);

  // windows: chunky trim frames with warm panes
  const putWindow = (px: number, py: number, pz: number, ry = 0) => {
    const frame = new Mesh(new RoundedBoxGeometry(0.72, 0.92, 0.12, 2, 0.03), trimMaterial);
    const pane = new Mesh(new BoxGeometry(0.5, 0.7, 0.1), paneMaterial);

    put(frame, px, py, pz, ry);
    pane.position.set(px, py, pz);
    pane.rotation.y = ry;
    pane.translateZ(0.03);
    scene.add(pane);
  };

  putWindow(0.4, 1.9, 1.78);
  putWindow(1.35, 1.9, 1.78);
  putWindow(-0.6, 3.1, 1.4);
  putWindow(2.9, 1.5, 1.55);
  putWindow(-1.6, 1.9, -1.78);
  putWindow(0.9, 1.9, -1.78);

  // chimney stack with a cap, and a small teal vent
  put(new Mesh(new RoundedBoxGeometry(0.52, 1.3, 0.52, 2, 0.05), shadeMaterial), 1.15, 4.15, -0.7);
  put(new Mesh(new RoundedBoxGeometry(0.66, 0.14, 0.66, 2, 0.04), slateMaterial), 1.15, 4.85, -0.7);
  put(new Mesh(new CylinderGeometry(0.12, 0.12, 0.5, 12), trimMaterial), -1.7, 3.1, -0.4);

  // paver disc underfoot: coarse flat cells, faint joints — graphic, not noisy
  const groundMaterial = new MeshStandardNodeMaterial({ color: new Color('#787d90'), roughness: 0.85 });

  groundMaterial.colorNode = color(new Color('#787d90')).mul(
    buildPanels(0.55, 0.001, 0.55, 0.07).add(buildGrain(0.02)).add(1).clamp(0.88, 1.1),
  );

  const disc = new Mesh(new CircleGeometry(9, 48), groundMaterial);

  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.01;
  scene.add(disc);

  return scene;
}

function buildPlanScene(): { groups: Array<PlanGroup>; scene: Scene } {
  const scene = new Scene();

  scene.background = new Color('#181d2c');

  const ambient = new AmbientLight(new Color('#aab6d0'), 1.6);
  const key = new DirectionalLight(new Color('#8fa0c2'), 0.9);

  key.position.set(-14, 40, 20);
  scene.add(ambient, key);

  const ground = new Mesh(
    new PlaneGeometry(220, 220),
    new MeshStandardNodeMaterial({ color: new Color('#10141f'), roughness: 1 }),
  );

  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const plazaFloor = new Mesh(
    new PlaneGeometry(25, 21),
    new MeshStandardNodeMaterial({ color: new Color('#232b40'), roughness: 1 }),
  );

  plazaFloor.rotation.x = -Math.PI / 2;
  plazaFloor.rotation.z = 0.07;
  plazaFloor.position.set(0.8, -0.01, -1.5);
  scene.add(plazaFloor);

  const groups: Array<PlanGroup> = [];

  for (const state of placements) {
    const material = new MeshStandardNodeMaterial({
      color: new Color(PLAN_ELEMENT_COLOR),
      roughness: 0.9,
    });
    const group = new Group();

    for (const part of state.parts) {
      const mesh = new Mesh(partGeometries[part.g], material);

      mesh.position.set(part.x, part.y, part.z);
      mesh.rotation.set(part.rx ?? 0, 0, part.rz ?? 0);
      mesh.scale.set(part.sx, part.sy, part.sz);
      group.add(mesh);
    }

    group.position.set(state.x, 0, state.z);
    group.rotation.y = state.ry;
    scene.add(group);
    groups.push({ baseColor: PLAN_ELEMENT_COLOR, group, label: state.key, material, target: state });
  }

  for (const [index, spec] of massing.entries()) {
    if (isNavRole(spec.role)) {
      continue;
    }

    const baseColor = PLAN_ROLE_COLORS[spec.role] ?? '#39445e';
    const material = new MeshStandardNodeMaterial({ color: new Color(baseColor), roughness: 1 });
    const group = new Group();
    const block = new Mesh(partGeometries.box, material);

    block.position.set(0, spec.h / 2, 0);
    block.scale.set(spec.w, spec.h, spec.d);
    group.add(block);
    group.position.set(spec.x, 0, spec.z);
    group.rotation.y = spec.ry;
    scene.add(group);
    groups.push({ baseColor, group, label: `${spec.role}${index}`, material, target: spec });
  }

  return { groups, scene };
}

async function main() {
  // bun's dev-server HMR can re-execute the module; a second renderer + loop fights the first
  const globalState = globalThis as { __lookdevBooted?: boolean };

  if (globalState.__lookdevBooted) {
    return;
  }

  globalState.__lookdevBooted = true;

  // programmatic access for agent-driven layout iteration: set positions, read the overlap check
  (globalThis as { __lookdevCheck?: () => Array<string> }).__lookdevCheck = findOverlaps;
  (globalThis as { __lookdevPlacements?: Array<AssemblyPlacement> }).__lookdevPlacements = placements;
  (globalThis as { __lookdevSetAvatar?: (kind: string) => string }).__lookdevSetAvatar = (kind) => {
    const avatar = placements.find((placement) => placement.key === 'avatar');

    if (avatar) {
      avatar.parts = kind === 'dome' ? AVATAR_DOME_PARTS : AVATAR_PARTS;
    }

    return kind;
  };

  const renderer = new WebGPURenderer({ antialias: true });

  renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio));
  document.body.appendChild(renderer.domElement);
  await renderer.init();

  // the authored gate must be in hand before the first scene builds
  try {
    const gltf = await new GLTFLoader().loadAsync(gateModelURL as string);

    gateModel = gltf.scene;

    // swap the gate's plan/footprint boxes for the model's true scaled bounds so the plan
    // editor drags the real shape and the overlap checker tests reality
    const bounds = new Box3().setFromObject(gateModel);
    const size = bounds.getSize(new Vector3()).multiplyScalar(GATE_MODEL_SCALE);
    const boundsCenter = bounds.getCenter(new Vector3()).multiplyScalar(GATE_MODEL_SCALE);
    const gatePlacement = placements.find((placement) => placement.key === 'gate');

    if (gatePlacement) {
      gatePlacement.parts = [
        {
          g: 'box',
          sx: size.x,
          sy: size.y,
          sz: size.z,
          x: boundsCenter.x,
          y: boundsCenter.y,
          z: boundsCenter.z,
        },
      ];
    }
  } catch (error) {
    console.error('gate model failed to load — falling back to the procedural gate', error);
  }

  const camera = new PerspectiveCamera(36, globalThis.innerWidth / globalThis.innerHeight, 0.1, 300);

  // the main camera sees the atmosphere layer; the ink edge camera never enables it
  camera.layers.enable(1);

  camera.position.set(35.82, 29.77, 41.11);
  camera.lookAt(0, 4, -7);

  const planCamera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

  const updatePlanCamera = () => {
    const aspect = globalThis.innerWidth / globalThis.innerHeight;
    const halfHeight = 26;

    planCamera.left = -halfHeight * aspect;
    planCamera.right = halfHeight * aspect;
    planCamera.top = halfHeight;
    planCamera.bottom = -halfHeight;
    planCamera.position.set(0, 80, -4);
    planCamera.up.set(0, 0, -1);
    planCamera.lookAt(0, 0, -4);
    planCamera.updateProjectionMatrix();
  };

  updatePlanCamera();

  const buildPost = (
    scene: Scene,
    viewCamera: OrthographicCamera | PerspectiveCamera,
    strength: number,
    threshold: number,
    grade = false,
  ): PostProcessing => {
    const scenePass = pass(scene, viewCamera);
    const scenePassColor = scenePass.getTextureNode();
    const bloomPass = bloom(scenePassColor, strength, 0.4, threshold);
    const post = new PostProcessing(renderer);
    let composite = scenePassColor.add(bloomPass);

    liveRefs.bloom = grade ? bloomPass : null;

    if (grade) {
      // the ink pass: thick dark edges wherever depth or normals break — the illustrated read.
      // Edges come from a second pass whose camera skips the atmosphere layer, so fog never
      // gets outlined while buildings behind it keep their ink. Depth deltas are relative to
      // the center sample so the nonlinear buffer stays usable.
      const edgeCamera = new PerspectiveCamera();

      sceneAnimations.push(() => {
        edgeCamera.copy(viewCamera as PerspectiveCamera);
        edgeCamera.layers.set(0);
      });

      const edgePass = pass(scene, edgeCamera);

      edgePass.setMRT(mrt({ normal: normalView, output }));

      const depthTex = edgePass.getTextureNode('depth');
      const normalTex = edgePass.getTextureNode('normal');
      const texel = inkKnobs.width.div(screenSize);
      const sampleDepth = (ox: number, oy: number) =>
        depthTex.sample(screenUV.add(texel.mul(vec2(ox, oy)))).x;
      const sampleNormal = (ox: number, oy: number) =>
        normalTex.sample(screenUV.add(texel.mul(vec2(ox, oy)))).xyz;
      const depthCenter = sampleDepth(0, 0);
      const depthDelta = sampleDepth(1, 0)
        .sub(depthCenter)
        .abs()
        .add(sampleDepth(-1, 0).sub(depthCenter).abs())
        .add(sampleDepth(0, 1).sub(depthCenter).abs())
        .add(sampleDepth(0, -1).sub(depthCenter).abs());
      const depthEdge = depthDelta
        .div(float(1).sub(depthCenter).add(0.0005))
        .smoothstep(inkKnobs.depthThreshold, inkKnobs.depthThreshold.mul(2));
      const normalCenter = sampleNormal(0, 0);
      const normalAgreement = normalCenter
        .dot(sampleNormal(1, 0))
        .add(normalCenter.dot(sampleNormal(-1, 0)))
        .add(normalCenter.dot(sampleNormal(0, 1)))
        .add(normalCenter.dot(sampleNormal(0, -1)));
      const normalEdge = float(4)
        .sub(normalAgreement)
        .smoothstep(inkKnobs.normalThreshold, inkKnobs.normalThreshold.mul(1.6));
      const ink = depthEdge.max(normalEdge).mul(inkKnobs.strength);

      composite = scenePassColor.mul(ink.oneMinus()).add(bloomPass);

      // vignette plus a gentle warm lean — the grading half of the treatment
      const vignette = screenUV
        .sub(0.5)
        .length()
        .mul(1.25)
        .pow(2)
        .mul(gradeKnobs.vignette)
        .oneMinus()
        .clamp(gradeKnobs.vignetteMin, 1);

      composite = composite.mul(vignette).mul(mix(vec3(1), vec3(1.05, 1.0, 0.94), gradeKnobs.warmth));
    }

    // final FXAA smooths the ink lines — edge detection is per-pixel and jaggy without it
    post.outputNode = fxaa(composite);

    return post;
  };

  interface View {
    readonly key: string;
    readonly name: string;
    readonly select: () => PostProcessing;
  }

  const selectPlazaCamera = () => {
    camera.position.set(35.82, 29.77, 41.11);
    camera.lookAt(0, 4, -7);
  };

  // ---- orbit inspect state ----
  const orbitTarget = new Vector3(0, 4, -7);
  let orbitActive = false;
  let orbitDragging = false;
  let orbitPanning = false;
  let orbitRadius = 33.5;
  let orbitTheta = 0;
  let orbitPhi = 1.42;
  let lastPointerX = 0;
  let lastPointerY = 0;

  const applyOrbit = () => {
    const sinPhi = Math.sin(orbitPhi);

    camera.position.set(
      orbitTarget.x + orbitRadius * sinPhi * Math.sin(orbitTheta),
      orbitTarget.y + orbitRadius * Math.cos(orbitPhi),
      orbitTarget.z + orbitRadius * sinPhi * Math.cos(orbitTheta),
    );
    camera.lookAt(orbitTarget);
  };

  // programmatic close-ups for agent-driven screenshot rounds
  (
    globalThis as {
      __lookdevOrbit?: (tx: number, ty: number, tz: number, radius: number, theta: number, phi: number) => void;
    }
  ).__lookdevOrbit = (tx, ty, tz, radius, theta, phi) => {
    orbitTarget.set(tx, ty, tz);
    orbitRadius = radius;
    orbitTheta = theta;
    orbitPhi = phi;
    applyOrbit();
  };

  // ---- plan editor state ----
  let planGroups: Array<PlanGroup> = [];
  let planActive = false;
  let selected: PlanGroup | null = null;
  let dragging = false;
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  const dragPoint = new Vector3();
  const grabOffset = new Vector2();
  const info = document.getElementById('info');

  const updateInfo = (flash?: string) => {
    if (!info) {
      return;
    }

    const overlaps = findOverlaps();
    const overlapReport = overlaps.length === 0 ? 'none' : overlaps.join(', ');

    (globalThis as { __lookdevOverlaps?: Array<string> }).__lookdevOverlaps = overlaps;
    info.textContent = planActive
      ? `${flash ?? (selected ? `selected: ${selected.label}` : 'click an element')} · drag to move · Q/E rotate · P copy layout · overlaps: ${overlapReport}`
      : orbitActive
        ? (flash ?? 'drag to orbit · shift-drag to pan · wheel to zoom · C copy camera')
        : '';
    info.style.display = planActive || orbitActive ? 'block' : 'none';
  };

  // hover glow: the nav buildings are the menu — pointer-over lifts their emissive into bloom
  const HOVER_LIFT = new Color(0.07, 0.12, 0.11);
  const hoverRestore: Array<[{ emissive: Color }, Color]> = [];
  let hoveredKey: string | null = null;

  const applyHoverGlow = (key: string | null) => {
    for (const [hoverMaterial, previous] of hoverRestore) {
      hoverMaterial.emissive.copy(previous);
    }

    hoverRestore.length = 0;
    hoveredKey = key;
    renderer.domElement.style.cursor = key ? 'pointer' : '';

    if (key) {
      for (const hoverMaterial of new Set(hoverMaterials[key] ?? [])) {
        hoverRestore.push([hoverMaterial, hoverMaterial.emissive.clone()]);
        hoverMaterial.emissive.add(HOVER_LIFT);
      }
    }
  };

  const toPointerNDC = (event: PointerEvent) => {
    pointer.set(
      (event.clientX / globalThis.innerWidth) * 2 - 1,
      -(event.clientY / globalThis.innerHeight) * 2 + 1,
    );
  };

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (orbitActive) {
      orbitDragging = true;
      orbitPanning = event.shiftKey || event.button === 2;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      return;
    }

    if (!planActive) {
      return;
    }

    toPointerNDC(event);
    raycaster.setFromCamera(pointer, planCamera);

    const hits = raycaster.intersectObjects(
      planGroups.map((entry) => entry.group),
      true,
    );
    const hitGroup = hits
      .map((hit) => planGroups.find((entry) => entry.group === hit.object.parent))
      .find((entry) => entry !== undefined);

    for (const entry of planGroups) {
      entry.material.color.set(new Color(entry.baseColor));
    }

    selected = hitGroup ?? null;

    if (selected) {
      selected.material.color.set(new Color(PLAN_SELECTED_COLOR));

      if (raycaster.ray.intersectPlane(groundPlane, dragPoint)) {
        grabOffset.set(dragPoint.x - selected.target.x, dragPoint.z - selected.target.z);
        dragging = true;
      }
    }

    updateInfo();
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!planActive) {
      toPointerNDC(event);
      raycaster.setFromCamera(pointer, camera);

      const hoverHits = raycaster.intersectObjects(hoverPickBoxes, false);
      const hoverHitKey = (hoverHits[0]?.object.userData['hoverKey'] as string | undefined) ?? null;

      if (hoverHitKey !== hoveredKey) {
        applyHoverGlow(hoverHitKey);
      }
    }

    if (orbitActive) {
      if (!orbitDragging) {
        return;
      }

      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;

      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      if (orbitPanning) {
        // pan the target along the camera's screen axes
        const scale = orbitRadius * 0.0012;
        const right = new Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new Vector3().setFromMatrixColumn(camera.matrix, 1);

        orbitTarget.addScaledVector(right, -dx * scale);
        orbitTarget.addScaledVector(up, dy * scale);
      } else {
        orbitTheta -= dx * 0.005;
        orbitPhi = Math.min(1.52, Math.max(0.12, orbitPhi - dy * 0.005));
      }

      applyOrbit();
      return;
    }

    if (!planActive || !dragging || !selected) {
      return;
    }

    toPointerNDC(event);
    raycaster.setFromCamera(pointer, planCamera);

    if (raycaster.ray.intersectPlane(groundPlane, dragPoint)) {
      selected.target.x = Math.round((dragPoint.x - grabOffset.x) * 10) / 10;
      selected.target.z = Math.round((dragPoint.z - grabOffset.y) * 10) / 10;
      selected.group.position.set(selected.target.x, 0, selected.target.z);
    }
  });

  renderer.domElement.addEventListener('pointerup', () => {
    orbitDragging = false;

    if (!planActive) {
      return;
    }

    dragging = false;
    updateInfo();
  });

  renderer.domElement.addEventListener('wheel', (event) => {
    if (!orbitActive) {
      return;
    }

    event.preventDefault();
    orbitRadius = Math.min(90, Math.max(7, orbitRadius * (1 + event.deltaY * 0.001)));
    applyOrbit();
  });

  renderer.domElement.addEventListener('contextmenu', (event) => {
    if (orbitActive) {
      event.preventDefault();
    }
  });

  const views: Array<View> = [
    ...PROBES.map((config) => ({
      key: config.key,
      name: config.name,
      select: () => {
        planActive = false;
        orbitActive = false;
        updateInfo();
        selectPlazaCamera();
        return buildPost(buildScene(config, false), camera, config.bloomStrength, config.bloomThreshold);
      },
    })),
    {
      key: 'assembly',
      name: '3 · Assembly draft',
      select: () => {
        planActive = false;
        orbitActive = false;
        updateInfo();
        selectPlazaCamera();
        return buildPost(buildScene(NIGHT, true), camera, NIGHT.bloomStrength, NIGHT.bloomThreshold);
      },
    },
    {
      key: 'inspect',
      name: '4 · Inspect (orbit)',
      select: () => {
        planActive = false;
        orbitActive = true;
        orbitTarget.set(0, 4, -7);
        orbitRadius = 33.5;
        orbitTheta = 0;
        orbitPhi = 1.42;
        applyOrbit();
        updateInfo();

        // the inspector always shows the full current treatment
        renderer.toneMapping = AgXToneMapping;
        return buildPost(buildScene(NIGHT, true, true, true), camera, NIGHT.bloomStrength, NIGHT.bloomThreshold, true);
      },
    },
    {
      key: 'plan',
      name: '5 · Plan (drag)',
      select: () => {
        planActive = true;
        orbitActive = false;
        selected = null;
        updatePlanCamera();

        const plan = buildPlanScene();

        planGroups = plan.groups;
        updateInfo();
        return buildPost(plan.scene, planCamera, 0, 1);
      },
    },
    {
      key: 'grade',
      name: '6 · Grade',
      select: () => {
        planActive = false;
        orbitActive = false;
        updateInfo();
        selectPlazaCamera();
        renderer.toneMapping = AgXToneMapping;
        return buildPost(buildScene(NIGHT, true), camera, NIGHT.bloomStrength, NIGHT.bloomThreshold, true);
      },
    },
    {
      key: 'grade-ground',
      name: '7 · Grade+AO',
      select: () => {
        planActive = false;
        orbitActive = false;
        updateInfo();
        selectPlazaCamera();
        renderer.toneMapping = AgXToneMapping;
        return buildPost(buildScene(NIGHT, true, true), camera, NIGHT.bloomStrength, NIGHT.bloomThreshold, true);
      },
    },
    {
      key: 'surfaces',
      name: '8 · Surfaces',
      select: () => {
        planActive = false;
        orbitActive = false;
        updateInfo();
        selectPlazaCamera();
        renderer.toneMapping = AgXToneMapping;
        return buildPost(
          buildScene(NIGHT, true, true, true),
          camera,
          NIGHT.bloomStrength,
          NIGHT.bloomThreshold,
          true,
        );
      },
    },
    {
      key: 'style',
      name: '9 · Style probe',
      select: () => {
        planActive = false;
        orbitActive = true;
        orbitTarget.set(0.6, 2, 0);
        orbitRadius = 12;
        orbitTheta = 0.35;
        orbitPhi = 1.25;
        applyOrbit();
        updateInfo();
        renderer.toneMapping = AgXToneMapping;

        // the probe's own post chain: screen-space occlusion is part of the style being judged
        const scene = buildStyleProbeScene();
        const scenePass = pass(scene, camera);

        scenePass.setMRT(mrt({ normal: normalView, output }));

        const scenePassColor = scenePass.getTextureNode('output');
        const aoPass = ao(scenePass.getTextureNode('depth'), scenePass.getTextureNode('normal'), camera);
        // the AO target is single-channel — broadcast its red channel, don't tint with it
        const lit = scenePassColor.mul(aoPass.getTextureNode().x);
        const post = new PostProcessing(renderer);

        post.outputNode = lit.add(bloom(lit, 0.12, 0.4, 0.9));

        return post;
      },
    },
    ...LINEUP_ELEMENTS.map((element) => ({
      key: element.key,
      name: element.name,
      select: () => {
        planActive = false;

        // model-inspector views are orbitable: start at the straight-on framing, then walk
        // around the candidates freely
        orbitActive = true;
        orbitTarget.set(0, element.lookY, 0);
        orbitRadius = element.camZ;
        orbitTheta = 0;
        orbitPhi = Math.acos(Math.min(1, 0.8 / element.camZ));
        applyOrbit();
        updateInfo();
        return buildPost(buildLineupScene(element), camera, 0.15, 0.95);
      },
    })),
  ];

  const first = views[0];

  if (!first) {
    return;
  }

  let activeKey = first.key;
  let postProcessing = first.select();

  const hud = document.getElementById('hud');
  const tuner = document.getElementById('tuner');

  const renderTuner = () => {
    if (!tuner) {
      return;
    }

    // a re-render (reset) keeps whichever sections the user had open
    const openSections = new Set(
      [...tuner.querySelectorAll('details[open] > summary')].map((summary) => summary.textContent ?? ''),
    );

    tuner.innerHTML = '';

    const head = document.createElement('div');

    head.className = 'tuner-head';

    const title = document.createElement('span');

    title.textContent = 'surface tuner';

    const copy = document.createElement('button');

    copy.textContent = 'copy json';
    copy.addEventListener('click', () => {
      const serialized = JSON.stringify(buildTunerConfig(), null, 2);

      console.log(serialized);
      void navigator.clipboard.writeText(serialized).catch(() => {});
      copy.textContent = 'copied';
      setTimeout(() => {
        copy.textContent = 'copy json';
      }, 1200);
    });

    const reset = document.createElement('button');

    reset.textContent = 'reset';
    reset.addEventListener('click', () => {
      for (const knob of tunerKnobs) {
        knob.value = knob.defaultValue;
        knob.apply(knob.value);
      }

      renderTuner();
    });

    head.append(title, reset, copy);
    tuner.appendChild(head);

    const sections = new Map<string, HTMLElement>();

    for (const knob of tunerKnobs) {
      const [sectionKey = 'misc'] = knob.path.split('.');
      let body = sections.get(sectionKey);

      if (!body) {
        const details = document.createElement('details');
        const summary = document.createElement('summary');

        summary.textContent = sectionKey;
        details.open = openSections.has(sectionKey);
        details.appendChild(summary);
        body = document.createElement('div');
        details.appendChild(body);
        tuner.appendChild(details);
        sections.set(sectionKey, body);
      }

      const row = document.createElement('div');

      row.className = 'tuner-row';

      const label = document.createElement('label');

      label.textContent = knob.label;
      label.title = knob.path;

      const range = document.createElement('input');

      range.type = 'range';
      range.min = String(knob.min);
      range.max = String(knob.max);
      range.step = String(knob.step);
      range.value = String(knob.value);

      const number = document.createElement('input');

      number.type = 'number';
      number.step = String(knob.step);
      number.value = String(knob.value);

      const commit = (raw: string) => {
        const value = Number(raw);

        if (!Number.isFinite(value)) {
          return;
        }

        knob.value = value;
        knob.apply(value);
        range.value = String(value);
        number.value = String(value);
      };

      range.addEventListener('input', () => commit(range.value));
      number.addEventListener('change', () => commit(number.value));
      row.append(label, range, number);
      body.appendChild(row);
    }
  };

  renderTuner();

  const selectView = (view: View) => {
    // grade views opt back in; everything else renders untonemapped
    renderer.toneMapping = NoToneMapping;
    sceneAnimations.length = 0;
    applyHoverGlow(null);
    postProcessing = view.select();
    activeKey = view.key;

    // re-impose tuned values onto the freshly built scene's lights/materials/bloom
    applyTunerKnobs();

    if (tuner) {
      tuner.style.display = view.key === 'inspect' || view.key === 'surfaces' ? 'block' : 'none';
    }

    renderHUD();
  };

  const renderHUD = () => {
    if (!hud) {
      return;
    }

    hud.innerHTML = '';

    for (const view of views) {
      const button = document.createElement('button');

      button.textContent = view.name;
      button.className = view.key === activeKey ? 'active' : '';
      button.addEventListener('click', () => selectView(view));
      hud.appendChild(button);
    }
  };

  renderHUD();

  globalThis.addEventListener('keydown', (event) => {
    // typing in a tuner input must not switch views
    if (event.target instanceof HTMLInputElement) {
      return;
    }

    if (planActive && selected && (event.key === 'q' || event.key === 'e')) {
      selected.target.ry += event.key === 'q' ? 0.05 : -0.05;
      selected.group.rotation.y = selected.target.ry;
      updateInfo();
      return;
    }

    // C copies the live camera as JSON — orbit to a framing, dump it, bake it as the default
    if (event.key === 'c') {
      const cameraState = {
        fov: camera.fov,
        position: {
          x: Math.round(camera.position.x * 100) / 100,
          y: Math.round(camera.position.y * 100) / 100,
          z: Math.round(camera.position.z * 100) / 100,
        },
        target: orbitActive
          ? {
              x: Math.round(orbitTarget.x * 100) / 100,
              y: Math.round(orbitTarget.y * 100) / 100,
              z: Math.round(orbitTarget.z * 100) / 100,
            }
          : { x: 0, y: 4, z: -7 },
      };
      const serialized = JSON.stringify(cameraState, null, 2);

      console.log(serialized);
      void navigator.clipboard.writeText(serialized).catch(() => {});
      updateInfo('camera copied to clipboard + console');
      return;
    }

    if (planActive && event.key === 'p') {
      const layout = {
        massing: massing
          .filter((spec) => !isNavRole(spec.role))
          .map(({ d, h, mast, role, ry, w, x, z }) => ({
            d,
            h: Math.round(h * 100) / 100,
            mast,
            role,
            ry: Math.round(ry * 1000) / 1000,
            w,
            x,
            z,
          })),
        placements: placements.map(({ key, ry, x, z }) => ({
          key,
          ry: Math.round(ry * 1000) / 1000,
          x,
          z,
        })),
      };
      const serialized = JSON.stringify(layout, null, 2);

      console.log(serialized);
      void navigator.clipboard.writeText(serialized).catch(() => {});
      updateInfo('layout copied to clipboard + console');
      return;
    }

    const index = Number(event.key) - 1;
    const view = views[index];

    if (view) {
      selectView(view);
    }
  });

  const params = new URLSearchParams(globalThis.location.search);
  const initial = views.find((view) => view.key === params.get('v'));

  if (initial) {
    selectView(initial);
  }

  globalThis.addEventListener('resize', () => {
    camera.aspect = globalThis.innerWidth / globalThis.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight);
  });

  renderer.setAnimationLoop(() => {
    const elapsed = performance.now() / 1000;

    for (const animation of sceneAnimations) {
      animation(elapsed);
    }

    postProcessing.render();
  });
}

void main();
