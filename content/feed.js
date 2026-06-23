// =============================================================================
// content/feed.js — YouTube Feed/Home Page Content Script
// =============================================================================
// This script runs on youtube.com/feed/* pages and:
// - Gathers content trends from the user's feed
// - Captures video recommendations for trend analysis
// - Provides minimal data for the "trending topics" feature
// =============================================================================

// =============================================================================
// getFeedVideos — scrape video recommendations from the feed
// =============================================================================
function getFeedVideos() {
  const videos = [];

  document
    .querySelectorAll(
      "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer"
    )
    .forEach((item, idx) => {
      const titleEl = item.querySelector("#video-title, a#video-title");

      if (!titleEl) return;

      videos.push({
        index: idx + 1,
        title: titleEl.textContent?.trim() || "",
        url: titleEl.getAttribute("href") || "",
        channel:
          item
            .querySelector("#channel-name yt-formatted-string a")
            ?.textContent?.trim() || "",
        views:
          item
            .querySelector("#metadata-line span:nth-child(1)")
            ?.textContent?.trim() || "",
        published:
          item
            .querySelector("#metadata-line span:nth-child(2)")
            ?.textContent?.trim() || "",
      });
    });

  return videos;
}

// =============================================================================
// Message handler
// =============================================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "OPENTUBE_FEED_DATA") {
    try {
      sendResponse({
        ok: true,
        videos: getFeedVideos(),
        feedType: location.pathname,
        scrapedAt: Date.now(),
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  }
  return true;
});
