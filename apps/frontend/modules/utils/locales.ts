export const locales = ["en", "ja"] as const;

export const defaultLocale: AppLocale = "en";

export type AppLocale = (typeof locales)[number];
