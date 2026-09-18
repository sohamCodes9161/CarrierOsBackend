/**
 * Checks whether a portfolio has enough content to be published. Kept as a
 * pure function (no DB access) so it's directly testable and reusable by
 * both the dedicated readiness-check endpoint and the publish action itself.
 */
export function computePublishReadiness(portfolio) {
  const missing = [];

  if (!portfolio.slug) missing.push('slug (choose a public URL)');
  if (!portfolio.headline || portfolio.headline.trim().length === 0) missing.push('headline');
  if (!portfolio.bio || portfolio.bio.trim().length === 0) missing.push('bio');

  const hasContent = (portfolio.projects?.length || 0) > 0 || (portfolio.experience?.length || 0) > 0;
  if (!hasContent) missing.push('at least one project or work experience entry');

  return { ready: missing.length === 0, missing };
}
