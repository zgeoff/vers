import * as github from '@pulumi/github';
import * as pulumi from '@pulumi/pulumi';

const repository = 'vers';

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
