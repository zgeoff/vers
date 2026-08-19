/**
 * Every tunable in the viewer, with the round-34 settle as defaults. Uniform knob groups feed
 * TSL graphs directly; setter knobs write onto whatever live objects the latest build put in
 * liveRefs. Saved overrides from knobs.json layer on top at boot.
 */
import { uniform } from 'three/tsl';
import type { AmbientLight, DirectionalLight, Fog, HemisphereLight } from 'three/webgpu';
import { makeKnobGroup, registerKnob } from './tuner';

/** Live scene objects the current build registered for setter knobs; null between builds. */
export const liveRefs = {
  ambient: null as AmbientLight | null,
  bloom: null as { strength: { value: number }; threshold: { value: number } } | null,
  bounce: null as HemisphereLight | null,
  fog: null as Fog | null,
  keyLight: null as DirectionalLight | null,
};

export const motionState = { streakDistance: 3, streakSpeed: 5 };

/**
 * The live pixel ratio, mirrored into a uniform. The ink pass measures its sample offset in
 * buffer pixels, so without this a larger buffer would silently thin every outline until the
 * lines broke into dots — this keeps ink width meaning display pixels at any resolution.
 */
export const pixelRatio = uniform(1);

export const groundingKnobs = makeKnobGroup('grounding', {
  falloff: [0.268, 0.02, 0.4],
  depth: [0.1, 0, 1],
});

export const groundKnobs = makeKnobGroup('ground', {
  paverCell: [0.02, 0.02, 0.6],
  paverAmp: [0.37, 0, 1],
  jointDepth: [0.07, 0, 1],
  wearScale: [0.088, 0.02, 1.2],
  wearAmp: [0.16, 0, 1],
  grainAmp: [0.05, 0, 0.3, 0.005],
  clampLo: [0.77, 0, 1],
  clampHi: [1.14, 1, 2],
});

export const inkKnobs = makeKnobGroup('ink', {
  width: [1, 0, 6, 0.1],
  depthThreshold: [0.015, 0.001, 0.2, 0.001],
  normalThreshold: [0.35, 0.05, 3, 0.05],
  strength: [0.55, 0, 1],
});

export const atmoKnobs = makeKnobGroup('atmo', {
  bankOpacity: [0.23, 0, 0.8],
  mistOpacity: [0.26, 0, 0.8],
  smokeOpacity: [0.16, 0, 1],
  fogWall: [0.31, 0, 1],
  fogSea: [0.7, 0, 1],
  fogRadius: [57.5, 12, 112, 0.5],
  drift: [0.07, 0, 0.3, 0.005],
});

export const motionKnobs = makeKnobGroup('motion', {
  flicker: [0.5, 0, 1],
  rays: [0.01, 0, 1],
  streaks: [0.03, 0, 2],
});

export const gradeKnobs = makeKnobGroup('grade', {
  vignette: [0.53, 0, 1],
  vignetteMin: [0.4, 0, 1],
  warmth: [2, 0, 2],
});

registerKnob('light.ambient', 0.84, 0, 4, (value) => {
  if (liveRefs.ambient) {
    liveRefs.ambient.intensity = value;
  }
});
registerKnob('light.bounce', 1.05, 0, 4, (value) => {
  if (liveRefs.bounce) {
    liveRefs.bounce.intensity = value;
  }
});
registerKnob('light.keyLight', 1.92, 0, 6, (value) => {
  if (liveRefs.keyLight) {
    liveRefs.keyLight.intensity = value;
  }
});
registerKnob(
  'light.fogNear',
  65,
  12,
  500,
  (value) => {
    if (liveRefs.fog) {
      liveRefs.fog.near = value;
    }
  },
  1,
);
registerKnob(
  'light.fogFar',
  340,
  50,
  1000,
  (value) => {
    if (liveRefs.fog) {
      liveRefs.fog.far = value;
    }
  },
  1,
);

registerKnob('grade.bloomStrength', 0.46, 0, 2, (value) => {
  if (liveRefs.bloom) {
    liveRefs.bloom.strength.value = value;
  }
});
registerKnob('grade.bloomThreshold', 0.62, 0, 1, (value) => {
  if (liveRefs.bloom) {
    liveRefs.bloom.threshold.value = value;
  }
});

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
