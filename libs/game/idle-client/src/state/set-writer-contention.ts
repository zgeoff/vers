import { useIdleStore } from './use-idle-store';

export function setWriterContention(writerContention: boolean) {
  useIdleStore.setState(() => ({ writerContention }));
}
