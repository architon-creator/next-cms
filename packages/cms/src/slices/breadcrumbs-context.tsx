"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { PageContext } from "./types";

const BreadcrumbsContext = createContext<PageContext["breadcrumbs"]>([]);

/**
 * Wrap a page's rendered output in this to make its breadcrumb trail
 * available to the Breadcrumbs slice, wherever it ends up in the tree.
 * Mirrors the FaqTopicProvider pattern — SliceRenderer only ever passes
 * `{ slice }` to a component, so page-level data reaches slices via a
 * Context Provider the page wraps around itself, not via a prop
 * SliceRenderer forwards.
 */
export function BreadcrumbsProvider({
  breadcrumbs,
  children,
}: {
  breadcrumbs: PageContext["breadcrumbs"];
  children: ReactNode;
}) {
  return (
    <BreadcrumbsContext.Provider value={breadcrumbs}>
      {children}
    </BreadcrumbsContext.Provider>
  );
}

export function useBreadcrumbs() {
  return useContext(BreadcrumbsContext);
}
