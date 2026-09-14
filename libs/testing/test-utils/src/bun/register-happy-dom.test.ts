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

test('it escapes a quote inside an attribute value', () => {
  registerHappyDOM();
  onTestFinished(() => GlobalRegistrator.unregister());

  const div = new Window().document.createElement('div');

  div.setAttribute('title', 'say "hi" <now> & go');

  expect(Bun.inspect(div)).toBe('<div title="say &quot;hi&quot; &lt;now> &amp; go">');
});

test('it keeps the case of an svg element name', () => {
  registerHappyDOM();
  onTestFinished(() => GlobalRegistrator.unregister());

  const gradient = new Window().document.createElementNS(
    'http://www.w3.org/2000/svg',
    'linearGradient',
  );

  expect(Bun.inspect(gradient)).toBe('<linearGradient>');
});

test('it prints a happy-dom text node as its name and text', () => {
  registerHappyDOM();
  onTestFinished(() => GlobalRegistrator.unregister());

  const text = new Window().document.createTextNode('Log out');

  expect(Bun.inspect(text)).toBe('#text "Log out"');
});
