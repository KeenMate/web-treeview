#!/usr/bin/env node
// BEM-ify @keenmate/web-treeview CSS classes.
//
//   .wtv-X       → .wtv__X       (elements)
//   .wtv-X       → .wtv__Y--Z    (modifiers — explicit per map below)
//   --wtv-spin keyframe handled too.
//
// CSS variable prefix `--wtv-*` is already correct (mechanical lowercase
// short prefix on every var); we do NOT touch those.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'build' || name === 'test-results' || name === '.claude' || name === '.git') continue;
      walk(abs, exts, out);
    } else if (exts.some(e => name.endsWith(e))) {
      out.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  }
  return out;
}

// Sorted longest-first by the runner below.
const CLASS_RENAMES = {
  // Elements
  'wtv-container': 'wtv__container',
  'wtv-tree': 'wtv__tree',
  'wtv-node-row': 'wtv__node-row',
  'wtv-node-content': 'wtv__node-content',
  'wtv-node-icon': 'wtv__node-icon',
  'wtv-node-label': 'wtv__node-label',
  'wtv-node-path': 'wtv__node-path',
  'wtv-node': 'wtv__node',
  'wtv-children': 'wtv__children',
  'wtv-checkbox': 'wtv__checkbox',
  'wtv-toggle-icon': 'wtv__toggle-icon',
  'wtv-virtual-scroll': 'wtv__virtual-scroll',
  'wtv-touch-ghost': 'wtv__touch-ghost',
  'wtv-empty-state': 'wtv__empty-state',
  'wtv-empty-zone-content': 'wtv__empty-zone-content',
  'wtv-empty-zone': 'wtv__empty-zone',
  'wtv-debug-info': 'wtv__debug-info',
  'wtv-debug-stats': 'wtv__debug-stats',
  'wtv-loading-overlay': 'wtv__loading-overlay',
  'wtv-loading-spinner': 'wtv__loading-spinner',
  'wtv-loading-more': 'wtv__loading-more',
  'wtv-scroll-highlight-arrow': 'wtv__scroll-arrow',
  'wtv-root-drop-zone': 'wtv__root-drop-zone',
  'wtv-drop-zones': 'wtv__drop-zones',
  'wtv-drop-zone': 'wtv__drop-zone',
  'wtv-context-menu-divider-named': 'wtv__context-menu-divider--named',
  'wtv-context-menu-divider': 'wtv__context-menu-divider',
  'wtv-context-menu-separator': 'wtv__context-menu-separator',
  'wtv-context-menu-shortcut': 'wtv__context-menu-shortcut',
  'wtv-context-menu-arrow': 'wtv__context-menu-arrow',
  'wtv-context-menu-icon': 'wtv__context-menu-icon',
  'wtv-context-menu-label': 'wtv__context-menu-label',
  'wtv-context-menu-item-disabled': 'wtv__context-menu-item--disabled',
  'wtv-context-menu-item-danger': 'wtv__context-menu-item--danger',
  'wtv-context-menu-has-children': 'wtv__context-menu-item--has-children',
  'wtv-context-menu-item': 'wtv__context-menu-item',
  'wtv-context-menu': 'wtv__context-menu',
  'wtv-context-submenu': 'wtv__context-submenu',
  'wtv-header': 'wtv__header',
  'wtv-footer': 'wtv__footer',
  'wtv-vs-content': 'wtv__vs-content',
  'wtv-vs-spacer': 'wtv__vs-spacer',

  // Modifiers
  'wtv-clickable': 'wtv__clickable',                          // utility (toggle-icon AND node-content)
  'wtv-draggable': 'wtv__node-content--draggable',
  'wtv-dragged': 'wtv__node-content--dragged',
  'wtv-drop-copy': 'wtv__node-content--drop-copy',
  'wtv-cut': 'wtv__node-content--cut',
  'wtv-drag-over': 'wtv__node-content--drag-over',
  'wtv-drop-valid': 'wtv__node-content--drop-valid',
  'wtv-drop-invalid': 'wtv__node-content--drop-invalid',
  'wtv-glow-before': 'wtv__node-content--glow-before',
  'wtv-glow-after': 'wtv__node-content--glow-after',
  'wtv-glow-child': 'wtv__node-content--glow-child',
  'wtv-dragover-highlight': 'wtv__node-content--dragover-highlight',
  'wtv-dragover-glow': 'wtv__node-content--dragover-glow',
  'wtv-scroll-highlight': 'wtv__node-content--scroll-highlight',
  'wtv-highlight-bold': 'wtv__node-content--highlight-bold',
  'wtv-highlight-border': 'wtv__node-content--highlight-border',
  'wtv-highlight-brackets': 'wtv__node-content--highlight-brackets',
  'wtv-highlighted': 'wtv__node-content--highlighted',
  'wtv-focused': 'wtv__node-content--focused',
  'wtv-drop-before': 'wtv__drop-zone--before',
  'wtv-drop-after': 'wtv__drop-zone--after',
  'wtv-drop-child': 'wtv__drop-zone--child',
  'wtv-drop-zone-active': 'wtv__drop-zone--active',
  'wtv-drop-zones-around': 'wtv__drop-zones--around',
  'wtv-drop-zones-above': 'wtv__drop-zones--above',
  'wtv-drop-zones-below': 'wtv__drop-zones--below',
  'wtv-drop-zones-wave2': 'wtv__drop-zones--wave2',
  'wtv-drop-zones-wave': 'wtv__drop-zones--wave',
  'wtv-icon-leaf-none': 'wtv__toggle-icon--leaf-none',
  'wtv-icon-collapse-arrow': 'wtv__toggle-icon--collapse-arrow',
  'wtv-icon-expand-arrow': 'wtv__toggle-icon--expand-arrow',
  'wtv-icon-collapse-minus': 'wtv__toggle-icon--collapse-minus',
  'wtv-icon-expand-plus': 'wtv__toggle-icon--expand-plus',
  'wtv-icon-collapse-alt': 'wtv__toggle-icon--collapse-alt',
  'wtv-icon-expand-alt': 'wtv__toggle-icon--expand-alt',
  'wtv-icon-leaf': 'wtv__toggle-icon--leaf',
  'wtv-icon-collapse': 'wtv__toggle-icon--collapse',
  'wtv-icon-expand': 'wtv__toggle-icon--expand',
};

const sortedClassKeys = Object.keys(CLASS_RENAMES).sort((a, b) => b.length - a.length);

const FILES = [
  ...walk(path.join(root, 'src'), ['.ts', '.css', '.html', '.md']),
  ...walk(path.join(root, 'e2e'), ['.ts']),
  ...walk(path.join(root, 'test'), ['.html', '.ts']),
];

// Also include the demo-page HTMLs at the repo root.
for (const name of readdirSync(root)) {
  if (name.startsWith('examples-') && name.endsWith('.html')) FILES.push(name);
  if (name === 'examples-shared.css') FILES.push(name);
}

let totalChanges = 0;
const perFile = [];

for (const rel of FILES) {
  const abs = path.join(root, rel);
  const orig = readFileSync(abs, 'utf8');
  let body = orig;

  // Phase 1: keyframe rename (wtv-spin is a keyframes identifier, no `--` prefix).
  body = body.replace(/\bwtv-spin\b/g, 'wtv__spin');

  // Phase 2: BEM class renames. Reject matches preceded by `/` (file paths) or
  // word-char / dash (mid-identifier). The `--wtv-` variable prefix has `--`
  // in front so `(?<![\w/-])` rejects it — vars stay intact.
  for (const oldName of sortedClassKeys) {
    const newName = CLASS_RENAMES[oldName];
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\w/-])${escaped}(?![\\w-])`, 'g');
    body = body.replace(re, newName);
  }

  if (body !== orig) {
    const changes = countDiff(orig, body);
    totalChanges += changes;
    perFile.push({ rel, changes });
    writeFileSync(abs, body, 'utf8');
  }
}

function countDiff(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  let n = 0;
  const max = Math.max(la.length, lb.length);
  for (let i = 0; i < max; i++) if (la[i] !== lb[i]) n++;
  return n;
}

perFile.sort((x, y) => y.changes - x.changes);
for (const { rel, changes } of perFile) {
  console.log(`${changes.toString().padStart(4)} ${rel}`);
}
console.log(`\nTotal: ${totalChanges} changed lines across ${perFile.length} files`);
