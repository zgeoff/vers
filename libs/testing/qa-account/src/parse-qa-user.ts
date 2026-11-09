import { AvatarNameSchema } from '@vers/contract-avatar';
import { USERNAME_MAX_LENGTH, UsernameSchema } from '@vers/contract-user';
import type { QAUserParse } from './types';

export const QA_DOMAIN = 'qa.versidle.com';
const NAME_PATTERN = /^[a-z0-9][a-z0-9._+-]{0,63}$/u;

export function parseQAUser(raw: string): QAUserParse {
  const normalized = raw.trim().toLowerCase();
  const at = normalized.indexOf('@');
  const name = at === -1 ? normalized : normalized.slice(0, at);
  const domain = at === -1 ? QA_DOMAIN : normalized.slice(at + 1);

  if (domain !== QA_DOMAIN) {
    return { kind: 'refused', reason: 'outside-qa-domain' };
  }

  if (!NAME_PATTERN.test(name)) {
    return { kind: 'refused', reason: 'invalid-name' };
  }

  const avatarName = AvatarNameSchema.safeParse(buildAvatarName(name));

  if (!avatarName.success) {
    return { kind: 'refused', reason: 'invalid-avatar-name' };
  }

  const username = UsernameSchema.safeParse(buildUsername(name));

  if (!username.success) {
    return { kind: 'refused', reason: 'invalid-username' };
  }

  return {
    kind: 'parsed',
    user: {
      avatarName: avatarName.data,
      email: `${name}@${QA_DOMAIN}`,
      name,
      username: username.data,
    },
  };
}

const AVATAR_NAME_MAX_LENGTH = 16;
const DIGIT_LETTERS = 'abcdefghij';

// the avatar name contract admits letters only, so each digit maps to a letter and every other
// character drops
function buildAvatarName(name: string): string {
  return name
    .replaceAll(/[0-9]/gu, (digit) => DIGIT_LETTERS.charAt(Number(digit)))
    .replaceAll(/[^a-z]/gu, '')
    .slice(0, AVATAR_NAME_MAX_LENGTH);
}

function buildUsername(name: string): string {
  return name.replaceAll(/[^a-z0-9_]/gu, '_').slice(0, USERNAME_MAX_LENGTH);
}
