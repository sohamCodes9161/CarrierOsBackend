import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';

describe('resume routes smoke tests (no DB required)', () => {
  it('POST /api/v1/resumes/analyze without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/resumes/analyze');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/resumes/analyses without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/resumes/analyses');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/v1/resumes/:id without a token returns 401', async () => {
    const res = await request(app).delete('/api/v1/resumes/someid');
    expect(res.status).toBe(401);
  });
});
