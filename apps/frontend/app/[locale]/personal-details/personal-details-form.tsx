"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button, Input, Label } from "ui";

import { useRouter } from "@/i18n/navigation";
import {
  personalDetailsSchema,
  type PersonalDetailsValues,
} from "@/lib/schemas/personal-details-schema";
import { nextStep } from "@/lib/steps";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setPersonalDetails } from "@/store/slices/form-data-slice";

export function PersonalDetailsForm() {
  const t = useTranslations("StepNavigation");
  const tValidation = useTranslations("Validation");
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChangeFlow = searchParams.get("from") === "review";
  const saved = useAppSelector((state) => state.formData.personalDetails);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalDetailsValues>({
    resolver: zodResolver(personalDetailsSchema),
    defaultValues: saved ?? { fullName: "", dateOfBirth: "" },
  });

  function onSubmit(values: PersonalDetailsValues) {
    dispatch(setPersonalDetails(values));
    router.push(isChangeFlow ? "/review-submit" : `/${nextStep("personal-details")}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          {...register("fullName")}
          aria-invalid={errors.fullName ? true : undefined}
        />
        {errors.fullName && (
          <p role="alert" className="text-sm text-destructive">
            {tValidation("required")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dateOfBirth">Date of Birth</Label>
        <Input
          id="dateOfBirth"
          type="date"
          {...register("dateOfBirth")}
          aria-invalid={errors.dateOfBirth ? true : undefined}
        />
        {errors.dateOfBirth && (
          <p role="alert" className="text-sm text-destructive">
            {tValidation("required")}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full">
        {isChangeFlow ? t("saveAndReturn") : t("next")}
      </Button>
    </form>
  );
}
