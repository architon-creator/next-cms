import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AppStepper } from "@/components/app-stepper";
import { RouteGuard } from "@/components/route-guard";
import { RouteProgressSync } from "@/components/route-progress-sync";

import { ReviewSubmitContent } from "./review-submit-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ReviewSubmitPage");
  return { title: t("title") };
}

export default async function ReviewSubmitPage() {
  const t = await getTranslations("ReviewSubmitPage");

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
