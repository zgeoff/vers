# Factories and composites

A factory builds one domain value for a test, and a composite assembles one domain concept from
factories and persistence helpers. Both live in the shared test utils with tests of their own. The
[testing skill](../SKILL.md#test-data) holds the rules for inline data and stand-ins, and decides
which types get a factory.

## Factories

- A factory lives in `build-mock-<type>.ts` and exports `buildMock<Type>`. A factory returns a value
  and brings no resource into existence, so it takes the `build` prefix from the repo's
  function-naming table. A composite that writes rows creates a resource and keeps `create`.
- A factory returns a complete plain object. Fields whose value is arbitrary default to
  `@faker-js/faker` values, which prove the unit does not depend on one particular value.
  Constrained fields, such as an enum or a discriminator, take a fixed default. A deterministic
  package, whose outputs are pinned as golden values, takes fixed defaults throughout. Seed faker
  once in the preload of each package that uses it, so a failing run reproduces.
- A factory defaults each foreign key to a fresh id and never requires a parent. Wiring real parents
  is a composite's job.
- A factory for a class returns an instance of that class, so `toStrictEqual` against a real
  instance passes. A factory with nested fields deep-merges each override into fresh defaults.
- A row factory returns the table's insert shape, and a contract factory returns the API type. They
  are separate factories, kept in the packages that own each shape.
- Each factory has a test file with at least two tests: `it builds a default <type>`, which asserts
  the whole shape with `toStrictEqual` and asymmetric matchers, and
  `it applies overrides on top of the defaults`. Add a test only for a factory branch that those two
  cannot reach, such as an override that leaves out an optional field (`undefined` meaning absent),
  a field derived from another field, or a keyed or nested override that builds each child from its
  own factory. Each added test fails when that branch is deleted. Never add one that checks faker's
  output or the plain merge of overrides again.
- The test that uses a factory's value calls the factory itself. A helper that presets overrides is
  a second set of defaults that the reader cannot see.

## Composites

A composite assembles one domain concept from factories and persistence helpers: a signed-in user
with its session, or an order with its customer. It creates each dependency that the caller does not
pass, and it returns data, never clients, apps, or servers.

- A composite's name is a concept the system already names. Two readers who see just the name
  describe the same contents. A name that lists its parts, such as
  `createUserWithTwoNotesAndAShare`, is a convenience grouping: compose the primitives in the test
  instead.
- A variant is a separate file and export, such as `createAdminUser` beside `createUser`. It is
  never a flag inside one composite.
- A composite has no batch form. Several records are several calls.
