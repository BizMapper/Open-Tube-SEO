// =============================================================================
// content/watch.js — YouTube Watch Page Content Script
// =============================================================================
// This script runs on every YouTube video watch page and:
// - Scrapes video metadata (title, description, tags, stats)
// - Injects SEO score badges into the page
// - Responds to popup/sidebar/background requests for data
// - Supports auto-analysis on page load (configurable)
// =============================================================================

// =============================================================================
// DOM helpers
// =============================================================================
function txt(el) {
  return el ? el.textContent.trim() : "";
}

// =============================================================================
// parseCount — parse YouTube's abbreviated numbers (1.2M, 3.4K, etc.)
// =============================================================================
function parseCount(str) {
  if (!str) return null;
  const clean = str.replace(/,/g, "").replace(/\s+/g, " ");
  const m = clean.match(/([\d.]+)\s*([KMBTkmbt]?)/);
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
// getTitle — extract video title from the YouTube watch page
// =============================================================================
function getTitle() {
  const selectors = [
    "h1.ytd-watch-metadata yt-formatted-string",
    "h1.title yt-formatted-string",
    'h1 yt-formatted-string[class*="title"]',
    'meta[name="title"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      if (el.tagName === "META") return el.getAttribute("content") || "";
      const text = txt(el);
      if (text) return text;
    }
  }
  return document.title.replace(/ - YouTube$/, "").trim();
}

// =============================================================================
// getDescription — extract full video description
// =============================================================================
function getDescription() {
  // Try expanded description first
  const expandedSelectors = [
    "#description-inline-expander",
    "ytd-text-inline-expander #snippet-text",
    "#description yt-formatted-string",
    "#description.ytd-video-secondary-info-renderer",
  ];
  for (const sel of expandedSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = txt(el);
      if (text.length > 50) return text;
    }
  }
  // Fallback to meta description
  const meta = document.querySelector('meta[name="description"]');
  return meta ? meta.getAttribute("content") || "" : "";
}

// =============================================================================
// getTags — extract all video tags
// =============================================================================
function getTags() {
  const tags = new Set();

  // Primary: og:video:tag meta elements
  document
    .querySelectorAll('meta[property="og:video:tag"]')
    .forEach((m) => {
      const content = m.getAttribute("content");
      if (content) tags.add(content.trim());
    });

  // Secondary: keyword meta
  if (tags.size === 0) {
    const kw = document.querySelector('meta[name="keywords"]');
    if (kw) {
      kw.getAttribute("content")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((t) => tags.add(t));
    }
  }

  // Tertiary: try to find tag chips in the description area
  document
    .querySelectorAll(
      'ytd-video-secondary-info-renderer a[href*="&tag="], #super-title yt-formatted-string a[href*="&tag="]'
    )
    .forEach((a) => {
      const text = txt(a);
      if (text) tags.add(text);
    });

  return [...tags].filter(Boolean);
}

// =============================================================================
// getStats — extract video statistics (views, likes, etc.)
// =============================================================================
function getStats() {
  // Views
  let views = null;
  const viewsSelectors = [
    "ytd-watch-metadata #info span",
    "span.view-count",
    "#info-container #info span",
    '.ytd-video-primary-info-renderer span[class*="view"]',
  ];
  for (const sel of viewsSelectors) {
    const el = document.querySelector(sel);
    const text = txt(el);
    const parsed = parseCount(text);
    if (parsed) {
      views = parsed;
      break;
    }
  }

  // Likes
  let likes = null;
  const likeBtnSelectors = [
    'ytd-watch-metadata like-button-view-model button',
    '#segmented-like-button button',
    'ytd-toggle-button-renderer[is-icon-button] #button',
    '#top-level-buttons-computed ytd-segmented-like-dislike-button-renderer:first-child',
  ];
  for (const sel of likeBtnSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const ariaLabel = el.getAttribute("aria-label") || "";
      const parsed = parseCount(ariaLabel) || parseCount(txt(el));
      if (parsed) {
        likes = parsed;
        break;
      }
    }
  }

  // Channel name
  const channel = txt(
    document.querySelector(
      "ytd-channel-name #text a, #upload-info #channel-name a, #owner #channel-name ytd-channel-name a"
    )
  );

  // Subscriber count
  const subs = parseCount(
    txt(
      document.querySelector(
        "#owner-sub-count, #subscriber-count, ytd-video-owner-renderer #owner-sub-count"
      )
    )
  );

  // Publish date
  let published = null;
  const dateSelectors = [
    'ytd-watch-metadata #info-strings yt-formatted-string',
    'meta[itemprop="datePublished"]',
    '#info-strings yt-formatted-string',
  ];
  for (const sel of dateSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      if (el.tagName === "META") {
        published = el.getAttribute("content");
        break;
      }
      const text = txt(el);
      // Skip the views item, look for date text
      if (text && !text.includes("view") && !text.includes("View")) {
        published = text;
        break;
      }
    }
  }

  // Comments count
  let comments = null;
  const commentsText = txt(
    document.querySelector("#count yt-formatted-string, ytd-comments-header-renderer #count")
  );
  comments = parseCount(commentsText);

  return { views, likes, channel, subs, published, comments };
}

// =============================================================================
// getThumbnailUrl — extract the video thumbnail URL
// =============================================================================
function getThumbnailUrl() {
  const selectors = [
    'link[rel="image_src"]',
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const url = el.getAttribute("content") || el.getAttribute("href");
      if (url) return url;
    }
  }
  // Construct from video ID
  const videoId = getVideoId();
  return videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : null;
}

// =============================================================================
// getVideoId — extract YouTube video ID from URL or page data
// =============================================================================
function getVideoId() {
  // Try page data first
  const el = document.querySelector('meta[itemprop="videoId"]');
  if (el) return el.getAttribute("content");

  // Fallback to URL
  const params = new URLSearchParams(location.search);
  return params.get("v");
}

// =============================================================================
// getComments — scrape visible comments (first batch)
// =============================================================================
function getComments() {
  const comments = [];
  document
    .querySelectorAll(
      "ytd-comment-thread-renderer #content-text, ytd-comment-renderer #content-text"
    )
    .forEach((el) => {
      const text = txt(el);
      if (text) comments.push(text);
    });
  return comments.slice(0, 20);
}

// =============================================================================
// scrape — collect all available video data
// =============================================================================
function scrape() {
  const isWatch = location.pathname.startsWith("/watch");
  return {
    ok: true,
    isWatch,
    url: location.href,
    videoId: getVideoId(),
    title: getTitle(),
    description: getDescription(),
    tags: getTags(),
    stats: getStats(),
    thumbnailUrl: getThumbnailUrl(),
    comments: getComments(),
    scrapedAt: Date.now(),
  };
}

// =============================================================================
// injectScoreBadge — display a small SEO score badge on the video page
// =============================================================================
function injectScoreBadge(score, grade) {
  const existing = document.querySelector("#opentube-badge");
  if (existing) existing.remove();

  // Only inject if setting allows
  chrome.storage.local.get("opentube_settings", (result) => {
    const settings = result.opentube_settings || {};
    if (!settings.showScoreBadge) return;

    const badge = document.createElement("div");
    badge.id = "opentube-badge";
    badge.style.cssText = `
      position: fixed; bottom: 16px; right: 16px; z-index: 9999;
      background: #0f1115; color: #e8eaed; border: 1px solid #262b36;
      border-radius: 12px; padding: 10px 14px; font-family: system-ui, sans-serif;
      font-size: 13px; line-height: 1.4; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      cursor: pointer; display: flex; align-items: center; gap: 10px;
      opacity: 0; transition: opacity 0.3s ease;
    `;
    badge.innerHTML = `
      <span style="font-weight:700;font-size:18px;color:${score >= 65 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444"}">${score}</span>
      <span><strong>SEO Score</strong><br><span style="color:#9aa3b2;font-size:12px">${grade}</span></span>
    `;
    badge.onclick = () => {
      chrome.runtime.sendMessage({ type: "OPENTUBE_ANALYZE" });
    };
    document.body.appendChild(badge);
    requestAnimationFrame(() => (badge.style.opacity = "1"));

    // Auto-hide after 8 seconds
    setTimeout(() => {
      badge.style.opacity = "0";
      setTimeout(() => badge.remove(), 300);
    }, 8000);
  });
}

// =============================================================================
// message listener — responds to popup, sidebar, and background requests
// =============================================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg?.type) {
    case "SCRAPE_PAGE":
    case "OPENTUBE_GET_FULL_DATA":
      try {
        const data = scrape();
        // Cache score for badge injection
        sendResponse(data);
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      break;

    case "OPENTUBE_ANALYZE":
      // Trigger analysis and send results
      try {
        sendResponse(scrape());
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      break;

    case "OPENTUBE_GENERATE_AI":
      // Tell background to run AI generation
      chrome.runtime.sendMessage(
        { type: "AI_GENERATE", data: scrape() },
        () => {}
      );
      sendResponse({ ok: true });
      break;

    default:
      sendResponse({ ok: false, error: "Unknown message type" });
  }
  return true; // Keep channel open for async response
});

// =============================================================================
// Auto-analyze on page load
// =============================================================================
(function autoAnalyze() {
  if (!location.pathname.startsWith("/watch")) return;

  // Wait for page to fully render
  const observer = new MutationObserver((mutations, obs) => {
    const titleEl = document.querySelector("h1.ytd-watch-metadata yt-formatted-string");
    if (titleEl && titleEl.textContent.trim()) {
      obs.disconnect();
      // Delay slightly to ensure everything is loaded
      setTimeout(() => {
        const data = scrape();
        // Import and score
        chrome.storage.local.get("opentube_settings", (result) => {
          const settings = result.opentube_settings || {};
          if (settings.autoAnalyze) {
            // Inject the badge (scoring happens in popup/sidebar)
            injectScoreBadge(50, "Analyzing…");
          }
        });
      }, 1500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Timeout: stop observing after 15 seconds
  setTimeout(() => observer.disconnect(), 15000);
})();
