import { createServiceToken } from '../create-service-token';
import { getTestServiceKeyPair } from '../get-test-service-key-pair';

interface CreateAnonymousViewerConfig {
  readonly audience: string;
}

/** An s2s-authenticated token carrying no acting user, for anonymous-call test cases. */
export async function createAnonymousViewer(
  config: Readonly<CreateAnonymousViewerConfig>,
): Promise<{ token: string }> {
  const keyPair = await getTestServiceKeyPair();

  return {
    token: await createServiceToken({ audience: config.audience, privateKey: keyPair.privateKey }),
  };
}
