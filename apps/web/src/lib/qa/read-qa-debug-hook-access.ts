import { readCurrentUser } from '../session/read-current-user';
import { isQAAccountEmail } from './is-qa-account-email';

export async function readQADebugHookAccess(): Promise<boolean> {
  try {
    const user = await readCurrentUser();

    return user !== null && isQAAccountEmail(user.email);
  } catch {
    // an optional QA gate must never keep the game from loading, so a user-service fault answers
    // "not a QA account"; the game's own reads of that service raise the fault on their route
    return false;
  }
}
