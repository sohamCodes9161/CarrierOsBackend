function normalizeKey(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Merges multiple string lists, deduplicating case/whitespace-insensitively,
 * preserving the first-seen casing, and sorting by frequency across lists. */
function mergeStringList(lists, limit = 10) {
  const map = new Map();
  for (const list of lists) {
    for (const raw of list) {
      if (!raw) continue;
      const key = normalizeKey(raw);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { text: raw.trim(), count: 0 });
      map.get(key).count += 1;
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((v) => v.text);
}

/** Merges skills from multiple sources, tracking which sources confirm each
 * skill and how many times it was mentioned overall - the "sources" list is
 * what lets a caller trust a skill more when multiple independent analyses
 * agree on it. */
function aggregateSkills({ resumeSkills = [], githubSkills = [], interviewSkills = [] }) {
  const map = new Map();
  const addAll = (skills, sourceName) => {
    for (const raw of skills) {
      if (!raw) continue;
      const key = normalizeKey(raw);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { name: raw.trim(), sources: new Set(), count: 0 });
      const entry = map.get(key);
      entry.sources.add(sourceName);
      entry.count += 1;
    }
  };
  addAll(resumeSkills, 'resume');
  addAll(githubSkills, 'github');
  addAll(interviewSkills, 'interview');

  return [...map.values()]
    .map((e) => ({ name: e.name, sources: [...e.sources].sort(), mentionCount: e.count }))
    .sort((a, b) => b.sources.length - a.sources.length || b.mentionCount - a.mentionCount);
}

/**
 * Combines the latest resume analysis, latest GitHub analysis, and all
 * completed interviews for a user into one deterministic aggregate. No AI
 * involved here - this is pure data merging, testable in isolation, and is
 * what the AI narrative step (see careerProfile.prompt.js) is grounded in.
 */
export function aggregateCareerProfile({ resumeAnalysis, githubAnalysis, interviews }) {
  const completedInterviews = interviews
    .filter((i) => i.status === 'completed' && i.finalReport)
    .slice()
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const skills = aggregateSkills({
    resumeSkills: resumeAnalysis?.extractedSkills || [],
    githubSkills: githubAnalysis?.inferredSkills || [],
    interviewSkills: completedInterviews.flatMap((i) => i.targetSkills || []),
  });

  const strengths = mergeStringList([
    resumeAnalysis?.strengths || [],
    githubAnalysis?.strengths || [],
    completedInterviews.flatMap((i) => i.finalReport.strengths || []),
  ]);

  const growthAreas = mergeStringList([
    resumeAnalysis?.weaknesses || [],
    githubAnalysis?.areasForImprovement || [],
    completedInterviews.flatMap((i) => i.finalReport.weaknesses || []),
  ]);

  const interviewScores = completedInterviews
    .map((i) => i.finalReport.overallScore)
    .filter((s) => typeof s === 'number');
  const averageInterviewScore =
    interviewScores.length > 0
      ? Math.round((interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length) * 10) / 10
      : null;

  return {
    skills,
    strengths,
    growthAreas,
    resumeSummary: resumeAnalysis
      ? {
          atsScore: resumeAnalysis.atsScore,
          jobMatchScore: resumeAnalysis.jobMatchScore,
          analyzedAt: resumeAnalysis.createdAt,
          resumeAnalysisId: resumeAnalysis._id,
        }
      : null,
    githubSummary: githubAnalysis
      ? {
          estimatedSkillLevel: githubAnalysis.estimatedSkillLevel,
          totalStars: githubAnalysis.totalStars,
          githubUsername: githubAnalysis.githubUsername,
          analyzedAt: githubAnalysis.createdAt,
          githubAnalysisId: githubAnalysis._id,
        }
      : null,
    interviewSummary: {
      interviewsCompleted: completedInterviews.length,
      averageScore: averageInterviewScore,
      lastInterviewAt: completedInterviews.length > 0 ? completedInterviews[0].completedAt : null,
    },
  };
}
