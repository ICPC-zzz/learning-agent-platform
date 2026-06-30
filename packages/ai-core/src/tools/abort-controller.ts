export function createChildAbortController(
  parent?: AbortSignal | AbortController,
): AbortController {
  const child = new AbortController();
  const parentSignal = parent instanceof AbortController ? parent.signal : parent;

  if (!parentSignal) {
    return child;
  }

  if (parentSignal.aborted) {
    child.abort(parentSignal.reason);
    return child;
  }

  const abortChild = () => {
    child.abort(parentSignal.reason);
  };
  const cleanup = () => {
    parentSignal.removeEventListener("abort", abortChild);
  };

  parentSignal.addEventListener("abort", abortChild, { once: true });
  child.signal.addEventListener("abort", cleanup, { once: true });

  return child;
}

export function createTimeoutAbortPromise(
  signal: AbortSignal,
): Promise<never> {
  return new Promise((_, reject) => {
    const abort = () => {
      reject(signal.reason ?? new Error("ABORTED"));
    };

    if (signal.aborted) {
      abort();
      return;
    }

    signal.addEventListener("abort", abort, { once: true });
  });
}
