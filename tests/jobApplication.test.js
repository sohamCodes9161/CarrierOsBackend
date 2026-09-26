import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';

const { default: app } = await import('../src/app.js');
const { connectDB } = await import('../src/config/db.js');
const { User } = await import('../src/models/User.model.js');
const { default: JobApplication } = await import('../src/models/JobApplication.model.js');
const { signAccessToken } = await import('../src/utils/token.js');

jest.setTimeout(30000);

describe('Job Application Module API Tests', () => {
  let userToken;
  let userId;
  let testJobId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const user = await User.create({
      name: 'Test Job Seeker',
      email: `jobseeker_${Date.now()}@example.com`,
      passwordHash: 'hashed_password_for_testing',
    });
    userId = user._id.toString();
    userToken = signAccessToken(userId);
  });

  afterAll(async () => {
    if (userId) {
      await JobApplication.deleteMany({ user: userId });
      await User.deleteOne({ _id: userId });
    }
    await mongoose.connection.close();
  });

  describe('POST /api/v1/job-applications', () => {
    it('should fail with 401 if authentication token is missing', async () => {
      const res = await request(app)
        .post('/api/v1/job-applications')
        .send({
          company: 'Google',
          jobTitle: 'Software Engineer',
        });

      expect(res.statusCode).toBe(401);
    });

    it('should create a job application successfully', async () => {
      const payload = {
        company: 'Stripe',
        jobTitle: 'Backend Engineer',
        jobUrl: 'https://stripe.com/jobs/123',
        location: 'Remote',
        workplaceType: 'remote',
        employmentType: 'full-time',
        salary: { min: 90000, max: 130000, currency: 'USD' },
        status: 'applied',
        notes: 'Applied via company referral',
      };

      const res = await request(app)
        .post('/api/v1/job-applications')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.company).toBe('Stripe');
      expect(res.body.data.status).toBe('applied');

      testJobId = res.body.data._id;
    });

    it('should fail validation if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/job-applications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          location: 'San Francisco',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/job-applications', () => {
    it('should retrieve list of job applications for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/job-applications')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.applications)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });
  });

  describe('GET /api/v1/job-applications/stats', () => {
    it('should retrieve application stats pipeline breakdown', async () => {
      const res = await request(app)
        .get('/api/v1/job-applications/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applied).toBeGreaterThanOrEqual(1);
      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/job-applications/recommendations', () => {
    it('should return job recommendations for user profile', async () => {
      const res = await request(app)
        .get('/api/v1/job-applications/recommendations?search=Developer')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.recommendations)).toBe(true);
    });
  });

  describe('GET /api/v1/job-applications/:id', () => {
    it('should retrieve a single job application by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/job-applications/${testJobId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(testJobId);
    });

    it('should return 404 for a non-existent ObjectId', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/job-applications/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/v1/job-applications/:id', () => {
    it('should update application status and notes', async () => {
      const res = await request(app)
        .patch(`/api/v1/job-applications/${testJobId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          status: 'interviewing',
          notes: 'First round interview scheduled for next Monday',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('interviewing');
      expect(res.body.data.notes).toContain('First round interview');
    });
  });

  describe('DELETE /api/v1/job-applications/:id', () => {
    it('should delete the job application', async () => {
      const res = await request(app)
        .delete(`/api/v1/job-applications/${testJobId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const fetchRes = await request(app)
        .get(`/api/v1/job-applications/${testJobId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(fetchRes.statusCode).toBe(404);
    });
  });
});