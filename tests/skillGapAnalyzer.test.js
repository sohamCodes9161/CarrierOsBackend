import { describe, it, expect } from '@jest/globals';
import { computeSkillGap, filterNodesAgainstKnownSkills } from '../src/utils/skillGapAnalyzer.js';

describe('computeSkillGap', () => {
  const profileSkills = [{ name: 'Node.js' }, { name: 'MongoDB' }, { name: 'Express' }];

  it('correctly splits target skills into already-have and missing', () => {
    const result = computeSkillGap({ targetSkills: ['Node.js', 'Docker', 'Kubernetes'], profileSkills });
    expect(result.alreadyHave).toEqual(['Node.js']);
    expect(result.missing).toEqual(['Docker', 'Kubernetes']);
  });

  it('matches case/whitespace-insensitively', () => {
    const result = computeSkillGap({ targetSkills: ['  node.JS  ', 'MONGODB'], profileSkills });
    expect(result.alreadyHave).toHaveLength(2);
    expect(result.missing).toHaveLength(0);
  });

  it('returns empty arrays when no target skills are given', () => {
    const result = computeSkillGap({ targetSkills: [], profileSkills });
    expect(result.alreadyHave).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('returns everything as missing when the profile has no skills', () => {
    const result = computeSkillGap({ targetSkills: ['Python', 'Django'], profileSkills: [] });
    expect(result.missing).toEqual(['Python', 'Django']);
  });

  it('handles undefined targetSkills without crashing', () => {
    const result = computeSkillGap({ targetSkills: undefined, profileSkills });
    expect(result).toEqual({ alreadyHave: [], missing: [] });
  });
});

describe('filterNodesAgainstKnownSkills', () => {
  const profileSkills = [{ name: 'Node.js' }, { name: 'MongoDB' }];

  it('drops nodes whose title matches a known skill exactly', () => {
    const nodes = [{ title: 'Node.js' }, { title: 'Docker' }];
    const result = filterNodesAgainstKnownSkills(nodes, profileSkills);
    expect(result).toEqual([{ title: 'Docker' }]);
  });

  it('drops nodes whose title matches case/whitespace-insensitively', () => {
    const nodes = [{ title: '  NODE.JS  ' }, { title: 'Kubernetes' }];
    const result = filterNodesAgainstKnownSkills(nodes, profileSkills);
    expect(result).toEqual([{ title: 'Kubernetes' }]);
  });

  it('keeps all nodes when profile has no skills', () => {
    const nodes = [{ title: 'Docker' }, { title: 'Kubernetes' }];
    const result = filterNodesAgainstKnownSkills(nodes, []);
    expect(result).toHaveLength(2);
  });
});
