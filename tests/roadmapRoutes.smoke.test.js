import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';

describe('roadmap routes smoke tests (no DB required)', () => {
  it('POST /api/v1/roadmap/generate without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/roadmap/generate').send({ targetRole: 'Backend Engineer' });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/roadmap without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/roadmap');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/roadmap/:id without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/roadmap/someid');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/roadmap/:id/nodes/:nodeId/status without a token returns 401', async () => {
    const res = await request(app).patch('/api/v1/roadmap/someid/nodes/somenode/status').send({ status: 'completed' });
    expect(res.status).toBe(401);
  });
});
