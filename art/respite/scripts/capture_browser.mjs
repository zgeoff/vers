import { mkdir, writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

const endpoint = process.env.QA_CDP_ENDPOINT ?? '172.28.80.1:9223';
const args = process.argv.slice(2);
const [targetID, filename] = args;
const captureWidth = Number(process.env.RESPITE_CAPTURE_WIDTH ?? 1600);
const captureHeight = Number(process.env.RESPITE_CAPTURE_HEIGHT ?? 1000);
if (!targetID || !filename) {
  throw new Error('Usage: node capture_browser.mjs <target-id> <filename> [expression]');
}
const response = await fetch(`http://${endpoint}/json/list`);
const listing = await response.json();
const target = listing.find((item) => item.id === targetID);
if (!target) {
  throw new Error('Browser target missing');
}
const address = new URL(target.webSocketDebuggerUrl);
address.host = endpoint;
const ws = new WebSocket(address);
const pending = new Map();
let nextID = 1;
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const entry = pending.get(message.id);
  if (!entry) {
    return;
  }
  pending.delete(message.id);
  clearTimeout(entry.timer);
  if (message.error) {
    entry.reject(new Error(JSON.stringify(message.error)));
  } else {
    entry.resolve(message.result);
  }
});
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextID++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, 30_000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

try {
  await send('Page.bringToFront');
  await send('Emulation.setDeviceMetricsOverride', {
    width: captureWidth,
    height: captureHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });
  let actionResult;
  if (args[2]) {
    const result = await send('Runtime.evaluate', {
      expression: args[2],
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    actionResult = result.result.value;
  }
  const settle = await send('Runtime.evaluate', {
    expression:
      'new Promise(resolve=>{let n=0;const tick=()=>{if(++n>=12)resolve(true);else requestAnimationFrame(tick)};requestAnimationFrame(tick)})',
    awaitPromise: true,
    returnByValue: true,
  });
  if (settle.exceptionDetails) {
    throw new Error(JSON.stringify(settle.exceptionDetails));
  }
  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const directory = resolvePath(import.meta.dirname, '../renders');
  await mkdir(directory, { recursive: true });
  await writeFile(resolvePath(directory, filename), Buffer.from(screenshot.data, 'base64'));
  const report = await send('Runtime.evaluate', {
    expression: 'window.respite.diagnostics()',
    returnByValue: true,
  });
  await writeFile(
    resolvePath(directory, filename.replace(/\.png$/, '.json')),
    `${JSON.stringify({ ...report.result.value, actionResult }, null, 2)}\n`,
  );
  console.log(filename);
} finally {
  try {
    await send('Emulation.clearDeviceMetricsOverride');
  } finally {
    ws.close();
  }
}
