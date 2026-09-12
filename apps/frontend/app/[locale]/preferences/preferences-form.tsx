"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button, Input, Label } from "ui";

import { useRouter } from "@/i18n/navigation";
import { preferencesSchema, type PreferencesValues } from "@/lib/schemas/preferences-schema";
import { nextStep, previousStep } from "@/lib/steps";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setPreferences } from "@/store/slices/form-data-slice";

export function PreferencesForm() {
  const t = useTranslations("StepNavigation");
  const tValidation = useTranslations("Validation");
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChangeFlow = searchParams.get("from") === "review";
  const saved = useAppSelector((state) => state.formData.preferences);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: saved ?? { contactMethod: "", notes: "" },
  });

  function onSubmit(values: PreferencesValues) {
    dispatch(setPreferences(values));
    router.push(isChangeFlow ? "/review-submit" : `/${nextStep("preferences")}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="contactMethod">Preferred Contact Method</Label>
        <Input
          id="contactMethod"
          {...register("contactMethod")}
          aria-invalid={errors.contactMethod ? true : undefined}
        />
        {errors.contactMethod && (
          <p role="alert" className="text-sm text-destructive">
            {tValidation("required")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" {...register("notes")} />
      </div>

      <div className="mt-2 flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => router.push(`/${previousStep("preferences")}`)}
        >
          {t("back")}
        </Button>
        <Button type="submit" size="lg" className="w-full">
          {isChangeFlow ? t("saveAndReturn") : t("next")}
        </Button>
      </div>
    </form>
  );
}
