import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "ui";

import { ContactForm } from "./contact-form";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  // Required in both this function and the page component below — next-intl
  // needs setRequestLocale called wherever the locale is read for a route to
  // stay statically rendered instead of forced dynamic.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "ContactPage" });
  return { title: t("title") };
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "ContactPage" });

  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="mb-1 text-3xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>{t("cardTitle")}</CardTitle>
          <CardDescription>{t("cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ContactForm />
        </CardContent>
      </Card>
    </div>
  );
}
