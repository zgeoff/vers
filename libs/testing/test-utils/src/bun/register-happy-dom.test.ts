import { expect, onTestFinished, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { Window } from 'happy-dom';
import { registerHappyDOM } from './register-happy-dom';

test('it prints a happy-dom element as its opening tag', () => {
  registerHappyDOM();
  onTestFinished(() => GlobalRegistrator.unregister());

  const button = new Window().document.createElement('button');

  button.setAttribute('type', 'button');
  button.setAttribute('disabled', '');

  expect(Bun.inspect(button)).toBe('<button type="button" disabled="">');
});

test('it prints a happy-dom text node as its name and text', () => {
  registerHappyDOM();
  onTestFinished(() => GlobalRegistrator.unregister());

  const text = new Window().document.createTextNode('Log out');

  expect(Bun.inspect(text)).toBe('#text "Log out"');
});
