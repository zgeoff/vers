import type { SimVersionAction, SimVersionActionInput } from './types';

/**
 * Decides what a replay deploy still needs to provision for an engine hash:
 * a fresh hash gets a new per-version provider app, its flycast IP, a
 * machine launched from the fleet's just-deployed tag, and a registry row;
 * an existing app whose registry row already points at the fleet's resolved
 * digest needs nothing. A missing provider app always gets recreated and its
 * row refreshed, even when the row already matches — the app, not the row,
 * is the thing that's out of date. Launching always targets the fleet's tag,
 * never its digest — `flyctl machine run` mangles a `@sha256:` ref. No
 * actions come back when the fleet has no single resolved image to
 * provision from.
 */
export function planSimVersionActions(
  input: Readonly<SimVersionActionInput>,
): ReadonlyArray<SimVersionAction> {
  if (input.fleetImage === null) {
    return [];
  }

  const providerApp = buildProviderAppName(input.engineHash);
  const imageRef = `${input.fleetImage.repository}@${input.fleetImage.digest}`;
  const rowIsCurrent = input.registryRow?.imageRef === imageRef;

  if (rowIsCurrent && input.providerAppExists) {
    return [];
  }

  const actions: Array<SimVersionAction> = [];

  if (!input.providerAppExists) {
    actions.push(
      { app: providerApp, kind: 'create-provider-app' },
      { app: providerApp, kind: 'allocate-flycast-ip' },
      {
        app: providerApp,
        image: `${input.fleetImage.repository}:${input.fleetImage.tag}`,
        kind: 'run-provider-machine',
      },
    );
  }

  actions.push({
    input: {
      bunVersion: input.bunVersion,
      engineHash: input.engineHash,
      imageRef,
      providerURL: `http://${providerApp}.flycast`,
    },
    kind: 'upsert-registry-row',
  });

  return actions;
}

/**
 * The per-version provider app's name — deterministic from the engine hash,
 * so a fresh deploy and a later reconcile always agree on which app to
 * check for.
 */
export function buildProviderAppName(engineHash: string): string {
  return `vers-replay-${engineHash.slice(0, 12)}`;
}
