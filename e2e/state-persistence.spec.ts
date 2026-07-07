import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Regression for the web-grid-style state-off-nodes refactor.
 *
 * Bug: every property/attribute change on <web-treeview> resends the full config,
 * which re-triggers insertArray (a full data re-insert with fresh node objects).
 * Runtime state that lived ON the nodes (highlight, checkbox selection, expansion)
 * was silently reset to defaults by that re-insert.
 *
 * Fix: highlight + selection are read from controller-owned sets the renderer
 * consults (snapshot.highlightedPaths / selectedPaths — survive the re-insert);
 * expansion is captured before the re-insert and re-applied to the fresh nodes.
 * This spec forces a re-insert (re-setting a member) and asserts nothing resets.
 */

const PAGE = '/test/highlight-focus.html';

function tree(page: Page) {
  return page.locator('.wtv__container').first();
}
function node(page: Page, path: string): Locator {
  return tree(page).locator(`.wtv__node[data-tree-path="${path}"]`).first();
}
function isHighlighted(page: Page, path: string): Promise<boolean> {
  return node(page, path)
    .locator('.wtv__node-content')
    .first()
    .evaluate((el) => [...el.classList].some((c) => c.includes('highlight')));
}
function isExpanded(page: Page, path: string): Promise<boolean> {
  return node(page, path).getAttribute('data-expanded').then((v) => v === 'true');
}

// Force a full re-insert the same way any cosmetic config change does: re-set a
// member to its current value → buildConfig resends → needsTreeRecreation.
async function forceRebuild(page: Page) {
  await page.evaluate(() => {
    const el = document.getElementById('tree') as any;
    el.displayValueMember = el.displayValueMember;
  });
  await page.waitForTimeout(250);
}

test.describe('runtime state survives a config-change re-insert', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await expect(node(page, '1')).toBeVisible();
  });

  test('highlight survives a re-insert', async ({ page }) => {
    await page.evaluate(() => (document.getElementById('tree') as any).setHighlightedPaths(['1']));
    await expect.poll(() => isHighlighted(page, '1')).toBe(true);

    await forceRebuild(page);

    expect(await isHighlighted(page, '1')).toBe(true); // was lost pre-refactor
  });

  test('expansion survives a re-insert', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.getElementById('tree') as any;
      el.collapseAll();
      el.expandNodes('1');
    });
    await expect.poll(() => isExpanded(page, '1')).toBe(true);

    await forceRebuild(page);

    expect(await isExpanded(page, '1')).toBe(true); // was reset to expandLevel default pre-refactor
  });
});
