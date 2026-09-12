import { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PrismicPreview } from "@prismicio/next";

import { repositoryName } from "cms";

import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ReduxProvider } from "@/components/redux-provider";

import "../globals.css";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // Required here too (not just in the layout component below) — next-intl
  // needs setRequestLocale called in every function that reads the locale
  // for a route to stay statically rendered instead of forced dynamic.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "HomePage" });

  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: t("title"), template: `%s | ${t("title")}` },
    description: t("description"),
  };
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
          <ReduxProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </ReduxProvider>
        </NextIntlClientProvider>
        <PrismicPreview repositoryName={repositoryName} />
      </body>
    </html>
  );
}
