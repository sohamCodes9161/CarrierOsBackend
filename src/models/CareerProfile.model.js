import mongoose from 'mongoose';

const careerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    skills: [
      {
        name: String,
        sources: [String], // subset of ['resume', 'github', 'interview']
        mentionCount: Number,
      },
    ],
    strengths: [String],
    growthAreas: [String],
    resumeSummary: {
      type: new mongoose.Schema(
        {
          atsScore: Number,
          jobMatchScore: Number,
          analyzedAt: Date,
          resumeAnalysisId: mongoose.Schema.Types.ObjectId,
        },
        { _id: false }
      ),
      default: null,
    },
    githubSummary: {
      type: new mongoose.Schema(
        {
          estimatedSkillLevel: String,
          totalStars: Number,
          githubUsername: String,
          analyzedAt: Date,
          githubAnalysisId: mongoose.Schema.Types.ObjectId,
        },
        { _id: false }
      ),
      default: null,
    },
    interviewSummary: {
      type: new mongoose.Schema(
        {
          interviewsCompleted: { type: Number, default: 0 },
          averageScore: { type: Number, default: null },
          lastInterviewAt: { type: Date, default: null },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    narrative: { type: String, required: true },
    overallReadinessLevel: {
      type: String,
      enum: ['early-stage', 'developing', 'job-ready', 'strong'],
      required: true,
    },
    topPriorityFocus: [String],
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const CareerProfile = mongoose.model('CareerProfile', careerProfileSchema);
