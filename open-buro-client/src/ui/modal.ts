// src/ui/modal.ts
import type { Capability } from '../types.js';
import { trapFocus } from './focus-trap.js';
import { lockBodyScroll } from './scroll-lock.js';

export interface ModalCallbacks {
  onSelect: (capability: Capability) => void;
  onCancel: () => void;
}

export interface ModalResult {
  element: HTMLElement;
  destroy: () => void;
}

/**
 * Builds the chooser modal inside a ShadowRoot.
 *
 * UI-07 (WCAG 2.4.3): captures previousFocus BEFORE any DOM mutation or scroll
 * lock so destroy() can restore focus to the true pre-modal focus owner.
 *
 * Returns { element, destroy }. The caller appends element to the shadowRoot.
 */
export function buildModal(
  capabilities: Capability[],
  callbacks: ModalCallbacks,
  shadowRoot: ShadowRoot,
): ModalResult {
  // UI-07 (WCAG 2.4.3): capture the element that held focus BEFORE the modal opens
  const previousFocus = document.activeElement as HTMLElement | null;

  const restoreScroll = lockBodyScroll();

  const style = document.createElement('style');
  style.textContent = getModalStyles();
  shadowRoot.appendChild(style);

  // UI-03: role="dialog" + aria-modal + aria-labelledby
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'obc-modal-title');
  dialog.className = 'obc-modal';

  const titleEl = document.createElement('h2');
  titleEl.id = 'obc-modal-title';
  titleEl.textContent = 'Choose an application';
  dialog.appendChild(titleEl);

  const list = document.createElement('ul');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Available applications');
  dialog.appendChild(list);

  for (const cap of capabilities) {
    const item = document.createElement('li');
    item.setAttribute('role', 'option');
    item.setAttribute('tabindex', '0');
    item.dataset.capId = cap.id;

    const name = document.createElement('span');
    // UI-10: textContent, never innerHTML — XSS safety
    name.textContent = cap.appName;
    item.appendChild(name);

    item.addEventListener('click', () => {
      callbacks.onSelect(cap);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') callbacks.onSelect(cap);
    });
    list.appendChild(item);
  }

  // UI-02: visible cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', callbacks.onCancel);
  dialog.appendChild(cancelBtn);

  // UI-05: backdrop dismiss
  const backdrop = document.createElement('div');
  backdrop.className = 'obc-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) callbacks.onCancel();
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'obc-wrapper';
  wrapper.appendChild(backdrop);
  wrapper.appendChild(dialog);

  // UI-04: ESC key and arrow key navigation on shadowRoot (not document — Pitfall 5)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      callbacks.onCancel();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      navigateItems(list, e.key);
    }
    if (e.key === 'Home') focusItem(list, 0);
    if (e.key === 'End') focusItem(list, -1);
  };
  shadowRoot.addEventListener('keydown', onKeyDown as EventListener);

  // UI-06: focus trap (Shadow-DOM-aware)
  const releaseTrap = trapFocus(shadowRoot, dialog);

  const destroy = () => {
    shadowRoot.removeEventListener('keydown', onKeyDown as EventListener);
    releaseTrap();
    // UI-07 (WCAG 2.4.3): restore focus to the element that held it before buildModal().
    // The element may be detached by the time destroy() runs — swallow any focus() error.
    try {
      previousFocus?.focus?.();
    } catch {
      // element may be detached; ignore
    }
    style.remove();
    wrapper.remove();
    restoreScroll();
  };

  return { element: wrapper, destroy };
}

function getModalStyles(): string {
  return `
    .obc-wrapper {
      position: fixed;
      inset: 0;
      pointer-events: auto;
    }
    .obc-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
    }
    .obc-modal {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      min-width: 320px;
      max-width: 480px;
      width: 90vw;
      background: #ffffff;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 4px 32px rgba(0, 0, 0, 0.24);
    }
    .obc-modal h2 {
      font-size: 18px;
      margin-bottom: 16px;
    }
    .obc-modal ul {
      list-style: none;
      margin-bottom: 16px;
    }
    .obc-modal li {
      padding: 12px;
      cursor: pointer;
      border-radius: 4px;
    }
    .obc-modal li:hover,
    .obc-modal li:focus {
      background: rgba(37, 99, 235, 0.1);
      outline: 2px solid #2563eb;
      outline-offset: -2px;
    }
    .obc-modal button {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
    }
    .obc-modal button:focus {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
  `;
}

function navigateItems(list: HTMLElement, direction: 'ArrowDown' | 'ArrowUp'): void {
  const items = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
  const current = list.querySelector<HTMLElement>('[role="option"]:focus');
  const idx = current ? items.indexOf(current) : -1;
  const next =
    direction === 'ArrowDown' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
  items[next]?.focus();
}

function focusItem(list: HTMLElement, index: number): void {
  const items = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'));
  const target = index === -1 ? items[items.length - 1] : items[index];
  target?.focus();
}
