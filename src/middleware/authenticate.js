import { verifyAccessToken } from '../utils/token.js';
import { UnauthorizedError } from '../errors/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Reads "Authorization: Bearer <token>", verifies it, and attaches
 * req.userId for downstream handlers. Does NOT hit the DB - keeps
 * this middleware fast since it runs on every protected request.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = header.split(' ')[1];

  // verifyAccessToken throws JsonWebTokenError/TokenExpiredError,
  // which the global error handler maps to a 401 automatically.
  const decoded = verifyAccessToken(token);

  req.userId = decoded.sub;
  next();
});
