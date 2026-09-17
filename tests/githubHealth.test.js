import { describe, it, expect } from '@jest/globals';
import { assessRepoHealth, aggregateCommitActivity } from '../src/utils/githubHealth.js';

// Shape verified live against api.github.com/repos/nodejs/node/contents/
const wellMaintainedRepoContents = [
  { name: '.github', type: 'dir' },
  { name: '.gitignore', type: 'file' },
  { name: 'LICENSE', type: 'file' },
  { name: 'README.md', type: 'file' },
  { name: 'package.json', type: 'file' },
  { name: 'test', type: 'dir' },
  { name: 'src', type: 'dir' },
];

const bareRepoContents = [
  { name: 'index.js', type: 'file' },
  { name: 'README.md', type: 'file' },
];

describe('assessRepoHealth', () => {
  it('detects all quality signals in a well-maintained repo', () => {
    const result = assessRepoHealth(wellMaintainedRepoContents);
    expect(result).toMatchObject({
      hasReadme: true,
      hasLicense: true,
      hasTests: true,
      hasCI: true,
      hasGitignore: true,
      hasPackageJson: true,
    });
    expect(result.healthScore).toBe(100);
  });

  it('correctly identifies missing signals in a bare repo', () => {
    const result = assessRepoHealth(bareRepoContents);
    expect(result.hasReadme).toBe(true);
    expect(result.hasLicense).toBe(false);
    expect(result.hasTests).toBe(false);
    expect(result.hasCI).toBe(false);
    expect(result.healthScore).toBeLessThan(50);
  });

  it('handles an empty repo without crashing', () => {
    const result = assessRepoHealth([]);
    expect(result.healthScore).toBe(0);
  });

  it('matches license files case-insensitively (LICENSE.md, license.txt, etc.)', () => {
    const result = assessRepoHealth([{ name: 'license.txt', type: 'file' }]);
    expect(result.hasLicense).toBe(true);
  });

  it('recognizes common test directory naming variants', () => {
    expect(assessRepoHealth([{ name: '__tests__', type: 'dir' }]).hasTests).toBe(true);
    expect(assessRepoHealth([{ name: 'tests', type: 'dir' }]).hasTests).toBe(true);
    expect(assessRepoHealth([{ name: 'spec', type: 'dir' }]).hasTests).toBe(true);
  });

  it('does not count a file named "test.js" as a tests directory', () => {
    const result = assessRepoHealth([{ name: 'test.js', type: 'file' }]);
    expect(result.hasTests).toBe(false);
  });
});

describe('aggregateCommitActivity', () => {
  const now = Date.now();
  const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

  const events = [
    { type: 'PushEvent', created_at: daysAgo(1) },
    { type: 'PushEvent', created_at: daysAgo(5) },
    { type: 'PushEvent', created_at: daysAgo(5) }, // same day as above - should count as 1 active day
    { type: 'PushEvent', created_at: daysAgo(45) },
    { type: 'PushEvent', created_at: daysAgo(150) }, // outside 90-day window
    { type: 'IssuesEvent', created_at: daysAgo(2) },
  ];

  it('counts push events within the last 30 days', () => {
    const result = aggregateCommitActivity(events);
    expect(result.commitCountLast30Days).toBe(3); // day-1, day-5, day-5 are all within 30 days
  });

  it('counts push events within the last 90 days, excluding older ones', () => {
    const result = aggregateCommitActivity(events);
    expect(result.commitCountLast90Days).toBe(4); // excludes the 150-days-ago push
  });

  it('deduplicates active days correctly, scoped to the last 90 days', () => {
    const result = aggregateCommitActivity(events);
    expect(result.activeDaysLast90).toBe(3); // day-1, day-5, day-45 (150-days-ago push correctly excluded)
  });

  it('handles an empty event list without crashing', () => {
    const result = aggregateCommitActivity([]);
    expect(result.commitCountLast30Days).toBe(0);
    expect(result.mostRecentEventAt).toBeNull();
  });

  it('counts event types across all events, not just pushes', () => {
    const result = aggregateCommitActivity(events);
    expect(result.eventTypeCounts.PushEvent).toBe(5);
    expect(result.eventTypeCounts.IssuesEvent).toBe(1);
  });
});
