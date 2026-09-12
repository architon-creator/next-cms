import localEn from "@/messages/en.json";
import localJa from "@/messages/ja.json";

import type { AppLocale } from "../modules/utils/locales";

export type IBEMessages = typeof localEn;

export const localMessages = {
  en: localEn,
  ja: localJa,
} satisfies Partial<Record<AppLocale, IBEMessages>>;
