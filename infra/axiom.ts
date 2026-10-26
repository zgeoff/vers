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
    description: 'LogTape logs from vers services and app-web (OTLP)',
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
      "Fires when a vers service or app-web server span other than a health probe completes after more than 30s. A span exports only once it ends, so a request that never finishes is the overdue-requests monitor's to catch.",

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

const overdueRequestsMonitor = new axiom.Monitor(
  'vers-overdue-requests',
  {
    name: 'vers overdue requests',
    type: 'Threshold',
    description:
      'A vers service or app-web wrote a request-overdue line: a request was still open 30s after it arrived. A span exports only once it ends, so this line is the one signal for a request that never finishes.',
    aplQuery:
      "['vers-logs'] | where body == 'request overdue' | summarize count() by bin(_time, 5m)",
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
      'service-activity wrote its poke-failed line: a wake poke to service-replay exhausted its retries without delivering. The optimistic client hides verifier failure, so this line is the explicit signal that the replay queue may go undrained despite an activity appending unverified work.',

    // A process started by a deploy or by autoscaling starts the poke-failed counter at its first
    // failure, so an `increase` over it has no earlier point to subtract from and can miss a lone
    // failure. The service writes one log line per failed poke.
    aplQuery:
      "['vers-logs'] | where body == 'replay wake poke failed after every retry' | summarize count() by bin(_time, 5m)",
    intervalMinutes: 5,
    rangeMinutes: 10,
    operator: 'AboveOrEqual',
    threshold: 1,
    triggerFromNRuns: 1,
    notifierIds: [alarmsNotifier.id],
  },
  { provider: axiomProvider },
);

const replayParkedMonitor = new axiom.Monitor(
  'vers-replay-parked',
  {
    name: 'vers replay parked',
    type: 'Threshold',
    description:
      "service-replay wrote a park line, grouped by the line, which names the reason: an unrecognized sim version, a retention-expired sim version, or a replay that tripped its duration cap. A parked activity halts its avatar's settlement order until an operator releases it.",

    // The hold counters start at 1 in a fresh process, which scales to zero between drains, so an
    // `increase` over them has no earlier point to subtract from and can miss a lone hold. The
    // service writes one log line per hold, after the hold commits.
    aplQuery:
      "['vers-logs'] | where body contains 'parking activity' | summarize count() by body, bin(_time, 5m)",
    intervalMinutes: 5,
    rangeMinutes: 10,
    operator: 'AboveOrEqual',
    threshold: 1,
    triggerFromNRuns: 1,
    notifyByGroup: true,
    notifierIds: [alarmsNotifier.id],
  },
  { provider: axiomProvider },
);

const replayQuarantinedMonitor = new axiom.Monitor(
  'vers-replay-quarantined',
  {
    name: 'vers replay quarantined',
    type: 'Threshold',
    description:
      "service-replay wrote its quarantine line: an activity's divergence failed to reproduce on every allowed attempt. A quarantined activity halts its avatar's settlement order and blocks new starts in its chain scope until an operator releases it.",
    aplQuery:
      "['vers-logs'] | where body == 'replay attempts exhausted; activity quarantined' | summarize count() by bin(_time, 5m)",
    intervalMinutes: 5,
    rangeMinutes: 10,
    operator: 'AboveOrEqual',
    threshold: 1,
    triggerFromNRuns: 1,
    notifierIds: [alarmsNotifier.id],
  },
  { provider: axiomProvider },
);

const activityRefusalsMonitor = new axiom.Monitor(
  'vers-activity-refusals',
  {
    name: 'vers activity refusals',
    type: 'Threshold',
    description:
      'service-activity wrote at least 5 refusal lines for one code and reason inside one 10-minute bin, grouped by the line, which names both. One transient stale-head conflict stays under the threshold; a device stuck retrying a refused chain crosses it within minutes.',

    // A process started by a deploy or by autoscaling starts the refusal counter at its first
    // refusal, so an `increase` over it undercounts a burst in a new process. The range spans two
    // bin edges, so the last complete 10-minute bin is scored as a whole.
    aplQuery:
      "['vers-logs'] | where body startswith 'activity write refused: ' | summarize count() by body, bin(_time, 10m)",
    intervalMinutes: 5,
    rangeMinutes: 20,
    operator: 'AboveOrEqual',
    threshold: 5,
    triggerFromNRuns: 1,
    notifyByGroup: true,
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
    // oxlint-disable-next-line id-length -- Axiom's dashboard layout names its cell fields h, i and w
    { h: 8, i: 'request-rate', w: 6, x: 0, y: 0 },
    // oxlint-disable-next-line id-length -- Axiom's dashboard layout names its cell fields h, i and w
    { h: 8, i: 'error-rate', w: 6, x: 6, y: 0 },
    // oxlint-disable-next-line id-length -- Axiom's dashboard layout names its cell fields h, i and w
    { h: 8, i: 'p95-latency', w: 6, x: 0, y: 8 },
    // oxlint-disable-next-line id-length -- Axiom's dashboard layout names its cell fields h, i and w
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
export const overdueRequestsMonitorName = overdueRequestsMonitor.name;
export const replayPokeFailedMonitorName = replayPokeFailedMonitor.name;
export const replayParkedMonitorName = replayParkedMonitor.name;
export const replayQuarantinedMonitorName = replayQuarantinedMonitor.name;
export const activityRefusalsMonitorName = activityRefusalsMonitor.name;
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
        .toSorted(([left], [right]) => {
          if (left < right) {
            return -1;
          }

          return left > right ? 1 : 0;
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
