const HEALTH_CHECK_FILES = {
  hasReadme: (name) => /^readme/i.test(name),
  hasLicense: (name) => /^license/i.test(name),
  hasGitignore: (name) => name === '.gitignore',
  hasPackageJson: (name) => name === 'package.json',
};

/**
 * Assesses a repo's root directory listing for common quality/process
 * indicators. Only looks at file/folder NAMES - never reads or executes
 * any file contents. `type` is 'file' or 'dir' as returned by GitHub.
 */
export function assessRepoHealth(rootContents) {
  const names = rootContents.map((entry) => entry.name);
  const dirs = rootContents.filter((e) => e.type === 'dir').map((e) => e.name);

  const hasReadme = names.some(HEALTH_CHECK_FILES.hasReadme);
  const hasLicense = names.some(HEALTH_CHECK_FILES.hasLicense);
  const hasGitignore = names.some(HEALTH_CHECK_FILES.hasGitignore);
  const hasPackageJson = names.some(HEALTH_CHECK_FILES.hasPackageJson);
  const hasCI = dirs.includes('.github'); // presence of workflows dir is a strong enough signal without a second API call
  const hasTests = dirs.some((d) => /^(tests?|__tests__|spec)$/i.test(d));

  const checks = { hasReadme, hasLicense, hasTests, hasCI, hasGitignore, hasPackageJson };
  const passedCount = Object.values(checks).filter(Boolean).length;
  const healthScore = Math.round((passedCount / Object.keys(checks).length) * 100);

  return { ...checks, healthScore };
}

/**
 * Aggregates a user's recent public events into an honest activity signal.
 * GitHub's events API returns at most ~300 events from the last ~90 days,
 * so this reflects genuinely recent behavior rather than a single stale
 * commit keeping a repo's pushed_at timestamp looking fresh.
 */
export function aggregateCommitActivity(events) {
  const pushEvents = events.filter((e) => e.type === 'PushEvent');

  const commitCountLast30Days = countEventsWithinDays(pushEvents, 30);
  const commitCountLast90Days = countEventsWithinDays(pushEvents, 90);

  const pushEventsLast90Days = filterEventsWithinDays(pushEvents, 90);
  const activeDays = new Set(
    pushEventsLast90Days.map((e) => new Date(e.created_at).toISOString().slice(0, 10))
  );

  const eventTypeCounts = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  return {
    commitCountLast30Days,
    commitCountLast90Days,
    activeDaysLast90 : activeDays.size,
    mostRecentEventAt: events.length > 0 ? events[0].created_at : null,
    eventTypeCounts,
  };
}

function countEventsWithinDays(events, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return events.filter((e) => new Date(e.created_at).getTime() >= cutoff).length;
}

function filterEventsWithinDays(events, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return events.filter((e) => new Date(e.created_at).getTime() >= cutoff);
}
