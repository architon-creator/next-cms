// Platform-neutral core: label service, Prismic client factory, label contract
// helpers. Safe for web AND React Native — no React DOM, no Next, no node:*.
//
//   cms/slices  → React slice components (web, depends on `ui`)
//   cms/next    → Next.js client helpers (@prismicio/next)
//   cms/node    → disk access: reading customtypes/, loading .env files

export * from "./prismic/label-contract";
export * from "./prismic/document-registry";
export * from "./prismic/config";
export * from "./prismic/create-client";
export * from "./services/label-service";

// Re-exported so the built .d.ts files reference a public type instead of a private chunk.
export type { AllDocumentTypes } from "../prismicio-types";
