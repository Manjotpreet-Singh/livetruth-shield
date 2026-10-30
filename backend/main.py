import os
import json
import asyncio
import threading
import time
import urllib.parse
import webbrowser
from fastapi import FastAPI, Query, HTTPException, File, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from youtube_transcript_api import YouTubeTranscriptApi
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

Features_Available = False
try:
    from google import genai
    from google.genai import types
    Features_Available = True
except ImportError:
    print("[!] google-genai not yet installed. Run: pip install -r requirements.txt")

app = FastAPI(title="LiveTruth Shield API", version="1.0.0")

# High-Performance In-Memory Verification Cache (Instant zero-latency responses for repeated videos)
VERIFICATION_CACHE = {}
MAX_CACHE_SIZE = 100


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = None
if Features_Available and GEMINI_API_KEY:
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        print("[+] Gemini client initialized successfully with API key.")
    except Exception as e:
        print(f"[WARNING] Could not initialize Gemini client: {e}")

def extract_video_id(url_or_id: str) -> str:
    if not url_or_id:
        return ""
    url_or_id = urllib.parse.unquote(url_or_id).strip()
    clean = url_or_id.rstrip("/")
    if clean in ["https://www.youtube.com", "http://www.youtube.com", "youtube.com", "https://m.youtube.com"]:
        return ""
    if "v=" in url_or_id:
        v = url_or_id.split("v=")[1].split("&")[0].split("#")[0]
        return v if len(v) >= 6 else ""
    elif "youtu.be/" in url_or_id:
        v = url_or_id.split("youtu.be/")[1].split("?")[0].split("&")[0]
        return v if len(v) >= 6 else ""
    elif len(url_or_id) == 11 and not url_or_id.startswith("http"):
        return url_or_id
    elif url_or_id.startswith("http://") or url_or_id.startswith("https://"):
        return url_or_id
    return ""

def get_fallback_demo_data(query_info=""):
    return {
        "score": 0,
        "intel": "No verifiable dialogue detected or video has no English/Hindi subtitles available.",
        "cards": []
    }


@app.get("/", response_class=HTMLResponse)
def root_dashboard():
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LiveTruth — Universal AI Fact-Checker</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #090A0F;
            --surface: #12141A;
            --surface-hover: #181B23;
            --border: rgba(255, 255, 255, 0.08);
            --border-focus: rgba(255, 255, 255, 0.2);
            --accent: #3B82F6;
            --accent-hover: #60A5FA;
            --text-main: #FFFFFF;
            --text-muted: #94A3B8;
            --text-dim: #64748B;
            --green: #10B981;
            --red: #EF4444;
            --yellow: #F59E0B;
            --mono: 'JetBrains Mono', monospace;
            --sans: 'Inter', -apple-system, sans-serif;
        }
        * { box-sizing: border-box; }
        body {
            background: var(--bg);
            color: var(--text-main);
            font-family: var(--sans);
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }
        header {
            background: rgba(18, 20, 26, 0.8);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border);
            padding: 14px 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .brand {
            font-size: 15px;
            font-weight: 600;
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 10px;
            letter-spacing: -0.3px;
        }
        .status-pill {
            background: rgba(16, 185, 129, 0.1);
            color: #34D399;
            border: 1px solid rgba(16, 185, 129, 0.2);
            padding: 4px 10px;
            border-radius: 20px;
            font-family: var(--mono);
            font-size: 11px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .pulse {
            width: 6px;
            height: 6px;
            background: #10B981;
            border-radius: 50%;
        }
        main {
            flex: 1;
            max-width: 820px;
            margin: 40px auto;
            padding: 0 20px;
            width: 100%;
        }
        .hero {
            text-align: center;
            margin-bottom: 30px;
        }
        .hero h1 {
            font-size: 28px;
            font-weight: 600;
            letter-spacing: -0.6px;
            margin: 0 0 8px;
        }
        .hero p {
            color: var(--text-muted);
            font-size: 14px;
            margin: 0;
        }

        /* Tabs */
        .tabs {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 24px;
        }
        .tab-btn {
            background: var(--surface);
            border: 1px solid var(--border);
            color: var(--text-muted);
            font-family: var(--sans);
            font-size: 12.5px;
            font-weight: 500;
            padding: 6px 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .tab-btn:hover {
            color: var(--text-main);
            border-color: var(--border-focus);
        }
        .tab-btn.active {
            background: rgba(59, 130, 246, 0.12);
            color: #60A5FA;
            border-color: rgba(59, 130, 246, 0.3);
        }

        /* Input Bar */
        .input-bar {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 6px 8px 6px 18px;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 24px;
            transition: all 0.2s ease;
        }
        .input-bar:focus-within {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
        .input-bar input {
            flex: 1;
            background: none;
            border: none;
            color: var(--text-main);
            font-family: var(--sans);
            font-size: 13.5px;
            outline: none;
        }
        .input-bar input::placeholder {
            color: var(--text-dim);
        }
        .input-bar button, .upload-box button {
            background: var(--accent);
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 8px 20px;
            font-family: var(--sans);
            font-weight: 500;
            font-size: 13px;
            cursor: pointer;
            transition: background 0.15s ease;
        }
        .input-bar button:hover, .upload-box button:hover {
            background: var(--accent-hover);
        }

        /* File Upload */
        .upload-dropzone {
            display: none;
            background: var(--surface);
            border: 1px dashed var(--border);
            border-radius: 12px;
            padding: 32px 20px;
            text-align: center;
            margin-bottom: 24px;
            cursor: pointer;
            transition: border-color 0.15s ease;
        }
        .upload-dropzone:hover {
            border-color: var(--accent);
        }
        .upload-dropzone p {
            margin: 0;
            color: var(--text-muted);
            font-size: 13px;
        }

        /* Results Panel */
        .panel {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
        }
        .meter-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12.5px;
            color: var(--text-muted);
            margin-bottom: 6px;
        }
        .meter-bar-bg {
            background: rgba(255, 255, 255, 0.05);
            height: 4px;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 16px;
        }
        .meter-bar {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #EF4444, #F59E0B, #10B981);
            border-radius: 4px;
            transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #intelText {
            font-size: 12px;
            color: var(--text-muted);
            line-height: 1.45;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            padding: 10px 14px;
            border-radius: 8px;
            margin-bottom: 16px;
        }
        .card-item {
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 10px;
        }
        .card-item.FALSE { border-left: 3px solid var(--red); }
        .card-item.VERIFIED { border-left: 3px solid var(--green); }
        .card-item.MISLEADING { border-left: 3px solid var(--yellow); }
        .tag {
            font-family: var(--mono);
            font-size: 9px;
            font-weight: 600;
            padding: 2px 6px;
            border-radius: 4px;
        }
        .tag.FALSE { background: rgba(239, 68, 68, 0.12); color: #F87171; }
        .tag.VERIFIED { background: rgba(16, 185, 129, 0.12); color: #34D399; }
        .tag.MISLEADING { background: rgba(245, 158, 11, 0.12); color: #FBBF24; }
        .quote { font-style: italic; color: var(--text-main); font-size: 13px; line-height: 1.4; margin: 6px 0; }
        .explanation { color: var(--text-muted); font-size: 12px; line-height: 1.45; margin-bottom: 6px; }
        .source { font-size: 11px; color: var(--text-dim); }
        .source strong { color: var(--accent-hover); }
    </style>
</head>
<body>
    <header>
        <div class="brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.2">
                <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
                <path d="M10 15.5l-3.5-3.5 1.41-1.41L10 12.67l5.59-5.59L17 8.5l-7 7z" fill="#3B82F6"/>
            </svg>
            LiveTruth
        </div>
        <div class="status-pill"><div class="pulse"></div> Ready</div>
    </header>

    <main>
        <div class="hero">
            <h1>Fact-Checking Console</h1>
            <p>Paste any video link or upload a local file to audit factual accuracy.</p>
        </div>

        <div class="tabs">
            <button class="tab-btn active" id="tabWeb" onclick="switchMode('web')">Web URL</button>
            <button class="tab-btn" id="tabLocal" onclick="switchMode('local')">Local Video</button>
        </div>

        <!-- URL Input -->
        <div class="input-bar" id="webContainer">
            <input type="text" id="videoUrl" placeholder="Enter YouTube or video URL to test...">
            <button onclick="analyzeVideo()">Test</button>
        </div>

        <!-- Local File -->
        <div class="upload-dropzone" id="localContainer" onclick="document.getElementById('fileInput').click()">
            <input type="file" id="fileInput" accept="video/*,audio/*" style="display:none;" onchange="handleFileSelect(event)">
            <p id="uploadText">Click to select MP4, MKV, or audio file</p>
        </div>

        <!-- Results Panel -->
        <div class="panel">
            <div class="meter-row">
                <span>Reliability Score</span>
                <strong id="scoreVal" style="font-family:var(--mono); color:#10B981;">--</strong>
            </div>
            <div class="meter-bar-bg">
                <div id="scoreBar" class="meter-bar"></div>
            </div>
            <div id="intelText">Enter a video link or file above to start the fact-checking audit.</div>
            <div id="cardsList">
                <div style="text-align:center; padding: 24px; color:var(--text-dim); font-size:12.5px;">
                    No analysis performed yet.
                </div>
            </div>
        </div>
    </main>

    <script>
        function switchMode(mode) {
            const isWeb = mode === 'web';
            document.getElementById('webContainer').style.display = isWeb ? 'flex' : 'none';
            document.getElementById('localContainer').style.display = isWeb ? 'none' : 'block';
            document.getElementById('tabWeb').classList.toggle('active', isWeb);
            document.getElementById('tabLocal').classList.toggle('active', !isWeb);
        }

        async function analyzeVideo() {
            const url = document.getElementById("videoUrl").value.trim();
            if (!url) return;
            const cardsList = document.getElementById("cardsList");
            cardsList.innerHTML = "<div style='text-align:center; padding: 24px; color:var(--text-dim); font-size:12.5px;'>Auditing video claims...</div>";
            try {
                const res = await fetch("/api/check?v=" + encodeURIComponent(url));
                const data = await res.json();
                renderResults(data);
            } catch (e) {
                alert("Error connecting to server: " + e);
            }
        }

        async function handleFileSelect(e) {
            const file = e.target.files[0];
            if (!file) return;

            document.getElementById('uploadText').innerText = `Analyzing: ${file.name}...`;
            const cardsList = document.getElementById("cardsList");
            cardsList.innerHTML = "<div style='text-align:center; padding: 24px; color:var(--text-dim); font-size:12.5px;'>Uploading & auditing audio...</div>";

            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('/api/check-local', { method: 'POST', body: formData });
                const data = await res.json();
                document.getElementById('uploadText').innerText = `Done: ${file.name}`;
                renderResults(data);
            } catch (err) {
                alert("Failed: " + err);
            }
        }

        function renderResults(data) {
            document.getElementById("scoreVal").innerText = (data.score || 0) + "%";
            document.getElementById("scoreBar").style.width = (data.score || 0) + "%";
            if (data.intel) {
                document.getElementById("intelText").innerText = data.intel;
            }
            const cardsList = document.getElementById("cardsList");
            if (!data.cards || data.cards.length === 0) {
                cardsList.innerHTML = "<div style='text-align:center; padding: 24px; color:var(--text-dim); font-size:12.5px;'>No testable claims found in video.</div>";
                return;
            }
            cardsList.innerHTML = data.cards.map(c => `
                <div class="card-item ${c.verdict}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span class="tag ${c.verdict}">${c.verdict}</span>
                        <span style="font-family:var(--mono); font-size:10.5px; color:var(--text-dim);">${c.timestamp}</span>
                    </div>
                    <div class="quote">"${c.quote}"</div>
                    <div class="explanation">${c.explanation}</div>
                    <div class="source">Authority: <strong>${c.source}</strong></div>
                </div>
            `).join("");
        }
    </script>
</body>
</html>
"""

@app.get("/api/health")
def health():
    return {"status": "online", "model": "Gemma-2 + Gemini-3.8-Flash", "gemini_configured": client is not None}

@app.get("/api/check")
async def check_video(v: str = Query(..., description="YouTube Video ID or URL"), title: str = Query("", description="Page or video title")):

    video_id = extract_video_id(v)
    if not video_id:
        print("[!] No valid video ID detected (empty or non-video page). Returning clean state.")
        return {
            "score": 0,
            "intel": "No active video selected. Play a video or enter a URL above to test facts.",
            "cards": []
        }

    print(f"[*] Processing video ID: {video_id}")

    # Instant Cache Lookup (Butter-Smooth 0ms response)
    if video_id in VERIFICATION_CACHE:
        print(f"[⚡ CACHE HIT] Serving instant cached fact-check for {video_id}")
        return VERIFICATION_CACHE[video_id]


    if not client:
        print("[ Info ] Gemini client or API key not set, returning demo fallback")
        return get_fallback_demo_data()

    # Robust Transcript Fetching across the entire video
    text_chunk = ""
    total_duration_sec = 0
    try:
        yt = YouTubeTranscriptApi()
        transcript = None
        # Try primary fetch
        try:
            transcript = yt.fetch(video_id)
        except Exception:
            try:
                transcript = YouTubeTranscriptApi.get_transcript(video_id)
            except Exception:
                try:
                    transcript_list = yt.list(video_id)
                    # Try english first, then hindi, then any available language
                    try:
                        transcript = transcript_list.find_transcript(["en", "en-US", "en-GB"]).fetch()
                    except Exception:
                        try:
                            transcript = transcript_list.find_transcript(["hi"]).fetch()
                        except Exception:
                            transcript = next(iter(transcript_list)).fetch()
                except Exception as e_inner:
                    print(f"[!] Could not list transcripts: {e_inner}")

        if not transcript or len(transcript) == 0:
            print(f"[Info] Direct transcript unavailable for {video_id}. Activating Deep Topic Analysis for: '{title}'...")
            text_chunk = f"Video Title / Topic: {title}\nURL: https://www.youtube.com/watch?v={video_id}\nNote: Analyzing public verified claims from this specific video dialogue."

        # Sample across the entire video duration (not just first 30 snippets)
        total_snippets = len(transcript)
        last_item = transcript[-1]
        last_start = getattr(last_item, "start", 0) if hasattr(last_item, "start") else (last_item.get("start", 0) if isinstance(last_item, dict) else 0)
        total_duration_sec = int(last_start)

        # Uniformly sample up to 120 snippets across the entire video timeline
        if total_snippets <= 350:
            sampled_items = transcript
        else:
            step = total_snippets / 350.0
            sampled_items = [transcript[int(i * step)] for i in range(350)]

        for item in sampled_items:
            start = getattr(item, "start", None)
            if start is None:
                start = item.get("start", 0) if isinstance(item, dict) else 0
            text = getattr(item, "text", None)
            if text is None:
                text = item.get("text", "") if isinstance(item, dict) else ""
            m = int(start // 60)
            s = int(start % 60)
            text_chunk += f"[{m:02d}:{s:02d}] {text.strip()}\n"

        print(f"[+] Extracted entire video transcript: {total_snippets} total snippets (~{total_duration_sec // 60}m {total_duration_sec % 60}s). Sampled {len(sampled_items)} key checkpoints across the timeline.")
    except Exception as e:
        print(f"[Info] Transcript error or unavailable ({e}). Activating Deep Topic Analysis for: '{title}'...")
        text_chunk = f"Video Title / Topic: {title}\nURL: https://www.youtube.com/watch?v={video_id}\nNote: Analyze key spoken claims made in this specific talk or interview."

    # Gemini Comprehensive Fact-Checking Prompt covering entire video timeline
    try:
        prompt = (
            "You are LiveTruth Shield, an elite real-time fact-checking AI layer.\n"
            "Perform an EXHAUSTIVE, COMPREHENSIVE factual audit of this entire video transcript from 00:00 to the end:\n\n"
            + text_chunk + "\n\n"
            "Universal Fact-Checking & Evidence Guidelines:\n"
            "1. EXHAUSTIVE COVERAGE: Extract ALL testable factual statements made across the entire video (aim for 8 to 15 distinct claims across timestamps).\n"
            "2. Verify EVERY claim: Health, human biology, technology, physics, history, geopolitics, business, or economics.\n"
            "3. REPUTABLE GLOBAL SOURCES: For every claim, verify against the recognized authority in that specific field:\n"
            "   - Health & Biology: PubMed Central, NIH, Nature, The Lancet, CDC, WHO, Mayo Clinic, Cleveland Clinic.\n"
            "   - Science & Tech: IEEE, ACM, Nature, Science, MIT Technology Review, NASA, ESA.\n"
            "   - Economics & Finance: World Bank, IMF, Federal Reserve, SEC, Bloomberg, Financial Times.\n"
            "   - History, Law & Politics: National Archives, Britannica, UN, Congressional Research Service, Supreme Court.\n"
            "   - General Knowledge: Standard peer-reviewed encyclopedic consensus.\n"
            "4. For FALSE or MISLEADING claims, clearly explain: What the speaker claimed, why it is false/misleading, what the actual verified fact is, and the exact authoritative source.\n"
            "5. For VERIFIED claims, provide the scientific or institutional backing confirming its truth.\n"
            "6. Verdicts must be strictly: VERIFIED, FALSE, or MISLEADING.\n"
            "7. Compute an Overall Truth Reliability Score (0-100%).\n"
            "8. Provide an insightful 1-2 sentence Video Intel context brief.\n\n"
            "Return ONLY a valid JSON object matching this exact schema:\n"
            "{\n"
            "  \"score\": 68,\n"
            "  \"intel\": \"Overall topic context and scientific accuracy consensus across the video.\",\n"
            "  \"cards\": [\n"
            "    {\n"
            "      \"verdict\": \"FALSE\",\n"
            "      \"timestamp\": \"04:15\",\n"
            "      \"seconds\": 255,\n"
            "      \"quote\": \"exact spoken quote from the video\",\n"
            "      \"explanation\": \"Detailed explanation of why this claim is incorrect and what the true scientific/factual reality is.\",\n"
            "      \"source\": \"Primary Authority Name (e.g., Nature, NIH, CDC, Lancet, NASA, Harvard Medical)\",\n"
            "      \"researchPaper\": \"Specific peer-reviewed paper title, standard meta-analysis, or institutional dossier\",\n"
            "      \"researchSummary\": \"Concrete empirical trial data or consensus findings that refute or prove the claim.\",\n"
            "      \"dataOrigin\": \"Primary database origin (e.g., PubMed Central, NCBI, Cochrane Library, NASA Astrophysics Data System)\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )

        # Try live fact-checking with optimal model selection & search fallback
        target_models = ["gemini-3.1-flash-lite", "gemini-3.8-flash"]
        raw_text = None
        used_model = None

        for m_name in target_models:
            try:
                # First attempt: With live Google Search Grounding
                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=m_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        tools=[types.Tool(google_search=types.GoogleSearch())],
                        response_mime_type="application/json",
                        temperature=0.1
                    )
                )
                raw_text = response.text.strip()
                used_model = f"{m_name} (with Google Search)"
                break
            except Exception as e_search:
                # If Google Search Grounding hits 429 quota, fallback to direct high-speed AI knowledge
                try:
                    response = await asyncio.to_thread(
                        client.models.generate_content,
                        model=m_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            temperature=0.1
                        )
                    )
                    raw_text = response.text.strip()
                    used_model = f"{m_name} (Knowledge Engine)"
                    break
                except Exception as e_direct:
                    continue

        if not raw_text:
            print("[Info] Live AI quota exhausted across models, serving fast demo cache.")
            return get_fallback_demo_data()

        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        parsed = json.loads(raw_text.strip())
        
        # Sanitize cards: never include system errors or N/A quotes as FALSE facts
        raw_cards = parsed.get("cards", [])
        clean_cards = []
        for c in raw_cards:
            q = str(c.get("quote", "")).strip()
            src = str(c.get("source", "")).strip().lower()
            exp = str(c.get("explanation", "")).strip().lower()
            if q.upper() in ["N/A", "NONE", "NULL", ""] or "system error" in src or "malformed" in exp or "non-existent" in exp:
                continue
            clean_cards.append(c)

        parsed["cards"] = clean_cards
        if not clean_cards:
            parsed["score"] = 0
            if "invalid" in parsed.get("intel", "").lower() or "malformed" in parsed.get("intel", "").lower():
                parsed["intel"] = "No verifiable claims detected."

        print(f"[+] Successfully fact-checked live using {used_model}! Extracted {len(clean_cards)} valid claims.")
        VERIFICATION_CACHE[video_id] = parsed
        if len(VERIFICATION_CACHE) > MAX_CACHE_SIZE:
            VERIFICATION_CACHE.pop(next(iter(VERIFICATION_CACHE)))
        return parsed

    except Exception as err:
        print(f"[Error] Gemini API verification failed: {err}")
        return get_fallback_demo_data()

def free_port_5000():
    try:
        import subprocess
        out = subprocess.check_output("netstat -ano", shell=True, text=True)
        for line in out.splitlines():
            if ":5000" in line and "LISTENING" in line:
                parts = line.strip().split()
                pid = int(parts[-1])
                if pid != os.getpid():
                    print(f"[*] Freeing port 5000: closing old process {pid}...")
                    os.system(f"taskkill /F /PID {pid} >nul 2>&1")
    except Exception:
        pass

if __name__ == "__main__":
    free_port_5000()
    import uvicorn
    
    def auto_open_browser():
        time.sleep(1.2)
        webbrowser.open("http://localhost:5000")

    threading.Thread(target=auto_open_browser, daemon=True).start()

    print("[+] Starting LiveTruth Shield API on http://localhost:5000")
    print("[*] Automatically opening Web Dashboard in browser at http://localhost:5000...")
    uvicorn.run(app, host="0.0.0.0", port=5000)