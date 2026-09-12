import type { MetadataRoute } from "next";
import { createClient } from "cms";

import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

// Mirrors the "as-needed" locale prefix strategy in i18n/routing.ts: the
// default locale is unprefixed (/about), every other locale is prefixed
// (/ja/about), so the sitemap URLs match what actually resolves.
function localePath(locale: string, path: string): string {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const client = createClient();
  const pages = await client.getAllByType("content_page");
  const siteUrl = getSiteUrl();

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    entries.push({ url: `${siteUrl}${localePath(locale, "/")}` });

    for (const page of pages) {
      entries.push({ url: `${siteUrl}${localePath(locale, `/${page.uid}`)}` });
    }
  }

  return entries;
}
