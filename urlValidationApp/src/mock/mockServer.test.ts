import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockServer, toResourceKey } from "./mockServer";

const DELAY = 100;

describe("mockServer", () => {
  const server = createMockServer({ minDelay: DELAY, maxDelay: DELAY });

  async function check(url: string) {
    const promise = server.checkUrl(new URL(url));
    await vi.advanceTimersByTimeAsync(DELAY);
    return promise;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("lookup", () => {
    it.each([
      ["https://example.com", "folder"],
      ["https://example.com/", "folder"],
      ["https://example.com/docs", "folder"],
      ["https://example.com/docs/", "folder"],
      ["https://example.com/docs/readme.md", "file"],
      ["http://example.com/docs/readme.md", "file"],
      ["https://example.com/docs/readme.md?v=2#intro", "file"],
      ["http://localhost:5173/api/users.json", "file"],
      ["https://EXAMPLE.com/images", "folder"],
    ])("%s → %s", async (url, type) => {
      expect(await check(url)).toEqual({ exists: true, type });
    });

    it.each([
      "https://example.com/missing",
      "https://example.com/DOCS",
      "https://example.com/docs/readme.md/extra",
      "https://unknown-host.com/",
    ])("%s does not exist", async (url) => {
      expect(await check(url)).toEqual({ exists: false });
    });
  });

  describe("asynchronous behaviour", () => {
    it("does not resolve before the delay has passed", async () => {
      let settled = false;
      const promise = server
        .checkUrl(new URL("https://example.com"))
        .then((r) => {
          settled = true;
          return r;
        });

      await vi.advanceTimersByTimeAsync(DELAY - 1);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBe(true);
      await promise;
    });

    it.each([
      [0, 300],
      [0.9999, 1500],
    ])(
      "random() = %d gives a delay of %dms",
      async (randomValue, expectedDelay) => {
        const randomServer = createMockServer({ random: () => randomValue });
        let settled = false;
        randomServer.checkUrl(new URL("https://example.com")).then(() => {
          settled = true;
        });

        await vi.advanceTimersByTimeAsync(expectedDelay - 1);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(settled).toBe(true);
      },
    );
  });

  describe("cancellation", () => {
    it("rejects with AbortError when aborted during the request", async () => {
      const controller = new AbortController();
      const promise = server.checkUrl(new URL("https://example.com"), {
        signal: controller.signal,
      });

      controller.abort();

      await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    });

    it("rejects immediately when the signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        server.checkUrl(new URL("https://example.com"), {
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({ name: "AbortError" });
    });
  });
});

describe("toResourceKey", () => {
  it.each([
    ["https://example.com", "example.com/"],
    ["https://example.com/docs///", "example.com/docs"],
    ["https://example.com/my%20file.txt", "example.com/my file.txt"],
    ["https://example.com/bad%E0%A4%A", "example.com/bad%E0%A4%A"],
  ])("%s → %s", (url, key) => {
    expect(toResourceKey(new URL(url))).toBe(key);
  });
});
