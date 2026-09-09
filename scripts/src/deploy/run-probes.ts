import pRetry from 'p-retry';
import { findLighthouseFinding } from './find-lighthouse-finding';
import { runLighthouseAudit } from './run-lighthouse-audit';
import type { Probe } from './types';

const PROBE_RETRIES = 9;
const PROBE_DELAY_MS = 5000;

// a Lighthouse run costs about a minute, so it gets one retry where a request probe gets nine
const LIGHTHOUSE_RETRIES = 1;

export async function runProbes(probes: ReadonlyArray<Probe>): Promise<ReadonlyArray<string>> {
  const findings: Array<string> = [];

  for (const probe of probes) {
    try {
      await pRetry(() => runProbe(probe), {
        factor: 1,
        minTimeout: PROBE_DELAY_MS,
        retries: probe.kind === 'lighthouse' ? LIGHTHOUSE_RETRIES : PROBE_RETRIES,
      });

      console.log(`✓ probe passed: ${formatProbe(probe)}`);
    } catch (error) {
      findings.push(`probe failed: ${formatProbe(probe)} — ${toMessage(error)}`);
    }
  }

  return findings;
}

async function runProbe(probe: Probe): Promise<void> {
  if (probe.kind === 'http') {
    const response = await fetch(probe.url);

    if (response.status !== probe.expectStatus) {
      throw new Error(`expected status ${probe.expectStatus}, got ${response.status}`);
    }

    return;
  }

  if (probe.kind === 'lighthouse') {
    const scores = await runLighthouseAudit(probe.url);

    const finding = findLighthouseFinding(probe, scores);

    if (finding !== null) {
      throw new Error(finding);
    }

    return;
  }

  const response = await fetch(probe.url, {
    body: JSON.stringify(probe.body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  const body: unknown = await response.json();

  if (!probe.expect(body)) {
    throw new Error(`response did not satisfy expectation: ${JSON.stringify(body)}`);
  }
}

function formatProbe(probe: Probe): string {
  return `${probe.kind} ${probe.url}`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
