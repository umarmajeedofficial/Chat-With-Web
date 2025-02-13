const API_KEY = 'f9ecbc52f9be4724b6f5d0d599f580b7'; // ⚠️ INSECURE - FOR TESTING ONLY
const API_URL = 'https://api.aimlapi.com/v1/chat/completions';



async function handleRequest(request, sendResponse) {
    try {
        // Validate request
        if (!request.content) {
            throw new Error('Empty query content');
        }

        // Classify query
        const queryType = await classifyQuery(request.content);
        const model = queryType === 'critical' 
            ? 'deepseek/deepseek-r1' 
            : 'deepseek/deepseek-chat';

        // API call
        const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model,
                messages: [{
                    role: "user",
                    content: request.context 
                        ? `Context: ${request.context}\n\nQuestion: ${request.content}`
                        : request.content
                }],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        // Handle API errors
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Validate response structure
        if (!data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid API response format');
        }

        sendResponse({ 
            result: data.choices[0].message.content 
        });

    } catch (error) {
        console.error('Error:', error);
        sendResponse({ 
            error: error.message || 'Unknown error occurred'
        });
    }
}

async function classifyQuery(query) {
    try {
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
                    content: "Is this query technical/critical? Answer yes/no:"
                }, {
                    role: "user",
                    content: query
                }],
                max_tokens: 10
            })
        });

        const data = await response.json();
        return data.choices[0].message.content.toLowerCase().includes('yes') 
            ? 'critical' 
            : 'general';

    } catch (error) {
        console.error('Classification failed:', error);
        return 'general';
    }
}
