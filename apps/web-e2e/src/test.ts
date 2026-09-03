import { test as base } from '@playwright/test';

export interface E2EOptions {
  readonly codeSource: 'mock' | 'stack';
  readonly mockVerificationURL: string | undefined;
  readonly resendStubURL: string | undefined;
}

export const test = base.extend<E2EOptions>({
  codeSource: ['mock', { option: true }],
  mockVerificationURL: [undefined, { option: true }],
  resendStubURL: [undefined, { option: true }],
});

export { expect } from '@playwright/test';
