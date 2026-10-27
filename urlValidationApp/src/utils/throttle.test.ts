import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { throttle } from "./throttle";

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the first call immediately (leading)", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled("a");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("collapses calls inside the window into one trailing call with the latest args", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled("a");
    throttled("b");
    throttled("c");
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("c");
  });

  it("runs immediately again once the window has passed", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled("a");
    vi.advanceTimersByTime(300);
    throttled("b");

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("b");
  });

  it("limits fast typing to one call per window and always ends with the final value", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    for (let i = 0; i < 20; i++) {
      throttled(`value-${i}`);
      vi.advanceTimersByTime(50);
    }
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(5);
    expect(fn).toHaveBeenLastCalledWith("value-19");
  });

  it("cancel() drops the pending trailing call", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled("a");
    throttled("b");
    throttled.cancel();
    vi.advanceTimersByTime(1000);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });
});
