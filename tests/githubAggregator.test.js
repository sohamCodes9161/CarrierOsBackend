import { describe, it, expect } from '@jest/globals';
import { aggregateGithubStats } from '../src/utils/githubAggregator.js';

const fakeUser = {
  login: 'janedoe',
  html_url: 'https://github.com/janedoe',
  bio: 'Backend engineer',
  followers: 42,
  following: 10,
  public_repos: 3,
  created_at: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString(), // ~3 years ago
};

const fakeRepos = [
  {
    name: 'payments-api',
    description: 'A payments backend',
    stargazers_count: 50,
    forks_count: 5,
    language: 'JavaScript',
    html_url: 'https://github.com/janedoe/payments-api',
    pushed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    fork: false,
  },
  {
    name: 'old-fork',
    description: null,
    stargazers_count: 0,
    forks_count: 0,
    language: 'Python',
    html_url: 'https://github.com/janedoe/old-fork',
    pushed_at: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(), // over a year ago
    fork: true,
  },
  {
    name: 'cli-tool',
    description: 'A CLI utility',
    stargazers_count: 10,
    forks_count: 1,
    language: 'TypeScript',
    html_url: 'https://github.com/janedoe/cli-tool',
    pushed_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    fork: false,
  },
];

const fakeLanguagesByRepo = {
  'payments-api': { JavaScript: 8000, HTML: 2000 },
  'old-fork': { Python: 5000 },
  'cli-tool': { TypeScript: 9000, JavaScript: 1000 },
};

describe('aggregateGithubStats', () => {
  const result = aggregateGithubStats({ user: fakeUser, repos: fakeRepos, languagesByRepo: fakeLanguagesByRepo });

  it('sums total stars across all repos', () => {
    expect(result.totalStars).toBe(60); // 50 + 0 + 10
  });

  it('sums total forks across all repos', () => {
    expect(result.totalForks).toBe(6); // 5 + 0 + 1
  });

  it('computes a normalized language breakdown that sums to ~100%', () => {
    const totalPercentage = result.languageBreakdown.reduce((sum, l) => sum + l.percentage, 0);
    expect(totalPercentage).toBeCloseTo(100, 0);
  });

  it('ranks languages by usage descending', () => {
    const languages = result.languageBreakdown.map((l) => l.language);
    const jsIndex = languages.indexOf('JavaScript');
    const htmlIndex = languages.indexOf('HTML');
    expect(jsIndex).toBeLessThan(htmlIndex); // JS (9000 total) should rank above HTML (2000)
  });

  it('excludes forked repos from topRepos', () => {
    const names = result.topRepos.map((r) => r.name);
    expect(names).not.toContain('old-fork');
  });

  it('sorts topRepos by stars descending', () => {
    expect(result.topRepos[0].name).toBe('payments-api'); // 50 stars > 10 stars
  });

  it('counts forked repos excluded from the top-repo analysis', () => {
    expect(result.forkedReposExcludedFromAnalysis).toBe(1);
  });

  it('picks the most recent pushed_at as lastActiveAt', () => {
    // payments-api was pushed 1 day ago, which is the most recent
    const daysAgo = (Date.now() - new Date(result.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24);
    expect(daysAgo).toBeLessThan(2);
  });

  it('computes a roughly correct account age in years', () => {
    expect(result.accountAgeYears).toBeGreaterThan(2.5);
    expect(result.accountAgeYears).toBeLessThan(3.5);
  });

  it('handles a user with zero repos without crashing', () => {
    const empty = aggregateGithubStats({ user: fakeUser, repos: [], languagesByRepo: {} });
    expect(empty.totalStars).toBe(0);
    expect(empty.languageBreakdown).toEqual([]);
    expect(empty.topRepos).toEqual([]);
    expect(empty.lastActiveAt).toBeNull();
  });
});
