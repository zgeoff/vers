import invariant from 'tiny-invariant';
import { buildProviderAppName } from './build-provider-app-name';
import type { SimVersionAction, SimVersionActionInput } from './types';

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

  // launch and replace target the fleet's tag, never its digest: `flyctl machine run` mangles a
  // `@sha256:` ref
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
