import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function isMainModule() {
  return process.argv[1]
    ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
    : false;
}

/**
 * Local demo adaptation of the real project's generate-prismic-models.ts
 * (see ./generate-prismic-models.ts for the verbatim baseline copy) — NOT
 * the same script, and deliberately kept separate: the real one is
 * hardcoded to that project's apps/top-app + apps/ibe-app message folders
 * and its `@repo/cms/prismic` package alias, neither of which exist here.
 *
 * This version reads THIS repo's apps/frontend/messages/en.json (the
 * next-intl message file) and turns each top-level namespace
 * (Header, Footer, HomePage, ...) into one Prismic custom type — one flat
 * Text field per string key. It exists to demonstrate the underlying
 * concept end-to-end in this repo.
 *
 * Writes into the real customtypes/ folder as customtypes/<id>/index.json
 * — the same folder-per-type shape "content_page" already uses — so
 * these are immediately ready to push with the Prismic CLI. None of the
 * generated ids (header, footer, home_page, login_page, login_form,
 * auth_nav) collide with the real "content_page" type, so this only ever
 * adds sibling folders alongside it.
 *
 * Also generates a "hub" custom type (HUB_TYPE_ID below) with one Link
 * field per namespace type, mirroring the real project's "ibe" parent
 * document — packages/cms/src/services/label-service.ts (the baseline,
 * unmodified copy of the real label-fetching mechanism) fetches labels
 * by reading this parent's Link fields to find each child document's id,
 * not by querying each child type directly. Without this hub,
 * label-service.ts's real mechanism has nothing to fetch through.
 */

export const HUB_TYPE_ID = "app_labels";

type PrismicField = { type: "Text"; config: { label: string } };

type PrismicLinkField = {
  type: "Link";
  config: { label: string; select: "document"; customtypes: string[] };
};

type PrismicModel = {
  id: string;
  label: string;
  format: "custom";
  repeatable: false;
  status: true;
  json: {
    Main: Record<string, PrismicField>;
  };
};

type HubModel = {
  id: string;
  label: string;
  format: "custom";
  repeatable: false;
  status: true;
  json: {
    Main: Record<string, PrismicLinkField>;
  };
};

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const messagesPath = path.resolve(
  scriptDirectory,
  "../../../apps/frontend/messages/en.json",
);
const outputRoot = path.resolve(scriptDirectory, "../customtypes");

function main() {
  const messages = JSON.parse(readFileSync(messagesPath, "utf8")) as Record<
    string,
    unknown
  >;
  const namespaces: string[] = [];
  let generated = 0;

  for (const [namespace, fields] of Object.entries(messages)) {
    if (!isPlainObject(fields)) {
      continue;
    }

    writeModel(namespace, createModel(namespace, fields));
    namespaces.push(namespace);
    generated += 1;
  }

  writeHubModel(namespaces);
  generated += 1;

  console.log(
    `Generated ${generated} custom type model(s) (including the "${HUB_TYPE_ID}" hub) from ${messagesPath} into ${outputRoot}`,
  );
}

function createHubModel(namespaces: string[]): HubModel {
  const linkFields: Record<string, PrismicLinkField> = {};

  for (const namespace of namespaces) {
    const modelId = toModelId(namespace);
    linkFields[modelId] = {
      type: "Link",
      config: {
        label: toReadableLabel(namespace),
        select: "document",
        customtypes: [modelId],
      },
    };
  }

  return {
    id: HUB_TYPE_ID,
    label: "App Labels",
    format: "custom",
    repeatable: false,
    status: true,
    json: { Main: linkFields },
  };
}

function writeHubModel(namespaces: string[]) {
  const model = createHubModel(namespaces);
  const outputDirectory = path.join(outputRoot, HUB_TYPE_ID);

  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    path.join(outputDirectory, "index.json"),
    `${JSON.stringify(model, null, 2)}\n`,
  );
}

function createModel(namespace: string, fields: Record<string, unknown>): PrismicModel {
  const modelFields: Record<string, PrismicField> = {};

  for (const key of Object.keys(fields)) {
    modelFields[key] = {
      type: "Text",
      config: { label: toReadableLabel(key) },
    };
  }

  return {
    id: toModelId(namespace),
    label: toReadableLabel(namespace),
    format: "custom",
    repeatable: false,
    status: true,
    json: { Main: modelFields },
  };
}

function writeModel(namespace: string, model: PrismicModel) {
  const outputDirectory = path.join(outputRoot, toModelId(namespace));

  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    path.join(outputDirectory, "index.json"),
    `${JSON.stringify(model, null, 2)}\n`,
  );
}

function toModelId(namespace: string): string {
  return namespace
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function toReadableLabel(value: string): string {
  return toModelId(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

if (isMainModule()) {
  main();
}
