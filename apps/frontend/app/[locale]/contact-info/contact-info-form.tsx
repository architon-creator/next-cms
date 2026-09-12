"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button, Input, Label } from "ui";

import { useRouter } from "@/i18n/navigation";
import { contactInfoSchema, type ContactInfoValues } from "@/lib/schemas/contact-info-schema";
import { nextStep, previousStep } from "@/lib/steps";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setContactInfo } from "@/store/slices/form-data-slice";

export function ContactInfoForm() {
  const t = useTranslations("StepNavigation");
  const tValidation = useTranslations("Validation");
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChangeFlow = searchParams.get("from") === "review";
  const saved = useAppSelector((state) => state.formData.contactInfo);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactInfoValues>({
    resolver: zodResolver(contactInfoSchema),
    defaultValues: saved ?? { email: "", phone: "" },
  });

  function onSubmit(values: ContactInfoValues) {
    dispatch(setContactInfo(values));
    router.push(isChangeFlow ? "/review-submit" : `/${nextStep("contact-info")}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          aria-invalid={errors.email ? true : undefined}
        />
        {errors.email && (
          <p role="alert" className="text-sm text-destructive">
            {tValidation("invalidEmail")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" {...register("phone")} aria-invalid={errors.phone ? true : undefined} />
        {errors.phone && (
          <p role="alert" className="text-sm text-destructive">
            {tValidation("invalidPhone")}
          </p>
        )}
      </div>

      <div className="mt-2 flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => router.push(`/${previousStep("contact-info")}`)}
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
