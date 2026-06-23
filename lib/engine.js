// =============================================================================
// lib/engine.js — WebLLM AI Engine Wrapper
// =============================================================================
// This module wraps the WebLLM library (runs locally via WebGPU) for:
// - Title optimization suggestions
// - Tag generation
// - Description writing
// - Keyword expansion
// - Thumbnail concept ideas
// - Content gap analysis
// All generation runs 100% offline after the initial model download.
// =============================================================================

// WebLLM is loaded at runtime from the CDN; the vendor file is a backup.
let webllmModule = null;

// =============================================================================
// Available models — small, open-weight models that fit in browser memory
// =============================================================================
export const MODELS = {
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC": "Qwen2.5 0.5B (smallest, fastest — ~500MB)",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC": "Llama 3.2 1B (balanced — ~800MB)",
  "Llama-3.2-3B-Instruct-q4f16_1-MLC": "Llama 3.2 3B (best quality — ~2GB)",
};

export const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

let engine = null;
let loadedModel = null;

// =============================================================================
// isWebGPUAvailable — check if the browser supports WebGPU
// =============================================================================
export function isWebGPUAvailable() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// =============================================================================
// loadModel — download and initialize the MLC engine
// =============================================================================
export async function loadModel(modelId, onProgress) {
  // Dynamic import of WebLLM
  if (!webllmModule) {
    try {
      webllmModule = await loadWebLLM();
    } catch (err) {
      throw new Error(
        "Failed to load WebLLM: " +
          err.message +
          ". Make sure WebGPU is enabled (chrome://flags/#enable-unsafe-webgpu)."
      );
    }
  }

  if (engine && loadedModel === modelId) return engine;

  // Unload previous model to free GPU memory
  if (engine) {
    try {
      await engine.unload();
    } catch (e) {
      // Ignore unload errors
    }
    engine = null;
  }

  engine = await webllmModule.CreateMLCEngine(modelId, {
    initProgressCallback: (report) => {
      if (onProgress) onProgress(report);
    },
  });
  loadedModel = modelId;
  return engine;
}

// =============================================================================
// loadWebLLM — try loading from vendor file, then from CDN
// =============================================================================
async function loadWebLLM() {
  // Strategy: load from CDN first (always latest), fall back to vendor bundle
  const sources = [
    // CDN — latest stable release
    async () => {
      const mod = await import(
        "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/lib/index.js"
      );
      return mod;
    },
    // Backup: bundled vendor file
    async () => {
      const mod = await import(chrome.runtime.getURL("vendor/web-llm.js"));
      return mod;
    },
  ];

  for (const source of sources) {
    try {
      return await source();
    } catch {
      continue;
    }
  }
  throw new Error("Could not load WebLLM from any source");
}

// =============================================================================
// chat — send messages to the LLM and get a text response
// =============================================================================
async function chat(messages, { temperature = 0.7, max_tokens = 512 } = {}) {
  if (!engine) throw new Error("Model not loaded. Call loadModel() first.");

  const reply = await engine.chat.completions.create({
    messages,
    temperature,
    max_tokens,
  });

  return reply.choices[0].message.content.trim();
}

// =============================================================================
// safeJSON — extract a JSON object from a model response
// =============================================================================
function safeJSON(text) {
  // Remove markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;

  // Find the outermost JSON object
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

// =============================================================================
// generateSuggestions — generate titles, tags, and description
// =============================================================================
export async function generateSuggestions({ title, description, keywords }) {
  const kw = (keywords || []).map((k) => k.word || k).join(", ");
  const currentDesc = (description || "").slice(0, 1500);

  const system = {
    role: "system",
    content:
      "You are an expert YouTube SEO strategist. Analyze the provided video metadata and generate optimized alternatives. " +
      "Reply ONLY with minified JSON, no explanation or markdown. " +
      'Schema: {"titles": string[5], "tags": string[20], "description": string, "hashtags": string[3]}. ' +
      "Titles: under 70 characters, include primary keyword near the start, create curiosity gaps. " +
      "Tags: lowercase, single words and short phrases, no commas, sorted by relevance. Max 20. " +
      "Description: 2-3 paragraphs (200-400 chars) with keyword placement, timestamps placeholder [00:00], and a call to action. " +
      "Hashtags: 3 relevant hashtags starting with #.",
  };

  const user = {
    role: "user",
    content:
      `Current title: ${title || "(none)"}\n` +
      `Current description: ${currentDesc}\n` +
      `Detected keywords: ${kw || "(none)"}\n\n` +
      "Generate optimized alternatives that will improve click-through rate and search ranking.",
  };

  const out = await chat([system, user], { temperature: 0.8, max_tokens: 800 });

  // Try parsing as JSON; fall back to returning raw titles
  const parsed = safeJSON(out);
  if (parsed) {
    return {
      titles: Array.isArray(parsed.titles) ? parsed.titles.slice(0, 5) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 20) : [],
      description:
        typeof parsed.description === "string" ? parsed.description : "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 3) : [],
    };
  }

  // Fallback: split by newlines and take first 5 as title candidates
  const lines = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    titles: lines.slice(0, 5).map((l) => l.replace(/^\d+[\.\)]\s*/, "")), // strip numbering
    tags: [],
    description: "",
    hashtags: [],
  };
}

// =============================================================================
// generateDescription — standalone description writer
// =============================================================================
export async function generateDescription({ title, keywords, tone }) {
  const kw = (keywords || []).join(", ");
  const system = {
    role: "system",
    content:
      "You are a YouTube description writer. Write engaging, keyword-rich video descriptions. " +
      "Reply with ONLY the description text, no JSON, no markdown. " +
      "Use short paragraphs, include relevant hashtags, and add a call to action.",
  };

  const user = {
    role: "user",
    content:
      `Video title: ${title || "(unknown)"}\n` +
      `Keywords: ${kw || "(none)"}\n` +
      `Tone: ${tone || "informative"}\n\n` +
      "Write a compelling video description (200-400 characters).",
  };

  return await chat([system, user], {
    temperature: 0.7,
    max_tokens: 600,
  });
}

// =============================================================================
// generateTags — standalone tag generator
// =============================================================================
export async function generateTags({ title, description }) {
  const system = {
    role: "system",
    content:
      "You are a YouTube tag strategist. Generate 15-20 highly relevant tags. " +
      "Reply with ONLY a JSON array of strings, no other text. " +
      "Tags should include: broad category, specific topic, related terms, long-tail phrases. " +
      "All lowercase, no punctuation except hyphens.",
  };

  const user = {
    role: "user",
    content:
      `Title: ${title || "(none)"}\n` +
      `Description: ${(description || "").slice(0, 500)}\n\n` +
      "Generate optimized tags.",
  };

  const out = await chat([system, user], { temperature: 0.6, max_tokens: 500 });
  const parsed = safeJSON(out);
  if (Array.isArray(parsed)) return parsed.slice(0, 20);
  // Try parsing as a bare JSON array
  try {
    const arr = JSON.parse(out);
    if (Array.isArray(arr)) return arr.slice(0, 20);
  } catch {
    // Fallback: split by newlines/commas
    return out
      .split(/[\n,]+/)
      .map((t) => t.trim().replace(/^["']|["']$/g, ""))
      .filter((t) => t.length > 1)
      .slice(0, 20);
  }
  return [];
}

// =============================================================================
// expandKeywords — generate related keyword ideas from a seed
// =============================================================================
export async function expandKeywords(seedKeyword, count = 20) {
  const system = {
    role: "system",
    content:
      "You are a YouTube keyword researcher. Given a seed keyword, generate related keywords. " +
      "Reply with ONLY a JSON array of strings. " +
      "Include: exact match, broad match, long-tail variations, questions, and related topics. " +
      "All lowercase, sorted by search volume potential (highest first).",
  };

  const user = {
    role: "user",
    content: `Seed keyword: "${seedKeyword}"\nGenerate ${count} related YouTube keywords.`,
  };

  const out = await chat([system, user], { temperature: 0.7, max_tokens: 600 });
  const parsed = safeJSON(out);
  if (Array.isArray(parsed)) return parsed.slice(0, count);
  try {
    const arr = JSON.parse(out);
    if (Array.isArray(arr)) return arr.slice(0, count);
  } catch {
    return out
      .split(/[\n,]+/)
      .map((k) => k.trim().replace(/^\d+[\.\)]\s*/, ""))
      .filter((k) => k.length > 2 && k !== seedKeyword)
      .slice(0, count);
  }
  return [];
}
