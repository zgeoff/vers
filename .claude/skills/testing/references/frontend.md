# Frontend testing

React code renders under React Testing Library (RTL) on happy-dom, and the test drives it the way a
user does: it finds elements by what a user perceives, interacts through `userEvent`, and asserts on
what the user sees or on the store the interaction changes. Server data arrives through the MSW
handlers in [HTTP mocking](./http.md), never through stubbed hooks. The [testing skill](../SKILL.md)
rules on setup, data, and assertions apply throughout.

## Preloads

`@zgeoff/bun-test-react` registers happy-dom with Bun's own fetch stack kept, loads the jest-dom
matchers, and after each test unmounts every rendered tree and then resets every zustand store. List
its preloads in this order in `bunfig.toml`, because the zustand wrapper must load before any store
is created:

```toml
[test]
preload = ["@zgeoff/bun-test-extended", "@zgeoff/bun-test-react/zustand", "@zgeoff/bun-test-react"]
```

A repo without zustand leaves out the `zustand` preload.

## Rendering

- Mount through the project's `render` and `renderHook` utils, which wrap every provider the app
  needs. Hold the results as `rendered` and `hook`, and query through `rendered`, never through the
  global `screen`.
- A test that needs its own provider tree may call RTL's `render` directly, and it still queries
  through the returned `rendered`.
- A file never declares its own `render<Component>` wrapper.

## Queries

Query by what a user perceives, in this order: `getByRole` with a `name`, then `getByLabelText`,
then `getByText`. `getByTestId` comes last, for an element a user cannot perceive by role, label, or
text.

- `getBy*` asserts that an element is present now, `queryBy*` asserts that it is absent, and
  `findBy*` waits for it to appear.
- After a render that suspends or fetches, the first query is `await rendered.findBy*(…)`. The later
  synchronous queries then read the settled tree.
- `findBy*` replaces `waitFor(() => getBy*(…))`, which polls twice over. Keep `waitFor` for a
  condition that is not a DOM query, such as store state or a mock's call count.
- To assert that an element stays absent, first wait for the element that proves the tree settled,
  then assert `queryBy*` returns `null`. A `findBy*` expected to reject waits out its whole timeout,
  which makes it a sleep.

## Interactions

Create `const user = userEvent.setup()` once per test, and drive every interaction through it:
`user.type`, `user.click`, `user.keyboard`. `userEvent` produces the full event sequence a browser
sends, so a component that handles only part of it fails the test. `fireEvent` is legal only for an
event `userEvent` cannot produce, such as a raw `input` event on a one-time-code field, and a
comment names that event.

```tsx
test('it saves a note from the editor', async () => {
  const user = userEvent.setup();
  const rendered = render(<NoteEditor />);

  await user.type(await rendered.findByLabelText('Title'), 'groceries');
  await user.click(rendered.getByRole('button', { name: 'Save' }));

  expect(await rendered.findByRole('status')).toHaveTextContent('Saved');
});
```

## Store state

- A test of code that consumes a store, such as a component, a hook, or a transport, sets state
  through the store's exported setters, such as `setSelectedNote(…)`, or through the real
  interaction that calls them. Those tests start only from states the app can reach.
- A store module's own tests, of its setters and selectors, may set the starting state with the
  store's raw `setState`. The starting state is that unit's input.
- The preload resets every store, so no test restores one.

## Hooks with changing input

Drive a hook whose input changes between renders through a closure over a local variable. Change the
variable, then call `hook.rerender()` with no arguments.

```tsx
let noteID = 'note_1';
const hook = renderHook(() => useNote(noteID));

noteID = 'note_2';
hook.rerender();
```

## Routing

A component that reads or changes the route mounts through the project's router-aware render util,
which creates a memory-history router and returns it beside the render result.

- Assert a navigation on `router.state.location.pathname`.
- Declare each destination the test expects in the util's routes, as a marker route. Otherwise the
  catch-all route renders the component under test again, and the assertion passes on the wrong
  screen.
- Never stub `navigate`, and never capture the router through a probe component or a module-level
  variable.

## Server functions in TanStack Start

- A server function is a thin shell: it reads the request context, such as headers or cookies, loads
  data, and passes that data to a handler or component that takes it as explicit arguments or props.
  A unit that needs ambient request context in a test reads it in the wrong place: move the read up
  into the shell.
- The body that `createServerFn` wraps is a named export, and its tests call it directly.
- A function that returns React elements is a component. Test it by rendering it.
- An uncompiled `createServerFn` call relays only a `Response` or a thrown redirect or error to its
  caller, and a plain result object arrives as `undefined`. Cover the branches that return plain
  objects at the handler, and cover only the relayed branches through a component.
- `bun test` cannot run the React Server Components pipeline or the ambient reads, because it loads
  one module graph without the `react-server` export condition. A smoke suite against the real
  runtime covers them.
- Tests stub ambient request context through one shared util that the preload installs, which is a
  module mock of the kind the [testing skill](../SKILL.md#module-mocks) allows. Every path that
  relies on the stub also runs in the smoke suite.
- Assert a thrown redirect on the rejection itself:
  `expect(promise).rejects.toMatchObject({ options: { href: '/login' } })`. The branch without a
  redirect asserts the resolved value.
