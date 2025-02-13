document.addEventListener("DOMContentLoaded", () => {
  const summarizeButton = document.getElementById("summarizeButton");
  const askButton = document.getElementById("askButton");
  const questionInput = document.getElementById("questionInput");
  const resultDiv = document.getElementById("result");
  let pageContent = '';

  const showLoader = () => resultDiv.innerHTML = '<div class="loader"></div>';
  const showError = (msg) => resultDiv.innerHTML = `<div class="error">${msg}</div>`;

  summarizeButton.addEventListener("click", async () => {
    showLoader();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    });
    
    pageContent = result[0].result;
    
    chrome.runtime.sendMessage({
      action: "process",
      type: "summary",
      content: pageContent
    }, response => {
      if (response.error) showError(response.error);
      else resultDiv.innerHTML = `<div class="summary">${response.result}</div>`;
    });
  });

  askButton.addEventListener("click", () => {
    const question = questionInput.value.trim();
    if (!question) return;
    
    showLoader();
    chrome.runtime.sendMessage({
      action: "process",
      type: "question",
      content: question,
      context: pageContent
    }, response => {
      if (response.error) showError(response.error);
      else resultDiv.innerHTML = `<div class="answer">${response.result}</div>`;
    });
  });
});
