import { createHash } from 'node:crypto';
import type { BrowserContext } from '@playwright/test';
import { test as base } from '@playwright/test';

export interface E2EOptions {
  readonly codeSource: 'mock' | 'stack';
  readonly mockVerificationURL: string | undefined;
  readonly resendStubURL: string | undefined;
}

export interface MockActivityOptions {
  readonly mockActivityURL: string | undefined;
}

interface E2EFixtures {
  readonly freshContext: BrowserContext;
}

export const test = base.extend<E2EOptions & MockActivityOptions & E2EFixtures>({
  codeSource: ['mock', { option: true }],

  // the app's rate limiter keys most requests by client address, so each test sends its own, as a
  // player does, and never spends the budget of the tests running beside it
  context: async ({ context }, provide, testInfo) => {
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': buildClientAddress(testInfo.testId) });

    await provide(context);
  },

  // a second browser context stands for another device: it shares no storage, so no shared worker
  freshContext: async ({ browser }, provide, testInfo) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'x-forwarded-for': buildClientAddress(`${testInfo.testId}-fresh`) },
    });

    await provide(context);

    await context.close();
  },

  mockActivityURL: [undefined, { option: true }],
  mockVerificationURL: [undefined, { option: true }],
  resendStubURL: [undefined, { option: true }],
});

export { expect } from '@playwright/test';

function buildClientAddress(seed: string): string {
  const digest = createHash('sha256').update(seed).digest();

  return `10.${digest.readUInt8(0)}.${digest.readUInt8(1)}.${digest.readUInt8(2)}`;
}
