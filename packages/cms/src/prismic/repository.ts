import { prismicConfig } from "./config.js";

export function getRepositoryName() {
    if (!prismicConfig.repositoryName) {
        throw new Error("PRISMIC_REPOSITORY_NAME is required to create a client");
    }

    return prismicConfig.repositoryName;
}
