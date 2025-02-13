const API_KEY = 'f9ecbc52f9be4724b6f5d0d599f580b7'; // ⚠️ INSECURE - FOR TESTING ONLY
const API_URL = 'https://api.aimlapi.com/v1/chat/completions';

// Handle context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "askHighlight",
    title: "Ask about this",
    contexts: ["selection"]
  });
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "process") {
    handleRequest(request, sendResponse);
    return true;
  }
});

// Handle requests
async function handleRequest(request, sendResponse) {
  try {
    const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: getModel(request.type),
        messages: createMessages(request)
      })
    });

    const data = await response.json();
    sendResponse({ result: data.choices[0].message.content });
  } catch (error) {
    console.error('API Error:', error);
    sendResponse({ error: "Service unavailable. Try again later." });
  }
}

function getModel(type) {
  return type === 'critical' ? 'deepseek/deepseek-r1' : 'deepseek/deepseek-chat';
}

function createMessages(request) {
  if (request.type === 'summary') {
    return [{
      role: "user",
      content: `Summarize this content: ${request.content.substring(0, 5000)}`
    }];
  }
  return [{
    role: "user",
    content: `Context: ${request.context}\n\nQuestion: ${request.content}`
  }];
}
