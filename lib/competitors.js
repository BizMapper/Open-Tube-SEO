// =============================================================================
// lib/competitors.js — Competitor Analysis Engine
// =============================================================================
// Provides:
// - Identify competitor channels from tags/topics
// - Compare video metadata side-by-side
// - Analyze competitor tag strategies
// - Find content gaps vs competitors
// - Track competitor publishing patterns
// All analysis is done on scraped data — no API calls needed.
// =============================================================================

// =============================================================================
// TAG_OVERLAP_THRESHOLD — minimum shared tags to consider as competitor
// =============================================================================
const TAG_OVERLAP_THRESHOLD = 0.3; // 30% tag overlap

// =============================================================================
// analyzeTagStrategy — break down a set of tags into categories
// =============================================================================
export function analyzeTagStrategy(tags) {
  const analysis = {
    broad: [], // Single-word, high-level tags
    specific: [], // Multi-word, topic-specific tags
    longTail: [], // Very specific, low-competition phrases
    branded: [], // Channel or product name tags
    total: tags.length,
  };

  for (const tag of tags) {
    const t = tag.toLowerCase().trim();
    const wordCount = t.split(/\s+/).length;

    if (wordCount === 1) {
      analysis.broad.push(t);
    } else if (wordCount <= 3) {
      analysis.specific.push(t);
    } else {
      analysis.longTail.push(t);
    }
  }

  return analysis;
}

// =============================================================================
// compareMetadata — side-by-side comparison of two video metadata sets
// =============================================================================
export function compareMetadata(ours, theirs) {
  const ourTags = new Set((ours.tags || []).map((t) => t.toLowerCase()));
  const theirTags = new Set((theirs.tags || []).map((t) => t.toLowerCase()));

  const commonTags = [...ourTags].filter((t) => theirTags.has(t));
  const onlyWeHave = [...ourTags].filter((t) => !theirTags.has(t));
  const onlyTheyHave = [...theirTags].filter((t) => !ourTags.has(t));

  const ourTitleWords = new Set((ours.title || "").toLowerCase().split(/\s+/));
  const theirTitleWords = new Set((theirs.title || "").toLowerCase().split(/\s+/));
  const commonTitleWords = [...ourTitleWords].filter((w) => theirTitleWords.has(w));

  return {
    title: {
      ours: ours.title,
      theirs: theirs.title,
      commonWords: commonTitleWords,
      ourLength: (ours.title || "").length,
      theirLength: (theirs.title || "").length,
    },
    description: {
      ourLength: (ours.description || "").length,
      theirLength: (theirs.description || "").length,
      ourHasLinks: /https?:\/\//.test(ours.description || ""),
      theirHasLinks: /https?:\/\//.test(theirs.description || ""),
      ourHasTimestamps: /\d{1,2}:\d{2}/.test(ours.description || ""),
      theirHasTimestamps: /\d{1,2}:\d{2}/.test(theirs.description || ""),
    },
    tags: {
      common: commonTags,
      commonCount: commonTags.length,
      onlyWeHave: onlyWeHave,
      onlyWeHaveCount: onlyWeHave.length,
      onlyTheyHave: onlyTheyHave,
      onlyTheyHaveCount: onlyTheyHave.length,
      overlapPercent:
        Math.round(
          (commonTags.length / Math.max(theirTags.size, 1)) * 100
        ),
    },
    scores: {
      // Higher tag overlap = more directly competitive
      competitiveness: Math.min(
        100,
        Math.round(
          (commonTags.length / Math.max(theirTags.size, 1)) * 100
        )
      ),
    },
  };
}

// =============================================================================
// findContentGaps — identify topics competitors cover that we don't
// =============================================================================
export function findContentGaps(ourKeywords, theirKeywords) {
  const ourSet = new Set(ourKeywords.map((k) => k.toLowerCase()));
  const theirSet = new Set(theirKeywords.map((k) => k.toLowerCase()));

  const gaps = [...theirSet]
    .filter((k) => !ourSet.has(k))
    .map((keyword) => ({
      keyword,
      // Estimate opportunity: if they rank but we don't, it's an opportunity
      opportunity: estimateGapOpportunity(keyword),
    }))
    .sort((a, b) => b.opportunity - a.opportunity);

  return {
    gapCount: gaps.length,
    ourCoverage: Math.round((ourSet.size / Math.max(theirSet.size, 1)) * 100),
    theirCoverage: 100,
    topGaps: gaps.slice(0, 10),
  };
}

// =============================================================================
// estimateGapOpportunity — heuristic opportunity score for a gap keyword
// =============================================================================
function estimateGapOpportunity(keyword) {
  const wordCount = keyword.split(/\s+/).length;
  // Long-tail keywords are easier to rank for
  const specificity = Math.min(100, wordCount * 20);
  // Shorter keywords have more competition
  const competition = wordCount <= 2 ? 70 : wordCount <= 3 ? 40 : 15;
  return Math.round((specificity + (100 - competition)) / 2);
}

// =============================================================================
// analyzeChannel — aggregate competitor channel metrics from published data
// =============================================================================
export function analyzeChannel(channelData) {
  const {
    name,
    subscriberCount,
    totalVideos,
    recentVideos = [],
    tags = [],
  } = channelData;

  return {
    name,
    subscriberCount: subscriberCount || 0,
    totalVideos: totalVideos || 0,

    // Publishing frequency
    avgVideosPerWeek: estimatePublishingFrequency(recentVideos),

    // Tag strategy overview
    tagStrategy: analyzeTagStrategy(tags || []),

    // Estimated engagement
    avgEngagement: estimateEngagement(recentVideos),

    // Content diversity
    contentCategories: categorizeContent(recentVideos),
  };
}

// =============================================================================
// estimatePublishingFrequency — rough estimate from recent video timestamps
// =============================================================================
function estimatePublishingFrequency(videos) {
  if (!videos || videos.length < 2) return 0;

  const sorted = [...videos]
    .filter((v) => v.publishedAt)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  if (sorted.length < 2) return 0;

  const oldest = new Date(sorted[sorted.length - 1].publishedAt);
  const newest = new Date(sorted[0].publishedAt);
  const daysDiff = Math.max(
    (newest - oldest) / (1000 * 60 * 60 * 24),
    1
  );

  return Math.round((sorted.length / daysDiff) * 7);
}

// =============================================================================
// estimateEngagement — rough engagement rate from available stats
// =============================================================================
function estimateEngagement(videos) {
  const withStats = videos.filter((v) => v.views && v.likes);
  if (withStats.length === 0) return 0;

  const rates = withStats.map((v) => (v.likes / Math.max(v.views, 1)) * 100);
  const avgRate = rates.reduce((s, r) => s + r, 0) / rates.length;

  return Math.round(avgRate * 100) / 100; // percentage
}

// =============================================================================
// categorizeContent — simple content categorization from titles
// =============================================================================
function categorizeContent(videos) {
  const categories = {
    tutorial: 0,
    review: 0,
    entertainment: 0,
    educational: 0,
    news: 0,
    other: 0,
  };

  for (const v of videos || []) {
    const title = (v.title || "").toLowerCase();
    if (
      /\b(how to|guide|tutorial|walkthrough|step.by.step)\b/.test(title)
    ) {
      categories.tutorial++;
    } else if (/\b(review|vs|comparison|best|top)\b/.test(title)) {
      categories.review++;
    } else if (
      /\b(funny|comedy|prank|reaction|vlog|challenge)\b/.test(title)
    ) {
      categories.entertainment++;
    } else if (
      /\b(explained|science|history|learn|lesson|course|education)\b/.test(title)
    ) {
      categories.educational++;
    } else if (/\b(news|breaking|update|announcement)\b/.test(title)) {
      categories.news++;
    } else {
      categories.other++;
    }
  }

  const total = Object.values(categories).reduce((s, c) => s + c, 0);
  if (total === 0) return categories;

  // Convert to percentages
  const percentages = {};
  for (const [cat, count] of Object.entries(categories)) {
    percentages[cat] = Math.round((count / total) * 100);
  }
  return percentages;
}
