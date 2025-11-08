// Content script for capturing text selection
console.log('AI Notes content script loaded');

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelection') {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    
    sendResponse({
      text: selectedText,
      url: window.location.href,
      title: document.title
    });
  }
  
  return true;
});

// Add keyboard shortcut support (Ctrl/Cmd + Shift + S to save selection)
document.addEventListener('keydown', async (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
    event.preventDefault();
    
    const selection = window.getSelection();
    const selectedText = selection?.toString()?.trim();
    
    if (selectedText) {
      try {
        // Send to background script
        await chrome.runtime.sendMessage({
          action: 'saveNote',
          data: {
            content: selectedText,
            url: window.location.href,
            title: document.title
          }
        });
        
        // Visual feedback
        showSaveConfirmation();
      } catch (error) {
        console.error('Failed to save note:', error);
      }
    }
  }
});

// Show a temporary confirmation message
function showSaveConfirmation() {
  const notification = document.createElement('div');
  notification.textContent = '✓ Saved to AI Notes';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

