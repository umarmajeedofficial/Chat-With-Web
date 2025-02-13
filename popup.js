document.addEventListener("DOMContentLoaded", () => {
    const chatContainer = document.getElementById('chatContainer');
    const questionInput = document.getElementById('questionInput');
    const askButton = document.getElementById('askButton');
    const summarizeButton = document.getElementById('summarizeButton');
    const clearButton = document.getElementById('clearSession');
    
    let sessionHistory = [];
    let pageContent = '';
    let currentTabId = null;

    // Initialize
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        currentTabId = tab.id;
        loadSession();
        autoExtractContent();
    });

    // Message template
    const createMessage = (content, type) => {
        const message = document.createElement('div');
        message.className = `message ${type}-message`;
        
        if (content.includes('```')) {
            const codeContent = document.createElement('pre');
            codeContent.className = 'code-block';
            codeContent.textContent = content.replace(/```/g, '');
            message.appendChild(codeContent);
            hljs.highlightElement(codeContent);
        } else {
            message.textContent = content;
        }
        
        return message;
    };

    // Load previous session
    async function loadSession() {
        const data = await chrome.storage.local.get([`session-${currentTabId}`]);
        sessionHistory = data[`session-${currentTabId}`] || [];
        renderHistory();
    }

    // Save session
    function saveSession() {
        chrome.storage.local.set({ [`session-${currentTabId}`]: sessionHistory });
    }

    // Render chat history
    function renderHistory() {
        chatContainer.innerHTML = '';
        sessionHistory.forEach(msg => {
            chatContainer.appendChild(createMessage(msg.content, msg.role));
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Auto-extract content
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

    // Handle summarize
    summarizeButton.addEventListener('click', async () => {
        const loader = document.createElement('div');
        loader.className = 'loader';
        chatContainer.appendChild(loader);
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: "process",
                type: "summary",
                content: pageContent
            });

            sessionHistory.push(
                { role: 'user', content: 'Summarize this page' },
                { role: 'assistant', content: response.result }
            );
            saveSession();
            renderHistory();
        } catch (error) {
            showError(error.message);
        }
    });

    // Handle questions
    askButton.addEventListener('click', async () => {
        const question = questionInput.value.trim();
        if (!question) return;

        sessionHistory.push({ role: 'user', content: question });
        renderHistory();
        questionInput.value = '';
        
        const loader = document.createElement('div');
        loader.className = 'loader';
        chatContainer.appendChild(loader);

        try {
            const response = await chrome.runtime.sendMessage({
                action: "process",
                type: "question",
                content: question,
                context: pageContent
            });

            sessionHistory.push({ role: 'assistant', content: response.result });
            saveSession();
            renderHistory();
        } catch (error) {
            showError(error.message);
        }
    });

    // Clear session
    clearButton.addEventListener('click', () => {
        sessionHistory = [];
        pageContent = '';
        chrome.storage.local.remove(`session-${currentTabId}`);
        renderHistory();
    });

    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        chatContainer.appendChild(errorDiv);
    }
});
