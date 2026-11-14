import type { Browser, BrowserContext, Page } from '@playwright/test';
import { chromium } from '@playwright/test';
import type { ServiceInstance, ServiceMethod } from '@wringer/core';
import { WringerError } from '@wringer/core';
import type { z } from 'zod';
import { createNetworkCut } from '../../create-network-cut';
import { navigateClientRoute } from '../../navigate-client-route';
import { waitForHoneypotWindow } from '../../wait-for-honeypot-window';
import { gameServiceContract } from './game-service-contract';
import type { GameArgs, GameMethod, GameResult } from './game-service-contract';

interface GameBridgeOptions {
  readonly devtoolsURL: string;
  readonly webURL: string;
  readonly actionTimeoutMs: number;
}

type NetworkCut = Awaited<ReturnType<typeof createNetworkCut>>;

interface BridgeState {
  connected: Promise<Browser> | null;
  second: { readonly context: BrowserContext; readonly page: Page } | null;
  cut: NetworkCut | null;
}

type GameHandlers = {
  readonly [Method in GameMethod]: (args: GameArgs<Method>) => Promise<GameResult<Method>>;
};

// Attaches over DevTools to the browser driver's Chromium, to act on its page, cookies and worker.
// The network cut and the second device live here between commands, because Chrome drops a cut
// when the DevTools session that set it detaches.
export function startGameBridge(options: GameBridgeOptions): Promise<ServiceInstance> {
  const state: BridgeState = { connected: null, second: null, cut: null };

  const readBrowser = (): Promise<Browser> => {
    state.connected ??= connectBrowser(options.devtoolsURL, () => {
      state.connected = null;
    });

    return state.connected;
  };

  const readFirstPage = async (): Promise<Page> => {
    const browser = await readBrowser();

    // the browser driver opens one context and replaces its page after a timeout, so its newest
    // open page is the one each `browser` command drives
    const pages = browser
      .contexts()
      .filter((context) => context !== state.second?.context)
      .flatMap((context) => context.pages())
      .filter((page) => !page.isClosed());

    const page = pages.at(-1);

    if (page === undefined) {
      throw new WringerError('environment', {
        message: 'The browser has no open page.',
        hint: 'Run `bun verify browser goto /`.',
      });
    }

    page.setDefaultTimeout(options.actionTimeoutMs);

    return page;
  };

  const readSecondPage = (): Page => {
    if (state.second === null) {
      throw new WringerError('usage', {
        message: 'The second device has not signed in.',
        hint: 'Run `bun verify action second-device-sign-in` first.',
      });
    }

    return state.second.page;
  };

  const readDevicePage = (device: GameArgs<'readState'>['device']): Promise<Page> | Page =>
    device === 'first' ? readFirstPage() : readSecondPage();

  const handlers: GameHandlers = {
    readState: async (args) => {
      const page = await readDevicePage(args.device);

      const snapshot = await page.evaluate(async () => {
        const answered = await globalThis.__versQA?.snapshot();

        return answered ?? null;
      });

      return { url: page.url(), state: snapshot };
    },
    navigate: async (args) => {
      const page = await readDevicePage(args.device);

      await navigateClientRoute(page, args.path);

      return { url: page.url() };
    },
    setNetwork: async (args) => {
      const browser = await readBrowser();
      const page = await readFirstPage();

      if (args.network === 'offline') {
        state.cut ??= await createNetworkCut(browser, page.context());

        return { network: 'offline', workers: state.cut.workerCount };
      }

      const workers = state.cut?.workerCount ?? 0;

      await state.cut?.end();

      state.cut = null;

      return { network: 'online', workers };
    },
    signInSecond: async (args) => {
      const browser = await readBrowser();

      // each sign-in is a new device: a context that kept the cookie of a session another sign-in
      // ended would land /login on a game page instead of the form
      await state.second?.context.close();

      const context = await browser.newContext({ baseURL: options.webURL });
      const page = await context.newPage();

      page.setDefaultTimeout(options.actionTimeoutMs);

      state.second = { context, page };

      return signInPage(page, args);
    },
    clickSecond: async (args) => {
      const page = readSecondPage();

      await page.getByRole(toAriaRole(args.role), { name: args.name, exact: true }).click();

      return { url: page.url() };
    },
    status: async () => {
      const browser = await readBrowser();

      return { pages: browser.contexts().flatMap((context) => context.pages()).length };
    },
    snapshotSecond: async () => {
      const page = readSecondPage();

      const snapshot = await page.locator('body').ariaSnapshot();

      return { url: page.url(), snapshot };
    },
  };

  return Promise.resolve({
    methods: toGameServiceMethods(handlers),
    stop: async () => {
      await state.cut?.end();
      await state.second?.context.close();

      // a browser attached over DevTools disconnects on close and leaves the browser running
      const browser = await state.connected?.catch(() => null);

      await browser?.close();
    },
  });
}

async function connectBrowser(devtoolsURL: string, onFailure: () => void): Promise<Browser> {
  try {
    return await chromium.connectOverCDP(devtoolsURL);
  } catch (error) {
    onFailure();

    throw new WringerError('environment', {
      message: `The game driver could not attach to the browser: ${String(error)}`,
      hint: 'Run `bun verify up --restart`, then `bun verify doctor`.',
    });
  }
}

const takeoverPath = '/login/force-logout';

async function signInPage(
  page: Page,
  credentials: GameArgs<'signInSecond'>,
): Promise<GameResult<'signInSecond'>> {
  await page.goto('/login');

  // the form's submit handler attaches only once React commits; an earlier click falls back to the
  // browser's native GET submit and never leaves /login
  await page.locator('html[data-hydrated]').waitFor();
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);

  await waitForHoneypotWindow(page);

  await page.getByRole('button', { exact: true, name: 'Login' }).click();
  await page.waitForURL((url) => url.pathname !== '/login');

  // an account that holds a session elsewhere lands on the takeover page, which asks before the
  // sign-in logs the other session out
  const tookOver = new URL(page.url()).pathname === takeoverPath;

  if (tookOver) {
    await page.getByRole('button', { exact: true, name: 'Confirm' }).click();
    await page.waitForURL((url) => url.pathname !== takeoverPath);
  }

  return { url: page.url(), tookOver };
}

type AriaRole = Parameters<Page['getByRole']>[0];

function toAriaRole(role: string): AriaRole {
  if (!isAriaRole(role)) {
    throw new WringerError('usage', {
      message: `The second device clicks a button, link, checkbox, tab or menuitem, not ${role}.`,
    });
  }

  return role;
}

const ariaRoles: ReadonlySet<string> = new Set(['button', 'link', 'checkbox', 'tab', 'menuitem']);

function isAriaRole(role: string): role is AriaRole {
  return ariaRoles.has(role);
}

function toGameServiceMethods(handlers: GameHandlers): Readonly<Record<GameMethod, ServiceMethod>> {
  return {
    readState: bindMethod(gameServiceContract.readState.args, handlers.readState),
    navigate: bindMethod(gameServiceContract.navigate.args, handlers.navigate),
    setNetwork: bindMethod(gameServiceContract.setNetwork.args, handlers.setNetwork),
    signInSecond: bindMethod(gameServiceContract.signInSecond.args, handlers.signInSecond),
    clickSecond: bindMethod(gameServiceContract.clickSecond.args, handlers.clickSecond),
    status: bindMethod(gameServiceContract.status.args, handlers.status),
    snapshotSecond: bindMethod(gameServiceContract.snapshotSecond.args, handlers.snapshotSecond),
  };
}

function bindMethod<Schema extends z.ZodType>(
  schema: Schema,
  handler: (args: z.output<Schema>) => Promise<unknown>,
): ServiceMethod {
  return (args) => Promise.try(() => handler(schema.parse(args)));
}
