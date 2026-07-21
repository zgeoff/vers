import { isDefinedError, safe } from '@orpc/client';
import { redirect } from '@tanstack/react-router';
import { requireAuth } from '../../lib/auth/require-auth';
import { avatarClient } from '../../lib/rpc/clients/avatar-client';
import { logger } from '../../server/logger';
import type { AvatarSelectResult } from './types';

/**
 * Persists the picked avatar as active and re-enters the game as them; a live activity's hold on
 * the selection comes back as a named rejection for the roster to render instead of a redirect.
 */
export async function runAvatarSelect(avatarID: string): Promise<AvatarSelectResult> {
  await requireAuth();

  const [error] = await safe(avatarClient.selectAvatar({ id: avatarID }));

  if (error) {
    if (isDefinedError(error) && error.code === 'CONFLICT') {
      return { owningAvatarName: error.data.owningAvatarName, status: 'activity-locked' };
    }

    logger.error({ err: error }, 'avatar selection failed');

    return { status: 'failed' };
  }

  throw redirect({ href: '/explore' });
}
