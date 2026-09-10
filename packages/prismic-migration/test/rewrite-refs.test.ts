import { describe, expect, it } from "vitest";
import {
  findUnresolvedAssetLinks,
  findUnresolvedDocumentLinks,
  rewriteRefs,
} from "../src/lib/rewrite-refs.js";

describe("rewriteRefs", () => {
  it("rewrites a Link-to-Media field's id and url using assetIds", () => {
    const data = {
      hero: { link_type: "Media", id: "dev-asset-1", url: "https://dev/x.png" },
    };
    const result = rewriteRefs(data, {
      assetIds: { "dev-asset-1": { id: "sit-asset-1", url: "https://sit/x.png" } },
    });
    expect(result.hero.id).toBe("sit-asset-1");
    expect(result.hero.url).toBe("https://sit/x.png");
  });

  it("rewrites a plain Image field's id and url (no link_type at all)", () => {
    // The shape a real repository actually returned — confirmed via
    // `inspect` after a real "Assets not found" failure traced back to
    // this field shape never being recognized.
    const data = {
      hero: {
        dimensions: { width: 100, height: 50 },
        alt: null,
        copyright: null,
        url: "https://dev/x.png",
        id: "dev-asset-1",
        edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
      },
    };
    const result = rewriteRefs(data, {
      assetIds: { "dev-asset-1": { id: "sit-asset-1", url: "https://sit/x.png" } },
    });
    expect(result.hero.id).toBe("sit-asset-1");
    expect(result.hero.url).toBe("https://sit/x.png");
  });

  it("leaves an Image field's url untouched when the map entry has none", () => {
    const data = { hero: { dimensions: { width: 1, height: 1 }, url: "https://dev/x.png", id: "dev-asset-1" } };
    const result = rewriteRefs(data, { assetIds: { "dev-asset-1": { id: "sit-asset-1" } } });
    expect(result.hero.id).toBe("sit-asset-1");
    expect(result.hero.url).toBe("https://dev/x.png");
  });

  it("rewrites a Document link id using documentIds", () => {
    const data = { related: { link_type: "Document", id: "dev-doc-1" } };
    const result = rewriteRefs(data, { documentIds: { "dev-doc-1": "sit-doc-1" } });
    expect(result.related.id).toBe("sit-doc-1");
  });

  it("leaves an id untouched when it has no entry in the map (placeholder behavior)", () => {
    const data = { related: { link_type: "Document", id: "dev-doc-unknown" } };
    const result = rewriteRefs(data, { documentIds: {} });
    expect(result.related.id).toBe("dev-doc-unknown");
  });

  it("rewrites refs nested inside slice zones and arrays", () => {
    const data = {
      slices: [
        {
          slice_type: "gallery",
          items: [{ image: { link_type: "Media", id: "dev-asset-1" } }],
        },
      ],
    };
    const result = rewriteRefs(data, { assetIds: { "dev-asset-1": { id: "sit-asset-1" } } });
    expect(result.slices[0].items[0].image.id).toBe("sit-asset-1");
  });

  it("does not mutate the input", () => {
    const data = { related: { link_type: "Document", id: "dev-doc-1" } };
    rewriteRefs(data, { documentIds: { "dev-doc-1": "sit-doc-1" } });
    expect(data.related.id).toBe("dev-doc-1");
  });
});

describe("findUnresolvedDocumentLinks", () => {
  it("flags a Document link id absent from the known set", () => {
    const data = { related: { link_type: "Document", id: "dev-doc-leftover" } };
    expect(findUnresolvedDocumentLinks(data, new Set(["sit-doc-1"]))).toEqual([
      "dev-doc-leftover",
    ]);
  });

  it("returns nothing when every link resolves", () => {
    const data = { related: { link_type: "Document", id: "sit-doc-1" } };
    expect(findUnresolvedDocumentLinks(data, new Set(["sit-doc-1"]))).toEqual([]);
  });
});

describe("findUnresolvedAssetLinks", () => {
  it("flags a Media link id absent from the known asset set", () => {
    const data = { hero: { link_type: "Media", id: "dev-asset-leftover" } };
    expect(findUnresolvedAssetLinks(data, new Set(["sit-asset-1"]))).toEqual([
      "dev-asset-leftover",
    ]);
  });

  it("flags a plain Image field's id absent from the known asset set", () => {
    const data = {
      hero: { dimensions: { width: 1, height: 1 }, url: "https://dev/x.png", id: "dev-asset-leftover" },
    };
    expect(findUnresolvedAssetLinks(data, new Set(["sit-asset-1"]))).toEqual([
      "dev-asset-leftover",
    ]);
  });
});
