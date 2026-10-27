export type ResourceType = "file" | "folder";

export type CheckResult =
  | { exists: false }
  | { exists: true; type: ResourceType };

export interface CheckOptions {
  signal?: AbortSignal;
}

export interface MockServerOptions {
  entries?: Record<string, ResourceType>;
  minDelay?: number;
  maxDelay?: number;
  //for tests
  random?: () => number;
}

export interface MockServer {
  checkUrl(url: URL, options?: CheckOptions): Promise<CheckResult>;
}

export const DEFAULT_ENTRIES: Record<string, ResourceType> = {
  "example.com/": "folder",
  "example.com/index.html": "file",
  "example.com/docs": "folder",
  "example.com/docs/readme.md": "file",
  "example.com/docs/guide.pdf": "file",
  "example.com/images": "folder",
  "example.com/images/logo.png": "file",

  "files.example.org/": "folder",
  "files.example.org/public": "folder",
  "files.example.org/public/report.xlsx": "file",

  "localhost/": "folder",
  "localhost/api": "folder",
  "localhost/api/users.json": "file",
};

//lookup key
export function toResourceKey(url: URL): string {
  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch (error) {}
  path = path.replace(/\/+$/, "") || "/";
  return `${url.hostname}${path}`;
}

function abortError(): DOMException {
  return new DOMException("The request was aborted", "AbortError");
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createMockServer(options: MockServerOptions = {}): MockServer {
  const {
    entries = DEFAULT_ENTRIES,
    minDelay = 300,
    maxDelay = 1500,
    random = Math.random,
  } = options;

  return {
    async checkUrl(url, { signal } = {}) {
      const latency =
        minDelay + Math.floor(random() * (maxDelay - minDelay + 1));
      await delay(latency, signal);

      const type = entries[toResourceKey(url)];
      return type ? { exists: true, type } : { exists: false };
    },
  };
}

export const mockServer = createMockServer();
