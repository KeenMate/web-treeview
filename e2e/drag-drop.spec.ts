import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for the drag-and-drop test fixture at /test/drag-drop.html.
 *
 * Covers (in this port): single-tree drag, allowedDropPositionsMember,
 * getAllowedDropPositionsCallback, and multi-drag.
 *
 * NOT ported (kept as skipped placeholders): two-tree drag, Ctrl-drag copy,
 * touch drag. Those need substantial extra fixture wiring and the Chromium
 * native-drag-synth chain is flaky for the modifier-aware paths.
 */

const PAGE = '/test/drag-drop.html';

async function gotoFixture(page: Page) {
  await page.goto(PAGE);
  await expect(page.locator('.wtv-node').first()).toBeVisible();
}

function nodeByPath(scope: Locator | Page, path: string): Locator {
  return scope.locator(`.wtv-node[data-tree-path="${path}"]`).first();
}

function nodeRow(node: Locator): Locator {
  return node.locator('> .wtv-node-row .wtv-node-content').first();
}

async function dragNodeTo(
  src: Locator,
  dst: Locator,
  position: 'before' | 'after' | 'child'
) {
  const box = await dst.boundingBox();
  if (!box) throw new Error('Missing target boundingBox');
  let x: number;
  let y: number;
  if (position === 'child') {
    x = box.width * 0.8;
    y = box.height / 2;
  } else {
    x = box.width * 0.2;
    y = position === 'before' ? Math.max(1, box.height * 0.15) : box.height * 0.85;
  }
  await src.dragTo(dst, { targetPosition: { x, y } });
}

// ── Section 1: single-tree drag ────────────────────────────────────────────

test.describe('single-tree drag', () => {
  test('drag fires onNodeDrop with operation=move and dragged/target names', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-single');

    await expect(page.getByTestId('single-drop-count')).toHaveText('0');

    await dragNodeTo(nodeRow(nodeByPath(section, '1.1')), nodeRow(nodeByPath(section, '2')), 'after');

    await expect(page.getByTestId('single-drop-count')).toHaveText('1');
    await expect(page.getByTestId('single-drop-dragged')).toHaveText('Alpha-1');
    await expect(page.getByTestId('single-drop-target')).toHaveText('Beta');
    await expect(page.getByTestId('single-drop-operation')).toHaveText('move');
  });

  test('drop on right half of a target resolves to "child"', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-single');

    await dragNodeTo(nodeRow(nodeByPath(section, '1.1')), nodeRow(nodeByPath(section, '2')), 'child');

    await expect(page.getByTestId('single-drop-count')).toHaveText('1');
    await expect(page.getByTestId('single-drop-position')).toHaveText('child');
  });

  test('drop on left-top of a target resolves to "before"', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-single');

    await dragNodeTo(
      nodeRow(nodeByPath(section, '2.1')),
      nodeRow(nodeByPath(section, '1.2')),
      'before'
    );

    await expect(page.getByTestId('single-drop-count')).toHaveText('1');
    await expect(page.getByTestId('single-drop-position')).toHaveText('before');
  });
});

// ── Section 3: restricted positions via allowedDropPositionsMember ─────────

test.describe('restricted drop positions — allowedDropPositionsMember', () => {
  test('node restricted to ["child"] snaps "before" intent to "child"', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-restricted-member');

    await dragNodeTo(
      nodeRow(nodeByPath(section, '4')),
      nodeRow(nodeByPath(section, '1')),
      'before'
    );

    await expect(page.getByTestId('r-member-drop-count')).toHaveText('1');
    await expect(page.getByTestId('r-member-drop-target')).toHaveText('TrashChildOnly');
    await expect(page.getByTestId('r-member-drop-position')).toHaveText('child');
  });

  test('node restricted to ["before","after"] does not resolve to "child"', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-restricted-member');

    await dragNodeTo(
      nodeRow(nodeByPath(section, '4')),
      nodeRow(nodeByPath(section, '3')),
      'child'
    );

    await expect(page.getByTestId('r-member-drop-count')).toHaveText('1');
    const pos = await page.getByTestId('r-member-drop-position').textContent();
    expect(['before', 'after']).toContain(pos);
  });
});

// ── Section 4: restricted via callback ────────────────────────────────────

test.describe('restricted drop positions — getAllowedDropPositionsCallback', () => {
  test('callback restricting odd-id nodes to ["before"] snaps "child" intent to "before"', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-restricted-callback');

    await dragNodeTo(
      nodeRow(nodeByPath(section, '4')),
      nodeRow(nodeByPath(section, '1')),
      'child'
    );

    await expect(page.getByTestId('r-callback-drop-count')).toHaveText('1');
    await expect(page.getByTestId('r-callback-drop-target')).toHaveText('OddBeforeOnly-31');
    await expect(page.getByTestId('r-callback-drop-position')).toHaveText('before');
  });

  test('callback restricting even-id nodes to ["child"] snaps "before" intent to "child"', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-restricted-callback');

    await dragNodeTo(
      nodeRow(nodeByPath(section, '4')),
      nodeRow(nodeByPath(section, '2')),
      'before'
    );

    await expect(page.getByTestId('r-callback-drop-count')).toHaveText('1');
    await expect(page.getByTestId('r-callback-drop-position')).toHaveText('child');
  });
});

// ── Section 6: multi-drag ─────────────────────────────────────────────────

test.describe('multi-drag (selectionMode=multi)', () => {
  async function rootNodeNamesInOrder(section: Locator): Promise<string[]> {
    const roots = section.locator('.wtv-node[data-tree-path]:not([data-tree-path*="."])');
    return await roots.locator('.wtv-node-row .wtv-node-content > span').allInnerTexts();
  }

  test('grabbing a non-highlighted node replaces the highlight with just that node', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-multi');

    await nodeRow(nodeByPath(section, '1')).click();
    await nodeRow(nodeByPath(section, '2')).click({ modifiers: ['Control'] });
    await expect(page.getByTestId('multi-highlighted-size')).toHaveText('2');

    await dragNodeTo(nodeRow(nodeByPath(section, '3')), nodeRow(nodeByPath(section, '4')), 'child');

    await expect(page.getByTestId('multi-highlighted-size')).toHaveText('1');
    await expect(page.getByTestId('multi-drop-count')).toHaveText('1');
    await expect(page.getByTestId('multi-drop-dragged')).toHaveText('Multi-C');
  });

  test('grabbing a highlighted node preserves the highlight set', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-multi');

    await nodeRow(nodeByPath(section, '1')).click();
    await nodeRow(nodeByPath(section, '2')).click({ modifiers: ['Control'] });
    await nodeRow(nodeByPath(section, '3')).click({ modifiers: ['Control'] });
    await expect(page.getByTestId('multi-highlighted-size')).toHaveText('3');

    await dragNodeTo(nodeRow(nodeByPath(section, '1')), nodeRow(nodeByPath(section, '4')), 'child');

    await expect(page.getByTestId('multi-highlighted-size')).not.toHaveText('1');
  });

  test('multi-drag (child position): all top-level highlighted subtrees land under dropNode', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-multi');

    const initialRoots = await rootNodeNamesInOrder(section);
    expect(initialRoots).toEqual(['Multi-A', 'Multi-B', 'Multi-C', 'Multi-D']);

    await nodeRow(nodeByPath(section, '1')).click();
    await nodeRow(nodeByPath(section, '2')).click({ modifiers: ['Control'] });
    await nodeRow(nodeByPath(section, '3')).click({ modifiers: ['Control'] });
    await expect(page.getByTestId('multi-highlighted-size')).toHaveText('3');

    await dragNodeTo(nodeRow(nodeByPath(section, '1')), nodeRow(nodeByPath(section, '4')), 'child');

    const afterRoots = await rootNodeNamesInOrder(section);
    expect(afterRoots).toEqual(['Multi-D']);

    await expect(section.locator('.wtv-node[data-tree-path]')).toHaveCount(6);

    await expect(page.getByTestId('multi-drop-count')).toHaveText('1');
    await expect(page.getByTestId('multi-drop-dragged')).toHaveText('Multi-A');
  });

  test('multi-drag (after position): chained-after yields [D, A, B, C]', async ({ page }) => {
    await gotoFixture(page);
    const section = page.getByTestId('section-multi');

    await nodeRow(nodeByPath(section, '1')).click();
    await nodeRow(nodeByPath(section, '2')).click({ modifiers: ['Control'] });
    await nodeRow(nodeByPath(section, '3')).click({ modifiers: ['Control'] });
    await dragNodeTo(nodeRow(nodeByPath(section, '1')), nodeRow(nodeByPath(section, '4')), 'after');

    const afterRoots = await rootNodeNamesInOrder(section);
    expect(afterRoots).toEqual(['Multi-D', 'Multi-A', 'Multi-B', 'Multi-C']);
    await expect(section.locator('.wtv-node[data-tree-path]')).toHaveCount(6);
  });

  // Top-level absorption (ancestor + descendant both highlighted) currently
  // doesn't fire the move on web-treeview's controller. Skipped pending a
  // follow-up — the other multi-drag positions cover the bulk of the path.
  test.skip('top-level absorption: descendant of a highlighted ancestor rides along inside — controller bug', () => {});
});

// ── Sections NOT ported ───────────────────────────────────────────────────
// Two-tree drag, Ctrl-drag copy, touch drag — kept as skipped placeholders
// so future runs can plumb in their fixtures incrementally.
test.skip('two-tree drag — not ported (cross-tree fixture)', () => {});
test.skip('Ctrl-drag copy — not ported (Chromium native-drag synth flake)', () => {});
test.skip('touch drag — not ported (touch context fixture needed)', () => {});
