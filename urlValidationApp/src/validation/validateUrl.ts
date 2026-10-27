export type ValidationError =
  | "empty"
  | "malformed"
  | "unsupported-protocol"
  | "invalid-host";

export type ValidationResult =
  | { valid: true; url: URL }
  | { valid: false; reason: ValidationError };

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

//DNS label
const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const DOMAIN_PATTERN = new RegExp(`^(?:${LABEL}\\.)+[a-z]{2,63}$`, "i");
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function isValidHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    IPV4_PATTERN.test(hostname) ||
    DOMAIN_PATTERN.test(hostname)
  );
}

export function validateUrl(input: string): ValidationResult {
  const value = input.trim();

  if (value === "") {
    return { valid: false, reason: "empty" };
  }
  if (/\s/.test(value)) {
    return { valid: false, reason: "malformed" };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    return { valid: false, reason: "malformed" };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { valid: false, reason: "unsupported-protocol" };
  }
  if (!isValidHost(url.hostname)) {
    return { valid: false, reason: "invalid-host" };
  }
  return { valid: true, url };
}

export const VALIDATION_MESSAGES: Record<ValidationError, string> = {
  empty: "",
  malformed: "This is not a valid URL. Example: https://example.com/docs",
  "unsupported-protocol": "Only http:// and https:// URLs are supported.",
  "invalid-host": "The host name is not valid (e.g. example.com or localhost).",
};
