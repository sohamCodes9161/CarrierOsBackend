import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';

// Mock external job search APIs to keep tests deterministic and offline
jest.unstable_mockModule('../src/integrations/jobSearch.integration.js', () => ({
  fetchAdzunaJobs: jest.fn().mockResolvedValue([
    {
      _id: 'ext_adzuna_12345',
      company: 'LiveCorp',
      title: 'Full Stack Node.js Engineer',
      description: 'Looking for Node.js, Express, and Docker developers.',
      requiredSkills: ['Node.js', 'Express', 'Docker'],
      location: 'Remote',
      workplaceType: 'remote',
      employmentType: 'full-time',
      salary: { min: 80000, max: 120000, currency: 'USD' },
      jobUrl: 'https://example.com/jobs/12345',
      isExternal: true,
    },
  ]),
  fetchRemotiveJobs: jest.fn().mockResolvedValue([]),
}));

const { default: app } = await import('../src/app.js');
const { connectDB } = await import('../src/config/db.js');
const { User } = await import('../src/models/User.model.js');
const { CareerProfile } = await import('../src/models/CareerProfile.model.js');
const { default: JobPosting } = await import('../src/models/JobPosting.model.js');
const { default: JobApplication } = await import('../src/models/JobApplication.model.js');
const { signAccessToken } = await import('../src/utils/token.js');
const { fetchAdzunaJobs } = await import('../src/integrations/jobSearch.integration.js');

jest.setTimeout(30000);

describe('Job Search & Skill-Gap Match Scoring API Tests', () => {
  let userToken;
  let userId;
  let testJobPostingId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    // 1. Create Test User
    const user = await User.create({
      name: 'Match Candidate',
      email: `candidate_${Date.now()}@example.com`,
      passwordHash: 'hashed_password_for_testing',
    });
    userId = user._id.toString();
    userToken = signAccessToken(userId);

    // 2. Seed Career Profile matching CareerProfile.model.js schema requirements
    await CareerProfile.create({
      user: userId,
      targetRole: 'Backend Engineer',
      skills: [{ name: 'Node.js' }, { name: 'MongoDB' }, { name: 'Express' }],
      generatedAt: new Date(),
      overallReadinessLevel: 'job-ready',
      narrative: 'Backend software engineer with experience in Node.js and MongoDB.',
    });
  });

  afterAll(async () => {
    if (userId) {
      await User.deleteOne({ _id: userId });
      await CareerProfile.deleteOne({ user: userId });
      await JobPosting.deleteMany({ createdBy: userId });
      await JobApplication.deleteMany({ user: userId });
    }
    await mongoose.connection.close();
  });

  describe('POST /api/v1/job-search', () => {
    it('should create a custom job posting', async () => {
      const payload = {
        company: 'InnovateTech',
        title: 'Senior Node.js Developer',
        description: 'Looking for an experienced backend developer.',
        requiredSkills: ['Node.js', 'MongoDB', 'Docker', 'Redis'],
        location: 'Remote',
        workplaceType: 'remote',
        employmentType: 'full-time',
      };

      const res = await request(app)
        .post('/api/v1/job-search')
        .set('Authorization', `Bearer ${userToken}`)
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Senior Node.js Developer');

      testJobPostingId = res.body.data._id;
    });

    it('should return 400 validation error if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/job-search')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Incomplete Job' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/job-search', () => {
    it('should fetch scored job postings from external API with skill match details', async () => {
      const res = await request(app)
        .get('/api/v1/job-search?search=Node.js')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.postings)).toBe(true);
      expect(res.body.data.postings.length).toBeGreaterThan(0);

      const job = res.body.data.postings[0];
      expect(job.match).toBeDefined();
      // Candidate has Node.js and Express out of ['Node.js', 'Express', 'Docker'] => 67% match
      expect(job.match.matchPercentage).toBe(67);
      expect(job.match.alreadyHave).toContain('Node.js');
      expect(job.match.alreadyHave).toContain('Express');
      expect(job.match.missing).toContain('Docker');
    });

    it('should fallback to local DB postings when external API returns no results', async () => {
      fetchAdzunaJobs.mockResolvedValueOnce([]); // Simulate empty external response

      const res = await request(app)
        .get('/api/v1/job-search?search=Senior')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      
      const localJob = res.body.data.postings.find((p) => p._id === testJobPostingId);
      expect(localJob).toBeDefined();
      expect(localJob.company).toBe('InnovateTech');
    });
  });

  describe('GET /api/v1/job-search/:id', () => {
    it('should retrieve details and match analysis for a specific local job posting', async () => {
      const res = await request(app)
        .get(`/api/v1/job-search/${testJobPostingId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(testJobPostingId);
      expect(res.body.data.match.matchPercentage).toBe(50); // 2 out of 4 skills
    });

    it('should return 404 for a non-existent job posting ID', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/v1/job-search/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/job-search/:id/convert', () => {
    it('should convert job posting to tracked application', async () => {
      const res = await request(app)
        .post(`/api/v1/job-search/${testJobPostingId}/convert`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'applied' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.company).toBe('InnovateTech');
      expect(res.body.data.jobTitle).toBe('Senior Node.js Developer');
      expect(res.body.data.status).toBe('applied');
    });

    it('should return 400 error when converting the same job posting twice', async () => {
      const res = await request(app)
        .post(`/api/v1/job-search/${testJobPostingId}/convert`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'applied' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already tracking an application');
    });
  });
});