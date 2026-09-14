import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import type { LighthouseScores } from './find-lighthouse-finding';

// no sandbox: the GitHub runner's Chrome runs as root, where the sandbox refuses to start
const CHROME_FLAGS = ['--headless=new', '--no-sandbox'];

export async function runLighthouseAudit(url: string): Promise<LighthouseScores> {
  const chrome = await chromeLauncher.launch({ chromeFlags: CHROME_FLAGS });

  try {
    const result = await lighthouse(url, {
      logLevel: 'error',
      onlyCategories: ['performance'],
      output: 'json',
      port: chrome.port,
    });

    return { performance: result?.lhr.categories['performance']?.score ?? null };
  } finally {
    chrome.kill();
  }
}
