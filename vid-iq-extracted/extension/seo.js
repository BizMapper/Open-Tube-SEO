// seo.js — fully offline heuristic SEO scoring + keyword extraction.
// No network, no AI. Deterministic and fast.

const STOPWORDS = new Set(
  "a an the and or but if then of to in on for with at by from up about into over after is are was were be been being this that these those it its as you your my our their his her i we they he she them us me how what why when where which who will can do does did not no so just like get got make made new best top guide tutorial how-to vs".split(
    /\s+/
  )
);

export function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Rank keywords by frequency + boost for title/tag overlap.
export function extractKeywords({ title, description, tags }, limit = 15) {
  const freq = new Map();
  const add = (text, weight) => {
    for (const w of tokenize(text)) {
      freq.set(w, (freq.get(w) || 0) + weight);
    }
  };
  add(title, 3);
  add((tags || []).join(" "), 2.5);
  add(description, 1);

  // Two-word phrases from the title for long-tail keywords.
  const titleTokens = tokenize(title);
  for (let i = 0; i < titleTokens.length - 1; i++) {
    const phrase = titleTokens[i] + " " + titleTokens[i + 1];
    freq.set(phrase, (freq.get(phrase) || 0) + 2);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, score]) => ({ word, score: Math.round(score * 10) / 10 }));
}

function check(pass, label, hint) {
  return { pass: !!pass, label, hint };
}

// vidIQ-style checklist scoring. Returns 0-100 + per-item checks.
export function scoreSEO({ title, description, tags }) {
  title = title || "";
  description = description || "";
  tags = tags || [];

  const titleLen = title.length;
  const descLen = description.length;
  const tagCount = tags.length;
  const descWords = tokenize(description).length;
  const hasNumber = /\d/.test(title);
  const hasLinks = /https?:\/\//.test(description);
  const titleKeywords = new Set(tokenize(title));
  const tagsInTitle = tags.filter((t) =>
    tokenize(t).some((w) => titleKeywords.has(w))
  ).length;

  const checks = [
    check(
      titleLen >= 30 && titleLen <= 70,
      `Title length (${titleLen} chars)`,
      "Aim for 30–70 characters so it isn't truncated in search."
    ),
    check(
      hasNumber,
      "Number in title",
      "Titles with numbers (e.g. \"7 tips\") tend to earn more clicks."
    ),
    check(
      descLen >= 250,
      `Description length (${descLen} chars)`,
      "Write at least 250 characters to give context to search."
    ),
    check(
      descWords >= 100,
      `Description depth (${descWords} words)`,
      "Longer, keyword-rich descriptions rank better."
    ),
    check(
      hasLinks,
      "Links in description",
      "Add links (socials, related videos) to boost session time."
    ),
    check(
      tagCount >= 8,
      `Tag count (${tagCount})`,
      "Use 8–15 relevant tags covering topic variations."
    ),
    check(
      tagCount <= 20,
      "Not over-tagged",
      "Avoid stuffing more than ~20 tags."
    ),
    check(
      tagsInTitle >= 1,
      "Tags match title",
      "At least one tag should share a keyword with the title."
    ),
  ];

  const passed = checks.filter((c) => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);
  let grade = "Needs work";
  if (score >= 85) grade = "Excellent";
  else if (score >= 65) grade = "Good";
  else if (score >= 45) grade = "Fair";

  return { score, grade, passed, total: checks.length, checks };
}
