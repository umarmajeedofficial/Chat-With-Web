const API_KEY = 'f9ecbc52f9be4724b6f5d0d599f580b7'; // ⚠️ INSECURE - FOR TESTING ONLY
const API_URL = 'https://api.aimlapi.com/v1/chat/completions';


// Session cache
const sessionCache = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "process") {
        handleRequest(request, sender.tab.id, sendResponse);
        return true;
    }
});

async function handleRequest(request, tabId, sendResponse) {
    try {
        // Get cached content or use new
        const context = sessionCache.get(tabId)?.content || request.context;
        
        // Classify query
        const isTechnical = await classifyQuery(request.content);
        const model = isTechnical ? 'deepseek/deepseek-r1' : 'deepseek/deepseek-chat';

        const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{
                    role: "system",
                    content: `You are a helpful assistant. Current page context: ${context?.substring(0, 3000) || 'No context'}`
                }, {
                    role: "user",
                    content: request.content
                }],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();
        sendResponse({ result: data.choices[0].message.content });

        // Update cache
        sessionCache.set(tabId, {
            content: context,
            history: [...(sessionCache.get(tabId)?.history || []), request]
        });

    } catch (error) {
        console.error('Background error:', error);
        sendResponse({ error: error.message });
    }
}

async function classifyQuery(query) {
    const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: 'deepseek/deepseek-v3',
            messages: [{
                role: "system",
                content: "Classify if this query requires technical expertise (1) or general knowledge (0)"
            }, {
                role: "user",
                content: query
            }]
        })
    });
    
    const data = await response.json();
    return data.choices[0].message.content.includes('1');
}
