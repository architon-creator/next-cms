import { describe, expect, it } from "vitest";
import { formatLabel } from "./format-label";

describe("formatLabel", () => {
  it("capitalizes each hyphen-separated word", () => {
    expect(formatLabel("special-assistance")).toBe("Special Assistance");
  });

  it("handles a single-word uid", () => {
    expect(formatLabel("faq")).toBe("Faq");
  });

  it("handles a longer multi-word uid", () => {
    expect(formatLabel("where-does-zipair-fly-to")).toBe("Where Does Zipair Fly To");
  });
});
