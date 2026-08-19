/**
 * The model registry: every .glb the side server lists, loaded and hot-reloaded. Blender
 * re-exports into the watched directory; the poll notices the mtime change, reloads the file,
 * swaps the entry, notifies subscribers (so live views rebuild), then frees the replaced
 * model's GPU resources.
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, type Group, type Mesh } from 'three/webgpu';
import { SERVE_BASE } from './data';
import { persistentResources } from './lifecycle';

export interface ModelEntry {
  readonly bounds: Box3;
  readonly group: Group;
  readonly mtime: number;
  readonly name: string;
}

const entries = new Map<string, ModelEntry>();
const entryResources = new Map<string, Array<{ dispose: () => void }>>();

type ModelListener = (changed: ReadonlyArray<string>, added: ReadonlyArray<string>) => void;

const listeners = new Set<ModelListener>();

export function subscribeModels(listener: ModelListener): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function getModel(name: string): ModelEntry | undefined {
  return entries.get(name);
}

export function listModels(): Array<string> {
  return [...entries.keys()].sort();
}

const loader = new GLTFLoader();

async function loadModel(name: string, mtime: number): Promise<Array<{ dispose: () => void }>> {
  const gltf = await loader.loadAsync(`${SERVE_BASE}/${name}?t=${mtime}`);
  const stale = entryResources.get(name) ?? [];

  for (const resource of stale) {
    persistentResources.delete(resource);
  }

  const resources: Array<{ dispose: () => void }> = [];

  gltf.scene.traverse((child) => {
    const mesh = child as Mesh;

    if (mesh.isMesh) {
      for (const resource of [
        mesh.geometry,
        ...(Array.isArray(mesh.material) ? mesh.material : [mesh.material]),
      ]) {
        persistentResources.add(resource);
        resources.push(resource as { dispose: () => void });
      }
    }
  });
  entryResources.set(name, resources);
  entries.set(name, { bounds: new Box3().setFromObject(gltf.scene), group: gltf.scene, mtime, name });

  return stale;
}

/**
 * Poll the side server's listing and reconcile the registry. Subscribers are notified after
 * every swap and before stale resources are freed, so a rebuild can release its last clone of
 * the outgoing model first.
 */
export function startModelWatch(intervalMs = 1500) {
  let syncing = false;

  const sync = async () => {
    if (syncing) {
      return;
    }

    syncing = true;

    try {
      const response = await fetch(`${SERVE_BASE}/index.json`, { cache: 'no-store' });

      if (!response.ok) {
        return;
      }

      const listing = (await response.json()) as Array<{ mtime: number; name: string }>;
      const listed = new Set(listing.map((item) => item.name));
      const changed: Array<string> = [];
      const added: Array<string> = [];
      const staleResources: Array<{ dispose: () => void }> = [];

      for (const item of listing) {
        const existing = entries.get(item.name);

        if (existing && existing.mtime === item.mtime) {
          continue;
        }

        try {
          staleResources.push(...(await loadModel(item.name, item.mtime)));
          (existing ? changed : added).push(item.name);
        } catch (error) {
          // export mid-write or malformed file — retry on the next tick
          console.warn(`model ${item.name} failed to load`, error);
        }
      }

      for (const name of [...entries.keys()]) {
        if (!listed.has(name)) {
          const resources = entryResources.get(name) ?? [];

          for (const resource of resources) {
            persistentResources.delete(resource);
          }

          staleResources.push(...resources);
          entries.delete(name);
          entryResources.delete(name);
          changed.push(name);
        }
      }

      if (changed.length > 0 || added.length > 0) {
        for (const listener of listeners) {
          listener(changed, added);
        }

        for (const resource of staleResources) {
          resource.dispose();
        }

        console.log(`models synced — changed: [${changed.join(', ')}] added: [${added.join(', ')}]`);
      }
    } catch {
      // side server down — retry on the next tick
    } finally {
      syncing = false;
    }
  };

  void sync();
  setInterval(() => void sync(), intervalMs);
}
