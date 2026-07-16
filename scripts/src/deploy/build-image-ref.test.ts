import { expect, test } from 'bun:test';
import { buildImageRef } from './build-image-ref';

test('it derives the fly registry ref from app and sha', () => {
  const image = buildImageRef('vers-app-web', 'abc123');

  expect(image).toStrictEqual({
    label: 'deployment-abc123',
    ref: 'registry.fly.io/vers-app-web:deployment-abc123',
  });
});

test('it keeps the label and the ref tag identical', () => {
  const image = buildImageRef('vers-service-user', 'f00d');

  expect(image.ref).toEndWith(`:${image.label}`);
});
