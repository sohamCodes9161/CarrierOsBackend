import mongoose from 'mongoose';

const salarySchema = new mongoose.Schema(
  {
    min: {
      type: Number,
      min: [0, 'Salary minimum cannot be negative'],
    },
    max: {
      type: Number,
      min: [0, 'Salary maximum cannot be negative'],
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'USD',
    },
  },
  { _id: false }
);

const jobPostingSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true,
    },
    requiredSkills: {
      type: [String],
      default: [],
      index: true,
    },
    location: {
      type: String,
      trim: true,
    },
    workplaceType: {
      type: String,
      enum: {
        values: ['remote', 'hybrid', 'on-site'],
        message: '{VALUE} is not a valid workplace type',
      },
    },
    employmentType: {
      type: String,
      enum: {
        values: ['full-time', 'part-time', 'contract', 'internship'],
        message: '{VALUE} is not a valid employment type',
      },
    },
    salary: {
      type: salarySchema,
      default: () => ({}),
    },
    jobUrl: {
      type: String,
      trim: true,
    },
    isExternal: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Search indexes for title, company, and location queries
jobPostingSchema.index({ title: 'text', company: 'text', description: 'text' });
jobPostingSchema.index({ createdAt: -1 });

export const JobPosting = mongoose.model('JobPosting', jobPostingSchema);
export default JobPosting;