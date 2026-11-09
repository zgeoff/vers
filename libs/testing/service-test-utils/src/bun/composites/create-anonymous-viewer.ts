import type { TokenIssuer, TokenScope } from '@vers/service-auth';
import { createServiceToken } from '../create-service-token';
import { resolveTestServiceKeyPair } from '../resolve-test-service-key-pair';

interface CreateAnonymousViewerConfig {
  readonly audience: string;
  readonly issuer?: TokenIssuer;
  readonly scope?: TokenScope;
}

export async function createAnonymousViewer(
  config: Readonly<CreateAnonymousViewerConfig>,
): Promise<{ token: string }> {
  const keyPair = await resolveTestServiceKeyPair();

  return {
    token: await createServiceToken({
      audience: config.audience,
      privateKey: keyPair.privateKey,
      ...(config.issuer !== undefined && { issuer: config.issuer }),
      ...(config.scope !== undefined && { scope: config.scope }),
    }),
  };
}
