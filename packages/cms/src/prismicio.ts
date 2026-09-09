import * as prismic from "@prismicio/client";
import * as prismicNext from "@prismicio/next";

export const repositoryName =
  process.env.NEXT_PUBLIC_PRISMIC_ENVIRONMENT || "next-js-ssr";

const routes: prismic.ClientConfig["routes"] = [{ type: "content_page", path: "/:uid" }];

export function createClient(config: prismicNext.CreateClientConfig = {}) {
  const client = prismic.createClient(repositoryName, {
    routes,
    accessToken: process.env.PRISMIC_ACCESS_TOKEN,
    fetchOptions:
      process.env.NODE_ENV === "production"
        ? { next: { tags: ["prismic"] }, cache: "force-cache" }
        : { next: { revalidate: 5 } },
    ...config,
  });

  prismicNext.enableAutoPreviews({ client, previewData: config.previewData });

  return client;
}
