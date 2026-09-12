import * as prismic from "@prismicio/client";
import { prismicConfig } from "./config";
import { getRepositoryName } from "./repository";

type CreatePrismicClientOptions = prismic.ClientConfig & {
  repositoryName?: string;
};

export function createPrismicClient(options?: CreatePrismicClientOptions) {
  const { repositoryName: repositoryNameOverride, ...clientOptions } = options ?? {};

  return prismic.createClient(repositoryNameOverride ?? getRepositoryName(), {
    accessToken: prismicConfig.accessToken,
    routes: [...prismicConfig.routes],
    ...clientOptions,
  });
}
