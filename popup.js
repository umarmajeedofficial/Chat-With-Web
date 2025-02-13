document.addEventListener("DOMContentLoaded", () => {
    const MAX_RETRIES = 2;
    const REQUEST_TIMEOUT = 30000; // 30 seconds
    const RATE_LIMIT_DURATION = 5000; // 5 seconds
    
    const chatContainer = document.getElementById('chatContainer');
    const questionInput = document.getElementById('questionInput');
    const askButton = document.getElementById('askButton');
    const summarizeButton = document.getElementById('summarizeButton');
    const clearButton = document.getElementById('clearSession');
    
    let sessionHistory = [];
    let pageContent = '';
    let currentTabId = null;
    let lastRequestTime = 0;
    let currentLoader = null;

    // Initialize
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        currentTabId = tab.id;
        loadSession();
        autoExtractContent();
    });

    // UI Components
    const createMessage = (content, type) => {
        const message = document.createElement('div');
        message.className = `message ${type}-message`;
        
        // Handle code blocks
        const codeBlocks = content.match(/```[\s\S]*?```/g);
        if (codeBlocks) {
            codeBlocks.forEach(code => {
                const cleanCode = code.replace(/```(\w+)?/g, '');
                const codeElement = document.createElement('pre');
                codeElement.className = 'code-block';
                codeElement.textContent = cleanCode;
                message.appendChild(codeElement);
                hljs.highlightElement(codeElement);
            });
            content = content.replace(/```[\s\S]*?```/g, '');
        }
        
        if (content.trim()) {
            const textElement = document.createElement('div');
            textElement.textContent = content;
            message.appendChild(textElement);
        }
        
        return message;
    };

    const showLoader = () => {
        if (currentLoader) return;
        currentLoader = document.createElement('div');
        currentLoader.className = 'loader';
        chatContainer.appendChild(currentLoader);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    const hideLoader = () => {
        if (currentLoader) {
            currentLoader.remove();
            currentLoader = null;
        }
    };

    const showError = (message, retryCallback) => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        
        errorDiv.innerHTML = `
            ${message}
            ${retryCallback ? '<button class="retry-button">Retry</button>' : ''}
        `;

        if (retryCallback) {
            errorDiv.querySelector('.retry-button').addEventListener('click', retryCallback);
        }

        chatContainer.appendChild(errorDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    // Session Management
    async function loadSession() {
        const data = await chrome.storage.local.get([`session-${currentTabId}`]);
        sessionHistory = data[`session-${currentTabId}`] || [];
        renderHistory();
    }

    function saveSession() {
        chrome.storage.local.set({ 
            [`session-${currentTabId}`]: sessionHistory,
            lastRequestTime: Date.now()
        });
    }

    function renderHistory() {
        chatContainer.innerHTML = '';
        sessionHistory.forEach(msg => {
            chatContainer.appendChild(createMessage(msg.content, msg.role));
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Rate Limiting
    async function checkRateLimit() {
        const data = await chrome.storage.local.get(['lastRequestTime']);
        const lastTime = data.lastRequestTime || 0;
        return Date.now() - lastTime < RATE_LIMIT_DURATION;
    }

    // Content Handling
    async function autoExtractContent() {
        if (!pageContent) {
            try {
                const result = await chrome.scripting.executeScript({
                    target: { tabId: currentTabId },
                    func: () => document.body.innerText
                });
                pageContent = result[0].result.substring(0, 5000);
            } catch (error) {
                showError('Failed to auto-extract page content');
            }
        }
    }

    // Request Handler
    async function handleRequest(request, retries = 0) {
        try {
            // Rate limiting check
            if (await checkRateLimit()) {
                throw new Error('Please wait a moment before making another request');
            }

            // Input validation
            if (!request.content.trim()) {
                throw new Error('Please enter a valid question');
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

            const response = await chrome.runtime.sendMessage({
                ...request,
                action: "process"
            });

            clearTimeout(timeoutId);

            if (response?.error) {
                throw new Error(response.error);
            }

            if (!response?.result) {
                throw new Error('Invalid response format');
            }

            return response.result;

        } catch (error) {
            if (error.name === 'AbortError') {
                error.message = 'Request timed out';
            }

            if (retries < MAX_RETRIES) {
                return handleRequest(request, retries + 1);
            }

            throw error;
        }
    }

    // Event Handlers
    summarizeButton.addEventListener('click', async () => {
        try {
            showLoader();
            const result = await handleRequest({
                type: "summary",
                content: "Summarize this page content into 5 key points"
            });

            sessionHistory.push(
                { role: 'user', content: 'Summarize this page' },
                { role: 'assistant', content: result }
            );
            saveSession();
            renderHistory();

        } catch (error) {
            showError(error.message, () => {
                summarizeButton.click();
            });
        } finally {
            hideLoader();
        }
    });

    askButton.addEventListener('click', async () => {
        const question = questionInput.value.trim();
        if (!question) {
            showError('Please enter a question');
            return;
        }

        questionInput.value = '';
        sessionHistory.push({ role: 'user', content: question });
        renderHistory();

        try {
            showLoader();
            const result = await handleRequest({
                type: "question",
                content: question,
                context: pageContent
            });

            sessionHistory.push({ role: 'assistant', content: result });
            saveSession();
            renderHistory();

        } catch (error) {
            showError(error.message, () => {
                askButton.click();
            });
        } finally {
            hideLoader();
        }
    });

    clearButton.addEventListener('click', () => {
        sessionHistory = [];
        pageContent = '';
        chrome.storage.local.remove(`session-${currentTabId}`);
        renderHistory();
    });

    // Keyboard Shortcuts
    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            askButton.click();
        }
    });
});
