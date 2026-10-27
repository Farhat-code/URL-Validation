export interface Throttled<Args extends unknown[]> {
  (...args: Args): void;
  cancel(): void;
}

export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
): Throttled<Args> {
  let lastRun = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  const run = (args: Args) => {
    lastRun = Date.now();
    fn(...args);
  };

  const throttled = ((...args: Args) => {
    const remaining = wait - (Date.now() - lastRun);

    if (remaining <= 0 && timer === null) {
      run(args);
      return;
    }

    //remember the latest argumts
    pendingArgs = args;

    if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        if (pendingArgs) {
          const latest = pendingArgs;
          pendingArgs = null;
          run(latest);
        }
      }, remaining);
    }
  }) as Throttled<Args>;

  throttled.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pendingArgs = null;
  };

  return throttled;
}
