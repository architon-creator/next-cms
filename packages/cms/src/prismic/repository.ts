import { prismicConfig } from "./config";

export function getRepositoryName() {
  if (!prismicConfig.repositoryName) {
    throw new Error("PRISMIC_REPOSITORY_NAME is required to create a client");
  }

  return prismicConfig.repositoryName;
}
