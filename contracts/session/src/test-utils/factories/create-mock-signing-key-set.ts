import type { SigningKeySet } from '../../signing-key-set-schema';
import { createMockSigningKey } from './create-mock-signing-key';

export function createMockSigningKeySet(overrides: Partial<SigningKeySet> = {}): SigningKeySet {
  return { keys: [createMockSigningKey()], ...overrides };
}
