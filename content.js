// content.js

// Prevent multiple injections
if (window.audioTranscriberLoaded) {
  // console.log('Audio Transcriber content script already loaded');
} else {
  window.audioTranscriberLoaded = true;
  // console.log('Audio Transcriber content script loaded');

  let recordingIndicator = null;

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'show-indicator':
        showRecordingIndicator();
        sendResponse({ success: true });
        break;
      case 'hide-indicator':
        hideRecordingIndicator();
        sendResponse({ success: true });
        break;
    }
  });

  function showRecordingIndicator() {
    if (document.getElementById('audio-transcriber-indicator')) {
      return;
    }
    recordingIndicator = document.createElement('div');
    recordingIndicator.id = 'audio-transcriber-indicator';
    recordingIndicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 20px;
        height: 20px;
        background: #f44336;
        border-radius: 50%;
        z-index: 10000;
        animation: audio-transcriber-pulse 1.5s infinite;
        box-shadow: 0 0 10px rgba(244, 67, 54, 0.5);
      `;

    // Add animation to the page
    const style = document.createElement('style');
    style.id = 'audio-transcriber-style';
    style.textContent = `
        @keyframes audio-transcriber-pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
      `;
    document.head.appendChild(style);
    document.body.appendChild(recordingIndicator);
  }

  function hideRecordingIndicator() {
    const indicator = document.getElementById('audio-transcriber-indicator');
    if (indicator) {
      indicator.remove();
    }
    const style = document.getElementById('audio-transcriber-style');
    if (style) {
      style.remove();
    }
  }
} 