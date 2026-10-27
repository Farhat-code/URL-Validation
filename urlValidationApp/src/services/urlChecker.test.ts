import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createUrlChecker, type CheckerState } from "./urlChecker";
import {
  createMockServer,
  type CheckResult,
  type MockServer,
} from "../mock/mockServer";

const THROTTLE = 500;
const URL_A = "https://example.com/docs";
const URL_B = "https://example.com/docs/readme.md";

interface PendingCall {
  url: string;
  signal?: AbortSignal;
  resolve: (result: CheckResult) => void;
  reject: (error: unknown) => void;
}

function createControllableServer() {
  const calls: PendingCall[] = [];
  const server: MockServer = {
    checkUrl(url, { signal } = {}) {
      return new Promise<CheckResult>((resolve, reject) => {
        calls.push({ url: url.href, signal, resolve, reject });
      });
    },
  };
  return { server, calls };
}

function setup(server?: MockServer) {
  const controllable = createControllableServer();
  const onChange = vi.fn<(state: CheckerState) => void>();
  const checker = createUrlChecker({
    server: server ?? controllable.server,
    throttleMs: THROTTLE,
    onChange,
  });
  return {
    checker,
    calls: controllable.calls,
    states: () => onChange.mock.calls.map(([state]) => state),
    lastState: () => onChange.mock.lastCall?.[0],
  };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("createUrlChecker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports idle for empty input without sending a request", () => {
    const { checker, calls, lastState } = setup();
    checker.update("   ");
    expect(lastState()).toEqual({ status: "idle" });
    expect(calls).toHaveLength(0);
  });

  it("reports invalid input without sending a request", () => {
    const { checker, calls, lastState } = setup();
    checker.update("ftp://example.com");
    expect(lastState()).toEqual({
      status: "invalid",
      reason: "unsupported-protocol",
    });
    expect(calls).toHaveLength(0);
  });

  it("shows checking immediately and then the result", async () => {
    const { checker, calls, lastState } = setup();

    checker.update(URL_B);
    expect(lastState()).toEqual({ status: "checking", url: URL_B });
    expect(calls).toHaveLength(1);

    calls[0].resolve({ exists: true, type: "file" });
    await flush();

    expect(lastState()).toEqual({
      status: "done",
      url: URL_B,
      result: { exists: true, type: "file" },
    });
  });

  it("ignores a slow stale response that arrives after a newer one (race condition)", async () => {
    const { checker, calls, states, lastState } = setup();

    checker.update(URL_A);
    checker.update(URL_B);
    expect(calls[0].signal?.aborted).toBe(true);
    expect(lastState()).toEqual({ status: "checking", url: URL_B });

    await vi.advanceTimersByTimeAsync(THROTTLE);
    expect(calls).toHaveLength(2);

    calls[1].resolve({ exists: true, type: "file" });
    await flush();
    calls[0].resolve({ exists: true, type: "folder" });
    await flush();

    expect(lastState()).toEqual({
      status: "done",
      url: URL_B,
      result: { exists: true, type: "file" },
    });
    expect(states().some((s) => s.status === "done" && s.url === URL_A)).toBe(
      false,
    );
  });

  it("drops an in-flight result when the input becomes invalid", async () => {
    const { checker, calls, lastState } = setup();

    checker.update(URL_A);
    checker.update("not a url");
    expect(calls[0].signal?.aborted).toBe(true);

    calls[0].resolve({ exists: true, type: "folder" });
    await flush();

    expect(lastState()).toEqual({ status: "invalid", reason: "malformed" });
  });

  it("cancels a pending throttled check when the input is cleared", async () => {
    const { checker, calls, lastState } = setup();

    checker.update(URL_A);
    checker.update(URL_B);
    checker.update("");
    await vi.advanceTimersByTimeAsync(THROTTLE * 2);

    expect(calls).toHaveLength(1);
    expect(lastState()).toEqual({ status: "idle" });
  });

  it("does not re-request the same URL", () => {
    const { checker, calls } = setup();
    checker.update(URL_B);
    checker.update(`  ${URL_B}  `);
    expect(calls).toHaveLength(1);
  });

  it("limits requests while typing fast and checks the final value", async () => {
    const { checker, calls } = setup();

    for (let i = 1; i <= URL_B.length; i++) {
      checker.update(URL_B.slice(0, i)); // one keystroke every 50ms
      await vi.advanceTimersByTimeAsync(50);
    }
    await vi.advanceTimersByTimeAsync(THROTTLE);

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThan(5);
    expect(calls[calls.length - 1].url).toBe(URL_B);
    expect(calls.slice(0, -1).every((c) => c.signal?.aborted)).toBe(true);
  });

  it("reports an error and allows retrying the same URL", async () => {
    const { checker, calls, lastState } = setup();

    checker.update(URL_A);
    calls[0].reject(new Error("network down"));
    await flush();
    expect(lastState()).toMatchObject({ status: "error", url: URL_A });

    await vi.advanceTimersByTimeAsync(THROTTLE);
    checker.update(URL_A);
    expect(calls).toHaveLength(2);
  });

  it("works end-to-end with the real mock server", async () => {
    const { checker, lastState } = setup(
      createMockServer({ minDelay: 100, maxDelay: 100 }),
    );

    checker.update("https://example.com/images");
    await vi.advanceTimersByTimeAsync(100);
    expect(lastState()).toEqual({
      status: "done",
      url: "https://example.com/images",
      result: { exists: true, type: "folder" },
    });

    await vi.advanceTimersByTimeAsync(THROTTLE);
    checker.update("https://example.com/nope");
    await vi.advanceTimersByTimeAsync(100);
    expect(lastState()).toMatchObject({
      status: "done",
      result: { exists: false },
    });
  });
});
