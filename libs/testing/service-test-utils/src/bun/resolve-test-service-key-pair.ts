import type { CryptoKey } from 'jose';
import { createServiceKeyPair } from './create-service-key-pair';

interface TestServiceKeyPair {
  readonly jwksJSON: string;
  readonly privateKey: CryptoKey;
}

export function resolveTestServiceKeyPair(): Promise<TestServiceKeyPair> {
  cached ??= createServiceKeyPair();

  return cached;
}

let cached: Promise<TestServiceKeyPair> | undefined;
