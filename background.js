// =============================================================================
// background.js — OpenTube SEO Service Worker
// =============================================================================
// This service worker handles:
// - Extension lifecycle management
// - Side panel configuration
// - Keyboard shortcuts (commands)
// - Context menu items for quick SEO actions
// - Alarms for scheduled keyword rank tracking
// - Message routing between content scripts and popup/sidebar
// - Data export/import for preferences and tracking data
// =============================================================================

import {
  isWebGPUAvailable,
  MODELS,
  DEFAULT_MODEL,
  loadModel,
  generateSuggestions,
} from "./lib/engine.js";

// =============================================================================
// constants — app-wide configuration keys
// =============================================================================
const STORAGE_KEYS = {
  SETTINGS: "opentube_settings",
  KEYWORDS: "opentube_keywords",
  HISTORY: "opentube_analysis_history",
  CHANNELS: "opentube_watched_channels",
  CACHED_SCORES: "opentube_cached_scores",
  TRACKING: "opentube_tracking_data",
};

const DEFAULT_SETTINGS = {
  // AI model configuration
  model: DEFAULT_MODEL,
  useAI: true,
  // Analysis preferences
  autoAnalyze: true,
  showScoreBadge: true,
  enableSidebar: true,
  // Notifications
  notifyOnComplete: false,
  // Privacy
  anonymousUsage: true,
  // Export
  autoBackup: false,
  backupIntervalDays: 7,
  // Theme
  theme: "dark",
};

// =============================================================================
// onInstalled — runs once after install or update
// =============================================================================
chrome.runtime.onInstalled.addListener((details) => {
  log("[lifecycle] Install event:", details.reason);

  if (details.reason === "install") {
    // First-time install: set default settings and show onboarding
    chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
    });
    // Open the onboarding/options page
    chrome.tabs.create({ url: "options.html#onboarding" });
  } else if (details.reason === "update") {
    // Merge any new defaults into existing settings
    migrateSettings();
  }

  // Create context menu items for quick access
  createContextMenus();

  // Set up alarms for scheduled tasks
  setupAlarms();

  // Log WebGPU availability info
  log("[hardware] WebGPU available:", isWebGPUAvailable() ? "yes" : "no");
});

// =============================================================================
// createContextMenus — right-click menu items on YouTube pages
// =============================================================================
function createContextMenus() {
  // Only create once
  chrome.contextMenus.removeAll(() => {
    // Parent menu
    chrome.contextMenus.create({
      id: "opentube-root",
      title: "OpenTube SEO",
      contexts: ["page", "selection", "link"],
      documentUrlPatterns: ["https://*.youtube.com/*"],
    });

    // Analyze current video
    chrome.contextMenus.create({
      id: "analyze-video",
      parentId: "opentube-root",
      title: "Analyze this video",
      contexts: ["page"],
    });

    // Generate AI suggestions
    chrome.contextMenus.create({
      id: "generate-ai",
      parentId: "opentube-root",
      title: "Generate AI title/tags/description",
      contexts: ["page"],
    });

    // Analyze selected text as a keyword
    chrome.contextMenus.create({
      id: "analyze-keyword",
      parentId: "opentube-root",
      title: 'Research "%s" as a keyword',
      contexts: ["selection"],
    });

    // Open sidebar
    chrome.contextMenus.create({
      id: "open-sidebar",
      parentId: "opentube-root",
      title: "Open SEO Sidebar",
      contexts: ["page"],
    });

    log("[menus] Context menus created");
  });
}

// =============================================================================
// contextMenus.onClicked — handle menu item clicks
// =============================================================================
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "analyze-video") {
    chrome.tabs.sendMessage(tab.id, { type: "OPENTUBE_ANALYZE" });
  } else if (info.menuItemId === "generate-ai") {
    chrome.tabs.sendMessage(tab.id, { type: "OPENTUBE_GENERATE_AI" });
  } else if (info.menuItemId === "analyze-keyword") {
    // Store selected text for popup to pick up
    chrome.storage.local.set({
      opentube_pending_keyword: info.selectionText,
    });
    chrome.action.openPopup();
  } else if (info.menuItemId === "open-sidebar") {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// =============================================================================
// commands (keyboard shortcuts)
// =============================================================================
chrome.commands.onCommand.addListener((command, tab) => {
  log("[commands] Received:", command);

  if (command === "open-sidebar") {
    // Toggle the side panel
    chrome.sidePanel.open({ windowId: tab.windowId });
  } else if (command === "analyze-video") {
    chrome.tabs.sendMessage(tab.id, { type: "OPENTUBE_ANALYZE" }).catch(() => {
      // Content script might not be loaded; inject it
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/watch.js"],
      });
    });
  } else if (command === "generate-tags") {
    chrome.tabs.sendMessage(tab.id, { type: "OPENTUBE_GENERATE_AI" }).catch(() => {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/watch.js"],
      });
    });
  }
});

// =============================================================================
// setupAlarms — configure periodic background tasks
// =============================================================================
function setupAlarms() {
  // Clean up old cached analysis data every day
  chrome.alarms.create("cleanup-cache", { periodInMinutes: 1440 });

  // Check for keyword tracking updates every 6 hours
  chrome.alarms.create("keyword-track", { periodInMinutes: 360 });
}

// =============================================================================
// alarms.onAlarm — handle alarm events
// =============================================================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "cleanup-cache") {
    await cleanupOldCache();
  } else if (alarm.name === "keyword-track") {
    await checkKeywordTracking();
  }
});

// =============================================================================
// cleanupOldCache — remove stale cached data (>7 days)
// =============================================================================
async function cleanupOldCache() {
  log("[maintenance] Cleaning old cache …");
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const { [STORAGE_KEYS.HISTORY]: history = [] } =
    await chrome.storage.local.get(STORAGE_KEYS.HISTORY);

  if (history.length === 0) return;

  const fresh = history.filter((entry) => entry.timestamp > sevenDaysAgo);
  await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: fresh });
  log(`[maintenance] Cache cleaned: ${history.length} → ${fresh.length} entries`);
}

// =============================================================================
// checkKeywordTracking — placeholder for scheduled keyword rank checks
// =============================================================================
async function checkKeywordTracking() {
  log("[tracking] Keyword tracking check triggered (stub)");
  // This would normally fetch ranking data for tracked keywords.
  // For now it's a placeholder; full implementation requires a backend API.
}

// =============================================================================
// migrateSettings — merge missing defaults after an update
// =============================================================================
async function migrateSettings() {
  const { [STORAGE_KEYS.SETTINGS]: current = {} } =
    await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);

  let changed = false;
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in current)) {
      current[key] = value;
      changed = true;
    }
  }

  if (changed) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: current });
    log("[migration] Settings updated with new defaults");
  }
}

// =============================================================================
// sidePanel — configure side panel behavior
// =============================================================================
// Enable side panel for YouTube and Studio
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch(() => {});

// Open side panel automatically when navigating to Studio
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("studio.youtube.com")
  ) {
    const settings = chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    // Side panel is available via the action button or shortcut
  }
});

// =============================================================================
// message handling — central message router
// =============================================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  log("[message] Received:", msg?.type, "from:", sender?.tab?.id);

  switch (msg?.type) {
    // ====================================================================
    // Data request: popup/sidebar asks for current page data
    // ====================================================================
    case "GET_PAGE_DATA": {
      getPageData(sender.tab?.id)
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true; // keep channel open for async response
    }

    // ====================================================================
    // AI generation request
    // ====================================================================
    case "AI_GENERATE": {
      handleAIGenerate(msg.data, sendResponse);
      return true;
    }

    // ====================================================================
    // Scrape request: forward to content script
    // ====================================================================
    case "SCRAPE_PAGE": {
      forwardToContent(sender.tab?.id, { type: "SCRAPE_PAGE" }, sendResponse);
      return true;
    }

    // ====================================================================
    // Settings read/write
    // ====================================================================
    case "GET_SETTINGS": {
      chrome.storage.local
        .get(STORAGE_KEYS.SETTINGS)
        .then((s) => sendResponse(s[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS));
      return true;
    }
    case "SAVE_SETTINGS": {
      chrome.storage.local
        .set({ [STORAGE_KEYS.SETTINGS]: msg.settings })
        .then(() => sendResponse({ ok: true }));
      return true;
    }

    // ====================================================================
    // Export/import data
    // ====================================================================
    case "EXPORT_DATA": {
      handleExport(sendResponse);
      return true;
    }
    case "IMPORT_DATA": {
      handleImport(msg.data, sendResponse);
      return true;
    }

    // ====================================================================
    // Keyword tracking management
    // ====================================================================
    case "ADD_TRACKED_KEYWORD": {
      addTrackedKeyword(msg.keyword, msg.videoId, sendResponse);
      return true;
    }
    case "REMOVE_TRACKED_KEYWORD": {
      removeTrackedKeyword(msg.keyword, sendResponse);
      return true;
    }
    case "GET_TRACKED_KEYWORDS": {
      getTrackedKeywords(sendResponse);
      return true;
    }

    default:
      log("[message] Unhandled type:", msg?.type);
      sendResponse({ ok: false, error: "Unknown message type" });
  }
});

// =============================================================================
// getPageData — aggregate page data from content script
// =============================================================================
async function getPageData(tabId) {
  if (!tabId) throw new Error("No tab ID provided");

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "OPENTUBE_GET_FULL_DATA" },
      (response) => {
        if (chrome.runtime.lastError) {
          // Content script may not be injected; try injecting it
          chrome.scripting
            .executeScript({ target: { tabId }, files: ["content/watch.js"] })
            .then(() => {
              // Retry after injection
              setTimeout(() => {
                chrome.tabs.sendMessage(
                  tabId,
                  { type: "OPENTUBE_GET_FULL_DATA" },
                  (retryResponse) => {
                    if (chrome.runtime.lastError) {
                      reject(new Error(chrome.runtime.lastError.message));
                    } else {
                      resolve(retryResponse);
                    }
                  }
                );
              }, 500);
            })
            .catch(reject);
        } else {
          resolve(response);
        }
      }
    );
  });
}

// =============================================================================
// forwardToContent — generic message forwarder to content script
// =============================================================================
function forwardToContent(tabId, msg, sendResponse) {
  if (!tabId) {
    sendResponse({ ok: false, error: "No tab" });
    return;
  }
  chrome.tabs.sendMessage(tabId, msg, (response) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
    } else {
      sendResponse(response);
    }
  });
}

// =============================================================================
// handleAIGenerate — run AI generation in the background worker
// =============================================================================
async function handleAIGenerate(data, sendResponse) {
  try {
    if (!isWebGPUAvailable()) {
      sendResponse({
        ok: false,
        error: "WebGPU is not available in this browser",
      });
      return;
    }

    // Load model and generate
    const { [STORAGE_KEYS.SETTINGS]: settings = DEFAULT_SETTINGS } =
      await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const modelId = settings.model || DEFAULT_MODEL;

    await loadModel(modelId, () => {});
    const result = await generateSuggestions(data);

    sendResponse({ ok: true, data: result });
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }
}

// =============================================================================
// handleExport — export all user data as JSON
// =============================================================================
async function handleExport(sendResponse) {
  try {
    const allData = await chrome.storage.local.get(null);
    const exportObj = {
      exportedAt: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      data: {
        settings: allData[STORAGE_KEYS.SETTINGS] || {},
        keywords: allData[STORAGE_KEYS.KEYWORDS] || [],
        history: (allData[STORAGE_KEYS.HISTORY] || []).slice(-100),
        channels: allData[STORAGE_KEYS.CHANNELS] || [],
        tracking: allData[STORAGE_KEYS.TRACKING] || [],
      },
    };
    sendResponse({ ok: true, data: exportObj });
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }
}

// =============================================================================
// handleImport — import previously exported data
// =============================================================================
async function handleImport(importData, sendResponse) {
  try {
    if (!importData?.data) {
      sendResponse({ ok: false, error: "Invalid import data" });
      return;
    }
    const { data } = importData;
    const toSet = {};
    if (data.settings) toSet[STORAGE_KEYS.SETTINGS] = data.settings;
    if (data.keywords) toSet[STORAGE_KEYS.KEYWORDS] = data.keywords;
    if (data.history) toSet[STORAGE_KEYS.HISTORY] = data.history;
    if (data.channels) toSet[STORAGE_KEYS.CHANNELS] = data.channels;
    if (data.tracking) toSet[STORAGE_KEYS.TRACKING] = data.tracking;

    if (Object.keys(toSet).length > 0) {
      await chrome.storage.local.set(toSet);
    }
    sendResponse({ ok: true, imported: Object.keys(toSet).length });
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }
}

// =============================================================================
// addTrackedKeyword — add a keyword to the tracking list
// =============================================================================
async function addTrackedKeyword(keyword, videoId, sendResponse) {
  try {
    const { [STORAGE_KEYS.TRACKING]: tracking = [] } =
      await chrome.storage.local.get(STORAGE_KEYS.TRACKING);
    const entry = {
      keyword,
      videoId,
      addedAt: Date.now(),
      lastChecked: null,
      rank: null,
    };
    tracking.push(entry);
    await chrome.storage.local.set({ [STORAGE_KEYS.TRACKING]: tracking });
    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }
}

// =============================================================================
// removeTrackedKeyword — remove keyword from tracking
// =============================================================================
async function removeTrackedKeyword(keyword, sendResponse) {
  try {
    const { [STORAGE_KEYS.TRACKING]: tracking = [] } =
      await chrome.storage.local.get(STORAGE_KEYS.TRACKING);
    const filtered = tracking.filter((t) => t.keyword !== keyword);
    await chrome.storage.local.set({ [STORAGE_KEYS.TRACKING]: filtered });
    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }
}

// =============================================================================
// getTrackedKeywords — list all tracked keywords
// =============================================================================
async function getTrackedKeywords(sendResponse) {
  try {
    const { [STORAGE_KEYS.TRACKING]: tracking = [] } =
      await chrome.storage.local.get(STORAGE_KEYS.TRACKING);
    sendResponse({ ok: true, data: tracking });
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }
}

// =============================================================================
// logging — dev-only logging that's easy to find
// =============================================================================
function log(...args) {
  console.log("[open-tube-seo]", ...args);
}

function logError(...args) {
  console.error("[open-tube-seo:error]", ...args);
}
