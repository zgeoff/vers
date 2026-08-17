/**
 * Respite style probes — spike only, never merged to a shipping path.
 *
 * Views: the two plaza mood probes, shaded silhouette lineups for the elements still being
 * designed (stash, codex, gate), and a draft assembly placing the current best part sets into
 * the plaza to judge the silhouettes in context.
 */
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
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
  SphereGeometry,
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

      // every background row keeps a gap behind the codex tower, so its crown reads against sky
      // instead of merging into the terraces
      if (x > -7.5 && x < 3.5) {
        continue;
      }

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

function buildPlazaLights(): Array<EmissiveInstance> {
  const lamp = new Color(WARM_WINDOW).multiplyScalar(2.6);
  const lights: Array<EmissiveInstance> = LAMPS.map((spec) => ({
    color: lamp,
    x: spec.x,
    y: 1.15,
    z: spec.z,
  }));

  // the fountain's single cold instrument light, in the F register, on its low central hub
  lights.push({ color: new Color('#7dd3fc').multiplyScalar(2.4), x: 4.5, y: 1.6, z: 1.5 });

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
    camZ: 22,
    key: 'lineup-stash',
    lookY: 2.4,
    name: 'S · stash',
    spacing: 12,
    candidates: [
      STASH_VAULT_FACE,
      // B — double drum: two squat tanks sharing a collar
      [
        { g: 'cyl', sx: 2.2, sy: 2.8, sz: 2.2, x: -2.3, y: 1.4, z: 0 },
        { g: 'cyl', sx: 2.2, sy: 2.8, sz: 2.2, x: 2.3, y: 1.4, z: 0 },
        { g: 'box', sx: 3.4, sy: 1.6, sz: 3, x: 0, y: 0.8, z: 0 },
        { g: 'box', sx: 1, sy: 0.5, sz: 1, x: -2.3, y: 3.05, z: 0 },
        { g: 'box', sx: 1, sy: 0.5, sz: 1, x: 2.3, y: 3.05, z: 0 },
        { g: 'box', sx: 0.15, sy: 1.2, sz: 0.15, x: 0, y: 2.2, z: 0 },
      ],
      // C — clamp: a monolithic block locked under a heavy brace
      [
        { g: 'box', sx: 6, sy: 2.8, sz: 5, x: 0, y: 1.4, z: 0 },
        { g: 'box', sx: 0.8, sy: 4.2, sz: 1.2, x: -3.4, y: 2.1, z: 0 },
        { g: 'box', sx: 0.8, sy: 4.2, sz: 1.2, x: 3.4, y: 2.1, z: 0 },
        { g: 'box', sx: 7.6, sy: 1, sz: 1.4, x: 0, y: 4.7, z: 0 },
        { g: 'box', sx: 1.2, sy: 0.6, sz: 1.6, x: -3.4, y: 0.3, z: 0 },
        { g: 'box', sx: 1.2, sy: 0.6, sz: 1.6, x: 3.4, y: 0.3, z: 0 },
      ],
    ],
  },
  {
    camZ: 24,
    key: 'lineup-codex',
    lookY: 3,
    name: 'S · codex',
    spacing: 12,
    candidates: [CODEX_ARCHIVE_HALL, CODEX_LISTENING_BOWL, CODEX_PRECINCT],
  },
  {
    camZ: 24,
    key: 'lineup-gate',
    lookY: 4,
    name: 'S · gate',
    spacing: 14,
    candidates: [
      GATE_BASTION_SLOT,
      // B — twin bastions: flanking towers, double-deck connection
      [
        { g: 'box', sx: 2.8, sy: 6.5, sz: 2.6, x: -4, y: 3.25, z: 0 },
        { g: 'box', sx: 2.8, sy: 6.5, sz: 2.6, x: 4, y: 3.25, z: 0 },
        { g: 'box', sx: 5.6, sy: 1, sz: 1.6, x: 0, y: 6.6, z: 0 },
        { g: 'box', sx: 5.4, sy: 0.5, sz: 1.4, x: 0, y: 4.6, z: 0 },
        { g: 'box', sx: 0.12, sy: 1.8, sz: 0.12, x: -4, y: 7.4, z: 0 },
        { g: 'box', sx: 0.12, sy: 1.8, sz: 0.12, x: 4, y: 7.4, z: 0 },
      ],
      // C — maw: symmetric walls leaning in, the opening narrowing toward the header
      [
        { g: 'box', rz: -0.15, sx: 3, sy: 5.4, sz: 1.8, x: -3.4, y: 2.7, z: 0 },
        { g: 'box', rz: 0.15, sx: 3, sy: 5.4, sz: 1.8, x: 3.4, y: 2.7, z: 0 },
        { g: 'box', sx: 8, sy: 1.6, sz: 1.8, x: 0, y: 6.3, z: 0 },
        { g: 'box', sx: 6, sy: 0.4, sz: 3, x: 0, y: 0.2, z: 1.6 },
        { g: 'box', sx: 0.12, sy: 2, sz: 0.12, x: 0, y: 8.1, z: 0 },
      ],
    ],
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

    mesh.position.set(x, part.y, z);
    mesh.rotation.set(part.rx ?? 0, ry, part.rz ?? 0);
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
  const ambient = new AmbientLight(new Color('#39406b'), 0.9);
  const key = new DirectionalLight(new Color('#8fa0c2'), 1.1);

  key.position.set(-18, 26, 34);
  scene.add(ambient, key);

  const material = new MeshStandardNodeMaterial({ color: new Color('#1a2032'), roughness: 0.85 });

  for (const [index, candidate] of element.candidates.entries()) {
    renderPartSet(scene, candidate, material, (index - 1) * element.spacing, 0, 0);
  }

  return scene;
}

const HALF_PI = 1.5708;

interface AssemblyPlacement {
  /** Light a window grid on every substantial box, not only the largest — for stacked-slab forms. */
  readonly litAllBoxes?: boolean;
  readonly parts: ReadonlyArray<SilhouettePart>;
  readonly ry: number;
  readonly x: number;
  readonly z: number;
}

/**
 * The current best part set for each element, placed at its round-4 plaza anchor. Yaw turns each
 * set's authored front (+z) toward the plaza.
 */
const ASSEMBLY: ReadonlyArray<AssemblyPlacement> = [
  { parts: MARKET_PARTS, ry: HALF_PI + 0.16, x: -14.5, z: -1.6 },
  { parts: STASH_DOUBLE_DRUM, ry: HALF_PI, x: -13.8, z: -11.8 },
  { litAllBoxes: true, parts: CODEX_ARCHIVE_STACK, ry: 0.06, x: -2, z: -14.5 },
  { parts: GATE_BASTION_SLOT, ry: 0, x: 6.2, z: -14.2 },
  { parts: AVATAR_PARTS, ry: -HALF_PI - 0.13, x: 14.6, z: -4 },
];

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

    const door = toWorldOffset(placement.x, placement.z, placement.ry, largest.x, largest.z + radius);

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

function buildScene(config: ProbeConfig, useParts: boolean): Scene {
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
  const boxSpecs = useParts ? specs.filter((spec) => !isNavRole(spec.role)) : specs;
  const boxGeometry = partGeometries.box;
  const buildings = new InstancedMesh(
    boxGeometry,
    new MeshStandardNodeMaterial({ roughness: 0.85 }),
    boxSpecs.length,
  );
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

  if (useParts) {
    const partMaterial = new MeshStandardNodeMaterial({ color: navColor, roughness: 0.85 });

    for (const placement of ASSEMBLY) {
      renderPartSet(scene, placement.parts, partMaterial, placement.x, placement.z, placement.ry);
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
  }

  const gateGlow = new PointLight(new Color(GATE_TEAL), 30, 20, 2);

  gateGlow.position.set(6.2, 2.5, -17.5);
  scene.add(gateGlow);

  // the plaza fountain: flat stacked disks off the square's center line, the instrument light
  // on its low central hub
  const fountainMaterial = new MeshStandardNodeMaterial({
    color: litColor.clone().multiplyScalar(0.55),
    roughness: 0.7,
  });

  for (const disk of [
    { r: 2, h: 0.45, y: 0.22 },
    { r: 1.35, h: 0.4, y: 0.62 },
    { r: 0.5, h: 0.85, y: 1.05 },
  ]) {
    const tier = new Mesh(partGeometries.cyl, fountainMaterial);

    tier.position.set(4.5, disk.y, 1.5);
    tier.scale.set(disk.r, disk.h, disk.r);
    scene.add(tier);
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
    ...buildPlazaLights(),
    ...buildInstruments(specs, !useParts),
  ];

  if (useParts) {
    for (const [index, placement] of ASSEMBLY.entries()) {
      // the gate is a threshold, not an occupied building — its light is the teal edge strips
      if (placement.parts === GATE_BASTION_SLOT) {
        continue;
      }

      emissives.push(...buildPartSetWindows(placement, config, 4200 + index));
    }
  }

  // gate edge strips join the emissive set: vertical teal lines flanking the opening
  const stripXs = useParts ? [4.5, 7.9] : [4.7, 7.7];

  for (const px of stripXs) {
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

  const buildPost = (scene: Scene, strength: number, threshold: number): PostProcessing => {
    const scenePass = pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode();
    const bloomPass = bloom(scenePassColor, strength, 0.4, threshold);
    const post = new PostProcessing(renderer);

    post.outputNode = scenePassColor.add(bloomPass);

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

  const views: Array<View> = [
    ...PROBES.map((config) => ({
      key: config.key,
      name: config.name,
      select: () => {
        selectPlazaCamera();
        return buildPost(buildScene(config, false), config.bloomStrength, config.bloomThreshold);
      },
    })),
    {
      key: 'assembly',
      name: '3 · Assembly draft',
      select: () => {
        selectPlazaCamera();
        return buildPost(buildScene(NIGHT, true), NIGHT.bloomStrength, NIGHT.bloomThreshold);
      },
    },
    ...LINEUP_ELEMENTS.map((element) => ({
      key: element.key,
      name: element.name,
      select: () => {
        camera.position.set(0, element.lookY + 0.8, element.camZ);
        camera.lookAt(0, element.lookY, 0);
        return buildPost(buildLineupScene(element), 0.15, 0.95);
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

  const selectView = (view: View) => {
    postProcessing = view.select();
    activeKey = view.key;
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
