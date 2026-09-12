"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button, Input, Label } from "ui";

import { useRouter } from "@/i18n/navigation";
import { documentsSchema, type DocumentsValues } from "@/lib/schemas/documents-schema";
import { previousStep } from "@/lib/steps";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setDocuments } from "@/store/slices/form-data-slice";

export function DocumentsForm() {
  const t = useTranslations("StepNavigation");
  const tValidation = useTranslations("Validation");
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isChangeFlow = searchParams.get("from") === "review";
  const saved = useAppSelector((state) => state.formData.documents);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DocumentsValues>({
    resolver: zodResolver(documentsSchema),
    defaultValues: saved ?? { documentType: "", documentNumber: "" },
  });

  function onSubmit(values: DocumentsValues) {
    dispatch(setDocuments(values));
    // Documents is the last data-entry step — both flows land on
    // review-submit; only the button label distinguishes them.
    router.push("/review-submit");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="documentType">Document Type</Label>
        <Input
          id="documentType"
          {...register("documentType")}
          aria-invalid={errors.documentType ? true : undefined}
        />
        {errors.documentType && (
          <p role="alert" className="text-sm text-destructive">
            {tValidation("required")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="documentNumber">Document Number</Label>
        <Input
          id="documentNumber"
          {...register("documentNumber")}
          aria-invalid={errors.documentNumber ? true : undefined}
        />
        {errors.documentNumber && (
          <p role="alert" className="text-sm text-destructive">
            {tValidation("required")}
          </p>
        )}
      </div>

      <div className="mt-2 flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => router.push(`/${previousStep("documents")}`)}
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
