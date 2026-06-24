// background.js — minimal service worker.
// The AI engine runs in the popup (which has WebGPU access); this worker
// only handles lifecycle housekeeping.

chrome.runtime.onInstalled.addListener(() => {
  console.log("[OpenTube SEO] installed — offline AI ready after first model download.");
});
