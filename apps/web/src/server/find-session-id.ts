import { H3Event, getChunkedCookie, unsealSession } from 'h3';
import type { SessionConfig } from 'h3';

export type SessionUnsealConfig = Readonly<Pick<SessionConfig, 'maxAge' | 'name' | 'password'>>;

export async function findSessionID(
  request: Request,
  config: SessionUnsealConfig,
): Promise<string | null> {
  const event = new H3Event(request);

  const sealed = getChunkedCookie(event, config.name ?? 'h3');

  if (sealed === undefined) {
    return null;
  }

  try {
    const session = await unsealSession(event, config, sealed);

    const sessionID: unknown = session.data?.['sessionID'];

    return typeof sessionID === 'string' && sessionID !== '' ? sessionID : null;
  } catch {
    return null;
  }
}
