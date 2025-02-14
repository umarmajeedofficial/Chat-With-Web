document.addEventListener('DOMContentLoaded', async () => {
    const chatContainer = document.getElementById('chatContainer');
    const queryInput = document.getElementById('queryInput');
    const askButton = document.getElementById('ask');
    const toggleButton = document.getElementById('toggleHighlight');
    let pageContent = '';
    let keepPopupOpen = false;
    let highlightFeatureEnabled = true;

    // Initialize toggle state
    chrome.storage.local.get(['highlightEnabled'], (result) => {
        highlightFeatureEnabled = result.highlightEnabled !== undefined ? result.highlightEnabled : true;
        updateToggleButton();
    });

    // Toggle highlight feature
    toggleButton.addEventListener('click', () => {
        highlightFeatureEnabled = !highlightFeatureEnabled;
        chrome.storage.local.set({ highlightEnabled: highlightFeatureEnabled });
        updateToggleButton();
    });

    function updateToggleButton() {
        toggleButton.classList.toggle('toggle-on', highlightFeatureEnabled);
        toggleButton.classList.toggle('toggle-off', !highlightFeatureEnabled);
        toggleButton.title = highlightFeatureEnabled 
            ? "Disable highlight feature" 
            : "Enable highlight feature";
    }

    // Input validation
    queryInput.addEventListener('input', () => {
        askButton.disabled = !queryInput.value.trim();
    });

    // Load session history
    chrome.storage.local.get('session', ({ session }) => {
        if (session?.history) {
            session.history.forEach(msg => addMessage(msg.role, msg.content));
            pageContent = session.context;
        }
    });

    // Highlight result handler
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "showHighlightResult") {
            addMessage('user', `Highlighted context: ${request.context}\n\nQuestion: ${request.question}`);
            addMessage('assistant', request.answer);
        }
    });

    // Summarize button
    document.getElementById('summarize').addEventListener('click', async () => {
        const content = await getPageContent();
        pageContent = content.substring(0, 5000);
        sendRequest('summary', `Summarize this content: ${pageContent}`, true);
    });

    // Ask button
    askButton.addEventListener('click', () => processQuery());
    
    // New chat button
    document.getElementById('newChat').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "clearHistory" });
        chatContainer.innerHTML = '';
        pageContent = '';
        queryInput.value = '';
        askButton.disabled = true;
    });

    // Enter key handler
    queryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !askButton.disabled) processQuery();
    });

    // Keep popup open during requests
    window.addEventListener('blur', () => {
        if (keepPopupOpen) window.focus();
    });

    async function processQuery() {
        const question = queryInput.value.trim();
        if (!question) return;
        
        if (question.toLowerCase().includes('summarize')) {
            const content = await getPageContent();
            pageContent = content.substring(0, 5000);
            sendRequest('summary', `Summarize this content: ${pageContent}`, true);
            return;
        }

        queryInput.value = '';
        addMessage('user', question);
        sendRequest('question', `Context: ${pageContent}\n\nQuestion: ${question}`);
    }

    function sendRequest(type, content, reset = false) {
        keepPopupOpen = true;
        showStatus('Generating...');
        
        chrome.runtime.sendMessage({
            action: "process",
            type,
            content,
            reset
        }, (response) => {
            keepPopupOpen = false;
            hideStatus();
            
            if (chrome.runtime.lastError) {
                addMessage('error', chrome.runtime.lastError.message);
                return;
            }
            
            if (response?.error) {
                addMessage('error', response.error);
            } else {
                addMessage('assistant', response?.result || "No response received");
            }
        });
    }

    function addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        const formatted = content
            .replace(/Highlighted context: (.*?)(\n\nQuestion:)/, 
                (match, context, questionPart) => 
                `<div class="highlight-context">${context}</div>${questionPart}`)
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
            
        messageDiv.innerHTML = formatted.split('\n').join('<br>');
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    async function getPageContent() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body.innerText
        });
        return result[0].result;
    }

    function showStatus(text) {
        document.getElementById('status').textContent = text;
    }

    function hideStatus() {
        document.getElementById('status').textContent = '';
    }
});
