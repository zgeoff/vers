import type { Client } from '@openfeature/server-sdk';
import { OpenFeature } from '@openfeature/server-sdk';
import { envFlagProvider } from './env-flag-provider';

let isProviderRegistered = false;

/**
 * Registers the env-backed provider on the OpenFeature singleton exactly once per process, then
 * returns the client every caller evaluates flags through.
 */
export function getFlagClient(): Client {
  if (!isProviderRegistered) {
    OpenFeature.setProvider(envFlagProvider);

    isProviderRegistered = true;
  }

  return OpenFeature.getClient();
}
