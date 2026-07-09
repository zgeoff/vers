import { useNavigationStore } from './use-navigation-store';

export function toggleNavigationVisible() {
  useNavigationStore.setState((state) => ({ visible: !state.visible }));
}
