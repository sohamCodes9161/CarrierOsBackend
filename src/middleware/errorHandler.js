import { env } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  // Mongoose validation errors -> 400 with field-level details
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => e.message);
  }

  // Mongoose duplicate key error -> 409
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `${field} already in use` : 'Duplicate value';
  }

  // Malformed ObjectId -> 400
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid identifier';
  }

  // JWT errors -> 401
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired token';
  }

  // Mongoose optimistic-concurrency conflict (two requests modified the same
  // document at once) -> 409, not a raw 500. Usually means a duplicate
  // submission slipped through (e.g. a double-click) rather than a real bug.
  if (err.name === 'VersionError') {
    statusCode = 409;
    message = 'This answer is already being processed. Please wait a moment and check the interview status before retrying.';
  }

  // Multer upload errors -> 400
  if (err.name === 'MulterError') {
    statusCode = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large (max 5MB)'
        : `Upload error: ${err.message}`;
  }

  if (!err.isOperational && env.NODE_ENV !== 'test') {
    // Unexpected/programmer error - log full detail server-side, don't leak internals to client
    console.error('[unexpected error]', err);
    if (env.NODE_ENV === 'production') {
      message = 'Something went wrong';
      details = undefined;
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { errors: details }),
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}
