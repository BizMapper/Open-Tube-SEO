// =============================================================================
// content/search.js — YouTube Search Results Page
// =============================================================================
// This script runs on youtube.com/results and:
// - Analyzes search result snippets for SEO patterns
// - Extracts top-ranking video titles and metadata
// - Provides keyword density analysis for the search term
// - Offers suggestions based on what's ranking
// =============================================================================

// =============================================================================
// getSearchQuery — extract the current search query from the URL
// =============================================================================
function getSearchQuery() {
  const params = new URLSearchParams(location.search);
  return params.get("search_query") || "";
}

// =============================================================================
// getSearchResults — scrape visible search results
// =============================================================================
function getSearchResults() {
  const results = [];

  // YouTube search result items
  const items = document.querySelectorAll(
    "ytd-video-renderer, ytd-grid-video-renderer, ytd-item-section-renderer ytd-video-renderer"
  );

  items.forEach((item, index) => {
    const titleEl = item.querySelector("#video-title, a#video-title");
    const channelEl = item.querySelector(
      "#channel-name yt-formatted-string a, #text-container yt-formatted-string a, ytd-channel-name a"
    );
    const viewsEl = item.querySelector("#metadata-line span:nth-child(1)");
    const dateEl = item.querySelector("#metadata-line span:nth-child(2)");
    const descEl = item.querySelector("#description-text, #description-snippet");

    results.push({
      rank: index + 1,
      title: titleEl?.textContent?.trim() || "",
      url: titleEl?.getAttribute("href") || "",
      channel: channelEl?.textContent?.trim() || "",
      views: viewsEl?.textContent?.trim() || "",
      published: dateEl?.textContent?.trim() || "",
      description: descEl?.textContent?.trim() || "",
    });
  });

  return results;
}

// =============================================================================
// analyzeTitlePatterns — find common patterns in top-ranking titles
// =============================================================================
function analyzeTitlePatterns(results) {
  const patterns = {
    hasNumbers: 0,
    hasQuestions: 0,
    hasPowerWords: 0,
    avgLength: 0,
    totalLength: 0,
  };

  results.forEach((r) => {
    const title = r.title || "";
    patterns.totalLength += title.length;
    if (/\d/.test(title)) patterns.hasNumbers++;
    if (/\?/.test(title)) patterns.hasQuestions++;
    if (
      /\b(best|top|ultimate|guide|how|easy|complete|vs|review|tutorial)\b/i.test(
        title
      )
    ) {
      patterns.hasPowerWords++;
    }
  });

  if (results.length > 0) {
    patterns.avgLength = Math.round(patterns.totalLength / results.length);
  }

  return patterns;
}

// =============================================================================
// getKeywordDensity — analyze keyword density in search titles
// =============================================================================
function getKeywordDensity(results, searchQuery) {
  if (!searchQuery) return null;

  const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return null;

  let totalTitles = 0;
  let titlesWithKeyword = 0;
  const wordFrequency = {};

  results.forEach((r) => {
    const title = (r.title || "").toLowerCase();
    totalTitles++;

    // Check if search query appears in title
    const hasQuery = queryWords.every((w) => title.includes(w));
    if (hasQuery) titlesWithKeyword++;

    // Count individual word frequency
    queryWords.forEach((w) => {
      wordFrequency[w] = (wordFrequency[w] || 0) + (title.includes(w) ? 1 : 0);
    });
  });

  return {
    queryWords,
    titlesWithKeyword,
    totalTitles,
    density: totalTitles > 0 ? Math.round((titlesWithKeyword / totalTitles) * 100) : 0,
    wordFrequency,
  };
}

// =============================================================================
// getSERPAnalysis — full search engine page analysis
// =============================================================================
function getSERPAnalysis() {
  const query = getSearchQuery();
  const results = getSearchResults();
  const patterns = analyzeTitlePatterns(results);
  const density = getKeywordDensity(results, query);

  return {
    query,
    resultCount: results.length,
    results,
    patterns,
    keywordDensity: density,
    scrapedAt: Date.now(),
  };
}

// =============================================================================
// scrapeSearch — collect search page data for popup
// =============================================================================
function scrapeSearch() {
  const analysis = getSERPAnalysis();
  return {
    ok: true,
    isWatch: false,
    isSearch: true,
    url: location.href,
    title: `Search: ${analysis.query || "(no query)"}`,
    description: `Top ${analysis.resultCount} results for "${analysis.query}"`,
    tags: analysis.query ? analysis.query.toLowerCase().split(/\s+/) : [],
    stats: { channel: "", views: null, likes: null, subs: null, published: null },
    results: analysis.results,
    patterns: analysis.patterns,
    keywordDensity: analysis.keywordDensity,
    scrapedAt: Date.now(),
  };
}

// =============================================================================
// Message handler
// =============================================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "OPENTUBE_SERP_ANALYSIS") {
    try {
      sendResponse(getSERPAnalysis());
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  }
  if (msg?.type === "SCRAPE_PAGE" || msg?.type === "OPENTUBE_GET_FULL_DATA") {
    try {
      sendResponse(scrapeSearch());
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  }
  return true;
});
