/**
 * Result type for operations that can fail.
 * Use this pattern instead of throwing errors for expected failure cases.
 */
export type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create a successful result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Create a failed result
 */
export function err<E = string>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Check if result is successful (type guard)
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

/**
 * Check if result is an error (type guard)
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}

/**
 * Unwrap a result, throwing if it's an error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.success) {
    return result.data;
  }
  throw new Error(String(result.error));
}

/**
 * Unwrap a result with a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.success ? result.data : defaultValue;
}

/**
 * Map over a successful result
 */
export function map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
  return result.success ? ok(fn(result.data)) : result;
}

/**
 * Map over an error result
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.success ? result : err(fn(result.error));
}

/**
 * Wrap an async function to return a Result instead of throwing
 */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, string>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * Wrap a sync function to return a Result instead of throwing
 */
export function trySync<T>(fn: () => T): Result<T, string> {
  try {
    const data = fn();
    return ok(data);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Unknown error");
  }
}
