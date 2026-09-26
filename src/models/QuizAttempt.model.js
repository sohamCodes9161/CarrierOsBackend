import mongoose from 'mongoose';

const userResponseSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    selectedOptionIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    accuracyPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    totalTimeSpentSeconds: {
      type: Number,
      required: true,
    },
    timeBonusMultiplier: {
      type: Number,
      default: 1.0,
    },
    userResponses: [userResponseSchema],
    aiDebrief: {
      summary: { type: String, default: '' },
      strengths: [String],
      growthAreas: [String],
      speedAnalysis: { type: String, default: '' },
      failedQuestionBreakdown: [
        {
          questionText: String,
          yourAnswer: String,
          correctAnswer: String,
          explanation: String,
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

quizAttemptSchema.index({ user: 1, topic: 1, createdAt: -1 });

export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);
export default QuizAttempt;