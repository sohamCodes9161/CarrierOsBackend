import { jest, describe, it, expect } from '@jest/globals';
import request from 'supertest';

// The two public portfolio routes reach the DB layer (unlike every other
// "no token -> 401" case in this suite, which is rejected by the auth
// middleware before ever touching Mongo). Since there's no live DB
// connection in this sandbox, the model is mocked here so those two
// specific requests resolve instead of hanging on a real query.
jest.unstable_mockModule('../src/models/Portfolio.model.js', () => ({
  Portfolio: {
    findOne: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
  },
}));

const { default: app } = await import('../src/app.js');

describe('portfolio routes smoke tests (no DB required for auth-gated routes)', () => {
  it('GET /api/v1/portfolio without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/portfolio');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/portfolio without a token returns 401', async () => {
    const res = await request(app).patch('/api/v1/portfolio').send({ headline: 'x' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/portfolio/quick-start without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/portfolio/quick-start');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/portfolio/publish without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/portfolio/publish');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/portfolio/projects without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/portfolio/projects').send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/portfolio/improve-content without a token returns 401', async () => {
    const res = await request(app).post('/api/v1/portfolio/improve-content').send({ section: 'bio', text: 'x' });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/portfolio/slug-availability/:slug does NOT require a token (public, reaches the service layer)', async () => {
    const res = await request(app).get('/api/v1/portfolio/slug-availability/somename');
    expect(res.status).not.toBe(401);
    expect(res.body.data).toEqual({ available: true }); // mocked findOne -> null -> available
  });

  it('GET /api/v1/portfolio/public/:slug does NOT require a token (public, reaches the service layer)', async () => {
    const res = await request(app).get('/api/v1/portfolio/public/somename');
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(404); // mocked findOneAndUpdate -> null -> "not found"
  });
});
