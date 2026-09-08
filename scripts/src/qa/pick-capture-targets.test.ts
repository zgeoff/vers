import { expect, test } from 'bun:test';
import { pickCaptureTargets } from './pick-capture-targets';

test('it keeps the shared workers that are not attached yet', () => {
  const picked = pickCaptureTargets(
    [
      { id: 'page', title: 'vers', type: 'page', url: 'https://versidle.com/' },
      { id: 'new', title: '', type: 'shared_worker', url: 'https://versidle.com/worker.js' },
      { id: 'old', title: '', type: 'shared_worker', url: 'https://versidle.com/worker.js' },
      { id: 'sw', title: '', type: 'service_worker', url: 'https://versidle.com/sw.js' },
    ],
    { attached: new Set(['old']) },
  );

  expect(picked.map((target) => target.id)).toStrictEqual(['new']);
});

test('it keeps only the shared workers whose url contains the filter', () => {
  const picked = pickCaptureTargets(
    [
      { id: 'ours', title: '', type: 'shared_worker', url: 'https://versidle.com/worker.js' },
      { id: 'other', title: '', type: 'shared_worker', url: 'https://example.com/worker.js' },
    ],
    { attached: new Set(), workerURL: 'versidle.com' },
  );

  expect(picked.map((target) => target.id)).toStrictEqual(['ours']);
});
