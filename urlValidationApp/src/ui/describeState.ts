import type { CheckerState } from "../services/urlChecker";
import { VALIDATION_MESSAGES } from "../validation/validateUrl";

export type Tone = "neutral" | "pending" | "success" | "warning" | "danger";

export interface Statusview {
  tone: Tone;
  icon: string;
  title: string;
  detail: string;
}

export function describeState(state: CheckerState): Statusview {
  switch (state.status) {
    case "idle":
      return {
        tone: "neutral",
        icon: "⌨",
        title: "Enter a URL",
        detail: "It must start with http:// or https://",
      };

    case "invalid":
      return {
        tone: "danger",
        icon: "✕",
        title: "Invalid URL",
        detail: VALIDATION_MESSAGES[state.reason],
      };

    case "checking":
      return {
        tone: "pending",
        icon: "",
        title: "Checking...",
        detail: state.url,
      };

    case "done":
      if (!state.result.exists) {
        return {
          tone: "warning",
          icon: "∅",
          title: "Not found",
          detail: state.url,
        };
      }
      return state.result.type === "file"
        ? {
            tone: "success",
            icon: "📄",
            title: "Exists — it is a file",
            detail: state.url,
          }
        : {
            tone: "success",
            icon: "📁",
            title: "Exists — it is a folder",
            detail: state.url,
          };

    case "error":
      return {
        tone: "danger",
        icon: "!",
        title: "Check failed",
        detail: state.message,
      };
  }
}
