chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkVideo") {
    const videoId = request.videoId;
    const title = request.title || "";
    const apiUrl = `http://localhost:5000/api/check?v=${encodeURIComponent(videoId)}&title=${encodeURIComponent(title)}`;

    fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(err => {
        console.error("LiveTruth proxy fetch failed:", err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  }
});
