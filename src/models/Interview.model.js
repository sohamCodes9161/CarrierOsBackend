import mongoose from 'mongoose';

const evaluationSchema = new mongoose.Schema(
  {
    correctnessScore: Number,
    communicationScore: Number,
    missingConcepts: [String],
    strengths: [String],
    weaknesses: [String],
    feedback: String,
  },
  { _id: false }
);

const questionTurnSchema = new mongoose.Schema({
  questionNumber: { type: Number, required: true },
  questionText: { type: String, required: true },
  focusArea: { type: String, required: true },
  askedAt: { type: Date, default: Date.now },
  answerText: { type: String, default: null },
  answeredAt: { type: Date, default: null },
  evaluation: { type: evaluationSchema, default: null },
  questionAudioUrl: { type: String, default: null },
  questionAudioPublicId: { type: String, default: null },
});

const finalReportSchema = new mongoose.Schema(
  {
    overallScore: Number,
    summary: String,
    strengths: [String],
    weaknesses: [String],
    recommendation: String,
    readyForRole: Boolean,
    audioUrl: { type: String, default: null },
    audioPublicId: { type: String, default: null },
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    interviewType: { type: String, enum: ['technical', 'behavioral', 'mixed', 'dsa'], required: true },
    targetSkills: [String],
    totalQuestions: { type: Number, required: true },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress', index: true },
    voiceEnabled: { type: Boolean, default: false },
    greetingAudioUrl: { type: String, default: null },
    greetingAudioPublicId: { type: String, default: null },
    questions: [questionTurnSchema],
    finalReport: { type: finalReportSchema, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Interview = mongoose.model('Interview', interviewSchema);
