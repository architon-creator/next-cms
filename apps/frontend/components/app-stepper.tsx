"use client";

import { useTranslations } from "next-intl";

import { Stepper, type StepperStep } from "ui";

import { useAppSelector } from "@/store/hooks";
import { STEP_ORDER } from "@/lib/steps";

export function AppStepper() {
  const t = useTranslations("Stepper");
  const current = useAppSelector((state) => state.progress.current);
  const visited = useAppSelector((state) => state.progress.visited);

  const labelByStep: Record<(typeof STEP_ORDER)[number], string> = {
    "personal-details": t("personalDetails"),
    "contact-info": t("contactInfo"),
    preferences: t("preferences"),
    documents: t("documents"),
    "review-submit": t("reviewSubmit"),
  };

  const steps: StepperStep[] = STEP_ORDER.map((id) => ({
    id,
    label: labelByStep[id],
  }));

  return <Stepper steps={steps} current={current} visited={visited} />;
}
