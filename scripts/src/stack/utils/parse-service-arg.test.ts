import { expect, test } from 'bun:test';
import { ServiceID } from '../types';
import { parseServiceArg } from './parse-service-arg';

test('it parses a known service name as its service ID', () => {
  expect(parseServiceArg('service-avatar')).toBe(ServiceID.ServiceAvatar);
});

test('it rejects an unknown service name and lists the available ones', () => {
  expect(() => parseServiceArg('service-lighthouse')).toThrowWithMessage(
    Error,
    /^Invalid service "service-lighthouse"\. Available services: postgres, service-activity, /u,
  );
});
