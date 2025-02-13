document.addEventListener('DOMContentLoaded', async () => {
  const chatContainer = document.getElementById('chatContainer');
  const queryInput = document.getElementById('queryInput');
  const askButton = document.getElementById('ask');
  let pageContent = '';

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

  async function processQuery() {
      const question = queryInput.value.trim();
      if (!question) return;
      
      // Handle summarize command
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
      showStatus('Generating...');
      chrome.runtime.sendMessage({
          action: "process",
          type,
          content,
          reset
      }, response => {
          hideStatus();
          if (response.error) {
              addMessage('error', response.error);
          } else {
              addMessage('assistant', response.result);
          }
      });
  }

  function addMessage(role, content) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${role}-message`;
      
      const formatted = content
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
