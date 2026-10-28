import type { Page } from '@playwright/test';

interface ClientRouter {
  readonly navigate: (options: Readonly<{ href: string }>) => Promise<void>;
}

declare global {
  var __TSR_ROUTER__: ClientRouter | undefined;
}

// TanStack Router publishes the client router on the window, and a navigation through it takes the
// same in-app path a link click takes, with no document load
export async function navigateClientRoute(page: Page, href: string): Promise<void> {
  await page.evaluate(async (target) => {
    const router = globalThis.__TSR_ROUTER__;

    if (router === undefined) {
      throw new Error('the page has no client router');
    }

    await router.navigate({ href: target });
  }, href);
}
