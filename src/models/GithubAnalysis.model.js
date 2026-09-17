import mongoose from 'mongoose';

const githubAnalysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    githubUsername: { type: String, required: true, index: true },

    // --- Deterministic stats ---
    profileUrl: String,
    bio: String,
    followers: Number,
    following: Number,
    publicRepoCount: Number,
    accountAgeYears: Number,
    totalStars: Number,
    totalForks: Number,
    languageBreakdown: [
      {
        language: String,
        percentage: Number,
      },
    ],
    topRepos: [
      {
        name: String,
        description: String,
        stars: Number,
        forks: Number,
        language: String,
        url: String,
        updatedAt: String,
      },
    ],
    lastActiveAt: Date,

    // --- Recent commit activity (from public events, last ~90 days) ---
    commitCountLast30Days: Number,
    commitCountLast90Days: Number,
    activeDaysLast90: Number,

    // --- Repo health checklist per top repo ---
    repoHealth: [
      {
        repoName: String,
        hasReadme: Boolean,
        hasLicense: Boolean,
        hasTests: Boolean,
        hasCI: Boolean,
        hasGitignore: Boolean,
        hasPackageJson: Boolean,
        healthScore: Number,
      },
    ],

    // --- AI analysis ---
    summary: { type: String, required: true },
    estimatedSkillLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
    strengths: [String],
    areasForImprovement: [String],
    inferredSkills: [String],
    projectHighlights: [
      {
        repoName: String,
        whyItStandsOut: String,
      },
    ],
    activityAssessment: String,
  },
  { timestamps: true }
);

export const GithubAnalysis = mongoose.model('GithubAnalysis', githubAnalysisSchema);
