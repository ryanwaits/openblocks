/**
 * Trailing-edge throttle: ensures the last call always fires after cooldown.
 * Returns a throttled function and a `flush()` to force pending call.
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  ms: number
): T & { flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCall = 0;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    const elapsed = now - lastCall;

    if (elapsed >= ms) {
      lastCall = now;
      fn(...args);
    } else {
      lastArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          if (lastArgs) {
            lastCall = Date.now();
            fn(...lastArgs);
            lastArgs = null;
          }
        }, ms - elapsed);
      }
    }
  };

  throttled.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (lastArgs) {
      lastCall = Date.now();
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  return throttled as T & { flush: () => void };
}
