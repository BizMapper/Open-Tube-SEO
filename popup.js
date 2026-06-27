// =============================================================================
// popup.js — Main popup script with tabbed interface
// =============================================================================
// This module coordinates:
// - Tab switching between SEO, Keywords, Competitors, AI, and Settings views
// - Page data scraping from the content script
// - SEO scoring and keyword extraction
// - AI suggestion generation via WebLLM
// - Settings management and data export/import
// =============================================================================
import {
  scoreSEO,
  extractKeywords,
  analyzeReadability,
  estimateKeywordDifficulty,
  tokenize,
} from "./lib/seo.js";
import {
  classifyIntent,
  estimateVolume,
  suggestLongTail,
  scoreKeyword,
} from "./lib/keywords.js";
import {
  compareMetadata,
  findContentGaps,
  analyzeTagStrategy,
} from "./lib/competitors.js";
import {
  MODELS,
  DEFAULT_MODEL,
  loadModel,
  generateSuggestions,
  isWebGPUAvailable,
} from "./lib/engine.js";

// =============================================================================
// DOM helpers
// =============================================================================
const $ = (id) => document.getElementById(id);

let pageData = null;
let keywords = [];

// =============================================================================
// Tab switching
// =============================================================================
$("tabs").addEventListener("click", (e) => {
  const tabBtn = e.target.closest(".tab");
  if (!tabBtn) return;

  // Update tab buttons
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  tabBtn.classList.add("active");

  // Update tab content
  const tabName = tabBtn.dataset.tab;
  document.querySelectorAll(".tab-content").forEach((tc) => tc.classList.remove("active"));
  $(`tab-${tabName}`).classList.add("active");
});

// =============================================================================
// GPU badge
// =============================================================================
const gpuBadge = $("gpu-badge");
if (isWebGPUAvailable()) {
  gpuBadge.textContent = "WebGPU ✓";
  gpuBadge.classList.add("ok");
} else {
  gpuBadge.textContent = "No WebGPU";
  gpuBadge.classList.add("no");
}

// =============================================================================
// Model dropdown (main + settings)
// =============================================================================
function populateModelDropdowns() {
  [($("model-select"), $("setting-model"))].forEach((sel) => {
    if (!sel) return;
    sel.innerHTML = "";
    for (const [id, label] of Object.entries(MODELS)) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = label;
      sel.appendChild(opt);
    }
    sel.value = DEFAULT_MODEL;
  });
}
populateModelDropdowns();

// =============================================================================
// Settings — load and bind
// =============================================================================
async function loadSettings() {
  try {
    const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    if (settings) {
      $("setting-auto").checked = settings.autoAnalyze !== false;
      $("setting-badge").checked = settings.showScoreBadge !== false;
      $("setting-sidebar").checked = settings.enableSidebar !== false;
      $("setting-ai").checked = settings.useAI !== false;
      if (settings.model && $("setting-model")) {
        $("setting-model").value = settings.model;
      }
    }
  } catch (e) {
    console.log("[settings] Could not load:", e.message);
  }
}

async function saveSettings() {
  const settings = {
    autoAnalyze: $("setting-auto").checked,
    showScoreBadge: $("setting-badge").checked,
    enableSidebar: $("setting-sidebar").checked,
    useAI: $("setting-ai").checked,
    model: $("setting-model")?.value || DEFAULT_MODEL,
  };
  try {
    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
  } catch (e) {
    console.log("[settings] Could not save:", e.message);
  }
}

// Bind settings change events
document.querySelectorAll("#tab-settings input[type=checkbox]").forEach((el) => {
  el.addEventListener("change", saveSettings);
});
$("setting-model")?.addEventListener("change", saveSettings);

// =============================================================================
// Scrape the active tab
// =============================================================================
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function scrapeCurrentPage(retries = 2) {
  const tab = await getActiveTab();
  if (!tab || !tab.url) return null;

  const isYouTube =
    /youtube\.com/.test(tab.url) || /youtu\.be/.test(tab.url);
  if (!isYouTube) return { ok: false, notYouTube: true };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_PAGE" });
    } catch (err) {
      if (attempt < retries) {
        // Content script not injected — inject it
        try {
          // Determine which content script to inject based on URL
          let file = "content/watch.js";
          if (tab.url.includes("studio.youtube.com")) file = "content/studio.js";
          else if (tab.url.includes("/results")) file = "content/search.js";
          else if (tab.url.includes("/feed/")) file = "content/feed.js";
          else if (
            tab.url.includes("/channel") ||
            tab.url.includes("/c/") ||
            tab.url.includes("/@")
          ) {
            file = "content/channel.js";
          }

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [file],
          });
          // Wait a moment for script initialization
          await new Promise((r) => setTimeout(r, 500));
        } catch (injectErr) {
          console.log("[scrape] Injection error:", injectErr.message);
        }
      } else {
        return { ok: false, error: err.message };
      }
    }
  }
  return { ok: false, error: "Max retries exceeded" };
}

// =============================================================================
// Render SEO score
// =============================================================================
function renderScore(data) {
  if (!data?.title && !data?.description) {
    $("score-num").textContent = "N/A";
    $("score-grade").textContent = "SEO: No data";
    $("score-sub").textContent = "Could not extract video metadata";
    return;
  }

  const { score, grade, passed, total, checks } = scoreSEO(data);
  const ring = $("score-ring");
  const col =
    score >= 75 ? "var(--good)" : score >= 55 ? "var(--warn)" : "var(--bad)";
  ring.style.setProperty("--val", score);
  ring.style.setProperty("--col", col);
  $("score-num").textContent = score;
  $("score-grade").textContent = `SEO: ${grade}`;
  $("score-sub").textContent = `${passed} of ${total} checks passed`;

  const list = $("checklist");
  list.innerHTML = "";
  for (const c of checks) {
    const li = document.createElement("li");
    li.className = c.pass ? "pass" : "fail";
    li.innerHTML = `<span class="icon">${c.pass ? "✓" : "!"}</span>
      <span>${c.label}${c.pass ? "" : ` — <span class="hint">${c.hint}</span>`}
      ${c.pass || !c.action ? "" : `<br><span class="action">→ ${c.action}</span>`}
      </span>`;
    list.appendChild(li);
  }
}

// =============================================================================
// Render readability
// =============================================================================
function renderReadability(data) {
  const readability = analyzeReadability(data?.description);
  const el = $("readability-score");
  if (readability.score === 0) {
    el.textContent = "Description too short for analysis (need 50+ chars)";
    return;
  }
  el.innerHTML = `
    <div>Score: ${readability.score}/100 — <strong>${readability.level}</strong></div>
    <div class="muted small">${readability.words} words · ${readability.sentences} sentences · ${readability.avgWordsPerSentence} words/sentence</div>
  `;
}

// =============================================================================
// Render video info
// =============================================================================
function renderVideoInfo(data) {
  const el = $("video-info");
  if (!data) {
    el.textContent = "No video data available";
    return;
  }
  const s = data.stats || {};
  el.innerHTML = `
    <div><strong>Title:</strong> ${data.title || "(none)"}</div>
    <div><strong>Channel:</strong> ${s.channel || "(unknown)"}</div>
    <div><strong>Views:</strong> ${s.views?.toLocaleString() || "N/A"} · 
         <strong>Likes:</strong> ${s.likes?.toLocaleString() || "N/A"}</div>
    <div><strong>Tags:</strong> ${(data.tags || []).length} tags</div>
    <div><strong>Published:</strong> ${s.published || "N/A"}</div>
    ${data.videoId ? `<div><strong>Video ID:</strong> ${data.videoId}</div>` : ""}
  `;
}

// =============================================================================
// Render keywords
// =============================================================================
function renderKeywords(data) {
  keywords = extractKeywords(data);
  const container = $("keywords-container");
  container.innerHTML = "";

  if (keywords.length === 0) {
    container.innerHTML = `<span class="muted small">No keywords detected.</span>`;
    return;
  }

  for (const k of keywords) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = k.word;
    chip.title = `Score: ${k.score} · ${k.type} · Click to copy`;
    chip.onclick = () => copyText(chip, k.word);
    container.appendChild(chip);
  }
}

// =============================================================================
// Copy to clipboard
// =============================================================================
function copyText(el, text) {
  navigator.clipboard.writeText(text).catch(() => {});
  el.classList.add("copied");
  setTimeout(() => el.classList.remove("copied"), 800);
}

$("btn-copy-keywords")?.addEventListener("click", () => {
  const text = keywords.map((k) => k.word).join(", ");
  navigator.clipboard.writeText(text).catch(() => {});
  $("btn-copy-keywords").textContent = "Copied!";
  setTimeout(() => {
    $("btn-copy-keywords").textContent = "Copy all keywords";
  }, 1500);
});

// =============================================================================
// Keyword research
// =============================================================================
$("btn-research-keyword")?.addEventListener("click", async () => {
  const input = $("keyword-input");
  const kw = input.value.trim();
  if (!kw) return;

  const resultsEl = $("keyword-research-results");
  const longtailEl = $("longtail-results");

  // Score the keyword
  const scored = scoreKeyword(kw, pageData?.tags || []);
  resultsEl.innerHTML = `
    <div style="margin-bottom:8px">
      <strong>Intent:</strong> ${scored.intent.intent} (${scored.intent.confidence}% confidence)
    </div>
    <div style="margin-bottom:8px">
      <strong>Est. volume:</strong> ${scored.volume.volume}/mo · <strong>Opportunity:</strong> ${scored.opportunity}/100
    </div>
    <div style="margin-bottom:8px">
      <strong>Relevancy:</strong> ${scored.relevancy}% · <strong>Specificity:</strong> ${scored.specificity}% · <strong>Competition:</strong> ${scored.competition}%
    </div>
  `;

  // Show long-tail suggestions
  const longtail = suggestLongTail(kw);
  const longtailSlice = longtail.slice(0, 15);
  longtailEl.innerHTML =
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <strong>Long-tail variations</strong>
      <button class="btn small" id="btn-copy-longtail">Copy all</button>
    </div>` +
    longtailSlice
      .map(
        (s) =>
          `<span class="chip" onclick="navigator.clipboard.writeText('${s.replace(
            /'/g,
            "\\'"
          )}').then(() => this.classList.add('copied'))">${s}</span>`
      )
      .join("") +
    `<div class="muted small" style="margin-top:4px">Click individual chips to copy · <strong>${longtail.length}</strong> total variations</div>`;

  // Bind the copy-all button after it's in the DOM
  setTimeout(() => {
    const copyBtn = document.getElementById("btn-copy-longtail");
    if (copyBtn) {
      copyBtn.onclick = () => {
        const text = longtailSlice.join(", ");
        navigator.clipboard.writeText(text);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy all"; }, 1500);
      };
    }
  }, 0);
});

// =============================================================================
// AI generation
// =============================================================================
$("btn-generate")?.addEventListener("click", async () => {
  if (!isWebGPUAvailable()) {
    $("ai-not-available").classList.remove("hidden");
    return;
  }
  $("ai-not-available").classList.add("hidden");

  const btn = $("btn-generate");
  const progress = $("ai-progress");
  const fill = $("bar-fill");
  const ptext = $("progress-text");
  const results = $("ai-results");

  btn.disabled = true;
  progress.classList.remove("hidden");
  results.innerHTML = "";

  try {
    const modelId = $("model-select")?.value || DEFAULT_MODEL;

    await loadModel(modelId, (report) => {
      const pct = Math.round((report.progress || 0) * 100);
      fill.style.width = pct + "%";
      ptext.textContent = report.text || `Loading model… ${pct}%`;
    });

    ptext.textContent = "Generating suggestions…";
    fill.style.width = "100%";

    const out = await generateSuggestions({
      title: pageData?.title,
      description: pageData?.description,
      keywords: keywords.map((k) => k.word),
    });

    renderAI(out);
  } catch (e) {
    results.innerHTML = `<p class="muted small">Generation failed: ${e.message || e}</p>`;
  } finally {
    btn.disabled = false;
    progress.classList.add("hidden");
    fill.style.width = "0%";
  }
});

// =============================================================================
// Render AI results
// =============================================================================
function renderAI({ titles, tags, description, hashtags }) {
  const results = $("ai-results");
  results.innerHTML = "";

  if (titles?.length) {
    const block = document.createElement("div");
    block.className = "ai-block";
    block.innerHTML = "<h3>Suggested titles (click to copy)</h3>";
    titles.forEach((t) => {
      const item = document.createElement("div");
      item.className = "ai-item";
      item.textContent = t;
      item.onclick = () => copyText(item, t);
      block.appendChild(item);
    });
    results.appendChild(block);
  }

  if (tags?.length) {
    const block = document.createElement("div");
    block.className = "ai-block";
    block.innerHTML = "<h3>Suggested tags (click to copy all)</h3>";
    const item = document.createElement("div");
    item.className = "ai-item";
    item.textContent = tags.join(", ");
    item.onclick = () => copyText(item, tags.join(", "));
    block.appendChild(item);
    results.appendChild(block);
  }

  if (hashtags?.length) {
    const block = document.createElement("div");
    block.className = "ai-block";
    block.innerHTML = "<h3>Hashtags (click to copy all)</h3>";
    const item = document.createElement("div");
    item.className = "ai-item";
    item.textContent = hashtags.join(" ");
    item.onclick = () => copyText(item, hashtags.join(" "));
    block.appendChild(item);
    results.appendChild(block);
  }

  if (description) {
    const block = document.createElement("div");
    block.className = "ai-block";
    block.innerHTML = "<h3>Suggested description (click to copy)</h3>";
    const item = document.createElement("div");
    item.className = "ai-item";
    item.style.whiteSpace = "pre-wrap";
    item.textContent = description.slice(0, 1000);
    item.onclick = () => copyText(item, description);
    block.appendChild(item);
    results.appendChild(block);
  }
}

// =============================================================================
// Competitor tab — tag strategy, recommendations, and content gaps
// =============================================================================
async function renderCompetitorTab() {
  const title = pageData?.title || "";
  const description = pageData?.description || "";
  const tags = pageData?.tags || [];

  // --- 1. Tag strategy breakdown ---
  const analysis = analyzeTagStrategy(tags);
  const analysisEl = $("competitor-analysis");
  const hasTags = tags.length > 0;
  analysisEl.innerHTML = hasTags
    ? `<div style="margin-bottom:6px">
        <strong>${tags.length} tags</strong> — Broad: <strong>${analysis.broad.length}</strong> · Specific: <strong>${analysis.specific.length}</strong> · Long-tail: <strong>${analysis.longTail.length}</strong>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${tags.map(t => `<span class="chip" onclick="navigator.clipboard.writeText('${t.replace(/'/g,"\\'")}');this.classList.add('copied')">${t}</span>`).join("")}
      </div>
      <div style="margin-top:6px;color:#9aa3b2;font-size:12px">
        ${analysis.broad.length === 0 ? "Tip: Add some single-word broad tags for discovery." : ""}
        ${analysis.specific.length < 3 ? " Add more 2-3 word specific tags for relevance." : ""}
        ${analysis.longTail.length < 3 ? " Add long-tail phrases (4+ words) for low-competition ranking." : ""}
      </div>`
    : `<span class="muted">No tags found — add tags in YouTube Studio or use the AI tab to generate them.</span>`;

  // --- 2. Recommended tags to add ---
  const recEl = $("recommended-tags");
  const titleTokens = tokenize(title);
  if (titleTokens.length === 0 && !description) {
    recEl.innerHTML = `<span class="muted">Add a title to get tag recommendations.</span>`;
  } else {
    // Extract keywords we already have
    const existingKeywords = new Set(tags.map(t => t.toLowerCase()));
    const existingWords = new Set();
    tags.forEach(t => tokenize(t).forEach(w => existingWords.add(w)));

    // Generate recommended tag categories based on what's MISSING
    const recs = [];

    // Suggest broad category tags
    const broadRecs = ["tutorial", "review", "howto", "guide", "tips", "vlog", "educational", "entertainment"]
      .filter(b => !existingWords.has(b));
    if (broadRecs.length > 0) recs.push({ cat: "Broad discovery", tags: broadRecs.slice(0, 4) });

    // Suggest title-word tags
    const titleWordRecs = titleTokens.filter(w => !existingWords.has(w));
    if (titleWordRecs.length > 0) recs.push({ cat: "From your title", tags: titleWordRecs.slice(0, 5) });

    // Suggest phrase tags (2-3 word combinations from title)
    const phraseRecs = [];
    for (let i = 0; i < titleTokens.length - 1; i++) {
      const phrase = titleTokens[i] + " " + titleTokens[i + 1];
      if (!existingKeywords.has(phrase)) phraseRecs.push(phrase);
    }
    if (phraseRecs.length > 0) recs.push({ cat: "Title phrases (long-tail)", tags: phraseRecs.slice(0, 4) });

    // Suggest description keyword tags
    const descTokens = tokenize(description);
    const descRecs = descTokens.filter(w => !existingWords.has(w) && !titleTokens.includes(w));
    if (descRecs.length > 0) recs.push({ cat: "From your description", tags: descRecs.slice(0, 5) });

    if (recs.length === 0) {
      recEl.innerHTML = `<span class="muted good">Your tags already cover all detected keywords. Good coverage!</span>`;
    } else {
      recEl.innerHTML = recs.map(r =>
        `<div style="margin-bottom:8px">
          <strong style="font-size:11px;color:#9aa3b2;text-transform:uppercase">${r.cat}</strong>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">
            ${r.tags.map(t => `<span class="chip" onclick="navigator.clipboard.writeText('${t.replace(/'/g,"\\'")}');this.classList.add('copied')">${t}</span>`).join("")}
          </div>
        </div>`
      ).join("");
    }
  }

  // --- 3. Content gaps ---
  const gapEl = $("content-gaps");
  if (!title && !description) {
    gapEl.innerHTML = `<span class="muted">No content data available. Open a video page first.</span>`;
  } else {
    // Find keywords in title/description that are NOT in tags
    const allTokens = [...new Set([...tokenize(title), ...tokenize(description)])];
    const existingSet = new Set();
    tags.forEach(t => tokenize(t).forEach(w => existingSet.add(w)));
    const gaps = allTokens.filter(w => !existingSet.has(w) && w.length > 3);

    if (gaps.length === 0) {
      gapEl.innerHTML = `<span class="good">✓ All your content keywords are covered by existing tags.</span>`;
    } else {
      gapEl.innerHTML =
        `<div style="margin-bottom:6px">These keywords appear in your content but NOT in your tags — add them to rank for these terms:</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${gaps.slice(0, 12).map(w =>
            `<span class="chip" onclick="navigator.clipboard.writeText('${w.replace(/'/g,"\\'")}');this.classList.add('copied')">${w}</span>`
          ).join("")}
        </div>
        <div style="margin-top:6px;color:#9aa3b2;font-size:12px">
          ${gaps.length > 12 ? `+${gaps.length - 12} more gaps` : ""}
          Click any chip to copy, then paste into Studio's tags field.
        </div>`;
    }
  }
}

// =============================================================================
// Re-analyze / Refresh buttons
// =============================================================================
$("btn-reanalyze")?.addEventListener("click", async () => {
  await initPopup(true);
});

$("btn-refresh")?.addEventListener("click", async () => {
  await initPopup(true);
});

// =============================================================================
// Export / Import
// =============================================================================
$("btn-export")?.addEventListener("click", async () => {
  try {
    const result = await chrome.runtime.sendMessage({ type: "EXPORT_DATA" });
    if (result.ok) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `opentube-seo-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.log("[export] Error:", e.message);
  }
});

$("btn-import")?.addEventListener("click", () => {
  $("import-file").click();
});

$("import-file")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const result = await chrome.runtime.sendMessage({
      type: "IMPORT_DATA",
      data,
    });
    if (result.ok) {
      alert(`Imported ${result.imported} data sections.`);
    }
  } catch (err) {
    alert("Import failed: " + err.message);
  }

  // Reset the file input
  e.target.value = "";
});

// =============================================================================
// Init — load current page data and render everything
// =============================================================================
async function initPopup(forceRefresh = false) {
  // Scrape the page
  pageData = await scrapeCurrentPage();

  if (!pageData || pageData.notYouTube) {
    $("not-youtube").classList.remove("hidden");
    $("app").classList.add("hidden");
    return;
  }

  if (!pageData.ok) {
    $("not-youtube").classList.remove("hidden");
    $("not-youtube").querySelector(".empty-state p").textContent =
      "Could not load page data";
    $("not-youtube").querySelector(".empty-state p + p").textContent =
      pageData.error || "Unknown error. Try refreshing the YouTube page.";
    $("app").classList.add("hidden");
    return;
  }

  if (pageData._empty) {
    // Scraping returned but found no data — YouTube likely changed their DOM
    $("not-youtube").classList.remove("hidden");
    $("not-youtube").querySelector(".empty-state p").textContent =
      "Could not read YouTube video data";
    $("not-youtube").querySelector(".empty-state p + p").textContent =
      "YouTube may have updated their layout. Try refreshing the page, or open a different video.";
    $("app").classList.add("hidden");
    return;
  }

  $("not-youtube").classList.add("hidden");
  $("app").classList.remove("hidden");

  // Render all sections
  renderScore(pageData);
  renderReadability(pageData);
  renderVideoInfo(pageData);
  renderKeywords(pageData);
  renderCompetitorTab();

  // Enable AI generate button if WebGPU is available
  if (isWebGPUAvailable() && pageData?.title) {
    $("btn-generate").disabled = false;
  }
}

// =============================================================================
// Bootstrap
// =============================================================================
(async function () {
  await loadSettings();
  await initPopup();
})();
