import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /test/theming.html — verifies that dark-mode signals
 * affect the .ltree-container inside the web-component's Shadow DOM.
 *
 * Three independent paths exercised:
 *
 *   A. Library defaults (no brand theme)
 *      Light: --tv-bg-color falls back to var(--base-main-bg, #ffffff)  → rgb(255, 255, 255)
 *      Dark:  --tv-bg-color falls back to var(--base-main-bg, #1a1a1a)  → rgb(26, 26, 26)
 *      Triggered by per-instance theme="dark"/"light" prop (mirrored to
 *      data-theme on the container by _applyTheme).
 *
 *   B. Brand theme with light-dark() at wrapper
 *      Light: --base-main-bg = #dc2626 → rgb(220, 38, 38)
 *      Dark:  --base-main-bg = #16a34a → rgb(22, 163, 74)
 *      CSS custom properties inherit through Shadow DOM, so the wrapper's
 *      --base-main-bg reaches the inner .ltree-container. light-dark() resolves
 *      against the inherited color-scheme.
 *
 *   C. OS prefers-color-scheme: dark
 *      Triggers the @media :host rule inside the shadow stylesheet, which
 *      re-declares --tv-bg-color with the dark fallback (#1a1a1a).
 *
 * Ancestor signals ([data-theme], [data-bs-theme], .dark on the page) do NOT
 * pierce Shadow DOM — the web-component would need to mirror them onto its
 * host element. Tracked as a follow-up; skipped tests at the bottom.
 */

const PAGE = '/test/theming.html';

const LIGHT_BG = 'rgb(255, 255, 255)';
const DARK_BG = 'rgb(26, 26, 26)';
const BRAND_LIGHT_BG = 'rgb(220, 38, 38)'; // #dc2626 red
const BRAND_DARK_BG = 'rgb(22, 163, 74)';  // #16a34a green

function scenarioCard(page: Page, scenario: string): Locator {
  return page.locator(`.card[data-scenario="${scenario}"]`);
}

function ltreeContainer(card: Locator): Locator {
  return card.locator('.ltree-container').first();
}

async function backgroundColor(loc: Locator): Promise<string> {
  return loc.evaluate((el) => getComputedStyle(el).backgroundColor);
}

test.describe('Theming — library defaults + per-instance prop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('h1').first().waitFor();
    await expect(page.locator('.ltree-container').first()).toBeAttached();
  });

  test('1. No signal → tree surface is library light default', async ({ page }) => {
    const tree = ltreeContainer(scenarioCard(page, 'baseline-light'));
    expect(await backgroundColor(tree)).toBe(LIGHT_BG);
  });

  test('2. Per-instance theme="dark" → library dark default', async ({ page }) => {
    const tree = ltreeContainer(scenarioCard(page, 'per-instance-dark'));
    expect(await backgroundColor(tree)).toBe(DARK_BG);
    await expect(tree).toHaveAttribute('data-theme', 'dark');
  });

  test('3. Per-instance theme="light" → library light default', async ({ page }) => {
    const tree = ltreeContainer(scenarioCard(page, 'per-instance-light'));
    expect(await backgroundColor(tree)).toBe(LIGHT_BG);
    await expect(tree).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('Theming — brand theme with light-dark() inherits through Shadow DOM', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('h1').first().waitFor();
    await expect(page.locator('.ltree-container').first()).toBeAttached();
  });

  test('4. Brand theme, normal color-scheme → RED (light branch of light-dark)', async ({ page }) => {
    const tree = ltreeContainer(scenarioCard(page, 'brand-debug'));
    expect(await backgroundColor(tree)).toBe(BRAND_LIGHT_BG);
  });

  test('5. Brand theme, page color-scheme=dark → GREEN (dark branch flips)', async ({ page }) => {
    await page.evaluate(() => { document.documentElement.style.colorScheme = 'dark'; });
    const tree = ltreeContainer(scenarioCard(page, 'brand-debug'));
    await tree.evaluate((el) => void el.getBoundingClientRect());
    await expect.poll(() => backgroundColor(tree), { timeout: 5000 }).toBe(BRAND_DARK_BG);
  });

  test('6. Brand theme, OS color-scheme=dark → GREEN', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(PAGE);
    await page.locator('h1').first().waitFor();
    const tree = ltreeContainer(scenarioCard(page, 'brand-debug'));
    expect(await backgroundColor(tree)).toBe(BRAND_DARK_BG);
    await context.close();
  });
});

test.describe('Theming — library default reacts to OS preference via :host @media', () => {
  test('7. OS prefers-color-scheme=dark → library dark default on baseline tree', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(PAGE);
    await page.locator('h1').first().waitFor();
    const tree = ltreeContainer(scenarioCard(page, 'baseline-light'));
    expect(await backgroundColor(tree)).toBe(DARK_BG);
    await context.close();
  });
});

// ── Ancestor signals: gap in current web-component ──────────────────────────
// The svelte build also covers [data-theme="dark"], [data-bs-theme="dark"] and
// .dark on an ancestor. Those require the web-component to mirror the ancestor
// signal onto its host (so the inner .ltree-container[data-theme="dark"] rule
// can fire). Not implemented yet — tracked as a follow-up.
test.skip('8. Ancestor [data-theme="dark"] — needs host mirror (TODO)', () => {});
test.skip('9. Ancestor [data-bs-theme="dark"] — needs host mirror (TODO)', () => {});
test.skip('10. Ancestor .dark — needs host mirror (TODO)', () => {});
