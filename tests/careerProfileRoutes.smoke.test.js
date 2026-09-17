import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';

describe('career profile routes smoke tests (no DB required)', () => {
  it('POST /api/v1/career-profile/generate without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/career-profile/generate');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/career-profile without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/career-profile');
    expect(res.status).toBe(401);
  });
});
