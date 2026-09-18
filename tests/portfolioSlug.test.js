import { describe, it, expect } from '@jest/globals';
import {
  isValidSlugFormat,
  isReservedSlug,
  mergeSkillsDedup,
  mergeProjectsDedup,
} from '../src/utils/portfolioSlug.js';

describe('isValidSlugFormat', () => {
  it('accepts a simple valid slug', () => {
    expect(isValidSlugFormat('janedoe')).toBe(true);
  });

  it('accepts a slug with hyphens and numbers', () => {
    expect(isValidSlugFormat('jane-doe-99')).toBe(true);
  });

  it('rejects a slug shorter than 3 characters', () => {
    expect(isValidSlugFormat('ab')).toBe(false);
  });

  it('rejects a slug with a leading hyphen', () => {
    expect(isValidSlugFormat('-janedoe')).toBe(false);
  });

  it('rejects a slug with consecutive hyphens', () => {
    expect(isValidSlugFormat('jane--doe')).toBe(false);
  });

  it('rejects uppercase letters', () => {
    expect(isValidSlugFormat('JaneDoe')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidSlugFormat('jane_doe!')).toBe(false);
  });

  it('rejects non-string input without throwing', () => {
    expect(isValidSlugFormat(undefined)).toBe(false);
    expect(isValidSlugFormat(null)).toBe(false);
    expect(isValidSlugFormat(123)).toBe(false);
  });
});

describe('isReservedSlug', () => {
  it('flags known reserved words', () => {
    expect(isReservedSlug('admin')).toBe(true);
    expect(isReservedSlug('api')).toBe(true);
    expect(isReservedSlug('portfolio')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isReservedSlug('ADMIN')).toBe(true);
  });

  it('does not flag an ordinary name', () => {
    expect(isReservedSlug('janedoe')).toBe(false);
  });
});

describe('mergeSkillsDedup', () => {
  it('adds new skills not already present', () => {
    const result = mergeSkillsDedup(['Node.js'], ['MongoDB', 'Docker']);
    expect(result).toEqual(['Node.js', 'MongoDB', 'Docker']);
  });

  it('does not duplicate a skill that already exists, case/whitespace-insensitively', () => {
    const result = mergeSkillsDedup(['Node.js'], ['  node.JS  ', 'MongoDB']);
    expect(result).toEqual(['Node.js', 'MongoDB']);
  });

  it('is idempotent - calling it twice with the same new skills changes nothing the second time', () => {
    const first = mergeSkillsDedup(['Node.js'], ['MongoDB']);
    const second = mergeSkillsDedup(first, ['MongoDB']);
    expect(second).toEqual(first);
  });

  it('handles empty inputs', () => {
    expect(mergeSkillsDedup([], [])).toEqual([]);
    expect(mergeSkillsDedup(['Node.js'], [])).toEqual(['Node.js']);
  });
});

describe('mergeProjectsDedup', () => {
  const existingProject = { title: 'API Project', githubUrl: 'https://github.com/jane/api', order: 0 };

  it('adds a new project with a distinct githubUrl', () => {
    const result = mergeProjectsDedup([existingProject], [{ title: 'New Repo', githubUrl: 'https://github.com/jane/new-repo' }]);
    expect(result).toHaveLength(2);
  });

  it('does not duplicate a project with the same githubUrl (case-insensitive)', () => {
    const result = mergeProjectsDedup(
      [existingProject],
      [{ title: 'API Project Again', githubUrl: 'HTTPS://GITHUB.COM/JANE/API' }]
    );
    expect(result).toHaveLength(1);
  });

  it('is idempotent - running quick-start twice with the same repos does not duplicate them', () => {
    const suggested = [{ title: 'Repo A', githubUrl: 'https://github.com/jane/a' }];
    const first = mergeProjectsDedup([], suggested);
    const second = mergeProjectsDedup(first, suggested);
    expect(second).toHaveLength(1);
  });

  it('assigns sequential order values to newly added projects', () => {
    const result = mergeProjectsDedup([existingProject], [
      { title: 'B', githubUrl: 'https://github.com/jane/b' },
      { title: 'C', githubUrl: 'https://github.com/jane/c' },
    ]);
    expect(result[1].order).toBe(1);
    expect(result[2].order).toBe(2);
  });

  it('adds projects without a githubUrl without crashing (no dedup key to check)', () => {
    const result = mergeProjectsDedup([], [{ title: 'No URL project' }]);
    expect(result).toHaveLength(1);
  });
});
