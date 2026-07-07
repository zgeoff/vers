import { useNavigationStore } from './use-navigation-store';

export function setNavigationVisible(visible: boolean) {
  useNavigationStore.setState(() => ({ visible }));
}
