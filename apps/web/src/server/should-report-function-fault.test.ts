import { expect, test } from 'bun:test';
import { notFound, redirect } from '@tanstack/react-router';
import { shouldReportFunctionFault } from './should-report-function-fault';

test('it reports a thrown error', () => {
  expect(shouldReportFunctionFault(new Error('Service Unavailable'))).toBe(true);
});

test('it reports a thrown non-error value', () => {
  expect(shouldReportFunctionFault('boom')).toBe(true);
});

test('it skips a thrown redirect', () => {
  expect(shouldReportFunctionFault(redirect({ href: '/login' }))).toBe(false);
});

test('it skips a thrown not-found', () => {
  expect(shouldReportFunctionFault(notFound())).toBe(false);
});

test('it skips a thrown response', () => {
  expect(shouldReportFunctionFault(new Response(null, { status: 400 }))).toBe(false);
});
