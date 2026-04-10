import { describe, expect, it } from 'vitest';
import type { Capability, IntentRequest } from '../types.js';
import { resolve } from './resolver.js';

// Fixtures
const capPick: Capability = {
  id: 'cap-1',
  appName: 'App One',
  action: 'PICK',
  path: 'https://app1.example.com/cap',
  properties: { mimeTypes: ['image/png'] },
};

const capPickPdf: Capability = {
  id: 'cap-2',
  appName: 'App Two',
  action: 'PICK',
  path: 'https://app2.example.com/cap',
  properties: { mimeTypes: ['application/pdf'] },
};

const capPickWildcard: Capability = {
  id: 'cap-3',
  appName: 'App Three',
  action: 'PICK',
  path: 'https://app3.example.com/cap',
  properties: { mimeTypes: ['*/*'] },
};

const capSave: Capability = {
  id: 'cap-4',
  appName: 'App Four',
  action: 'SAVE',
  path: 'https://app4.example.com/cap',
  properties: { mimeTypes: ['image/png'] },
};

describe('resolve', () => {
  it('returns empty array for empty capabilities list', () => {
    const intent: IntentRequest = { action: 'PICK', args: {} };
    expect(resolve([], intent)).toEqual([]);
  });

  it('action mismatch — returns empty array when cap.action !== intent.action', () => {
    const intent: IntentRequest = { action: 'PICK', args: {} };
    expect(resolve([capSave], intent)).toEqual([]);
  });

  it('absent allowedMimeType — returns all action-matching capabilities (RES-03)', () => {
    const intent: IntentRequest = { action: 'PICK', args: {} };
    const result = resolve([capPick, capPickPdf, capSave], intent);
    expect(result).toEqual([capPick, capPickPdf]);
  });

  it('empty string allowedMimeType — matches all action-matching capabilities (RES-03 empty variant)', () => {
    const intent: IntentRequest = { action: 'PICK', args: { allowedMimeType: '' } };
    const result = resolve([capPick, capPickPdf, capSave], intent);
    expect(result).toEqual([capPick, capPickPdf]);
  });

  it('intent */* — matches all action-matching capabilities (RES-06)', () => {
    const intent: IntentRequest = { action: 'PICK', args: { allowedMimeType: '*/*' } };
    const result = resolve([capPick, capPickPdf, capSave], intent);
    expect(result).toEqual([capPick, capPickPdf]);
  });

  it('capability */* in mimeTypes — matches any specific intent mime (RES-04)', () => {
    const intent: IntentRequest = { action: 'PICK', args: { allowedMimeType: 'video/mp4' } };
    const result = resolve([capPick, capPickWildcard], intent);
    expect(result).toEqual([capPickWildcard]);
  });

  it('exact mime match succeeds (RES-05)', () => {
    const intent: IntentRequest = { action: 'PICK', args: { allowedMimeType: 'image/png' } };
    const result = resolve([capPick, capPickPdf], intent);
    expect(result).toEqual([capPick]);
  });

  it('exact mime mismatch excluded (RES-05)', () => {
    const intent: IntentRequest = { action: 'PICK', args: { allowedMimeType: 'application/pdf' } };
    const result = resolve([capPick], intent);
    expect(result).toEqual([]);
  });

  it('mixed list — only matching caps returned, preserving input order', () => {
    const intent: IntentRequest = { action: 'PICK', args: { allowedMimeType: 'image/png' } };
    const result = resolve([capPick, capPickPdf, capPickWildcard], intent);
    expect(result).toEqual([capPick, capPickWildcard]);
  });
});
