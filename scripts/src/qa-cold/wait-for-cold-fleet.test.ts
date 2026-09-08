import { expect, test } from 'bun:test';
import { createStubFlyctl } from '../test-utils/create-stub-flyctl';
import { waitForColdFleet } from './wait-for-cold-fleet';

test('it resolves once every machine of every app reports cold', async () => {
  await createStubFlyctl(
    `echo '[{"id":"m1","name":"m1","state":"suspended"},{"id":"m2","name":"m2","state":"stopped"}]'`,
  );

  await expect(waitForColdFleet(['vers-service-keys', 'vers-service-user'], 1000)).toResolve();
});

test('it rejects with the warm machines when the fleet is still warm at the deadline', async () => {
  await createStubFlyctl(`echo '[{"id":"m1","name":"m1","state":"started"}]'`);

  expect(waitForColdFleet(['vers-service-keys'], 200)).rejects.toThrowWithMessage(
    Error,
    'the fleet did not go cold within 200 ms (vers-service-keys: machine(s) m1 started are not cold yet)',
  );
});

test('it ends a state read that is still pending at the deadline', async () => {
  await createStubFlyctl('exec sleep 30');

  expect(waitForColdFleet(['vers-service-keys'], 200)).rejects.toThrowWithMessage(
    Error,
    'the fleet did not go cold within 200 ms (no state read completed)',
  );
});
