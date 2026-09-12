import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppStepper } from "@/components/app-stepper";
import { RouteGuard } from "@/components/route-guard";
import { RouteProgressSync } from "@/components/route-progress-sync";

import { ContactInfoForm } from "./contact-info-form";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "ContactInfoPage" });
  return { title: t("title") };
}

export default async function ContactInfoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "ContactInfoPage" });

  return (
    <RouteGuard stepId="contact-info">
      <RouteProgressSync stepId="contact-info" />
      <div className="mx-auto flex w-full max-w-[500px] flex-col gap-6 px-6 py-16">
        <AppStepper />
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        {/* useSearchParams() in the form needs a Suspense boundary to stay
            statically prerenderable — without it Next 16 hard-fails the build. */}
        <Suspense>
          <ContactInfoForm />
        </Suspense>
      </div>
    </RouteGuard>
  );
}
