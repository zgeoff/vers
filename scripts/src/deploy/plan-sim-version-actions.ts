import invariant from 'tiny-invariant';
import { buildProviderAppName } from './build-provider-app-name';
import type { SimVersionAction, SimVersionActionInput } from './types';

/**
 * Decides what a replay deploy still needs to provision for an engine hash. The fleet — not the
 * registry row or the running machine — is the source of truth:
 *
 * - a fresh hash gets a new per-version provider app, its flycast IP, a machine launched from the
 *   fleet's just-deployed tag, and a registry row
 * - a missing provider app is always recreated; an app that lost its machine gets a fresh one
 * - a machine running any other digest, or sitting in any other region, is replaced
 * - every non-current state refreshes the registry row
 * - an existing app whose machine already runs the fleet's resolved digest, with a registry row
 *   pointing at that image and carrying the build's bundled content version, needs nothing
 *
 * Launching and replacing always target the fleet's tag, never its digest — `flyctl machine run`
 * mangles a `@sha256:` ref. No actions come back when the fleet has no single resolved image to
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

  const rowIsCurrent =
    input.registryRow?.imageRef === imageRef &&
    input.registryRow?.maxContentVersion === input.maxContentVersion;

  const machineIsCurrent =
    input.providerMachineImageDigest === input.fleetImage.digest &&
    input.providerMachineRegion === input.region;

  if (rowIsCurrent && input.providerAppExists && input.providerMachineExists && machineIsCurrent) {
    return [];
  }

  const actions: Array<SimVersionAction> = [];
  const tagRef = `${input.fleetImage.repository}:${input.fleetImage.tag}`;

  if (!input.providerAppExists) {
    actions.push(
      { app: providerApp, kind: 'create-provider-app' },
      { app: providerApp, kind: 'allocate-flycast-ip' },
    );
  }

  if (!input.providerAppExists || !input.providerMachineExists) {
    actions.push({
      app: providerApp,
      image: tagRef,
      kind: 'run-provider-machine',
      region: input.region,
    });
  } else if (!machineIsCurrent) {
    invariant(input.providerMachineID !== null, 'a provider machine that exists carries an id');

    actions.push({
      app: providerApp,
      image: tagRef,
      kind: 'replace-provider-machine',
      machineID: input.providerMachineID,
      region: input.region,
    });
  }

  actions.push({
    input: {
      bunVersion: input.bunVersion,
      engineHash: input.engineHash,
      imageRef,
      maxContentVersion: input.maxContentVersion,
      providerURL: `http://${providerApp}.flycast`,
    },
    kind: 'upsert-registry-row',
  });

  return actions;
}
