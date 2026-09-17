import { jest, describe, it, expect } from '@jest/globals';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const { errorHandler } = await import('../src/middleware/errorHandler.js');

describe('errorHandler', () => {
  it('maps a Mongoose VersionError to a 409 with a clear message', () => {
    const err = new Error('No matching document found');
    err.name = 'VersionError';
    const res = makeRes();

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining('already being processed'),
      })
    );
  });

  it('maps a Mongoose ValidationError to a 400 with field details', () => {
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    err.errors = { role: { message: 'Role is required' } };
    const res = makeRes();

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('maps a Mongo duplicate key error to a 409', () => {
    const err = new Error('duplicate key');
    err.code = 11000;
    err.keyValue = { email: 'a@b.com' };
    const res = makeRes();

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('maps a JWT error to a 401', () => {
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';
    const res = makeRes();

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('respects an explicit AppError statusCode', () => {
    const err = new Error('Not found');
    err.statusCode = 404;
    err.isOperational = true;
    const res = makeRes();

    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('defaults unexpected errors to 500 without leaking internals in production', async () => {
    jest.resetModules();
    jest.unstable_mockModule('../src/config/env.js', () => ({ env: { NODE_ENV: 'production' } }));
    const { errorHandler: prodErrorHandler } = await import('../src/middleware/errorHandler.js');

    const err = new Error('some internal db driver detail');
    const res = makeRes();

    prodErrorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.message).toBe('Something went wrong');

    jest.resetModules();
  });
});
