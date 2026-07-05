import { Class } from '@vers/data';
import { builder } from '../builder';

export const AvatarClass = builder.enumType('AvatarClass', {
  values: Object.fromEntries(Object.entries(Class).map(([key, value]) => [key, { value }])),
});
