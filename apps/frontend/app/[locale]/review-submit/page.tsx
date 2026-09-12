import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppStepper } from "@/components/app-stepper";
import { RouteGuard } from "@/components/route-guard";
import { RouteProgressSync } from "@/components/route-progress-sync";

import { ReviewSubmitContent } from "./review-submit-content";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "ReviewSubmitPage" });
  return { title: t("title") };
}

export default async function ReviewSubmitPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "ReviewSubmitPage" });

  return (
    <RouteGuard stepId="review-submit">
      <RouteProgressSync stepId="review-submit" />
      <div className="mx-auto flex w-full max-w-[600px] flex-col gap-6 px-6 py-16">
        <AppStepper />
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <ReviewSubmitContent />
      </div>
    </RouteGuard>
  );
}
