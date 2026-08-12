import { extend } from '@react-three/fiber';
import { sceneColors } from '@vers/design-system';
import type { FrontierEdge, Viewport } from '@vers/worldmap-core';
import {
  HEX_SIZE,
  collectFrontierEdges,
  collectRevealedCells,
  collectUnrevealedCells,
  toHexPosition,
} from '@vers/worldmap-core';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { BufferGeometry, InstancedMesh } from 'three';
import { BufferAttribute, Matrix4 } from 'three';
import { LineBasicNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { NODE_POSITION_SCALING_FACTOR } from '../consts';
import { useRevealSources } from '../state/use-reveal-sources';
import { useViewport } from '../state/use-viewport';

const SHROUD_COLOR = sceneColors.fogShroud;
const FRONTIER_COLOR = sceneColors.fogFrontier;

/**
 * Shroud tiles and the frontier line float just above the node plane so fog hides the nodes and
 * edges underneath it, with the line a step higher so it never z-fights its own tiles.
 */
const SHROUD_ELEVATION = 0.2;
const FRONTIER_ELEVATION = 0.3;
const SHROUD_RADIUS = HEX_SIZE * NODE_POSITION_SCALING_FACTOR;
const SHROUD_SEGMENTS = 6;

/**
 * Rotates the shroud hexagon's first vertex to +30° so its corners land on the pointy-top lattice
 * corners and adjacent tiles share edges exactly.
 */
const SHROUD_THETA_START = Math.PI / 6;
const ShroudMaterial = extend(MeshBasicNodeMaterial);
const FrontierMaterial = extend(LineBasicNodeMaterial);

const instanceMatrix = new Matrix4();

/**
 * Draws fog of war over the world map: an opaque hex tile on every unrevealed viewport cell, and a
 * line tracing the frontier where revealed cells border unrevealed ones. Purely presentational — it
 * projects the revealed region from the store's reveal sources on every viewport change and stores
 * nothing itself. The projection runs over the viewport inflated by one cell so frontier sides at
 * the viewport edge classify their outside neighbours correctly, and renders nothing until both a
 * viewport and reveal sources exist.
 */
export function FogOfWar() {
  const revealSources = useRevealSources();
  const viewport = useViewport();

  const fog = useMemo(() => {
    if (revealSources === null || viewport === null) {
      return null;
    }

    const inflated: Viewport = {
      maxCX: viewport.maxCX + 1,
      maxCY: viewport.maxCY + 1,
      minCX: viewport.minCX - 1,
      minCY: viewport.minCY - 1,
    };

    const revealedCells = collectRevealedCells(revealSources, inflated);

    return {
      frontierEdges: collectFrontierEdges(revealedCells, viewport),
      shroudedCells: collectUnrevealedCells(revealedCells, viewport),
    };
  }, [revealSources, viewport]);

  if (fog === null) {
    return null;
  }

  return (
    <>
      <ShroudTiles cells={fog.shroudedCells} />
      <FrontierLine edges={fog.frontierEdges} />
    </>
  );
}

interface ShroudTilesProps {
  readonly cells: ReadonlyArray<readonly [number, number]>;
}

function ShroudTiles(props: Readonly<ShroudTilesProps>) {
  const meshRef = useRef<InstancedMesh | null>(null);

  // rebuild every instance's transform whenever the shrouded-cell list changes: a fresh
  // `InstancedMesh` (its `args`-derived count changed) has no prior state to preserve
  useLayoutEffect(() => {
    const mesh = meshRef.current;

    if (!mesh) {
      return;
    }

    for (const [index, cell] of props.cells.entries()) {
      const [x, y] = toHexPosition(cell[0], cell[1]);

      mesh.setMatrixAt(
        index,
        instanceMatrix.makeTranslation(
          x * NODE_POSITION_SCALING_FACTOR,
          y * NODE_POSITION_SCALING_FACTOR,
          SHROUD_ELEVATION,
        ),
      );
    }

    mesh.instanceMatrix.needsUpdate = true;

    mesh.computeBoundingSphere();
  }, [props.cells]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, props.cells.length]}>
      <circleGeometry args={[SHROUD_RADIUS, SHROUD_SEGMENTS, SHROUD_THETA_START]} />
      <ShroudMaterial color={SHROUD_COLOR} />
    </instancedMesh>
  );
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
      <FrontierMaterial color={FRONTIER_COLOR} />
    </lineSegments>
  );
}
