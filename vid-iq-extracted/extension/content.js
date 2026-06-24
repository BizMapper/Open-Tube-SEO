// content.js — scrapes the current YouTube watch page DOM.
// Runs in the page context and responds to popup requests.

function txt(el) {
  return el ? el.textContent.trim() : "";
}

function parseCount(str) {
  if (!str) return null;
  const m = str.replace(/,/g, "").match(/([\d.]+)\s*([KMB]?)/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const unit = (m[2] || "").toUpperCase();
  if (unit === "K") n *= 1e3;
  else if (unit === "M") n *= 1e6;
  else if (unit === "B") n *= 1e9;
  return Math.round(n);
}

function getTitle() {
  const el =
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
    document.querySelector("h1.title yt-formatted-string") ||
    document.querySelector('meta[name="title"]');
  if (el && el.tagName === "META") return el.getAttribute("content") || "";
  return txt(el) || document.title.replace(/ - YouTube$/, "");
}

function getDescription() {
  const expanded = document.querySelector(
    "#description-inline-expander, ytd-text-inline-expander #snippet-text"
  );
  if (expanded) return txt(expanded);
  const meta = document.querySelector('meta[name="description"]');
  return meta ? meta.getAttribute("content") || "" : "";
}

function getTags() {
  const tags = [];
  document
    .querySelectorAll('meta[property="og:video:tag"]')
    .forEach((m) => tags.push(m.getAttribute("content")));
  // Fallback: keywords meta
  if (tags.length === 0) {
    const kw = document.querySelector('meta[name="keywords"]');
    if (kw)
      kw
        .getAttribute("content")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((t) => tags.push(t));
  }
  return [...new Set(tags.filter(Boolean))];
}

function getStats() {
  const viewsEl = document.querySelector(
    "ytd-watch-metadata #info span, span.view-count"
  );
  const views =
    parseCount(txt(viewsEl)) ||
    parseCount(
      txt(document.querySelector("#info-container #info span")) || ""
    );

  let likes = null;
  const likeBtn = document.querySelector(
    'ytd-watch-metadata like-button-view-model button, #segmented-like-button button'
  );
  if (likeBtn) {
    likes =
      parseCount(likeBtn.getAttribute("aria-label") || "") ||
      parseCount(txt(likeBtn));
  }

  const channel = txt(
    document.querySelector("ytd-channel-name #text a, #upload-info #channel-name a")
  );

  const subs = parseCount(
    txt(document.querySelector("#owner-sub-count, #subscriber-count"))
  );

  const dateEl = document.querySelector(
    'ytd-watch-metadata #info-strings yt-formatted-string, meta[itemprop="datePublished"]'
  );
  const published =
    dateEl && dateEl.tagName === "META"
      ? dateEl.getAttribute("content")
      : txt(dateEl);

  return { views, likes, channel, subs, published };
}

function scrape() {
  const isWatch = location.pathname.startsWith("/watch");
  return {
    ok: true,
    isWatch,
    url: location.href,
    title: getTitle(),
    description: getDescription(),
    tags: getTags(),
    stats: getStats(),
    scrapedAt: Date.now(),
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "SCRAPE_PAGE") {
    try {
      sendResponse(scrape());
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  }
  return true;
});
