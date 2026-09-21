"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MiniCalendar } from "ui";

export function CalendarPocClient() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const t = useTranslations("Calendar");

  return <MiniCalendar value={date} onChange={setDate} t={t} />;
}
