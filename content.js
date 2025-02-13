chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "handleHighlight") {
    const selection = window.getSelection().toString().trim();
    if (selection) {
      chrome.runtime.sendMessage({
        action: "processContent",
        type: "highlight",
        content: {
          text: selection,
          question: request.selection
        }
      }, response => {
        alert(response.answer || "No answer found");
      });
    }
  }
});
