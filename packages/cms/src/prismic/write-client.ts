import * as prismic from "@prismicio/client";
import { prismicConfig } from "./config.js";
import { getRepositoryName } from "./repository.js";

type CreatePrismicWriteClientOptions = prismic.ClientConfig & {
    repositoryName?: string;
    writeToken?: string;
};

export function createPrismicWriteClient(options?: CreatePrismicWriteClientOptions) {
    const {
        repositoryName: repositoryNameOverride,
        writeToken,
        accessToken: accessTokenOverride,
        ...clientOptions
    } = options ?? {};
    const resolvedWriteToken = writeToken ?? process.env.PRISMIC_WRITE_TOKEN;

    if (!resolvedWriteToken) {
        throw new Error("PRISMIC_WRITE_TOKEN is required to seed Prismic content");
    }

    return prismic.createWriteClient(repositoryNameOverride ?? getRepositoryName(), {
        accessToken: accessTokenOverride ?? prismicConfig.accessToken,
        routes: [...prismicConfig.routes],
        writeToken: resolvedWriteToken,
        ...clientOptions,
    });
}

export function createPrismicMigration() {
    return prismic.createMigration();
}
