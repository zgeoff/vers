import * as axiom from '@pulumi/axiom';
import * as pulumi from '@pulumi/pulumi';

const axiomProvider = new axiom.Provider('axiom', {
  apiToken: requireEnv('AXIOM_TOKEN'),
});

const tracesDataset = new axiom.Dataset(
  'vers-traces',
  {
    name: 'vers-traces',
    description: 'OTel traces from vers services and app-web',

    // the generic events kind the dataset was created with; kind is immutable, so changing it
    // forces a replacement that drops the stored traces. Only OTLP metrics ingest needs a
    // specific kind.
    kind: 'axiom:events:v1',
    useRetentionPeriod: false,
    retentionDays: 0,
  },
  { provider: axiomProvider, protect: true },
);

const logsDataset = new axiom.Dataset(
  'vers-logs',
  {
    name: 'vers-logs',
    description: 'pino logs from vers services and app-web (OTLP)',
    kind: 'axiom:events:v1',
    useRetentionPeriod: false,
    retentionDays: 0,
  },
  { provider: axiomProvider, protect: true },
);

const metricsDataset = new axiom.Dataset(
  'vers-metrics',
  {
    name: 'vers-metrics',
    description: 'OTel metrics from vers services (OTLP)',

    // an events dataset rejects OTLP metrics ingest, so this kind is functionally required
    kind: 'otel:metrics:v1',
    useRetentionPeriod: false,
    retentionDays: 0,
  },
  { provider: axiomProvider, protect: true },
);

// any change to a token's arguments regenerates its secret; the old value stays valid for the
// rotation grace period (48h by default), and the vault item plus the Fly secrets carrying the
// value must be updated inside that window
const ingestToken = new axiom.Token(
  'vers-production',
  {
    name: 'vers-production',
    datasetCapabilities: {
      '*': { ingests: ['create'] },
    },
  },
  { provider: axiomProvider, protect: true },
);

const mcpToken = new axiom.Token(
  'vers-mcp',
  {
    name: 'vers-mcp',
    datasetCapabilities: {
      '*': { queries: ['read'] },
    },
  },
  { provider: axiomProvider, protect: true },
);

const alarmsNotifier = new axiom.Notifier(
  'vers-alarms',
  {
    name: 'vers alarms (Discord)',
    properties: {
      discordWebhook: {
        discordWebhookUrl: pulumi.secret(requireEnv('DISCORD_ALARMS_WEBHOOK')),
      },
    },
  },
  { provider: axiomProvider },
);

const serverErrorsMonitor = new axiom.Monitor(
  'vers-5xx-responses',
  {
    name: 'vers 5xx responses',
    type: 'Threshold',
    description: 'Fires when any vers service or app-web returns 5xx responses.',
    aplQuery:
      "['vers-traces'] | where kind == 'server' and ['attributes.http.response.status_code'] >= 500 | summarize count() by bin(_time, 5m)",
    intervalMinutes: 5,
    rangeMinutes: 10,
    operator: 'AboveOrEqual',
    threshold: 1,
    triggerFromNRuns: 1,
    notifierIds: [alarmsNotifier.id],
  },
  { provider: axiomProvider },
);

const slowRequestsMonitor = new axiom.Monitor(
  'vers-slow-requests',
  {
    name: 'vers slow requests',
    type: 'Threshold',
    description:
      'Fires when a vers service or app-web server span other than a health probe exceeds a 30s duration ceiling — the explicit alarm for a hung or pathologically slow request.',

    // health-probe latency tracks scale-to-zero machine wake, not request handling, so probe
    // routes are excluded or the alarm fires continuously
    aplQuery:
      "['vers-traces'] | where kind == 'server' and duration > 30s and not (name endswith '/health') | summarize count() by bin(_time, 5m)",
    intervalMinutes: 5,
    rangeMinutes: 10,
    operator: 'AboveOrEqual',
    threshold: 1,
    triggerFromNRuns: 1,
    notifierIds: [alarmsNotifier.id],
  },
  { provider: axiomProvider },
);

const replayPokeFailedMonitor = new axiom.Monitor(
  'vers-replay-poke-failed',
  {
    name: 'vers replay poke failed',
    type: 'Threshold',
    description:
      'A wake poke to service-replay exhausted its retries without delivering. The optimistic client hides verifier failure, so this counter is the explicit signal that the replay queue may go undrained despite an activity appending unverified work.',

    // The metric is an OTLP cumulative counter (the exporter sets no delta temporality), so `map
    // increase` reduces each window's aligned maximum to the number of new failures inside it —
    // the threshold fires when that climbs by at least one.
    mplQuery:
      '`vers-metrics`:`vers.activity.replay_poke_failed` | align to 5m using max | group using max | map increase',
    intervalMinutes: 5,
    rangeMinutes: 15,
    operator: 'AboveOrEqual',
    threshold: 1,
    triggerFromNRuns: 1,
    notifierIds: [alarmsNotifier.id],
  },
  { provider: axiomProvider },
);

// the provider normalizes state against the configured key set, so fields it manages or defaults
// (uid, owner, empty overrides, server timestamps) stay out; adding one shows a permanent
// phantom diff
const baselineDashboardDocument = {
  name: 'vers services — baseline',
  description:
    'Request rate, error rate, p95 latency per service, and error log stream. Baseline from #309.',
  charts: [
    {
      id: 'request-rate',
      name: 'Request rate by service',
      query: {
        apl: "['vers-traces'] | where kind == 'server' | summarize count() by ['service.name'], bin_auto(_time)",
      },
      type: 'TimeSeries',
    },
    {
      id: 'error-rate',
      name: '5xx responses by service',
      query: {
        apl: "['vers-traces'] | where kind == 'server' and ['attributes.http.response.status_code'] >= 500 | summarize count() by ['service.name'], bin_auto(_time)",
      },
      type: 'TimeSeries',
    },
    {
      id: 'p95-latency',
      name: 'p95 latency by service',
      query: {
        apl: "['vers-traces'] | where kind == 'server' | summarize percentile(duration, 95) by ['service.name'], bin_auto(_time)",
      },
      type: 'TimeSeries',
    },
    {
      id: 'error-logs',
      name: 'Error logs',
      query: {
        apl: "['vers-logs'] | where severity_number >= 17 | project _time, ['service.name'], body",
      },
      type: 'LogStream',
    },
  ],
  layout: [
    { h: 8, i: 'request-rate', w: 6, x: 0, y: 0 },
    { h: 8, i: 'error-rate', w: 6, x: 6, y: 0 },
    { h: 8, i: 'p95-latency', w: 6, x: 0, y: 8 },
    { h: 8, i: 'error-logs', w: 6, x: 6, y: 8 },
  ],
  refreshTime: 60,
  schemaVersion: 2,
  timeWindowStart: 'qr-now-24h',
  timeWindowEnd: 'qr-now',
};

const baselineDashboard = new axiom.Dashboard(
  'vers-services-baseline',
  {
    uid: 'bc4755c1-41e7-44d5-9b94-1aa30ec423eb',
    dashboard: toSortedJSON(baselineDashboardDocument),
  },
  { provider: axiomProvider },
);

export const tracesDatasetName = tracesDataset.name;
export const logsDatasetName = logsDataset.name;
export const metricsDatasetName = metricsDataset.name;
export const ingestTokenName = ingestToken.name;
export const mcpTokenName = mcpToken.name;
export const alarmsNotifierName = alarmsNotifier.name;
export const serverErrorsMonitorName = serverErrorsMonitor.name;
export const slowRequestsMonitorName = slowRequestsMonitor.name;
export const replayPokeFailedMonitorName = replayPokeFailedMonitor.name;
export const baselineDashboardUID = baselineDashboard.uid;

// the provider stores the document re-marshalled by Go, which sorts object keys and HTML-escapes
// <, >, and & inside strings; serializing the same way keeps refresh previews empty
function toSortedJSON(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
    .replaceAll('<', String.raw`\u003c`)
    .replaceAll('>', String.raw`\u003e`)
    .replaceAll('&', String.raw`\u0026`);
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeysDeep(entry));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([a], [b]) => {
          if (a < b) {
            return -1;
          }

          return a > b ? 1 : 0;
        })
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    );
  }

  return value;
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`missing required environment variable ${name}`);
  }

  return value;
}
