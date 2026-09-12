// Falls back to localhost so metadataBase/robots/sitemap still resolve to a
// valid absolute URL in dev when NEXT_PUBLIC_SITE_URL isn't set.
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
