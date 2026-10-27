import { describe, it, expect } from "vitest";
import { validateUrl } from "./validateUrl";

describe("validateUrl", () => {
  it.each([
    "https://example.com",
    "http://example.com/",
    "https://sub.example.co.uk/path/to/file.txt?q=1#top",
    "https://example.com/docs/",
    "http://localhost:5173/api",
    "http://127.0.0.1:8080/",
    "  https://example.com  ",
  ])("accepts %s", (input) => {
    const result = validateUrl(input);
    expect(result.valid).toBe(true);
  });
  it("returns the parsed URL when valid", () => {
    const result = validateUrl("https://example.com/docs/readme.md");
    expect(result.valid && result.url.pathname).toBe("/docs/readme.md");
  });

  it.each(["", "   "])("reports empty input for %j", (input) => {
    expect(validateUrl(input)).toEqual({ valid: false, reason: "empty" });
  });

  it.each([
    "example.com",
    "https://",
    "not a url",
    "https://exa mple.com",
    "https://example.com/a b",
    "http://999.1.1.1",
  ])("reports malformed for %j", (input) => {
    expect(validateUrl(input)).toEqual({ valid: false, reason: "malformed" });
  });

  it.each(["ftp://example.com", "javascript:alert(1)", "file:///C:/temp"])(
    "reports unsupported protocol for %j",
    (input) => {
      expect(validateUrl(input)).toEqual({
        valid: false,
        reason: "unsupported-protocol",
      });
    },
  );

  it.each([
    "https://example",
    "https://-bad.com",
    "https://bad-.com",
    "https://exa_mple.com",
    "https://example.c",
  ])("reports invalid host for %j", (input) => {
    expect(validateUrl(input)).toEqual({
      valid: false,
      reason: "invalid-host",
    });
  });
});
