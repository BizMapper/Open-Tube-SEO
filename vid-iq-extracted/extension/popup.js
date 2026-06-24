// popup.js — orchestrates scraping, offline SEO scoring, and local AI.
import { scoreSEO, extractKeywords } from "./seo.js";
import {
  MODELS,
  DEFAULT_MODEL,
  loadModel,
  generateSuggestions,
  isWebGPUAvailable,
} from "./engine.js";

const $ = (id) => document.getElementById(id);
let pageData = null;
let keywords = [];

// ---- GPU badge ----
const gpuBadge = $("gpu-badge");
if (isWebGPUAvailable()) {
  gpuBadge.textContent = "WebGPU ready";
  gpuBadge.classList.add("ok");
} else {
  gpuBadge.textContent = "No WebGPU";
  gpuBadge.classList.add("no");
}

// ---- Model dropdown ----
const modelSelect = $("model-select");
for (const [id, label] of Object.entries(MODELS)) {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = label;
  modelSelect.appendChild(opt);
}
modelSelect.value = DEFAULT_MODEL;

// ---- Scrape active tab ----
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function scrapeCurrentPage() {
  const tab = await getActiveTab();
  if (!tab || !/youtube\.com/.test(tab.url || "")) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_PAGE" });
  } catch {
    // Content script may not be injected yet (e.g. page opened before install).
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    return await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_PAGE" });
  }
}

function renderScore(data) {
  const { score, grade, passed, total, checks } = scoreSEO(data);
  const ring = $("score-ring");
  const col =
    score >= 65 ? "var(--good)" : score >= 45 ? "var(--warn)" : "var(--bad)";
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
      <span>${c.label}${c.pass ? "" : ` — <span class="hint">${c.hint}</span>`}</span>`;
    list.appendChild(li);
  }
}

function renderKeywords(data) {
  keywords = extractKeywords(data);
  const box = $("keywords");
  box.innerHTML = "";
  if (keywords.length === 0) {
    box.innerHTML = `<span class="muted small">No keywords detected.</span>`;
    return;
  }
  for (const k of keywords) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = k.word;
    chip.title = "Click to copy";
    chip.onclick = () => copyText(chip, k.word);
    box.appendChild(chip);
  }
}

function copyText(el, text) {
  navigator.clipboard.writeText(text);
  el.classList.add("copied");
  setTimeout(() => el.classList.remove("copied"), 800);
}

// ---- AI generation ----
$("generate").addEventListener("click", async () => {
  if (!isWebGPUAvailable()) {
    alert(
      "WebGPU isn't available. In Brave, enable it at brave://flags/#enable-unsafe-webgpu and disable Shields for this page if needed."
    );
    return;
  }
  const btn = $("generate");
  const progress = $("ai-progress");
  const fill = $("bar-fill");
  const ptext = $("progress-text");
  const results = $("ai-results");

  btn.disabled = true;
  progress.classList.remove("hidden");
  results.innerHTML = "";

  try {
    await loadModel(modelSelect.value, (report) => {
      const pct = Math.round((report.progress || 0) * 100);
      fill.style.width = pct + "%";
      ptext.textContent = report.text || `Loading model… ${pct}%`;
    });

    ptext.textContent = "Generating suggestions…";
    fill.style.width = "100%";

    const out = await generateSuggestions({
      title: pageData.title,
      description: pageData.description,
      keywords,
    });

    renderAI(out);
  } catch (e) {
    results.innerHTML = `<p class="muted small">Generation failed: ${String(
      e.message || e
    )}</p>`;
  } finally {
    btn.disabled = false;
    progress.classList.add("hidden");
    fill.style.width = "0%";
  }
});

function renderAI({ titles, tags, description }) {
  const results = $("ai-results");
  results.innerHTML = "";

  if (titles && titles.length) {
    const block = document.createElement("div");
    block.className = "ai-block";
    block.innerHTML = "<h3>Suggested titles</h3>";
    titles.forEach((t) => {
      const item = document.createElement("div");
      item.className = "ai-item";
      item.textContent = t;
      item.onclick = () => copyText(item, t);
      block.appendChild(item);
    });
    results.appendChild(block);
  }

  if (tags && tags.length) {
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

  if (description) {
    const block = document.createElement("div");
    block.className = "ai-block";
    block.innerHTML = "<h3>Suggested description (click to copy)</h3>";
    const item = document.createElement("div");
    item.className = "ai-item";
    item.style.whiteSpace = "pre-wrap";
    item.textContent = description;
    item.onclick = () => copyText(item, description);
    block.appendChild(item);
    results.appendChild(block);
  }
}

// ---- Init ----
(async function init() {
  pageData = await scrapeCurrentPage();
  if (!pageData || !pageData.ok || !pageData.isWatch) {
    $("not-watch").classList.remove("hidden");
    return;
  }
  $("content").classList.remove("hidden");
  renderScore(pageData);
  renderKeywords(pageData);
})();
