// =============================================================================
// content/studio.js — YouTube Studio Content Script
// =============================================================================
// This script runs on studio.youtube.com and:
// - Enhances the video upload/edit page with SEO suggestions
// - Injects optimization panels alongside title/description/tags fields
// - Provides real-time SEO scoring as the user types
// - Adds a "OpenTube Optimize" button to the upload flow
// =============================================================================

// =============================================================================
// Constants
// =============================================================================
const OPENTUBE_CONTAINER_ID = "opentube-studio-panel";
const OPENTUBE_BTN_ID = "opentube-studio-btn";

// =============================================================================
// waitForElement — poll for a DOM element to appear
// =============================================================================
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element "${selector}" not found within ${timeout}ms`));
    }, timeout);
  });
}

// =============================================================================
// injectOptimizationPanel — add SEO panel to video edit page
// =============================================================================
function injectOptimizationPanel() {
  if (document.getElementById(OPENTUBE_CONTAINER_ID)) return;

  // Find the right sidebar area in Studio
  const targetSelectors = [
    "#side-panel",
    "#editor-container .sidebar",
    ".metadata-panel",
    "#main-area > div > div:nth-child(2)",
  ];

  let target = null;
  for (const sel of targetSelectors) {
    target = document.querySelector(sel);
    if (target) break;
  }

  if (!target) {
    // Try to observe for it
    const observer = new MutationObserver(() => {
      for (const sel of targetSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          observer.disconnect();
          injectPanelInto(el);
          break;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 20000);
    return;
  }

  injectPanelInto(target);
}

// =============================================================================
// injectPanelInto — insert the SEO panel into a container element
// =============================================================================
function injectPanelInto(target) {
  if (document.getElementById(OPENTUBE_CONTAINER_ID)) return;

  const panel = document.createElement("div");
  panel.id = OPENTUBE_CONTAINER_ID;
  panel.style.cssText = `
    margin: 12px 0; padding: 14px; background: #0f1115; color: #e8eaed;
    border: 1px solid #262b36; border-radius: 12px;
    font-family: system-ui, sans-serif; font-size: 13px;
  `;
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <strong style="font-size:14px">OpenTube SEO</strong>
      <span id="opentube-studio-score" style="font-size:12px;color:#9aa3b2">Score: —</span>
    </div>
    <div id="opentube-studio-tips" style="color:#9aa3b2;font-size:12px">
      Start typing your title and description to see live SEO suggestions.
    </div>
  `;

  target.parentNode?.insertBefore(panel, target.nextSibling) ||
    target.appendChild(panel);
}

// =============================================================================
// updateSEOScore — called when the user types in title/description fields
// =============================================================================
function updateSEOScore(title, description, tags) {
  const scoreEl = document.getElementById("opentube-studio-score");
  const tipsEl = document.getElementById("opentube-studio-tips");
  if (!scoreEl || !tipsEl) return;

  if (!title && !description) {
    scoreEl.textContent = "Score: —";
    tipsEl.innerHTML = "Start typing your title and description to see live SEO suggestions.";
    return;
  }

  // Simple client-side scoring for real-time feedback
  const titleLen = (title || "").length;
  const descLen = (description || "").length;
  const tagCount = (tags || []).length;

  let passed = 0;
  const total = 6;

  if (titleLen >= 30 && titleLen <= 70) passed++;
  if (/\d/.test(title || "")) passed++;
  if (descLen >= 250) passed++;
  if (tagCount >= 8) passed++;

  const score = Math.round((passed / total) * 100);
  const color = score >= 65 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444";

  scoreEl.textContent = `Score: ${score}`;
  scoreEl.style.color = color;

  // Show tips
  const tips = [];
  if (titleLen < 30) tips.push("Make title at least 30 characters");
  if (titleLen > 70) tips.push("Title is too long—keep under 70 characters");
  if (!/\d/.test(title || "")) tips.push("Add a number to your title for more clicks");
  if (descLen < 250) tips.push(`Description needs ${250 - descLen} more characters`);
  if (tagCount < 8) tips.push(`Add ${8 - tagCount} more tags`);

  if (tips.length === 0) {
    tipsEl.innerHTML = '<span style="color:#22c55e;">✓ Looking good! All checks passing.</span>';
  } else {
    tipsEl.innerHTML = tips
      .map((t) => `<div style="margin:2px 0">• ${t}</div>`)
      .join("");
  }
}

// =============================================================================
// observeStudioFields — watch title/description inputs for changes
// =============================================================================
function observeStudioFields() {
  // YouTube Studio uses contenteditable divs for title and textareas for description
  const titleSelector =
    '#title-textarea #textarea, ytcp-video-title textarea, #title-textarea [contenteditable]';
  const descSelector =
    '#description-textarea #textarea, ytcp-video-description textarea, #description-textarea [contenteditable]';

  const titleEl = document.querySelector(titleSelector);
  const descEl = document.querySelector(descSelector);

  if (!titleEl && !descEl) {
    // Try again later
    setTimeout(() => observeStudioFields(), 3000);
    return;
  }

  const update = () => {
    const title = titleEl?.value || titleEl?.textContent || "";
    const description = descEl?.value || descEl?.textContent || "";
    // Try to find tags in the tags area
    const tagsEl = document.querySelector("#tags-textarea textarea");
    const tagsText = tagsEl?.value || "";
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    updateSEOScore(title, description, tags);
  };

  // Listen for input events on both fields
  const onInput = (e) => {
    requestAnimationFrame(update);
  };

  if (titleEl) {
    titleEl.addEventListener("input", onInput);
    titleEl.addEventListener("blur", onInput);
  }
  if (descEl) {
    descEl.addEventListener("input", onInput);
    descEl.addEventListener("blur", onInput);
  }

  // Also observe for dynamically added fields
  const observer = new MutationObserver(() => {
    const newTitle = document.querySelector(titleSelector);
    const newDesc = document.querySelector(descSelector);
    if (newTitle && newTitle !== titleEl) {
      newTitle.addEventListener("input", onInput);
    }
    if (newDesc && newDesc !== descEl) {
      newDesc.addEventListener("input", onInput);
    }
  });

  const container = document.querySelector("#main-area, #editor-container") || document.body;
  observer.observe(container, { childList: true, subtree: true });
}

// =============================================================================
// injectOptimizeButton — add "Optimize with OpenTube" button to upload page
// =============================================================================
function injectOptimizeButton() {
  if (document.getElementById(OPENTUBE_BTN_ID)) return;

  // Find the upload/save button area
  const btnSelectors = [
    "#save-button-container",
    ".save-bar",
    "#upload-header",
    "ytcp-button#done-button",
  ];

  let targetArea = null;
  for (const sel of btnSelectors) {
    targetArea = document.querySelector(sel);
    if (targetArea) break;
  }

  if (!targetArea) {
    setTimeout(() => injectOptimizeButton(), 5000);
    return;
  }

  const btn = document.createElement("button");
  btn.id = OPENTUBE_BTN_ID;
  btn.textContent = "Optimize with OpenTube SEO";
  btn.style.cssText = `
    background: #ef4444; color: white; border: none; border-radius: 8px;
    padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
    margin-left: 8px; font-family: system-ui, sans-serif;
  `;
  btn.onmouseenter = () => (btn.style.opacity = "0.9");
  btn.onmouseleave = () => (btn.style.opacity = "1");
  btn.onclick = () => {
    // Gather current field values and send for analysis
    const titleEl = document.querySelector(
      '#title-textarea #textarea, ytcp-video-title textarea, #title-textarea [contenteditable]'
    );
    const descEl = document.querySelector(
      '#description-textarea #textarea, ytcp-video-description textarea, #description-textarea [contenteditable]'
    );

    chrome.runtime.sendMessage({
      type: "AI_GENERATE",
      data: {
        title: titleEl?.value || titleEl?.textContent || "",
        description: descEl?.value || descEl?.textContent || "",
        keywords: [],
      },
    });
  };

  targetArea.appendChild(btn);
}

// =============================================================================
// scrapeStudio — read title, description, tags from the Studio edit form
// =============================================================================
function scrapeStudio() {
  const isEdit =
    location.pathname.includes("/video/") ||
    location.pathname.includes("/edit") ||
    location.pathname.includes("/upload");

  // Helper: scan all textareas/inputs on the page for content
  function findFieldByKeyword(keywords) {
    // Try specific selectors first (may fail if elements are in shadow DOM)
    // Then fall back to scanning all inputs/textareas on the page
    const kws = keywords.toLowerCase().split(",");
    const allInputs = document.querySelectorAll("textarea, input[type=text], [contenteditable], iron-autogrow-textarea");
    let best = null;
    let bestScore = 0;
    for (const el of allInputs) {
      const val = el.value || el.textContent || "";
      if (!val.trim()) continue;
      // Check the element's own id/class/placeholder/label for keyword match
      const ctx = ((el.id || "") + " " + (el.className || "") + " " + (el.placeholder || "") + " " + ((el.closest("[id]") || {}).id || "")).toLowerCase();
      const score = kws.filter(k => ctx.includes(k.trim())).length;
      // Also check aria-label
      const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
      const ariaScore = kws.filter(k => ariaLabel.includes(k.trim())).length;
      const totalScore = score + ariaScore * 2;
      if (totalScore > bestScore || (totalScore === bestScore && val.length > (best?.value?.length || 0))) {
        bestScore = totalScore;
        best = { el, value: val };
      }
    }
    return best ? best.value : "";
  }

  // Helper: scan ALL textareas by content length (description is usually the biggest textarea)
  function findLargestTextarea() {
    const all = document.querySelectorAll("textarea, [contenteditable], iron-autogrow-textarea");
    let largest = null;
    let largestLen = 0;
    for (const el of all) {
      const val = el.value || el.textContent || "";
      if (val.trim().length > largestLen) {
        largestLen = val.trim().length;
        largest = val.trim();
      }
    }
    return largest || "";
  }

  // Title field
  const titleSelectors = [
    '#title-textarea #textarea',
    'ytcp-video-title textarea',
    '#title-textarea [contenteditable]',
    'textarea#title-textarea',
  ];
  let title = "";
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      title = el.value || el.textContent || "";
      if (title.trim()) break;
    }
  }
  if (!title) {
    // Fallback: find by keyword
    title = findFieldByKeyword("title");
  }

  // Description field
  const descSelectors = [
    '#description-textarea #textarea',
    'ytcp-video-description textarea',
    '#description-textarea [contenteditable]',
    'textarea#description-textarea',
    'ytcp-video-description paper-textarea',
  ];
  let description = "";
  for (const sel of descSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      description = el.value || el.textContent || "";
      if (description.trim()) break;
    }
  }
  if (!description) {
    // Fallback: find by keyword or pick largest textarea
    description = findFieldByKeyword("desc") || findLargestTextarea();
  }

  // Tags field
  const tagsSelectors = [
    '#tags-textarea textarea',
    'ytcp-video-tags textarea',
    'input#tags-input',
    'ytcp-video-tags iron-input',
  ];
  let tagsText = "";
  for (const sel of tagsSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      tagsText = el.value || el.textContent || "";
      if (tagsText.trim()) break;
    }
  }
  if (!tagsText) {
    tagsText = findFieldByKeyword("tag");
  }
  const tags = tagsText
    .split(/[,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  // Extract video ID from URL
  const videoId = location.pathname.match(/\/video\/([^/]+)/)?.[1] || null;

  // Channel name from Studio header
  const channelEl = document.querySelector(
    '#channel-name, ytcp-channel-name, .channel-name'
  );
  const channel = channelEl?.textContent?.trim() || "";

  return {
    ok: true,
    isWatch: false,
    isStudio: true,
    isEdit,
    url: location.href,
    videoId,
    title,
    description,
    tags,
    stats: { channel, views: null, likes: null, subs: null, published: null },
    thumbnailUrl: videoId
      ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      : null,
    comments: [],
    scrapedAt: Date.now(),
  };
}

// =============================================================================
// Message listener
// =============================================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "SCRAPE_PAGE" || msg?.type === "OPENTUBE_GET_FULL_DATA") {
    try {
      sendResponse(scrapeStudio());
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  }
  return true;
});

// =============================================================================
// Init — run when studio page loads
// =============================================================================
(function init() {
  // Wait for the page to fully load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(initStudio, 2000);
    });
  } else {
    setTimeout(initStudio, 2000);
  }
})();

function initStudio() {
  // Only inject on video edit pages (not dashboard)
  const isEditPage =
    location.pathname.includes("/video/") ||
    location.pathname.includes("/edit") ||
    location.pathname.includes("/upload");

  if (isEditPage || location.pathname === "/studio" || location.pathname === "/studio/") {
    injectOptimizationPanel();
    observeStudioFields();
    injectOptimizeButton();
  }

  // Watch for navigation changes (Studio is a SPA)
  let lastPath = location.pathname;
  const navObserver = new MutationObserver(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      if (
        location.pathname.includes("/video/") ||
        location.pathname.includes("/edit") ||
        location.pathname.includes("/upload")
      ) {
        setTimeout(() => {
          injectOptimizationPanel();
          observeStudioFields();
          injectOptimizeButton();
        }, 2000);
      }
    }
  });
  navObserver.observe(document.body, { childList: true, subtree: true });
}
