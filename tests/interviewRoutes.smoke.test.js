import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';

describe('interview routes smoke tests (no DB required)', () => {
  it('POST /api/v1/interviews/start without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/interviews/start').send({});
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/interviews without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/interviews');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/interviews/:id/answer without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/interviews/someid/answer').send({ answerText: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('interview audio answer route smoke tests', () => {
  it('POST /api/v1/interviews/:id/answer/audio without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/interviews/someid/answer/audio');
    expect(res.status).toBe(401);
  });
});
