import { expect, test } from 'bun:test';
import { formatConsoleEvent } from './format-console-event';

test('it joins the arguments of a console call after its level', () => {
  const line = formatConsoleEvent({
    method: 'Runtime.consoleAPICalled',
    params: {
      args: [
        { type: 'string', value: 'reconnect in' },
        { type: 'number', value: 3 },
        { type: 'object', value: { attempt: 2 } },
        { description: 'Error: boom', type: 'object' },
        { type: 'number', unserializableValue: 'NaN' },
        { type: 'undefined' },
      ],
      type: 'warning',
    },
  });

  expect(line).toBe('console.warning: reconnect in 3 {"attempt":2} Error: boom NaN [undefined]');
});

test('it prints a thrown error by its description and a thrown primitive by its value', () => {
  expect(
    formatConsoleEvent({
      method: 'Runtime.exceptionThrown',
      params: {
        exceptionDetails: {
          exception: { description: 'TypeError: x is not a function', type: 'object' },
          text: 'Uncaught',
        },
      },
    }),
  ).toBe('exception: TypeError: x is not a function');

  expect(
    formatConsoleEvent({
      method: 'Runtime.exceptionThrown',
      params: {
        exceptionDetails: { exception: { type: 'string', value: 'offline' }, text: 'Uncaught' },
      },
    }),
  ).toBe('exception: offline');
});

test('it prints the text of a thrown exception that carries no object', () => {
  expect(
    formatConsoleEvent({
      method: 'Runtime.exceptionThrown',
      params: { exceptionDetails: { text: 'Uncaught (in promise)' } },
    }),
  ).toBe('exception: Uncaught (in promise)');
});

test('it prints a browser log entry with its level and source url', () => {
  const line = formatConsoleEvent({
    method: 'Log.entryAdded',
    params: {
      entry: { level: 'error', text: 'Refused to load', url: 'https://versidle.com/' },
    },
  });

  expect(line).toBe('log/error: Refused to load https://versidle.com/');
});

test('it returns null for an event that is not console output', () => {
  expect(formatConsoleEvent({ method: 'Page.loadEventFired', params: {} })).toBeNull();
});
