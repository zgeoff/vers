import type { ProductEventName, ProductEventPropertiesMap } from '@vers/product-analytics';
import { sendProductEvent } from './send-product-event';

export function emitProductEvent<N extends ProductEventName>(
  name: N,
  properties: ProductEventPropertiesMap[N],
): void {
  void sendProductEventBestEffort(name, properties);
}

async function sendProductEventBestEffort<N extends ProductEventName>(
  name: N,
  properties: ProductEventPropertiesMap[N],
): Promise<void> {
  try {
    await sendProductEvent({ data: { name, properties } });
  } catch {
    // analytics loss is acceptable; a failed dispatch never reaches the flow that fired it
  }
}
