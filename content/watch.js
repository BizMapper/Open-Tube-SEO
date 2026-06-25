// =============================================================================
// content/watch.js — YouTube Watch Page Content Script
// =============================================================================
// This script runs on every YouTube video watch page and:
// - Scrapes video metadata (title, description, tags, stats)
// - Injects SEO score badges into the page
// - Responds to popup/sidebar/background requests for data
// - Supports auto-analysis on page load (configurable)
//
// NOTE: YouTube uses Shadow DOM heavily. querySelector works across open
// shadow roots but NOT closed ones. If scraping fails, YouTube likely
// changed their DOM structure — file an issue with current page HTML.
// =============================================================================

// =============================================================================
// DOM helpers
// =============================================================================
function txt(el) {
  return el ? el.textContent.trim() : "";
}

// =============================================================================
// qsAll — querySelectorAll safe wrapper with optional root
// =============================================================================
function qsAll(sel, root) {
  try {
    return Array.from((root || document).querySelectorAll(sel));
  } catch { return []; }
}
function qs(sel, root) {
  try { return (root || document).querySelector(sel); } catch { return null; }
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
// deepText — walk all open shadow roots to collect text from a selector
// =============================================================================
function deepText(selectors) {
  for (const sel of selectors) {
    // Try normal DOM first
    const el = qs(sel);
    if (el && el.tagName !== "META") {
      const text = txt(el);
      if (text) return text;
    }
    if (el && el.tagName === "META") {
      const content = el.getAttribute("content");
      if (content) return content;
    }
  }
  return "";
}

// =============================================================================
// getTitle — extract video title from the YouTube watch page
// =============================================================================
function getTitle() {
  const selectors = [
    'h1 yt-formatted-string',
    'h1.ytd-watch-metadata yt-formatted-string',
    'h1.title yt-formatted-string',
    'h1 yt-formatted-string[class*="title"]',
    'meta[name="title"]',
  ];
  for (const sel of selectors) {
    const el = qs(sel);
    if (el) {
      if (el.tagName === "META") {
        const c = el.getAttribute("content");
        if (c) return c;
        continue;
      }
      const text = txt(el);
      if (text) return text;
    }
  }
  // Try the page title as last resort
  const pageTitle = document.title.replace(/ - YouTube$/, "").trim();
  if (pageTitle) return pageTitle;
  // Try all h1 elements visible
  const h1s = qsAll("h1");
  for (const h1 of h1s) {
    const text = txt(h1);
    if (text) return text;
  }
  return "";
}

// =============================================================================
// getDescription — extract full video description
// =============================================================================
function getDescription() {
  // Get the meta description as the most reliable source
  const meta = qs('meta[name="description"]');
  if (meta) {
    const content = meta.getAttribute("content") || "";
    if (content.length > 50) return content;
  }
  // Try expanded description elements
  const expandedSelectors = [
    "#description-inline-expander",
    "ytd-text-inline-expander #snippet-text",
    "#description yt-formatted-string",
    "#description.ytd-video-secondary-info-renderer",
    '#description',
  ];
  for (const sel of expandedSelectors) {
    const el = qs(sel);
    if (el) {
      const text = txt(el);
      if (text.length > 50) return text;
    }
  }
  return meta ? meta.getAttribute("content") || "" : "";
}

// =============================================================================
// getTags — extract all video tags
// =============================================================================
function getTags() {
  const tags = new Set();

  // Primary: og:video:tag meta elements
  qsAll('meta[property="og:video:tag"]').forEach((m) => {
    const content = m.getAttribute("content");
    if (content) tags.add(content.trim());
  });

  // Secondary: keyword meta
  if (tags.size === 0) {
    const kw = qs('meta[name="keywords"]');
    if (kw) {
      (kw.getAttribute("content") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((t) => tags.add(t));
    }
  }

  return [...tags].filter(Boolean);
}

// =============================================================================
// getStats — extract video statistics (views, likes, etc.)
// =============================================================================
function getStats() {
  let views = null;
  let likes = null;
  let channel = "";
  let subs = null;
  let published = null;
  let comments = null;

  // --- Views ---
  // YouTube puts view count in multiple possible locations
  const viewSources = [
    // Try all spans inside the info area
    () => {
      const spans = qsAll("span");
      for (const s of spans) {
        const text = txt(s);
        const parsed = parseCount(text);
        if (parsed && /view/i.test(text)) return parsed;
      }
      return null;
    },
    // Try meta itemprop="interactionStatistic"
    () => {
      const metas = qsAll('meta[itemprop="interactionStatistic"]');
      for (const m of metas) {
        const val = m.getAttribute("content");
        if (val) return parseCount(val);
      }
      return null;
    },
  ];
  for (const src of viewSources) {
    const val = src();
    if (val) { views = val; break; }
  }

  // --- Likes ---
  const likeSources = [
    () => {
      // Try all buttons that mention "like" in aria-label
      const btns = qsAll("button");
      for (const b of btns) {
        const label = (b.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes("like") && !label.includes("dislike")) {
          return parseCount(label);
        }
      }
      return null;
    },
  ];
  for (const src of likeSources) {
    const val = src();
    if (val) { likes = val; break; }
  }

  // --- Channel name ---
  const channelSels = [
    "ytd-channel-name #text a",
    "#upload-info #channel-name a",
    "#owner #channel-name ytd-channel-name a",
    "ytd-video-owner-renderer ytd-channel-name a",
    "#owner #channel-name a",
    'a[href^="/@"][slot="title"]',
  ];
  for (const sel of channelSels) {
    const el = qs(sel);
    if (el) {
      channel = txt(el);
      if (channel) break;
    }
  }

  // --- Subscriber count ---
  const subSels = [
    "#owner-sub-count",
    "#subscriber-count",
    "ytd-video-owner-renderer #owner-sub-count",
    "#subscribe-count",
  ];
  for (const sel of subSels) {
    const text = txt(qs(sel));
    if (text) { subs = parseCount(text); break; }
  }

  // --- Publish date ---
  const dateMeta = qs('meta[itemprop="datePublished"]');
  if (dateMeta) {
    published = dateMeta.getAttribute("content");
  }
  if (!published) {
    const dateSels = [
      '#info-strings yt-formatted-string',
      '#info-container yt-formatted-string',
    ];
    for (const sel of dateSels) {
      const el = qs(sel);
      if (el) {
        const text = txt(el);
        if (text && !/view|View/i.test(text)) {
          published = text;
          break;
        }
      }
    }
  }

  // --- Comments count ---
  const commentSels = [
    "#count yt-formatted-string",
    "ytd-comments-header-renderer #count",
    "#comments #count",
  ];
  for (const sel of commentSels) {
    const text = txt(qs(sel));
    if (text) { comments = parseCount(text); break; }
  }

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
    const el = qs(sel);
    if (el) {
      const url = el.getAttribute("content") || el.getAttribute("href");
      if (url) return url;
    }
  }
  const videoId = getVideoId();
  return videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : null;
}

// =============================================================================
// getVideoId — extract YouTube video ID from URL or page data
// =============================================================================
function getVideoId() {
  const el = qs('meta[itemprop="videoId"]');
  if (el) return el.getAttribute("content");
  const params = new URLSearchParams(location.search);
  return params.get("v");
}

// =============================================================================
// getComments — scrape visible comments (first batch)
// =============================================================================
function getComments() {
  const comments = [];
  qsAll(
    "ytd-comment-thread-renderer #content-text, ytd-comment-renderer #content-text"
  ).forEach((el) => {
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
  const title = getTitle();
  const description = getDescription();
  const tags = getTags();
  const stats = getStats();
  const data = {
    ok: true,
    isWatch,
    url: location.href,
    videoId: getVideoId(),
    title,
    description,
    tags,
    stats,
    thumbnailUrl: getThumbnailUrl(),
    comments: getComments(),
    scrapedAt: Date.now(),
  };
  // Detect when scraping returns nothing useful
  data._empty = !title && !description && !stats.views && !stats.channel;
  return data;
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
