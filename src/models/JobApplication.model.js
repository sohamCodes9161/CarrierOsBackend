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

const jobApplicationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    jobTitle: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
    },
    jobUrl: {
      type: String,
      trim: true,
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
    status: {
      type: String,
      enum: {
        values: [
          'bookmarked',
          'applied',
          'screening',
          'interviewing',
          'offered',
          'rejected',
          'withdrawn',
        ],
        message: '{VALUE} is not a valid status',
      },
      default: 'applied',
      index: true,
    },
    appliedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user dashboard & pipeline queries
jobApplicationSchema.index({ user: 1, status: 1 });
jobApplicationSchema.index({ user: 1, appliedDate: -1 });

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);

export default JobApplication;