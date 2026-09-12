import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ja"],
  defaultLocale: "en",
  // "as-needed": the default locale gets no URL prefix (/, /login), every
  // other locale does (/ja, /ja/login) — keeps existing English URLs
  // working unchanged rather than forcing everything under /en.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
