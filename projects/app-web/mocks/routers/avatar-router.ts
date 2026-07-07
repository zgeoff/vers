import { implement } from '@orpc/server';
import { avatarContract } from '@vers/contract-avatar';
import type { MockContext } from '../resolve-session-context';

export function buildMockAvatarRouter() {
  const os = implement(avatarContract).$context<MockContext>();

  return {
    createAvatar: os.createAvatar.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    deleteAvatar: os.deleteAvatar.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    getAvatar: os.getAvatar.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    getAvatars: os.getAvatars.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
    updateAvatar: os.updateAvatar.handler(() => {
      throw new Error('not wired in the phase 0b mock backend');
    }),
  };
}
