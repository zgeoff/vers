import type { DataTexture } from 'three';
import { mx_noise_float, positionWorld, texture, time } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * Minimal structural view of a runtime TSL node, standing in for three's own operator types: every
 * operator there carries thousands of conditionally typed overloads and swizzle getters, and one
 * call sends the native compiler's inference into a multi-gigabyte runaway that OOMs the machine.
 * Only the operations the scene's shader math uses appear here; the objects behind it are real TSL
 * nodes throughout, so the runtime graph is unchanged.
 */
export interface TSLMathNode {
  readonly add: (other: TSLMathNode | number) => TSLMathNode;
  readonly clamp: (min: number, max: number) => TSLMathNode;
  readonly mul: (other: TSLMathNode | number) => TSLMathNode;
  readonly oneMinus: () => TSLMathNode;
  readonly sin: () => TSLMathNode;
  readonly sub: (other: TSLMathNode | number) => TSLMathNode;
}

/**
 * The texture node keeps its sampled channel beside the mutable value slot: assigning a new
 * texture rebinds the sampler on the next frame without touching the compiled shader.
 */
export interface TSLTextureNode {
  readonly r: TSLMathNode;
  value: DataTexture;
}

interface SceneTSL {
  readonly mx_noise_float: (coord: TSLMathNode) => TSLMathNode;
  readonly positionWorld: { readonly xz: TSLMathNode };
  readonly shade: (map: Readonly<TSLTextureNode>, factor: TSLMathNode) => Node<'vec4'>;
  readonly texture: (map: DataTexture) => TSLTextureNode;
  readonly time: TSLMathNode;
  readonly toNode: (node: Readonly<TSLTextureNode> | TSLMathNode) => Node<'vec4'>;
}

const sceneTSLValues = {
  mx_noise_float,
  positionWorld,
  shade: (map: { mul: (factor: unknown) => unknown }, factor: unknown) => map.mul(factor),
  texture,
  time,
  toNode: (node: unknown) => node,
};

/**
 * The one boundary between three's node types and the minimal views above: everything the scene's
 * shader wiring touches enters through this facade already narrowed, so consuming modules carry no
 * assertions and the checker never opens three's operator types.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the values are untouched runtime TSL builders; only the static view narrows
export const sceneTSL = sceneTSLValues as unknown as SceneTSL;
