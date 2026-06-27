// =============================================================================
// content/channel.js — YouTube Channel Page Content Script
// =============================================================================
// This script runs on channel pages and:
// - Scrapes channel metadata (name, subscribers, video count)
// - Analyzes recent videos for content patterns
// - Extracts channel keywords from branding and descriptions
// - Provides channel-level SEO analysis
// =============================================================================

// =============================================================================
// getChannelInfo — extract channel metadata
// =============================================================================
function getChannelInfo() {
  const name =
    document.querySelector(
      "ytd-channel-name yt-formatted-string, #channel-name yt-formatted-string, #channel-header #text"
    )?.textContent?.trim() || "";

  // Handle @handle format URLs
  const handle = location.pathname.match(/\/@([^/]+)/)
    ? location.pathname.match(/\/@([^/]+)/)[1]
    : null;

  const subscriberText =
    document.querySelector(
      "#subscriber-count, ytd-subscriber-count-renderer #subscriber-count, yt-formatted-string#subscriber-count"
    )?.textContent?.trim() || "";

  const subscribers = parseCount(subscriberText);

  const description =
    document.querySelector(
      "#channel-description, #description-container yt-formatted-string, ytd-channel-about-metadata-renderer yt-formatted-string"
    )?.textContent?.trim() || "";

  // Video count
  const videoCountText =
    document.querySelector("#videos-count yt-formatted-string, ytd-channel-tab-content-renderer #videos-count")
      ?.textContent?.trim() || "";

  // Channel links
  const links = [];
  document
    .querySelectorAll(
      "#link-list-container a, ytd-channel-about-metadata-renderer a"
    )
    .forEach((a) => {
      const href = a.getAttribute("href");
      if (href && !href.startsWith("/")) links.push(href);
    });

  return {
    name,
    handle,
    subscribers,
    subscriberText,
    description,
    videoCountText,
    links,
    url: location.href,
  };
}

// =============================================================================
// getRecentVideos — scrape visible recent video thumbnails
// =============================================================================
function getRecentVideos() {
  const videos = [];
  document
    .querySelectorAll(
      "ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer"
    )
    .forEach((item, idx) => {
      const titleEl = item.querySelector("#video-title, a#video-title");
      const viewsEl = item.querySelector("#metadata-line span:nth-child(1)");
      const dateEl = item.querySelector("#metadata-line span:nth-child(2)");
      const durationEl = item.querySelector(
        "ytd-thumbnail-overlay-time-status-renderer span, #overlays #time-status span"
      );

      videos.push({
        index: idx + 1,
        title: titleEl?.textContent?.trim() || "",
        url: titleEl?.getAttribute("href") || "",
        views: viewsEl?.textContent?.trim() || "",
        published: dateEl?.textContent?.trim() || "",
        duration: durationEl?.textContent?.trim() || "",
      });
    });

  return videos;
}

// =============================================================================
// getChannelTags — extract keywords from channel about/tags section
// =============================================================================
function getChannelTags() {
  const tags = [];
  document
    .querySelectorAll(
      'meta[property="og:video:tag"], meta[name="keywords"]'
    )
    .forEach((m) => {
      const content = m.getAttribute("content");
      if (content) {
        content
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((t) => tags.push(t));
      }
    });

  return [...new Set(tags)];
}

// =============================================================================
// parseCount — parse abbreviated numbers
// =============================================================================
function parseCount(str) {
  if (!str) return null;
  const m = str.replace(/,/g, "").match(/([\d.]+)\s*([KMBT]?)/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const unit = (m[2] || "").toUpperCase();
  if (unit === "K") n *= 1000;
  else if (unit === "M") n *= 1e6;
  else if (unit === "B") n *= 1e9;
  else if (unit === "T") n *= 1e12;
  return Math.round(n);
}

// =============================================================================
// getChannelData — aggregate all channel data
// =============================================================================
function getChannelData() {
  const info = getChannelInfo();
  const videos = getRecentVideos();
  const tags = getChannelTags();
  return {
    ok: true,
    isChannel: true,
    isWatch: false,
    url: location.href,
    channel: info,
    recentVideos: videos,
    tags: tags,
    title: info.name || `YouTube Channel${info.handle ? " @" + info.handle : ""}`,
    description: info.description || "",
    stats: {
      channel: info.name || "",
      views: null,
      likes: null,
      subs: info.subscribers || null,
      published: null,
    },
    videoId: null,
    thumbnailUrl: null,
    comments: [],
    scrapedAt: Date.now(),
  };
}

// =============================================================================
// Message handler
// =============================================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (
    msg?.type === "OPENTUBE_CHANNEL_DATA" ||
    msg?.type === "SCRAPE_PAGE"
  ) {
    try {
      sendResponse(getChannelData());
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  }
  return true;
});
