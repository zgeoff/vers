import { expect, test } from 'bun:test';
import { findOriginRefusal } from './find-origin-refusal';

test.each([
  { allowRemote: false, target: { host: '127.0.0.1:3000', isLoopback: true, protocol: 'http:' } },
  {
    allowRemote: true,
    target: { host: 'preview.example.dev', isLoopback: false, protocol: 'https:' },
  },
])('it admits $target.protocol//$target.host with allowRemote $allowRemote', (row) => {
  expect(findOriginRefusal(row.target, row.allowRemote)).toBeNull();
});

test('it refuses a remote origin without --yes', () => {
  expect(
    findOriginRefusal(
      { host: 'preview.example.dev', isLoopback: false, protocol: 'https:' },
      false,
    ),
  ).toBe('preview.example.dev is not a loopback host; pass --yes to seed through it');
});

test('it refuses a remote origin over plain http even with --yes', () => {
  expect(
    findOriginRefusal({ host: 'preview.example.dev', isLoopback: false, protocol: 'http:' }, true),
  ).toBe('preview.example.dev is not a loopback host, so the QA token goes to it only over https');
});
