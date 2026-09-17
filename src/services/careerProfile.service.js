import { CareerProfile } from '../models/CareerProfile.model.js';
import { ResumeAnalysis } from '../models/ResumeAnalysis.model.js';
import { GithubAnalysis } from '../models/GithubAnalysis.model.js';
import { Interview } from '../models/Interview.model.js';
import { generateStructuredContent } from '../integrations/groq.integration.js';
import {
  buildCareerProfilePrompt,
  careerProfileNarrativeSchema,
  careerProfileNarrativeSchemaName,
} from '../integrations/prompts/careerProfile.prompt.js';
import { aggregateCareerProfile } from '../utils/careerProfileAggregator.js';
import { BadRequestError, NotFoundError } from '../errors/AppError.js';

export async function generateCareerProfile(userId) {
  const [resumeAnalysis, githubAnalysis, interviews] = await Promise.all([
    ResumeAnalysis.findOne({ user: userId }).sort({ createdAt: -1 }),
    GithubAnalysis.findOne({ user: userId }).sort({ createdAt: -1 }),
    Interview.find({ user: userId, status: 'completed' }).select('targetSkills finalReport completedAt status'),
  ]);

  if (!resumeAnalysis && !githubAnalysis && interviews.length === 0) {
    throw new BadRequestError(
      'Complete at least one resume analysis, GitHub analysis, or interview before generating a career profile.'
    );
  }

  const aggregate = aggregateCareerProfile({ resumeAnalysis, githubAnalysis, interviews });

  const prompt = buildCareerProfilePrompt(aggregate);
  const aiResult = await generateStructuredContent({
    prompt,
    responseSchema: careerProfileNarrativeSchema,
    schemaName: careerProfileNarrativeSchemaName,
  });

  // upsert via findOneAndUpdate, not fetch-then-save - deliberately avoids
  // the optimistic-concurrency race we hit and fixed in the interview module.
  const profile = await CareerProfile.findOneAndUpdate(
    { user: userId },
    {
      user: userId,
      skills: aggregate.skills,
      strengths: aggregate.strengths,
      growthAreas: aggregate.growthAreas,
      resumeSummary: aggregate.resumeSummary,
      githubSummary: aggregate.githubSummary,
      interviewSummary: aggregate.interviewSummary,
      narrative: aiResult.narrative,
      overallReadinessLevel: aiResult.overallReadinessLevel,
      topPriorityFocus: aiResult.topPriorityFocus,
      generatedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return profile;
}

export async function getCareerProfile(userId) {
  const profile = await CareerProfile.findOne({ user: userId });
  if (!profile) {
    throw new NotFoundError('No career profile has been generated yet. Generate one first.');
  }
  return profile;
}
