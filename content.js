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

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const container = document.createElement('div');
const shadowRoot = container.attachShadow({ mode: 'open' });
shadowRoot.appendChild(style);
document.body.appendChild(container);

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
