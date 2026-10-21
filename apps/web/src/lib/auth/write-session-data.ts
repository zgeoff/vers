import type { IronSession, SessionOptions } from 'iron-session';

export async function writeSessionData<T extends object>(
  session: IronSession<T>,
  data: T,
  config: SessionOptions,
): Promise<void> {
  for (const key of Object.keys(session)) {
    Reflect.deleteProperty(session, key);
  }

  Object.assign(session, data);
  session.updateConfig(config);

  await session.save();
}
