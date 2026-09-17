import { env } from '../config/env.js';
import { NotFoundError, AppError } from '../errors/AppError.js';

function authHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'CareerOS-App',
  };
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubFetch(path) {
  const res = await fetch(`${env.GITHUB_API_BASE}${path}`, { headers: authHeaders() });

  if (res.status === 404) {
    throw new NotFoundError('GitHub user or resource not found');
  }

  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      throw new AppError(
        'GitHub API rate limit exceeded. Add a GITHUB_TOKEN to increase the limit.',
        429
      );
    }
    throw new AppError('GitHub API request forbidden', 403);
  }

  if (!res.ok) {
    throw new AppError(`GitHub API error: ${res.status}`, 502);
  }

  return res.json();
}

export async function fetchGithubUser(username) {
  return githubFetch(`/users/${encodeURIComponent(username)}`);
}

/** Fetches up to `limit` repos, sorted by most recently pushed. */
export async function fetchUserRepos(username, limit = 20) {
  const repos = await githubFetch(
    `/users/${encodeURIComponent(username)}/repos?per_page=${limit}&sort=pushed&type=owner`
  );
  return repos;
}

export async function fetchRepoLanguages(username, repoName) {
  return githubFetch(`/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/languages`);
}

/**
 * Fetches only the README's text content (decoded), never any other file.
 * We explicitly do NOT fetch or execute any source code files - metadata
 * and README text only, per the security requirement.
 */
export async function fetchRepoReadme(username, repoName) {
  try {
    const data = await githubFetch(
      `/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/readme`
    );
    if (data.content && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8').slice(0, 3000); // cap length
    }
    return null;
  } catch (err) {
    if (err.statusCode === 404) return null; // no README is common and fine
    throw err;
  }
}

/**
 * Fetches the user's recent public events (pushes, PRs, issues, etc.).
 * GitHub only retains ~90 days of events and caps at 300 total, so this
 * gives us a real recent-activity signal that's more honest than a repo's
 * pushed_at timestamp (which a single stale commit can keep looking fresh).
 */
export async function fetchUserPublicEvents(username) {
  try {
    return await githubFetch(`/users/${encodeURIComponent(username)}/events/public?per_page=100`);
  } catch (err) {
    if (err.statusCode === 404) return [];
    throw err;
  }
}

/**
 * Fetches only the ROOT directory file/folder listing of a repo - names only,
 * never file contents (except README, handled separately). Used purely to
 * detect the presence of tests, CI config, license, etc. as quality signals.
 * This does not read or execute any code.
 */
export async function fetchRepoRootContents(username, repoName) {
  try {
    const data = await githubFetch(
      `/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/contents/`
    );
    return Array.isArray(data) ? data.map((entry) => ({ name: entry.name, type: entry.type })) : [];
  } catch (err) {
    if (err.statusCode === 404) return [];
    throw err;
  }
}
