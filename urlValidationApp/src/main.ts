import "./style.css";
import { createUrlChecker, type CheckerState } from "./services/urlChecker";
import { describeState } from "./ui/describeState";

/** How long the user must pause before a validation error is shown. */
const ERROR_DISPLAY_DELAY = 800;

const input = document.querySelector<HTMLInputElement>("#url-input")!;
const status = document.querySelector<HTMLDivElement>("#status")!;
const statusIcon = document.querySelector<HTMLSpanElement>("#status-icon")!;
const statusTitle =
  document.querySelector<HTMLParagraphElement>("#status-title")!;
const statusDetail =
  document.querySelector<HTMLParagraphElement>("#status-detail")!;
const exampleButtons =
  document.querySelectorAll<HTMLButtonElement>("[data-example]");

let renderedState: CheckerState = { status: "idle" };
let pendingError: CheckerState | null = null;
let errorTimer: number | undefined;

function render(state: CheckerState) {
  renderedState = state;
  const view = describeState(state);
  status.dataset.tone = view.tone;
  statusIcon.textContent = view.icon;
  statusTitle.textContent = view.title;
  statusDetail.textContent = view.detail;
  input.setAttribute("aria-invalid", String(state.status === "invalid"));
}

function showPendingError() {
  window.clearTimeout(errorTimer);
  if (pendingError) {
    render(pendingError);
    pendingError = null;
  }
}

function handleStateChange(state: CheckerState) {
  window.clearTimeout(errorTimer);
  pendingError = null;

  // Delay validation errors so they don't flash while the user is still typing,
  // unless an error is already visible (then keep it up to date).
  if (state.status === "invalid" && renderedState.status !== "invalid") {
    pendingError = state;
    render({ status: "idle" });
    errorTimer = window.setTimeout(showPendingError, ERROR_DISPLAY_DELAY);
    return;
  }

  render(state);
}

const checker = createUrlChecker({ onChange: handleStateChange });

input.addEventListener("input", () => checker.update(input.value));
input.addEventListener("blur", showPendingError);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") showPendingError();
});

exampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.example ?? "";
    checker.update(input.value);
    showPendingError(); // an explicit choice, so show errors right away
    input.focus();
  });
});

render({ status: "idle" });
