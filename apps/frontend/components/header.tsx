import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { AuthNav } from "./auth-nav";
import { LanguageSwitcher } from "./language-switcher";

export function Header() {
  const t = useTranslations("Header");
  const navLinks = [{ href: "/", label: t("home") }];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-6 px-6">
        <Link href="/" className="text-base font-semibold text-foreground no-underline">
          {t("brand")}
        </Link>

        <nav className="flex flex-1 items-center gap-6" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground no-underline hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <LanguageSwitcher />
        <AuthNav />
      </div>
    </header>
  );
}
