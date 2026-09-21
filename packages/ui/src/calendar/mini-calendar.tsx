"use client";

import * as React from "react";
import { cn } from "cn";
import { Button } from "../button";
import type { TranslateFn } from "../i18n/translate-fn";

/**
 * POC for sharing a UI component across apps that each own their own
 * translations. This does NOT call next-intl's useTranslations() itself
 * — an earlier version did, and broke at runtime ("the context from
 * NextIntlClientProvider was not found") even after pinning React to a
 * single version workspace-wide. Root cause, confirmed by diffing pnpm's
 * resolved store paths: next-intl (and next itself) still resolved to
 * genuinely different peer-qualified instances for packages/ui vs. the
 * consuming app, because packages/ui's dependency graph doesn't (and
 * shouldn't need to) mirror an app's full peer tree just to make one
 * shared component's Context identity match. Two different next-intl
 * module instances means two different React Context objects — a
 * provider from one is invisible to a hook from the other.
 *
 * So: this takes a `t: TranslateFn` prop and calls it directly
 * (t("today"), t("selected", { date })) instead of calling
 * useTranslations() itself — no cross-package Context dependency, so no
 * instance-mismatch class of bug is possible here, and it scales to many
 * components without a bespoke labels-mapping object per call site (see
 * ../i18n/translate-fn.ts). The consuming app calls
 * useTranslations("Calendar") itself and passes the result straight
 * through — see
 * apps/frontend/app/[locale]/calendar-poc/calendar-poc-client.tsx.
 *
 * The "Calendar" namespace's actual copy (today/clear/selected/none)
 * lives directly in that app's own messages/en.json — packages/ui
 * doesn't ship default copy for it. That's a real tradeoff, not just a
 * simplification: with only one consumer today, inlining is less
 * indirection; a second consumer (e.g. admin-app) would need to copy
 * these same keys into its own message file by hand, with nothing
 * keeping the two in sync if this component's expected keys ever
 * change. Revisit (re-add a shipped default-messages export, like this
 * component had before) if/when a second real consumer shows up.
 */
export function MiniCalendar({
  value,
  onChange,
  t,
  className,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  t: TranslateFn;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-col gap-2 rounded-lg border border-border p-3", className)}>
      <p className="text-sm text-muted-foreground">
        {value ? t("selected", { date: value.toLocaleDateString() }) : t("none")}
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onChange(new Date())}>
          {t("today")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onChange(undefined)}>
          {t("clear")}
        </Button>
      </div>
    </div>
  );
}
