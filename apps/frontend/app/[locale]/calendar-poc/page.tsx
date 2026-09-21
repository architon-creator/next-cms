import { CalendarPocClient } from "./calendar-poc-client";

// POC route only — proves packages/ui's MiniCalendar renders translated
// copy from the "Calendar" namespace this app merges into its own
// message catalog (see apps/frontend/i18n/messages.ts), without
// packages/ui itself owning any translation content. Not linked from
// any nav; visit /en/calendar-poc or /ja/calendar-poc directly.
export default function CalendarPocPage() {
  return (
    <div className="mx-auto flex max-w-[500px] flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Shared Calendar i18n POC</h1>
        <p className="text-sm text-muted-foreground">
          <code>MiniCalendar</code> lives in <code>packages/ui</code> and takes a{" "}
          <code>t</code> prop (a plain <code>TranslateFn</code>, no next-intl dependency) — this
          app calls <code>useTranslations(&quot;Calendar&quot;)</code> itself and passes the
          function straight through, no per-component label-mapping needed. The package ships
          default English copy (<code>calendarDefaultMessages</code>) for this app to merge into
          its own catalog, but never imports next-intl itself; see{" "}
          <code>mini-calendar.tsx</code>&apos;s comment for why.
        </p>
      </div>
      <CalendarPocClient />
    </div>
  );
}
