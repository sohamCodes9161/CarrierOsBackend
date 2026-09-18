// Same style as GitHub username validation, but for our own public portfolio URLs.
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,38}$/;

// Words that would collide with real routes, look official, or invite abuse
// if claimed as a public portfolio slug.
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'login', 'logout', 'register', 'public',
  'portfolio', 'portfolios', 'roadmap', 'roadmaps', 'interview', 'interviews',
  'resume', 'resumes', 'github', 'career-profile', 'health', 'test', 'www',
  'support', 'help', 'about', 'contact', 'settings', 'null', 'undefined',
]);

export function isValidSlugFormat(slug) {
  return typeof slug === 'string' && SLUG_REGEX.test(slug);
}

export function isReservedSlug(slug) {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export function normalizeKey(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Merges new skill suggestions into an existing list, deduplicating
 * case/whitespace-insensitively so quick-start is safe to run repeatedly
 * without producing duplicate entries. */
export function mergeSkillsDedup(existingSkills, newSkills) {
  const seen = new Set(existingSkills.map(normalizeKey));
  const merged = [...existingSkills];
  for (const skill of newSkills) {
    const key = normalizeKey(skill);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(skill.trim());
  }
  return merged;
}

/** Merges new project suggestions into an existing list, deduplicating by
 * githubUrl (the stable identifier for a repo-sourced suggestion) so
 * quick-start doesn't re-add the same repo as a duplicate project on a
 * second run. */
export function mergeProjectsDedup(existingProjects, newProjects) {
  const seenUrls = new Set(
    existingProjects.filter((p) => p.githubUrl).map((p) => p.githubUrl.toLowerCase())
  );
  const merged = [...existingProjects];
  let nextOrder = existingProjects.length;
  for (const project of newProjects) {
    if (project.githubUrl && seenUrls.has(project.githubUrl.toLowerCase())) continue;
    if (project.githubUrl) seenUrls.add(project.githubUrl.toLowerCase());
    merged.push({ ...project, order: nextOrder });
    nextOrder += 1;
  }
  return merged;
}
