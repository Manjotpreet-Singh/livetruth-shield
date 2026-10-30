// LiveTruth Shield - Background Service Worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkVideo") {
    const videoId = request.videoId;
    fetch(`http://localhost:5000/api/check?v=${videoId}`)
      .then(res => res.json())
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(err => {
        console.warn("Backend not reachable from service worker:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async sendResponse
  }
});