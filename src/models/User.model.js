import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
   // Inside User.model.js
    usage: {
      date: { type: String, default: () => new Date().toISOString().split('T')[0] }, 
      interviews: { type: Number, default: 0 },
      roadmaps: { type: Number, default: 0 },
      portfolioCurations: { type: Number, default: 0 },
      
      // Matched to the exact strings you just used in your routes:
      resume_analyses: { type: Number, default: 0 },
      github_analyses: { type: Number, default: 0 },
      quizzes: { type: Number, default: 0 },
      career_profiles: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Never leak passwordHash
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);