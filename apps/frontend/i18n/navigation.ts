import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Locale-aware drop-in replacements for next/link and next/navigation —
// Link/redirect/useRouter automatically prepend the current locale, and
// usePathname automatically strips it back off. Every component that
// navigates client-side should import from here instead of next/navigation
// directly, or a push/redirect silently drops the user's locale.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
