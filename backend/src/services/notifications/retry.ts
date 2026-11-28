export class TransientDeliveryError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'TransientDeliveryError';
  }
}

export class PermanentDeliveryError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'PermanentDeliveryError';
  }
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Executes an async messaging send up to `maxAttempts` (default 3) using exponential
 * backoff (`baseDelayMs * 2^(attempt-1)`), immediately stopping on permanent errors.
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<{ result: T; attempts: number }> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  const sleepFn = options.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation(attempt);
      return { result, attempts: attempt };
    } catch (err) {
      lastErr = err;
      if (err instanceof PermanentDeliveryError || attempt >= maxAttempts) {
        throw err;
      }
      const backoffMs = baseDelayMs * Math.pow(2, attempt - 1);
      if (backoffMs > 0) {
        await sleepFn(backoffMs);
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Delivery failed after retries');
}
