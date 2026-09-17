/**
 * Pure, deterministic aggregation over GitHub API data.
 * No AI, no network calls - easy to unit test exhaustively.
 */
export function aggregateGithubStats({ user, repos, languagesByRepo }) {
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);

  // Merge language byte-counts across all repos
  const languageTotals = {};
  for (const langs of Object.values(languagesByRepo)) {
    for (const [lang, bytes] of Object.entries(langs)) {
      languageTotals[lang] = (languageTotals[lang] || 0) + bytes;
    }
  }
  const totalBytes = Object.values(languageTotals).reduce((a, b) => a + b, 0);
  const languageBreakdown = Object.entries(languageTotals)
    .map(([language, bytes]) => ({
      language,
      percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const nonForkRepos = repos.filter((r) => !r.fork);

  const topRepos = [...nonForkRepos]
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 5)
    .map((r) => ({
      name: r.name,
      description: r.description,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      url: r.html_url,
      updatedAt: r.pushed_at,
    }));

  const accountAgeYears =
    Math.round(((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365)) * 10) / 10;

  const mostRecentPush = repos.reduce((latest, r) => {
    const pushed = new Date(r.pushed_at).getTime();
    return pushed > latest ? pushed : latest;
  }, 0);

  return {
    username: user.login,
    profileUrl: user.html_url,
    bio: user.bio || null,
    followers: user.followers,
    following: user.following,
    publicRepoCount: user.public_repos,
    accountAgeYears,
    totalStars,
    totalForks,
    languageBreakdown,
    topRepos,
    lastActiveAt: mostRecentPush ? new Date(mostRecentPush).toISOString() : null,
    forkedReposExcludedFromAnalysis: repos.length - nonForkRepos.length,
  };
}
