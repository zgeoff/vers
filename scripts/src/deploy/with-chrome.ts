import { Launcher } from 'chrome-launcher';
import type { Options } from 'chrome-launcher';
import invariant from 'tiny-invariant';

export async function withChrome<T>(
  options: Options,
  run: (port: number) => Promise<T>,
): Promise<T> {
  const chrome = new Launcher(options);

  // chrome-launcher's launch() rejects without a handle when Chrome never opens its debug port, and
  // the Chrome it spawned then keeps the deploy CLI alive until the job timeout
  try {
    await chrome.launch();

    invariant(chrome.port !== undefined, 'a launched Chrome has a debug port');

    return await run(chrome.port);
  } finally {
    chrome.kill();
  }
}
