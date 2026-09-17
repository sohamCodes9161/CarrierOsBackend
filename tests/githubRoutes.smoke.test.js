import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';

describe('github routes smoke tests (no external calls)', () => {
  it('POST /api/v1/github/analyze without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/github/analyze').send({ username: 'octocat' });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/github/analyses without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/github/analyses');
    expect(res.status).toBe(401);
  });
});
