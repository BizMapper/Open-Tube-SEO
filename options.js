// =============================================================================
// options.js — Full options/settings page
// =============================================================================
import {
  MODELS,
  DEFAULT_MODEL,
  isWebGPUAvailable,
} from "./lib/engine.js";

const $ = (id) => document.getElementById(id);

// =============================================================================
// Navigation
// =============================================================================
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    $(`page-${btn.dataset.page}`).classList.add("active");
  });
});

// =============================================================================
// GPU Status
// =============================================================================
const gpuStatus = $("opt-gpu-status");
if (isWebGPUAvailable()) {
  gpuStatus.textContent = "✓ WebGPU available";
  gpuStatus.className = "badge ok";
} else {
  gpuStatus.textContent = "✗ WebGPU not available";
  gpuStatus.className = "badge no";
}

// =============================================================================
// Model dropdown
// =============================================================================
const modelSelect = $("opt-model");
for (const [id, label] of Object.entries(MODELS)) {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = label;
  modelSelect.appendChild(opt);
}

// =============================================================================
// Load settings
// =============================================================================
async function loadSettings() {
  try {
    const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    if (!settings) return;

    $("opt-auto-analyze").checked = settings.autoAnalyze !== false;
    $("opt-show-badge").checked = settings.showScoreBadge !== false;
    $("opt-enable-sidebar").checked = settings.enableSidebar !== false;
    $("opt-enable-ai").checked = settings.useAI !== false;
    $("opt-notify").checked = settings.notifyOnComplete === true;
    modelSelect.value = settings.model || DEFAULT_MODEL;
  } catch (e) {
    console.log("[options] Could not load settings:", e.message);
  }
}

// =============================================================================
// Save settings
// =============================================================================
async function saveSettings(fromPage) {
  const settings = {
    autoAnalyze: $("opt-auto-analyze").checked,
    showScoreBadge: $("opt-show-badge").checked,
    enableSidebar: $("opt-enable-sidebar").checked,
    useAI: $("opt-enable-ai").checked,
    notifyOnComplete: $("opt-notify").checked,
    model: modelSelect.value,
  };

  try {
    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
    showStatus("Settings saved successfully", "ok");
  } catch (e) {
    showStatus("Failed to save settings: " + e.message, "error");
  }
}

// =============================================================================
// Status message
// =============================================================================
function showStatus(msg, type) {
  const el = $("status-message");
  el.textContent = msg;
  el.className = `status ${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

// =============================================================================
// Save buttons
// =============================================================================
$("opt-save-general")?.addEventListener("click", () => saveSettings("general"));
$("opt-save-ai")?.addEventListener("click", () => saveSettings("ai"));

// =============================================================================
// Export
// =============================================================================
$("opt-export")?.addEventListener("click", async () => {
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
      showStatus("Data exported successfully", "ok");
    }
  } catch (e) {
    showStatus("Export failed: " + e.message, "error");
  }
});

// =============================================================================
// Import
// =============================================================================
$("opt-import")?.addEventListener("click", () => {
  $("opt-import-file").click();
});
$("opt-import-file")?.addEventListener("change", async (e) => {
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
      showStatus(`Imported ${result.imported} data sections`, "ok");
      await loadSettings();
    }
  } catch (err) {
    showStatus("Import failed: " + err.message, "error");
  }
  e.target.value = "";
});

// =============================================================================
// Clear all
// =============================================================================
$("opt-clear")?.addEventListener("click", async () => {
  if (!confirm("This will delete all stored data. Are you sure?")) return;
  await chrome.storage.local.clear();
  showStatus("All data cleared", "ok");
  await loadSettings();
});

// =============================================================================
// Bootstrap
// =============================================================================
document.addEventListener("DOMContentLoaded", loadSettings);
