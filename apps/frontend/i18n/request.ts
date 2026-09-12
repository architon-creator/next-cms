import { getRequestConfig } from "next-intl/server";

import { loadMessages, resolveLocale } from "./load-messages";

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale comes from the [locale] route segment via middleware —
  // still awaited defensively per next-intl's own guidance, since it can
  // resolve asynchronously during static rendering.
  const requested = await requestLocale;
  const locale = resolveLocale(requested);

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
