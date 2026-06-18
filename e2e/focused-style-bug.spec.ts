import { test } from '@playwright/test';

/**
 * The original regression here targets a Svelte-5-specific bug:
 * bidirectional `bind:focusedNode` routed the value through the parent's
 * `$state` proxy, deep-cloning the node into a separate reactive reference,
 * which left the canonical tree node's `isFocused` flag set after a Shift+
 * click range.
 *
 * Web-treeview uses a class-based controller with explicit getters/setters
 * — there is no proxy cloning path, so this regression doesn't apply.
 * Kept as a skipped placeholder so the test counts stay in sync with the
 * Svelte build.
 */
test.skip('shift+click range only marks the clicked node as focused — not applicable to web-treeview', () => {});
