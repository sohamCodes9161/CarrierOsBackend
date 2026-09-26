import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';

describe('dashboard routes smoke tests (no DB required)', () => {
  it('GET /api/v1/dashboard without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/dashboard');
    expect(res.status).toBe(401);
  });
});
