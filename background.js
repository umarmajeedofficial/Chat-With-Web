chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "askHighlight",
    title: "Ask about this",
    contexts: ["selection"]
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processContent") {
    handleContentProcessing(request, sendResponse);
    return true;
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "askHighlight" && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: "handleHighlight",
      selection: info.selectionText
    });
  }
});

async function handleContentProcessing(request, sendResponse) {
  try {
    const endpoint = request.type === 'question' ? '/ask' : '/summarize';
    const response = await fetch(`http://localhost:5000${endpoint}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(request.content)
    });
    const data = await response.json();
    sendResponse(data);
  } catch (error) {
    console.error('Backend Error:', error);
    sendResponse({ error: "Service unavailable. Try again later." });
  }
}
