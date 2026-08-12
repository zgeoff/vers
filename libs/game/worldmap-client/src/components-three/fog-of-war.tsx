import { extend } from '@react-three/fiber';
import { sceneColors } from '@vers/design-system';
import type { FrontierEdge, RevealDistanceField, Viewport } from '@vers/worldmap-core';
import {
  buildRevealDistanceField,
  collectFrontierEdges,
  collectRevealedCells,
  toHexPosition,
} from '@vers/worldmap-core';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  RedFormat,
  UnsignedByteType,
} from 'three';
import { texture } from 'three/tsl';
import { LineBasicNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import { useRevealSources } from '../state/use-reveal-sources';
import { useViewport } from '../state/use-viewport';

const SHROUD_COLOR = sceneColors.fogShroud;
const FRONTIER_COLOR = sceneColors.fogFrontier;

/**
 * Hex hops over which fog density eases from clear to fully opaque. Wider reads softer; the reveal
 * projection is inflated by this plus one cell so the gradient never hardens at the viewport edge.
 */
const FOG_FALLOFF_CELLS = 2;

/**
 * How strongly the frontier accent line reads against the fog gradient it sits inside.
 */
const FRONTIER_OPACITY = 0.35;

/**
 * The fog plane and the frontier line float just above the node plane so dense fog hides the nodes
 * and edges underneath it, with the line a step higher so it never z-fights the plane.
 */
const FOG_ELEVATION = 0.2;
const FRONTIER_ELEVATION = 0.3;
const FrontierMaterial = extend(LineBasicNodeMaterial);

/**
 * Draws soft fog of war over the world map: one viewport-covering plane whose per-fragment opacity
 * samples a fog-density texture — 0 over revealed ground, easing to 1 past the falloff distance —
 * plus a faint line tracing the frontier where revealed cells border unrevealed ones. Purely
 * presentational: it projects the revealed region from the store's reveal sources on every
 * viewport change and stores nothing itself. It renders nothing until both a viewport and reveal
 * sources exist.
 */
export function FogOfWar() {
  const revealSources = useRevealSources();
  const viewport = useViewport();

  const fog = useMemo(() => {
    if (revealSources === null || viewport === null) {
      return null;
    }

    const inflated: Viewport = {
      maxCX: viewport.maxCX + FOG_FALLOFF_CELLS + 1,
      maxCY: viewport.maxCY + FOG_FALLOFF_CELLS + 1,
      minCX: viewport.minCX - FOG_FALLOFF_CELLS - 1,
      minCY: viewport.minCY - FOG_FALLOFF_CELLS - 1,
    };

    const revealedCells = collectRevealedCells(revealSources, inflated);

    return {
      field: buildRevealDistanceField(revealedCells, inflated, FOG_FALLOFF_CELLS),
      fieldViewport: inflated,
      frontierEdges: collectFrontierEdges(revealedCells, viewport),
    };
  }, [revealSources, viewport]);

  if (fog === null) {
    return null;
  }

  return (
    <>
      <FogPlane field={fog.field} viewport={fog.fieldViewport} />
      <FrontierLine edges={fog.frontierEdges} />
    </>
  );
}

interface FogPlaneProps {
  readonly field: RevealDistanceField;
  readonly viewport: Viewport;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- RevealDistanceField carries a Float32Array, which has no readonly form
function FogPlane(props: Readonly<FogPlaneProps>) {
  const plane = useMemo(() => {
    const bytes = new Uint8Array(props.field.values.length);

    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.round((props.field.values[index] ?? 0) * 255);
    }

    const map = new DataTexture(
      bytes,
      props.field.cols,
      props.field.rows,
      RedFormat,
      UnsignedByteType,
    );

    // bilinear sampling between texel centers is what turns the per-cell density grid into a
    // continuous gradient across each cell
    map.magFilter = LinearFilter;
    map.minFilter = LinearFilter;
    map.needsUpdate = true;

    const material = new MeshBasicNodeMaterial({
      color: SHROUD_COLOR,
      depthWrite: false,
      transparent: true,
    });

    material.opacityNode = texture(map).r;

    return { geometry: buildFogPlaneGeometry(props.viewport), map, material };
  }, [props.field, props.viewport]);

  useEffect(
    () => () => {
      plane.geometry.dispose();
      plane.material.dispose();
      plane.map.dispose();
    },
    [plane],
  );

  return <mesh geometry={plane.geometry} material={plane.material} />;
}

/**
 * One parallelogram quad covering the viewport's cell box in scene space. The axial-to-scene
 * mapping is linear, so the quad's uv interpolation lands each density texel's center exactly on
 * its cell's center; the half-cell margin puts the quad edge on the outermost cells' rims.
 */
function buildFogPlaneGeometry(viewport: Readonly<Viewport>): BufferGeometry {
  const corners = [
    toHexPosition(viewport.minCX - 0.5, viewport.minCY - 0.5),
    toHexPosition(viewport.maxCX + 0.5, viewport.minCY - 0.5),
    toHexPosition(viewport.minCX - 0.5, viewport.maxCY + 0.5),
    toHexPosition(viewport.maxCX + 0.5, viewport.maxCY + 0.5),
  ];

  const positions = new Float32Array(
    corners.flatMap(([x, y]) => [
      x * NODE_POSITION_SCALING_FACTOR,
      y * NODE_POSITION_SCALING_FACTOR,
      FOG_ELEVATION,
    ]),
  );

  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);

  return geometry;
}

interface FrontierLineProps {
  readonly edges: ReadonlyArray<FrontierEdge>;
}

const POSITION_COMPONENTS_PER_EDGE = 6;
const VERTEX_SIZE = 3;

function FrontierLine(props: Readonly<FrontierLineProps>) {
  const geometryRef = useRef<BufferGeometry | null>(null);

  // one draw call for the whole frontier: each boundary side contributes a vertex pair to a single
  // position buffer that `lineSegments` interprets as independent segments
  useLayoutEffect(() => {
    const geometry = geometryRef.current;

    if (!geometry) {
      return;
    }

    const positions = new Float32Array(props.edges.length * POSITION_COMPONENTS_PER_EDGE);

    for (const [index, edge] of props.edges.entries()) {
      positions.set(
        [
          edge[0][0] * NODE_POSITION_SCALING_FACTOR,
          edge[0][1] * NODE_POSITION_SCALING_FACTOR,
          FRONTIER_ELEVATION,
          edge[1][0] * NODE_POSITION_SCALING_FACTOR,
          edge[1][1] * NODE_POSITION_SCALING_FACTOR,
          FRONTIER_ELEVATION,
        ],
        index * POSITION_COMPONENTS_PER_EDGE,
      );
    }

    geometry.setAttribute('position', new BufferAttribute(positions, VERTEX_SIZE));
    geometry.computeBoundingSphere();
  }, [props.edges]);

  return (
    <lineSegments>
      <bufferGeometry ref={geometryRef} />
      <FrontierMaterial color={FRONTIER_COLOR} opacity={FRONTIER_OPACITY} transparent />
    </lineSegments>
  );
}
