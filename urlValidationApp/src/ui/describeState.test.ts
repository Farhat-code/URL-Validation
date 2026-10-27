import { describe, it, expect } from "vitest";
import { describeState } from "./describeState";

const URL = "https://example.com/docs";

describe("describeState", () => {
  it("describes idle", () => {
    expect(describeState({ status: "idle" })).toMatchObject({
      tone: "neutral",
    });
  });

  it("describes invalid input with a helpful message", () => {
    const view = describeState({
      status: "invalid",
      reason: "unsupported-protocol",
    });
    expect(view.tone).toBe("danger");
    expect(view.detail).toMatch(/http/);
  });

  it("describes checking", () => {
    expect(describeState({ status: "checking", url: URL })).toMatchObject({
      tone: "pending",
      detail: URL,
    });
  });

  it("describes an existing file", () => {
    const view = describeState({
      status: "done",
      url: URL,
      result: { exists: true, type: "file" },
    });
    expect(view).toMatchObject({ tone: "success", icon: "📄" });
    expect(view.title).toMatch(/file/);
  });

  it("describes an existing folder", () => {
    const view = describeState({
      status: "done",
      url: URL,
      result: { exists: true, type: "folder" },
    });
    expect(view).toMatchObject({ tone: "success", icon: "📁" });
    expect(view.title).toMatch(/folder/);
  });

  it("describes a missing resource", () => {
    expect(
      describeState({ status: "done", url: URL, result: { exists: false } }),
    ).toMatchObject({ tone: "warning", title: "Not found" });
  });

  it("describes an error", () => {
    expect(
      describeState({ status: "error", url: URL, message: "boom" }),
    ).toMatchObject({ tone: "danger", detail: "boom" });
  });
});
