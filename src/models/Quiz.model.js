import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: [
        (val) => val.length === 4,
        'Each question must have exactly 4 options',
      ],
    },
    correctOptionIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
      select: false, // Hidden by default when fetching quizzes for active attempts
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    roadmap: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Roadmap',
      default: null,
    },
    nodeId: {
      type: String,
      default: null,
    },
    difficultyLevel: {
      type: String,
      enum: ['easy', 'balanced', 'mastery'],
      default: 'balanced',
    },
    timeLimitSeconds: {
      type: Number,
      required: true,
      default: 300, // 5 minutes default for micro-quizzes
    },
    questions: [questionSchema],
  },
  {
    timestamps: true,
  }
);

quizSchema.index({ user: 1, topic: 1 });

export const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;