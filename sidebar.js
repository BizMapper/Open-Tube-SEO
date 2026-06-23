// =============================================================================
// sidebar.js — YouTube Studio Sidebar Panel
// =============================================================================
// This sidebar runs alongside YouTube and provides always-on SEO insights.
// Uses the same lib modules as the popup but is designed for persistent use.
// =============================================================================
import {
  scoreSEO,
  extractKeywords,
} from "./lib/seo.js";
import {
  MODELS,
  DEFAULT_MODEL,
  loadModel,
  generateSuggestions,
  isWebGPUAvailable,
} from "./lib/engine.js";

const $ = (id) => document.getElementById(id);
let pageData = null;

// =============================================================================
// Close sidebar
// =============================================================================
$("btn-close")?.addEventListener("click", () => {
  // Side panel can't close itself programmatically; just hide the content
  window.close();
});

// =============================================================================
// GPU badge
// =============================================================================
const gpuBadge = $("sidebar-gpu");
if (isWebGPUAvailable()) {
  gpuBadge.textContent = "WebGPU ✓";
  gpuBadge.classList.add("ok");
} else {
  gpuBadge.textContent = "No WebGPU";
  gpuBadge.classList.add("no");
}

// =============================================================================
// Scrape and render
// =============================================================================
async function scrapeAndRender() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_PAGE_DATA" });
    if (response?.ok) {
      pageData = response;
      renderAll(response);
    } else {
      $("not-watch").classList.remove("hidden");
      $("watch-panel").classList.add("hidden");
    }
  } catch (e) {
    // Content script may not be available
    $("not-watch").classList.remove("hidden");
    $("watch-panel").classList.add("hidden");
  }
}

// =============================================================================
// Render all sections
// =============================================================================
function renderAll(data) {
  if (!data || !data.isWatch) {
    $("not-watch").classList.remove("hidden");
    $("watch-panel").classList.add("hidden");
    return;
  }

  $("not-watch").classList.add("hidden");
  $("watch-panel").classList.remove("hidden");

  renderScore(data);
  renderKeywords(data);
  renderChecklist(data);
}

// =============================================================================
// Score ring
// =============================================================================
function renderScore(data) {
  const { score, grade, passed, total } = scoreSEO(data);
  const ring = $("sidebar-score-ring");
  const col =
    score >= 75 ? "var(--good)" : score >= 55 ? "var(--warn)" : "var(--bad)";
  ring.style.setProperty("--val", score);
  ring.style.setProperty("--col", col);
  $("sidebar-score-num").textContent = score;
  $("sidebar-score-grade").textContent = `SEO: ${grade}`;
  $("sidebar-score-sub").textContent = `${passed} of ${total} checks passed`;
}

// =============================================================================
// Keywords
// =============================================================================
function renderKeywords(data) {
  const keywords = extractKeywords(data, 10);
  const container = $("sidebar-keywords");
  container.innerHTML = "";
  for (const k of keywords) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = k.word;
    chip.onclick = () => {
      navigator.clipboard.writeText(k.word).catch(() => {});
      chip.classList.add("copied");
      setTimeout(() => chip.classList.remove("copied"), 800);
    };
    container.appendChild(chip);
  }
}

// =============================================================================
// Checklist
// =============================================================================
function renderChecklist(data) {
  const { checks } = scoreSEO(data);
  const list = $("sidebar-checklist");
  list.innerHTML = "";
  for (const c of checks.slice(0, 8)) {
    const li = document.createElement("li");
    li.className = c.pass ? "pass" : "fail";
    li.innerHTML = `<span class="icon">${c.pass ? "✓" : "!"}</span>
      <span>${c.label}</span>`;
    list.appendChild(li);
  }
}

// =============================================================================
// AI optimization
// =============================================================================
$("sidebar-btn-optimize")?.addEventListener("click", async () => {
  if (!isWebGPUAvailable() || !pageData) return;

  const btn = $("sidebar-btn-optimize");
  btn.disabled = true;
  btn.textContent = "Generating…";

  try {
    await loadModel(DEFAULT_MODEL, () => {});
    const keywords = extractKeywords(pageData, 10);
    const result = await generateSuggestions({
      title: pageData.title,
      description: pageData.description,
      keywords: keywords.map((k) => k.word),
    });

    const container = $("sidebar-ai-content");
    container.innerHTML = "";

    if (result.titles?.length) {
      container.innerHTML +=
        "<strong style='font-size:11px;color:#9aa3b2;text-transform:uppercase'>Titles</strong>";
      result.titles.forEach((t) => {
        const div = document.createElement("div");
        div.className = "ai-sidebar-item";
        div.textContent = t;
        div.onclick = () => {
          navigator.clipboard.writeText(t).catch(() => {});
          div.classList.add("copied");
          setTimeout(() => div.classList.remove("copied"), 800);
        };
        container.appendChild(div);
      });
    }

    $("sidebar-ai-results").classList.remove("hidden");
  } catch (e) {
    console.log("[sidebar AI] Error:", e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Optimize with AI";
  }
});

// =============================================================================
// Init
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  scrapeAndRender();
  // Re-scrape every 30 seconds for live updates
  setInterval(scrapeAndRender, 30000);
});

// Also respond to background requests
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "OPENTUBE_SIDEBAR_REFRESH") {
    scrapeAndRender();
  }
});
