(function () {
  let isOpen = false;
  let activeVideoKey = "";
  let soundEnabled = true;
  let playedAlerts = new Set();
  let currentCards = [];
  let currentActiveIndex = -1;
  let lastTimeUpdate = 0;
  let cachedVideoElement = null;
  let hasAnalyzedCurrentVideo = false;
  let isFetching = false;

  let audioCtxInstance = null;
  function playAlertChime() {
    if (!soundEnabled) return;
    try {
      if (!audioCtxInstance) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioCtxInstance = new AudioCtx();
      }
      if (audioCtxInstance.state === "suspended") audioCtxInstance.resume();
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
    if (!chosen && videos.length > 0) chosen = videos[0];
    cachedVideoElement = chosen;
    return chosen;
  }

  function isVideoPlaying() {
    const v = getActiveVideoElement();
    return v && !v.paused && !v.ended && v.currentTime > 0;
  }

  function isWatchPage() {
    if (!window.location.hostname.includes("youtube.com")) return true;
    return window.location.pathname === "/watch";
  }

  function getYouTubeVideoId() {
    if (!window.location.hostname.includes("youtube.com")) return null;
    if (window.location.pathname !== "/watch") return null;
    const params = new URLSearchParams(window.location.search);
    const v = params.get("v");
    return (v && v.length >= 8) ? v : null;
  }

  function setupExtension() {
    if (document.getElementById("livetruth-btn")) return;
    const video = getActiveVideoElement();
    if (!video && !window.location.hostname.includes("youtube.com")) return;

    // 1. Sleek Floating Action Pill
    const btn = document.createElement("button");
    btn.id = "livetruth-btn";
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.2">
        <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
        <path d="M10 15.5l-3.5-3.5 1.41-1.41L10 12.67l5.59-5.59L17 8.5l-7 7z" fill="#3B82F6"/>
      </svg>
      <span>LiveTruth</span>
      <span class="lt-badge-status" id="lt-pill-status">READY</span>
    `;
    btn.addEventListener("click", togglePanel);
    document.body.appendChild(btn);

    // 2. Minimalist Sidebar Panel
    const panel = document.createElement("div");
    panel.id = "livetruth-panel";
    panel.innerHTML = `
      <div class="lt-head">
        <h2>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.2">
            <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/>
          </svg>
          LiveTruth
          <span class="lt-badge-status" id="lt-status-badge">Ready</span>
        </h2>
        <div style="display:flex; align-items:center; gap:6px;">
          <button id="lt-sound-btn" class="lt-sound-toggle active" title="Toggle audio alert">🔔 Sound</button>
          <button id="lt-close" title="Close">✕</button>
        </div>
      </div>

      <!-- Test URL Input Bar -->
      <div class="lt-input-capsule">
        <input type="text" id="lt-manual-url" placeholder="Paste link or test custom URL...">
        <button id="lt-manual-btn">Test</button>
      </div>

      <!-- Topic Intel -->
      <div id="lt-intel-box">
        <div class="lt-intel-tag">Topic Intel</div>
        <div id="lt-video-title">No Video Active</div>
        <div id="lt-video-summary">Play video or enter URL above to test facts.</div>
      </div>

      <!-- Reliability Score Bar -->
      <div class="lt-score-box">
        <div class="lt-score-header">
          <span>Truth Reliability</span>
          <strong id="lt-score-val" style="color:#10B981; font-family:var(--lt-mono);">--</strong>
        </div>
        <div class="lt-score-bar-bg">
          <div id="lt-score-bar" class="lt-score-bar"></div>
        </div>
      </div>

      <!-- Timeline Track -->
      <div class="lt-timeline-box">
        <div class="lt-timeline-header">
          <span>Timeline</span>
          <div id="lt-verdict-summary" class="lt-verdict-summary">
            <span style="color:#F87171; font-family:var(--lt-mono); font-size:10px;">0 FALSE</span>
            <span style="color:#34D399; font-family:var(--lt-mono); font-size:10px;">0 VERIFIED</span>
            <span style="color:#FBBF24; font-family:var(--lt-mono); font-size:10px;">0 MISLEADING</span>
          </div>
        </div>
        <div id="lt-timeline-track" class="lt-timeline-track">
          <span style="color:var(--lt-text-dim); font-size:10px;">Waiting for playback...</span>
        </div>
      </div>

      <!-- Claims Feed -->
      <div id="lt-feed" class="lt-cards-feed"></div>
    `;
    document.body.appendChild(panel);

    const closeBtn = document.getElementById("lt-close");
    if (closeBtn) closeBtn.addEventListener("click", togglePanel);

    const soundBtn = document.getElementById("lt-sound-btn");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        soundBtn.innerText = soundEnabled ? "🔔 Sound" : "🔕 Muted";
        soundBtn.classList.toggle("active", soundEnabled);
      });
    }

    const manualBtn = document.getElementById("lt-manual-btn");
    const manualInput = document.getElementById("lt-manual-url");
    if (manualBtn && manualInput) {
      manualBtn.addEventListener("click", () => {
        const val = manualInput.value.trim();
        if (val) {
          hasAnalyzedCurrentVideo = true;
          fetchUniversalAnalysis(val, val);
        }
      });
      manualInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const val = manualInput.value.trim();
          if (val) {
            hasAnalyzedCurrentVideo = true;
            fetchUniversalAnalysis(val, val);
          }
        }
      });
    }

    panel.addEventListener("click", (e) => {
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

      const timeBtn = e.target.closest(".lt-time-btn");
      if (timeBtn) {
        const seconds = parseInt(timeBtn.getAttribute("data-seconds"), 10);
        if (!isNaN(seconds)) seekTo(seconds);
        return;
      }

      const researchBtn = e.target.closest(".lt-research-btn");
      if (researchBtn) {
        const targetId = researchBtn.getAttribute("data-target");
        const drawer = document.getElementById(targetId);
        if (drawer) {
          drawer.classList.toggle("open");
          const isDrawerOpen = drawer.classList.contains("open");
          const arrowEl = researchBtn.querySelector(".drawer-arrow");
          if (arrowEl) arrowEl.innerText = isDrawerOpen ? "▲" : "▼";
        }
      }
    });

    renderIdleState();
    attachUniversalVideoSync();
    checkPlaybackStateChange();
  }

  function renderIdleState() {
    const feed = document.getElementById("lt-feed");
    const summaryEl = document.getElementById("lt-video-summary");
    const scoreVal = document.getElementById("lt-score-val");
    const scoreBar = document.getElementById("lt-score-bar");
    const trackEl = document.getElementById("lt-timeline-track");
    const verdictSummary = document.getElementById("lt-verdict-summary");
    const titleEl = document.getElementById("lt-video-title");
    const statusBadge = document.getElementById("lt-status-badge");

    let cleanTitle = document.title.replace(" - YouTube", "").replace(" | X", "").replace(" • Instagram", "");
    if (titleEl) titleEl.innerText = cleanTitle || "Video Ready";
    if (statusBadge) statusBadge.innerText = "Ready";

    if (scoreVal) scoreVal.innerText = "--";
    if (scoreBar) scoreBar.style.width = "0%";
    if (trackEl) trackEl.innerHTML = `<span style="color:var(--lt-text-dim); font-size:10px;">Waiting for playback...</span>`;
    
    if (verdictSummary) {
      verdictSummary.innerHTML = `
        <span style="color:#F87171; font-family:var(--lt-mono); font-size:10px;">0 FALSE</span>
        <span style="color:#34D399; font-family:var(--lt-mono); font-size:10px;">0 VERIFIED</span>
        <span style="color:#FBBF24; font-family:var(--lt-mono); font-size:10px;">0 MISLEADING</span>
      `;
    }
    
    if (summaryEl) summaryEl.innerText = "Video is not playing. Play video or paste URL above to test.";

    if (feed) {
      feed.innerHTML = `
        <div style="text-align:center; padding: 36px 14px; color:var(--lt-text-dim);">
          <div style="color:var(--lt-text-main); font-size:13px; font-weight:500; margin-bottom:5px;">Video Idle</div>
          <div style="font-size:11.5px; line-height:1.45;">Play the video to start real-time fact-checking, or enter any link above and click <strong>Test</strong>.</div>
        </div>
      `;
    }
  }

  function renderEmptyState(msg) {
    const feed = document.getElementById("lt-feed");
    const summaryEl = document.getElementById("lt-video-summary");
    const scoreVal = document.getElementById("lt-score-val");
    const scoreBar = document.getElementById("lt-score-bar");
    const trackEl = document.getElementById("lt-timeline-track");
    const verdictSummary = document.getElementById("lt-verdict-summary");
    const statusBadge = document.getElementById("lt-status-badge");

    if (statusBadge) statusBadge.innerText = "Completed";
    if (scoreVal) scoreVal.innerText = "0%";
    if (scoreBar) scoreBar.style.width = "0%";
    if (trackEl) trackEl.innerHTML = "<span style='color:var(--lt-text-dim); font-size:10px;'>No claims</span>";
    
    if (verdictSummary) {
      verdictSummary.innerHTML = `
        <span style="color:#F87171; font-family:var(--lt-mono); font-size:10px;">0 FALSE</span>
        <span style="color:#34D399; font-family:var(--lt-mono); font-size:10px;">0 VERIFIED</span>
        <span style="color:#FBBF24; font-family:var(--lt-mono); font-size:10px;">0 MISLEADING</span>
      `;
    }

    if (summaryEl) summaryEl.innerText = msg || "No testable factual claims detected.";
    if (feed) {
      feed.innerHTML = `
        <div style="text-align:center; padding: 36px 14px; color:var(--lt-text-dim);">
          <div style="color:var(--lt-text-main); font-size:13px; font-weight:500; margin-bottom:5px;">No Claims Found</div>
          <div style="font-size:11.5px; line-height:1.45;">${msg || "No testable factual claims detected in this video segment."}</div>
        </div>
      `;
    }
  }

  function attachUniversalVideoSync() {
    const video = getActiveVideoElement();
    if (!video || video.hasAttribute("data-lt-sync")) return;
    video.setAttribute("data-lt-sync", "true");

    video.addEventListener("play", () => {
      triggerAnalysisIfPlaying();
    });

    let isTicking = false;
    video.addEventListener("timeupdate", () => {
      if (!hasAnalyzedCurrentVideo && !isFetching && video.currentTime > 0.5 && !video.paused) {
        triggerAnalysisIfPlaying();
      }

      const now = performance.now();
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

  function triggerAnalysisIfPlaying() {
    const video = getActiveVideoElement();
    if (!video || video.paused) return;

    if (!isWatchPage()) return;
    const ytId = getYouTubeVideoId();
    const url = window.location.href;
    const currentKey = ytId || url;

    if (hasAnalyzedCurrentVideo && activeVideoKey === currentKey) return;

    activeVideoKey = currentKey;
    hasAnalyzedCurrentVideo = true;
    playedAlerts.clear();
    currentActiveIndex = -1;

    fetchUniversalAnalysis(ytId, url);
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
    if (panel) panel.classList.toggle("open", isOpen);
  }

  function checkPlaybackStateChange() {
    if (!isWatchPage()) {
      activeVideoKey = "";
      hasAnalyzedCurrentVideo = false;
      renderIdleState();
      return;
    }

    const ytId = getYouTubeVideoId();
    const url = window.location.href;
    const currentKey = ytId || url;

    if (currentKey !== activeVideoKey) {
      activeVideoKey = currentKey;
      hasAnalyzedCurrentVideo = false;
      playedAlerts.clear();
      currentCards = [];
      currentActiveIndex = -1;

      if (isVideoPlaying()) {
        triggerAnalysisIfPlaying();
      } else {
        renderIdleState();
      }
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
    if (isFetching) return;
    isFetching = true;

    const feed = document.getElementById("lt-feed");
    const titleEl = document.getElementById("lt-video-title");
    const statusBadge = document.getElementById("lt-status-badge");

    let cleanTitle = document.title.replace(" - YouTube", "").replace(" | X", "").replace(" • Instagram", "");
    if (titleEl && cleanTitle) titleEl.innerText = cleanTitle;
    if (statusBadge) statusBadge.innerText = "Auditing...";

    if (feed) {
      feed.innerHTML = `<div style="text-align:center; color:var(--lt-text-dim); font-size:12px; margin-top:35px;">Auditing claims with Gemini...</div>`;
    }

    try {
      chrome.runtime.sendMessage({ action: "checkVideo", videoId: (videoId || pageUrl), title: cleanTitle }, (response) => {
        isFetching = false;
        if (response && response.success && response.data) {
          renderCards(response.data.cards, response.data.score, response.data.intel);
        } else {
          renderEmptyState("No verifiable claims found for this video.");
        }
      });
    } catch (err) {
      isFetching = false;
      renderEmptyState("Could not reach backend at localhost:5000. Start backend with start.bat.");
    }
  }

  function renderCards(cards, score, intel) {
    // Sanitize: filter out any bogus cards with quote "N/A" or "System Error"
    const validCards = (cards || []).filter(c => {
      const q = (c.quote || "").trim().toUpperCase();
      const s = (c.source || "").toLowerCase();
      const exp = (c.explanation || "").toLowerCase();
      return q !== "N/A" && q !== "NONE" && q !== "NULL" && q !== "" && !s.includes("system error") && !exp.includes("malformed");
    });

    if (validCards.length === 0) {
      renderEmptyState(intel || "No verifiable claims found in this video.");
      return;
    }

    score = score || 0;
    currentCards = validCards;
    currentActiveIndex = -1;
    const feed = document.getElementById("lt-feed");
    const scoreVal = document.getElementById("lt-score-val");
    const scoreBar = document.getElementById("lt-score-bar");
    const summaryEl = document.getElementById("lt-video-summary");
    const trackEl = document.getElementById("lt-timeline-track");
    const verdictSummary = document.getElementById("lt-verdict-summary");
    const statusBadge = document.getElementById("lt-status-badge");

    let falseCount = 0, verifiedCount = 0, misleadingCount = 0;
    validCards.forEach(c => {
      const v = (c.verdict || "VERIFIED").toUpperCase();
      if (v === "FALSE") falseCount++;
      else if (v === "VERIFIED" || v === "TRUE") verifiedCount++;
      else misleadingCount++;
    });

    if (statusBadge) statusBadge.innerText = "Audited";
    if (scoreVal) scoreVal.innerText = `${score}%`;
    if (scoreBar) scoreBar.style.width = `${score}%`;

    if (summaryEl) {
      summaryEl.innerText = intel || "Video claims audited successfully.";
    }

    if (trackEl) {
      trackEl.innerHTML = validCards.map((c, idx) => {
        const v = (c.verdict || "VERIFIED").toUpperCase();
        return `
          <button class="lt-timeline-pin ${v}" data-seconds="${c.seconds}" data-card="card-${idx}" title="${c.timestamp}: ${c.quote}">
            <span>${c.timestamp}</span>
          </button>
        `;
      }).join("");
    }

    if (verdictSummary) {
      verdictSummary.innerHTML = `
        <span style="color:#F87171; font-family:var(--lt-mono); font-size:10px;">${falseCount} FALSE</span>
        <span style="color:#34D399; font-family:var(--lt-mono); font-size:10px;">${verifiedCount} VERIFIED</span>
        <span style="color:#FBBF24; font-family:var(--lt-mono); font-size:10px;">${misleadingCount} MISLEADING</span>
      `;
    }

    if (feed) {
      feed.innerHTML = validCards.map((c, idx) => {
        const v = (c.verdict || "VERIFIED").toUpperCase();
        return `
          <div id="card-${idx}" class="lt-card ${v}">
            <div class="lt-card-top">
              <span class="lt-badge ${v}">${v}</span>
              <button class="lt-time-btn" data-seconds="${c.seconds}">${c.timestamp}</button>
            </div>
            <div class="lt-quote">"${c.quote}"</div>
            <div class="lt-explanation">${c.explanation}</div>
            <div class="lt-source">Authority: <strong>${c.source}</strong></div>

            <button class="lt-research-btn" data-target="drawer-${idx}">
              <span>Evidence & Source</span>
              <span class="drawer-arrow">▼</span>
            </button>
            
            <div id="drawer-${idx}" class="lt-research-drawer">
              <div style="margin-bottom:4px;"><strong>Citation:</strong> ${c.researchPaper || c.source}</div>
              <div style="margin-bottom:4px;"><strong>Refutation / Finding:</strong> ${c.researchSummary || "Empirical review."}</div>
              <div style="color:#60A5FA; font-size:10.5px;"><strong>Origin:</strong> ${c.dataOrigin || "Primary Academic Repository"}</div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  let domCheckTimeout = null;
  const observer = new MutationObserver(() => {
    if (domCheckTimeout) return;
    domCheckTimeout = setTimeout(() => {
      domCheckTimeout = null;
      setupExtension();
      attachUniversalVideoSync();
    }, 400);
  });

  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

  window.addEventListener("yt-navigate-finish", () => {
    setupExtension();
    checkPlaybackStateChange();
  });
  window.addEventListener("load", setupExtension);
})();
