const style = document.createElement('style');
style.textContent = `
    .deepseek-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
        z-index: 2147483647;
        font-family: Arial, sans-serif;
    }

    #deepseek-loader {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #2196F3;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        z-index: 2147483647;
    }

    .deepseek-highlight-popup {
        position: absolute;
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 2147483647;
        width: 300px;
        font-family: Arial, sans-serif;
    }

    .highlight-popup-content {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .highlight-context {
        font-size: 0.9em;
        color: #666;
        padding: 8px;
        background: #f5f5f5;
        border-radius: 4px;
        max-height: 100px;
        overflow-y: auto;
    }

    .highlight-query-input {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 8px;
    }

    .highlight-query-input:focus {
        outline: 2px solid #2196F3;
    }

    .button-group {
        display: flex;
        gap: 8px;
        justify-content: space-between;
        margin-top: 8px;
    }

    .highlight-submit-btn {
        background: #2196F3;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        width: 100%;
    }

    .highlight-submit-btn:hover {
        opacity: 0.9;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

const container = document.createElement('div');
const shadowRoot = container.attachShadow({ mode: 'open' });
shadowRoot.appendChild(style);
document.body.appendChild(container);

let highlightPopup = null;

document.addEventListener('mouseup', (e) => {
    const selection = window.getSelection().toString().trim();
    if (selection && !highlightPopup) {
        chrome.storage.local.get(['highlightEnabled'], (result) => {
            const highlightEnabled = result.highlightEnabled !== false;
            if (highlightEnabled) {
                showHighlightPopup(selection, e);
            }
        });
    }
});

document.addEventListener('mousedown', (e) => {
    if (highlightPopup) {
        const path = e.composedPath();
        const isInsidePopup = path.some(el => el === highlightPopup);
        if (!isInsidePopup) {
            shadowRoot.removeChild(highlightPopup);
            highlightPopup = null;
        }
    }
});

function showHighlightPopup(selection, event) {
    if (highlightPopup) return;

    highlightPopup = document.createElement('div');
    highlightPopup.className = 'deepseek-highlight-popup';
    highlightPopup.innerHTML = `
        <div class="highlight-popup-content">
            <div class="highlight-context">${selection}</div>
            <input type="text" class="highlight-query-input" placeholder="Ask about the highlighted text (optional)..." autofocus>
            <div class="button-group">
                <button class="highlight-submit-btn">Ask DeepSeek</button>
            </div>
        </div>
    `;

    const rect = getSelectionRect();
    highlightPopup.style.left = `${rect.left}px`;
    highlightPopup.style.top = `${rect.bottom + window.scrollY + 10}px`;

    const input = highlightPopup.querySelector('.highlight-query-input');
    const submitButton = highlightPopup.querySelector('.highlight-submit-btn');
    
    submitButton.addEventListener('click', () => handleButtonClick(selection, input));
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleButtonClick(selection, input);
    });

    shadowRoot.appendChild(highlightPopup);
}

function handleButtonClick(context, input) {
    const question = input.value.trim() || "Please explain this highlighted text";
    handleHighlightQuery(context, question);
    shadowRoot.removeChild(highlightPopup);
    highlightPopup = null;
}

function getSelectionRect() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    return range.getBoundingClientRect();
}

function handleHighlightQuery(context, question) {
    showLoadingIndicator();
    chrome.runtime.sendMessage({
        action: "process",
        type: "highlight",
        content: `Context: ${context}\n\nQuestion: ${question}`,
        context: context
    }, response => {
        removeLoadingIndicator();
        if (response.error) {
            showResultNotification(response.error);
        } else {
            chrome.runtime.sendMessage({
                action: "showHighlightResult",
                context: context,
                question: question,
                answer: response.result
            });
            chrome.action.openPopup();
        }
    });
}

function showLoadingIndicator() {
    const loader = document.createElement('div');
    loader.id = 'deepseek-loader';
    shadowRoot.appendChild(loader);
}

function removeLoadingIndicator() {
    const loader = shadowRoot.getElementById('deepseek-loader');
    if (loader) shadowRoot.removeChild(loader);
}

function showResultNotification(text) {
    const notification = document.createElement('div');
    notification.className = 'deepseek-notification';
    notification.innerHTML = text
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .split('\n').join('<br>');
    
    shadowRoot.appendChild(notification);
    setTimeout(() => shadowRoot.removeChild(notification), 5000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "handleHighlight") {
        const selection = window.getSelection().toString().trim();
        if (selection) {
            showLoadingIndicator();
            chrome.runtime.sendMessage({
                action: "process",
                type: "question",
                content: `Context: ${selection}\n\nQuestion: ${request.selection}`
            }, response => {
                removeLoadingIndicator();
                showResultNotification(response.result || "No answer found");
            });
        }
    }
});
