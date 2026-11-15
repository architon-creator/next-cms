"use client";

import { Button, Input } from "ui";
import { APP_KEYS, clearApps } from "app-state";
import { useLocale } from "next-intl";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSearchQuery } from "@/store/slices/search-slice";
import { persistor } from "@/store/store";

// App 1's half of the demo (the SEARCH app). App 2 is apps/booking-app, served under
// /booking on the same origin (dev: proxied by next.config.mjs; prod: the platform).
//
// Pressing Search:
//   1. clears the BOOKING app's data (saved copy + live store if open in another tab),
//      keeping THIS app's search form, because clearApps never touches the caller;
//   2. goes to the booking app with a FULL page load. The two apps are separate Next
//      builds, so next/link or next-intl's router.push (client-side navigation inside
//      app 1) cannot land in app 2 — that is why it must be window.location.
export function StoreResetDemoClient() {
  const dispatch = useAppDispatch();
  const locale = useLocale();
  const search = useAppSelector((state) => state.search);

  async function handleSearch() {
    clearApps([APP_KEYS.booking]);

    // redux-persist writes asynchronously: flush so the latest search text is saved
    // before the page unloads.
    await persistor.flush();

    window.location.assign(`/booking/${locale}`);
  }

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Type a search and press Search. The booking app&apos;s previous data is deleted, your
        search is kept, and you land in the booking app. Come back to see the search text still
        there.
      </p>

      <form
        className="flex gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSearch();
        }}
      >
        <Input
          value={search.query}
          onChange={(event) => dispatch(setSearchQuery(event.target.value))}
          placeholder="Where to?"
          aria-label="Search"
          className="h-11 flex-1 text-base"
        />
        <Button type="submit" size="lg" className="h-11 px-6">
          Search
        </Button>
      </form>

      <pre className="overflow-auto rounded-lg border border-border bg-muted p-4 text-xs">
        {JSON.stringify({ search }, null, 2)}
      </pre>
    </section>
  );
}
