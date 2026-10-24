import lighthouse from 'lighthouse';
import type { LighthouseScores } from './find-lighthouse-finding';
import { withChrome } from './with-chrome';

// no sandbox: the GitHub runner's Chrome runs as root, where the sandbox refuses to start
const CHROME_FLAGS = ['--headless=new', '--no-sandbox'];

export function runLighthouseAudit(url: string): Promise<LighthouseScores> {
  return withChrome({ chromeFlags: CHROME_FLAGS }, async (port) => {
    const result = await lighthouse(url, {
      logLevel: 'error',
      onlyCategories: ['performance'],
      output: 'json',
      port,
    });

    return { performance: result?.lhr.categories['performance']?.score ?? null };
  });
}
