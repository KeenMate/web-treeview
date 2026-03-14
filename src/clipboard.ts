/**
 * Tree clipboard — module-level singleton for cross-tree copy/cut/paste.
 */

import type { LTreeNode } from './ltree/ltree-node';

export interface ClipboardEntry<T> {
  sourceTreeId: string;
  sourcePath: string;
  data: T;
  descendants: Array<{
    relativePath: string;
    data: T;
  }>;
}

export type ClipboardOperation = 'copy' | 'cut';

export interface TreeClipboard<T> {
  operation: ClipboardOperation;
  entries: ClipboardEntry<T>[];
}

export interface PasteResult<T> {
  success: boolean;
  pastedCount: number;
  error?: string;
}

// ── Module singleton ────────────────────────────────────────────────────

let _clipboard: TreeClipboard<any> | null = null;

export function setClipboard<T>(operation: ClipboardOperation, entries: ClipboardEntry<T>[]): void {
  _clipboard = { operation, entries };
}

export function getClipboard<T>(): TreeClipboard<T> | null {
  return _clipboard as TreeClipboard<T> | null;
}

export function clearClipboard(): void {
  _clipboard = null;
}

export function hasClipboard(): boolean {
  return _clipboard !== null && _clipboard.entries.length > 0;
}

export function getClipboardOperation(): ClipboardOperation | null {
  return _clipboard?.operation ?? null;
}
