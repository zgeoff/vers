import { buildProviderAppName } from './build-provider-app-name';
import type { SimVersionAction, SimVersionActionInput } from './types';

/**
 * Decides what a replay deploy still needs to provision for an engine hash:
 * a fresh hash gets a new per-version provider app, its flycast IP, a
 * machine launched from the fleet's just-deployed tag, and a registry row;
 * an existing app with a machine whose registry row already points at the
 * fleet's resolved digest needs nothing. A missing provider app is always
 * recreated, an app that lost its machine gets a fresh machine, and every
 * non-current state refreshes the row — the fleet, not the row, is the
 * source of truth. Launching always targets the fleet's tag, never its
 * digest — `flyctl machine run` mangles a `@sha256:` ref. No actions come
 * back when the fleet has no single resolved image to provision from.
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

  if (rowIsCurrent && input.providerAppExists && input.providerMachineExists) {
    return [];
  }

  const actions: Array<SimVersionAction> = [];

  if (!input.providerAppExists) {
    actions.push(
      { app: providerApp, kind: 'create-provider-app' },
      { app: providerApp, kind: 'allocate-flycast-ip' },
    );
  }

  if (!input.providerAppExists || !input.providerMachineExists) {
    actions.push({
      app: providerApp,
      image: `${input.fleetImage.repository}:${input.fleetImage.tag}`,
      kind: 'run-provider-machine',
    });
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
