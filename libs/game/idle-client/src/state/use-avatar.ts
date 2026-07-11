import { useShallow } from 'zustand/react/shallow';
import { useAvatarStore } from './use-avatar-store';

export function useAvatar() {
  const avatar = useAvatarStore(useShallow((state) => state.avatar));

  return avatar;
}
