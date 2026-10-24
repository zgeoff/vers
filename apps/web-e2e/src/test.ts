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

  // a second browser context stands for another device: it shares no storage, so no shared worker
  freshContext: async ({ browser }, provide) => {
    const context = await browser.newContext();

    await provide(context);

    await context.close();
  },

  mockActivityURL: [undefined, { option: true }],
  mockVerificationURL: [undefined, { option: true }],
  resendStubURL: [undefined, { option: true }],
});

export { expect } from '@playwright/test';
