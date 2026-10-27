# URL Checker

A small web app (TypeScript + Vite, no framework) with a URL input that:

1. validates the URL format while you type,
2. if the format is valid, asks an **asynchronous mock server** (running in the browser) whether the URL exists,
3. **throttles** those checks so a request is not sent on every keystroke,
4. shows the result: **exists / not found**, and whether it is a **file** or a **folder**.

## Getting started

Requirements: **Node.js 18+**

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # run the unit tests
npm run test:watch
npm run build
```

## How to try it

Use the example buttons below the input, or type one of these URLs:

| URL                                    | Expected result                |
| -------------------------------------- | ------------------------------ |
| `https://example.com/docs/readme.md`   | Exists — file                  |
| `https://example.com/images/`          | Exists — folder                |
| `http://localhost:3000/api/users.json` | Exists — file                  |
| `https://example.com/missing.txt`      | Not found                      |
| `example.com`                          | Invalid (missing protocol)     |
| `ftp://example.com`                    | Invalid (unsupported protocol) |
| `https://example`                      | Invalid (host has no TLD)      |

Things worth trying:

- **Fast typing:** type `https://example.com/docs/readme.md` quickly. You'll see "Checking…" while typing and one final result. Only about one request is sent every 500 ms.
- **Race condition:** paste `https://example.com/docs/readme.md`, then quickly change it to `https://example.com/images`. Only the folder result appears, even if the first response arrives later.
- **Clearing during a check:** the pending request is cancelled and no late result shows up.

The mock file system lives in `DEFAULT_ENTRIES` in [`src/mock/mockServer.ts`](src/mock/mockServer.ts). Any other URL, including real links from the internet, is reported as **Not found**. To test with a real link, add its `hostname/path` to that map.

## Project structure

```
src/
├── validation/validateUrl.ts   # URL format validation (pure function)
├── utils/throttle.ts           # throttle with leading + trailing calls and cancel()
├── mock/mockServer.ts          # async mock server: fake file system, random latency, AbortSignal
├── services/urlChecker.ts      # combines validation + throttle + server, handles race conditions
├── ui/describeState.ts         # maps a state to text/icon/tone (pure function)
├── main.ts                     # DOM wiring
└── style.css                   # styles (light + dark mode)
```

Every module except `main.ts` is free of DOM code and has a `*.test.ts` file next to it.

## Technical decisions

### Validation

- Uses the native `URL` parser plus extra rules, because `URL` alone accepts things like `javascript:alert(1)` or `https://example`:
  - only `http:` / `https:`,
  - host must be a domain with an alphabetic TLD, `localhost`, or IPv4,
  - no whitespace.
- The protocol is **required** and is not added automatically, so the user always sees exactly what gets checked.
- **When errors are shown:** empty input shows a neutral hint, not an error. Validation errors appear after **800 ms of inactivity**, or immediately on blur or Enter, so they don't flash on every keystroke. Valid states ("checking…" and results) show immediately.

### Throttling vs. debouncing

- **Debounce** waits until the user stops typing. **Throttle** runs at most once per time window, even while the user is still typing.
- The task asks for **throttling**, so it's used with a **500 ms** window:
  - **Leading call:** the first check runs immediately, so pasting a URL gives an instant result.
  - **Trailing call:** the last value typed in each window is always checked. Without this, the final URL could be dropped.
- `cancel()` drops a pending trailing call when the input becomes empty or invalid.

### Asynchronous mock server

- An in-memory map from `hostname + path` to `'file' | 'folder'`. The root of every known host is a folder.
- **Normalization:**
  - `http` and `https` are treated the same.
  - The port, query and hash are ignored.
  - Trailing slashes are ignored.
  - The host is case-insensitive; the path is case-sensitive.
- **Random latency** between 300 and 1500 ms, so the loading state is visible and race conditions are reproducible.
- **Supports `AbortSignal`** (the same API as `fetch`), so it can be swapped for a real backend without changing the caller.
- `createMockServer(options)` accepts a fixed delay, custom entries and a custom `random()` function, so tests are deterministic.

### Race conditions

Two layers of protection in `urlChecker.ts`:

1. **`AbortController`:** when the input changes, the in-flight request is cancelled.
2. **Request IDs:** every request gets an increasing ID, and a response is applied only if its ID is still the latest one. This also protects against servers that ignore abort.

Other rules:

- The same URL is not requested twice in a row (e.g. when the user only adds spaces).
- After an error, typing the same URL retries the check.
- "Checking…" is shown immediately on each valid change, so a result never sits next to a different URL in the input.

### UI and accessibility

- The input is `type="text"` with `inputmode="url"`. The browser's built-in URL validation is avoided because it would compete with the app's own rules.
- The status area uses `role="status"` and `aria-live="polite"`, the input sets `aria-invalid`, and `aria-describedby` links the input to the status.
- Light and dark themes follow the OS setting; the spinner slows down for users who prefer reduced motion.

## Tests

Unit tests are written with **Vitest**. Fake timers make all timing-related tests fast and deterministic.

| File                    | Covers                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validateUrl.test.ts`   | valid URLs, empty input, malformed input, unsupported protocols, invalid hosts                                                                                            |
| `throttle.test.ts`      | leading call, trailing call with the latest arguments, fast typing, `cancel()`                                                                                            |
| `mockServer.test.ts`    | file / folder / not found, normalization, latency, abort                                                                                                                  |
| `urlChecker.test.ts`    | idle/invalid without requests, out-of-order responses, cancelling on invalid or empty input, deduplication, fast typing, error and retry, end-to-end with the mock server |
| `describeState.test.ts` | text, icon and tone for every state                                                                                                                                       |

## Limitations and possible improvements

- **Real URLs are not checked.** Browsers block reading cross-origin responses (CORS), so a real check would need a backend endpoint. Because the mock server uses the same `AbortSignal` contract as `fetch`, replacing it is a small change.
- Hosts are limited to domains, `localhost` and IPv4 (no IPv6 literals or internationalized TLDs).
- Possible additions: caching results per URL, and DOM tests for `main.ts` (e.g. with jsdom or Playwright).
