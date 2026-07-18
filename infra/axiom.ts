import * as axiom from '@pulumi/axiom';
import * as pulumi from '@pulumi/pulumi';

// The provider authenticates with the Axiom admin token; like the Cloudflare
// credentials, it enters through the environment resolved by `op run`.
const axiomProvider = new axiom.Provider('axiom', {
  apiToken: requireEnv('AXIOM_TOKEN'),
});

// Alert destination: the vers alarms Discord channel. The webhook URL grants
// post access to the channel, so it stays a secret end to end.
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

// alertOnNoData is part of the contract: the lag gauge exports from
// service-replay's always-warm machine, so a silent dataset means the exporter
// or its process is down — never a healthy quiet system.
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
    notifierIds: [alarmsNotifier.id],
  },
  { provider: axiomProvider },
);

export const alarmsNotifierName = alarmsNotifier.name;
export const serverErrorsMonitorName = serverErrorsMonitor.name;
export const verificationLagMonitorName = verificationLagMonitor.name;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`missing required environment variable ${name}`);
  }

  return value;
}
