import { useIdleStore } from './use-idle-store';

export function setWriterDisplacedActivityID(writerDisplacedActivityID: null | string) {
  useIdleStore.setState(() => ({ writerDisplacedActivityID }));
}
