/**
 * Wraps an async route handler so any thrown error / rejected promise
 * is automatically passed to next(), reaching our global error handler
 * instead of crashing the process or needing try/catch in every controller.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
