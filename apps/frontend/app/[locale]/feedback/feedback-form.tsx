"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button, Input, Label } from "ui";
import { cn } from "cn";

const ratings = ["Excellent", "Good", "Okay", "Poor"];

export function FeedbackForm() {
  const t = useTranslations("FeedbackPage");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("successMessage")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-foreground">
          {t("ratingLabel")}
        </legend>
        {ratings.map((rating, index) => (
          <label key={rating} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="radio"
              name="rating"
              value={rating}
              defaultChecked={index === 0}
              className="h-4 w-4 accent-primary"
            />
            {rating}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="comments">{t("commentsLabel")}</Label>
        <textarea
          id="comments"
          name="comments"
          rows={4}
          className={cn(
            "flex w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none",
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        />
      </div>

      <Button type="submit" size="lg" className="mt-2 w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
