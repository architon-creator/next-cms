import { afterEach, describe, expect, it } from "vitest";
import { apiBaseUrl, SESSION_COOKIE } from "./session";

describe("apiBaseUrl", () => {
  const originalApiUrl = process.env.API_URL;

  afterEach(() => {
    process.env.API_URL = originalApiUrl;
  });

  it("falls back to localhost when API_URL is unset", () => {
    delete process.env.API_URL;
    expect(apiBaseUrl()).toBe("http://localhost:4000");
  });

  it("uses API_URL when set", () => {
    process.env.API_URL = "https://api.example.com";
    expect(apiBaseUrl()).toBe("https://api.example.com");
  });
});

describe("SESSION_COOKIE", () => {
  it("is a stable cookie name", () => {
    expect(SESSION_COOKIE).toBe("session");
  });
});
