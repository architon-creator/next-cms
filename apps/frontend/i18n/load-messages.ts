import path from "node:path";

import {
  createLabelContractFromCustomTypes,
  createLabelService,
  getServerLabelSource,
  type LabelSource,
} from "cms";

import { defaultLocale, locales, type AppLocale } from "../modules/utils/locales";
import { localMessages, type IBEMessages } from "./messages";

export type { LabelSource };

const customTypesRoot = path.resolve(process.cwd(), "../../packages/cms/customtypes");

const labelMessagesContract = createLabelContractFromCustomTypes<IBEMessages>({
  customTypesRoot,
  parentDocumentType: "app_labels",
});

const labelService = createLabelService<IBEMessages>({
  applicationName: "frontend",
  defaultLocale,
  locales,
  localMessages,
  labelContract: labelMessagesContract,
  parentDocumentType: "app_labels",
  prismicLocaleMap: {
    en: "en-us",
    ja: "ja-jp",
  },
});

// createLabelContractFromCustomTypes keys the contract by Prismic's (snake_case)
// custom type ids, e.g. "home_page" — but this app's next-intl namespaces (and
// en.json/ja.json) are PascalCase, e.g. "HomePage". The local-message path
// already returns PascalCase keys as-is; only the Prismic path needs remapping,
// so unrecognized keys are passed through unchanged.
const namespaceByDocumentType: Record<string, string> = {
  header: "Header",
  footer: "Footer",
  home_page: "HomePage",
  login_page: "LoginPage",
  login_form: "LoginForm",
  auth_nav: "AuthNav",
};

function toNamespacedMessages(messages: Record<string, unknown>): IBEMessages {
  return Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [namespaceByDocumentType[key] ?? key, value]),
  ) as IBEMessages;
}

export async function loadMessages(locale: AppLocale): Promise<IBEMessages> {
  const messages = await labelService.getLabels(locale);
  return toNamespacedMessages(messages);
}

export function resolveLocale(locale: string | undefined): AppLocale {
  return labelService.resolveLocale(locale) as AppLocale;
}

export { getServerLabelSource };
