// engine.js — wraps WebLLM (open-source, runs locally via WebGPU).
// Model weights download once from the public CDN, then are cached by the
// browser, so generation works offline on subsequent runs.

import * as webllm from "./vendor/web-llm.js";

// Small, fast, open models. Qwen2.5 0.5B is a good default for low-end GPUs.
export const MODELS = {
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC": "Qwen2.5 0.5B (smallest, fastest)",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC": "Llama 3.2 1B (balanced)",
  "Llama-3.2-3B-Instruct-q4f16_1-MLC": "Llama 3.2 3B (best quality, larger)",
};

export const DEFAULT_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

let engine = null;
let loadedModel = null;

export function isWebGPUAvailable() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export async function loadModel(modelId, onProgress) {
  if (engine && loadedModel === modelId) return engine;
  if (engine) {
    await engine.unload();
    engine = null;
  }
  engine = await webllm.CreateMLCEngine(modelId, {
    initProgressCallback: (report) => {
      if (onProgress) onProgress(report);
    },
  });
  loadedModel = modelId;
  return engine;
}

async function chat(messages, { temperature = 0.8, max_tokens = 512 } = {}) {
  if (!engine) throw new Error("Model not loaded");
  const reply = await engine.chat.completions.create({
    messages,
    temperature,
    max_tokens,
  });
  return reply.choices[0].message.content.trim();
}

function safeJSON(text) {
  // Models sometimes wrap JSON in prose/fences. Extract the first object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function generateSuggestions({ title, description, keywords }) {
  const kw = (keywords || []).map((k) => k.word).join(", ");
  const system = {
    role: "system",
    content:
      "You are a YouTube SEO expert. Reply ONLY with minified JSON, no prose. " +
      'Schema: {"titles": string[5], "tags": string[15], "description": string}. ' +
      "Titles must be under 70 characters, click-worthy, and keyword-rich. " +
      "Tags are lowercase comma-free keywords. Description is 2-3 short paragraphs.",
  };
  const user = {
    role: "user",
    content:
      `Current title: ${title || "(none)"}\n` +
      `Current description: ${(description || "").slice(0, 800)}\n` +
      `Detected keywords: ${kw || "(none)"}\n\n` +
      "Generate optimized alternatives.",
  };

  const out = await chat([system, user], { temperature: 0.85, max_tokens: 700 });
  const parsed = safeJSON(out);
  if (parsed) {
    return {
      titles: Array.isArray(parsed.titles) ? parsed.titles.slice(0, 5) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 15) : [],
      description: typeof parsed.description === "string" ? parsed.description : "",
    };
  }
  // Fallback: return raw text as a single title if JSON parsing fails.
  return { titles: [out.slice(0, 100)], tags: [], description: "" };
}
