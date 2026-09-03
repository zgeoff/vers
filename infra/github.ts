import * as github from '@pulumi/github';
import * as pulumi from '@pulumi/pulumi';

const repository = 'vers';

// the resource owns the repo's labels wholesale: deleting an entry here detaches the label from
// every issue carrying it, and protect guards whole-set deletion only, not per-entry edits
const labels = new github.IssueLabels(
  'vers',
  {
    repository,
    labels: [
      { name: 'area/auth', color: '1D76DB', description: 'area: authentication & authorization' },
      { name: 'area/game', color: '33AA3F', description: 'area: simulation, aether, game systems' },
      {
        name: 'area/platform',
        color: 'C5DEF5',
        description: 'area: deploy, db hosting, monorepo, CI',
      },
      { name: 'area/services', color: 'B392F0', description: 'area: backend services & contracts' },
      { name: 'area/web', color: '5DADE2', description: 'area: web app shell & UI' },
      { name: 'bug', color: 'd73a4a', description: 'bzzzz' },
      { name: 'build', color: 'C2E0C6' },
      { name: 'chore', color: 'FEF2C0', description: 'maintenance / housekeeping' },
      { name: 'dep-audit', color: 'B60205', description: 'bun audit found advisories' },
      { name: 'dep-outdated', color: 'FBCA04', description: 'weekly outdated-dependency report' },
      { name: 'do-not-merge', color: '000000', description: 'reference PR — never merge' },
      { name: 'documentation', color: 'C2E0C6', description: 'docs' },
      { name: 'duplicate', color: 'cfd3d7', description: 'already exists' },
      { name: 'easy win', color: '7057ff', description: 'small task, high value' },
      { name: 'epic', color: '5319E7', description: 'capturing related work' },
      { name: 'feature', color: '0052CC', description: 'new feature' },
      {
        name: 'game-design',
        color: '8b5cf6',
        description: 'game-design lane: discovery → design note → iteration resources',
      },
      {
        name: 'needs-refinement',
        color: 'E4E669',
        description: 'scope/decision gap — not ready to pick up until refined',
      },
      { name: 'rebuild', color: 'E99695', description: 'greenfield rebuild workstream (#143)' },
      { name: 'refactor', color: 'BFDADC' },
      { name: 'research', color: 'd876e3', description: 'engage llm' },
      { name: 'security', color: 'cf222e', description: 'security-sensitive work' },
      { name: 'spike', color: '8250DF', description: 'time-boxed prototype to de-risk a decision' },
      { name: 'tech-debt', color: 'D4C5F9', description: 'accumulated shortcut to revisit' },
      {
        name: 'upkeep',
        color: '0E8A16',
        description:
          'event- or date-triggered maintenance; body carries a trigger line the weekly sweep evaluates',
      },
      {
        name: 'upkeep-ready',
        color: 'D93F0B',
        description: 'upkeep trigger has fired; cleanup is actionable now',
      },
      { name: 'ux', color: '0E8A16', description: 'polish' },
    ],
  },
  { protect: true },
);

const mainProtectionRuleset = new github.RepositoryRuleset('main-protection', {
  name: 'main protection',
  repository,
  target: 'branch',
  enforcement: 'active',
  conditions: {
    refName: {
      includes: ['~DEFAULT_BRANCH'],
      excludes: [],
    },
  },
  rules: {
    deletion: true,
    nonFastForward: true,
    pullRequest: {
      allowedMergeMethods: ['squash'],
      requiredApprovingReviewCount: 0,
    },
    requiredStatusChecks: {
      requiredChecks: [{ context: 'checks' }],
      strictRequiredStatusChecksPolicy: false,
    },
  },
});

const productionEnvironment = new github.RepositoryEnvironment(
  'production',
  {
    repository,
    environment: 'production',
  },
  { protect: true },
);

const umamiWebsiteIDVariable = new github.ActionsVariable('vite-umami-website-id', {
  repository,
  variableName: 'VITE_UMAMI_WEBSITE_ID',
  value: 'b72918cb-3763-411c-b471-ac694e31d8f4',
});

const serviceAuthJWKSVariable = new github.ActionsEnvironmentVariable('service-auth-jwks', {
  repository,
  environment: productionEnvironment.environment,
  variableName: 'SERVICE_AUTH_JWKS',
  value: new pulumi.Config('vers-infra').requireSecret('serviceAuthJWKS'),
});

const sentryDSNVariable = new github.ActionsEnvironmentVariable('vite-sentry-dsn', {
  repository,
  environment: productionEnvironment.environment,
  variableName: 'VITE_SENTRY_DSN',
  value: 'https://929f735fcaf5436db8d0910fd1c0d71d@vers-bugsink.fly.dev/1',
});

const dotenvAppWebDevSecret = new github.ActionsSecret('dotenv-app-web-dev', {
  repository,
  secretName: 'DOTENV_APP_WEB_DEV',
  value: requireEnv('DOTENV_APP_WEB_DEV'),
});

const dotenvAppWebE2ESecret = new github.ActionsSecret('dotenv-app-web-e2e', {
  repository,
  secretName: 'DOTENV_APP_WEB_E2E',
  value: requireEnv('DOTENV_APP_WEB_E2E'),
});

const databaseURLSecret = new github.ActionsEnvironmentSecret('database-url', {
  repository,
  environment: productionEnvironment.environment,
  secretName: 'DATABASE_URL',
  value: requireEnv('DATABASE_URL'),
});

const discordWebhookURLSecret = new github.ActionsEnvironmentSecret('discord-webhook-url', {
  repository,
  environment: productionEnvironment.environment,
  secretName: 'DISCORD_WEBHOOK_URL',
  value: requireEnv('DISCORD_WEBHOOK_URL'),
});

const flyAPITokenSecret = new github.ActionsEnvironmentSecret('fly-api-token', {
  repository,
  environment: productionEnvironment.environment,
  secretName: 'FLY_API_TOKEN',
  value: requireEnv('FLY_API_TOKEN'),
});

const sentryAuthTokenSecret = new github.ActionsEnvironmentSecret('sentry-auth-token', {
  repository,
  environment: productionEnvironment.environment,
  secretName: 'SENTRY_AUTH_TOKEN',
  value: requireEnv('SENTRY_AUTH_TOKEN'),
});

function requireEnv(name: string): pulumi.Output<string> {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`environment variable ${name} is not set — run through \`op run\``);
  }

  return pulumi.secret(value);
}

export const labelCount = labels.labels.apply((entries) => entries?.length ?? 0);
export const mainProtectionRulesetName = mainProtectionRuleset.name;
export const productionEnvironmentName = productionEnvironment.environment;
export const umamiWebsiteIDVariableName = umamiWebsiteIDVariable.variableName;
export const serviceAuthJWKSVariableName = serviceAuthJWKSVariable.variableName;
export const sentryDSNVariableName = sentryDSNVariable.variableName;
export const dotenvAppWebDevSecretName = dotenvAppWebDevSecret.secretName;
export const dotenvAppWebE2ESecretName = dotenvAppWebE2ESecret.secretName;
export const databaseURLSecretName = databaseURLSecret.secretName;
export const discordWebhookURLSecretName = discordWebhookURLSecret.secretName;
export const flyAPITokenSecretName = flyAPITokenSecret.secretName;
export const sentryAuthTokenSecretName = sentryAuthTokenSecret.secretName;
