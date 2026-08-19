/**
 * GPU resource lifecycle. Everything a scene build creates is disposed when the next view
 * select tears it down — without this, every rebuild leaks GPU buffers until the browser's
 * GPU process dies. Resources that outlive a single build (loaded model geometry, shared hull
 * materials) sit in the persistent set and are skipped by the traversal.
 */
import type { InstancedMesh, Mesh, Scene } from 'three/webgpu';

export const persistentResources = new Set<unknown>();

/** Per-frame updaters for the current scene's animated meshes; cleared on every view select. */
export const sceneAnimations: Array<(elapsed: number) => void> = [];

export interface BuiltRefs {
  readonly nodes: Array<{ dispose?: () => void }>;
  readonly scene: Scene | null;
}

let built: BuiltRefs = { nodes: [], scene: null };

export function trackBuiltScene(scene: Scene) {
  built = { nodes: built.nodes, scene };
}

export function trackBuiltNodes(nodes: Array<{ dispose?: () => void }>) {
  built = { nodes, scene: built.scene };
}

export function getBuilt(): BuiltRefs {
  return built;
}

export function disposeBuiltScene(scene: Scene) {
  scene.traverse((object) => {
    const mesh = object as Mesh;

    if (!mesh.isMesh) {
      return;
    }

    if (!persistentResources.has(mesh.geometry)) {
      mesh.geometry.dispose();
    }

    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!persistentResources.has(material)) {
        material.dispose();
      }
    }

    (mesh as Partial<InstancedMesh>).dispose?.();
  });
}
