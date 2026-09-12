"use client";

import { useLocale } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type AppLocale } from "@/modules/utils/locales";

const localeLabels: Record<AppLocale, string> = {
  en: "EN",
  ja: "JA",
};

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language">
      {locales.map((targetLocale) => (
        <button
          key={targetLocale}
          type="button"
          disabled={targetLocale === locale}
          aria-current={targetLocale === locale ? "true" : undefined}
          onClick={() => router.replace(pathname, { locale: targetLocale })}
          className="rounded px-2 py-1 text-sm font-medium text-muted-foreground no-underline hover:text-foreground disabled:cursor-default disabled:text-foreground"
        >
          {localeLabels[targetLocale]}
        </button>
      ))}
    </div>
  );
}
