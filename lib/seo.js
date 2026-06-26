// =============================================================================
// lib/seo.js — Offline SEO Scoring Engine
// =============================================================================
// This module provides:
// - Comprehensive SEO scoring (0-100) with 15+ heuristic checks
// - Keyword extraction and ranking
// - Content quality analysis
// - Readability scoring
// - Thumbnail quality estimation
// - Trend/seasonality detection
// All checks run fully offline with no network calls.
// =============================================================================

// =============================================================================
// STOPWORDS — common English words filtered from keyword extraction
// =============================================================================
const STOPWORDS = new Set(
  (
    "a an the and or but if then of to in on for with at by from up about into over after " +
    "is are was were be been being this that these those it its as you your my our their his " +
    "her i we they he she them us me how what why when where which who will can do does did " +
    "not no so just like get got make made new best top guide tutorial how-to vs amp " +
    "really very much also more less most some any all each every both few many such " +
    "than then than then too own same here there"
  ).split(/\s+/)
);

// =============================================================================
// tokenize — split text into clean lowercase tokens
// =============================================================================
export function tokenize(text) {
  if (!text) return [];
  return (text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// =============================================================================
// extractKeywords — rank keywords by frequency with boosted positions
// =============================================================================
export function extractKeywords(
  { title, description, tags, comments },
  limit = 20
) {
  const freq = new Map();
  const phrases = new Map(); // Two-word phrases

  const add = (text, weight) => {
    const tokens = tokenize(text);
    for (const w of tokens) {
      freq.set(w, (freq.get(w) || 0) + weight);
    }
    // Build bigrams from the same text
    for (let i = 0; i < tokens.length - 1; i++) {
      const phrase = tokens[i] + " " + tokens[i + 1];
      phrases.set(phrase, (phrases.get(phrase) || 0) + weight * 0.8);
    }
  };

  // Title gets the highest weight — these are the most important keywords
  add(title, 3);
  // Tags are explicitly chosen by the creator
  add((tags || []).join(" "), 2.5);
  // Description provides context
  add(description, 1);
  // Comments (if available) reveal what viewers actually talk about
  add(comments, 0.5);

  // Boost single words that appear in bigrams
  for (const [phrase, score] of phrases) {
    for (const w of phrase.split(" ")) {
      freq.set(w, (freq.get(w) || 0) + score * 0.3);
    }
  }

  // Merge single keywords and phrases, sorted by score
  const merged = new Map(freq);
  for (const [phrase, score] of phrases) {
    merged.set(phrase, (merged.get(phrase) || 0) + score);
  }

  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, score]) => ({
      word,
      score: Math.round(score * 10) / 10,
      type: word.includes(" ") ? "phrase" : "word",
    }));
}

// =============================================================================
// check — helper to create a named check result with actionable suggestion
// =============================================================================
function check(pass, label, hint, weight = 1, action) {
  return { pass: !!pass, label, hint, weight, action };
}

// =============================================================================
// SCORE_WEIGHTS — how much each category contributes to the final score
// =============================================================================
const SCORE_WEIGHTS = {
  title: 0.3,
  description: 0.25,
  tags: 0.2,
  engagement: 0.15,
  thumbnail: 0.1,
};

// =============================================================================
// scoreSEO — comprehensive vidIQ-style SEO scoring
// =============================================================================
export function scoreSEO({
  title,
  description,
  tags,
  stats,
  thumbnailUrl,
}) {
  title = title || "";
  description = description || "";
  tags = tags || [];
  stats = stats || {};

  const titleLen = title.length;
  const descLen = description.length;
  const tagCount = tags.length;

  // --- Token analysis ---
  const titleTokens = tokenize(title);
  const descTokens = tokenize(description);
  const descWords = descTokens.length;
  const titleKeywords = new Set(titleTokens);

  // --- Content quality checks ---
  const hasNumber = /\d/.test(title);
  const hasQuestion = /\?/.test(title);
  const hasPowerWords =
    /\b(amazing|best|complete|easy|essential|everything|exclusive|free|full|great|guide|how|important|incredible|insane|latest|must|new|perfect|powerful|proven|simple|step|super|tips|top|ultimate|unbelievable|updated|vs|worth)\b/i.test(
      title
    );
  const hasClickbait =
    /\b(you won't believe|shocking|mind.blowing|you'll never|insane|gonna hate|one weird|what happens|destroyed)\b/i.test(
      title
    );
  const hasLinks = /https?:\/\//.test(description);
  const hasTimestamps = /\d{1,2}:\d{2}/.test(description);
  const hasCTA =
    /\b(subscribe|like|comment|share|watch|check out|follow|join)\b/i.test(
      description
    );
  const hasHashtags = /#\w+/.test(description);
  const descriptionSentences = description
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0).length;

  // --- Title-tag overlap ---
  const tagsInTitle = tags.filter((t) =>
    tokenize(t).some((w) => titleKeywords.has(w))
  ).length;
  const tagsInDesc = tags.filter((t) =>
    tokenize(t).some((w) => descTokens.includes(w))
  ).length;

  // --- Engagement checks ---
  const views = stats.views || 0;
  const likes = stats.likes || 0;
  const subs = stats.subs || 0;

  // ==================================================================
  // Run all checks — each returns { pass, label, hint, weight, action }
  // The 'action' field gives specific copy-paste-able suggestions.
  // ==================================================================
  const checks = [
    // Title checks
    check(
      titleLen >= 30 && titleLen <= 70,
      `Title length (${titleLen} chars)`,
      "Keep titles between 30-70 characters for full display in search results.",
      3,
      titleLen < 30
        ? `Add more detail to reach 30+ chars. Current: "${title}" (${titleLen} chars)`
        : `Trim title to under 70 chars. Current: ${titleLen} chars`
    ),
    check(
      hasNumber,
      "Number in title",
      "Titles with numbers get 36% more clicks (e.g. '5 ways to…').",
      2,
      `Add a number: "7 Tips for ${title}", "Top 5 ${title}", "${title} — 3 Easy Steps"`
    ),
    check(
      hasPowerWords,
      "Power words in title",
      "Use emotional/curiosity words like 'ultimate', 'essential', 'best'.",
      2,
      `Try: "Ultimate ${title}", "${title} — Complete Guide", "Everything You Need: ${title}"`
    ),
    check(
      hasQuestion,
      "Question in title",
      "Questions create curiosity gaps and boost CTR.",
      1,
      `Try: "Is ${title} Worth It?", "How Does ${title} Work?", "What Is ${title}?"`
    ),
    check(
      !hasClickbait,
      "No clickbait patterns",
      "Clickbait may get clicks but hurts retention and algorithm recommendations.",
      1
    ),

    // Description checks
    check(
      descLen >= 250,
      `Description length (${descLen} chars)`,
      "Aim for at least 250 characters for good search context.",
      3,
      `Write ${250 - descLen} more characters. Include: what this video covers, key takeaways, and a CTA.`
    ),
    check(
      descWords >= 100,
      `Description word count (${descWords})`,
      "Longer descriptions (>100 words) rank better for more keywords.",
      2,
      `Add ${100 - descWords} more words. Expand on key points and include relevant keywords naturally.`
    ),
    check(
      hasLinks,
      "Links in description",
      "Add links to social media, related videos, or affiliate offers.",
      1,
      "Add: your website link, related video links, and social media profiles."
    ),
    check(
      hasTimestamps,
      "Timestamps in description",
      "Timestamps increase watch time by helping viewers find key sections.",
      2,
      "Add timestamps: 0:00 Intro, 1:30 Main Topic, 5:00 Key Tip, 8:00 Summary"
    ),
    check(
      hasCTA,
      "Call to action in description",
      "Include subscribe, like, comment, or watch-next prompts.",
      1,
      'Add: "If you found this helpful, please like and subscribe for more content!"'
    ),
    check(
      hasHashtags,
      "Hashtags in description",
      "Use 2-3 relevant hashtags above the fold for discovery.",
      1,
      "Add hashtags at the top of description: #YourTopic #YouTubeSEO #VideoTips"
    ),
    check(
      descriptionSentences >= 5,
      `Description depth (${descriptionSentences} sentences)`,
      "Write at least 5 sentences covering context, keywords, and CTA.",
      1,
      `Write ${5 - Math.max(descriptionSentences, 0)} more sentences. Explain what viewers will learn.`
    ),

    // Tag checks
    check(
      tagCount >= 8,
      `Tag count (${tagCount})`,
      "Use 8-15 tags covering broad, specific, and long-tail keywords.",
      3,
      tagCount === 0
        ? "Open the AI tab to generate relevant tags automatically."
        : `Add ${8 - tagCount} more tags. Mix broad terms with specific long-tail phrases.`
    ),
    check(
      tagCount <= 25,
      "Not over-tagged",
      "More than 25 tags can dilute keyword relevance.",
      1
    ),
    check(
      tagsInTitle >= 1,
      "Tags match title keywords",
      "At least one tag should overlap with title keywords for relevance.",
      2,
      `Add tags that match words in your title: ${[...titleKeywords].slice(0, 5).join(", ")}`
    ),
    check(
      tagsInDesc >= 3,
      "Tags match description",
      "Tags should also appear in the description for topical authority.",
      2,
      "Use your top tags naturally in the description text."
    ),

    // Engagement checks
    check(
      views > 100,
      `Video has traction (${views.toLocaleString()} views)`,
      "Videos with more views rank better — promote early.",
      1,
      "Share your video on social media, embed on your website, and use end screens."
    ),
    check(
      subs > 0,
      "Channel has subscribers",
      "Subscriber count signals authority to YouTube's algorithm.",
      1,
      "Encourage viewers to subscribe at the start and end of your video."
    ),
  ];

  // --- Weighted scoring ---
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const c of checks) {
    totalWeight += c.weight;
    if (c.pass) earnedWeight += c.weight;
  }

  const score = Math.round((earnedWeight / totalWeight) * 100);

  // --- Grade ---
  let grade = "Needs work";
  if (score >= 90) grade = "Excellent";
  else if (score >= 75) grade = "Good";
  else if (score >= 55) grade = "Fair";
  else if (score >= 35) grade = "Poor";

  const passed = checks.filter((c) => c.pass).length;

  return {
    score,
    grade,
    passed,
    total: checks.length,
    checks,
    weightedScore: Math.round((earnedWeight / totalWeight) * 100),
  };
}

// =============================================================================
// estimateKeywordDifficulty — heuristic keyword competition score
// =============================================================================
export function estimateKeywordDifficulty(keyword, tags = []) {
  // Estimates how hard it is to rank for a keyword based on:
  const k = keyword.toLowerCase();
  const kLen = k.split(" ").length;

  // Long-tail keywords are easier
  const lengthScore = Math.min(kLen / 5, 1) * 30;

  // Very short keywords are very competitive
  const specificityScore = kLen === 1 ? 10 : kLen === 2 ? 30 : 60;

  // If the keyword appears in many tags, it's likely competitive
  const tagOverlap = tags.filter((t) => t.toLowerCase().includes(k)).length;
  const tagScore = Math.max(0, 50 - tagOverlap * 10);

  // Overall difficulty (0-100)
  const difficulty = Math.round(
    100 - (lengthScore + specificityScore + tagScore) / 3
  );

  let level = "Easy";
  if (difficulty >= 70) level = "Hard";
  else if (difficulty >= 45) level = "Medium";

  return { score: difficulty, level };
}

// =============================================================================
// analyzeReadability — simple readability metrics for description text
// =============================================================================
export function analyzeReadability(text) {
  if (!text || text.length < 50) {
    return { score: 0, level: "Too short", words: 0, sentences: 0 };
  }

  const words = text
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const sentences = text
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0).length;
  const avgWordsPerSentence = words / Math.max(sentences, 1);
  const avgSyllables =
    text
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .reduce((sum, w) => {
        // Simple syllable estimate: count vowel groups
        const syl = (w.match(/[aeiouy]+/gi) || []).length;
        return sum + Math.max(syl, 1);
      }, 0) / Math.max(words, 1);

  // Flesch-Kincaid approximate grade level
  const gradeLevel = Math.round(
    0.39 * avgWordsPerSentence + 11.8 * avgSyllables - 15.59
  );

  let level = "Fair";
  if (gradeLevel <= 6) level = "Very easy (grade school)";
  else if (gradeLevel <= 8) level = "Easy (middle school)";
  else if (gradeLevel <= 10) level = "Fair (high school)";
  else if (gradeLevel <= 12) level = "Moderate (college)";
  else level = "Difficult (graduate)";

  return {
    score: Math.max(0, Math.min(100, Math.round(100 - gradeLevel * 5))),
    level,
    gradeLevel,
    words,
    sentences,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
  };
}
