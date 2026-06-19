#!/usr/bin/env node
// One-shot rename script for the v2.0.0-rc05 API cleanup.
//
//   on* event-handler config props → *Callback (#12)
//   booleans that need is*/should* prefix → renamed (#13)
//
// JS camelCase config keys are renamed; HTML kebab-case attribute names stay
// AS-IS (e.g. `allow-copy`, `show-checkboxes`) — the ATTRIBUTE_TABLE in
// web-component.ts maps them to the new camelCase keys. That keeps the
// HTML surface short and readable while the JS surface follows the rule.
//
// The internal `NodeCallbacks` interface in src/controller/types.ts (renderer
// → controller event-handler bridge) keeps its `on*` names — they're internal
// and the event-handler convention is appropriate there.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (
        name === 'node_modules' ||
        name === 'dist' ||
        name === 'build' ||
        name === 'test-results' ||
        name === '.claude' ||
        name === '.git'
      )
        continue;
      walk(abs, exts, out);
    } else if (exts.some((e) => name.endsWith(e))) {
      out.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  }
  return out;
}

// Public TreeViewConfig + TreeControllerConfig renames.
// NodeCallbacks (controller/types.ts internal renderer→controller bridge)
// keeps its `on*` names — handled by skipping that file from the on* renames.
const CALLBACK_RENAMES = {
  onNodeClicked: 'nodeClickedCallback',
  onNodeDragStart: 'nodeDragStartCallback',
  onNodeDragOver: 'nodeDragOverCallback',
  onNodeDrop: 'nodeDropCallback',
  onSelectionChange: 'selectionChangeCallback',
  onHighlightChange: 'highlightChangeCallback',
  onRenderStart: 'renderStartCallback',
  onRenderProgress: 'renderProgressCallback',
  onRenderComplete: 'renderCompleteCallback',
};

// Private fields on WebTreeViewElement / TreeController.
const PRIVATE_CALLBACK_RENAMES = {
  _onNodeClicked: '_nodeClickedCallback',
  _onNodeDragStart: '_nodeDragStartCallback',
  _onNodeDragOver: '_nodeDragOverCallback',
  _onNodeDrop: '_nodeDropCallback',
  _onSelectionChange: '_selectionChangeCallback',
  _onHighlightChange: '_highlightChangeCallback',
  _onRenderStart: '_renderStartCallback',
  _onRenderProgress: '_renderProgressCallback',
  _onRenderComplete: '_renderCompleteCallback',
};

// Boolean config props per fix #13.
// `isSorted`, `isLoading`, `shouldUseInternalSearchIndex`,
// `shouldDisplayDebugInformation`, `shouldDisplayContextMenuInDebugMode` are
// already correct.
const BOOLEAN_RENAMES = {
  accordionExpand: 'isAccordionExpand',
  progressiveRender: 'isProgressiveRender',
  useFlatRendering: 'isFlatRenderingEnabled',
  virtualScroll: 'isVirtualScrollEnabled',
  alignNodeIcons: 'shouldAlignNodeIcons',
  allowCopy: 'isCopyAllowed',
  autoHandleCopy: 'shouldAutoHandleCopy',
  autoHandleMove: 'shouldAutoHandleMove',
  showCheckboxes: 'shouldShowCheckboxes',
  clickTogglesCheckbox: 'shouldClickToggleCheckbox',
};

// Private fields for the renamed booleans.
const PRIVATE_BOOLEAN_RENAMES = {
  _accordionExpand: '_isAccordionExpand',
  _progressiveRender: '_isProgressiveRender',
  _useFlatRendering: '_isFlatRenderingEnabled',
  _virtualScroll: '_isVirtualScrollEnabled',
  _alignNodeIcons: '_shouldAlignNodeIcons',
  _allowCopy: '_isCopyAllowed',
  _autoHandleCopy: '_shouldAutoHandleCopy',
  _autoHandleMove: '_shouldAutoHandleMove',
  _showCheckboxes: '_shouldShowCheckboxes',
  _clickTogglesCheckbox: '_shouldClickToggleCheckbox',
};

// Tree-controller internal handler suffixes also rename for consistency.
// e.g. `onNodeClickedCb` → `nodeClickedCb`, `_onNodeDragStartInternal` stays
// (internal-only handler with no public counterpart).
const CB_FIELD_RENAMES = {
  onSelectionChangeCb: 'selectionChangeCb',
  onHighlightChangeCb: 'highlightChangeCb',
  onNodeClickedCb: 'nodeClickedCb',
  onNodeDragStartCb: 'nodeDragStartCb',
  onNodeDragOverCb: 'nodeDragOverCb',
  onNodeDropCb: 'nodeDropCb',
  onRenderStartCb: 'renderStartCb',
  onRenderProgressCb: 'renderProgressCb',
  onRenderCompleteCb: 'renderCompleteCb',
};

const ALL_RENAMES = {
  ...PRIVATE_CALLBACK_RENAMES,
  ...PRIVATE_BOOLEAN_RENAMES,
  ...CALLBACK_RENAMES,
  ...BOOLEAN_RENAMES,
  ...CB_FIELD_RENAMES,
};

// Sort longest-first to avoid prefix-substring collisions (e.g. `onNodeDrop` is
// a prefix of `onNodeDropInternal`).
const sortedKeys = Object.keys(ALL_RENAMES).sort((a, b) => b.length - a.length);

const FILES = [
  ...walk(path.join(root, 'src'), ['.ts', '.css', '.html', '.md']),
  ...walk(path.join(root, 'e2e'), ['.ts']),
  ...walk(path.join(root, 'test'), ['.html', '.ts']),
];

for (const name of readdirSync(root)) {
  if (name.startsWith('examples-') && name.endsWith('.html')) FILES.push(name);
  if (name === 'index.html') FILES.push(name);
  if (name === 'CHANGELOG.md') FILES.push(name);
  if (name === 'README.md') FILES.push(name);
  if (name === 'CLAUDE.md') FILES.push(name);
}

// Files where we KEEP the `on*` event-handler bridge names.
const KEEP_ON_NAMES = new Set([
  'src/controller/types.ts', // NodeCallbacks interface (renderer→controller)
  'src/renderer/dom-renderer.ts', // calls `controller.nodeCallbacks.onNodeClicked(...)`
]);

let totalChanges = 0;
const perFile = [];

for (const rel of FILES) {
  const abs = path.join(root, rel);
  const orig = readFileSync(abs, 'utf8');
  let body = orig;

  for (const oldName of sortedKeys) {
    // For NodeCallbacks files, skip the public on* → *Callback renames.
    // But still allow the boolean / Cb-field renames in those files (they're
    // internal storage fields, not the bridge interface).
    if (KEEP_ON_NAMES.has(rel) && oldName in CALLBACK_RENAMES) continue;

    const newName = ALL_RENAMES[oldName];
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Reject `/` and `-` predecessors (file paths, CSS classes) but allow
    // `.` so property accesses (`this._foo`, `config.bar`) get rewritten.
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
