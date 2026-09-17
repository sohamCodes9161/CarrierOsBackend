import { describe, it, expect } from '@jest/globals';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from '../src/errors/AppError.js';

describe('AppError classes', () => {
  it('sets the correct status codes', () => {
    expect(new BadRequestError().statusCode).toBe(400);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new ConflictError().statusCode).toBe(409);
  });

  it('marks all AppError instances as operational', () => {
    expect(new AppError('test', 500).isOperational).toBe(true);
  });

  it('carries optional details through', () => {
    const err = new BadRequestError('Validation failed', ['field is required']);
    expect(err.details).toEqual(['field is required']);
  });
});
