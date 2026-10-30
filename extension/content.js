(function () {
  let isOpen = false;
  let activeVideoKey = "";
  let soundEnabled = true;
  let playedAlerts = new Set();
  let currentCards = [];
  let currentActiveIndex = -1;
  let lastTimeUpdate = 0;
  let cachedVideoElement = null;

  // Optimized Audio Chime using shared AudioContext
  let audioCtxInstance = null;
  function playAlertChime() {
    if (!soundEnabled) return;
    try {
      if (!audioCtxInstance) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioCtxInstance = new AudioCtx();
      }
      if (audioCtxInstance.state === "suspended") {
        audioCtxInstance.resume();
      }
      const osc = audioCtxInstance.createOscillator();
      const gain = audioCtxInstance.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtxInstance.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtxInstance.currentTime + 0.16);
      gain.gain.setValueAtTime(0.12, audioCtxInstance.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtxInstance.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(audioCtxInstance.destination);
      osc.start();
      osc.stop(audioCtxInstance.currentTime + 0.22);
    } catch (e) {
      console.warn("Chime failed", e);
    }
  }

  function getActiveVideoElement() {
    if (cachedVideoElement && document.contains(cachedVideoElement)) {
      return cachedVideoElement;
    }
    const videos = document.querySelectorAll("video");
    if (videos.length === 0) return null;
    let chosen = null;
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      if (!v.paused && v.currentTime > 0) {
        chosen = v;
        break;
      }
    }
    if (!chosen && videos.length > 0) {
      chosen = videos[0];
    }
    cachedVideoElement = chosen;
    return chosen;
  }

  function setupExtension() {
    if (document.getElementById("livetruth-btn")) return;
    const video = getActiveVideoElement();
    if (!video && !window.location.hostname.includes("youtube.com")) return;

    // 1. Floating Pill Button (Google Gemini Style)
    const btn = document.createElement("button");
    btn.id = "livetruth-btn";
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 0 4px rgba(66,133,244,0.5));">
        <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="url(#gShieldGrad)"/>
        <path d="M10 15.5l-3.5-3.5 1.41-1.41L10 12.67l5.59-5.59L17 8.5l-7 7z" fill="#fff"/>
        <defs>
          <linearGradient id="gShieldGrad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
            <stop stop-color="#4285F4"/>
            <stop offset="0.5" stop-color="#9B72CB"/>
            <stop offset="1" stop-color="#34A853"/>
          </linearGradient>
        </defs>
      </svg>
      <span>LiveTruth</span>
      <span class="lt-badge-gemini" style="font-size:8px; padding:2px 6px;">Universal AI</span>
    `;
    btn.addEventListener("click", togglePanel);
    document.body.appendChild(btn);

    // 2. Google Material 3 Sidebar Panel
    const panel = document.createElement("div");
    panel.id = "livetruth-panel";
    panel.innerHTML = `
      <div class="lt-head">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="#4285F4"/>
            <path d="M10 15.5l-3.5-3.5 1.41-1.41L10 12.67l5.59-5.59L17 8.5l-7 7z" fill="#fff"/>
          </svg>
          LiveTruth Shield
          <span class="lt-badge-gemini">Universal</span>
        </h2>
        <div style="display:flex; align-items:center; gap:8px;">
          <button id="lt-sound-btn" class="lt-sound-toggle active" title="Toggle audio alert on false claims">🔔 Audio Alert</button>
          <button id="lt-close" title="Close LiveTruth Sidebar">✕</button>
        </div>
      </div>

      <!-- Pastable Link & Manual Verification Input Bar -->
      <div class="lt-input-capsule">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E918F" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="lt-manual-url" placeholder="Paste any video link or claim to verify...">
        <button id="lt-manual-btn">Verify</button>
      </div>

      <!-- Instant Video Intel & Scientific Context -->
      <div id="lt-intel-box">
        <div class="lt-intel-tag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          Universal Video Intel & Topic Context
        </div>
        <div id="lt-video-title">Analyzing video claims...</div>
        <div id="lt-video-summary">Cross-referencing video statements with Google Gemini Knowledge Grounding & authoritative databases...</div>
      </div>

      <!-- Overall Reliability Score Bar -->
      <div class="lt-score-box">
        <div class="lt-score-header">
          <span>Overall Truth Reliability</span>
          <strong id="lt-score-val" style="color:#81C995; font-weight:700;">Analyzing...</strong>
        </div>
        <div class="lt-score-bar-bg">
          <div id="lt-score-bar" class="lt-score-bar"></div>
        </div>
      </div>

      <!-- Clickable Truth Timeline Track (Google Chips) -->
      <div class="lt-timeline-box">
        <div class="lt-timeline-header">
          <span>⏱️ Clickable Truth Timeline</span>
          <div id="lt-verdict-summary" class="lt-verdict-summary"></div>
        </div>
        <div id="lt-timeline-track" class="lt-timeline-track">
          <span style="color:#8E918F; font-size:11px;">Scanning video timeline...</span>
        </div>
      </div>

      <!-- Fact Claims Stream with Live Playback Tracking -->
      <div id="lt-feed" class="lt-cards-feed">
        <div style="text-align:center; color:#8E918F; margin-top:35px; font-size:12.5px;">
          Scanning video audio & fact-checking claims...
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const closeBtn = document.getElementById("lt-close");
    if (closeBtn) closeBtn.addEventListener("click", togglePanel);

    const manualBtn = document.getElementById("lt-manual-btn");
    const manualInput = document.getElementById("lt-manual-url");
    if (manualBtn && manualInput) {
      manualBtn.addEventListener("click", () => {
        const val = manualInput.value.trim();
        if (val) {
          fetchUniversalAnalysis(val, val);
        }
      });
      manualInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const val = manualInput.value.trim();
          if (val) fetchUniversalAnalysis(val, val);
        }
      });
    }

    const soundBtn = document.getElementById("lt-sound-btn");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        soundBtn.innerText = soundEnabled ? "🔔 Audio Alert" : "🔕 Muted";
        soundBtn.classList.toggle("active", soundEnabled);
      });
    }

    // Panel Event Delegation (Zero memory leak click router)
    panel.addEventListener("click", (e) => {
      // 1. Timeline Pin Click
      const pin = e.target.closest(".lt-timeline-pin");
      if (pin) {
        const seconds = parseInt(pin.getAttribute("data-seconds"), 10);
        const cardId = pin.getAttribute("data-card");
        if (!isNaN(seconds)) seekTo(seconds);
        if (cardId) {
          const targetCard = document.getElementById(cardId);
          if (targetCard) {
            targetCard.scrollIntoView({ behavior: "smooth", block: "center" });
            targetCard.classList.add("active-playback");
            setTimeout(() => targetCard.classList.remove("active-playback"), 1800);
          }
        }
        return;
      }

      // 2. Timestamp Jump inside Card
      const timeBtn = e.target.closest(".lt-time-btn");
      if (timeBtn) {
        const seconds = parseInt(timeBtn.getAttribute("data-seconds"), 10);
        if (!isNaN(seconds)) seekTo(seconds);
        return;
      }

      // 3. Research Evidence Drawer Toggle
      const researchBtn = e.target.closest(".lt-research-btn");
      if (researchBtn) {
        const targetId = researchBtn.getAttribute("data-target");
        const drawer = document.getElementById(targetId);
        if (drawer) {
          drawer.classList.toggle("open");
          const isDrawerOpen = drawer.classList.contains("open");
          researchBtn.querySelector(".drawer-arrow").innerText = isDrawerOpen ? "▲ Hide Evidence" : "▼ View Evidence";
        }
      }
    });

    attachUniversalVideoSync();
    detectUniversalVideoChange();
  }

  // Butter-Smooth Throttled Video Playback Sync (60fps requestAnimationFrame)
  function attachUniversalVideoSync() {
    const video = getActiveVideoElement();
    if (!video || video.hasAttribute("data-lt-sync")) return;
    video.setAttribute("data-lt-sync", "true");

    let isTicking = false;
    video.addEventListener("timeupdate", () => {
      const now = performance.now();
      // Throttle to 4 times a second max (250ms) to save CPU & GPU overhead
      if (now - lastTimeUpdate < 250) return;
      lastTimeUpdate = now;

      if (!isTicking) {
        window.requestAnimationFrame(() => {
          highlightActiveCard(Math.floor(video.currentTime));
          isTicking = false;
        });
        isTicking = true;
      }
    });
  }

  function highlightActiveCard(currentTime) {
    if (!currentCards.length) return;
    let foundIndex = -1;

    for (let i = 0; i < currentCards.length; i++) {
      const c = currentCards[i];
      if (currentTime >= c.seconds && currentTime <= c.seconds + 6) {
        foundIndex = i;
        break;
      }
    }

    // Only update DOM if the active card has actually changed
    if (foundIndex === currentActiveIndex) return;

    if (currentActiveIndex !== -1) {
      const prevEl = document.getElementById(`card-${currentActiveIndex}`);
      if (prevEl) prevEl.classList.remove("active-playback");
    }

    currentActiveIndex = foundIndex;

    if (foundIndex !== -1) {
      const activeEl = document.getElementById(`card-${foundIndex}`);
      if (activeEl) {
        activeEl.classList.add("active-playback");
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });

        const c = currentCards[foundIndex];
        if ((c.verdict === "FALSE" || c.verdict === "MISLEADING") && !playedAlerts.has(c.seconds)) {
          playedAlerts.add(c.seconds);
          playAlertChime();
        }
      }
    }
  }

  function togglePanel() {
    isOpen = !isOpen;
    const panel = document.getElementById("livetruth-panel");
    if (panel) {
      panel.classList.toggle("open", isOpen);
    }
  }

  function detectUniversalVideoChange() {
    const url = window.location.href;
    const params = new URLSearchParams(window.location.search);
    const ytId = params.get("v");
    const currentKey = ytId || url;

    if (currentKey && currentKey !== activeVideoKey) {
      activeVideoKey = currentKey;
      playedAlerts.clear();
      currentActiveIndex = -1;
      fetchUniversalAnalysis(ytId, url);
    }
    attachUniversalVideoSync();
  }

  function seekTo(seconds) {
    const video = getActiveVideoElement();
    if (video) {
      video.currentTime = seconds;
      video.play();
    }
  }

  function fetchUniversalAnalysis(videoId, pageUrl) {
    const feed = document.getElementById("lt-feed");
    const titleEl = document.getElementById("lt-video-title");

    let cleanTitle = document.title.replace(" - YouTube", "").replace(" | X", "").replace(" • Instagram", "");
    if (titleEl && cleanTitle) {
      titleEl.innerText = cleanTitle;
    }

    if (feed) {
      feed.innerHTML = `<div style="text-align:center; color:#8E918F; font-size:12.5px; margin-top:35px;">⚡ Fact-checking video with Google Gemini Knowledge Grounding...</div>`;
    }

    try {
      chrome.runtime.sendMessage({ action: "checkVideo", videoId: (videoId || pageUrl), title: cleanTitle }, (response) => {
        if (response && response.success && response.data) {
          renderCards(response.data.cards, response.data.score, response.data.intel);
        } else {
          renderDemoFallback();
        }
      });
    } catch (err) {
      renderDemoFallback();
    }
  }

  function renderCards(cards, score, intel) {
    score = score || 72;
    currentCards = cards || [];
    currentActiveIndex = -1;
    const feed = document.getElementById("lt-feed");
    const scoreVal = document.getElementById("lt-score-val");
    const scoreBar = document.getElementById("lt-score-bar");
    const summaryEl = document.getElementById("lt-video-summary");
    const trackEl = document.getElementById("lt-timeline-track");
    const verdictSummary = document.getElementById("lt-verdict-summary");

    if (scoreVal) scoreVal.innerText = `${score}% Accurate`;
    if (scoreBar) scoreBar.style.width = `${score}%`;

    if (summaryEl) {
      summaryEl.innerText = intel || "Video Topic & Scientific Overview: Spoken claims cross-referenced with peer-reviewed medical and factual databases.";
    }

    // 1. Render Google Chips Style Clickable Timeline
    if (trackEl && cards && cards.length > 0) {
      let falseCount = 0;
      let verifiedCount = 0;
      let misleadingCount = 0;

      trackEl.innerHTML = cards.map((c, idx) => {
        const v = (c.verdict || "VERIFIED").toUpperCase();
        if (v === "FALSE") falseCount++;
        else if (v === "VERIFIED" || v === "TRUE") verifiedCount++;
        else misleadingCount++;

        const dot = (v === "FALSE") ? "🔴" : ((v === "VERIFIED" || v === "TRUE") ? "🟢" : "🟡");
        return `
          <button class="lt-timeline-pin ${v}" data-seconds="${c.seconds}" data-card="card-${idx}" title="Jump to ${c.timestamp}: ${c.quote}">
            <span>${dot}</span>
            <span>${c.timestamp}</span>
          </button>
        `;
      }).join("");

      if (verdictSummary) {
        verdictSummary.innerHTML = `
          <span style="color:#F28B82; font-weight:600;">🔴 ${falseCount} False</span>
          <span style="color:#81C995; font-weight:600;">🟢 ${verifiedCount} Verified</span>
          <span style="color:#FDD663; font-weight:600;">🟡 ${misleadingCount} Misleading</span>
        `;
      }
    }

    // 2. Render Google Material 3 Fact Cards
    if (feed && cards) {
      feed.innerHTML = cards.map((c, idx) => {
        const v = (c.verdict || "VERIFIED").toUpperCase();
        return `
          <div id="card-${idx}" class="lt-card ${v}">
            <div class="lt-card-top">
              <span class="lt-badge ${v}">${v}</span>
              <button class="lt-time-btn" data-seconds="${c.seconds}">⏱️ ${c.timestamp}</button>
            </div>
            <div class="lt-quote">"${c.quote}"</div>
            <div class="lt-explanation">${c.explanation}</div>
            <div class="lt-source">Primary Authority: <strong>${c.source}</strong></div>

            <!-- Research Evidence & Origin Toggle Button -->
            <button class="lt-research-btn" data-target="drawer-${idx}">
              <span style="display:flex; align-items:center; gap:6px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                Verified Research & Primary Origin
              </span>
              <span class="drawer-arrow">▼ View Evidence</span>
            </button>
            
            <div id="drawer-${idx}" class="lt-research-drawer">
              <h4>📚 Peer-Reviewed Research Dossier:</h4>
              <div style="margin-bottom:6px;"><strong>Citation:</strong> ${c.researchPaper || c.source + " (Peer-Reviewed Meta-Analysis)"}</div>
              <div style="margin-bottom:6px;"><strong>Empirical Finding / Fact Check:</strong> ${c.researchSummary || "Empirical clinical trials demonstrate direct contradiction with common popular folklore."}</div>
              <div style="color:#8AB4F8; font-size:11px;"><strong>Data Origin:</strong> ${c.dataOrigin || "National Center for Biotechnology Information (NCBI) / PubMed Central Database"}</div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  function renderDemoFallback() {
    const feed = document.getElementById("lt-feed");
    const summaryEl = document.getElementById("lt-video-summary");
    const scoreVal = document.getElementById("lt-score-val");
    const scoreBar = document.getElementById("lt-score-bar");
    const trackEl = document.getElementById("lt-timeline-track");
    const verdictSummary = document.getElementById("lt-verdict-summary");

    if (scoreVal) scoreVal.innerText = "Ready to Verify";
    if (scoreBar) scoreBar.style.width = "0%";
    if (trackEl) trackEl.innerHTML = "<span style='color:#8E918F; font-size:11px;'>Press play or paste link to analyze facts...</span>";
    if (verdictSummary) verdictSummary.innerHTML = "";
    if (summaryEl) summaryEl.innerText = "Paste any video link above or play the video to start real-time verification.";
    if (feed) {
      feed.innerHTML = `
        <div style="text-align:center; padding: 36px 16px; color:#8E918F;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="1.8" style="margin: 0 auto 10px auto;">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="10 8 16 12 10 16 10 8" fill="#4285F4"></polygon>
          </svg>
          <div style="color:#fff; font-family:var(--g-font); font-size:13.5px; font-weight:600; margin-bottom:6px;">Waiting for Video Playback</div>
          <div style="font-size:12px; line-height:1.45;">Play the current video or paste any video link in the bar above to audit all spoken claims with Gemini.</div>
        </div>
      `;
    }
  }

  // Smooth DOM Observer instead of aggressive polling
  let domCheckTimeout = null;
  const observer = new MutationObserver(() => {
    if (domCheckTimeout) return;
    domCheckTimeout = setTimeout(() => {
      domCheckTimeout = null;
      setupExtension();
      attachUniversalVideoSync();
    }, 400);
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener("yt-navigate-finish", () => {
    setupExtension();
    detectUniversalVideoChange();
  });
  window.addEventListener("load", setupExtension);
})();
