const DURATION_DAYS_BY_TIER = { beginner: 5, intermediate: 10, advanced: 15 };
const IMPORTANCE_WEIGHT = { core: 30, important: 15, 'nice-to-have': 5 };
const MILESTONE_DURATION_THRESHOLD_DAYS = 14;

/**
 * Sanitizes raw AI-proposed nodes: drops duplicate ids (keeping the first
 * occurrence) and strips any prerequisiteIds that reference a nonexistent
 * node or the node itself. Defensive by design - AI output is not trusted
 * to already satisfy these invariants.
 */
function sanitizeNodes(rawNodes) {
  const seen = new Set();
  const deduped = [];
  for (const node of rawNodes) {
    if (!node?.id || seen.has(node.id)) continue;
    seen.add(node.id);
    deduped.push({ ...node });
  }
  const validIds = new Set(deduped.map((n) => n.id));
  return deduped.map((node) => ({
    ...node,
    prerequisiteIds: [...new Set(node.prerequisiteIds || [])].filter(
      (id) => validIds.has(id) && id !== node.id
    ),
  }));
}

/**
 * Removes cycles from the prerequisite graph via DFS with node coloring,
 * dropping whichever edge closes a cycle (a back-edge to a node currently
 * on the recursion stack). AI-proposed graphs aren't guaranteed acyclic, so
 * this guarantees a valid DAG deterministically rather than trusting the
 * model's output as-is.
 */
function removeCycles(nodes) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(nodes.map((n) => [n.id, WHITE]));

  function visit(nodeId) {
    color.set(nodeId, GRAY);
    const node = nodeMap.get(nodeId);
    const keptPrereqs = [];
    for (const prereqId of node.prerequisiteIds) {
      if (color.get(prereqId) === GRAY) {
        continue; // back-edge to an ancestor on the current path - would create a cycle, drop it
      }
      keptPrereqs.push(prereqId);
      if (color.get(prereqId) === WHITE) {
        visit(prereqId);
      }
    }
    node.prerequisiteIds = keptPrereqs;
    color.set(nodeId, BLACK);
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) visit(node.id);
  }
  return nodes;
}

/** Kahn's algorithm, with ties broken alphabetically by id so the resulting
 * order is deterministic and reproducible for the same input graph. */
function topologicalSort(nodes) {
  const dependents = new Map(nodes.map((n) => [n.id, []]));
  const inDegree = new Map(nodes.map((n) => [n.id, n.prerequisiteIds.length]));

  for (const node of nodes) {
    for (const prereqId of node.prerequisiteIds) {
      dependents.get(prereqId).push(node.id);
    }
  }

  const queue = nodes
    .filter((n) => inDegree.get(n.id) === 0)
    .map((n) => n.id)
    .sort();
  const order = [];

  while (queue.length > 0) {
    queue.sort();
    const current = queue.shift();
    order.push(current);
    for (const depId of dependents.get(current)) {
      inDegree.set(depId, inDegree.get(depId) - 1);
      if (inDegree.get(depId) === 0) queue.push(depId);
    }
  }

  // Should be unreachable given removeCycles guarantees a DAG, but append
  // any stragglers defensively rather than silently dropping nodes.
  const ordered = new Set(order);
  for (const node of nodes) {
    if (!ordered.has(node.id)) order.push(node.id);
  }

  return order;
}

/** How many other nodes transitively depend on this one - a proxy for how
 * "foundational" a topic is. Computed via a single reverse-topological
 * pass, since descendant counts of dependents are already known by the
 * time we reach an earlier node in that order. */
function computeDescendantCounts(nodes, order) {
  const dependents = new Map(nodes.map((n) => [n.id, []]));
  for (const node of nodes) {
    for (const prereqId of node.prerequisiteIds) {
      dependents.get(prereqId).push(node.id);
    }
  }

  const descendantCount = new Map();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    let count = 0;
    for (const depId of dependents.get(id)) {
      count += 1 + (descendantCount.get(depId) || 0);
    }
    descendantCount.set(id, count);
  }
  return descendantCount;
}

function computePriorityScore({ importance, descendantCount, learningOrderIndex, totalNodes }) {
  const importanceScore = IMPORTANCE_WEIGHT[importance] ?? IMPORTANCE_WEIGHT.important;
  const foundationalBonus = descendantCount * 3;
  const orderTiebreak = (totalNodes - learningOrderIndex) * 0.1;
  return Math.round((importanceScore + foundationalBonus + orderTiebreak) * 10) / 10;
}

/** Quantile-based label assignment - top ~15% of scores are "critical",
 * next ~30% "high", next ~30% "medium", remainder "low". */
function scoreToPriorityLabel(score, allScores) {
  if (allScores.length <= 1) return 'critical';
  const sorted = [...allScores].sort((a, b) => b - a);
  const rank = sorted.indexOf(score);
  const percentile = rank / (sorted.length - 1);
  if (percentile <= 0.15) return 'critical';
  if (percentile <= 0.45) return 'high';
  if (percentile <= 0.75) return 'medium';
  return 'low';
}

function mostCommon(arr) {
  if (arr.length === 0) return 'General';
  const counts = new Map();
  for (const item of arr) counts.set(item, (counts.get(item) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function groupIntoMilestones(orderedNodes, thresholdDays = MILESTONE_DURATION_THRESHOLD_DAYS) {
  const milestones = [];
  let current = { nodeIds: [], estimatedDurationDays: 0, categories: [] };

  for (const node of orderedNodes) {
    current.nodeIds.push(node.id);
    current.estimatedDurationDays += node.estimatedDurationDays;
    current.categories.push(node.category);
    if (current.estimatedDurationDays >= thresholdDays) {
      milestones.push(current);
      current = { nodeIds: [], estimatedDurationDays: 0, categories: [] };
    }
  }
  if (current.nodeIds.length > 0) milestones.push(current);

  return milestones.map((m, i) => ({
    order: i + 1,
    title: `Milestone ${i + 1}: ${mostCommon(m.categories)}`,
    nodeIds: m.nodeIds,
    estimatedDurationDays: m.estimatedDurationDays,
  }));
}

/**
 * The main entry point: takes raw AI-proposed nodes and returns a fully
 * validated DAG with deterministic learning order, priority, duration, and
 * milestone grouping. This is the function that turns "whatever the model
 * returned" into something structurally guaranteed to be correct.
 */
export function buildRoadmapGraph(rawNodes) {
  const sanitized = sanitizeNodes(rawNodes);
  const acyclic = removeCycles(sanitized);
  const order = topologicalSort(acyclic);
  const descendantCounts = computeDescendantCounts(acyclic, order);
  const nodeMap = new Map(acyclic.map((n) => [n.id, n]));

  const withDurationAndOrder = order.map((id, index) => {
    const node = nodeMap.get(id);
    return {
      ...node,
      learningOrder: index + 1,
      estimatedDurationDays: DURATION_DAYS_BY_TIER[node.complexityTier] ?? DURATION_DAYS_BY_TIER.intermediate,
      descendantCount: descendantCounts.get(id) || 0,
    };
  });

  const allScores = withDurationAndOrder.map((n, i) =>
    computePriorityScore({
      importance: n.importance,
      descendantCount: n.descendantCount,
      learningOrderIndex: i,
      totalNodes: withDurationAndOrder.length,
    })
  );

  const finalNodes = withDurationAndOrder.map((n, i) => ({
    ...n,
    priorityScore: allScores[i],
    priorityLabel: scoreToPriorityLabel(allScores[i], allScores),
  }));

  const milestones = groupIntoMilestones(finalNodes);
  const totalEstimatedDurationDays = finalNodes.reduce((sum, n) => sum + n.estimatedDurationDays, 0);

  return { nodes: finalNodes, milestones, totalEstimatedDurationDays };
}
