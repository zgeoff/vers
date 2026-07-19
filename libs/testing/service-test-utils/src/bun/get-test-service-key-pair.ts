import type { CryptoKey } from 'jose';
import { createServiceKeyPair } from './create-service-key-pair';

interface TestServiceKeyPair {
  readonly privateKey: CryptoKey;
  readonly publicKeyPEM: string;
}

/**
 * One s2s keypair per test process: a package's preload publishes the public key as env, and
 * viewer composites mint tokens from the private key.
 */
export function getTestServiceKeyPair(): Promise<TestServiceKeyPair> {
  cached ??= createServiceKeyPair();

  return cached;
}

let cached: Promise<TestServiceKeyPair> | undefined;
