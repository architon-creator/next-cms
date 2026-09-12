import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "ui";

import { ContactForm } from "./contact-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ContactPage");
  return { title: t("title") };
}

export default async function ContactPage() {
  const t = await getTranslations("ContactPage");

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
