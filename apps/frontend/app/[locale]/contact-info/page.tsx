import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AppStepper } from "@/components/app-stepper";
import { RouteGuard } from "@/components/route-guard";
import { RouteProgressSync } from "@/components/route-progress-sync";

import { ContactInfoForm } from "./contact-info-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ContactInfoPage");
  return { title: t("title") };
}

export default async function ContactInfoPage() {
  const t = await getTranslations("ContactInfoPage");

  return (
    <RouteGuard stepId="contact-info">
      <RouteProgressSync stepId="contact-info" />
      <div className="mx-auto flex w-full max-w-[500px] flex-col gap-6 px-6 py-16">
        <AppStepper />
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <ContactInfoForm />
      </div>
    </RouteGuard>
  );
}
