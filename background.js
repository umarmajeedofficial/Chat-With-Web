const CLOUDFLARE_WORKER_URL = "https://deepseek-api.umarmajeedofficial.workers.dev/";

// Handle context menu for highlighted text
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "askHighlight",
    title: "Ask about this",
    contexts: ["selection"]
  });
});

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processContent") {
    handleContentProcessing(request, sendResponse);
    return true; // Required for async response
  }
});

// Handle highlighted text
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "askHighlight" && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: "handleHighlight",
      selection: info.selectionText
    });
  }
});

// Process content with Cloudflare Worker
async function handleContentProcessing(request, sendResponse) {
  try {
    const endpoint = request.type === 'question' ? '/ask' : '/summarize';
    const response = await fetch(`${CLOUDFLARE_WORKER_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.content)
    });
    const data = await response.json();
    sendResponse(data);
  } catch (error) {
    console.error('Error:', error);
    sendResponse({ error: "Service unavailable. Try again later." });
  }
}
