import { defineRouting } from "next-intl/routing";

import { defaultLocale, locales, type AppLocale } from "../modules/utils/locales";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // "as-needed": the default locale gets no URL prefix (/, /login), every
  // other locale does (/ja, /ja/login) — keeps existing English URLs
  // working unchanged rather than forcing everything under /en.
  localePrefix: "as-needed",
});

export type Locale = AppLocale;
