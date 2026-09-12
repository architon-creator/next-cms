"use client";

import { useTranslations } from "next-intl";

import { Button, Card, CardContent, CardHeader, CardTitle } from "ui";

import { Link } from "@/i18n/navigation";
import { DATA_STEP_ORDER, type DataStepId } from "@/lib/steps";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { confirmSection } from "@/store/slices/confirmations-slice";
import type { FormDataState } from "@/store/slices/form-data-slice";

// DataStepId (route-shaped, e.g. "personal-details") -> FormDataState /
// translation key (camelCase, e.g. "personalDetails") — the two casings
// exist because routes and next-intl namespace keys follow different
// conventions in this codebase.
const formDataKey: Record<DataStepId, keyof FormDataState> = {
  "personal-details": "personalDetails",
  "contact-info": "contactInfo",
  preferences: "preferences",
  documents: "documents",
};

function SectionSummary({ data }: { data: Record<string, unknown> | null }) {
  if (!data) {
    return <p className="text-sm text-muted-foreground">Not entered yet.</p>;
  }

  return (
    <dl className="flex flex-col gap-1 text-sm">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="text-foreground">{String(value || "—")}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewSubmitContent() {
  const t = useTranslations("ReviewSubmitPage");
  const tStepper = useTranslations("Stepper");
  const dispatch = useAppDispatch();
  const formData = useAppSelector((state) => state.formData);
  const confirmations = useAppSelector((state) => state.confirmations);

  const allConfirmed = DATA_STEP_ORDER.every((step) => confirmations[step]);

  function handleSubmit() {
    // No backend in this dummy flow — final Submit is a client-side
    // terminal action only, per the requirement doc's scope.
  }

  return (
    <div className="flex flex-col gap-4">
      {DATA_STEP_ORDER.map((step) => {
        const isConfirmed = confirmations[step];

        return (
          <Card key={step}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{tStepper(formDataKey[step])}</CardTitle>
              {isConfirmed && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {t("confirmedBadge")}
                </span>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SectionSummary data={formData[formDataKey[step]]} />
              <div className="flex gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant={isConfirmed ? "outline" : "default"}
                  disabled={isConfirmed}
                  onClick={() => dispatch(confirmSection(step))}
                >
                  {t("confirmSection")}
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={`/${step}?from=review`}>{t("changeSection")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button type="button" size="lg" disabled={!allConfirmed} onClick={handleSubmit} className="mt-2">
        {t("submit")}
      </Button>
    </div>
  );
}
