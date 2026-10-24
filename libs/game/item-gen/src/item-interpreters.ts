import { rollItemInDrawOrder1 } from './roll-item-in-draw-order-1';
import type { ItemInterpreters } from './types';

export const ITEM_INTERPRETERS: ItemInterpreters = {
  '1': rollItemInDrawOrder1,
  '2': rollItemInDrawOrder1,
};
