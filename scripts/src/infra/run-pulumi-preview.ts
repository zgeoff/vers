import { $ } from 'bun';
import { z } from 'zod';
import { buildPulumiBackendURL } from './build-pulumi-backend-url';

interface PulumiPreviewOptions {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}

const backendEnvSchema = z.object({
  R2_STATE_BUCKET: z.string().min(1),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
});

export async function runPulumiPreview(options: Readonly<PulumiPreviewOptions>): Promise<number> {
  const backend = backendEnvSchema.parse(options.env);

  const backendURL = buildPulumiBackendURL({
    bucket: backend.R2_STATE_BUCKET,
    cloudflareAccountID: backend.CLOUDFLARE_ACCOUNT_ID,
  });

  const result =
    await $`pulumi preview --stack prod --refresh --diff --expect-no-changes --non-interactive --color never`
      .cwd(options.cwd)
      .env({ ...options.env, PULUMI_BACKEND_URL: backendURL })
      .nothrow();

  return result.exitCode;
}
