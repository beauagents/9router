/**
 * Run a fire-and-forget logging call (e.g. appendRequestLog / saveRequestDetail)
 * and convert rejections into observable console.warn output instead of
 * silently swallowing them.
 *
 * Why: usage-log / request-detail writes are best-effort side effects. Throwing
 * out of them would corrupt the request lifecycle, but a bare `.catch(() => {})`
 * makes dropped-log bugs invisible. This helper keeps the no-throw contract
 * while leaving a breadcrumb when something goes wrong.
 *
 * @param {() => Promise<unknown>} fn - the async log write to run
 * @param {string} label - short context tag (e.g. "appendRequestLog") for the warning
 * @returns {Promise<void>} always settles (never rejects)
 */
export async function safeLog(fn, label) {
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[safeLog:${label}] best-effort log write failed: ${message}`);
  }
}
