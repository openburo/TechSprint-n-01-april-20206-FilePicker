// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Capability } from '../types.js';
import { buildModal } from './modal.js';

const caps: Capability[] = [
  {
    id: 'cap-1',
    appName: 'Cloud Picker',
    action: 'PICK',
    path: 'https://picker.example.com/picker',
    properties: { mimeTypes: ['*/*'] },
  },
  {
    id: 'cap-2',
    appName: 'Drive Saver',
    action: 'SAVE',
    path: 'https://drive.example.com/saver',
    properties: { mimeTypes: ['image/png'] },
  },
];

function setup(capabilities = caps) {
  const onSelect = vi.fn();
  const onCancel = vi.fn();

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  const { element, destroy } = buildModal(capabilities, { onSelect, onCancel }, root);
  root.appendChild(element);

  return { host, root, element, destroy, onSelect, onCancel };
}

describe('buildModal', () => {
  afterEach(() => {
    // restore body overflow and clean up
    document.body.style.overflow = '';
    for (const el of Array.from(document.body.children)) {
      el.remove();
    }
  });

  it('sets role="dialog", aria-modal="true", aria-labelledby="obc-modal-title" on dialog', () => {
    const { root } = setup();
    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('obc-modal-title');
  });

  it('has h2 with id="obc-modal-title" and textContent "Choose an application"', () => {
    const { root } = setup();
    const title = root.querySelector('#obc-modal-title');
    expect(title).not.toBeNull();
    expect(title?.tagName.toLowerCase()).toBe('h2');
    expect(title?.textContent).toBe('Choose an application');
  });

  it('renders one li[role="option"] per capability with correct appName', () => {
    const { root } = setup();
    const items = root.querySelectorAll('[role="option"]');
    expect(items.length).toBe(caps.length);
    expect(items[0]?.textContent).toContain('Cloud Picker');
    expect(items[1]?.textContent).toContain('Drive Saver');
  });

  it('has a Cancel button with textContent "Cancel"', () => {
    const { root } = setup();
    const cancelBtn = root.querySelector('button');
    expect(cancelBtn).not.toBeNull();
    expect(cancelBtn?.textContent).toBe('Cancel');
  });

  it('Cancel button click invokes onCancel once', () => {
    const { root, onCancel } = setup();
    const cancelBtn = root.querySelector('button') as HTMLButtonElement;
    cancelBtn.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('option click invokes onSelect with the correct capability', () => {
    const { root, onSelect } = setup();
    const items = root.querySelectorAll('[role="option"]');
    (items[0] as HTMLElement).click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(caps[0]);
  });

  it('option Enter key invokes onSelect with the correct capability', () => {
    const { root, onSelect } = setup();
    const items = root.querySelectorAll('[role="option"]');
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    (items[1] as HTMLElement).dispatchEvent(enterEvent);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(caps[1]);
  });

  it('ESC key on shadowRoot invokes onCancel', () => {
    const { root, onCancel } = setup();
    const escEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    root.dispatchEvent(escEvent);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('backdrop click invokes onCancel; click on child does not', () => {
    const { element, onCancel } = setup();
    const backdrop = element.querySelector('.obc-backdrop') as HTMLElement;
    expect(backdrop).not.toBeNull();

    // Simulate backdrop click where e.target === backdrop
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(clickEvent, 'target', { value: backdrop });
    backdrop.dispatchEvent(clickEvent);
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Click on a child (dialog) should NOT invoke onCancel again
    const dialog = element.querySelector('[role="dialog"]') as HTMLElement;
    const dialogClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    dialog.dispatchEvent(dialogClick);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('destroy() removes wrapper from shadowRoot', () => {
    const { root, element, destroy } = setup();
    expect(root.contains(element)).toBe(true);
    destroy();
    expect(root.contains(element)).toBe(false);
  });

  it('destroy() restores body scroll: hidden on open, reverts on destroy', () => {
    const { destroy } = setup();
    expect(document.body.style.overflow).toBe('hidden');
    destroy();
    expect(document.body.style.overflow).toBe('');
  });

  it('body scroll is locked on open', () => {
    setup();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('XSS guard: appName with HTML renders as textContent not actual elements', () => {
    const xssCap: Capability = {
      id: 'xss',
      appName: '<img src=x onerror=alert(1)>',
      action: 'PICK',
      path: 'https://xss.example.com/picker',
      properties: { mimeTypes: ['*/*'] },
    };
    const { root } = setup([xssCap]);
    const item = root.querySelector('[role="option"]');
    expect(item?.textContent).toContain('<img');
    // No actual img element should be injected
    expect(root.querySelector('img')).toBeNull();
  });

  it('restores focus to the pre-open element after destroy (WCAG 2.4.3)', async () => {
    // Create a trigger button in document.body that holds focus before opening modal
    const trigger = document.createElement('button');
    trigger.id = 'trigger';
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { destroy } = setup();
    // Modal is open — focus should be inside shadow root (focus trap auto-focuses first item)
    // destroy() should restore focus to trigger
    destroy();
    // Focus should return to the trigger element
    expect(document.activeElement).toBe(trigger);

    // cleanup
    trigger.remove();
  });
});
