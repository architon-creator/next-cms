import type { SliceContext } from "cms";

const fileSize: Record<string, string> = {
  en: "File Size",
  ja: "ファイルサイズ",
};

/** Strings slices need that live in the app's i18n rather than in Prismic. */
export function getSliceContext(locale: string): SliceContext {
  return { labels: { fileSize: fileSize[locale] ?? fileSize.en } };
}
