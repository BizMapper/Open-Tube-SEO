// =============================================================================
// lib/keywords.js — Keyword Research and Analysis Toolkit
// =============================================================================
// Provides:
// - Keyword volume estimation (heuristic/offline)
// - Keyword grouping by topic
// - Search intent classification
// - Trend detection from keyword patterns
// - Competition analysis based on tag overlap
// - Long-tail keyword suggestion engine
// - Keyword difficulty estimation
// All analysis is heuristic-based and runs fully offline.
// =============================================================================

// =============================================================================
// KEYWORD_INTENTS — classify keyword search intent
// =============================================================================
const INTENT_PATTERNS = {
  informational: [
    "how",
    "what",
    "why",
    "when",
    "where",
    "who",
    "guide",
    "tutorial",
    "explained",
    "basics",
    "overview",
    "introduction",
    "learn",
    "understand",
    "tips",
    "tricks",
  ],
  commercial: [
    "vs",
    "review",
    "best",
    "top",
    "comparison",
    "worth",
    "alternative",
    "vs",
    "compared",
    "pros and cons",
    "buying guide",
    "which",
    "recommended",
    "discount",
    "coupon",
    "deal",
  ],
  transactional: [
    "buy",
    "get",
    "download",
    "install",
    "subscribe",
    "purchase",
    "order",
    "price",
    "cost",
    "cheap",
    "affordable",
    "free",
    "trial",
    "sign up",
    "register",
  ],
  navigational: [
    "login",
    "sign in",
    "home page",
    "website",
    "official",
    "app",
    "channel",
    "account",
  ],
};

// =============================================================================
// classifyIntent — determine the search intent of a keyword
// =============================================================================
export function classifyIntent(keyword) {
  const kw = keyword.toLowerCase();
  const scores = {};

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    scores[intent] = patterns.filter((p) => kw.includes(p)).length;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][1] > 0 ? sorted[0][0] : "informational";
  const confidence = sorted[0][1] / Math.max(sorted[0][1] + sorted[1]?.[1] || 1, 1);

  return { intent: primary, confidence: Math.round(confidence * 100) };
}

// =============================================================================
// estimateVolume — heuristic monthly search volume estimate
// =============================================================================
export function estimateVolume(keyword) {
  // This is a rough heuristic based on keyword length and structure.
  // Real volume data requires the YouTube Search API or a third-party service.
  const kw = keyword.toLowerCase();
  const words = kw.split(" ").filter(Boolean);
  const wordCount = words.length;

  // Very short, generic keywords: high volume
  if (wordCount === 1) {
    return { volume: "10K-100K", range: [10000, 100000], level: "High" };
  }
  // Two-word phrases: medium-high
  if (wordCount === 2) {
    return { volume: "1K-10K", range: [1000, 10000], level: "Medium" };
  }
  // Long-tail (3+ words): lower volume, higher conversion
  if (wordCount >= 3) {
    return { volume: "100-1K", range: [100, 1000], level: "Low" };
  }
  return { volume: "Unknown", range: [0, 0], level: "Unknown" };
}

// =============================================================================
// groupKeywords — organize keywords into topical clusters
// =============================================================================
export function groupKeywords(keywords) {
  const groups = new Map();

  for (const kw of keywords) {
    const word = typeof kw === "string" ? kw : kw.word || "";
    const tokens = word.toLowerCase().split(/\s+/);

    // Find which existing group this keyword belongs to
    let assigned = false;
    for (const [groupName, members] of groups) {
      const groupTokens = groupName.toLowerCase().split(/\s+/);
      const overlap = tokens.filter((t) => groupTokens.includes(t)).length;
      if (overlap >= Math.ceil(Math.min(tokens.length, groupTokens.length) / 2)) {
        members.push(kw);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // Create a new group named after the first significant token
      const groupName =
        tokens.find((t) => t.length > 3) || tokens[0] || word;
      groups.set(groupName, [kw]);
    }
  }

  return [...groups.entries()]
    .map(([name, members]) => ({
      name,
      members,
      count: members.length,
    }))
    .sort((a, b) => b.count - a.count);
}

// =============================================================================
// suggestLongTail — generate long-tail keyword variations
// =============================================================================
const LONGTAIL_PREFIXES = [
  "how to",
  "what is",
  "best",
  "top",
  "easy",
  "simple",
  "complete",
  "beginner",
  "advanced",
  "ultimate",
  "step by step",
  "guide to",
  "tips for",
  "tutorial",
  "review of",
];

const LONGTAIL_SUFFIXES = [
  "for beginners",
  "for experts",
  "step by step",
  "2025",
  "2026",
  "tutorial",
  "guide",
  "tips and tricks",
  "explained",
  "examples",
  "online",
  "free",
  "pro",
  "full course",
  "overview",
  "vs",
];

export function suggestLongTail(keyword) {
  const kw = keyword.toLowerCase().trim();
  const suggestions = new Set();

  // Generate prefix-based suggestions
  for (const prefix of LONGTAIL_PREFIXES) {
    suggestions.add(`${prefix} ${kw}`);
  }

  // Generate suffix-based suggestions
  for (const suffix of LONGTAIL_SUFFIXES) {
    suggestions.add(`${kw} ${suffix}`);
  }

  // Generate combination suggestions
  for (let i = 0; i < Math.min(5, LONGTAIL_PREFIXES.length); i++) {
    for (let j = 0; j < Math.min(3, LONGTAIL_SUFFIXES.length); j++) {
      suggestions.add(`${LONGTAIL_PREFIXES[i]} ${kw} ${LONGTAIL_SUFFIXES[j]}`);
    }
  }

  return [...suggestions].slice(0, 30);
}

// =============================================================================
// analyzeKeywordGap — find keywords in one set but not another (competitor gap)
// =============================================================================
export function analyzeKeywordGap(ourKeywords, competitorKeywords) {
  const ourSet = new Set(ourKeywords.map((k) => k.toLowerCase()));
  const compSet = new Set(competitorKeywords.map((k) => k.toLowerCase()));

  const missing = [...compSet].filter((k) => !ourSet.has(k));
  const unique = [...ourSet].filter((k) => !compSet.has(k));
  const common = [...ourSet].filter((k) => compSet.has(k));

  return {
    missing: missing.sort(), // Competitor ranks for these, we don't
    unique: unique.sort(), // We have these, competitor doesn't
    common: common.sort(), // Both target these
    overlapPercent: Math.round(
      (common.length / Math.max(ourSet.size, 1)) * 100
    ),
  };
}

// =============================================================================
// extractYouTubeSearchQueries — parse common search patterns from tags/titles
// =============================================================================
export function extractSearchQueries(tags, title) {
  const all = [...(tags || []), title || ""];
  const queries = new Set();

  for (const text of all) {
    const lower = text.toLowerCase();
    // Extract question-style queries
    const questions = lower.match(
      /(how\s+to\s+\w+|what\s+is\s+\w+|why\s+(do|does|is|are)\s+\w+|can\s+(i|you)\s+\w+)/gi
    );
    if (questions) questions.forEach((q) => queries.add(q));

    // Extract "X vs Y" patterns
    const vs = lower.match(/\b\w+\s+vs\s+\w+\b/gi);
    if (vs) vs.forEach((v) => queries.add(v));

    // Extract "best X for Y" patterns
    const best = lower.match(/best\s+\w+(\s+\w+){0,3}\s+(for|in|of|to)\s+\w+/gi);
    if (best) best.forEach((b) => queries.add(b));
  }

  return [...queries];
}

// =============================================================================
// scoreKeyword — comprehensive single-keyword score (0-100)
// =============================================================================
export function scoreKeyword(keyword, contextTags = []) {
  const kw = keyword.toLowerCase();
  const words = kw.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Relevancy: how well it matches context tags
  const relevantTags = contextTags.filter((t) =>
    t.toLowerCase().includes(kw)
  ).length;
  const relevancy = Math.min(100, (relevantTags / Math.max(contextTags.length, 1)) * 100);

  // Specificity: longer keywords are more specific
  const specificity = Math.min(100, wordCount * 25);

  // Competition: harder for short/generic keywords
  const competition = wordCount === 1 ? 80 : wordCount === 2 ? 50 : 20;

  // Opportunity: inverse of competition + relevancy boost
  const opportunity = Math.round(
    (specificity + relevancy + (100 - competition)) / 3
  );

  return {
    keyword: kw,
    wordCount,
    relevancy: Math.round(relevancy),
    specificity,
    competition,
    opportunity,
    intent: classifyIntent(kw),
    volume: estimateVolume(kw),
  };
}
