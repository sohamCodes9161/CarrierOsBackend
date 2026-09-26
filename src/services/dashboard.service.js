import mongoose from 'mongoose';
import { ResumeAnalysis } from '../models/ResumeAnalysis.model.js';
import { GithubAnalysis } from '../models/GithubAnalysis.model.js';
import { CareerProfile } from '../models/CareerProfile.model.js';
import { Interview } from '../models/Interview.model.js';
import { Roadmap } from '../models/Roadmap.model.js';
import { Portfolio } from '../models/Portfolio.model.js';
import JobApplication from '../models/JobApplication.model.js';

export async function getDashboard(userId) {
  // Validate if userId is a valid 24-hex ObjectId string for MongoDB queries
  const validUserObjectId =
    typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

  const [
    latestResume,
    resumeCount,
    latestGithub,
    githubCount,
    careerProfile,
    completedInterviews,
    roadmaps,
    portfolio,
    jobApplications,
  ] = await Promise.all([
    ResumeAnalysis.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .select('atsScore jobMatchScore createdAt'),
    ResumeAnalysis.countDocuments({ user: userId }),
    GithubAnalysis.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .select('estimatedSkillLevel totalStars githubUsername createdAt'),
    GithubAnalysis.countDocuments({ user: userId }),
    CareerProfile.findOne({ user: userId }).select(
      'overallReadinessLevel generatedAt skills'
    ),
    Interview.find({ user: userId, status: 'completed' }).select(
      'finalReport.overallScore completedAt'
    ),
    Roadmap.find({ user: userId }).select(
      'targetRole totalEstimatedDurationDays nodes updatedAt'
    ),
    Portfolio.findOne({ user: userId }).select(
      'isPublished slug viewCount publishedAt'
    ),
    // Query with validUserObjectId or return empty array if invalid string mock
    mongoose.Types.ObjectId.isValid(userId)
      ? JobApplication.find({ user: validUserObjectId }).select('status createdAt')
      : Promise.resolve([]),
  ]);

  const interviewScores = completedInterviews
    .map((i) => i.finalReport?.overallScore)
    .filter((s) => typeof s === 'number');
  const averageInterviewScore =
    interviewScores.length > 0
      ? Math.round(
          (interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length) *
            10
        ) / 10
      : null;
  const lastInterviewAt = completedInterviews.reduce(
    (latest, i) =>
      !latest || (i.completedAt && i.completedAt > latest)
        ? i.completedAt
        : latest,
    null
  );

  const jobStats = {
    total: jobApplications.length,
    bookmarked: 0,
    applied: 0,
    screening: 0,
    interviewing: 0,
    offered: 0,
    rejected: 0,
    withdrawn: 0,
  };

  jobApplications.forEach((app) => {
    if (Object.prototype.hasOwnProperty.call(jobStats, app.status)) {
      jobStats[app.status]++;
    }
  });

  return {
    resume: latestResume
      ? {
          atsScore: latestResume.atsScore,
          jobMatchScore: latestResume.jobMatchScore,
          analyzedAt: latestResume.createdAt,
          totalAnalyses: resumeCount,
        }
      : null,
    github: latestGithub
      ? {
          estimatedSkillLevel: latestGithub.estimatedSkillLevel,
          totalStars: latestGithub.totalStars,
          githubUsername: latestGithub.githubUsername,
          analyzedAt: latestGithub.createdAt,
          totalAnalyses: githubCount,
        }
      : null,
    careerProfile: careerProfile
      ? {
          overallReadinessLevel: careerProfile.overallReadinessLevel,
          generatedAt: careerProfile.generatedAt,
          skillCount: careerProfile.skills.length,
        }
      : null,
    interviews: {
      totalCompleted: completedInterviews.length,
      averageScore: averageInterviewScore,
      lastInterviewAt,
    },
    jobApplications: jobStats,
    roadmaps: {
      count: roadmaps.length,
      items: roadmaps.map((r) => ({
        id: r._id,
        targetRole: r.targetRole,
        totalEstimatedDurationDays: r.totalEstimatedDurationDays,
        nodeCount: r.nodes.length,
        completedNodeCount: r.nodes.filter((n) => n.status === 'completed')
          .length,
        updatedAt: r.updatedAt,
      })),
    },
    portfolio: portfolio
      ? {
          isPublished: portfolio.isPublished,
          slug: portfolio.slug,
          viewCount: portfolio.viewCount,
          publishedAt: portfolio.publishedAt,
        }
      : null,
  };
}