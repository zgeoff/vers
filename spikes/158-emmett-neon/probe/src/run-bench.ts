/**
 * Bench driver: hits a running probe (local or fly) over HTTP so all timings
 * are measured server-side, next to the database. With Neon API credentials it
 * also forces a suspend to measure scale-to-zero cold start.
 *
 * Env: PROBE_URL (default http://localhost:3002), and for the cold-start
 * phase: NEON_API_KEY, NEON_PROJECT_ID, NEON_ENDPOINT_ID.
 */
export {};

const probeURL = process.env.PROBE_URL ?? 'http://localhost:3002';

const health = await readJSON('/health');
console.log(`probe: ${probeURL} (region: ${health.region})`);

console.log('\n== bench scenario (20 batches x 10 checkpoints, 20 point reads) ==');
const report = await readJSON('/bench/run', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ batches: 20, checkpointsPerBatch: 10, pointReads: 20 }),
});
console.log(JSON.stringify(report, null, 2));

const { NEON_API_KEY, NEON_PROJECT_ID, NEON_ENDPOINT_ID } = process.env;
if (NEON_API_KEY && NEON_PROJECT_ID && NEON_ENDPOINT_ID) {
  console.log('\n== cold start (forcing Neon endpoint suspend) ==');
  const suspended = await fetch(
    `https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/endpoints/${NEON_ENDPOINT_ID}/suspend`,
    { method: 'POST', headers: { Authorization: `Bearer ${NEON_API_KEY}` } },
  );
  console.log(`suspend: ${suspended.status}`);
  await Bun.sleep(3000);

  console.log(`ping-fresh (cold): ${JSON.stringify(await readJSON('/ping-fresh'))}`);
  console.log(`ping-fresh (warm): ${JSON.stringify(await readJSON('/ping-fresh'))}`);
  console.log(`ping-pooled (after suspend): ${JSON.stringify(await readJSON('/ping-pooled'))}`);
  console.log(`ping-pooled (retry):         ${JSON.stringify(await readJSON('/ping-pooled'))}`);
} else {
  console.log('\n(cold-start phase skipped: NEON_API_KEY / NEON_PROJECT_ID / NEON_ENDPOINT_ID not set)');
}

async function readJSON(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`${probeURL}${path}`, init);
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${await response.text()}`);
  return response.json();
}
