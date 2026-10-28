import type { QueryClient } from '@tanstack/react-query';
import { readWithLastKnown } from '../offline/read-with-last-known';
import { requireActiveAvatar } from './require-active-avatar';

export function requireActiveAvatarOrLastKnown(queryClient: QueryClient) {
  return readWithLastKnown(queryClient, 'active-avatar', () => requireActiveAvatar());
}
