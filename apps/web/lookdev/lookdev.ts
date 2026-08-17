/**
 * Respite style probes — spike only, never merged to a shipping path.
 *
 * Views: the two plaza mood probes, shaded silhouette lineups for the elements still being
 * designed (stash, codex, gate), and a draft assembly placing the current best part sets into
 * the plaza to judge the silhouettes in context.
 */
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { color, mix, mx_noise_float, pass, positionWorld, screenUV, uniform, vec3 } from 'three/tsl';
import {
  AgXToneMapping,
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
    { d: 3.6, facing: 'pz', h: 5, mast: false, role: 'filler', ry: 0.06, w: 4, x: -11.4, y: 0, z: -18.9 },
    { d: 4, facing: 'pz', h: 6, mast: false, role: 'filler', ry: 0.06, w: 3.8, x: 15.3, y: 0, z: -18.4 },
    { d: 5, facing: 'nx', h: 4.6, mast: false, role: 'filler', ry: 0.04, w: 4.5, x: 15.5, y: 0, z: -11.1 },
    { d: 6, facing: 'px', h: 5.5, mast: false, role: 'fore', ry: 0.05, w: 6, x: -20.2, y: 0, z: -9.2 },
    { d: 6, facing: 'nx', h: 4.5, mast: false, role: 'fore', ry: 0.07, w: 6, x: 13.8, y: 0, z: -23.9 },
    { d: 3.94, facing: 'pz', h: 11.81, mast: false, role: 'back', ry: 0.064, w: 3.08, x: -8.2, y: 0, z: -24.7 },
    { d: 2.89, facing: 'pz', h: 8.57, mast: false, role: 'back', ry: 0.07, w: 4.04, x: -17.3, y: 0, z: -20.8 },
    { d: 2.9, facing: 'pz', h: 7.05, mast: false, role: 'back', ry: 0.037, w: 2.71, x: -4.3, y: 0, z: -19.6 },
    { d: 2.69, facing: 'pz', h: 6.99, mast: false, role: 'back', ry: -1.495, w: 5.02, x: 19.9, y: 0, z: -15.4 },
    { d: 3.75, facing: 'pz', h: 5.77, mast: false, role: 'back', ry: 0.066, w: 5.29, x: -13.9, y: 0, z: -25.9 },
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
 * The gate's mid-scale form pass, in the worn-slab register: strata courses and etched grooves on
 * the wall faces, an under-lintel, a threshold slab, and broken stubs of an older gate flanking
 * the opening.
 */
const GATE_FORM_PARTS: ReadonlyArray<SilhouettePart> = [
  { g: 'box', sx: 4.4, sy: 1.4, sz: 2.2, x: -3.9, y: 0.7, z: 0 },
  { g: 'box', sx: 4.4, sy: 1.4, sz: 2.2, x: 3.9, y: 0.7, z: 0 },
  { g: 'box', sx: 3.6, sy: 4.6, sz: 1.8, x: -3.7, y: 3.7, z: 0 },
  { g: 'box', sx: 3.6, sy: 4.6, sz: 1.8, x: 3.7, y: 3.7, z: 0 },
  { g: 'box', sx: 11, sy: 1.4, sz: 1.8, x: 0, y: 6.7, z: 0 },
  { g: 'box', sx: 9.6, sy: 0.5, sz: 1.5, x: 0, y: 5.95, z: 0.1 },
  { g: 'box', sx: 1.6, sy: 1, sz: 1.2, x: 0, y: 7.9, z: 0 },
  // strata courses wrap the walls fully, slightly proud on both faces
  { g: 'box', sx: 3.7, sy: 0.45, sz: 1.9, x: -3.7, y: 2.2, z: 0 },
  { g: 'box', sx: 3.7, sy: 0.45, sz: 1.9, x: 3.7, y: 2.2, z: 0 },
  { g: 'box', sx: 3.65, sy: 0.4, sz: 1.85, x: -3.7, y: 4.15, z: 0 },
  { g: 'box', sx: 3.65, sy: 0.4, sz: 1.85, x: 3.7, y: 4.15, z: 0 },
  { g: 'box', sx: 4.2, sy: 0.3, sz: 2.6, x: 0, y: 0.15, z: 0.6 },
  // broken corner stubs of the older gate, one centered on each outer plinth corner
  { g: 'box', sx: 0.9, sy: 1.6, sz: 0.9, x: -6.1, y: 0.8, z: 1.1 },
  { g: 'box', sx: 0.9, sy: 1.1, sz: 0.9, x: 6.1, y: 0.55, z: 1.1 },
  { g: 'box', sx: 0.9, sy: 1.4, sz: 0.9, x: -6.1, y: 0.7, z: -1.1 },
  { g: 'box', sx: 0.9, sy: 1, sz: 0.9, x: 6.1, y: 0.5, z: -1.1 },
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
  { key: 'market', parts: MARKET_FORM_PARTS, ry: 1.631, x: -14.3, z: 2.2 },
  { key: 'stash', parts: STASH_FORM_PARTS, ry: 1.063, x: -12.7, z: -10.6 },
  { key: 'codex', litAllBoxes: true, parts: CODEX_HALL_FORM_PARTS, ry: 0.06, x: -4.6, z: -14.7 },
  { key: 'gate', noWindows: true, parts: GATE_FORM_PARTS, ry: 0.05, x: 5.9, z: -16.4 },
  { key: 'avatar', parts: AVATAR_PARTS, ry: -1.451, x: 16.1, z: -5.3 },
  { key: 'fountain', noWindows: true, parts: FOUNTAIN_FORM_PARTS, ry: 0, x: -3.9, z: 0.7 },
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

/** Live scene objects the current view registered for setter knobs; null outside tuned views. */
const liveRefs = {
  ambient: null as AmbientLight | null,
  bloom: null as { strength: { value: number }; threshold: { value: number } } | null,
  bounce: null as HemisphereLight | null,
  gateGlow: null as PointLight | null,
  keyLight: null as DirectionalLight | null,
  lamps: [] as Array<PointLight>,
  materials: {} as Record<string, MeshStandardNodeMaterial>,
  spills: [] as Array<{ base: number; light: PointLight }>,
  washes: [] as Array<{ base: number; light: PointLight }>,
};

const groundingKnobs = makeKnobGroup('grounding', {
  falloff: [0.25, 0.05, 1],
  depth: [0.68, 0, 1],
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
  wearScale: [0.45, 0.05, 3, 0.05],
  wearAmp: [0.5, 0, 1.5],
  wearFadeFrom: [1.2, 0, 6, 0.1],
  wearFadeTo: [4.6, 0, 9, 0.1],
  courseWidth: [0.3, 0.02, 1],
  course1Height: [2.2, 0, 8, 0.02],
  course1Depth: [0.18, 0, 1],
  course2Height: [4.15, 0, 8, 0.02],
  course2Depth: [0.18, 0, 1],
  grainAmp: [0.07, 0, 0.3, 0.005],
  clampLo: [0.5, 0, 1],
  clampHi: [1.18, 1, 2],
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
  paverCell: [0.3, 0.05, 1.5],
  paverAmp: [0.16, 0, 1],
  jointDepth: [0.16, 0, 1],
  wearScale: [0.22, 0.05, 3],
  wearAmp: [0.16, 0, 1],
  grainAmp: [0.05, 0, 0.3, 0.005],
  clampLo: [0.62, 0, 1],
  clampHi: [1.14, 1, 2],
});

for (const [buildingKey, roughness] of [
  ['market', 0.85],
  ['stash', 0.55],
  ['codex', 0.85],
  ['gate', 0.85],
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
  'light.lamps',
  16,
  0,
  60,
  (value) => {
    for (const lamp of liveRefs.lamps) {
      lamp.intensity = value;
    }
  },
  0.5,
);
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

const gradeKnobs = makeKnobGroup('grade', {
  vignette: [0.4, 0, 1],
  vignetteMin: [0.55, 0, 1],
  warmth: [1, 0, 2],
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

  // worn slab: heavy organic weathering low on the walls, darkened strata at the course heights
  gate: () =>
    buildLowWear(gateKnobs.wearScale, gateKnobs.wearAmp, gateKnobs.wearFadeFrom, gateKnobs.wearFadeTo)
      .sub(buildCourseShadow(gateKnobs.course1Height, gateKnobs.courseWidth, gateKnobs.course1Depth))
      .sub(buildCourseShadow(gateKnobs.course2Height, gateKnobs.courseWidth, gateKnobs.course2Depth))
      .add(buildGrain(gateKnobs.grainAmp))
      .add(1)
      .clamp(gateKnobs.clampLo, gateKnobs.clampHi),

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
  liveRefs.ambient = surfaces ? ambient : null;
  liveRefs.bounce = surfaces ? bounce : null;
  liveRefs.keyLight = surfaces ? directional : null;
  liveRefs.gateGlow = null;
  liveRefs.lamps = [];
  liveRefs.materials = {};
  liveRefs.spills = [];
  liveRefs.washes = [];

  const groundMaterial = new MeshStandardNodeMaterial({ color: new Color(config.ground), roughness: 0.6 });
  const ground = new Mesh(new PlaneGeometry(220, 220), groundMaterial);

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

  // warm pools of lamp light on the pavement — the square's stage lighting
  for (const lamp of [LAMPS[1], LAMPS[4], LAMPS[6], LAMPS[8]]) {
    if (!lamp) {
      continue;
    }

    const light = new PointLight(new Color(WARM_WINDOW), 16, 14, 2);

    light.position.set(lamp.x, 2.9, lamp.z);
    scene.add(light);

    if (surfaces) {
      liveRefs.lamps.push(light);
    }
  }

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

      renderPartSet(scene, placement.parts, material, placement.x, placement.z, placement.ry);
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

  const emissives = [
    ...buildWindows(specs, config, !useParts),
    ...buildPlazaLights(useParts ? fountainX : 4.5, useParts ? fountainZ : 1.5),
    ...buildInstruments(specs, !useParts),
  ];

  if (useParts) {
    for (const [index, placement] of placements.entries()) {
      if (placement.noWindows) {
        continue;
      }

      emissives.push(...buildPartSetWindows(placement, config, 4200 + index));
    }
  }

  // gate edge strips join the emissive set: vertical teal lines flanking the opening, anchored
  // to wherever the gate sits
  for (const offset of [-1.7, 1.7]) {
    const px = (useParts ? gateX : 6.2) + offset;
    const pz = (useParts ? gateZ : -14.2) + 0.8;

    for (let index = 0; index < 8; index += 1) {
      emissives.push({
        color: new Color(GATE_TEAL).multiplyScalar(1.9),
        x: px,
        y: 0.7 + index * 0.72,
        z: pz,
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

  const camera = new PerspectiveCamera(36, globalThis.innerWidth / globalThis.innerHeight, 0.1, 300);

  camera.position.set(0, 9, 26);
  camera.lookAt(0, 3, -7);

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
    let output = scenePassColor.add(bloomPass);

    liveRefs.bloom = grade ? bloomPass : null;

    if (grade) {
      // vignette plus a gentle warm lean — the grading half of the treatment
      const vignette = screenUV
        .sub(0.5)
        .length()
        .mul(1.25)
        .pow(2)
        .mul(gradeKnobs.vignette)
        .oneMinus()
        .clamp(gradeKnobs.vignetteMin, 1);

      output = output.mul(vignette).mul(mix(vec3(1), vec3(1.05, 1.0, 0.94), gradeKnobs.warmth));
    }

    post.outputNode = output;

    return post;
  };

  interface View {
    readonly key: string;
    readonly name: string;
    readonly select: () => PostProcessing;
  }

  const selectPlazaCamera = () => {
    camera.position.set(0, 9, 26);
    camera.lookAt(0, 3, -7);
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
        ? 'drag to orbit · shift-drag to pan · wheel to zoom'
        : '';
    info.style.display = planActive || orbitActive ? 'block' : 'none';
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
    postProcessing.render();
  });
}

void main();
