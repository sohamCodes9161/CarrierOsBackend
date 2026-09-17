import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    title: String,
    type: { type: String, enum: ['article', 'video', 'course', 'official-docs', 'book'] },
    description: String,
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
  },
  { _id: false }
);

const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // slug, stable within this roadmap - used for prerequisiteIds references
    title: { type: String, required: true },
    description: String,
    category: String,
    complexityTier: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    importance: { type: String, enum: ['core', 'important', 'nice-to-have'] },
    prerequisiteIds: [String],
    learningOrder: Number,
    priorityScore: Number,
    priorityLabel: { type: String, enum: ['critical', 'high', 'medium', 'low'] },
    estimatedDurationDays: Number,
    resources: [resourceSchema],
    suggestedProjects: [projectSchema],
    status: { type: String, enum: ['not_started', 'in_progress', 'completed', 'skipped'], default: 'not_started' },
  },
  { _id: false }
);

const milestoneSchema = new mongoose.Schema(
  {
    order: Number,
    title: String,
    nodeIds: [String],
    estimatedDurationDays: Number,
  },
  { _id: false }
);

const roadmapSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetRole: { type: String, required: true },
    targetRoleKey: { type: String, required: true }, // normalized (lowercase/trimmed) for the uniqueness match
    targetSkillsRequested: [String],
    skillGap: {
      type: new mongoose.Schema(
        {
          alreadyHave: [String],
          missing: [String],
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    careerProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareerProfile' },
    overallSummary: { type: String, required: true },
    totalEstimatedDurationDays: Number,
    nodes: [nodeSchema],
    milestones: [milestoneSchema],
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// One roadmap per (user, target role) - regenerating for the same role updates in place.
roadmapSchema.index({ user: 1, targetRoleKey: 1 }, { unique: true });

export const Roadmap = mongoose.model('Roadmap', roadmapSchema);
