document.addEventListener("DOMContentLoaded", () => {
  const summarizeButton = document.getElementById("summarizeButton");
  const askButton = document.getElementById("askButton");
  const questionInput = document.getElementById("questionInput");
  const resultDiv = document.getElementById("result");

  let pageContent = null;

  const showLoader = () => resultDiv.innerHTML = '<div class="loader"></div>';
  const showError = (msg) => resultDiv.innerHTML = `<div class="error">${msg}</div>`;

  summarizeButton.addEventListener("click", () => {
    showLoader();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => document.documentElement.outerHTML
      }, (result) => {
        pageContent = result[0].result;
        chrome.runtime.sendMessage({
          action: "processContent",
          type: "summary",
          content: { html: pageContent }
        }, handleResponse);
      });
    });
  });

  askButton.addEventListener("click", () => {
    const question = questionInput.value.trim();
    if (!question) return;
    
    showLoader();
    chrome.runtime.sendMessage({
      action: "processContent",
      type: "question",
      content: {
        question: question,
        context: pageContent
      }
    }, handleResponse);
  });

  function handleResponse(response) {
    if (response.error) {
      showError(response.error);
    } else if (response.summary) {
      resultDiv.innerHTML = `<div class="summary"><h3>Summary:</h3>${response.summary}</div>`;
    } else if (response.answer) {
      resultDiv.innerHTML = `<div class="answer"><h3>Answer:</h3>${response.answer}</div>`;
    }
  }
});
