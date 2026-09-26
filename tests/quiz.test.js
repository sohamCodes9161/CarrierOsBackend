import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';

const { default: app } = await import('../src/app.js');
const { connectDB } = await import('../src/config/db.js');
const { User } = await import('../src/models/User.model.js');
const { Quiz } = await import('../src/models/Quiz.model.js');
const { QuizAttempt } = await import('../src/models/QuizAttempt.model.js');
const { signAccessToken } = await import('../src/utils/token.js');

jest.setTimeout(30000);

describe('Adaptive Quiz & Mastery Module API Tests', () => {
  let userToken;
  let userId;
  let generatedQuizId;
  let questionsToAnswer = [];

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    const user = await User.create({
      name: 'Quiz Master',
      email: `quiz_${Date.now()}@example.com`,
      passwordHash: 'hashed_pass_test',
    });
    userId = user._id.toString();
    userToken = signAccessToken(userId);
  });

  afterAll(async () => {
    if (userId) {
      await User.deleteOne({ _id: userId });
      await Quiz.deleteMany({ user: userId });
      await QuizAttempt.deleteMany({ user: userId });
    }
    await mongoose.connection.close();
  });

  describe('POST /api/v1/quizzes/generate', () => {
    it('should generate an adaptive quiz without exposing answer keys', async () => {
      const res = await request(app)
        .post('/api/v1/quizzes/generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          topic: 'Docker Containers',
          questionCount: 3,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.topic).toBe('Docker Containers');
      expect(res.body.data.questions.length).toBe(3);

      // Verify answer keys are hidden from the frontend
      expect(res.body.data.questions[0].correctOptionIndex).toBeUndefined();
      expect(res.body.data.questions[0].explanation).toBeUndefined();

      generatedQuizId = res.body.data._id;
      questionsToAnswer = res.body.data.questions;
    });

    it('should return 400 validation error when topic is missing or empty', async () => {
      const res = await request(app)
        .post('/api/v1/quizzes/generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          topic: '',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 validation error when questionCount is out of bounds (<3 or >10)', async () => {
      const res = await request(app)
        .post('/api/v1/quizzes/generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          topic: 'Kubernetes',
          questionCount: 15,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/quizzes/submit', () => {
    it('should submit, grade, and generate AI debrief for the quiz', async () => {
      const answers = questionsToAnswer.map((q) => ({
        questionId: q._id,
        selectedOptionIndex: 0,
        timeSpentSeconds: 15,
      }));

      const res = await request(app)
        .post('/api/v1/quizzes/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          quizId: generatedQuizId,
          totalTimeSpentSeconds: 45,
          answers,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quiz).toBe(generatedQuizId);
      expect(res.body.data.aiDebrief).toBeDefined();
      expect(Array.isArray(res.body.data.aiDebrief.failedQuestionBreakdown)).toBe(true);
    });

    it('should apply time bonus multiplier when completed under 75% of target time limit', async () => {
      const answers = questionsToAnswer.map((q) => ({
        questionId: q._id,
        selectedOptionIndex: 0,
        timeSpentSeconds: 10,
      }));

      const res = await request(app)
        .post('/api/v1/quizzes/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          quizId: generatedQuizId,
          totalTimeSpentSeconds: 30, // Well below 180s target limit
          answers,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.timeBonusMultiplier).toBe(1.15);
    });

    it('should return 404 when submitting answers for a non-existent quiz ID', async () => {
      const fakeQuizId = new mongoose.Types.ObjectId().toString();
      const fakeQuestionId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/v1/quizzes/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          quizId: fakeQuizId,
          totalTimeSpentSeconds: 60,
          answers: [
            {
              questionId: fakeQuestionId,
              selectedOptionIndex: 1,
              timeSpentSeconds: 20,
            },
          ],
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 validation error when submit payload contains invalid option indices', async () => {
      const res = await request(app)
        .post('/api/v1/quizzes/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          quizId: generatedQuizId,
          totalTimeSpentSeconds: 50,
          answers: [
            {
              questionId: questionsToAnswer[0]._id,
              selectedOptionIndex: 99, // Out of range [0-3]
              timeSpentSeconds: 10,
            },
          ],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/quizzes/history', () => {
    it('should retrieve past quiz attempts filtered by topic', async () => {
      const res = await request(app)
        .get('/api/v1/quizzes/history?topic=Docker%20Containers')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].topic).toBe('Docker Containers');
    });

    it('should return empty array for topic with no previous attempts', async () => {
      const res = await request(app)
        .get('/api/v1/quizzes/history?topic=Unattempted%20Topic')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });
});