/**
 * Load/save against the side server. Placements and knob values live as JSON files on disk in
 * data/ — the plan editor and tuner write them back through POST, so tuning sessions persist
 * without a copy-paste loop.
 */
import type { PlacementsFile } from './types';

export const SERVE_BASE = 'http://localhost:4601';

export async function loadPlacements(): Promise<PlacementsFile> {
  const response = await fetch(`${SERVE_BASE}/data/placements.json`, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`placements load failed: ${response.status}`);
  }

  return (await response.json()) as PlacementsFile;
}

export async function savePlacements(placements: PlacementsFile): Promise<void> {
  await fetch(`${SERVE_BASE}/data/placements.json`, {
    body: JSON.stringify(placements),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}

export async function loadKnobValues(): Promise<Record<string, Record<string, number>>> {
  const response = await fetch(`${SERVE_BASE}/data/knobs.json`, { cache: 'no-store' });

  if (!response.ok) {
    return {};
  }

  return (await response.json()) as Record<string, Record<string, number>>;
}

export async function saveKnobValues(values: Record<string, Record<string, number>>): Promise<void> {
  await fetch(`${SERVE_BASE}/data/knobs.json`, {
    body: JSON.stringify(values),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}
