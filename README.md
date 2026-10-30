# 🛡️ LiveTruth Shield — Real-Time AI Fact-Checking for YouTube

> **The Problem:** Over 500 hours of video are uploaded to YouTube every minute. False health claims, financial scams, altered history, and fabricated quotes spread 6x faster than the truth because video creates a false sense of trust, yet no viewer has the time to pause and manually Google 20 claims while watching.
>
> **The Solution:** **LiveTruth Shield** is an AI layer that watches YouTube with you in real time. Powered by **Google Gemini with Live Search Grounding**, it scans transcripts across the entire video, identifies checkable claims, verifies them against reputable primary authorities (e.g., Nature, NIH, NASA, CDC), and delivers a clickable **Truth Timeline** with instant audio alerts and empirical research dossiers.

---

## ✨ Key Features

- **🌐 Google Material 3 / Gemini Expressive UI:** Built with Google’s official design language, clean pill controls, and dark-mode glassmorphism.
- **⏱️ Clickable Truth Timeline:** Visual interactive chips (`🔴 False`, `🟢 Verified`, `🟡 Misleading`) allow instant jumping to specific claim timestamps in the YouTube player.
- **⚡ Real-Time Playback Sync:** Automatically highlights the card currently being spoken (`⚡ SPEAKING NOW`) as the video plays.
- **🔔 Google Harmonic Audio Chime:** Uses the Web Audio API to alert viewers with a pleasant, subtle notification the moment a debunked claim is reached.
- **🔬 Verified Research Dossier:** Expandable drawers detailing peer-reviewed paper citations, refutation findings, and exact data origins (NCBI, PubMed Central, Cochrane, NASA).
- **🛡️ Full-Video Timeline Sampling:** Uniform checkpoint scanning across beginning, middle, and end of long-form podcasts and documentaries.
- **📊 Standalone Web Dashboard:** A companion console running on `http://localhost:5000` to paste and verify any YouTube link directly.

---

## 🏗️ Architecture

```
┌────────────────────────────────┐         ┌───────────────────────────────┐
│     YouTube Web Player         │         │   FastAPI Local AI Server     │
│  (Chrome Extension Content UI) │         │   (http://localhost:5000)     │
└───────────────┬────────────────┘         └───────────────┬───────────────┘
                │ chrome.runtime.sendMessage               │
                ▼                                          ▼
┌────────────────────────────────┐         ┌───────────────────────────────┐
│     Background Worker          │ ──────> │  YouTube Transcript Extractor │
│     (Bypasses YouTube CSP)     │         │  (Full Timeline Checkpoints)  │
└────────────────────────────────┘         └───────────────┬───────────────┘
                                                           │
                                                           ▼
                                           ┌───────────────────────────────┐
                                           │   Google Gemini 3.1 & 3.8     │
                                           │   + Live Search Grounding     │
                                           └───────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python 3.10+**
- **Google Chrome** (or Chromium-based browser like Brave/Edge)
- Free **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/apikey)

### 2. Backend Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/livetruth-shield.git
   cd livetruth-shield/backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create your `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Add your API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Start the server:
   - On Windows, simply double-click **`start.bat`** (it automatically frees port 5000 and launches the dashboard in your browser).
   - Or run via terminal:
     ```bash
     python main.py
     ```

### 3. Chrome Extension Installation
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** (top-right corner) to **ON**.
3. Click **Load unpacked** (top-left).
4. Select the `livetruth-shield/extension` folder.
5. Open any YouTube video with captions (e.g. podcast or educational video). Click the floating **🛡️ LiveTruth** pill at the bottom right!

---

## 📂 Project Structure

```
livetruth-shield/
├── backend/
│   ├── .env.example         # Template for Gemini API key
│   ├── main.py              # FastAPI server, full transcript sampler & Gemini pipeline
│   ├── requirements.txt     # Python dependencies
│   └── start.bat            # One-click Windows runner & auto port manager
├── extension/
│   ├── background.js        # Service worker proxy (bypasses CSP & CORS)
│   ├── content.js           # YouTube DOM injection, video sync, timeline & audio chime
│   ├── manifest.json        # Chrome Extension Manifest V3 configuration
│   ├── popup.html           # Toolbar popup
│   └── sidebar.css          # Google Material 3 glassmorphism styles
├── .gitignore               # Excludes virtual envs, secrets, and cache
└── README.md                # Documentation & pitch summary
```

---

## 🏆 Hackathon Demo Tips

- Choose a video with prominent claims (e.g., neuroscience, health myths, or nutrition).
- Let the video play: watch the card glow blue (`⚡ SPEAKING NOW`) at the exact second the speaker makes the claim.
- Point out the clickable timeline chips and open the **🔬 Verified Research & Primary Origin** drawer to show the primary authority citation!

---

## 📜 License
MIT License. Built for real-time truth and combating automated digital misinformation.
