import { createServiceKeyPair } from '@vers/service-runtime/test-utils';
import type { CryptoKey } from 'jose';

interface TestServiceKeyPair {
  readonly privateKey: CryptoKey;
  readonly publicKeyPEM: string;
}

/**
 * One s2s keypair per test process: a package's preload publishes the public key as env, and
 * viewer composites mint tokens from the private key. Bridges preload and test setup through
 * shared module state so both sides agree on the same keypair.
 */
export function getTestServiceKeyPair(): Promise<TestServiceKeyPair> {
  cached ??= createServiceKeyPair();

  return cached;
}

let cached: Promise<TestServiceKeyPair> | undefined;
