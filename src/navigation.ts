/**
 * Tree navigation interface — keyboard and programmatic navigation.
 */

import type { LTreeNode } from './ltree/ltree-node';

export interface TreeNavigation<T> {
  /** Navigate to a specific path */
  navTo(path: string): void;
  /** Navigate to the next visible node */
  navNext(): void;
  /** Navigate to the previous visible node */
  navPrev(): void;
  /** Navigate to next sibling (skip children) */
  navNextSibling(): void;
  /** Navigate to previous sibling */
  navPrevSibling(): void;
  /** Navigate into first child (expand if collapsed) */
  navInto(): void;
  /** Navigate to parent */
  navOut(): void;
  /** Navigate to parent and collapse it */
  navBackOut(): void;
  /** Toggle expand/collapse on current node */
  navToggle(): void;
  /** Navigate to first visible node */
  navFirst(): void;
  /** Navigate to last visible node */
  navLast(): void;
}

export type TreeNavigationOverrides<T> = Partial<TreeNavigation<T>>;
