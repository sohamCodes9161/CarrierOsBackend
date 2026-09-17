import { BadRequestError } from '../errors/AppError.js';

/**
 * Takes a Zod schema and returns Express middleware that validates req.body,
 * replacing it with the parsed (and coerced/trimmed) result on success.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      return next(new BadRequestError('Validation failed', messages));
    }
    req.body = result.data;
    next();
  };
}
