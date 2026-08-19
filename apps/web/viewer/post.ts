/**
 * The post stack: scene pass → bloom → ink → vignette+warmth grade → FXAA. The ink pass reads
 * depth+normal edges from a second pass whose camera copies the view camera each frame but
 * never enables the atmosphere layer — fog is never outlined while buildings behind it keep
 * their ink. Returns the pass/effect nodes so the caller can dispose their render targets on
 * the next rebuild; the post-processing wrapper has no dispose of its own.
 */
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { float, mix, mrt, normalView, output, pass, screenSize, screenUV, vec2, vec3 } from 'three/tsl';
import {
  type OrthographicCamera,
  PerspectiveCamera,
  PostProcessing,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import { gradeKnobs, inkKnobs, liveRefs, pixelRatio } from './knobs';
import { sceneAnimations, trackBuiltNodes } from './lifecycle';

interface PostOptions {
  readonly bloomStrength?: number;
  readonly bloomThreshold?: number;
  readonly grade?: boolean;
}

export function buildPost(
  renderer: WebGPURenderer,
  scene: Scene,
  viewCamera: OrthographicCamera | PerspectiveCamera,
  options: PostOptions = {},
): PostProcessing {
  const { bloomStrength = 0.46, bloomThreshold = 0.62, grade = false } = options;
  const scenePass = pass(scene, viewCamera);
  const scenePassColor = scenePass.getTextureNode();
  const bloomPass = bloom(scenePassColor, bloomStrength, 0.4, bloomThreshold);
  const post = new PostProcessing(renderer);
  let composite = scenePassColor.add(bloomPass);
  const nodes: Array<{ dispose?: () => void }> = [scenePass, bloomPass];

  liveRefs.bloom = grade ? bloomPass : null;

  if (grade) {
    // depth deltas are taken relative to the center sample so the nonlinear buffer stays usable
    const edgeCamera = new PerspectiveCamera();

    sceneAnimations.push(() => {
      edgeCamera.copy(viewCamera as PerspectiveCamera);
      edgeCamera.layers.set(0);
    });

    const edgePass = pass(scene, edgeCamera);

    nodes.push(edgePass);
    edgePass.setMRT(mrt({ normal: normalView, output }));

    const depthTex = edgePass.getTextureNode('depth');
    const normalTex = edgePass.getTextureNode('normal');
    // width is in display pixels; scaling by the pixel ratio keeps line weight constant as the
    // buffer grows, so raising resolution smooths the ink instead of thinning it away
    const texel = inkKnobs.width.mul(pixelRatio).div(screenSize);
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
  const fxaaNode = fxaa(composite);

  // the fxaa wrapper renders its input into an internal RTT node whose RenderTarget has no
  // dispose of its own — free the target directly or it leaks ~40MB per rebuild
  nodes.push({
    dispose: () => {
      const rtt = (fxaaNode as unknown as { textureNode?: { renderTarget?: { dispose: () => void } } })
        .textureNode;

      rtt?.renderTarget?.dispose();
    },
  });
  post.outputNode = fxaaNode;
  trackBuiltNodes(nodes);

  return post;
}
