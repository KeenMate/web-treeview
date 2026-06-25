import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /test/highlight-focus.html — parity with svelte-treeview's
 * e2e/highlight-focus.spec.ts.
 *
 * Two contracts:
 *
 *  1. Highlight-marker FALLBACK. `.wtv__node-content--highlighted` ships a
 *     default look so highlight is visible out of the box, but the DOM renderer
 *     only applies it when `highlightedNodeClass` is unset. Setting a highlight
 *     class must suppress the marker so the default background never fights the
 *     configured style.
 *
 *  2. Focused-node styling. `.wtv__node-content--focused` is a pure hook applied
 *     whenever a node is focused (regardless of focusedNodeClass). The optional
 *     `focusedNodeClass` is additive and lands on exactly the one focused row.
 *
 * NB: web-treeview's diff renderer only re-renders a row when its `_rev` bumps
 * (a config-only attribute change does NOT re-render already-drawn rows). So
 * each test sets the highlight/focus class BEFORE clicking — the click bumps
 * `_rev`, and `_updateNodeElement` then reads the current config. This is why
 * there's no "switch the class on an already-highlighted row" test like the
 * Svelte build has (Svelte's reactive class binding hot-swaps; the diff
 * renderer intentionally doesn't).
 *
 * Page data (alpha-sorted): '1' Documents, '1.1' Work, '1.2' Personal,
 * '2' Downloads. 1.1/1.2/2 are leaves. click-behavior="select": a plain click
 * focuses + highlights (replace).
 */

const PAGE = '/test/highlight-focus.html';

const MARKER = 'wtv__node-content--highlighted';
const FOCUS_MARKER = 'wtv__node-content--focused';
const BOLD = 'wtv__node-content--highlight-bold';
const GLOW = 'wtv__node-content--highlight-glow';
const FOCUS_CLASS = 'test-focus';

function nodeContent(page: Page, path: string): Locator {
  return page
    .locator(`.wtv__node[data-tree-path="${path}"]`)
    .first()
    .locator('> .wtv__node-row .wtv__node-content')
    .first();
}

function outputValue(page: Page, label: string): Locator {
  return page
    .locator('.output')
    .filter({ has: page.locator('p.output-label', { hasText: label }) })
    .first()
    .locator('pre')
    .first();
}

async function goto(page: Page) {
  await page.goto(PAGE);
  await expect(page.locator('.wtv__node').first()).toBeVisible();
}

// ── Highlight marker fallback ────────────────────────────────────────────────

test.describe('highlight marker fallback', () => {
  test('no highlightedNodeClass: highlighted row gets the fallback marker', async ({ page }) => {
    await goto(page);

    const work = nodeContent(page, '1.1');
    await work.click();

    await expect(outputValue(page, 'Highlighted')).toContainText('1.1');
    await expect(work).toHaveClass(new RegExp(`\\b${MARKER}\\b`));
  });

  test('highlightedNodeClass="Bold": custom class applied, fallback marker suppressed', async ({ page }) => {
    await goto(page);
    await page.getByLabel('Highlight Class:').selectOption(BOLD);

    const work = nodeContent(page, '1.1');
    await work.click();

    await expect(work).toHaveClass(new RegExp(`\\b${BOLD}\\b`));
    await expect(work).not.toHaveClass(new RegExp(`\\b${MARKER}\\b`));
  });

  test('highlightedNodeClass="Glow": custom class applied, fallback marker suppressed', async ({ page }) => {
    await goto(page);
    await page.getByLabel('Highlight Class:').selectOption(GLOW);

    const work = nodeContent(page, '1.1');
    await work.click();

    await expect(work).toHaveClass(new RegExp(`\\b${GLOW}\\b`));
    await expect(work).not.toHaveClass(new RegExp(`\\b${MARKER}\\b`));
  });
});

// ── Focused node styling ─────────────────────────────────────────────────────

test.describe('focused node styling', () => {
  test('focus marker hook is applied to the focused row even with no focusedNodeClass', async ({ page }) => {
    await goto(page);

    const work = nodeContent(page, '1.1');
    await work.click();

    await expect(outputValue(page, 'Focused Node')).toContainText('Work');
    await expect(work).toHaveClass(new RegExp(`\\b${FOCUS_MARKER}\\b`));
    await expect(work).not.toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));
  });

  test('focusedNodeClass lands on the focused row', async ({ page }) => {
    await goto(page);
    await page.getByLabel('Focus Class:').selectOption(FOCUS_CLASS);

    const work = nodeContent(page, '1.1');
    await work.click();

    await expect(work).toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));
    await expect(work).toHaveClass(new RegExp(`\\b${FOCUS_MARKER}\\b`));
  });

  test('focus is single: moving focus moves both the hook and the custom class', async ({ page }) => {
    await goto(page);
    await page.getByLabel('Focus Class:').selectOption(FOCUS_CLASS);

    const work = nodeContent(page, '1.1');
    const personal = nodeContent(page, '1.2');

    await work.click();
    await expect(work).toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));

    await personal.click();
    await expect(personal).toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));
    await expect(personal).toHaveClass(new RegExp(`\\b${FOCUS_MARKER}\\b`));
    await expect(work).not.toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));
    await expect(work).not.toHaveClass(new RegExp(`\\b${FOCUS_MARKER}\\b`));

    await expect(page.locator(`.${FOCUS_MARKER}`)).toHaveCount(1);
  });

  test('highlight and focus stack independently on the same row', async ({ page }) => {
    await goto(page);
    await page.getByLabel('Highlight Class:').selectOption(BOLD);
    await page.getByLabel('Focus Class:').selectOption(FOCUS_CLASS);

    const work = nodeContent(page, '1.1');
    await work.click();

    await expect(work).toHaveClass(new RegExp(`\\b${BOLD}\\b`));
    await expect(work).toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));
    await expect(work).not.toHaveClass(new RegExp(`\\b${MARKER}\\b`));
  });
});
