import { define } from 'gunshi';
import { z } from 'zod';
import { buildKeyEvents } from '../qa/build-key-events';
import { buildTargetSocketURL } from '../qa/build-target-socket-url';
import { createCDPClient } from '../qa/create-cdp-client';
import { formatConsoleEvent } from '../qa/format-console-event';
import { formatProfileSummary } from '../qa/format-profile-summary';
import { formatTargetTable } from '../qa/format-target-table';
import { PAGE_HELPERS_SOURCE } from '../qa/page-helpers-source';
import { QA_CDP_ARGS } from '../qa/qa-cdp-args';
import { readDevToolsTargets } from '../qa/read-devtools-targets';
import { resolveEndpoint } from '../qa/resolve-endpoint';
import type { CDPClient } from '../qa/types';
import { withBrowserClient } from '../qa/with-browser-client';
import { withTargetClient } from '../qa/with-target-client';
import { runCommandLine } from '../utils/run-command-line';

const LOAD_TIMEOUT_MS = 30_000;
const SETTLE_AFTER_LOAD_MS = 500;
const KEYSTROKE_GAP_MS = 30;
const PAUSE_TIMEOUT_MS = 12_000;
const OFFLINE_CONDITIONS = { downloadThroughput: -1, latency: 0, uploadThroughput: -1 };

const targetsCommand = define({
  name: 'targets',
  description: 'list the targets the browser exposes',
  args: QA_CDP_ARGS.targets,
  run: async (ctx) => {
    const targets = await readDevToolsTargets(readEndpoint(ctx.values.endpoint));

    console.log(formatTargetTable(targets));
  },
});

const createdTargetSchema = z.object({ targetId: z.string() });
const createdContextSchema = z.object({ browserContextId: z.string() });

const newCommand = define({
  name: 'new',
  description: 'open a tab in a fresh browser context, or in the context given',
  args: QA_CDP_ARGS.new,
  run: async (ctx) => {
    const url = ctx.values.url;

    await withBrowserClient(readEndpoint(ctx.values.endpoint), async (browser) => {
      const browserContextId = await resolveBrowserContext(browser, ctx.values.context);

      const rawCreated = await browser.send('Target.createTarget', {
        browserContextId,
        newWindow: ctx.values.context === undefined,
        url,
      });

      const created = createdTargetSchema.parse(rawCreated);

      console.log(JSON.stringify({ browserContextId, targetId: created.targetId }));
    });
  },
});

const targetInfoSchema = z.object({
  browserContextId: z.string().optional(),
  targetId: z.string(),
});

const targetInfosSchema = z.object({ targetInfos: z.array(targetInfoSchema) });

const ctxCommand = define({
  name: 'ctx',
  description: "print a target's browser context id",
  args: QA_CDP_ARGS.ctx,
  run: async (ctx) => {
    const targetID = ctx.values.target;

    await withBrowserClient(readEndpoint(ctx.values.endpoint), async (browser) => {
      const raw = await browser.send('Target.getTargets');

      const infos = targetInfosSchema.parse(raw).targetInfos;

      console.log(infos.find((info) => info.targetId === targetID)?.browserContextId ?? '');
    });
  },
});

const closeCommand = define({
  name: 'close',
  description: 'close a target',
  args: QA_CDP_ARGS.close,
  run: async (ctx) => {
    const targetID = ctx.values.target;

    await withBrowserClient(readEndpoint(ctx.values.endpoint), async (browser) => {
      await browser.send('Target.closeTarget', { targetId: targetID });

      console.log(`closed ${targetID}`);
    });
  },
});

const browserProcessSchema = z.object({ cpuTime: z.number(), id: z.number(), type: z.string() });
const processInfoSchema = z.object({ processInfo: z.array(browserProcessSchema) });

const procsCommand = define({
  name: 'procs',
  description: 'list the browser processes with their cpu time',
  args: QA_CDP_ARGS.procs,
  run: async (ctx) => {
    await withBrowserClient(readEndpoint(ctx.values.endpoint), async (browser) => {
      const raw = await browser.send('SystemInfo.getProcessInfo');

      for (const info of processInfoSchema.parse(raw).processInfo) {
        console.log(`${info.type}\tpid=${info.id}\tcpu=${info.cpuTime.toFixed(1)}s`);
      }
    });
  },
});

const heapUsageSchema = z.object({ totalSize: z.number(), usedSize: z.number() });

const monitorCommand = define({
  name: 'monitor',
  description: 'poll the heap of every matching target and the cpu time of the renderer processes',
  args: QA_CDP_ARGS.monitor,
  run: async (ctx) => {
    const endpoint = readEndpoint(ctx.values.endpoint);

    for (;;) {
      try {
        const targets = await readDevToolsTargets(endpoint);

        const matching = targets.filter(
          (target) => ctx.values.url === undefined || target.url.includes(ctx.values.url),
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

      await Bun.sleep(ctx.values.every * 1000);
    }
  },
});

const locationSchema = z.object({ result: z.object({ value: z.string() }) });

const navCommand = define({
  name: 'nav',
  description: 'navigate a page and wait for its load event',
  args: QA_CDP_ARGS.nav,
  run: async (ctx) => {
    const targetID = ctx.values.target;
    const url = ctx.values.url;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (page) => {
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
  },
});

const reloadCommand = define({
  name: 'reload',
  description: 'reload a page and wait for its load event',
  args: QA_CDP_ARGS.reload,
  run: async (ctx) => {
    const targetID = ctx.values.target;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (page) => {
      await page.send('Page.enable');

      const loaded = page.waitFor('Page.loadEventFired', LOAD_TIMEOUT_MS);

      await page.send('Page.reload');

      await loaded;

      await Bun.sleep(SETTLE_AFTER_LOAD_MS);

      console.log('reloaded');
    });
  },
});

const evaluationSchema = z.object({
  exceptionDetails: z.unknown().optional(),
  result: z.object({ description: z.string().optional(), value: z.unknown().optional() }),
});

const evalCommand = define({
  name: 'eval',
  description: 'evaluate script in a page or worker, await it, and print the result as JSON',
  args: QA_CDP_ARGS.eval,
  run: async (ctx) => {
    const targetID = ctx.values.target;
    const script = ctx.values.script;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (target) => {
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
  },
});

const textCommand = define({
  name: 'text',
  description: "print a page's visible text",
  args: QA_CDP_ARGS.text,
  run: async (ctx) => {
    const targetID = ctx.values.target;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (page) => {
      const raw = await page.send('Runtime.evaluate', {
        expression: 'document.body.innerText',
        returnByValue: true,
      });

      console.log(evaluationSchema.parse(raw).result.value);
    });
  },
});

const screenshotSchema = z.object({ data: z.string() });

const shotCommand = define({
  name: 'shot',
  description: 'write a png screenshot of a page',
  args: QA_CDP_ARGS.shot,
  run: async (ctx) => {
    const targetID = ctx.values.target;
    const file = ctx.values.file;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (page) => {
      const raw = await page.send('Page.captureScreenshot', { format: 'png' });

      await Bun.write(file, Buffer.from(screenshotSchema.parse(raw).data, 'base64'));

      console.log(`wrote ${file}`);
    });
  },
});

const typeCommand = define({
  name: 'type',
  description: 'focus an element and type text one keystroke at a time',
  args: QA_CDP_ARGS.type,
  run: async (ctx) => {
    const targetID = ctx.values.target;
    const selector = ctx.values.selector;
    const text = ctx.values.text;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (page) => {
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
  },
});

const insertCommand = define({
  name: 'insert',
  description: 'focus an element and insert text as one input event',
  args: QA_CDP_ARGS.insert,
  run: async (ctx) => {
    const targetID = ctx.values.target;
    const selector = ctx.values.selector;
    const text = ctx.values.text;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (page) => {
      await runFocusScript(page, selector);

      await page.send('Input.insertText', { text });

      console.log('inserted');
    });
  },
});

const keyCommand = define({
  name: 'key',
  description: 'press one key, such as Enter, Tab, or Escape',
  args: QA_CDP_ARGS.key,
  run: async (ctx) => {
    const targetID = ctx.values.target;
    const key = ctx.values.key;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (page) => {
      for (const event of buildKeyEvents(key)) {
        await page.send('Input.dispatchKeyEvent', { ...event });
      }

      console.log(`key ${key}`);
    });
  },
});

const clickCommand = define({
  name: 'click',
  description: 'click at viewport coordinates',
  args: QA_CDP_ARGS.click,
  run: async (ctx) => {
    const targetID = ctx.values.target;
    const x = ctx.values.x;
    const y = ctx.values.y;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (page) => {
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
  },
});

const consoleCommand = define({
  name: 'console',
  description: 'collect console output, exceptions, and browser log entries for a while',
  args: QA_CDP_ARGS.console,
  run: async (ctx) => {
    const targetID = ctx.values.target;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (target) => {
      const lines: Array<string> = [];

      target.subscribe((event) => {
        const line = formatConsoleEvent(event);

        if (line !== null) {
          lines.push(`${new Date().toISOString()} ${line}`);
        }
      });

      await target.send('Runtime.enable');
      await target.send('Log.enable');

      if (ctx.values.reload) {
        await target.send('Page.reload');
      }

      await Bun.sleep(ctx.values.seconds * 1000);

      const output = lines.length === 0 ? '(no console output)' : lines.join('\n');

      console.log(output);
    });
  },
});

const offlineCommand = define({
  name: 'offline',
  description: 'switch network emulation of a page or worker offline or online',
  args: QA_CDP_ARGS.offline,
  run: async (ctx) => {
    const targetID = ctx.values.target;
    const offline = ctx.values.state === 'on';

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (target) => {
      await target.send('Network.enable');
      await target.send('Network.emulateNetworkConditions', { ...OFFLINE_CONDITIONS, offline });

      console.log(`offline ${offline ? 'on' : 'off'}`);
    });
  },
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

const pauseCommand = define({
  name: 'pause',
  description: "interrupt a target's script, print its stack, and resume it",
  args: QA_CDP_ARGS.pause,
  run: async (ctx) => {
    const targetID = ctx.values.target;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (target) => {
      const paused = target.waitFor('Debugger.paused', PAUSE_TIMEOUT_MS);

      await target.send('Debugger.enable');

      // the pause answer can arrive after the socket closes on a timed-out wait; the wait reports that
      target.send('Debugger.pause').catch(() => {});

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
  },
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

const profileCommand = define({
  name: 'profile',
  description: 'sample the cpu of a target and print the functions with the most self time',
  args: QA_CDP_ARGS.profile,
  run: async (ctx) => {
    const targetID = ctx.values.target;

    await withTargetClient(readEndpoint(ctx.values.endpoint), targetID, async (target) => {
      await target.send('Profiler.enable');
      await target.send('Profiler.start');
      await Bun.sleep(ctx.values.seconds * 1000);

      const raw = await target.send('Profiler.stop');

      console.log(formatProfileSummary(profileSchema.parse(raw).profile, ctx.values.seconds));
    });
  },
});

const entry = define({
  name: 'qa-cdp',
  description: 'drive one page or worker target of a debug Chrome over the DevTools Protocol',
});

try {
  const ran = await runCommandLine(process.argv.slice(2), entry, {
    output: console,
    subCommands: {
      targets: targetsCommand,
      new: newCommand,
      ctx: ctxCommand,
      close: closeCommand,
      procs: procsCommand,
      monitor: monitorCommand,
      nav: navCommand,
      reload: reloadCommand,
      eval: evalCommand,
      text: textCommand,
      shot: shotCommand,
      type: typeCommand,
      insert: insertCommand,
      key: keyCommand,
      click: clickCommand,
      console: consoleCommand,
      offline: offlineCommand,
      pause: pauseCommand,
      profile: profileCommand,
    },
  });

  if (!ran) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`qa-cdp: ${toMessage(error)}`);
  process.exit(1);
}

function readEndpoint(flag: string | undefined): string {
  return resolveEndpoint(flag, process.env['QA_CDP_ENDPOINT']);
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

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
