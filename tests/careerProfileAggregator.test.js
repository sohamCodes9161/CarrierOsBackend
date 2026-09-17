import { describe, it, expect } from '@jest/globals';
import { aggregateCareerProfile } from '../src/utils/careerProfileAggregator.js';

const resumeAnalysis = {
  _id: 'resume-analysis-1',
  atsScore: 78,
  jobMatchScore: 82,
  createdAt: new Date('2026-01-01'),
  extractedSkills: ['Node.js', 'MongoDB', 'Express'],
  strengths: ['Clear structure', 'Good use of metrics'],
  weaknesses: ['Missing quantified impact', 'No contact info'],
};

const githubAnalysis = {
  _id: 'github-analysis-1',
  estimatedSkillLevel: 'intermediate',
  totalStars: 42,
  githubUsername: 'janedoe',
  createdAt: new Date('2026-01-05'),
  inferredSkills: ['node.js', 'MongoDB', 'Docker'], // deliberately different casing than resume's "Node.js"
  strengths: ['Consistent commit activity', 'Good use of metrics'], // "Good use of metrics" overlaps with resume
  areasForImprovement: ['Limited test coverage', 'No contact info'], // overlaps with resume weakness
};

function makeCompletedInterview({ targetSkills, strengths, weaknesses, overallScore, completedAt }) {
  return {
    status: 'completed',
    targetSkills,
    completedAt,
    finalReport: { overallScore, strengths, weaknesses },
  };
}

describe('aggregateCareerProfile', () => {
  it('returns null summaries when a source is missing, without crashing', () => {
    const result = aggregateCareerProfile({ resumeAnalysis: null, githubAnalysis: null, interviews: [] });
    expect(result.resumeSummary).toBeNull();
    expect(result.githubSummary).toBeNull();
    expect(result.interviewSummary).toEqual({
      interviewsCompleted: 0,
      averageScore: null,
      lastInterviewAt: null,
    });
    expect(result.skills).toEqual([]);
  });

  it('merges skills across sources and tracks which sources confirm each one', () => {
    const result = aggregateCareerProfile({ resumeAnalysis, githubAnalysis, interviews: [] });

    const mongo = result.skills.find((s) => s.name.toLowerCase() === 'mongodb');
    expect(mongo.sources).toEqual(['github', 'resume']); // confirmed by both, case-insensitively matched

    const docker = result.skills.find((s) => s.name.toLowerCase() === 'docker');
    expect(docker.sources).toEqual(['github']); // only github mentions it
  });

  it('deduplicates skills that differ only in case/whitespace', () => {
    const result = aggregateCareerProfile({ resumeAnalysis, githubAnalysis, interviews: [] });
    const nodeEntries = result.skills.filter((s) => s.name.toLowerCase() === 'node.js');
    expect(nodeEntries).toHaveLength(1); // "Node.js" (resume) and "node.js" (github) merged into one
  });

  it('sorts skills by number of confirming sources, most-confirmed first', () => {
    const result = aggregateCareerProfile({ resumeAnalysis, githubAnalysis, interviews: [] });
    const sourceCounts = result.skills.map((s) => s.sources.length);
    const isDescending = sourceCounts.every((v, i) => i === 0 || sourceCounts[i - 1] >= v);
    expect(isDescending).toBe(true);
  });

  it('deduplicates strengths/weaknesses that overlap across sources', () => {
    const result = aggregateCareerProfile({ resumeAnalysis, githubAnalysis, interviews: [] });
    const metricsCount = result.strengths.filter((s) => s.toLowerCase() === 'good use of metrics').length;
    expect(metricsCount).toBe(1);
    const contactCount = result.growthAreas.filter((s) => s.toLowerCase() === 'no contact info').length;
    expect(contactCount).toBe(1);
  });

  it('only counts completed interviews with a finalReport toward the interview summary', () => {
    const interviews = [
      makeCompletedInterview({
        targetSkills: ['Node.js'],
        strengths: ['Good communicator'],
        weaknesses: ['Vague on edge cases'],
        overallScore: 80,
        completedAt: new Date('2026-02-01'),
      }),
      { status: 'in_progress', targetSkills: ['Python'], finalReport: null, completedAt: null }, // should be ignored
    ];

    const result = aggregateCareerProfile({ resumeAnalysis: null, githubAnalysis: null, interviews });
    expect(result.interviewSummary.interviewsCompleted).toBe(1);
    expect(result.skills.some((s) => s.name === 'Python')).toBe(false);
  });

  it('computes the average interview score correctly across multiple interviews', () => {
    const interviews = [
      makeCompletedInterview({ targetSkills: [], strengths: [], weaknesses: [], overallScore: 60, completedAt: new Date('2026-01-01') }),
      makeCompletedInterview({ targetSkills: [], strengths: [], weaknesses: [], overallScore: 80, completedAt: new Date('2026-02-01') }),
      makeCompletedInterview({ targetSkills: [], strengths: [], weaknesses: [], overallScore: 90, completedAt: new Date('2026-03-01') }),
    ];
    const result = aggregateCareerProfile({ resumeAnalysis: null, githubAnalysis: null, interviews });
    expect(result.interviewSummary.averageScore).toBeCloseTo(76.7, 1);
  });

  it('reports lastInterviewAt as the most recent completed interview regardless of input order', () => {
    const older = makeCompletedInterview({ targetSkills: [], strengths: [], weaknesses: [], overallScore: 70, completedAt: new Date('2026-01-01') });
    const newer = makeCompletedInterview({ targetSkills: [], strengths: [], weaknesses: [], overallScore: 85, completedAt: new Date('2026-06-01') });

    // deliberately pass them out of chronological order
    const result = aggregateCareerProfile({ resumeAnalysis: null, githubAnalysis: null, interviews: [older, newer] });
    expect(result.interviewSummary.lastInterviewAt).toEqual(newer.completedAt);
  });

  it('caps merged strengths/growthAreas lists at 10 items', () => {
    const manyWeaknesses = Array.from({ length: 15 }, (_, i) => `Weakness ${i}`);
    const result = aggregateCareerProfile({
      resumeAnalysis: { ...resumeAnalysis, weaknesses: manyWeaknesses },
      githubAnalysis: null,
      interviews: [],
    });
    expect(result.growthAreas.length).toBeLessThanOrEqual(10);
  });

  it('includes interview targetSkills in the aggregated skill list', () => {
    const interviews = [
      makeCompletedInterview({ targetSkills: ['GraphQL'], strengths: [], weaknesses: [], overallScore: 75, completedAt: new Date() }),
    ];
    const result = aggregateCareerProfile({ resumeAnalysis: null, githubAnalysis: null, interviews });
    const graphql = result.skills.find((s) => s.name === 'GraphQL');
    expect(graphql).toBeDefined();
    expect(graphql.sources).toEqual(['interview']);
  });
});
