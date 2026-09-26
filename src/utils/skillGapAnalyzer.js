/**
 * Normalizes a skill string or skill object safely.
 * Handles strings ("C++"), objects ({ name: "C++" }), and nulls/undefined.
 */
function normalizeKey(val) {
  if (!val) return '';
  const str = typeof val === 'string' ? val : val.name || val.skill || String(val);
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Compares an explicit list of target skills against the candidate's known
 * skills (from their Career Profile), returning which ones they already
 * have and which are genuinely missing.
 */
export function computeSkillGap({ targetSkills = [], profileSkills = [] }) {
  // Support both plain string arrays ["React", "C++"] and object arrays [{ name: "React" }]
  const profileKeys = new Set(
    (profileSkills || []).map((s) => normalizeKey(s)).filter(Boolean)
  );

  const alreadyHave = [];
  const missing = [];

  for (const raw of targetSkills || []) {
    const key = normalizeKey(raw);
    if (!key) continue;

    if (profileKeys.has(key)) {
      alreadyHave.push(typeof raw === 'string' ? raw.trim() : raw);
    } else {
      missing.push(typeof raw === 'string' ? raw.trim() : raw);
    }
  }

  return { alreadyHave, missing };
}

/**
 * Deterministically drops any AI-proposed roadmap node whose title matches
 * (case/whitespace-insensitively) a skill already confirmed in the
 * candidate's Career Profile.
 */
export function filterNodesAgainstKnownSkills(nodes = [], profileSkills = []) {
  const profileKeys = new Set(
    (profileSkills || []).map((s) => normalizeKey(s)).filter(Boolean)
  );

  return (nodes || []).filter((node) => {
    const nodeTitleKey = normalizeKey(node?.title || node?.label || node?.skill);
    return !profileKeys.has(nodeTitleKey);
  });
}