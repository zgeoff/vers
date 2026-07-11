import { expect, test } from 'bun:test';
import { createGameLoop } from './create-game-loop';

test('it runs a registered callback with the driven delta and elapsed time', () => {
  const gameLoop = createGameLoop();
  const calls: Array<readonly [number, number]> = [];

  gameLoop.registerGameLoopCallback((delta, elapsed) => {
    calls.push([delta, elapsed]);
  });

  gameLoop.runGameLoopCallbacks(0.016, 1.2);

  expect(calls).toStrictEqual([[0.016, 1.2]]);
});

test('it runs callbacks in registration order', () => {
  const gameLoop = createGameLoop();
  const order: Array<number> = [];

  gameLoop.registerGameLoopCallback(() => {
    order.push(1);
  });

  gameLoop.registerGameLoopCallback(() => {
    order.push(2);
  });

  gameLoop.registerGameLoopCallback(() => {
    order.push(3);
  });

  gameLoop.runGameLoopCallbacks(0, 0);

  expect(order).toStrictEqual([1, 2, 3]);
});

test('it stops running a callback once it unregisters', () => {
  const gameLoop = createGameLoop();
  const calls: Array<number> = [];

  const unregister = gameLoop.registerGameLoopCallback(() => {
    calls.push(1);
  });

  unregister();
  gameLoop.runGameLoopCallbacks(0, 0);

  expect(calls).toStrictEqual([]);
});

test('it leaves the other callbacks running after one unregisters', () => {
  const gameLoop = createGameLoop();
  const order: Array<number> = [];

  const unregisterFirst = gameLoop.registerGameLoopCallback(() => {
    order.push(1);
  });

  gameLoop.registerGameLoopCallback(() => {
    order.push(2);
  });

  unregisterFirst();
  gameLoop.runGameLoopCallbacks(0, 0);

  expect(order).toStrictEqual([2]);
});

test('it tolerates unregistering the same callback twice', () => {
  const gameLoop = createGameLoop();
  const unregister = gameLoop.registerGameLoopCallback(() => {});

  unregister();

  expect(unregister).not.toThrow();
});

test('it keeps callback instances from separate game loops independent', () => {
  const first = createGameLoop();
  const second = createGameLoop();
  const calls: Array<string> = [];

  first.registerGameLoopCallback(() => {
    calls.push('first');
  });

  second.registerGameLoopCallback(() => {
    calls.push('second');
  });

  first.runGameLoopCallbacks(0, 0);

  expect(calls).toStrictEqual(['first']);
});
