import { Command, InvalidArgumentError } from 'commander';
import { z } from 'zod';
import { buildKeyEvents } from '../qa/build-key-events';
import { buildTargetSocketURL } from '../qa/build-target-socket-url';
import { createCDPClient } from '../qa/create-cdp-client';
import { formatConsoleEvent } from '../qa/format-console-event';
import { formatProfileSummary } from '../qa/format-profile-summary';
import { formatTargetTable } from '../qa/format-target-table';
import { PAGE_HELPERS_SOURCE } from '../qa/page-helpers-source';
import { parseEndpoint } from '../qa/parse-endpoint';
import { readDevToolsTargets } from '../qa/read-devtools-targets';
import type { CDPClient } from '../qa/types';
import { withBrowserClient } from '../qa/with-browser-client';
import { withTargetClient } from '../qa/with-target-client';

const DEFAULT_ENDPOINT = process.env['QA_CDP_ENDPOINT'] ?? '127.0.0.1:9222';
const LOAD_TIMEOUT_MS = 30_000;
const SETTLE_AFTER_LOAD_MS = 500;
const KEYSTROKE_GAP_MS = 30;
const PAUSE_TIMEOUT_MS = 12_000;
const DEFAULT_CONSOLE_SECONDS = 10;
const DEFAULT_PROFILE_SECONDS = 4;
const DEFAULT_MONITOR_SECONDS = 10;
const OFFLINE_CONDITIONS = { downloadThroughput: -1, latency: 0, uploadThroughput: -1 };

const program = new Command()
  .name('qa-cdp')
  .description('drive one page or worker target of a debug Chrome over the DevTools Protocol')
  .option('--endpoint <host:port>', 'DevTools endpoint', parseEndpoint, DEFAULT_ENDPOINT);

function getEndpoint(): string {
  return program.opts<{ endpoint: string }>().endpoint;
}

program
  .command('targets')
  .description('list the targets the browser exposes')
  .action(async () => {
    const targets = await readDevToolsTargets(getEndpoint());

    console.log(formatTargetTable(targets));
  });

const createdTargetSchema = z.object({ targetId: z.string() });
const createdContextSchema = z.object({ browserContextId: z.string() });

interface NewCommandOptions {
  readonly context?: string;
}

program
  .command('new')
  .description('open a tab in a fresh browser context, or in the context given')
  .argument('[url]', 'url to open', 'about:blank')
  .option('--context <id>', 'open the tab in this browser context instead of a fresh one')
  .action(async (url: string, options: NewCommandOptions) => {
    await withBrowserClient(getEndpoint(), async (browser) => {
      const browserContextId = await resolveBrowserContext(browser, options.context);

      const rawCreated = await browser.send('Target.createTarget', {
        browserContextId,
        newWindow: options.context === undefined,
        url,
      });

      const created = createdTargetSchema.parse(rawCreated);

      console.log(JSON.stringify({ browserContextId, targetId: created.targetId }));
    });
  });

const targetInfoSchema = z.object({
  browserContextId: z.string().optional(),
  targetId: z.string(),
});

const targetInfosSchema = z.object({ targetInfos: z.array(targetInfoSchema) });

program
  .command('ctx')
  .description("print a target's browser context id")
  .argument('<target>', 'target id')
  .action(async (targetID: string) => {
    await withBrowserClient(getEndpoint(), async (browser) => {
      const raw = await browser.send('Target.getTargets');

      const infos = targetInfosSchema.parse(raw).targetInfos;

      console.log(infos.find((info) => info.targetId === targetID)?.browserContextId ?? '');
    });
  });

program
  .command('close')
  .description('close a target')
  .argument('<target>', 'target id')
  .action(async (targetID: string) => {
    await withBrowserClient(getEndpoint(), async (browser) => {
      await browser.send('Target.closeTarget', { targetId: targetID });

      console.log(`closed ${targetID}`);
    });
  });

const browserProcessSchema = z.object({ cpuTime: z.number(), id: z.number(), type: z.string() });
const processInfoSchema = z.object({ processInfo: z.array(browserProcessSchema) });

program
  .command('procs')
  .description('list the browser processes with their cpu time')
  .action(async () => {
    await withBrowserClient(getEndpoint(), async (browser) => {
      const raw = await browser.send('SystemInfo.getProcessInfo');

      for (const info of processInfoSchema.parse(raw).processInfo) {
        console.log(`${info.type}\tpid=${info.id}\tcpu=${info.cpuTime.toFixed(1)}s`);
      }
    });
  });

const heapUsageSchema = z.object({ totalSize: z.number(), usedSize: z.number() });

interface MonitorCommandOptions {
  readonly every: number;
  readonly url?: string;
}

program
  .command('monitor')
  .description('poll the heap of every matching target and the cpu time of the renderer processes')
  .option('--every <seconds>', 'seconds between polls', parseSeconds, DEFAULT_MONITOR_SECONDS)
  .option('--url <substring>', 'poll only targets whose url contains this')
  .action(async (options: MonitorCommandOptions) => {
    const endpoint = getEndpoint();

    for (;;) {
      try {
        const targets = await readDevToolsTargets(endpoint);

        const matching = targets.filter(
          (target) => options.url === undefined || target.url.includes(options.url),
        );

        const heaps = await Promise.all(
          matching.map((target) => readHeapLine(endpoint, target.type, target.id)),
        );

        const processes = await withBrowserClient(endpoint, async (browser) => {
          const raw = await browser.send('SystemInfo.getProcessInfo');

          return processInfoSchema
            .parse(raw)
            .processInfo.filter((info) => info.type === 'renderer' || info.type === 'GPU')
            .map((info) => `${info.type}${info.id}=${info.cpuTime.toFixed(0)}s`);
        });

        console.log(`${new Date().toISOString()} ${heaps.join(' | ')} || ${processes.join(' ')}`);
      } catch (error) {
        console.log(`${new Date().toISOString()} error ${toMessage(error)}`);
      }

      await Bun.sleep(options.every * 1000);
    }
  });

const locationSchema = z.object({ result: z.object({ value: z.string() }) });

program
  .command('nav')
  .description('navigate a page and wait for its load event')
  .argument('<target>', 'page target id')
  .argument('<url>', 'url to open')
  .action(async (targetID: string, url: string) => {
    await withTargetClient(getEndpoint(), targetID, async (page) => {
      await page.send('Page.enable');

      const loaded = page.waitFor('Page.loadEventFired', LOAD_TIMEOUT_MS);

      await page.send('Page.navigate', { url });

      await loaded;

      await Bun.sleep(SETTLE_AFTER_LOAD_MS);

      const raw = await page.send('Runtime.evaluate', {
        expression: 'location.href',
        returnByValue: true,
      });

      console.log(locationSchema.parse(raw).result.value);
    });
  });

program
  .command('reload')
  .description('reload a page and wait for its load event')
  .argument('<target>', 'page target id')
  .action(async (targetID: string) => {
    await withTargetClient(getEndpoint(), targetID, async (page) => {
      await page.send('Page.enable');

      const loaded = page.waitFor('Page.loadEventFired', LOAD_TIMEOUT_MS);

      await page.send('Page.reload');

      await loaded;

      await Bun.sleep(SETTLE_AFTER_LOAD_MS);

      console.log('reloaded');
    });
  });

const evaluationSchema = z.object({
  exceptionDetails: z.unknown().optional(),
  result: z.object({ description: z.string().optional(), value: z.unknown().optional() }),
});

program
  .command('eval')
  .description('evaluate script in a page or worker, await it, and print the result as JSON')
  .argument('<target>', 'target id')
  .argument('<script>', 'script to evaluate; a page also has the window.__qa helpers')
  .action(async (targetID: string, script: string) => {
    await withTargetClient(getEndpoint(), targetID, async (target) => {
      await target.send('Runtime.evaluate', { expression: PAGE_HELPERS_SOURCE });

      const raw = await target.send('Runtime.evaluate', {
        awaitPromise: true,
        expression: script,
        returnByValue: true,
      });

      const evaluated = evaluationSchema.parse(raw);

      const printed =
        evaluated.exceptionDetails ?? evaluated.result.value ?? evaluated.result.description;

      console.log(JSON.stringify(printed, null, 1));
    });
  });

program
  .command('text')
  .description("print a page's visible text")
  .argument('<target>', 'page target id')
  .action(async (targetID: string) => {
    await withTargetClient(getEndpoint(), targetID, async (page) => {
      const raw = await page.send('Runtime.evaluate', {
        expression: 'document.body.innerText',
        returnByValue: true,
      });

      console.log(evaluationSchema.parse(raw).result.value);
    });
  });

const screenshotSchema = z.object({ data: z.string() });

program
  .command('shot')
  .description('write a png screenshot of a page')
  .argument('<target>', 'page target id')
  .argument('<file>', 'png path to write')
  .action(async (targetID: string, file: string) => {
    await withTargetClient(getEndpoint(), targetID, async (page) => {
      const raw = await page.send('Page.captureScreenshot', { format: 'png' });

      await Bun.write(file, Buffer.from(screenshotSchema.parse(raw).data, 'base64'));

      console.log(`wrote ${file}`);
    });
  });

program
  .command('type')
  .description('focus an element and type text one keystroke at a time')
  .argument('<target>', 'page target id')
  .argument('<selector>', 'css selector of the element to focus')
  .argument('<text>', 'text to type')
  .action(async (targetID: string, selector: string, text: string) => {
    await withTargetClient(getEndpoint(), targetID, async (page) => {
      await runFocusScript(page, selector);

      for (const character of text) {
        await page.send('Input.dispatchKeyEvent', {
          key: character,
          text: character,
          type: 'keyDown',
        });

        await page.send('Input.dispatchKeyEvent', { key: character, type: 'keyUp' });
        await Bun.sleep(KEYSTROKE_GAP_MS);
      }

      console.log('typed');
    });
  });

program
  .command('insert')
  .description('focus an element and insert text as one input event')
  .argument('<target>', 'page target id')
  .argument('<selector>', 'css selector of the element to focus')
  .argument('<text>', 'text to insert')
  .action(async (targetID: string, selector: string, text: string) => {
    await withTargetClient(getEndpoint(), targetID, async (page) => {
      await runFocusScript(page, selector);

      await page.send('Input.insertText', { text });

      console.log('inserted');
    });
  });

program
  .command('key')
  .description('press one key, such as Enter, Tab, or Escape')
  .argument('<target>', 'page target id')
  .argument('<key>', 'key name')
  .action(async (targetID: string, key: string) => {
    await withTargetClient(getEndpoint(), targetID, async (page) => {
      for (const event of buildKeyEvents(key)) {
        await page.send('Input.dispatchKeyEvent', { ...event });
      }

      console.log(`key ${key}`);
    });
  });

program
  .command('click')
  .description('click at viewport coordinates')
  .argument('<target>', 'page target id')
  .argument('<x>', 'x in css pixels', parseCoordinate)
  .argument('<y>', 'y in css pixels', parseCoordinate)
  .action(async (targetID: string, x: number, y: number) => {
    await withTargetClient(getEndpoint(), targetID, async (page) => {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });

      await page.send('Input.dispatchMouseEvent', {
        button: 'left',
        clickCount: 1,
        type: 'mousePressed',
        x,
        y,
      });

      await page.send('Input.dispatchMouseEvent', {
        button: 'left',
        clickCount: 1,
        type: 'mouseReleased',
        x,
        y,
      });

      console.log(`clicked ${x} ${y}`);
    });
  });

interface ConsoleCommandOptions {
  readonly reload: boolean;
  readonly seconds: number;
}

program
  .command('console')
  .description('collect console output, exceptions, and browser log entries for a while')
  .argument('<target>', 'target id')
  .option('--seconds <n>', 'seconds to collect', parseSeconds, DEFAULT_CONSOLE_SECONDS)
  .option('--reload', 'reload the page once collection starts', false)
  .action(async (targetID: string, options: ConsoleCommandOptions) => {
    await withTargetClient(getEndpoint(), targetID, async (target) => {
      const lines: Array<string> = [];

      target.subscribe((event) => {
        const line = formatConsoleEvent(event);

        if (line !== null) {
          lines.push(`${new Date().toISOString()} ${line}`);
        }
      });

      await target.send('Runtime.enable');
      await target.send('Log.enable');

      if (options.reload) {
        await target.send('Page.reload');
      }

      await Bun.sleep(options.seconds * 1000);

      const output = lines.length === 0 ? '(no console output)' : lines.join('\n');

      console.log(output);
    });
  });

program
  .command('offline')
  .description('switch network emulation of a page or worker offline or online')
  .argument('<target>', 'target id')
  .argument('<state>', 'on or off', parseSwitch)
  .action(async (targetID: string, offline: boolean) => {
    await withTargetClient(getEndpoint(), targetID, async (target) => {
      await target.send('Network.enable');
      await target.send('Network.emulateNetworkConditions', { ...OFFLINE_CONDITIONS, offline });

      console.log(`offline ${offline ? 'on' : 'off'}`);
    });
  });

const callFrameLocationSchema = z.object({
  columnNumber: z.number().optional(),
  lineNumber: z.number(),
});

const pausedFrameSchema = z.object({
  functionName: z.string(),
  location: callFrameLocationSchema,
  url: z.string(),
});

const pausedSchema = z.object({ callFrames: z.array(pausedFrameSchema), reason: z.string() });

program
  .command('pause')
  .description("interrupt a target's script, print its stack, and resume it")
  .argument('<target>', 'target id')
  .action(async (targetID: string) => {
    await withTargetClient(getEndpoint(), targetID, async (target) => {
      const paused = target.waitFor('Debugger.paused', PAUSE_TIMEOUT_MS);

      await target.send('Debugger.enable');

      void target.send('Debugger.pause');

      const rawPaused = await paused;

      const stack = pausedSchema.parse(rawPaused);

      console.log(`reason ${stack.reason}`);

      for (const frame of stack.callFrames) {
        const file = frame.url.split('/').pop() ?? '';

        console.log(
          `${frame.functionName || '(anon)'}\t${file}:${frame.location.lineNumber}:${frame.location.columnNumber ?? 0}`,
        );
      }

      await target.send('Debugger.resume');
    });
  });

const profileCallFrameSchema = z.object({
  columnNumber: z.number(),
  functionName: z.string(),
  lineNumber: z.number(),
  url: z.string(),
});

const profileNodeSchema = z.object({ callFrame: profileCallFrameSchema, id: z.number() });
const sampleListSchema = z.array(z.number()).default([]);

const profileBodySchema = z.object({
  nodes: z.array(profileNodeSchema),
  samples: sampleListSchema,
  timeDeltas: sampleListSchema,
});

const profileSchema = z.object({ profile: profileBodySchema });

interface ProfileCommandOptions {
  readonly seconds: number;
}

program
  .command('profile')
  .description('sample the cpu of a target and print the functions with the most self time')
  .argument('<target>', 'target id')
  .option('--seconds <n>', 'seconds to sample', parseSeconds, DEFAULT_PROFILE_SECONDS)
  .action(async (targetID: string, options: ProfileCommandOptions) => {
    await withTargetClient(getEndpoint(), targetID, async (target) => {
      await target.send('Profiler.enable');
      await target.send('Profiler.start');
      await Bun.sleep(options.seconds * 1000);

      const raw = await target.send('Profiler.stop');

      console.log(formatProfileSummary(profileSchema.parse(raw).profile, options.seconds));
    });
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(`qa-cdp: ${toMessage(error)}`);
  process.exit(1);
}

async function resolveBrowserContext(
  browser: CDPClient,
  given: string | undefined,
): Promise<string> {
  if (given !== undefined) {
    return given;
  }

  const raw = await browser.send('Target.createBrowserContext');

  return createdContextSchema.parse(raw).browserContextId;
}

async function readHeapLine(endpoint: string, type: string, targetID: string): Promise<string> {
  const client = await createCDPClient(
    buildTargetSocketURL({ id: targetID, title: '', type, url: '' }, endpoint),
  );

  try {
    const raw = await client.send('Runtime.getHeapUsage');

    const heap = heapUsageSchema.parse(raw);

    return `${type}:${targetID.slice(0, 6)} heap=${formatMegabytes(heap.usedSize)}/${formatMegabytes(heap.totalSize)}MB`;
  } finally {
    client.close();
  }
}

async function runFocusScript(page: CDPClient, selector: string): Promise<void> {
  const raw = await page.send('Runtime.evaluate', {
    expression: `(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (element === null) return false; element.focus(); return true; })()`,
    returnByValue: true,
  });

  if (evaluationSchema.parse(raw).result.value !== true) {
    throw new Error(`no element matches ${selector}`);
  }
}

function formatMegabytes(bytes: number): string {
  return (bytes / 1_048_576).toFixed(1);
}

function parseSeconds(value: string): number {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new InvalidArgumentError('expected a non-negative number of seconds');
  }

  return seconds;
}

function parseCoordinate(value: string): number {
  const coordinate = Number(value);

  if (!Number.isFinite(coordinate)) {
    throw new InvalidArgumentError('expected a number');
  }

  return coordinate;
}

function parseSwitch(value: string): boolean {
  if (value !== 'on' && value !== 'off') {
    throw new InvalidArgumentError('expected on or off');
  }

  return value === 'on';
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
