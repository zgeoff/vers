import { createServiceToken } from '../create-service-token';
import { getTestServiceKeyPair } from '../get-test-service-key-pair';

interface CreateAnonymousViewerConfig {
  readonly audience: string;
}

export async function createAnonymousViewer(
  config: Readonly<CreateAnonymousViewerConfig>,
): Promise<{ token: string }> {
  const keyPair = await getTestServiceKeyPair();

  return {
    token: await createServiceToken({ audience: config.audience, privateKey: keyPair.privateKey }),
  };
}
