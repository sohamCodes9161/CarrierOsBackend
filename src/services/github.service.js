import { GithubAnalysis } from '../models/GithubAnalysis.model.js';
import {
  fetchGithubUser,
  fetchUserRepos,
  fetchRepoLanguages,
  fetchRepoReadme,
  fetchUserPublicEvents,
  fetchRepoRootContents,
} from '../integrations/github.integration.js';
import { aggregateGithubStats } from '../utils/githubAggregator.js';
import { assessRepoHealth, aggregateCommitActivity } from '../utils/githubHealth.js';
import { generateStructuredContent } from '../integrations/groq.integration.js';
import {
  buildGithubAnalysisPrompt,
  githubAnalysisSchema,
  githubAnalysisSchemaName,
} from '../integrations/prompts/githubAnalysis.prompt.js';
import { NotFoundError, ForbiddenError } from '../errors/AppError.js';

const README_EXCERPT_REPO_COUNT = 3; // only pull READMEs for the top N repos, to limit API calls

export async function analyzeGithubProfile({ userId, username }) {
  // 1. Fetch profile + repos (deterministic, read-only, metadata only)
  const user = await fetchGithubUser(username);
  const repos = await fetchUserRepos(username, 20);

  // 2. Fetch per-repo language breakdowns in parallel
  const languagesByRepo = {};
  await Promise.all(
    repos.map(async (repo) => {
      try {
        languagesByRepo[repo.name] = await fetchRepoLanguages(username, repo.name);
      } catch {
        languagesByRepo[repo.name] = {}; // don't let one repo's failure break the whole analysis
      }
    })
  );

  // 3. Deterministic aggregation
  const stats = aggregateGithubStats({ user, repos, languagesByRepo });

  // 4. Recent commit activity (from public events - more honest than pushed_at alone)
  const events = await fetchUserPublicEvents(username);
  const commitActivity = aggregateCommitActivity(events);

  // 5. Repo health checklist + README excerpts for only the top starred repos
  // (keeps API usage and AI prompt size bounded)
  const repoHealth = [];
  const readmeExcerpts = [];
  for (const repo of stats.topRepos.slice(0, README_EXCERPT_REPO_COUNT)) {
    const [readme, rootContents] = await Promise.all([
      fetchRepoReadme(username, repo.name),
      fetchRepoRootContents(username, repo.name),
    ]);

    if (readme) {
      readmeExcerpts.push({ repoName: repo.name, excerpt: readme.slice(0, 1000) });
    }
    repoHealth.push({ repoName: repo.name, ...assessRepoHealth(rootContents) });
  }

  // 6. AI analysis, schema-constrained
  const prompt = buildGithubAnalysisPrompt({ stats, commitActivity, repoHealth, readmeExcerpts });
  const aiResult = await generateStructuredContent({
    prompt,
    responseSchema: githubAnalysisSchema,
    schemaName: githubAnalysisSchemaName,
  });

  // 7. Persist merged deterministic + AI result as one document
  const analysis = await GithubAnalysis.create({
    user: userId,
    githubUsername: username,
    ...stats,
    ...commitActivity,
    repoHealth,
    ...aiResult,
  });

  return analysis;
}

export async function getGithubAnalysisById({ analysisId, userId }) {
  const analysis = await GithubAnalysis.findById(analysisId);
  if (!analysis) {
    throw new NotFoundError('GitHub analysis not found');
  }
  if (analysis.user.toString() !== userId) {
    throw new ForbiddenError('You do not have access to this analysis');
  }
  return analysis;
}

export async function listGithubAnalysesForUser(userId) {
  return GithubAnalysis.find({ user: userId })
    .sort({ createdAt: -1 })
    .select('githubUsername estimatedSkillLevel totalStars publicRepoCount createdAt');
}
