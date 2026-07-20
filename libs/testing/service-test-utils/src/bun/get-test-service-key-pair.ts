import type { CryptoKey } from 'jose';
import { createServiceKeyPair } from './create-service-key-pair';

interface TestServiceKeyPair {
  readonly jwksJSON: string;
  readonly privateKey: CryptoKey;
}

/**
 * One s2s keypair per test process: a package's preload publishes the JWKS as env, and viewer
 * composites mint tokens from the private key.
 */
export function getTestServiceKeyPair(): Promise<TestServiceKeyPair> {
  cached ??= createServiceKeyPair();

  return cached;
}

let cached: Promise<TestServiceKeyPair> | undefined;
