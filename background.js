const API_KEY = 'f9ecbc52f9be4724b6f5d0d599f580b7';
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
    return true;
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

    const data = await response.json();
    const result = data.choices[0].message.content;
    
    session.history = messages.concat([{ role: "assistant", content: result }]);
    session.context = request.context || session.context;
    chrome.storage.local.set({ session });
    
    sendResponse({ result });
  } catch (error) {
    console.error('API Error:', error);
    sendResponse({ error: "Service unavailable. Try again later." });
  }
}

function getModel(type) {
  return type === 'critical' ? 'deepseek/deepseek-r1' : 'deepseek/deepseek-chat';
}
