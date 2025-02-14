const API_KEY = 'a6c6ba926382487d9f34370a3434a114';
const API_URL = 'https://api.aimlapi.com/v1/chat/completions';

let session = {
  history: [],
  context: null
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "askHighlight",
    title: "Ask about this",
    contexts: ["selection"]
  });
  chrome.storage.local.clear();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "process") {
    handleRequest(request, sendResponse);
    return true; // Keep channel open for async response
  }
  if (request.action === "clearHistory") {
    session = { history: [], context: null };
    chrome.storage.local.remove(['session']);
  }
});

async function handleRequest(request, sendResponse) {
  try {
    const messages = request.reset ? 
      [{ role: "system", content: "You are a helpful assistant." }] : 
      session.history;

    // Add context if available
    if (request.context) {
      messages.push({ 
        role: "system", 
        content: `Highlighted context: ${request.context}`
      });
    }

    messages.push({ role: "user", content: request.content });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: getModel(request.type),
        messages: messages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.choices[0].message.content;
    
    // Update session
    session.history = messages.concat([{ role: "assistant", content: result }]);
    session.context = request.context || session.context;
    chrome.storage.local.set({ session });
    
    sendResponse({ result });
  } catch (error) {
    console.error('API Error:', error);
    sendResponse({ 
      error: error.message.includes('Failed to fetch') 
        ? "Network error. Check your internet connection."
        : "Service unavailable. Please try again later."
    });
  }
}

function getModel(type) {
  return type === 'critical' ? 'deepseek/deepseek-r1' : 'deepseek/deepseek-chat';
}
