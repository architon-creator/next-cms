"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button, Input, Label } from "ui";
import { cn } from "cn";

export function ContactForm() {
  const t = useTranslations("ContactPage");
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
        <Label htmlFor="name">{t("nameLabel")}</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Jane Doe"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">{t("messageLabel")}</Label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
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
