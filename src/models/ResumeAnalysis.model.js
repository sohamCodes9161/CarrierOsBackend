import mongoose from 'mongoose';

const resumeAnalysisSchema = new mongoose.Schema(
  {
    resume: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    jobDescription: { type: String, default: null },
    atsScore: { type: Number, required: true },
    jobMatchScore: { type: Number, required: true }, // -1 if no job description was given
    summary: { type: String, required: true },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    missingKeywords: [{ type: String }],
    extractedSkills: [{ type: String }],
    sectionFeedback: [
      {
        section: String,
        feedback: String,
      },
    ],
    suggestedBulletImprovements: [
      {
        original: String,
        improved: String,
        reason: String,
      },
    ],
  },
  { timestamps: true }
);

export const ResumeAnalysis = mongoose.model('ResumeAnalysis', resumeAnalysisSchema);
