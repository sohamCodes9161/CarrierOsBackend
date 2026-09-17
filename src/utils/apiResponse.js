/**
 * Every successful response follows this shape:
 * { success: true, data: {...}, message?: string }
 *
 * Every error response (built by the global error handler) follows:
 * { success: false, message: string, errors?: [...] }
 */
export function sendSuccess(res, { statusCode = 200, data = null, message = undefined }) {
  return res.status(statusCode).json({
    success: true,
    ...(message && { message }),
    data,
  });
}
