import { expect, test } from 'bun:test';
import { makeAnswerQueue } from './make-answer-queue';

test('it gives the answers in the order they were listed', () => {
  const next = makeAnswerQueue(['running', 'finished']);

  expect([next(), next()]).toStrictEqual(['running', 'finished']);
});

test('it throws on a call past the last answer', () => {
  const next = makeAnswerQueue(['finished']);

  next();

  expect(() => next()).toThrowWithMessage(Error, 'the answer queue ran out after 1 answer(s)');
});

test('it gives an undefined answer as an answer, not as the end of the queue', () => {
  const next = makeAnswerQueue<string | undefined>([undefined]);

  expect(next()).toBeUndefined();
});
