import path from "node:path";

import {
  createLabelContractFromCustomTypes,
  createLabelService,
  getServerLabelSource,
  tabNameToNamespace,
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
//
// Derived from localMessages via the same slugifier the custom-type generator
// uses (generate-prismic-models-demo.ts's toModelId), rather than hand-listed,
// so a new namespace added to en.json is picked up automatically the next
// time the generator and this map both run off the same source of truth.
const namespaceByDocumentType: Record<string, string> = Object.fromEntries(
  Object.keys(localMessages.en).map((namespace) => [tabNameToNamespace(namespace), namespace]),
);

function toNamespacedMessages(messages: Record<string, unknown>): IBEMessages {
  return Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [namespaceByDocumentType[key] ?? key, value]),
  ) as IBEMessages;
}

export async function loadMessages(locale: AppLocale): Promise<IBEMessages> {
  const messages = await labelService.getLabels(locale);

  // When LABEL_SOURCE=prismic, labelService's result only ever contains
  // namespaces with a matching Prismic custom type — any namespace that's
  // deliberately local-only (not modeled in packages/cms/customtypes, e.g.
  // the stepper flow's copy) would be entirely absent, not just falling
  // back to a key placeholder. Local messages are the base for every
  // namespace; Prismic-backed namespaces are overlaid on top of it.
  return { ...(localMessages[locale] ?? localMessages.en), ...toNamespacedMessages(messages) };
}

export function resolveLocale(locale: string | undefined): AppLocale {
  return labelService.resolveLocale(locale) as AppLocale;
}

export { getServerLabelSource };
