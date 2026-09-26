/**
 * Optional per-render data a page hands to its slices via `SliceRenderer`'s
 * `context` prop (e.g. strings that live in the app's i18n, not in Prismic).
 */
export type SliceContext = {
  labels?: {
    /** Prefix for a download's size, e.g. "File Size" → "File Size: 504KB". */
    fileSize?: string;
  };
};

export type PageContext = {
  breadcrumbs: { label: string | null; href: string | null }[];
};
