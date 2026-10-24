import { Launcher } from 'chrome-launcher';
import type { Options } from 'chrome-launcher';
import invariant from 'tiny-invariant';

const SIGINT_EXIT_CODE = 130;

export async function withChrome<T>(
  options: Options,
  run: (port: number) => Promise<T>,
): Promise<T> {
  const chrome = new Launcher(options);

  // Chrome runs in its own process group, so a ctrl-c that ends Bun leaves it running unless this
  // listener kills it first
  const handleInterrupt = () => {
    chrome.kill();
    process.exit(SIGINT_EXIT_CODE);
  };

  process.once('SIGINT', handleInterrupt);

  // chrome-launcher's launch() rejects without a handle when Chrome never opens its debug port, and
  // the Chrome it spawned then keeps the deploy CLI alive until the job timeout
  try {
    await chrome.launch();

    invariant(chrome.port !== undefined, 'a launched Chrome has a debug port');

    return await run(chrome.port);
  } finally {
    process.removeListener('SIGINT', handleInterrupt);
    chrome.kill();
  }
}
