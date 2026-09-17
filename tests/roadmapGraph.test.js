import { describe, it, expect } from '@jest/globals';
import { buildRoadmapGraph } from '../src/utils/roadmapGraph.js';

function node(id, overrides = {}) {
  return {
    id,
    title: id,
    description: `Description of ${id}`,
    category: 'General',
    complexityTier: 'intermediate',
    importance: 'important',
    prerequisiteIds: [],
    resources: [],
    suggestedProjects: [],
    ...overrides,
  };
}

describe('buildRoadmapGraph - basic structure', () => {
  it('assigns learningOrder starting at 1 and increasing', () => {
    const nodes = [node('a'), node('b', { prerequisiteIds: ['a'] })];
    const { nodes: result } = buildRoadmapGraph(nodes);
    const a = result.find((n) => n.id === 'a');
    const b = result.find((n) => n.id === 'b');
    expect(a.learningOrder).toBeLessThan(b.learningOrder);
  });

  it('places a node with no prerequisites before nodes that depend on it', () => {
    const nodes = [node('advanced', { prerequisiteIds: ['basics'] }), node('basics')];
    const { nodes: result } = buildRoadmapGraph(nodes);
    const basics = result.find((n) => n.id === 'basics');
    const advanced = result.find((n) => n.id === 'advanced');
    expect(basics.learningOrder).toBeLessThan(advanced.learningOrder);
  });

  it('handles a diamond-shaped dependency graph correctly (A -> B,C -> D)', () => {
    const nodes = [
      node('a'),
      node('b', { prerequisiteIds: ['a'] }),
      node('c', { prerequisiteIds: ['a'] }),
      node('d', { prerequisiteIds: ['b', 'c'] }),
    ];
    const { nodes: result } = buildRoadmapGraph(nodes);
    const order = Object.fromEntries(result.map((n) => [n.id, n.learningOrder]));
    expect(order.a).toBeLessThan(order.b);
    expect(order.a).toBeLessThan(order.c);
    expect(order.b).toBeLessThan(order.d);
    expect(order.c).toBeLessThan(order.d);
  });

  it('produces a deterministic, reproducible order for the same input', () => {
    const nodes = [node('a'), node('b', { prerequisiteIds: ['a'] }), node('c', { prerequisiteIds: ['a'] })];
    const run1 = buildRoadmapGraph(nodes).nodes.map((n) => n.id);
    const run2 = buildRoadmapGraph(nodes).nodes.map((n) => n.id);
    expect(run1).toEqual(run2);
  });
});

describe('buildRoadmapGraph - cycle removal', () => {
  it('breaks a direct two-node cycle (a depends on b, b depends on a)', () => {
    const nodes = [node('a', { prerequisiteIds: ['b'] }), node('b', { prerequisiteIds: ['a'] })];
    const { nodes: result } = buildRoadmapGraph(nodes);
    expect(result).toHaveLength(2); // no nodes lost
    // at least one of the two prerequisite edges must have been dropped
    const a = result.find((n) => n.id === 'a');
    const b = result.find((n) => n.id === 'b');
    const totalPrereqs = a.prerequisiteIds.length + b.prerequisiteIds.length;
    expect(totalPrereqs).toBeLessThan(2);
  });

  it('breaks a longer cycle (a -> b -> c -> a)', () => {
    const nodes = [
      node('a', { prerequisiteIds: ['c'] }),
      node('b', { prerequisiteIds: ['a'] }),
      node('c', { prerequisiteIds: ['b'] }),
    ];
    const { nodes: result } = buildRoadmapGraph(nodes);
    expect(result).toHaveLength(3);
    // must produce a valid, fully-ordered result despite the cycle in the input
    const orders = result.map((n) => n.learningOrder).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3]);
  });

  it('does not corrupt an already-acyclic graph', () => {
    const nodes = [node('a'), node('b', { prerequisiteIds: ['a'] }), node('c', { prerequisiteIds: ['b'] })];
    const { nodes: result } = buildRoadmapGraph(nodes);
    const b = result.find((n) => n.id === 'b');
    const c = result.find((n) => n.id === 'c');
    expect(b.prerequisiteIds).toEqual(['a']);
    expect(c.prerequisiteIds).toEqual(['b']);
  });
});

describe('buildRoadmapGraph - sanitization', () => {
  it('drops prerequisiteIds referencing a nonexistent node id', () => {
    const nodes = [node('a', { prerequisiteIds: ['does-not-exist'] })];
    const { nodes: result } = buildRoadmapGraph(nodes);
    expect(result[0].prerequisiteIds).toEqual([]);
  });

  it('drops a self-referencing prerequisite', () => {
    const nodes = [node('a', { prerequisiteIds: ['a'] })];
    const { nodes: result } = buildRoadmapGraph(nodes);
    expect(result[0].prerequisiteIds).toEqual([]);
  });

  it('deduplicates nodes with the same id, keeping the first occurrence', () => {
    const nodes = [node('a', { title: 'First A' }), node('a', { title: 'Second A' })];
    const { nodes: result } = buildRoadmapGraph(nodes);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('First A');
  });

  it('deduplicates repeated prerequisite ids on the same node', () => {
    const nodes = [node('a'), node('b', { prerequisiteIds: ['a', 'a', 'a'] })];
    const { nodes: result } = buildRoadmapGraph(nodes);
    const b = result.find((n) => n.id === 'b');
    expect(b.prerequisiteIds).toEqual(['a']);
  });
});

describe('buildRoadmapGraph - priority scoring', () => {
  it('gives a foundational node (many descendants) a higher priority score than a leaf node', () => {
    const nodes = [
      node('foundation', { importance: 'important' }),
      node('leaf1', { prerequisiteIds: ['foundation'], importance: 'important' }),
      node('leaf2', { prerequisiteIds: ['foundation'], importance: 'important' }),
      node('leaf3', { prerequisiteIds: ['foundation'], importance: 'important' }),
    ];
    const { nodes: result } = buildRoadmapGraph(nodes);
    const foundation = result.find((n) => n.id === 'foundation');
    const leaf = result.find((n) => n.id === 'leaf1');
    expect(foundation.priorityScore).toBeGreaterThan(leaf.priorityScore);
  });

  it('gives a "core" importance node a higher score than an otherwise-identical "nice-to-have" node', () => {
    const nodes = [node('a', { importance: 'core' }), node('b', { importance: 'nice-to-have' })];
    const { nodes: result } = buildRoadmapGraph(nodes);
    const a = result.find((n) => n.id === 'a');
    const b = result.find((n) => n.id === 'b');
    expect(a.priorityScore).toBeGreaterThan(b.priorityScore);
  });

  it('assigns a valid priorityLabel to every node', () => {
    const nodes = [node('a', { importance: 'core' }), node('b', { importance: 'nice-to-have' }), node('c')];
    const { nodes: result } = buildRoadmapGraph(nodes);
    for (const n of result) {
      expect(['critical', 'high', 'medium', 'low']).toContain(n.priorityLabel);
    }
  });
});

describe('buildRoadmapGraph - duration and milestones', () => {
  it('assigns duration based on complexity tier', () => {
    const nodes = [node('a', { complexityTier: 'beginner' }), node('b', { complexityTier: 'advanced' })];
    const { nodes: result } = buildRoadmapGraph(nodes);
    const a = result.find((n) => n.id === 'a');
    const b = result.find((n) => n.id === 'b');
    expect(b.estimatedDurationDays).toBeGreaterThan(a.estimatedDurationDays);
  });

  it('sums node durations into totalEstimatedDurationDays', () => {
    const nodes = [node('a', { complexityTier: 'beginner' }), node('b', { complexityTier: 'beginner' })];
    const { nodes: result, totalEstimatedDurationDays } = buildRoadmapGraph(nodes);
    const sum = result.reduce((acc, n) => acc + n.estimatedDurationDays, 0);
    expect(totalEstimatedDurationDays).toBe(sum);
  });

  it('groups all nodes into at least one milestone', () => {
    const nodes = [node('a'), node('b', { prerequisiteIds: ['a'] })];
    const { milestones } = buildRoadmapGraph(nodes);
    expect(milestones.length).toBeGreaterThan(0);
    const allNodeIdsInMilestones = milestones.flatMap((m) => m.nodeIds);
    expect(allNodeIdsInMilestones.sort()).toEqual(['a', 'b']);
  });

  it('creates multiple milestones when total duration exceeds the per-milestone threshold', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => node(`n${i}`, { complexityTier: 'advanced' })); // 6 * 15 = 90 days
    const { milestones } = buildRoadmapGraph(nodes);
    expect(milestones.length).toBeGreaterThan(1);
  });

  it('numbers milestones sequentially starting at 1', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => node(`n${i}`, { complexityTier: 'advanced' }));
    const { milestones } = buildRoadmapGraph(nodes);
    expect(milestones.map((m) => m.order)).toEqual(milestones.map((_, i) => i + 1));
  });
});

describe('buildRoadmapGraph - edge cases', () => {
  it('handles an empty node list without crashing', () => {
    const result = buildRoadmapGraph([]);
    expect(result.nodes).toEqual([]);
    expect(result.milestones).toEqual([]);
    expect(result.totalEstimatedDurationDays).toBe(0);
  });

  it('handles a single node with no prerequisites', () => {
    const result = buildRoadmapGraph([node('only')]);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].learningOrder).toBe(1);
  });
});
