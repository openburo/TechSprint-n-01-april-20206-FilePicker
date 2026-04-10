// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { MockBridge } from './mock-bridge.js';

describe('MockBridge', () => {
  let iframe: HTMLIFrameElement;

  beforeEach(() => {
    iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
  });

  it('initializes with lastMethods=null, connectCallCount=0, destroyCallCount=0', () => {
    const mock = new MockBridge();
    expect(mock.lastMethods).toBeNull();
    expect(mock.connectCallCount).toBe(0);
    expect(mock.destroyCallCount).toBe(0);
  });

  it('connect() returns a ConnectionHandle with a destroy function', async () => {
    const mock = new MockBridge();
    const handle = await mock.connect(iframe, 'https://cap.example.com', { resolve: () => {} });
    expect(typeof handle.destroy).toBe('function');
  });

  it('after connect(), lastMethods is reference-equal to the passed methods object', async () => {
    const mock = new MockBridge();
    const methods = { resolve: () => {} };
    await mock.connect(iframe, 'https://cap.example.com', methods);
    expect(mock.lastMethods).toBe(methods);
  });

  it('after connect(), connectCallCount === 1', async () => {
    const mock = new MockBridge();
    await mock.connect(iframe, 'https://cap.example.com', { resolve: () => {} });
    expect(mock.connectCallCount).toBe(1);
  });

  it('handle.destroy() increments destroyCallCount to 1', async () => {
    const mock = new MockBridge();
    const handle = await mock.connect(iframe, 'https://cap.example.com', { resolve: () => {} });
    handle.destroy();
    expect(mock.destroyCallCount).toBe(1);
  });

  it('two connects increment connectCallCount, overwrite lastMethods; two destroys increment destroyCallCount independently', async () => {
    const mock = new MockBridge();
    const methods1 = { resolve: () => {} };
    const methods2 = { resolve: () => {} };

    const handle1 = await mock.connect(iframe, 'https://cap.example.com', methods1);
    const handle2 = await mock.connect(iframe, 'https://cap.example.com', methods2);

    expect(mock.connectCallCount).toBe(2);
    expect(mock.lastMethods).toBe(methods2);

    handle1.destroy();
    handle2.destroy();
    expect(mock.destroyCallCount).toBe(2);
  });
});
