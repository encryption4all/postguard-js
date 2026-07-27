import { YIVI_CSS } from './yivi-css-text.js';

let injected = false;

/**
 * Inject the Yivi CSS into the document <head> if not already present.
 * Uses a data attribute to avoid duplicate injection.
 */
export function injectYiviCss(): void {
  if (injected) return;
  if (typeof document === 'undefined') return;
  if (document.querySelector('style[data-yivi-css]')) {
    injected = true;
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-yivi-css', '');
  style.textContent = YIVI_CSS;
  document.head.appendChild(style);
  injected = true;
}
