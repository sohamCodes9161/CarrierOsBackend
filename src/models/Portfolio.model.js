import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    email: String,
    phone: String,
    location: String,
    website: String,
    linkedin: String,
    github: String,
    twitter: String,
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  techStack: [String],
  githubUrl: String,
  liveUrl: String,
  imageUrl: String, // external URL only - no upload endpoint in V1
  featured: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
});

const experienceSchema = new mongoose.Schema({
  company: { type: String, required: true },
  role: { type: String, required: true },
  startDate: String, // free-text-ish (e.g. "2023-06") - portfolio dates vary in granularity
  endDate: { type: String, default: null }, // null = present/ongoing
  description: String,
  order: { type: Number, default: 0 },
});

const educationSchema = new mongoose.Schema({
  institution: { type: String, required: true },
  degree: { type: String, required: true },
  fieldOfStudy: String,
  startDate: String,
  endDate: String,
  order: { type: Number, default: 0 },
});

const achievementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  date: String,
  order: { type: Number, default: 0 },
});

const portfolioSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    slug: { type: String, unique: true, sparse: true, index: true }, // sparse - not every portfolio has claimed a slug yet
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    headline: { type: String, default: '' },
    bio: { type: String, default: '' },
    contact: { type: contactSchema, default: () => ({}) },
    skills: [String],
    projects: [projectSchema],
    experience: [experienceSchema],
    education: [educationSchema],
    achievements: [achievementSchema],
    templateId: { type: String, default: 'minimal' },
    themeColor: { type: String, default: null },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Portfolio = mongoose.model('Portfolio', portfolioSchema);
