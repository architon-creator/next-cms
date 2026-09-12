import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { PrismicPreview } from "@prismicio/next";

import { repositoryName } from "cms";

import { routing } from "@/i18n/routing";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

import "../globals.css";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this locale — without it every page under
  // this layout would be forced dynamic just because the locale is read.
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      {/* Column layout so Footer's `mt-auto` pins it to the bottom on short pages. */}
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
        <PrismicPreview repositoryName={repositoryName} />
      </body>
    </html>
  );
}
