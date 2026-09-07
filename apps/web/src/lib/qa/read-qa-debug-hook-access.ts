import { readCurrentUser } from '../session/read-current-user';
import { isQAAccountEmail } from './is-qa-account-email';

export async function readQADebugHookAccess(): Promise<boolean> {
  const user = await readCurrentUser();

  return user !== null && isQAAccountEmail(user.email);
}
