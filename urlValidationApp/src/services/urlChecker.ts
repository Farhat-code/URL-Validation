import {
  mockServer,
  type CheckResult,
  type MockServer,
} from "../mock/mockServer";
import { throttle } from "../utils/throttle";
import { validateUrl, type ValidationError } from "../validation/validateUrl";

export type CheckerState =
  | { status: "idle" }
  | { status: "invalid"; reason: Exclude<ValidationError, "empty"> }
  | { status: "checking"; url: string }
  | { status: "done"; url: string; result: CheckResult }
  | { status: "error"; url: string; message: string };

export interface UrlCheckerOptions {
  onChange: (state: CheckerState) => void;
  server?: MockServer;
  throttleMs?: number;
}

export interface UrlChecker {
  update(input: string): void;
  dispose(): void;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function createUrlChecker({
  onChange,
  server = mockServer,
  throttleMs = 500,
}: UrlCheckerOptions): UrlChecker {
  let currentHref: string | null = null;
  let latestRequestId = 0;
  let controller: AbortController | null = null;

  const invalidateInFlight = () => {
    latestRequestId++;
    controller?.abort();
    controller = null;
  };

  const runCkeck = async (url: URL) => {
    invalidateInFlight();
    const requestId = latestRequestId;
    const ownController = new AbortController();
    controller = ownController;

    try {
      const result = await server.checkUrl(url, {
        signal: ownController.signal,
      });
      if (requestId !== latestRequestId) return;
      onChange({ status: "done", url: url.href, result });
    } catch (error) {
      if (requestId !== latestRequestId || isAbortError(error)) return;
      currentHref = null;
      onChange({
        status: "error",
        url: url.href,
        message: "Could not check the URL. Please try again",
      });
    } finally {
      if (controller === ownController) controller = null;
    }
  };

  const throttledCheck = throttle((url: URL) => {
    void runCkeck(url);
  }, throttleMs);

  return {
    update(input) {
      const validation = validateUrl(input);

      if (!validation.valid) {
        currentHref = null;
        throttledCheck.cancel();
        invalidateInFlight();
        onChange(
          validation.reason === "empty"
            ? { status: "idle" }
            : { status: "invalid", reason: validation.reason },
        );
        return;
      }

      const { url } = validation;
      if (url.href === currentHref) return;

      currentHref = url.href;
      invalidateInFlight();
      onChange({ status: "checking", url: url.href });
      throttledCheck(url);
    },

    dispose() {
      currentHref = null;
      throttledCheck.cancel();
      invalidateInFlight();
    },
  };
}
