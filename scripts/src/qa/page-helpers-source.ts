export const PAGE_HELPERS_SOURCE = `
if (typeof window !== 'undefined' && window.__qa === undefined) {
  window.__qa = {
    setValue(selector, value) {
      const element = document.querySelector(selector);
      if (element === null) return false;
      const prototype =
        element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    clickText(text, selector) {
      const elements = [...document.querySelectorAll(selector ?? 'button,a,label,[role=button]')]
        .filter((element) => element.textContent.trim() === text);
      if (elements.length === 0) return 'none:' + text;
      elements[0].click();
      return 'clicked';
    },
    submit() {
      document.querySelector('form').requestSubmit();
      return 'submitted';
    },
    async wait(ms) {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return document.body.innerText;
    },
  };
}
`;
