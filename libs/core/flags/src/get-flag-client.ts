import type { Client } from '@openfeature/server-sdk';
import { OpenFeature } from '@openfeature/server-sdk';
import { envFlagProvider } from './env-flag-provider';

let isProviderRegistered = false;

export function getFlagClient(): Client {
  if (!isProviderRegistered) {
    OpenFeature.setProvider(envFlagProvider);

    isProviderRegistered = true;
  }

  return OpenFeature.getClient();
}
