# Factories

Write a `buildMock<Type>` factory for each domain type that crosses a module boundary.
[Test data](../SKILL.md#test-data) in the testing skill sets which types count. Return the value and
do nothing else: write no database row and no file. For stored state, call the seeds of the module
that writes it, as in [Stored state](../SKILL.md#stored-state). Those seeds build their input with
these factories.

Watch for these mistakes:

- Never spread `{ note: undefined }` over the defaults to leave out a field. The key stays, and
  `toStrictEqual` fails against a value with no such key.
- In a package whose tests compare output to a committed golden file, use fixed defaults for every
  field. Faker's values follow the order of its calls, so one new call elsewhere changes the output.
- Never write a helper that presets overrides. The reader can't see its defaults.

## Writing a factory

- Keep the factory in `test-utils/` of the package that defines the type. For a type from a
  third-party package, such as an SDK result, keep it in `test-utils/` of the package that wraps
  that package.
- Name the file `build-mock-<type>.ts`, and export `buildMock<Type>` from it: `OrderLine` gets
  `build-mock-order-line.ts` and `buildMockOrderLine`. Use `build`, because the factory creates no
  resource.
- Take one argument of overrides. Return a complete value, with every optional field filled:

  ```ts
  export function buildMockOrderLine(overrides: Partial<OrderLine> = {}): OrderLine {
    return {
      id: faker.string.uuid(),
      orderID: faker.string.uuid(),
      status: 'open',
      quantity: faker.number.int({ min: 1, max: 9 }),
      note: faker.lorem.sentence(),
      ...overrides,
    };
  }
  ```

- Default a field to a `@faker-js/faker` value when no test depends on its value. The reader then
  sees that the value doesn't matter. When the package has no `@faker-js/faker` dev dependency, add
  it.
- Call `faker.seed()` with a fixed number in the test preload of each package that uses faker, so a
  failing run gives the same values again.
- Default an enum or a discriminator to the value most tests need.
- Default each foreign key to a new `faker.string.uuid()`, and never require a parent. When a test
  needs a real parent, seed the parent and pass its ID.
- When a test needs an optional field absent, remove each key whose override is `undefined` before
  you return the value.
- When the type is a class, return an instance of it, so `toStrictEqual` against a real instance
  passes.
- Build a nested object with its own factory, and pass it the nested override:

  ```ts
  type ShipmentOverrides = Partial<Omit<Shipment, 'address'>> & { address?: Partial<Address> };

  export function buildMockShipment(overrides: ShipmentOverrides = {}): Shipment {
    const { address, ...rest } = overrides;

    return {
      id: faker.string.uuid(),
      carrier: 'post',
      address: buildMockAddress(address),
      ...rest,
    };
  }
  ```

- Write one factory for a table's insert shape and another for the API type, each in the package
  that defines its shape.
- Call the factory in the test that uses its value. A seed may set the state its name gives, such as
  the status in `archivedNote`; no other helper presets overrides.

## A factory's own test

Put the test beside the factory, as `build-mock-<type>.test.ts`, with these 2 tests:

- `it builds a default <type>`, such as `it builds a default order line`. Assert the whole shape
  with `toStrictEqual` and asymmetric matchers.
- `it applies overrides on top of the defaults`.

Add a test for each branch of the factory that those 2 can't reach, and check that it fails when you
delete the branch:

- the removal of a key whose override is `undefined`;
- a field that the factory works out from another field;
- a nested object or a list that the factory builds with another factory.

Never add a test that checks faker's output, or the plain merge of overrides again.
