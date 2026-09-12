import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations("Footer");
  const footerLinks = [
    { href: "/", label: t("home") },
    { href: "/login", label: t("signIn") },
  ];

  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>

        <nav className="flex items-center gap-6" aria-label="Footer">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground no-underline hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
