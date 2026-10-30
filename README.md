# 🛡️ LiveTruth Shield — Universal Real-Time AI Fact-Checking

> **The Problem:** Over 500 hours of video are uploaded online every minute. False health claims, financial scams, altered history, and fabricated statistics spread 6x faster than truth because video creates an illusion of trust, yet no viewer has the time to pause and manually cross-reference claims while watching.
>
> **The Solution:** **LiveTruth Shield** is a real-time AI fact-checking engine built for YouTube, any web video player, and local video files. Powered by **Google Gemini with Live Search Grounding**, it scans spoken dialogue across the video timeline, extracts testable claims, verifies them against authoritative global repositories (e.g. Nature, NIH/PubMed, IEEE, NASA, WHO, World Bank), and delivers a clickable **Truth Timeline** with instant audio alerts and empirical research dossiers.

---

## ✨ Key Capabilities

- **⚡ Universal Video Coverage:**
  - **YouTube & Web Players:** Real-time extension overlay runs on YouTube and generic HTML5 video players.
  - **Local Video Files:** Native support for uploading and auditing local files (**MP4, MKV, MOV, WebM**) via Gemini Multimodal Audio/Video Understanding.
- **🎨 Minimalist Swiss / Linear Design:** Clean, modern dark UI (`#090A0F`, `#12141A`), subtle 1px borders, and high-legibility typography (`Inter` + `JetBrains Mono`) with **zero mock or hardcoded claims**.
- **🚀 60 FPS Butter-Smooth Performance:**
  - Hardware-accelerated CSS GPU compositing (`transform: translate3d`).
  - Throttled video synchronization via `requestAnimationFrame` and `MutationObserver`.
  - In-memory LRU verification cache for instant 0ms responses on repeated audits.
- **🔍 Dual-Engine Fact Verification:**
  - **Primary:** Gemini 3.8 / 3.1 Flash with real-time **Google Search Grounding**.
  - **Fallback:** High-speed direct knowledge engine with automatic quota resilience.
- **⏱️ Interactive Truth Timeline:**
  - Clickable timestamp pins (`🔴 False`, `🟢 Verified`, `🟡 Misleading`) to jump instantly to any claim in the video.
  - Live audio chime alerts when a debunked claim is reached during playback.
- **🔬 Verified Research Dossier:** Expandable evidence drawers detailing peer-reviewed citations, consensus findings, and exact database origins (PubMed Central, NCBI, Cochrane, Nature, NASA ADS).

---

## 🏗️ Architecture

```
┌────────────────────────────────┐         ┌─────────────────────────────────┐
│   Web Video (YouTube / HTML5)  │         │   Local Video Upload (MP4/MKV)  │
│    (Chrome Extension Overlay)  │         │     (Web Console Dashboard)     │
└───────────────┬────────────────┘         └────────────────┬────────────────┘
                │ chrome.runtime.sendMessage                │ HTTP POST /api/check-local
                ▼                                           ▼
┌────────────────────────────────┐         ┌─────────────────────────────────┐
│     Background Proxy Worker    │ ──────> │   FastAPI Local AI Server       │
│     (Bypasses CSP & CORS)      │         │   (http://localhost:5000)       │
└────────────────────────────────┘         └────────────────┬────────────────┘
                                                            │
                     ┌──────────────────────────────────────┴──────────────────────────────────────┐
                     ▼                                                                            ▼
     ┌───────────────────────────────┐                                            ┌───────────────────────────────┐
     │  YouTube Transcript Extractor │                                            │   Gemini Multimodal Files API │
     │  (Full Timeline Checkpoints)  │                                            │   (Audio/Visual Recognition)  │
     └───────────────┬───────────────┘                                            └───────────────┬───────────────┘
                     │                                                                            │
                     └──────────────────────────────────────┬─────────────────────────────────────┘
                                                            ▼
                                            ┌───────────────────────────────┐
                                            │    Google Gemini 3.1 / 3.8    │
                                            │    + Live Search Grounding    │
                                            └───────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python 3.10+**
- **Google Chrome** (or Chromium-based browser)
- A **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey)

### 2. Backend Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Manjotpreet-Singh/livetruth-shield.git
   cd livetruth-shield/backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set up your `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Start the server:
   - On Windows: double-click **`start.bat`** (automatically frees port 5000 and opens the dashboard).
   - Or run from terminal:
     ```bash
     python main.py
     ```
   The interactive console is available at `http://localhost:5000`.

### 3. Chrome Extension Setup
1. Open Google Chrome and go to `chrome://extensions/`.
2. Turn **Developer mode** (top-right toggle) **ON**.
3. Click **Load unpacked** (top-left).
4. Select the `livetruth-shield/extension` folder.
5. Open any video on YouTube (or click the floating **LiveTruth** pill at the bottom right).
6. Click **Play** on the video to start live real-time analysis, or use the quick test bar to audit any URL instantly!

---

## 📂 Project Structure

```
livetruth-shield/
├── backend/
│   ├── .env.example         # Template for Gemini API key
│   ├── main.py              # FastAPI server, multimodal video processor & Gemini pipeline
│   ├── requirements.txt     # Python dependencies
│   └── start.bat            # One-click Windows runner & auto port manager
├── extension/
│   ├── background.js        # Service worker proxy (bypasses CSP & CORS)
│   ├── content.js           # DOM overlay HUD, 60fps video sync, timeline & audio chime
│   ├── manifest.json        # Chrome Extension Manifest V3 configuration
│   ├── popup.html           # Minimalist extension popup
│   └── sidebar.css          # Minimalist Swiss / Linear dark design system
├── .gitignore               # Excludes virtual envs, secrets, and cache
└── README.md                # Project documentation & pitch
```

---

## 📜 License
MIT License. Built for real-time truth and combating automated digital misinformation.
