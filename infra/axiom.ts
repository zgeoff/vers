import * as axiom from '@pulumi/axiom';
import * as pulumi from '@pulumi/pulumi';

/**
 * The provider authenticates with the Axiom admin token; it enters through the
 * environment resolved by `op run`.
 */
const axiomProvider = new axiom.Provider('axiom', {
  apiToken: requireEnv('AXIOM_TOKEN'),
});

/**
 * Retention on every dataset is the org default (no per-dataset override),
 * expressed as useRetentionPeriod: false with a zero day count.
 * kind is immutable — changing it forces a replacement that destroys the
 * stored events — and each dataset is protected, since deleting one destroys
 * its stored telemetry.
 */
const tracesDataset = new axiom.Dataset(
  'vers-traces',
  {
    name: 'vers-traces',
    description: 'OTel traces from vers services and app-web',

    // The dataset holds OTel traces but carries the generic events kind: it was
    // created without a kind, and replacing it now would drop the trace
    // history. Trace-aware querying works regardless — only OTLP metrics
    // ingest demands a specific kind.
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

/**
 * An events dataset rejects OTLP metrics ingest, so the metrics kind is the
 * one kind declaration that is functionally required.
 */
const metricsDataset = new axiom.Dataset(
  'vers-metrics',
  {
    name: 'vers-metrics',
    description: 'OTel metrics from vers services (OTLP)',
    kind: 'otel:metrics:v1',
    useRetentionPeriod: false,
    retentionDays: 0,
  },
  { provider: axiomProvider, protect: true },
);

/**
 * API tokens declare their scopes here; the secret values stay in the vers
 * 1Password vault, entering neither code nor stack outputs. Any change to a
 * token's arguments regenerates its secret (the old value stays valid for the
 * rotation grace period, 48h by default) — a scope edit is a deliberate
 * rotation, and the vault item plus the Fly secrets that carry the value must
 * be updated inside that window.
 */
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

/**
 * Alert destination: the vers alarms Discord channel. The webhook URL grants
 * post access to the channel, so it stays a secret end to end. One notifier per
 * severity carries that severity's firing colour, so the channel is scannable by
 * hue; both post the shared canonical embed to the same channel.
 */
const alarmsWebhookURL = pulumi.secret(requireEnv('DISCORD_ALARMS_WEBHOOK'));
const alarmsWebhookHeaders = { 'Content-Type': 'application/json' };

const criticalAlarmsNotifier = new axiom.Notifier(
  'vers-alarms-critical',
  {
    name: 'vers alarms — critical (Discord)',
    properties: {
      customWebhook: {
        url: alarmsWebhookURL,
        headers: alarmsWebhookHeaders,
        body: buildAlarmsWebhookBody({ label: 'critical', firingColor: 15_026_253 }),
      },
    },
  },
  { provider: axiomProvider },
);

const warningAlarmsNotifier = new axiom.Notifier(
  'vers-alarms-warning',
  {
    name: 'vers alarms — warning (Discord)',
    properties: {
      customWebhook: {
        url: alarmsWebhookURL,
        headers: alarmsWebhookHeaders,
        body: buildAlarmsWebhookBody({ label: 'warning', firingColor: 16_757_284 }),
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
    notifierIds: [criticalAlarmsNotifier.id],
  },
  { provider: axiomProvider },
);

/**
 * alertOnNoData is part of the contract: the lag gauge exports from
 * service-replay's always-warm machine, so a silent dataset means the exporter
 * or its process is down — never a healthy quiet system.
 */
const verificationLagMonitor = new axiom.Monitor(
  'vers-verification-lag',
  {
    name: 'vers verification lag',
    type: 'Threshold',
    description:
      "Verification lag: age of the oldest unverified activity append. The optimistic client hides verifier failure, so this gauge is the signal that verification has stalled. Fires when the worst stream has waited 30+ minutes, and on no data — the gauge exports from service-replay's always-warm machine, so a silent dataset means the exporter or its process is down.",
    aplQuery: '`vers-metrics`:`vers.verification.lag` | align to 5m using max | group using max',
    intervalMinutes: 10,
    rangeMinutes: 15,
    operator: 'AboveOrEqual',
    threshold: 1800,
    triggerFromNRuns: 1,
    alertOnNoData: true,
    notifierIds: [warningAlarmsNotifier.id],
  },
  { provider: axiomProvider },
);

/**
 * The dashboard document is the full source of truth: a console edit to any of
 * these fields is drift, reverted by the next `pulumi up`. The provider
 * normalizes state against the configured key set, so fields it manages or
 * defaults (uid, owner, empty overrides, server timestamps) stay out — adding
 * one would show a permanent phantom diff.
 */
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
export const criticalAlarmsNotifierName = criticalAlarmsNotifier.name;
export const warningAlarmsNotifierName = warningAlarmsNotifier.name;
export const serverErrorsMonitorName = serverErrorsMonitor.name;
export const verificationLagMonitorName = verificationLagMonitor.name;
export const baselineDashboardUID = baselineDashboard.uid;

/**
 * The provider stores the dashboard document re-marshalled by Go, which sorts
 * object keys alphabetically and HTML-escapes <, >, and & inside strings;
 * serializing the same way keeps the committed document byte-identical to
 * state, so refresh previews stay empty.
 */
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

interface AlarmsSeverity {
  readonly label: string;
  readonly firingColor: number;
}

/**
 * Renders the canonical alarms embed as a Discord webhook payload. Axiom fills
 * the Go-template placeholders per alert: .Action is "Open" when the monitor
 * trips and "Closed" when it recovers, selecting the firing or recovery colour
 * and title word. The colour placeholder sits unquoted so it renders as the
 * integer Discord requires. Monitor descriptions interpolate straight into this
 * JSON string, so they must stay free of double quotes and newlines.
 */
function buildAlarmsWebhookBody(severity: AlarmsSeverity): string {
  const recoveryColor = 3_187_820;

  return [
    '{',
    '  "embeds": [',
    '    {',
    `      "title": "[Axiom] {{ if eq .Action "Open" }}${severity.label}{{ else }}recovery{{ end }} — {{ .Title }}",`,
    '      "description": "{{ .Description }}",',
    '      "url": "https://app.axiom.co",',
    `      "color": {{ if eq .Action "Open" }}${severity.firingColor}{{ else }}${recoveryColor}{{ end }},`,
    '      "fields": [',
    '        { "name": "State", "value": "{{ .Action }}", "inline": true },',
    '        { "name": "Value", "value": "{{ .Value }}", "inline": true }',
    '      ]',
    '    }',
    '  ]',
    '}',
  ].join('\n');
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`missing required environment variable ${name}`);
  }

  return value;
}
