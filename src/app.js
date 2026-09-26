import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { sendSuccess } from './utils/apiResponse.js';
import authRoutes from './routes/auth.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import githubRoutes from './routes/github.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import careerProfileRoutes from './routes/careerProfile.routes.js';
import roadmapRoutes from './routes/roadmap.routes.js';
import portfolioRoutes from './routes/portfolio.routes.js';
import jobApplicationRoutes from './routes/jobApplication.routes.js';
import jobSearchRoutes from './routes/jobSearch.routes.js';
import quizRoutes from './routes/quiz.routes.js';


import dashboardRoutes from './routes/dashboard.routes.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Static test harness (dev/testing only) - mounted BEFORE helmet so its
// CSP doesn't block <audio> playback from Cloudinary's different origin.
// Every other route below still gets full Helmet protection.
app.use('/test', express.static(path.join(__dirname, '../public')));

// --- Security & core middleware ---
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true, // required so the refresh-token cookie can be sent/received
  })
);
app.use(express.json({ limit: '10kb' })); // small limit; file uploads (resumes) will use a dedicated route/limit later
app.use(cookieParser());

if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Generic rate limiter for all API routes; auth routes get a stricter one later
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// --- Health check ---
app.get('/api/v1/health', (req, res) => {
  sendSuccess(res, { data: { status: 'ok', uptime: process.uptime() } });
});

// --- Routes ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/resumes', resumeRoutes);
app.use('/api/v1/github', githubRoutes);
app.use('/api/v1/interviews', interviewRoutes);
app.use('/api/v1/career-profile', careerProfileRoutes);
app.use('/api/v1/roadmap', roadmapRoutes);
app.use('/api/v1/portfolio', portfolioRoutes);
app.use('/api/v1/job-applications', jobApplicationRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/job-search', jobSearchRoutes);
app.use('/api/v1/quizzes', quizRoutes);

// --- 404 + error handling (must be last) ---
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
