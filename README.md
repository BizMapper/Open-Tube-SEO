# OpenTube SEO — Complete VidIQ Alternative

> **100% offline · open source · zero tracking · unlimited use**

![Version](https://img.shields.io/badge/version-2.0.0-red)
![License](https://img.shields.io/badge/license-MIT-blue)
![WebGPU](https://img.shields.io/badge/WebGPU-required-orange)

OpenTube SEO is a full-featured Chrome & Brave extension that gives you **everything VidIQ offers** — for free, with no account, no tracking, and no limits. Every analysis runs in your browser.

Built upon the philosophies of [**Ponytail**](https://github.com/DietrichGebert/ponytail) (write only what's needed) and [**Graphify**](https://github.com/safishamsi/graphify) (knowledge graph architecture patterns).

---

## Features

| Feature | Description |
|---------|-------------|
| **SEO Score** | 18-point heuristic checklist scoring your title, description, tags, and engagement |
| **Keyword Extraction** | AI-free keyword ranking from title, description, and tags |
| **Keyword Research** | Intent classification, volume estimation, long-tail suggestions |
| **AI Title Generation** | Local AI generates 5 optimized titles using WebGPU |
| **AI Tag Generation** | Generates 15-20 relevant tags with hashtags |
| **AI Description Writing** | Writes keyword-optimized descriptions with CTAs |
| **Competitor Analysis** | Tag comparison, content gap detection, tag strategy breakdown |
| **YouTube Studio Integration** | Real-time SEO scoring as you type in Studio |
| **Content Scripts** | Runs on watch pages, search results, channel pages, and feeds |
| **Sidebar Panel** | Always-on SEO insights alongside YouTube |
| **SERP Analysis** | Analyzes search result title patterns and keyword density |
| **Readability Scoring** | Flesch-Kincaid readability analysis for descriptions |
| **Data Export/Import** | Full JSON export of all settings and analysis data |
| **Keyboard Shortcuts** | Quick access to sidebar, analysis, and AI generation |
| **Context Menu** | Right-click SEO actions on any YouTube page |

---

## Installation

### Option 1: Install from Chrome Web Store (recommended) - Not Active Yet

1. Visit the [Chrome Web Store listing](https://chrome.google.com/webstore) (search "OpenTube SEO")
2. Click **Add to Chrome**
3. The extension is ready to use — no account needed

### Option 2: Install from source (developer mode)

1. **Download the extension files:**
   ```bash
   git clone https://github.com/BizMapper/Open-Tube-SEO.git
   cd Open-Tube-SEO
   ```

2. **Open Chrome and navigate to the Extensions page:**
   - Type `chrome://extensions` in the address bar
   - Or go to Menu → Extensions → Manage Extensions

3. **Enable Developer Mode:**
   - Toggle the **Developer mode** switch in the top-right corner

4. **Load the extension:**
   - Click **Load unpacked**
   - Select the `Open-Tube-SEO` folder (the one containing `manifest.json`)
   - The extension is now installed

5. **Pin the extension (optional):**
   - Click the puzzle piece icon in the toolbar
   - Find "OpenTube SEO" and click the pin icon

### Option 3: Install from ZIP

1. Download the latest `opentube-seo-extension.zip` from the [Releases page](https://github.com/BizMapper/Open-Tube-SEO/releases)
2. Unzip the file to a folder on your computer
3. Follow **Option 2** steps 2-5 above

---

## Requirements

- **Browser:** Chrome 116+ or Edge 116+
- **WebGPU:** Required for AI features. Most modern GPUs are supported.
  - In **Brave**: enable `#enable-unsafe-webgpu` at `brave://flags`
  - In **Chrome**: WebGPU is enabled by default since Chrome 116

---

## Quick Start

1. **Open any YouTube video page**
2. **Click the OpenTube SEO icon** in the Chrome toolbar
3. The popup shows your **SEO score**, **keywords**, and **analysis checklist**
4. Switch between tabs:
   - **SEO** — Score breakdown, readability, video info
   - **Keywords** — Extracted keywords, research tool
   - **Competitors** — Tag comparison and content gaps
   - **AI** — Generate titles, tags, and descriptions locally
   - **⚙** — Settings and data management

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+O` | Open SEO sidebar |
| `Alt+Shift+A` | Analyze current video |
| `Alt+Shift+G` | Generate AI tags |

You can customize these at `chrome://extensions/shortcuts`.

---

## How It Works

### SEO Scoring

The extension uses 18 heuristic checks across four categories:

- **Title** (30% weight): Length, numbers, power words, questions, clickbait detection
- **Description** (25% weight): Length, word count, links, timestamps, CTA, hashtags
- **Tags** (20% weight): Count, title overlap, description overlap
- **Engagement** (15% weight): Views, subscribers (when available)

### AI Generation

The AI runs entirely in your browser using **WebLLM** (WebGPU + MLC). No data ever leaves your machine.

1. The first time you use AI, a small model (~800MB) downloads and caches in your browser
2. Subsequent uses are instant — no downloads, no internet needed
3. Generation runs entirely offline

### Keyword Research

Keywords are extracted using frequency analysis with boosted weights for title and tag matches. The keyword research tool estimates:
- **Search intent** (informational, commercial, transactional, navigational)
- **Volume** (heuristic estimate based on keyword structure)
- **Opportunity score** (relevancy + specificity - competition)
- **Long-tail suggestions** (30+ variations generated locally)

---

## Project Structure

```
Open-Tube-SEO/
├── manifest.json          # Extension manifest (Chrome Extension Manifest V3)
├── background.js          # Service worker — lifecycle, alarms, messaging
├── popup.html             # Popup interface (tabbed: SEO, Keywords, Competitors, AI, Settings)
├── popup.js               # Popup logic — scoring, keywords, AI, settings
├── popup.css              # Popup styles (dark theme)
├── sidebar.html           # Studio sidebar panel
├── sidebar.js             # Sidebar logic
├── sidebar.css            # Sidebar styles
├── options.html           # Full options/configuration page
├── options.js             # Options logic
├── options.css            # Options styles
│
├── content/               # Content scripts (injected into YouTube pages)
│   ├── watch.js           # Video watch page — scrape metadata, inject badge
│   ├── watch.css          # Badge styles
│   ├── studio.js          # YouTube Studio — real-time scoring, optimize button
│   ├── studio.css         # Studio panel styles
│   ├── search.js          # Search results — SERP analysis
│   ├── search.css         # Search analysis styles
│   ├── channel.js         # Channel pages — channel metadata extraction
│   ├── channel.css        # Channel analysis styles
│   └── feed.js            # Feed page — trend data collection
│
├── lib/                   # Shared library modules
│   ├── engine.js          # WebLLM AI engine — model loading, generation
│   ├── seo.js             # SEO scoring engine — 18 checks, keyword extraction
│   ├── keywords.js        # Keyword research — intent, volume, long-tail
│   └── competitors.js     # Competitor analysis — tag comparison, content gaps
│
├── vendor/                # Vendor libraries
│   └── web-llm.js         # WebLLM fallback bundle (loaded from CDN first)
│
├── icons/                 # Extension icons
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
│
├── assets/                # Static assets
├── models/                # Model cache directory
└── README.md              # This file
```

---

## Privacy

OpenTube SEO is designed with **privacy by default**:

- **100% offline analysis** — SEO scoring, keyword extraction, and competitor analysis run entirely in your browser
- **Local AI** — Model inference runs via WebGPU/WebLLM in your browser
- **No accounts** — No login, no registration, no tracking
- **No telemetry** — We collect nothing. No analytics, no usage data
- **Data stays local** — All settings, keywords, and history are stored in `chrome.storage.local`

---

## Tech Stack

- **Chrome Extension Manifest V3** — Modern extension platform
- **WebLLM** — Browser-based LLM inference via WebGPU
- **WebGPU** — GPU compute for AI model execution
- **Ponytail** — Minimalist coding philosophy
- **Graphify** — Knowledge graph architecture patterns

---

## Development

```bash
# Clone the repository
git clone https://github.com/BizMapper/Open-Tube-SEO.git

# No build step needed — the extension is plain HTML/JS/CSS

# Load in Chrome
# chrome://extensions → Developer mode → Load unpacked → select this folder
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [**Ponytail**](https://github.com/DietrichGebert/ponytail) by DietrichGebert — AI agent coding style
- [**Graphify**](https://github.com/safishamsi/graphify) by safishamsi — Knowledge graph for codebases
- [**WebLLM**](https://github.com/mlc-ai/web-llm) by MLC AI — Browser-based LLM inference
- [**VidIQ**](https://vidiq.com) — Inspiration for the feature set

---

*OpenTube SEO is not affiliated with VidIQ, YouTube, or Google. It is an independent, open-source project.*
